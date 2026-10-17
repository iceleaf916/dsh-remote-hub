import assert from "node:assert/strict";
import test from "node:test";
import {
	mapRemoteSummary,
	mapRemoteWorkspace,
	parseRemoteSessionId,
	parseRemoteWorkspaceId,
	remoteSessionId,
	remoteWorkspaceId,
	unmapSessionRequest
} from "../lib/host/identity.js";

const DEVICE_ID = "0123456789abcdef";

test("remote session and workspace IDs round-trip without colliding with local IDs", () => {
	const originalSessionId = "task:with/slash and spaces/你好";
	const originalWorkspaceId = "workspace:project/子目录";
	const sessionId = remoteSessionId(DEVICE_ID, originalSessionId);
	const workspaceId = remoteWorkspaceId(DEVICE_ID, originalWorkspaceId);

	assert.deepEqual(parseRemoteSessionId(sessionId), { deviceId: DEVICE_ID, sessionId: originalSessionId });
	assert.deepEqual(parseRemoteWorkspaceId(workspaceId), { deviceId: DEVICE_ID, workspaceId: originalWorkspaceId });
	assert.equal(parseRemoteSessionId(originalSessionId), null);
	assert.equal(parseRemoteSessionId(`remote:${DEVICE_ID}:%E0%A4%A`), null);
});

test("remote summaries map both explicit workspace IDs and cwd-based membership", () => {
	const workspaceId = remoteWorkspaceId(DEVICE_ID, "remote-project");
	const workspaceByPath = new Map([["/work/project", workspaceId]]);
	const explicit = mapRemoteSummary(DEVICE_ID, {
		sessionId: "one",
		workspaceId: "remote-project",
		projections: { values: { title: "Projected title" } }
	});
	const byPath = mapRemoteSummary(DEVICE_ID, { sessionId: "two", cwd: "/work/project" }, workspaceByPath);
	const preservedTitle = mapRemoteSummary(DEVICE_ID, {
		sessionId: "three",
		title: "Explicit title",
		projections: { values: { title: "Projected title" } }
	});

	assert.equal(explicit.sessionId, remoteSessionId(DEVICE_ID, "one"));
	assert.equal(explicit.workspaceId, workspaceId);
	assert.equal(explicit.title, "Projected title");
	assert.equal(byPath.workspaceId, workspaceId);
	assert.equal(preservedTitle.title, "Explicit title");
	assert.equal(mapRemoteWorkspace(DEVICE_ID, { id: "remote-project", path: "/work/project" }).workspaceId, workspaceId);
});

test("session requests route child identities while preserving unrelated fields", () => {
	const sessionId = remoteSessionId(DEVICE_ID, "child-session");
	const request = {
		address: { sessionId: "parent-session", childSessionId: sessionId },
		cursor: 42
	};

	assert.deepEqual(unmapSessionRequest(request), {
		deviceId: DEVICE_ID,
		sessionId: "child-session",
		request: {
			address: { sessionId: "parent-session", childSessionId: "child-session" },
			cursor: 42
		}
	});
	assert.equal(unmapSessionRequest({ sessionId: "local-session" }), null);
});
