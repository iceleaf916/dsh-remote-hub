import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";

const source = await readFile(new URL("../lib/client.js", import.meta.url), "utf8");
let plugin;
runInNewContext(source, {window: {__ModuleLoader__: {load({factory}) {
	plugin = factory(() => ({Component: class {}}));
}}}});

class Catalog {
	constructor(ctx) { this.ctx = ctx; }
	load() { return this.ctx.remote.session.modelCatalog(); }
	resetGeneration() { this.reset = true; }
}
class Directory {
	constructor(sessions, sessionId, available, catalog, projected) {
		Object.assign(this, {sessions, sessionId, available, catalog, projected});
	}
	select(selection) { return this.sessions.selectModel({sessionId: this.sessionId, ...selection}); }
	dispose() { this.disposed = true; }
	resetConnected() { this.reset = true; }
}

test("native composer and /model directories use each session Host's catalog and refresh selection", async () => {
	const calls = [];
	const native = new Map();
	const localCatalog = new Catalog({remote: {session: {modelCatalog: async () => ({groups: ["local"]})}}});
	const models = {catalog: localCatalog, directoryFor(id) {
		if (!native.has(id)) native.set(id, new Directory({selectModel: async request => {
			calls.push({select: request}); return {ok: true, value: {selected: request}};
		}}, id, () => true, this.catalog, {}));
		return native.get(id);
	}};
	const original = models.directoryFor;
	const events = new Map();
	const services = {
		modelDirectories: models,
		sessions: {scope: () => ({effect() {}}), refreshProjections: async id => calls.push({refresh: id})},
		connection: {rpc: {call: async (_route, path, {args}) => {
			calls.push({path, deviceId: args.deviceId}); return {groups: [args.deviceId]};
		}}}
	};
	const ctx = {get: name => services[name], on: (name, fn) => {events.set(name, fn); return () => events.delete(name);}};
	const restore = plugin.installRemoteModelDirectories(ctx, Directory);
	const a = "remote:0123456789abcdef:one";
	const b = "remote:fedcba9876543210:two";
	const local = models.directoryFor("local");
	const remoteA = models.directoryFor(a);
	const remoteB = models.directoryFor(b);
	assert.deepEqual(await local.catalog.load(), {groups: ["local"]});
	assert.deepEqual(await remoteA.catalog.load(), {groups: ["0123456789abcdef"]});
	assert.deepEqual(await remoteB.catalog.load(), {groups: ["fedcba9876543210"]});
	assert.equal(models.directoryFor(a), remoteA);
	assert.notEqual(remoteA.catalog, remoteB.catalog);
	assert.equal(models.directoryFor("remote:0123456789abcdef:another").catalog, remoteA.catalog);
	await remoteA.select({provider: "remote-provider", model: "remote-model"});
	assert.deepEqual(calls.slice(-2), [{select: {sessionId: a, provider: "remote-provider", model: "remote-model"}}, {refresh: a}]);
	events.get("connection/reset")();
	assert.equal(remoteA.catalog.reset, true);
	assert.equal(remoteA.reset, true);
	assert.equal(local.catalog.reset, undefined);
	restore();
	assert.equal(models.directoryFor, original);
	assert.equal(remoteA.disposed, true);
	assert.equal(events.size, 0);
});
