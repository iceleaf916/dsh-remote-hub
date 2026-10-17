import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";

const clientSource = await readFile(new URL("../lib/client.js", import.meta.url), "utf8");

function createHarness(initialDevices = [], localState = {}) {
	let plugin;
	let sidebar;
	let sidebarInject;
	const navigation = [];
	let hookState = [];
	let hookCursor = 0;
	let mounted = false;
	let devices = [...initialDevices];
	const calls = [];
	const React = {
		Component: class Component {},
		createElement(type, props, ...children) {
			const resolvedProps = { ...(props || {}) };
			if (children.length === 1) resolvedProps.children = children[0];
			else if (children.length > 1) resolvedProps.children = children;
			return { type, props: resolvedProps };
		},
		useEffect(callback, dependencies) {
			if (dependencies.length === 0 && !mounted) { mounted = true; callback(); }
		},
		useState(initialValue) {
			const index = hookCursor++;
			if (!(index in hookState)) hookState[index] = initialValue;
			return [hookState[index], (nextValue) => {
				hookState[index] = typeof nextValue === "function" ? nextValue(hookState[index]) : nextValue;
			}];
		}
	};
	const window = {
		prompt() { throw new Error("prompt() is not supported."); },
		confirm() { throw new Error("confirm() is not supported."); },
		__ModuleLoader__: {
			load({ factory }) {
				plugin = factory((name) => {
					if (name === "react") return React;
					throw new Error(`unexpected import: ${name}`);
				});
			}
		}
	};
	runInNewContext(clientSource, { window });

	const connection = {
		rpc: {
			async call(_route, path, { args } = {}) {
				const method = path.split("/").at(-1);
				calls.push({ method, args });
				if (method === "createRemoteSession") return {ok: true, value: {sessionId: "remote:0123456789abcdef:created-session"}};
				if (method === "listDevices") return { ok: true, value: devices };
				if (method === "addDevice") {
					const device = { id: "office-device", label: args.request.sshAlias, sshAlias: args.request.sshAlias };
					devices = [...devices.filter((item) => item.id !== device.id), device];
					return { ok: true, value: device };
				}
				if (method === "removeDevice") {
					devices = devices.filter((item) => item.id !== args.deviceId);
					return { ok: true, value: { removed: true } };
				}
				return { ok: true, value: [] };
			}
		}
	};
	const context = {
		effect(callback, key) {
			if (key === "dshRemoteHub.sidebar.workspaces") callback();
			return () => {};
		},
		slots: {
			inject(_slot, callback) { callback(); },
			entries() { return [{ registrant: "@deepseek-ai/dsh-client-ui-workspace", inject: () => ({
				open: (id) => navigation.push({ action: "open", id }),
				startSession: () => navigation.push({ action: "start" })
			}) }]; },
			register(config, component) { sidebar = component; sidebarInject = config.inject; return () => {}; }
		},
		get(name) {
			if (name === "connection") return connection;
			if (name === "layout") return { selectPanel(id) { if (id !== null) throw new Error(`main panel "${id}" is not registered`); } };
			if (name === "sessions") return { refresh: async () => {}, create: async () => {} };
			return undefined;
		}
	};
	plugin.apply(context, {});
	const wrapper = sidebar({ connection, layout: context.get("layout"), sessions: context.get("sessions") });
	const body = wrapper.props.children;
	const props = {
		...sidebarInject(),
		connection,
		layout: context.get("layout"),
		sessions: context.get("sessions"),
		useWorkspaces: () => localState.workspaces || { items: [] },
		useSessions: () => localState.sessions || { ids: [], byId: {} },
		useSessionStatus: () => new Map()
	};

	function renderRaw() {
		hookCursor = 0;
		return body.type(props);
	}

	return { calls, navigation, renderRaw, connection };
}

function materialize(node) {
	if (Array.isArray(node)) return node.map(materialize);
	if (!node || typeof node !== "object") return node;
	if (typeof node.type === "function") return materialize(node.type(node.props || {}));
	return { ...node, props: { ...node.props, children: materialize(node.props?.children) } };
}

function findNode(node, predicate) {
	if (Array.isArray(node)) {
		for (const item of node) {
			const match = findNode(item, predicate);
			if (match) return match;
		}
		return undefined;
	}
	if (!node || typeof node !== "object") return undefined;
	if (predicate(node)) return node;
	return findNode(node.props?.children, predicate);
}

function textContent(node) {
	if (Array.isArray(node)) return node.map(textContent).join("");
	if (node === null || node === undefined || typeof node === "boolean") return "";
	if (typeof node !== "object") return String(node);
	return textContent(node.props?.children);
}

test("federated remote sessions do not appear in local workspace groups", () => {
	const remoteId = "remote:0123456789abcdef:session-remote";
	const harness = createHarness([], {
		workspaces: {
			items: [{ id: "local-workspace", title: "本机项目", path: "/work/local", sessionIds: ["local-session", remoteId] }]
		},
		sessions: {
			ids: ["local-session", remoteId],
			byId: {
				"local-session": { title: "本机会话" },
				[remoteId]: { title: "远端重复会话" }
			}
		}
	});
	const tree = materialize(harness.renderRaw());

	assert.match(textContent(tree), /本机会话/);
	assert.doesNotMatch(textContent(tree), /远端重复会话/);
});

test("adding an SSH device uses an in-app dialog and registers the alias", async () => {
	const harness = createHarness();
	let tree = materialize(harness.renderRaw());
	findNode(tree, (node) => node.type === "button" && node.props.className === "rh-device").props.onClick();
	tree = materialize(harness.renderRaw());
	const addButton = findNode(tree, (node) => node.type === "button" && textContent(node).includes("添加 SSH 设备"));
	await addButton.props.onClick();

	tree = materialize(harness.renderRaw());
	const dialog = findNode(tree, (node) => node.props.role === "dialog" && node.props["aria-modal"] === "true");
	assert.ok(dialog, "adding a device should open the plugin's own dialog");
	const input = findNode(dialog, (node) => node.type === "input");
	input.props.onChange({ target: { value: "office-pc" } });
	tree = materialize(harness.renderRaw());
	const form = findNode(tree, (node) => node.type === "form");
	await form.props.onSubmit({ preventDefault() {} });

	assert.equal(JSON.stringify(harness.calls.find((call) => call.method === "addDevice")), JSON.stringify({
		method: "addDevice",
		args: { request: { sshAlias: "office-pc" } }
	}));
	tree = materialize(harness.renderRaw());
	assert.match(textContent(tree), /office-pc/);
	const firstDeviceGroup = findNode(tree, (node) => node.type === "button" && node.props.className === "rh-section-head");
	assert.match(textContent(firstDeviceGroup), /office-pc/, "the selected remote device should be visible before local sessions push it below the fold");
});

test("removing an SSH device uses an in-app confirmation dialog", async () => {
	const harness = createHarness();
	let tree = materialize(harness.renderRaw());
	findNode(tree, (node) => node.type === "button" && node.props.className === "rh-device").props.onClick();
	const popover = findNode(harness.renderRaw(), (node) => node.type?.name === "DevicePopover");
	await popover.props.onRemove({ id: "office-device", label: "office-pc", name: "office-pc" });

	tree = materialize(harness.renderRaw());
	const dialog = findNode(tree, (node) => node.props.role === "dialog" && node.props["aria-modal"] === "true");
	assert.ok(dialog, "removing a device should ask for confirmation inside the plugin");
	assert.match(textContent(dialog), /office-pc/);
	const removeButton = findNode(dialog, (node) => node.type === "button" && textContent(node).includes("移除设备"));
	await removeButton.props.onClick();
	assert.ok(harness.calls.some((call) => call.method === "removeDevice" && call.args.deviceId === "office-device"));
});

for (const id of ["local-session", "remote:0123456789abcdef:remote-session"]) {
	test(`opening ${id} uses the native workspace navigation`, async () => {
		const harness = createHarness([], {sessions: {ids: ["local-session"], byId: {"local-session": {title: "本机会话"}}}});
		const group = findNode(harness.renderRaw(), node => node.type?.name === "DeviceGroup");
		const device = {...group.props.device, projects: [{id: "test-project", title: "测试项目", sessions: [{sessionId: id, title: "测试会话"}]}]};
		const tree = materialize({...group, props: {...group.props, device}});
		await findNode(tree, node => node.type === "button" && node.props.className === "rh-session").props.onClick();
		assert.deepEqual(harness.navigation, [{action: "open", id}]);
		assert.doesNotMatch(textContent(materialize(harness.renderRaw())), /not registered/);
	});
}

test("starting a local session uses native creation and navigation", async () => {
	const harness = createHarness();
	const tree = materialize(harness.renderRaw());
	await findNode(tree, node => node.type === "button" && node.props.className === "rh-footrow" && textContent(node).includes("新建会话")).props.onClick();
	assert.deepEqual(harness.navigation, [{action: "start"}]);
});

test("a newly created remote session opens through the same native navigation", async () => {
	const harness = createHarness([{id: "0123456789abcdef", label: "office-pc"}]);
	harness.renderRaw();
	await new Promise(resolve => setImmediate(resolve));
	let tree = materialize(harness.renderRaw());
	findNode(tree, node => node.type === "button" && node.props.className === "rh-device").props.onClick();
	findNode(harness.renderRaw(), node => node.type?.name === "DevicePopover").props.onPick("0123456789abcdef");
	tree = materialize(harness.renderRaw());
	await findNode(tree, node => node.type === "button" && node.props.className === "rh-footrow" && textContent(node).includes("新建会话")).props.onClick();
	assert.deepEqual(harness.navigation, [{action: "open", id: "remote:0123456789abcdef:created-session"}]);
	assert.equal(harness.calls.find(call => call.method === "createRemoteSession").args.request.deviceId, "0123456789abcdef");
});
