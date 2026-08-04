import { defineConfig } from 'vite';
import path from 'node:path';

const HOST_URL = process.env.HOST_URL || 'http://localhost:3002';

export default defineConfig({
  root: path.resolve(__dirname),
  server: {
    port: 5175,
    proxy: {
      '/api':     { target: HOST_URL, changeOrigin: true },
      '/session': { target: HOST_URL, changeOrigin: true, ws: true },
      '/ws':      { target: HOST_URL, ws: true, changeOrigin: true },
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