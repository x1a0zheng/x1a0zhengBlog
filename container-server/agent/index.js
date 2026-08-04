// 容器内守护进程:
//   1) 若 /workspace 为空,从 /workspace-template 拷贝
//   2) 起 Vite dev server(端口 VITE_PORT,默认 5173)
//   3) 起 WS 控制通道(端口 AGENT_PORT,默认 8000),接受来自 host 的:
//        - fs.write   { path, contents }
//        - fs.delete  { path }
//        - fs.list    -> { files: { path: contents } }
//        - spawn      { cmd, args } (可选,后续用)
//   4) 把 Vite/子进程 stdout 广播到所有 WS 订阅者

import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { WebSocketServer } from 'ws';

const AGENT_PORT = Number(process.env.AGENT_PORT || 8000);
const VITE_PORT  = Number(process.env.VITE_PORT  || 5173);
const WORKSPACE  = '/workspace';
const TEMPLATE   = '/workspace-template';

// -------- 1) 初始化 workspace --------
async function ensureWorkspace() {
  try {
    const entries = await fs.readdir(WORKSPACE);
    if (entries.length > 0) return;
  } catch {
    await fs.mkdir(WORKSPACE, { recursive: true });
  }
  await copyDir(TEMPLATE, WORKSPACE);
  // 复用镜像里已装好的 node_modules,避免每个容器再装一遍
  try {
    await fs.symlink(path.join(TEMPLATE, 'node_modules'), path.join(WORKSPACE, 'node_modules'), 'dir');
  } catch {}
  console.log('[agent] workspace initialized from template');
}

async function copyDir(src, dst) {
  await fs.mkdir(dst, { recursive: true });
  for (const e of await fs.readdir(src, { withFileTypes: true })) {
    if (e.name === 'node_modules') continue;
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) await copyDir(s, d);
    else await fs.copyFile(s, d);
  }
}

// -------- 2) 启动 Vite --------
let viteProc;
const subscribers = new Set();

function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const ws of subscribers) { if (ws.readyState === 1) ws.send(data); }
}

function startVite() {
  viteProc = spawn(
    'node_modules/.bin/vite',
    ['--host', '0.0.0.0', '--port', String(VITE_PORT), '--strictPort'],
    { cwd: WORKSPACE, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, FORCE_COLOR: '1' } }
  );
  viteProc.stdout.on('data', (buf) => broadcast({ type: 'log', stream: 'stdout', chunk: buf.toString('utf8') }));
  viteProc.stderr.on('data', (buf) => broadcast({ type: 'log', stream: 'stderr', chunk: buf.toString('utf8') }));
  viteProc.on('exit', (code) => broadcast({ type: 'log', stream: 'stderr', chunk: `[vite exit ${code}]\n` }));
}

// -------- 3) 文件操作 & 列表 --------
function safeJoin(rel) {
  const abs = path.resolve(WORKSPACE, rel);
  if (!abs.startsWith(WORKSPACE + '/') && abs !== WORKSPACE) throw new Error('path escape');
  return abs;
}

async function fsWrite(rel, contents) {
  const abs = safeJoin(rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, contents);
}

async function fsDelete(rel) {
  await fs.rm(safeJoin(rel), { force: true });
}

async function fsList() {
  const out = {};
  async function walk(dir, rel) {
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const abs = path.join(dir, e.name);
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) await walk(abs, r);
      else out[r] = await fs.readFile(abs, 'utf8');
    }
  }
  await walk(WORKSPACE, '');
  return out;
}

// -------- 4) WS server --------
async function main() {
  await ensureWorkspace();
  startVite();

  const server = http.createServer((req, res) => {
    if (req.url === '/health') { res.writeHead(200).end('ok'); return; }
    res.writeHead(404).end();
  });
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    subscribers.add(ws);
    ws.send(JSON.stringify({ type: 'hello', vitePort: VITE_PORT }));

    ws.on('message', async (buf) => {
      let msg; try { msg = JSON.parse(buf.toString('utf8')); } catch { return; }
      try {
        if (msg.type === 'fs.write')  { await fsWrite(msg.path, msg.contents); ack(ws, msg.id); }
        else if (msg.type === 'fs.delete') { await fsDelete(msg.path); ack(ws, msg.id); }
        else if (msg.type === 'fs.list')   {
          const files = await fsList();
          ws.send(JSON.stringify({ type: 'fs.list.result', id: msg.id, files }));
        }
      } catch (err) {
        ws.send(JSON.stringify({ type: 'error', id: msg.id, message: err.message }));
      }
    });

    ws.on('close', () => subscribers.delete(ws));
  });

  server.listen(AGENT_PORT, '0.0.0.0', () => {
    console.log(`[agent] control ws listening on :${AGENT_PORT}, vite on :${VITE_PORT}`);
  });
}
function ack(ws, id) { if (id != null) ws.send(JSON.stringify({ type: 'ack', id })); }

main().catch((err) => { console.error(err); process.exit(1); });