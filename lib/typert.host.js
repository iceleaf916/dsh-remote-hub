const pass = (typeSymbol) => ({
	mode: "strict",
	typeSymbol,
	create: () => ({ parse: (value) => value })
});

const serviceMethods = [
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
];

const argumentsByMethod = {
	addDevice: ["request"],
	connect: ["deviceId"],
	createRemoteSession: ["request"],
	deviceStatus: ["deviceId"],
	disconnect: ["deviceId"],
	listDevices: [],
	modelCatalog: ["deviceId"],
	listRemoteSessions: ["deviceId"],
	listRemoteWorkspaces: ["deviceId"],
	removeDevice: ["deviceId"]
};

export const TYPERT = {
	package: "@iceleaf916/dsh-remote-hub",
	face: "host",
	schemas: [],
	invocations: serviceMethods.map((method) => ({
		id: `@iceleaf916/dsh-remote-hub#remoteHub/${method}`,
		service: "remoteHub",
		namespace: "remoteHub",
		method,
		invocation: { kind: "direct" },
		parameters: argumentsByMethod[method].map((name) => ({
			name,
			wire: name,
			source: "json",
			codec: pass(`@iceleaf916/dsh-remote-hub#remoteHub/${method}:${name}`)
		})),
		result: pass(`@iceleaf916/dsh-remote-hub#remoteHub/${method}:result`)
	})),
	model: {
		services: [{ key: "remoteHub", exportName: "RemoteHub", members: [], types: [], tags: [] }],
		events: [],
		objects: []
	}
};
