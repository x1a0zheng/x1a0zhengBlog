import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { createSession, getSession, listPaths, readFile } from './session.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3001);

const MIME = {
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.map':  'application/json; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const server = http.createServer(async (req, res) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }

    const url = new URL(req.url, `http://${req.headers.host}`);

    // 兼容: /session/:id/bundle.js  →  /session/:id/asset/bundle.js
    let m = url.pathname.match(/^\/session\/([^/]+)\/(bundle\.js|bundle\.css)$/);
    if (m) { return serveAsset(res, m[1], m[2]); }

    m = url.pathname.match(/^\/session\/([^/]+)\/asset\/([^/]+)$/);
    if (m) { return serveAsset(res, m[1], m[2]); }

    m = url.pathname.match(/^\/session\/([^/]+)\/preview$/);
    if (m) {
      const html = await fs.readFile(path.join(__dirname, 'preview.html'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html.replaceAll('__SESSION_ID__', m[1]));
      return;
    }

    m = url.pathname.match(/^\/session\/([^/]+)\/files$/);
    if (m) {
      const sess = await createSession(m[1]);
      const paths = await listPaths(sess);
      const files = {};
      for (const p of paths) files[p] = await readFile(sess, p);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ files }));
      return;
    }

    res.writeHead(404).end('not found');
  } catch (err) {
    console.error(err);
    res.writeHead(500).end(String(err.message || err));
  }
});

function serveAsset(res, sessionId, name) {
  const sess = getSession(sessionId);
  const buf = sess?.assets.get(name);
  if (!buf) { res.writeHead(404).end('no asset'); return; }
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(name)] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  res.end(buf);
}

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', async (ws, req) => {
  const url = new URL(req.url, 'http://x');
  const sessionId = url.searchParams.get('sessionId');
  if (!sessionId) { ws.close(4000, 'sessionId required'); return; }

  const sess = await createSession(sessionId);
  sess.subscribers.add(ws);
  ws.send(JSON.stringify({ type: 'hello', sessionId, previewPath: `/session/${sessionId}/preview` }));
  sess.rebuild().catch(() => {});

  ws.on('message', async (buf) => {
    let msg;
    try { msg = JSON.parse(buf.toString('utf8')); } catch { return; }
    try {
      if (msg.type === 'fs.write') { await sess.writeFile(msg.path, msg.contents); await sess.rebuild(); }
      else if (msg.type === 'fs.delete') { await sess.deleteFile(msg.path); await sess.rebuild(); }
      else if (msg.type === 'rebuild') { await sess.rebuild(); }
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', message: err.message }));
    }
  });

  ws.on('close', () => sess.subscribers.delete(ws));
});

server.listen(PORT, () => {
  console.log(`[esbuild-server] listening http://localhost:${PORT}`);
});