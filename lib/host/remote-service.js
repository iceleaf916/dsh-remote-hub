import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";

const REMOTE_METHODS = [
	"addDevice",
	"connect",
	"createRemoteSession",
	"deviceStatus",
	"disconnect",
	"listDevices",
	"listRemoteSessions",
	"listRemoteWorkspaces",
	"removeDevice"
];

/** Host service exposed through DSH's Typert API Gateway. */
export class RemoteHubService extends TypertRemoteService {
	constructor(ctx, { runtime }) {
		super(ctx, "remoteHub");
		this.runtime = runtime;
	}

	addDevice(request) {
		return this.runtime.addDevice(request);
	}

	connect(deviceId) {
		return this.runtime.connect(deviceId);
	}

	createRemoteSession(request) {
		return this.runtime.createRemoteSession(request);
	}

	deviceStatus(deviceId) {
		return this.runtime.deviceStatus(deviceId);
	}

	disconnect(deviceId) {
		return this.runtime.disconnect(deviceId);
	}

	listDevices() {
		return this.runtime.listDevices();
	}

	listRemoteSessions(deviceId) {
		return this.runtime.listRemoteSessions(deviceId);
	}

	listRemoteWorkspaces(deviceId) {
		return this.runtime.listRemoteWorkspaces(deviceId);
	}

	removeDevice(deviceId) {
		return this.runtime.removeDevice(deviceId);
	}
}

for (const method of REMOTE_METHODS) {
	const initializers = [];
	Remote(RemoteHubService.prototype[method], {
		kind: "method",
		name: method,
		static: false,
		private: false,
		addInitializer(initializer) {
			initializers.push(initializer);
		}
	});
	const instance = Object.create(RemoteHubService.prototype);
	for (const initialize of initializers) initialize.call(instance);
}
