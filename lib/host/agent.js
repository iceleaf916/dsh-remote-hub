import { randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createServer } from "node:http";

const AGENT_METHODS = new Set([
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
const MAX_BODY_BYTES = 4 * 1024 * 1024;

function endpointPath(config) {
	return config.endpointFile || join(process.env.DSH_HOME || join(homedir(), ".dsh"), "remote-hub", "agent.json");
}

function sendJson(response, statusCode, value) {
	if (response.destroyed) return;
	const body = Buffer.from(JSON.stringify(value));
	response.writeHead(statusCode, {
		"content-type": "application/json; charset=utf-8",
		"content-length": body.length,
		"cache-control": "no-store"
	});
	response.end(body);
}

async function readJson(request) {
	const chunks = [];
	let size = 0;
	for await (const chunk of request) {
		size += chunk.length;
		if (size > MAX_BODY_BYTES) throw new Error("request body is too large");
		chunks.push(chunk);
	}
	if (size === 0) return {};
	return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function authorized(request, token) {
	const header = request.headers.authorization || "";
	const supplied = header.startsWith("Bearer ") ? header.slice(7) : "";
	const expectedBytes = Buffer.from(token);
	const suppliedBytes = Buffer.from(supplied);
	return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

function errorMessage(error) {
	return error instanceof Error ? error.message.slice(0, 1000) : String(error).slice(0, 1000);
}

async function streamNdjson(response, iterable, signal) {
	response.statusCode = 200;
	response.setHeader("content-type", "application/x-ndjson; charset=utf-8");
	response.setHeader("cache-control", "no-store");
	response.setHeader("x-content-type-options", "nosniff");
	response.flushHeaders?.();
	for await (const item of iterable) {
		signal.throwIfAborted();
		if (!response.write(`${JSON.stringify(item)}\n`)) {
			await new Promise((resolve) => response.once("drain", resolve));
		}
	}
	response.end();
}

/** Start a loopback-only bridge owned by the already-running DSH Host. */
export async function startAgentServer({ ctx, config = {} }) {
	const controller = ctx.get("sessionController");
	const workspaceRegistry = ctx.get("workspaceRegistry");
	const token = randomBytes(32).toString("hex");
	const path = endpointPath(config);
	const server = createServer(async (request, response) => {
		const abortController = new AbortController();
		request.on("aborted", () => abortController.abort());
		response.on("close", () => {
			if (!response.writableEnded) abortController.abort();
		});
		try {
			const url = new URL(request.url || "/", "http://127.0.0.1");
			if (!authorized(request, token)) {
				sendJson(response, 401, { error: { message: "unauthorized" } });
				return;
			}
			if (request.method === "GET" && url.pathname === "/v1/health") {
				sendJson(response, 200, { result: { ok: true } });
				return;
			}
			if (request.method !== "POST") {
				sendJson(response, 405, { error: { message: "method not allowed" } });
				return;
			}
			const body = await readJson(request);
			if (url.pathname === "/v1/workspaces/list") {
				const workspaces = workspaceRegistry.list().map((workspace) => ({
					id: String(workspace.id),
					workspaceId: String(workspace.id),
					title: String(workspace.title || workspace.name || workspace.path || workspace.id),
					path: String(workspace.path || ""),
					sessionIds: Array.isArray(workspace.sessionIds) ? workspace.sessionIds.map(String) : []
				}));
				sendJson(response, 200, { result: workspaces });
				return;
			}
			if (url.pathname === "/v1/sessions/list") {
				const result = await controller.list({}, abortController.signal);
				sendJson(response, 200, { result });
				return;
			}
			const match = /^\/v1\/session\/([a-zA-Z]+)$/.exec(url.pathname);
			if (!match || !AGENT_METHODS.has(match[1])) {
				sendJson(response, 404, { error: { message: "unknown endpoint" } });
				return;
			}
			const method = match[1];
			const input = body.request && typeof body.request === "object" ? body.request : {};
			if (method === "create") {
				const result = await controller.create(input);
				sendJson(response, 200, { result });
				return;
			}
			if (method === "follow") {
				const stream = controller.follow(input, abortController.signal);
				await streamNdjson(response, stream, abortController.signal);
				return;
			}
			const result = await controller[method](input, abortController.signal);
			sendJson(response, 200, { result });
		} catch (error) {
			if (response.headersSent) {
				if (!response.destroyed) response.end();
				return;
			}
			sendJson(response, 500, { error: { message: errorMessage(error) } });
		}
	});

	await new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", resolve);
	});
	const address = server.address();
	if (!address || typeof address === "string") throw new Error("failed to allocate the Remote Hub endpoint");
	const endpoint = { version: 1, port: address.port, token };
	await mkdir(dirname(path), { recursive: true, mode: 0o700 });
	const temporaryPath = `${path}.${process.pid}.tmp`;
	await writeFile(temporaryPath, `${JSON.stringify(endpoint)}\n`, { mode: 0o600 });
	await rename(temporaryPath, path);

	let closed = false;
	return async () => {
		if (closed) return;
		closed = true;
		const stopped = new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
		server.closeAllConnections?.();
		await stopped;
		try {
			const current = JSON.parse(await readFile(path, "utf8"));
			if (current.token === token) await rm(path, { force: true });
		} catch {
			// A missing or replaced endpoint belongs to a later plugin generation.
		}
	};
}
