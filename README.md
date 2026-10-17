# DSH Remote Hub

把多台 DSH 主机的工作区和会话接入同一个 DSH 侧栏。桌面端仍使用 DSH 自带的会话列表、聊天页和会话数据模型；插件只在 Host 层把带设备前缀的会话请求路由到 SSH 对端。

## 工作方式

- 本机通过 `~/.ssh/config` 中的 SSH 别名连接远端，不保存密码或私钥。
- 每个远端 DSH Host 在 `127.0.0.1` 上启动随机端口的桥接服务，并在 `~/.dsh/remote-hub/agent.json` 写入端口和随机令牌。
- 本机用 SSH 读取该文件并建立只绑定本机回环地址的 `ssh -L` 隧道。桥接服务不监听 LAN 或公网。
- 远端会话 ID 编码为 `remote:<设备ID>:<会话ID>`。本机 Session Controller 保留原服务，并按前缀转发列表、历史、follow 和会话操作。
- `role` 支持 `both`（默认）、`controller`、`agent`。多数两台 DSH 的部署可两端都用 `both`；只提供会话的机器可用 `agent`。

## 安装

从 GitHub 安装到本机桌面 profile：

```sh
dsh plugin --profile desktop add github:iceleaf916/dsh-remote-hub
```

已有安装升级到最新版：

```sh
dsh plugin --profile desktop update @iceleaf916/dsh-remote-hub
```

0.1.3 起包名改为 `@iceleaf916/dsh-remote-hub`。如果已安装旧包名 `@yks/dsh-remote-hub`，请先备份 profile，再迁移并重启 DSH：

```sh
dsh plugin --profile desktop remove @yks/dsh-remote-hub
dsh plugin --profile desktop add github:iceleaf916/dsh-remote-hub
```

远端 DSH Host 也需要安装插件。把 `web` 替换为远端实际使用的 profile：

```sh
dsh plugin --profile web add github:iceleaf916/dsh-remote-hub
```

DSH profile 会由 CLI 更新。修改任何现有 profile 前先备份其 `package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml` 和 `cordis.patch.yml`。移除方式：

```sh
dsh plugin --profile desktop remove @iceleaf916/dsh-remote-hub
```

安装后重启对应 DSH Host。侧栏的“设备管理”中添加 SSH 别名；本机必须能以无交互方式运行 `ssh <别名>`。

## 验证

```sh
node --test
```

测试覆盖本机/远端会话条目点击、原生会话导航、新建会话跳转、设备/会话 ID 编解码、SSH 配置解析和别名校验、Host 方法路由与恢复、远端桥认证、工作区/会话读取及 follow 流。

## 会话导航兼容性

0.1.2 修复侧栏点击后报 `layout.selectPanel: main panel ... is not registered` 的问题。`layout.selectPanel()` 仅用于全局面板；插件复用原生 `sidebar.workspaces` 入口提供的 `open` / `startSession`，由 DSH 负责保留会话、加载历史、更新选择并切回聊天页。客户端显式依赖原生工作区插件。

## 当前边界

此版本打通设备 → 工作区 → 会话列表、打开远程会话、读取历史、持续接收 follow、创建会话和常见会话操作。Host 级 `session.control` 投影流目前还未跨设备合并，因此远端投影状态的实时刷新不完整。终端、文件浏览/编辑、审批 UI 与跨设备 handoff 仍需各自的 Host 服务路由，尚未接入。远端 DSH 必须保持运行；隧道断开后侧栏会显示连接错误，并在后续刷新时重连。
