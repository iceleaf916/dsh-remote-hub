import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { startAgentServer } from "./agent.js";
import {
	mapRemoteSummary,
	mapRemoteWorkspace,
	parseRemoteSessionId,
	parseRemoteWorkspaceId,
	remoteSessionId,
	remoteWorkspaceId,
	unmapSessionRequest
} from "./identity.js";
import { chooseLocalPort, probeSsh, readAgentEndpoint, resolveSshAlias, startTunnel, validateSshAlias } from "./ssh.js";

const DATA_DIRECTORY = join(process.env.DSH_HOME || join(homedir(), ".dsh"), "remote-hub");
const DEVICES_PATH = join(DATA_DIRECTORY, "devices.json");
const SESSION_METHODS = new Set([
	"attachment",
	"cancel",
	"create",
	"follow",
	"fork",
	"page",
	"projections",
	"prompt",
	"rename",
	"selectModel",
	"updateQueue"
]);

function deviceIdFor(alias) {
	return createHash("sha256").update(alias).digest("hex").slice(0, 16);
}

function parseDeviceFile(value) {
	if (!value || typeof value !== "object" || !Array.isArray(value.devices)) return [];
	return value.devices.filter((item) => item && typeof item.id === "string" && typeof item.sshAlias === "string");
}

function abortIfNeeded(signal) {
	if (signal?.aborted) throw signal.reason || new Error("request aborted");
}

function requestSessionId(request) {
	return request?.sessionId ?? request?.address?.sessionId ?? request?.address?.childSessionId;
}

function publicDevice(device, state) {
	return {
		id: device.id,
		name: device.label || device.sshAlias,
		label: device.label || device.sshAlias,
		sshAlias: device.sshAlias,
		target: [device.user, device.hostName].filter(Boolean).join("@") || device.sshAlias,
		status: state?.status || "offline",
		lastError: state?.error || ""
	};
}

export class RemoteHubRuntime {
	constructor(ctx, config = {}) {
		this.ctx = ctx;
		this.config = config;
		this.role = config.role || "both";
		this.devices = [];
		this.tunnels = new Map();
		this.connecting = new Map();
		this.deviceStates = new Map();
		this.stopAgent = null;
		this.disposed = false;
		this.storeQueue = Promise.resolve();
		this.controller = ctx.get("sessionController");
		this.loadPromise = this.loadDevices();
	}

	async loadDevices() {
		try {
			this.devices = parseDeviceFile(JSON.parse(await readFile(DEVICES_PATH, "utf8")));
		} catch (error) {
			if (error?.code !== "ENOENT") this.ctx.logger.warn(`[dsh-remote-hub] cannot read device list: ${String(error)}`);
			this.devices = [];
		}
	}

	async persistDevices() {
		const snapshot = { version: 1, devices: this.devices.map(({ id, label, sshAlias, hostName, user, port }) => ({ id, label, sshAlias, hostName, user, port })) };
		this.storeQueue = this.storeQueue.then(async () => {
			await mkdir(dirname(DEVICES_PATH), { recursive: true, mode: 0o700 });
			const temporaryPath = `${DEVICES_PATH}.${process.pid}.tmp`;
			await writeFile(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 });
			await rename(temporaryPath, DEVICES_PATH);
		});
		return this.storeQueue;
	}

	async listDevices() {
		await this.loadPromise;
		return this.devices.map((device) => publicDevice(device, this.deviceStates.get(device.id)));
	}

	async addDevice(request) {
		const sshAlias = validateSshAlias(String(request?.sshAlias || "").trim());
		await probeSsh(sshAlias);
		const ssh = await resolveSshAlias(sshAlias);
		await this.loadPromise;
		const id = deviceIdFor(sshAlias);
		const device = {
			id,
			sshAlias,
			label: typeof request?.label === "string" && request.label.trim() ? request.label.trim().slice(0, 80) : sshAlias,
			hostName: ssh.hostName,
			user: ssh.user || "",
			port: ssh.port
		};
		this.devices = [...this.devices.filter((item) => item.id !== id), device];
		this.deviceStates.set(id, { status: "offline", error: "" });
		await this.persistDevices();
		return publicDevice(device, this.deviceStates.get(id));
	}

	async removeDevice(deviceId) {
		await this.loadPromise;
		await this.disconnect(deviceId);
		this.devices = this.devices.filter((device) => device.id !== deviceId);
		this.deviceStates.delete(deviceId);
		await this.persistDevices();
		return { removed: true };
	}

	findDevice(deviceId) {
		const device = this.devices.find((item) => item.id === deviceId);
		if (!device) throw new Error("远程设备不存在，请重新添加 SSH 主机");
		return device;
	}

	deviceStatus(deviceId) {
		const device = this.findDevice(deviceId);
		return publicDevice(device, this.deviceStates.get(deviceId));
	}

	async connect(deviceId) {
		await this.loadPromise;
		const existing = this.tunnels.get(deviceId);
		if (existing?.child.exitCode === null && existing?.child.signalCode === null) {
			try {
				await this.checkTunnel(existing);
				this.deviceStates.set(deviceId, { status: "online", error: "" });
				return publicDevice(this.findDevice(deviceId), this.deviceStates.get(deviceId));
			} catch {
				await this.stopTunnel(deviceId);
			}
		}
		if (this.connecting.has(deviceId)) return this.connecting.get(deviceId);
		const task = this.openTunnel(deviceId);
		this.connecting.set(deviceId, task);
		try {
			return await task;
		} finally {
			if (this.connecting.get(deviceId) === task) this.connecting.delete(deviceId);
		}
	}

	async openTunnel(deviceId) {
		const device = this.findDevice(deviceId);
		this.deviceStates.set(deviceId, { status: "connecting", error: "" });
		let tunnel;
		try {
			const endpoint = await readAgentEndpoint(device.sshAlias);
			const localPort = await chooseLocalPort();
			const child = startTunnel(device.sshAlias, localPort, endpoint.port, {
				onError: (error) => this.deviceStates.set(deviceId, { status: "error", error: String(error.message || error) }),
				onExit: ({ code, signal }) => {
					const current = this.tunnels.get(deviceId);
					if (current?.child === child && !this.disposed) {
						this.tunnels.delete(deviceId);
						this.deviceStates.set(deviceId, {
							status: "offline",
							error: code === 0 ? "" : `SSH 隧道已断开 (${signal || code || "unknown"})`
						});
					}
				}
			});
			tunnel = { child, localPort, token: endpoint.token };
			this.tunnels.set(deviceId, tunnel);
			await this.waitForTunnel(tunnel, 12000);
			this.deviceStates.set(deviceId, { status: "online", error: "" });
			return publicDevice(device, this.deviceStates.get(deviceId));
		} catch (error) {
			if (tunnel) await this.stopTunnel(deviceId);
			const message = error instanceof Error ? error.message : String(error);
			this.deviceStates.set(deviceId, { status: "error", error: message });
			throw new Error(`连接 ${device.label || device.sshAlias} 失败：${message}`);
		}
	}

	async checkTunnel(tunnel, timeoutMs = 1500) {
		const response = await fetch(`http://127.0.0.1:${tunnel.localPort}/v1/health`, {
			headers: { authorization: `Bearer ${tunnel.token}` },
			signal: AbortSignal.timeout(timeoutMs)
		});
		if (!response.ok) throw new Error(`远端 Remote Hub 返回 HTTP ${response.status}`);
		const value = await response.json();
		if (value?.result?.ok !== true) throw new Error("远端 Remote Hub 健康检查失败");
	}

	async waitForTunnel(tunnel, timeoutMs = 12000) {
		const deadline = Date.now() + timeoutMs;
		let lastError;
		while (Date.now() < deadline) {
			if (tunnel.child.exitCode !== null || tunnel.child.signalCode !== null) throw new Error("SSH 隧道进程提前退出");
			try {
				await this.checkTunnel(tunnel, 900);
				return;
			} catch (error) {
				lastError = error;
				await new Promise((resolve) => setTimeout(resolve, 180));
			}
		}
		throw lastError || new Error("等待 SSH 隧道超时");
	}

	async disconnect(deviceId) {
		await this.stopTunnel(deviceId);
		this.deviceStates.set(deviceId, { status: "offline", error: "" });
		return { disconnected: true };
	}

	async stopTunnel(deviceId) {
		const tunnel = this.tunnels.get(deviceId);
		if (!tunnel) return;
		this.tunnels.delete(deviceId);
		if (tunnel.child.exitCode === null && tunnel.child.signalCode === null) {
			tunnel.child.kill("SIGTERM");
			await new Promise((resolve) => {
				const timeout = setTimeout(() => {
					tunnel.child.kill("SIGKILL");
					resolve();
				}, 1500);
				tunnel.child.once("exit", () => {
					clearTimeout(timeout);
					resolve();
				});
			});
		}
	}

	async ensureConnected(deviceId) {
		if (!this.tunnels.has(deviceId)) await this.connect(deviceId);
		const tunnel = this.tunnels.get(deviceId);
		if (!tunnel) throw new Error("SSH 隧道未建立");
		return tunnel;
	}

	async requestDevice(deviceId, pathname, body, signal) {
		abortIfNeeded(signal);
		const tunnel = await this.ensureConnected(deviceId);
		const response = await fetch(`http://127.0.0.1:${tunnel.localPort}${pathname}`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${tunnel.token}`
			},
			body: JSON.stringify(body || {}),
			signal
		});
		const envelope = await response.json().catch(() => ({}));
		if (!response.ok) throw new Error(envelope?.error?.message || `远端请求失败：HTTP ${response.status}`);
		return envelope.result;
	}

	async listRemoteWorkspaces(deviceId) {
		const workspaces = await this.requestDevice(deviceId, "/v1/workspaces/list", {});
		return (Array.isArray(workspaces) ? workspaces : []).map((workspace) => mapRemoteWorkspace(deviceId, workspace)).filter(Boolean);
	}

	async listRemoteSessions(deviceId) {
		const [result, workspaces] = await Promise.all([
			this.requestDevice(deviceId, "/v1/sessions/list", {}),
			this.listRemoteWorkspaces(deviceId)
		]);
		const workspaceByPath = new Map(workspaces.filter((workspace) => workspace.path).map((workspace) => [workspace.path, workspace.workspaceId]));
		return {
			items: (Array.isArray(result?.items) ? result.items : []).map((summary) => mapRemoteSummary(deviceId, summary, workspaceByPath)).filter(Boolean)
		};
	}

	async listConnectedSessions(signal) {
		await this.loadPromise;
		const results = await Promise.all(this.devices.map(async (device) => {
			abortIfNeeded(signal);
			if (!this.tunnels.has(device.id)) return [];
			try {
				const result = await this.requestDevice(device.id, "/v1/sessions/list", {}, signal);
				const workspaces = await this.requestDevice(device.id, "/v1/workspaces/list", {}, signal);
				const mappedWorkspaces = (Array.isArray(workspaces) ? workspaces : []).map((workspace) => mapRemoteWorkspace(device.id, workspace)).filter(Boolean);
				const workspaceByPath = new Map(mappedWorkspaces.filter((workspace) => workspace.path).map((workspace) => [workspace.path, workspace.workspaceId]));
				this.deviceStates.set(device.id, { status: "online", error: "" });
				return (Array.isArray(result?.items) ? result.items : []).map((summary) => mapRemoteSummary(device.id, summary, workspaceByPath)).filter(Boolean);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				this.deviceStates.set(device.id, { status: "offline", error: message });
				return [];
			}
		}));
		const unique = new Map();
		for (const summary of results.flat()) unique.set(summary.sessionId, summary);
		return [...unique.values()];
	}

	async modelCatalog(deviceId) {
		return this.requestDevice(deviceId, "/v1/session/modelCatalog", { request: {} });
	}

	async createRemoteSession(request) {
		const workspace = parseRemoteWorkspaceId(request?.workspaceId);
		const deviceId = request?.deviceId || workspace?.deviceId;
		if (!deviceId) throw new Error("请选择远程设备");
		const remoteRequest = { ...(request?.request || {}) };
		if (workspace) remoteRequest.workspaceId = workspace.workspaceId;
		const result = await this.requestDevice(deviceId, "/v1/session/create", { request: remoteRequest });
		const rawId = result?.sessionId;
		if (typeof rawId !== "string" || !rawId) throw new Error("远端未返回新会话 ID");
		return { ...result, sessionId: remoteSessionId(deviceId, rawId) };
	}

	async routeSessionMethod(method, request, signal) {
		if (!SESSION_METHODS.has(method)) throw new Error(`不支持路由的会话操作：${method}`);
		const target = unmapSessionRequest(request);
		if (!target) return null;
		const result = await this.requestDevice(target.deviceId, `/v1/session/${method}`, { request: target.request }, signal);
		// rc.2 returned a sequenced snapshot without the newer discriminant.
		if (method === "projections" && result?.kind === undefined && Number.isSafeInteger(result?.asOfSeq) && result?.values && typeof result.values === "object") {
			return { ...result, kind: "sequenced" };
		}
		if (method === "fork" && typeof result?.sessionId === "string") {
			return { ...result, sessionId: remoteSessionId(target.deviceId, result.sessionId) };
		}
		return result;
	}

	async *followRemote(request, signal) {
		const target = unmapSessionRequest(request);
		if (!target) throw new Error("远程会话 ID 无效");
		const tunnel = await this.ensureConnected(target.deviceId);
		const response = await fetch(`http://127.0.0.1:${tunnel.localPort}/v1/session/follow`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${tunnel.token}`
			},
			body: JSON.stringify({ request: target.request }),
			signal
		});
		if (!response.ok || !response.body) {
			const error = await response.json().catch(() => ({}));
			throw new Error(error?.error?.message || `远端时间线请求失败：HTTP ${response.status}`);
		}
		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let pending = "";
		try {
			while (true) {
				abortIfNeeded(signal);
				const { done, value } = await reader.read();
				pending += decoder.decode(value || new Uint8Array(), { stream: !done });
				let newline;
				while ((newline = pending.indexOf("\n")) !== -1) {
					const line = pending.slice(0, newline).trim();
					pending = pending.slice(newline + 1);
					if (line) yield JSON.parse(line);
				}
				if (done) break;
			}
			if (pending.trim()) yield JSON.parse(pending);
		} finally {
			await reader.cancel().catch(() => {});
		}
	}

	async dispose() {
		this.disposed = true;
		await Promise.all([...this.tunnels.keys()].map((deviceId) => this.stopTunnel(deviceId)));
		if (this.stopAgent) {
			const stop = this.stopAgent;
			this.stopAgent = null;
			await stop();
		}
	}

}

export function installSessionFederation(ctx, runtime) {
	const controller = ctx.get("sessionController");
	const restore = [];
	const originalList = controller.list.bind(controller);
	const wrappedList = async function (request, signal) {
		const local = await originalList(request, signal);
		const remote = await runtime.listConnectedSessions(signal);
		const items = new Map((local?.items || []).map((summary) => [summary.sessionId, summary]));
		for (const summary of remote) items.set(summary.sessionId, summary);
		return { ...local, items: [...items.values()].sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0)) };
	};
	Object.defineProperty(controller, "list", { configurable: true, writable: true, value: wrappedList });
	restore.push(() => {
		if (controller.list === wrappedList) delete controller.list;
	});

	for (const method of SESSION_METHODS) {
		if (method === "create") continue;
		const original = controller[method];
		if (typeof original !== "function") continue;
		const boundOriginal = original.bind(controller);
		let wrapped;
		if (method === "follow") {
			wrapped = function (request, signal) {
				const target = unmapSessionRequest(request);
				return target ? runtime.followRemote(request, signal) : boundOriginal(request, signal);
			};
		} else {
			wrapped = async function (request, signal) {
				const target = unmapSessionRequest(request);
				if (target) return runtime.routeSessionMethod(method, request, signal);
				if (method === "create") return boundOriginal(request, signal);
				return boundOriginal(request, signal);
			};
		}
		Object.defineProperty(controller, method, { configurable: true, writable: true, value: wrapped });
		restore.push(() => {
			if (controller[method] === wrapped) delete controller[method];
		});
	}

	const originalCreate = controller.create;
	const boundCreate = originalCreate.bind(controller);
	const wrappedCreate = async function (request, signal) {
		const workspace = parseRemoteWorkspaceId(request?.workspaceId);
		const session = parseRemoteSessionId(request?.sessionId);
		const target = session || workspace;
		if (!target) return boundCreate(request, signal);
		const remoteRequest = { ...request };
		if (workspace) remoteRequest.workspaceId = workspace.workspaceId;
		if (session) remoteRequest.sessionId = session.sessionId;
		const result = await runtime.requestDevice(target.deviceId, "/v1/session/create", { request: remoteRequest }, signal);
		return typeof result?.sessionId === "string" ? { ...result, sessionId: remoteSessionId(target.deviceId, result.sessionId) } : result;
	};
	Object.defineProperty(controller, "create", { configurable: true, writable: true, value: wrappedCreate });
	restore.push(() => {
		if (controller.create === wrappedCreate) delete controller.create;
	});

	return () => {
		for (const undo of restore.reverse()) undo();
	};
}

export async function startRuntimeAgent(runtime) {
	const stop = await startAgentServer({ ctx: runtime.ctx, config: runtime.config.agent || {} });
	runtime.stopAgent = stop;
	return stop;
}
