# esbuild-server TODO

方案 B 已实现"改代码 → 秒级重编译 → 预览 iframe reload"。
以下是本方案已知缺陷与后续优化清单。方案 C(容器化)会解决其中大多数隔离/依赖类问题。

## 已知缺陷

### 依赖/语言支持
- [ ] `.ts` / `.tsx` 未加 loader — 需要 `loader: { '.ts':'ts', '.tsx':'tsx' }`。
- [ ] CSS Modules (`foo.module.css`) 不识别 — 需要 `esbuild-css-modules-plugin` 之类。
- [ ] Sass / Less / Stylus 不支持 — 需要对应 esbuild 插件。
- [ ] PostCSS / Tailwind 未接入 — 需要 postcss 插件。
- [ ] Vue / Svelte / Solid SFC 不支持 — 需要各自的 esbuild 插件。
- [ ] Node 内置模块 polyfill 未接入(依赖包若 `import 'buffer'`/`'stream'` 会报错) — 用 `esbuild-plugin-node-polyfills`。
- [ ] `import.meta.env` 之类 Vite 风格环境变量未定义。

### 资源处理
- [ ] `.png/.svg/.woff` 目前全走 `dataurl`;大文件/字体应改 `file` loader 并新增静态资源路由。
- [ ] `.wasm` 完全没配置,像 ffmpeg.wasm / pdfjs 无法运行。
- [ ] `new Worker(new URL('./w.js', import.meta.url))` 未处理,不支持 Web Worker。

### 构建/交付
- [ ] 单入口整包,未开 `splitting: true`,不支持动态 `import()` 分片。
- [ ] 每次改动整个 iframe reload,组件本地 state 丢失 — 无真 HMR。
- [ ] 大型依赖(如 antd + icons)每次都全量 bundle,可考虑将 vendor chunk 与业务代码分离并缓存。

### 依赖池 / 会话隔离
- [ ] 所有 session 共享 `esbuild-server/node_modules`,不能一人一版本。
- [ ] 前端用户在 UI 里改 `package.json` 加新依赖不会自动 `npm install`。
- [ ] 没有对 session 数量/生命周期的限制 — 长期运行内存无上限,`sessions/<id>/` 不清理。
- [ ] 没有 CPU/内存 quota,恶意 rebuild 循环可以拖垮主机。

### 安全 / 生产化
- [ ] `Access-Control-Allow-Origin: *`,任何页面都能读别人 session 的 bundle。
- [ ] 未做认证/鉴权,任何人拿到 sessionId 就能改文件。
- [ ] `safeJoin` 只挡了 `..`,没挡符号链接。
- [ ] 无速率限制;快速连续 `fs.write` 会串行排队,但没限制上限。
- [ ] `bundle.js` 里 `sourcemap: 'inline'`,生产不该这么配。

### 观测 / 体验
- [ ] 编辑器没做多光标位置同步,多个 tab 打开同一 session 会互相覆盖。
- [ ] WS 消息没有 `messageId` / `version`,乱序时无法 diff。
- [ ] 没有"重启构建"/"清缓存"按钮,ctx 卡死时只能重启服务。
- [ ] 没有构建产物大小/耗时的历史面板。

## 已完成
- [x] Monaco 编辑器 + 文件列表(平铺)。
- [x] WS 双向通道(重连、离线队列)。
- [x] esbuild `context()` 增量重编译。
- [x] CSS 产物自动注入到预览 iframe。
- [x] antd 示例可直接跑通(共享 node_modules 版本)。
- [x] 构建错误在预览面板红色蒙层显示。

## 后续路线
- 短期在方案 B 内做的改进:补 TS/asset/HMR。
- 中期切到方案 C(container-server/):
  - 一个 session 一个容器,独立 `node_modules`,独立进程,能装任意依赖。
  - 容器内跑真实 Vite dev server → 直接拿到 HMR。
  - 容器级 CPU/内存/网络 quota。