const DEVICE_ID_PATTERN = /^[a-f0-9]{16}$/;
const REMOTE_SESSION_PREFIX = "remote:";
const REMOTE_WORKSPACE_PREFIX = "remote-ws:";

function assertDeviceId(deviceId) {
	if (typeof deviceId !== "string" || !DEVICE_ID_PATTERN.test(deviceId)) {
		throw new TypeError("invalid remote device id");
	}
}

export function remoteSessionId(deviceId, sessionId) {
	assertDeviceId(deviceId);
	if (typeof sessionId !== "string" || sessionId.length === 0) throw new TypeError("invalid remote session id");
	return `${REMOTE_SESSION_PREFIX}${deviceId}:${encodeURIComponent(sessionId)}`;
}

export function parseRemoteSessionId(sessionId) {
	if (typeof sessionId !== "string" || !sessionId.startsWith(REMOTE_SESSION_PREFIX)) return null;
	const rest = sessionId.slice(REMOTE_SESSION_PREFIX.length);
	const separator = rest.indexOf(":");
	if (separator <= 0) return null;
	const deviceId = rest.slice(0, separator);
	const encodedSessionId = rest.slice(separator + 1);
	if (!DEVICE_ID_PATTERN.test(deviceId) || !encodedSessionId) return null;
	try {
		const remoteSessionId = decodeURIComponent(encodedSessionId);
		return remoteSessionId ? { deviceId, sessionId: remoteSessionId } : null;
	} catch {
		return null;
	}
}

export function remoteWorkspaceId(deviceId, workspaceId) {
	assertDeviceId(deviceId);
	if (typeof workspaceId !== "string" || workspaceId.length === 0) throw new TypeError("invalid remote workspace id");
	return `${REMOTE_WORKSPACE_PREFIX}${deviceId}:${encodeURIComponent(workspaceId)}`;
}

export function parseRemoteWorkspaceId(workspaceId) {
	if (typeof workspaceId !== "string" || !workspaceId.startsWith(REMOTE_WORKSPACE_PREFIX)) return null;
	const rest = workspaceId.slice(REMOTE_WORKSPACE_PREFIX.length);
	const separator = rest.indexOf(":");
	if (separator <= 0) return null;
	const deviceId = rest.slice(0, separator);
	const encodedWorkspaceId = rest.slice(separator + 1);
	if (!DEVICE_ID_PATTERN.test(deviceId) || !encodedWorkspaceId) return null;
	try {
		const remoteWorkspaceId = decodeURIComponent(encodedWorkspaceId);
		return remoteWorkspaceId ? { deviceId, workspaceId: remoteWorkspaceId } : null;
	} catch {
		return null;
	}
}

export function mapRemoteSummary(deviceId, summary, workspaceByPath = new Map()) {
	const originalId = summary?.sessionId ?? summary?.id;
	if (typeof originalId !== "string" || originalId.length === 0) return null;
	const mapped = { ...summary, sessionId: remoteSessionId(deviceId, originalId) };
	const projectedTitle = summary?.projections?.values?.title;
	if ((!mapped.title || typeof mapped.title !== "string" || !mapped.title.trim()) && typeof projectedTitle === "string") {
		mapped.title = projectedTitle;
	}
	if (typeof summary.workspaceId === "string" && summary.workspaceId.length > 0) {
		mapped.workspaceId = remoteWorkspaceId(deviceId, summary.workspaceId);
	} else if (typeof summary.cwd === "string" && workspaceByPath.has(summary.cwd)) {
		mapped.workspaceId = workspaceByPath.get(summary.cwd);
	}
	return mapped;
}

export function mapRemoteWorkspace(deviceId, workspace) {
	const originalId = workspace?.workspaceId ?? workspace?.id;
	if (typeof originalId !== "string" || originalId.length === 0) return null;
	return {
		...workspace,
		id: remoteWorkspaceId(deviceId, originalId),
		workspaceId: remoteWorkspaceId(deviceId, originalId),
		remoteWorkspaceId: originalId,
		deviceId
	};
}

export function unmapSessionRequest(request) {
	const candidates = [
		request?.sessionId,
		request?.address?.childSessionId,
		request?.address?.sessionId,
		request?.address?.parentSessionId
	];
	const target = candidates.find((candidate) => parseRemoteSessionId(candidate));
	const parsed = parseRemoteSessionId(target);
	if (!parsed) return null;
	const next = { ...request };
	if (typeof next.sessionId === "string") next.sessionId = parsed.sessionId;
	if (next.address && typeof next.address === "object") {
		next.address = { ...next.address };
		if (next.address.sessionId === target) next.address.sessionId = parsed.sessionId;
		if (next.address.childSessionId === target) next.address.childSessionId = parsed.sessionId;
		if (next.address.parentSessionId === target) next.address.parentSessionId = parsed.sessionId;
	}
	return { deviceId: parsed.deviceId, sessionId: parsed.sessionId, request: next };
}
