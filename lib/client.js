window.__ModuleLoader__.load({
	id: "@yks/dsh-remote-hub",
	factory: (require) => {
		const React = require("react");
		const h = React.createElement;
		const STYLE_ID = "dsh-remote-hub-style";
		const EMPTY_WS = { items: [], archivedSessionIds: [] };
		const EMPTY_SESSIONS = { ids: [], byId: {} };

		const CSS = `
.rh-root{display:flex;flex-direction:column;height:100%;min-height:0;color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.45}
.rh-scroll{flex:1 1 auto;min-height:0;overflow-y:auto;padding:4px 8px 10px}
.rh-top{position:relative;padding:6px 8px 8px}
.rh-device{display:flex;align-items:center;gap:8px;width:100%;padding:7px 8px;border:1px solid transparent;border-radius:7px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}
.rh-device:hover,.rh-device[data-open=true]{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l1)}
.rh-glyph{display:grid;place-items:center;flex:0 0 20px;width:20px;height:20px;border:1px solid var(--dsw-alias-border-l1);border-radius:5px;background:var(--dsw-alias-bg-layer-2);font-size:12px}
.rh-device-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:560}
.rh-device-count,.rh-secondary,.rh-age{color:var(--dsw-alias-label-secondary);font-size:11px}
.rh-pop{position:absolute;z-index:40;top:calc(100% - 2px);left:8px;right:8px;padding:5px;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);border-radius:9px;box-shadow:0 12px 32px rgba(0,0,0,.34)}
.rh-pop-title{padding:5px 8px;color:var(--dsw-alias-label-secondary);font-size:11px;letter-spacing:.04em;text-transform:uppercase}
.rh-pop-item{display:flex;align-items:center;gap:3px}
.rh-pop-row{display:flex;align-items:center;gap:8px;flex:1;min-width:0;width:100%;padding:6px 8px;border:0;border-radius:6px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}
.rh-pop-row:hover,.rh-pop-row[data-active=true]{background:var(--dsw-alias-bg-layer-2)}
.rh-pop-meta{flex:1;min-width:0}.rh-pop-name{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rh-pop-sub{display:block;overflow:hidden;color:var(--dsw-alias-label-secondary);font-size:11px;text-overflow:ellipsis;white-space:nowrap}
.rh-pop-remove{padding:4px 7px;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer}.rh-pop-remove:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-state-error-primary)}
.rh-pop-sep{height:1px;margin:5px 4px;background:var(--dsw-alias-border-l1)}
.rh-modal-backdrop{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:20px;background:rgba(0,0,0,.38)}
.rh-modal{width:min(380px,100%);padding:18px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);box-shadow:0 18px 48px rgba(0,0,0,.38)}
.rh-modal-title{margin:0 0 7px;font-size:15px;font-weight:600}.rh-modal-copy{margin:0 0 15px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.5}
.rh-modal-label{display:block;margin:0 0 6px;font-size:12px;font-weight:550}.rh-modal-input{box-sizing:border-box;width:100%;padding:9px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-2);color:inherit;font:inherit;outline:none}.rh-modal-input:focus{border-color:var(--dsw-alias-brand-primary)}
.rh-modal-error{margin:9px 0 0;color:var(--dsw-alias-state-error-primary);font-size:12px}.rh-modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:17px}.rh-modal-button{padding:7px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:transparent;color:inherit;font:inherit;cursor:pointer}.rh-modal-button:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}.rh-modal-button:disabled{opacity:.55;cursor:default}.rh-modal-button-primary{border-color:transparent;background:var(--dsw-alias-brand-primary);color:#fff}.rh-modal-button-danger{border-color:transparent;background:var(--dsw-alias-state-error-primary);color:#fff}
.rh-section{margin:2px 0}.rh-section-head{display:flex;align-items:center;gap:7px;width:100%;padding:6px 8px;border:0;border-radius:6px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}.rh-section-head:hover,.rh-project-head:hover,.rh-session:hover{background:var(--dsw-alias-bg-layer-2)}
.rh-chevron{width:12px;color:var(--dsw-alias-label-secondary);transition:transform .12s ease}.rh-chevron[data-open=false]{transform:rotate(-90deg)}
.rh-section-title,.rh-project-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:560}
.rh-dot{flex:0 0 7px;width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-state-idle-primary)}.rh-dot[data-status=online]{background:var(--dsw-alias-state-success-primary)}.rh-dot[data-status=connecting]{background:var(--dsw-alias-brand-primary)}.rh-dot[data-status=error]{background:var(--dsw-alias-state-error-primary)}
.rh-project{margin:1px 0}.rh-project-head{display:flex;align-items:center;gap:6px;width:100%;padding:5px 8px 5px 25px;border:0;border-radius:6px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}.rh-project-title{font-weight:500}.rh-path{flex:0 1 42%;overflow:hidden;color:var(--dsw-alias-label-secondary);font-size:11px;text-overflow:ellipsis;white-space:nowrap}
.rh-session{display:flex;align-items:center;gap:8px;width:100%;padding:5px 8px 5px 43px;border:0;border-radius:6px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}.rh-session[data-active=true]{background:var(--dsw-alias-bg-layer-2)}.rh-session-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rh-session-running{flex:0 0 8px;width:8px;height:8px;border-radius:50%;background:var(--dsw-alias-brand-primary);animation:rh-pulse 1.1s ease-in-out infinite}.rh-session-idle{flex:0 0 7px;width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-state-idle-primary)}
.rh-empty{padding:12px 14px;color:var(--dsw-alias-label-secondary);font-size:12px;text-align:center}.rh-error{margin:7px 8px;padding:8px;border:1px solid var(--dsw-alias-state-error-primary);border-radius:7px;color:var(--dsw-alias-state-error-primary);font-size:12px}.rh-group-error{margin:0 8px 5px 34px;color:var(--dsw-alias-state-error-primary);font-size:11px}
.rh-foot{flex:0 0 auto;padding:6px 8px;border-top:1px solid var(--dsw-alias-border-l1)}.rh-footrow{display:flex;align-items:center;gap:8px;width:100%;padding:6px 8px;border:0;border-radius:6px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}.rh-footrow:hover{background:var(--dsw-alias-bg-layer-2)}.rh-kbd{margin-left:auto;color:var(--dsw-alias-label-secondary);font-size:11px}
@keyframes rh-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.8)}}
`;

		async function callHub(connection, method, args = {}) {
			if (!connection?.rpc?.call) throw new Error("DSH Connection RPC 不可用");
			const result = await connection.rpc.call("/api", `remoteHub/${method}`, { args });
			if (result?.ok !== true) throw new Error(result?.error?.message || `Remote Hub 请求失败：${method}`);
			return result.value;
		}

		function buildLocalProjects(workspaceState, sessionState) {
			const byId = sessionState?.byId || {};
			const assigned = new Set();
			const projects = (workspaceState?.items || []).map((workspace) => {
				const ids = (workspace.sessionIds || []).filter((id) => {
					assigned.add(id);
					return byId[id] !== undefined;
				});
				return {
					id: workspace.workspaceId || workspace.id,
					title: workspace.title === "default-workspace" ? "未分组" : workspace.title,
					path: workspace.path || "",
					sessions: ids.map((id) => ({ id, session: byId[id] }))
				};
			});
			const ungrouped = (sessionState?.ids || []).filter((id) => byId[id] !== undefined && !assigned.has(id));
			if (ungrouped.length) projects.push({ id: "__ungrouped", title: "其它会话", path: "", sessions: ungrouped.map((id) => ({ id, session: byId[id] })) });
			return projects.filter((project) => project.sessions.length > 0);
		}

		function buildRemoteProjects(workspaces, summaries) {
			const rows = Array.isArray(summaries) ? summaries : [];
			const projects = (Array.isArray(workspaces) ? workspaces : []).map((workspace) => ({
				id: workspace.workspaceId || workspace.id,
				title: workspace.title || workspace.path || "远程工作区",
				path: workspace.path || "",
				sessions: rows.filter((row) =>
					(row.workspaceId && row.workspaceId === (workspace.workspaceId || workspace.id)) ||
					(!row.workspaceId && row.cwd && row.cwd === workspace.path)
				)
			}));
			const assigned = new Set(projects.flatMap((project) => project.sessions.map((row) => row.sessionId)));
			const ungrouped = rows.filter((row) => !assigned.has(row.sessionId));
			if (ungrouped.length) projects.push({ id: `remote-ungrouped-${ungrouped[0].sessionId}`, title: "其它会话", path: "", sessions: ungrouped });
			return projects;
		}

		function Chevron(props) {
			return h("span", { className: "rh-chevron", "data-open": props.open ? "true" : "false" }, "›");
		}

		function SessionRow(props) {
			const session = props.session || {};
			const title = session.blank ? "新会话" : (session.title || "").trim() || String(props.id).slice(0, 10);
			const running = props.status ? props.status.running === true : session.running === true;
			return h(
				"button",
				{ type: "button", className: "rh-session", title, onClick: props.onOpen },
				h("span", { className: running ? "rh-session-running" : "rh-session-idle" }),
				h("span", { className: "rh-session-title" }, title),
				running ? h("span", { className: "rh-age" }, "运行中") : null
			);
		}

		function ProjectGroup(props) {
			const project = props.project;
			const open = props.collapsed[project.id] !== true;
			return h(
				"div",
				{ className: "rh-project", key: project.id },
				h(
					"button",
					{ type: "button", className: "rh-project-head", title: project.path, onClick: () => props.onToggle(project.id, open) },
					h(Chevron, { open }),
					h("span", { className: "rh-project-title" }, project.title),
					props.wide === false ? null : h("span", { className: "rh-path" }, project.path || "")
				),
				open ? project.sessions.map((row) => {
					const id = row.id || row.sessionId;
					return h(SessionRow, {
						key: id,
						id,
						session: row.session || row,
						status: props.statuses?.get(id),
						onOpen: () => props.onOpen(id)
					});
				}) : null
			);
		}

		function DeviceGroup(props) {
			const device = props.device;
			const open = props.collapsed[device.id] !== true;
			return h(
				"section",
				{ className: "rh-section", key: device.id },
				h(
					"button",
					{
						type: "button",
						className: "rh-section-head",
						title: device.target || device.sshAlias || device.subtitle || device.name,
						onClick: () => {
							props.onSelect(device.id);
							props.onToggle(device.id, open);
						}
					},
					h(Chevron, { open }),
					h("span", { className: "rh-glyph" }, device.kind === "local" ? "⌂" : "▤"),
					h("span", { className: "rh-section-title" }, device.name),
					device.kind !== "local" ? h("span", { className: "rh-dot", "data-status": device.status }) : null
				),
				props.error ? h("div", { className: "rh-group-error" }, props.error) : null,
				open
					? device.projects.length
						? device.projects.map((project) => h(ProjectGroup, {
								key: project.id,
								project,
								wide: props.wide,
								collapsed: props.collapsed,
								statuses: props.statuses,
								onToggle: props.onToggle,
								onOpen: props.onOpen
							}))
						: h("div", { className: "rh-empty" }, device.kind === "local" ? "本机还没有会话。" : device.status === "online" ? "没有可显示的会话。" : "连接后显示远程会话。")
					: null
			);
		}

		function DevicePopover(props) {
			return h(
				"div",
				{ className: "rh-pop", role: "dialog" },
				h("div", { className: "rh-pop-title" }, "设备管理"),
				props.devices.map((device) => h(
					"div",
					{ key: device.id, className: "rh-pop-item" },
					h("button", {
						type: "button",
						className: "rh-pop-row",
						"data-active": device.id === props.selectedId ? "true" : "false",
						onClick: () => props.onPick(device.id)
					},
					h("span", { className: "rh-glyph" }, device.kind === "local" ? "⌂" : "▤"),
					h("span", { className: "rh-pop-meta" },
						h("span", { className: "rh-pop-name" }, device.name),
						h("span", { className: "rh-pop-sub" }, device.kind === "local" ? "本机" : device.target || device.sshAlias)
					),
					device.kind !== "local" ? h("span", { className: "rh-dot", "data-status": device.status }) : null
					),
					device.kind !== "local" ? h("button", {
						type: "button",
						className: "rh-pop-remove",
						title: "移除此设备",
						"aria-label": `移除 ${device.name}`,
						onClick: () => props.onRemove(device)
					}, "×") : null
				)),
				h("div", { className: "rh-pop-sep" }),
				h("button", { type: "button", className: "rh-pop-row", onClick: props.onAdd },
					h("span", { className: "rh-glyph" }, "+"),
					h("span", { className: "rh-pop-name" }, "添加 SSH 设备…")
				)
			);
		}

		function RemoteHubSidebarBody(props) {
			const wsState = props.useWorkspaces ? props.useWorkspaces((state) => state) : EMPTY_WS;
			const sessionState = props.useSessions ? props.useSessions((state) => state) : EMPTY_SESSIONS;
			const statusState = props.useSessionStatus ? props.useSessionStatus((state) => state) : undefined;
			const statuses = statusState && typeof statusState.get === "function" ? statusState : null;
			const [remoteDevices, setRemoteDevices] = React.useState([]);
			const [remoteProjects, setRemoteProjects] = React.useState({});
			const [deviceErrors, setDeviceErrors] = React.useState({});
			const [selectedId, setSelectedId] = React.useState("local");
			const [popover, setPopover] = React.useState(false);
			const [collapsed, setCollapsed] = React.useState({});
			const [error, setError] = React.useState("");
			const [loading, setLoading] = React.useState(true);
			const [refreshGeneration, setRefreshGeneration] = React.useState(0);
			const [dialog, setDialog] = React.useState(null);
			const [dialogValue, setDialogValue] = React.useState("");
			const [dialogError, setDialogError] = React.useState("");
			const [dialogBusy, setDialogBusy] = React.useState(false);

			const reloadDevices = async () => {
				const result = await callHub(props.connection, "listDevices");
				setRemoteDevices(Array.isArray(result) ? result : []);
				setRefreshGeneration((value) => value + 1);
			};

			React.useEffect(() => {
				let active = true;
				callHub(props.connection, "listDevices").then((result) => {
					if (active) setRemoteDevices(Array.isArray(result) ? result : []);
				}).catch((cause) => {
					if (active) setError(cause.message || String(cause));
				}).finally(() => {
					if (active) setLoading(false);
				});
				return () => { active = false; };
			}, []);

			const remoteIds = remoteDevices.map((device) => device.id).join(",");
			React.useEffect(() => {
				if (!remoteIds) {
					setRemoteProjects({});
					return undefined;
				}
				let active = true;
				let busy = false;
				const ids = remoteIds.split(",");
				const refresh = async () => {
					if (busy) return;
					busy = true;
					const results = await Promise.all(ids.map(async (deviceId) => {
						try {
							const connection = await callHub(props.connection, "connect", { deviceId });
						const [workspaces, sessionResult] = await Promise.all([
							callHub(props.connection, "listRemoteWorkspaces", { deviceId }),
							callHub(props.connection, "listRemoteSessions", { deviceId })
						]);
						return { deviceId, connection, projects: buildRemoteProjects(workspaces, sessionResult?.items || []) };
						} catch (cause) {
							return { deviceId, error: cause.message || String(cause) };
						}
					}));
					if (active) {
						setRemoteProjects((previous) => {
							const next = {};
							for (const result of results) {
								if (result.projects) next[result.deviceId] = result.projects;
								else if (previous[result.deviceId]) next[result.deviceId] = previous[result.deviceId];
							}
							return next;
						});
						setDeviceErrors(Object.fromEntries(results.filter((item) => item.error).map((item) => [item.deviceId, item.error])));
						setRemoteDevices((previous) => previous.map((device) => {
							const result = results.find((item) => item.deviceId === device.id);
							return result ? { ...device, status: result.error ? "error" : result.connection?.status || "online" } : device;
						}));
						if (props.sessions && typeof props.sessions.refresh === "function") {
							await props.sessions.refresh().catch((cause) => console.warn("[dsh-remote-hub] session refresh failed", cause));
						}
					}
					busy = false;
				};
				void refresh();
				const timer = setInterval(refresh, 20000);
				return () => { active = false; clearInterval(timer); };
			}, [remoteIds, refreshGeneration]);

			const devices = [
				{
					id: "local",
					kind: "local",
					name: "本机",
					subtitle: props.host?.name || "这台机器",
					status: "online",
					projects: buildLocalProjects(wsState, sessionState)
				},
				...remoteDevices.map((device) => ({
					...device,
					kind: "ssh",
					name: device.label || device.name || device.sshAlias,
					projects: remoteProjects[device.id] || []
				}))
			];
			const selected = devices.find((device) => device.id === selectedId) || devices[0];
			const orderedDevices = selected.kind === "local"
				? devices
				: [selected, ...devices.filter((device) => device.id !== selected.id)];

			const openSession = async (sessionId) => {
				try {
					if (String(sessionId).startsWith("remote:") && props.sessions?.refresh) await props.sessions.refresh();
					props.layout?.selectPanel?.(sessionId);
				} catch (cause) {
					setError(cause.message || String(cause));
				}
			};

			const openAddDeviceDialog = () => {
				setDialogValue("");
				setDialogError("");
				setDialog({ kind: "add" });
				setPopover(false);
			};

			const addDevice = async (event) => {
				event?.preventDefault?.();
				const sshAlias = dialogValue.trim();
				if (!sshAlias) {
					setDialogError("请输入 SSH 主机别名。");
					return;
				}
				setDialogBusy(true);
				setDialogError("");
				try {
					const device = await callHub(props.connection, "addDevice", { request: { sshAlias } });
					setSelectedId(device.id);
					await reloadDevices();
					setDialog(null);
				} catch (cause) {
					setDialogError(cause.message || String(cause));
				} finally {
					setDialogBusy(false);
				}
			};

			const requestRemoveDevice = (device) => {
				setDialogError("");
				setPopover(false);
				setDialog({ kind: "remove", device });
			};

			const removeDevice = async () => {
				const device = dialog?.device;
				if (!device) return;
				setDialogBusy(true);
				setDialogError("");
				try {
					await callHub(props.connection, "removeDevice", { deviceId: device.id });
					if (selectedId === device.id) setSelectedId("local");
					await reloadDevices();
					setDialog(null);
				} catch (cause) {
					setDialogError(cause.message || String(cause));
				} finally {
					setDialogBusy(false);
				}
			};

			const closeDialog = () => {
				if (dialogBusy) return;
				setDialog(null);
				setDialogError("");
			};

			const createSession = async () => {
				if (selected.kind === "local") {
					props.onNewSession?.();
					return;
				}
				try {
					const result = await callHub(props.connection, "createRemoteSession", { request: { deviceId: selected.id } });
					await props.sessions?.refresh?.();
					props.layout?.selectPanel?.(result.sessionId);
				} catch (cause) {
					setError(cause.message || String(cause));
				}
			};

			return h(
				"div",
				{ className: "rh-root" },
				h("div", { className: "rh-top" },
					h("button", {
						type: "button",
						className: "rh-device",
						"data-open": popover ? "true" : "false",
						title: selected.target || selected.name,
						onClick: () => setPopover((value) => !value)
					},
						h("span", { className: "rh-glyph" }, selected.kind === "local" ? "⌂" : "▤"),
						h("span", { className: "rh-device-name" }, selected.name),
						h("span", { className: "rh-device-count" }, remoteDevices.length ? `${remoteDevices.length} 台远程设备` : "设备管理"),
						h("span", { className: "rh-secondary" }, "⌄")
					),
					popover ? h(DevicePopover, {
						devices,
						selectedId,
						onPick: (id) => { setSelectedId(id); setPopover(false); setCollapsed((previous) => ({ ...previous, [id]: false })); },
						onAdd: openAddDeviceDialog,
						onRemove: requestRemoveDevice
					}) : null
				),
				h("div", { className: "rh-scroll" },
					loading && remoteDevices.length === 0 ? h("div", { className: "rh-empty" }, "正在读取远程设备…") : null,
					error ? h("div", { className: "rh-error" }, error) : null,
					orderedDevices.map((device) => h(DeviceGroup, {
						key: device.id,
						device,
						wide: props.wide,
						collapsed,
						statuses,
						error: deviceErrors[device.id],
						onSelect: setSelectedId,
						onToggle: (id, wasOpen) => setCollapsed((previous) => ({ ...previous, [id]: wasOpen })),
						onOpen: openSession
					}))
				),
				h("div", { className: "rh-foot" },
					h("button", { type: "button", className: "rh-footrow", onClick: createSession },
						h("span", { className: "rh-glyph" }, "+"),
						h("span", null, "新建会话"),
						h("span", { className: "rh-kbd" }, selected.name)
					),
					h("button", { type: "button", className: "rh-footrow", onClick: () => setPopover(true) },
						h("span", { className: "rh-glyph" }, "▤"),
						h("span", null, "远程设备"),
						h("span", { className: "rh-kbd" }, remoteDevices.length ? `${remoteDevices.length} 台` : "未配置")
					)
				),
				dialog?.kind === "add" ? h("div", {
					className: "rh-modal-backdrop",
					onMouseDown: (event) => { if (event.target === event.currentTarget) closeDialog(); },
					onKeyDown: (event) => { if (event.key === "Escape") closeDialog(); }
				},
					h("form", {
						className: "rh-modal",
						role: "dialog",
						"aria-modal": "true",
						"aria-labelledby": "rh-device-dialog-title",
						onSubmit: addDevice
					},
						h("h2", { id: "rh-device-dialog-title", className: "rh-modal-title" }, "添加 SSH 设备"),
						h("p", { className: "rh-modal-copy" }, "输入 ~/.ssh/config 中的主机别名。远端 DSH 需要运行 Remote Hub 插件。"),
						h("label", { className: "rh-modal-label", htmlFor: "rh-device-ssh-alias" }, "SSH 主机别名"),
						h("input", {
							id: "rh-device-ssh-alias",
							className: "rh-modal-input",
							value: dialogValue,
							autoFocus: true,
							autoComplete: "off",
							placeholder: "例如 office-pc",
							"aria-label": "SSH 主机别名",
							disabled: dialogBusy,
							onChange: (event) => setDialogValue(event.target.value)
						}),
						dialogError ? h("div", { className: "rh-modal-error", role: "alert" }, dialogError) : null,
						h("div", { className: "rh-modal-actions" },
							h("button", { type: "button", className: "rh-modal-button", disabled: dialogBusy, onClick: closeDialog }, "取消"),
							h("button", { type: "submit", className: "rh-modal-button rh-modal-button-primary", disabled: dialogBusy || !dialogValue.trim() }, dialogBusy ? "正在连接…" : "添加设备")
						)
					)
				) : dialog?.kind === "remove" ? h("div", {
					className: "rh-modal-backdrop",
					onMouseDown: (event) => { if (event.target === event.currentTarget) closeDialog(); },
					onKeyDown: (event) => { if (event.key === "Escape") closeDialog(); }
				},
					h("div", { className: "rh-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "rh-device-dialog-title" },
						h("h2", { id: "rh-device-dialog-title", className: "rh-modal-title" }, "移除远程设备"),
						h("p", { className: "rh-modal-copy" }, `确定移除“${dialog.device.name || dialog.device.label || dialog.device.sshAlias}”吗？这只会解除本机关联，不会删除远端数据。`),
						dialogError ? h("div", { className: "rh-modal-error", role: "alert" }, dialogError) : null,
						h("div", { className: "rh-modal-actions" },
							h("button", { type: "button", className: "rh-modal-button", disabled: dialogBusy, onClick: closeDialog }, "取消"),
							h("button", { type: "button", className: "rh-modal-button rh-modal-button-danger", disabled: dialogBusy, onClick: removeDevice }, dialogBusy ? "正在移除…" : "移除设备")
						)
					)
				) : null
			);
		}

		class ErrorBoundary extends React.Component {
			constructor(props) {
				super(props);
				this.state = { error: null };
			}
			static getDerivedStateFromError(error) {
				return { error };
			}
			componentDidCatch(error) {
				console.error("[dsh-remote-hub] sidebar crashed", error);
			}
			render() {
				if (this.state.error) return h("div", { className: "rh-error" }, `远程设备侧栏出错：${this.state.error.message || this.state.error}`);
				return this.props.children;
			}
		}

		function apply(ctx, config) {
			const takeOver = config?.takeOver !== false;
			ctx.effect(() => {
				const element = document.createElement("style");
				element.id = STYLE_ID;
				element.textContent = CSS;
				document.head.append(element);
				return () => element.remove();
			}, "dshRemoteHub.styles");
			const injected = () => ({
				layout: ctx.get("layout"),
				sessions: ctx.get("sessions"),
				connection: ctx.get("connection"),
				onNewSession: () => ctx.get("sessions")?.create?.({})
			});
			if (!takeOver) return;
			ctx.effect(() => ctx.slots.inject("sidebar.workspaces", () => ctx.slots.register({
				name: "sidebar.workspaces",
				priority: -1,
				registrant: "@yks/dsh-remote-hub",
				inject: injected
			}, (props) => h(ErrorBoundary, null, h(RemoteHubSidebarBody, props)))), "dshRemoteHub.sidebar.workspaces");
		}

		const module = { exports: {} };
		module.exports.apply = apply;
		module.exports.inject = ["slots", "connection"];
		return module.exports;
	}
});
