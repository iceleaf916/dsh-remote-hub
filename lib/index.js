import { RemoteHubRuntime, installSessionFederation, startRuntimeAgent } from "./host/runtime.js";
import { RemoteHubService } from "./host/remote-service.js";

export const inject = ["sessionController", "workspaceRegistry"];

/** Host entry shared by the controlling and controlled DSH profiles. */
export function apply(ctx, config = {}) {
	const role = config.role || "both";
	if (!new Set(["both", "controller", "agent"]).has(role)) {
		throw new TypeError(`unsupported dsh-remote-hub role: ${String(role)}`);
	}
	const runtime = new RemoteHubRuntime(ctx, { ...config, role });
	ctx.plugin(RemoteHubService, { runtime });

	if (role === "both" || role === "controller") {
		ctx.effect(() => installSessionFederation(ctx, runtime), "dshRemoteHub.sessionFederation");
	}
	ctx.effect(() => {
		let stopped = false;
		if (role === "both" || role === "agent") {
			startRuntimeAgent(runtime).catch((error) => {
				if (!stopped) ctx.logger.error(`[dsh-remote-hub] agent endpoint failed: ${String(error)}`);
			});
		}
		return async () => {
			stopped = true;
			await runtime.dispose();
		};
	}, "dshRemoteHub.runtime");
}
