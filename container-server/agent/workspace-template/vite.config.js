import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    hmr: {
      // host 会把 iframe 页面通过 /session/:id/preview/ 反代过来,
      // Vite HMR client 需要连的 WS 也走同一路径。
      // path 由 vite 默认(=/) ,我们在 host 的 proxy 里做路径改写。
      clientPort: 443,   // 让 client 用当前 window.location 端口(会被 host 侧改写)
    },
    // 允许被反代访问
    allowedHosts: 'all',
  },
});