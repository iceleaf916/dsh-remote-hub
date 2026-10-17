import assert from "node:assert/strict";
import test from "node:test";
import { TYPERT } from "../lib/typert.host.js";
import { TYPERT_REMOTE } from "../lib/typert.remote-client.js";

test("Typert endpoints match the provided Remote Hub service methods", () => {
	assert.equal(TYPERT.package, "@iceleaf916/dsh-remote-hub");
	assert.equal(TYPERT.face, "host");
	assert.deepEqual(TYPERT.invocations.map((item) => item.method).sort(), [
		"addDevice",
		"connect",
		"createRemoteSession",
		"deviceStatus",
		"disconnect",
		"listDevices",
		"modelCatalog",
		"listRemoteSessions",
		"listRemoteWorkspaces",
		"removeDevice"
	].sort());
	assert.ok(TYPERT.invocations.every((item) => item.service === "remoteHub" && item.namespace === "remoteHub"));
});

test("client Remote contract exposes the same callable methods as the Host service", () => {
	assert.equal(TYPERT_REMOTE.package, "@iceleaf916/dsh-remote-hub");
	assert.deepEqual(TYPERT_REMOTE.descriptors.map((item) => item.method).sort(), TYPERT.invocations.map((item) => item.method).sort());
	assert.ok(TYPERT_REMOTE.descriptors.every((item) => item.service === "remoteHub" && item.namespace === "remoteHub"));
});
