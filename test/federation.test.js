import assert from "node:assert/strict";
import test from "node:test";
import { installSessionFederation } from "../lib/host/runtime.js";
import { remoteSessionId, unmapSessionRequest } from "../lib/host/identity.js";

const DEVICE_ID = "0123456789abcdef";

class FakeSessionController {
	async list() {
		return { items: [{ sessionId: "local-session", updatedAt: 1 }] };
	}

	page(request) {
		return { origin: "local", request };
	}

	async *follow(request) {
		yield { origin: "local", sessionId: request.sessionId };
	}

	create(request) {
		return { origin: "local", request };
	}
}

test("federation merges remote sessions and routes only remote identities", async () => {
	const controller = new FakeSessionController();
	const remoteId = remoteSessionId(DEVICE_ID, "remote-session");
	const calls = [];
	const runtime = {
		async listConnectedSessions() {
			return [{ sessionId: remoteId, updatedAt: 2 }];
		},
		async routeSessionMethod(method, request) {
			const target = unmapSessionRequest(request);
			calls.push({ method, request: target.request });
			return { origin: "remote", method, request: target.request };
		},
		async *followRemote(request) {
			yield { origin: "remote", request: unmapSessionRequest(request).request };
		}
	};
	const ctx = { get: (key) => key === "sessionController" ? controller : undefined };
	const restore = installSessionFederation(ctx, runtime);
	try {
		const list = await controller.list({});
		assert.deepEqual(list.items.map((item) => item.sessionId), [remoteId, "local-session"]);

		assert.deepEqual(await controller.page({ address: { kind: "session", sessionId: remoteId }, throughSeq: 7 }), {
			origin: "remote",
			method: "page",
			request: { address: { kind: "session", sessionId: "remote-session" }, throughSeq: 7 }
		});
		assert.deepEqual(await controller.page({ sessionId: "local-session" }), {
			origin: "local",
			request: { sessionId: "local-session" }
		});
		assert.deepEqual(calls, [{ method: "page", request: { address: { kind: "session", sessionId: "remote-session" }, throughSeq: 7 } }]);

		const followed = [];
		for await (const item of controller.follow({ address: { kind: "session", sessionId: remoteId } })) followed.push(item);
		assert.deepEqual(followed, [{ origin: "remote", request: { address: { kind: "session", sessionId: "remote-session" } } }]);
	} finally {
		restore();
	}
	assert.equal(Object.hasOwn(controller, "list"), false);
	assert.equal(Object.hasOwn(controller, "page"), false);
	assert.equal(Object.hasOwn(controller, "follow"), false);
	assert.deepEqual((await controller.list({})).items.map((item) => item.sessionId), ["local-session"]);
});

test("remote create requests route by workspace while local create stays local", async () => {
	const controller = new FakeSessionController();
	const runtime = {
		requestDevice: async (deviceId, endpoint, body) => ({ sessionId: "created-session", deviceId, endpoint, request: body.request }),
		listConnectedSessions: async () => []
	};
	const restore = installSessionFederation({ get: () => controller }, runtime);
	try {
		const local = await controller.create({ workspaceId: "local-workspace" });
		assert.deepEqual(local, { origin: "local", request: { workspaceId: "local-workspace" } });
	} finally {
		restore();
	}
});
