/* Generated from the host RemoteHub service contract. */
const pass = (typeSymbol) => ({
	mode: "strict",
	typeSymbol,
	create: () => ({ parse: (value) => value })
});

const methods = {
	addDevice: ["request"],
	connect: ["deviceId"],
	createRemoteSession: ["request"],
	deviceStatus: ["deviceId"],
	disconnect: ["deviceId"],
	listDevices: [],
	listRemoteSessions: ["deviceId"],
	listRemoteWorkspaces: ["deviceId"],
	removeDevice: ["deviceId"]
};

export const TYPERT_REMOTE = {
	package: "@yks/dsh-remote-hub",
	descriptors: Object.entries(methods).map(([method, parameters]) => ({
		id: `@yks/dsh-remote-hub#remoteHub/${method}`,
		service: "remoteHub",
		namespace: "remoteHub",
		method,
		invocation: { kind: "direct" },
		parameters: parameters.map((name) => ({
			name,
			wire: name,
			source: "json",
			codec: pass(`@yks/dsh-remote-hub#remoteHub/${method}:${name}`)
		})),
		result: pass(`@yks/dsh-remote-hub#remoteHub/${method}:result`)
	}))
};

export default TYPERT_REMOTE;
