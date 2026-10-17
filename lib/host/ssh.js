import { execFile, spawn } from "node:child_process";
import { createServer } from "node:net";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const SSH_ALIAS_PATTERN = /^[A-Za-z0-9._@-]{1,255}$/;

export function validateSshAlias(value) {
	if (typeof value !== "string" || !SSH_ALIAS_PATTERN.test(value) || value.startsWith("-")) {
		throw new TypeError("SSH 主机别名只能包含字母、数字、点、下划线、@ 和连字符");
	}
	return value;
}

export function parseSshConfig(output) {
	const values = new Map();
	for (const line of String(output).split(/\r?\n/)) {
		const match = /^([a-zA-Z][\w]*)\s+(.+)$/.exec(line.trim());
		if (match && !values.has(match[1].toLowerCase())) values.set(match[1].toLowerCase(), match[2].trim());
	}
	return {
		hostName: values.get("hostname"),
		user: values.get("user"),
		port: Number(values.get("port")) || 22
	};
}

export async function resolveSshAlias(alias) {
	validateSshAlias(alias);
	const { stdout } = await execFileAsync("ssh", ["-G", "-o", "BatchMode=yes", alias], {
		encoding: "utf8",
		timeout: 10000,
		maxBuffer: 1024 * 1024
	});
	const resolved = parseSshConfig(stdout);
	if (!resolved.hostName) throw new Error(`ssh -G 未解析出主机名：${alias}`);
	return resolved;
}

export async function probeSsh(alias) {
	validateSshAlias(alias);
	await resolveSshAlias(alias);
	await execFileAsync("ssh", ["-T", "-o", "BatchMode=yes", "-o", "ConnectTimeout=8", alias, "true"], {
		encoding: "utf8",
		timeout: 10000,
		maxBuffer: 1024 * 1024
	});
}

export async function readAgentEndpoint(alias, remotePath = "~/.dsh/remote-hub/agent.json") {
	validateSshAlias(alias);
	if (remotePath !== "~/.dsh/remote-hub/agent.json") throw new TypeError("unsupported remote endpoint path");
	const { stdout } = await execFileAsync("ssh", [
		"-T",
		"-o",
		"BatchMode=yes",
		"-o",
		"ConnectTimeout=8",
		alias,
		"cat",
		remotePath
	], { encoding: "utf8", timeout: 10000, maxBuffer: 4096 });
	const endpoint = JSON.parse(stdout.trim());
	if (endpoint.version !== 1 || !Number.isInteger(endpoint.port) || endpoint.port < 1 || endpoint.port > 65535) {
		throw new Error("远端 Remote Hub endpoint 文件格式不正确");
	}
	if (typeof endpoint.token !== "string" || !/^[a-f0-9]{64}$/.test(endpoint.token)) {
		throw new Error("远端 Remote Hub endpoint 缺少有效认证令牌");
	}
	return endpoint;
}

export async function chooseLocalPort() {
	const server = createServer();
	await new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", resolve);
	});
	const address = server.address();
	if (!address || typeof address === "string") throw new Error("无法分配本地 SSH 转发端口");
	const { port } = address;
	await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
	return port;
}

export function startTunnel(alias, localPort, remotePort, handlers = {}) {
	validateSshAlias(alias);
	const child = spawn("ssh", [
		"-T",
		"-N",
		"-o",
		"BatchMode=yes",
		"-o",
		"ExitOnForwardFailure=yes",
		"-o",
		"ServerAliveInterval=15",
		"-o",
		"ServerAliveCountMax=3",
		"-L",
		`127.0.0.1:${localPort}:127.0.0.1:${remotePort}`,
		alias
	], { stdio: "ignore", windowsHide: true });
	child.once("error", handlers.onError || (() => {}));
	child.once("exit", (code, signal) => handlers.onExit?.({ code, signal }));
	return child;
}
