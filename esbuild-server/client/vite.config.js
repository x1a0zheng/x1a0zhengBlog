import { defineConfig } from 'vite';
import path from 'node:path';

// 后端地址,构建时可以通过环境变量覆盖
const BACKEND = process.env.BACKEND_URL || 'http://localhost:3001';

export default defineConfig({
  root: path.resolve(__dirname),
  server: {
    port: 5174,
    proxy: {
      '/api':     { target: BACKEND, changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, '') },
      '/session': { target: BACKEND, changeOrigin: true },
      '/ws':      { target: BACKEND, ws: true, changeOrigin: true },
    },
  },
  worker: { format: 'es' },
  optimizeDeps: {
    include: [
      'monaco-editor/esm/vs/editor/editor.worker',
      'monaco-editor/esm/vs/language/json/json.worker',
      'monaco-editor/esm/vs/language/css/css.worker',
      'monaco-editor/esm/vs/language/html/html.worker',
      'monaco-editor/esm/vs/language/typescript/ts.worker',
    ],
  },
});