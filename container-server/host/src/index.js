import http from 'node:http';
import { WebSocketServer } from 'ws';
import { getOrCreateSession, listSessions, stopSession } from './session-manager.js';
import { createProxy } from './proxy.js';
import { checkDocker, hasImage, friendlyError } from './docker-check.js';

const PORT = Number(process.env.PORT || 3002);
const IMAGE = process.env.AGENT_IMAGE || 'wc-agent:latest';

const proxy = createProxy();

// -------- 预检 --------
const dockerStatus = await checkDocker();
if (!dockerStatus.ok) {
  console.error('\n[host] ❌ Docker 不可用:\n');
  console.error(friendlyError(dockerStatus.error));
  console.error('\n如果你现在只想快速看效果,可以先用方案 B: `cd ../esbuild-server && npm run dev`\n');
  // 不 exit,继续启动 HTTP,以便浏览器能拿到友好错误页
}
const imageOk = dockerStatus.ok ? await hasImage(IMAGE) : false;
if (dockerStatus.ok && !imageOk) {
  console.error(`\n[host] ⚠️  镜像 ${IMAGE} 不存在。请先构建:\n  npm run build:image\n`);
}

const READY = dockerStatus.ok && imageOk;

const server = http.createServer(async (req, res) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }

    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === '/api/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ready: READY,
        docker: dockerStatus,
        imageOk,
        image: IMAGE,
        hint: !READY ? friendlyError(dockerStatus.error || new Error('image missing')) : null,
      }));
      return;
    }

    if (!READY) { res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' }).end('host 未就绪,查看终端日志或 GET /api/status'); return; }

    let m = url.pathname.match(/^\/session\/([^/]+)\/preview(\/.*)?$/);
    if (m) {
      const [, id, rest] = m;
      const sess = await getOrCreateSession(id);
      req.url = (rest || '/') + (url.search || '');
      proxy.web(req, res, { target: sess.viteUrl });
      return;
    }

    m = url.pathname.match(/^\/api\/session\/([^/]+)\/files$/);
    if (m) {
      const sess = await getOrCreateSession(m[1]);
      const files = await sess.agent.list();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ files }));
      return;
    }

    if (url.pathname === '/api/sessions') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ sessions: listSessions() }));
      return;
    }

    res.writeHead(404).end('not found');
  } catch (err) {
    console.error(err);
    res.writeHead(500).end(String(err.message || err));
  }
});

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', async (req, socket, head) => {
  try {
    if (!READY) { socket.destroy(); return; }
    const url = new URL(req.url, 'http://x');
    const previewMatch = url.pathname.match(/^\/session\/([^/]+)\/preview(\/.*)?$/);
    if (previewMatch) {
      const [, id, rest] = previewMatch;
      const sess = await getOrCreateSession(id);
      req.url = (rest || '/') + (url.search || '');
      proxy.ws(req, socket, head, { target: sess.viteUrl });
      return;
    }
    if (url.pathname === '/ws') {
      const sessionId = url.searchParams.get('sessionId');
      if (!sessionId) { socket.destroy(); return; }
      const sess = await getOrCreateSession(sessionId);
      wss.handleUpgrade(req, socket, head, (ws) => bindClient(ws, sess));
      return;
    }
    socket.destroy();
  } catch (err) {
    console.error('upgrade error', err.message);
    try { socket.destroy(); } catch {}
  }
});

function bindClient(ws, sess) {
  ws.send(JSON.stringify({
    type: 'hello', sessionId: sess.id, previewPath: `/session/${sess.id}/preview/`,
  }));
  const forwardToAgent = (msg) => sess.agent.send(msg);
  ws.on('message', (buf) => {
    let msg; try { msg = JSON.parse(buf.toString('utf8')); } catch { return; }
    if (msg.type === 'fs.write' || msg.type === 'fs.delete') forwardToAgent(msg);
    else if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }));
  });
  const unsub = sess.agent.subscribe((msg) => {
    if (ws.readyState === 1) ws.send(JSON.stringify(msg));
  });
  ws.on('close', unsub);
}

server.listen(PORT, () => {
  const state = READY ? '✅ ready' : '⚠️  degraded (see /api/status)';
  console.log(`[host] listening http://localhost:${PORT}  ${state}`);
  if (dockerStatus.ok) console.log(`[host] docker ${dockerStatus.version} (${dockerStatus.os})`);
});

async function shutdown() {
  console.log('\n[host] shutting down, stopping sessions...');
  const ids = listSessions().map(s => s.id);
  await Promise.all(ids.map(stopSession));
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);