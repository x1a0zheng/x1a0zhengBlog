# container-server (方案 C)

每个浏览器 session 独立起一个 Docker 容器。容器里跑真实的 Vite dev server，
天生带 HMR；宿主(host) 只做容器编排 + WebSocket/HTTP 反向代理。

```
Browser (Monaco + iframe)
    │
    ├── WS  /ws?sessionId=X   ────────────►  Host (Node.js)
    │                                          │
    │                                          ├── docker create/start "wc-agent" 镜像
    │                                          │      volume: ./workspaces/X → /workspace
    │                                          │      port : container:8000 → 随机 host port (agent)
    │                                          │      port : container:5173 → 随机 host port (vite)
    │                                          │
    │                                          ├── WS   /ws → agent :8000       (fs.write / spawn / log)
    │                                          └── HTTP /session/X/preview/*   →  vite :5173  (含 WS 升级,即 HMR)
    │
    └── iframe.src = /session/X/preview/
```

## 组件

- **agent/**  容器镜像里跑的守护进程
  - `Dockerfile`         基础镜像 = node:20-alpine,预装 pnpm + workspace-template 的 node_modules
  - `index.js`           启动时执行 `pnpm i --offline`,然后 `vite --host 0.0.0.0 --port 5173`;并起一个 WS(:8000) 接受来自 host 的文件写入/命令
  - `workspace-template/`  容器里的初始项目(和 esbuild-server/template 类似,但真正装 antd/react/vite)

- **host/**  运行在开发者机器上的 Node 编排器
  - `src/index.js`       HTTP + WS 入口
  - `src/session-manager.js`  为每个 sessionId 创建/销毁容器
  - `src/proxy.js`       预览 HTTP + WS 反向代理到容器 vite 端口
  - `src/agent-client.js`  与容器内 agent 的 WS 通信封装
  - 依赖:`dockerode`、`ws`、`http-proxy`

- **client/**  浏览器端 UI(和 esbuild-server/client 结构一致,主要改预览路径)

## 前置

- 需要本机安装 Docker Desktop / Docker Engine,`docker` CLI 可用。
- 首次跑要构建镜像:`npm run build:image`(约 3–5 分钟,含 npm install)。

## 开发启动

```
cd container-server
npm install
npm run build:image       # 构建 wc-agent:latest 镜像
npm run dev               # host(:3002) + client(:5175)
```
浏览器打开 `http://localhost:5175/`。第一次连入会:
1. Host `docker run` 一个容器
2. 容器内 agent 启动 vite dev
3. Host 把 preview 反代给 vite
4. 你在 Monaco 里改代码 → WS → agent 写文件 → vite HMR → 预览局部更新

## 与方案 B 的差异

| 能力 | 方案 B (esbuild-server) | 方案 C (container-server) |
|---|---|---|
| 依赖隔离 | 共享 node_modules | 每容器独立 |
| 动态装依赖 | 不支持 | 容器内 `pnpm add xxx` |
| HMR | 无(整包 reload) | 真 Vite HMR |
| 资源开销 | 单进程 | 每 session ~150MB RAM |
| 安全 | 主机进程 | 容器隔离 + quota |
| 冷启动 | ~60ms | 首次拉镜像 + npm i,约 3–10s;后续复用工作区 <1s |

## TODO(初版之后)

- [ ] 空闲 N 分钟自动 stop 容器,再连接自动 start(节省 RAM)
- [ ] 容器 CPU/内存 quota、readonly rootfs、network=none
- [ ] Web 终端(xterm.js)透传到容器 shell
- [ ] `package.json` 变更时自动 `pnpm install`
- [ ] 多副本模板:vanilla-react、vue、svelte…