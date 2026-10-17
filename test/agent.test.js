import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { startAgentServer } from "../lib/host/agent.js";

test("agent bridge requires its token and serves sessions, workspaces and NDJSON follow", async () => {
	const directory = await mkdtemp(join(tmpdir(), "dsh-remote-hub-test-"));
	const endpointFile = join(directory, "agent.json");
	const controller = {
		list: async () => ({ items: [{ sessionId: "session-1", title: "Remote test" }] }),
		page: async (request) => ({ sessionId: request.sessionId, cursor: request.cursor }),
		follow: (request) => (async function* () {
			yield { seq: 1, sessionId: request.sessionId };
			yield { seq: 2, text: "continued" };
		})()
	};
	const ctx = {
		get: (key) => key === "sessionController" ? controller : key === "workspaceRegistry" ? {
			list: () => [{ id: "workspace-1", title: "Remote project", path: "/work/project", sessionIds: ["session-1"] }]
		} : undefined
	};
	let stop;
	try {
		stop = await startAgentServer({ ctx, config: { endpointFile } });
		const endpoint = JSON.parse(await readFile(endpointFile, "utf8"));
		const base = `http://127.0.0.1:${endpoint.port}`;

		const unauthorized = await fetch(`${base}/v1/health`);
		assert.equal(unauthorized.status, 401);

		const headers = { authorization: `Bearer ${endpoint.token}`, "content-type": "application/json" };
		const health = await fetch(`${base}/v1/health`, { headers });
		assert.deepEqual(await health.json(), { result: { ok: true } });

		const workspaces = await fetch(`${base}/v1/workspaces/list`, { method: "POST", headers, body: "{}" });
		assert.deepEqual((await workspaces.json()).result, [{
			id: "workspace-1",
			workspaceId: "workspace-1",
			title: "Remote project",
			path: "/work/project",
			sessionIds: ["session-1"]
		}]);

		const sessions = await fetch(`${base}/v1/sessions/list`, { method: "POST", headers, body: "{}" });
		assert.deepEqual((await sessions.json()).result.items[0].sessionId, "session-1");

		const page = await fetch(`${base}/v1/session/page`, { method: "POST", headers, body: JSON.stringify({ request: { sessionId: "session-1", cursor: 5 } }) });
		assert.deepEqual((await page.json()).result, { sessionId: "session-1", cursor: 5 });

		const follow = await fetch(`${base}/v1/session/follow`, { method: "POST", headers, body: JSON.stringify({ request: { sessionId: "session-1" } }) });
		assert.equal(follow.headers.get("content-type"), "application/x-ndjson; charset=utf-8");
		assert.deepEqual((await follow.text()).trim().split("\n").map((line) => JSON.parse(line)), [
			{ seq: 1, sessionId: "session-1" },
			{ seq: 2, text: "continued" }
		]);
	} finally {
		await stop?.();
		await rm(directory, { recursive: true, force: true });
	}
});

test("agent bridge flushes follow headers before the first history frame", async () => {
	const directory = await mkdtemp(join(tmpdir(), "dsh-remote-hub-follow-test-"));
	const endpointFile = join(directory, "agent.json");
	let releaseFrame;
	const frameReady = new Promise((resolve) => { releaseFrame = resolve; });
	const controller = {
		follow: () => (async function* () {
			await frameReady;
			yield { type: "snapshot", cursor: 0 };
		})()
	};
	const ctx = {
		get: (key) => key === "sessionController" ? controller : key === "workspaceRegistry" ? { list: () => [] } : undefined
	};
	let stop;
	try {
		stop = await startAgentServer({ ctx, config: { endpointFile } });
		const endpoint = JSON.parse(await readFile(endpointFile, "utf8"));
		const headers = { authorization: `Bearer ${endpoint.token}`, "content-type": "application/json" };
		const responsePromise = fetch(`http://127.0.0.1:${endpoint.port}/v1/session/follow`, {
			method: "POST",
			headers,
			body: JSON.stringify({ request: { address: { kind: "session", sessionId: "session-1" } } })
		});
		const response = await Promise.race([
			responsePromise,
			new Promise((_, reject) => setTimeout(() => reject(new Error("follow headers were not flushed")), 500))
		]);
		assert.equal(response.status, 200);
		assert.equal(response.headers.get("content-type"), "application/x-ndjson; charset=utf-8");
		releaseFrame();
		assert.deepEqual((await response.text()).trim().split("\n").map((line) => JSON.parse(line)), [{ type: "snapshot", cursor: 0 }]);
	} finally {
		releaseFrame?.();
		await stop?.();
		await rm(directory, { recursive: true, force: true });
	}
});
