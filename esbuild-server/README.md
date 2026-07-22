# esbuild-server (方案 B)

前端 Monaco 编辑器把改动通过 WebSocket 推给 Node 后端；
后端用 `esbuild.context()` 增量重编译，把 bundle 通过 HTTP 暴露；
前端 iframe 加载 bundle，构建完成后自动 reload。

## 开发启动
```
npm install
npm run dev        # 同时启动 server(:3001) + Vite client(:5174)
```
- 编辑器界面: http://localhost:5174/
- 后端 API/WS: http://localhost:3001/ (供 iframe 与 WS 使用)

每个浏览器会话在 `sessions/<sessionId>/` 下有独立工作区，
初始文件从 `template/` 拷贝。