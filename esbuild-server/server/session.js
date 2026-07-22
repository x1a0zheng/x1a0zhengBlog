import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SESSIONS_DIR = path.join(ROOT, 'sessions');
const TEMPLATE_DIR = path.join(ROOT, 'template');
const SHARED_NODE_MODULES = path.join(ROOT, 'node_modules');

const sessions = new Map();

export function getSession(id) { return sessions.get(id); }

export async function createSession(id) {
  const existing = sessions.get(id);
  if (existing) return existing;

  const dir = path.join(SESSIONS_DIR, sanitize(id));
  await ensureFromTemplate(dir);

  const sess = {
    id,
    dir,
    subscribers: new Set(),
    assets: new Map(),       // name -> Buffer  (bundle.js / bundle.css / ...)
    version: 0,
    ctx: null,
    building: null,
  };

  sess.ctx = await esbuild.context({
    entryPoints: [path.join(dir, 'src/main.jsx')],
    entryNames: 'bundle',           // 生成 bundle.js / bundle.css
    bundle: true,
    format: 'esm',
    platform: 'browser',
    jsx: 'automatic',
    loader: {
      '.js': 'jsx',
      '.jsx': 'jsx',
      '.png': 'dataurl',
      '.jpg': 'dataurl',
      '.gif': 'dataurl',
      '.svg': 'dataurl',
      '.woff': 'dataurl',
      '.woff2': 'dataurl',
      '.ttf': 'dataurl',
    },
    sourcemap: 'inline',
    write: false,
    outdir: 'dist',                 // 相对 absWorkingDir,仅用于命名
    absWorkingDir: dir,
    nodePaths: [SHARED_NODE_MODULES],
    logLevel: 'silent',
    define: { 'process.env.NODE_ENV': '"development"' },
  });

  sess.writeFile = async (relPath, contents) => {
    const abs = safeJoin(dir, relPath);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, contents);
  };
  sess.deleteFile = async (relPath) => {
    const abs = safeJoin(dir, relPath);
    await fs.rm(abs, { force: true });
  };
  sess.rebuild = () => {
    if (sess.building) return sess.building.then(() => sess.rebuild());
    sess.building = doRebuild(sess).finally(() => { sess.building = null; });
    return sess.building;
  };
  sess.broadcast = (msg) => {
    const data = JSON.stringify(msg);
    for (const ws of sess.subscribers) {
      if (ws.readyState === 1) ws.send(data);
    }
  };

  sessions.set(id, sess);
  return sess;
}

async function doRebuild(sess) {
  const t0 = Date.now();
  try {
    const result = await sess.ctx.rebuild();
    const files = result.outputFiles || [];
    if (files.length === 0) throw new Error('no output files');
    sess.assets.clear();
    const produced = [];
    for (const f of files) {
      const name = path.basename(f.path);
      sess.assets.set(name, Buffer.from(f.contents));
      produced.push(name);
    }
    sess.version++;
    sess.broadcast({
      type: 'build.done',
      version: sess.version,
      elapsedMs: Date.now() - t0,
      assets: produced,
      warnings: (result.warnings || []).map(fmtMsg),
    });
  } catch (err) {
    sess.broadcast({
      type: 'build.error',
      elapsedMs: Date.now() - t0,
      errors: (err.errors || [{ text: err.message }]).map(fmtMsg),
    });
  }
}

function fmtMsg(m) {
  return {
    text: m.text,
    location: m.location ? { file: m.location.file, line: m.location.line, column: m.location.column } : null,
  };
}

async function ensureFromTemplate(dir) {
  try { await fs.access(dir); return; } catch {}
  await copyDir(TEMPLATE_DIR, dir);
}

async function copyDir(src, dst) {
  await fs.mkdir(dst, { recursive: true });
  for (const entry of await fs.readdir(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) await copyDir(s, d);
    else await fs.copyFile(s, d);
  }
}

export async function listPaths(sess) {
  const out = [];
  async function walk(dir, rel) {
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const abs = path.join(dir, e.name);
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) await walk(abs, r);
      else out.push(r);
    }
  }
  await walk(sess.dir, '');
  return out.sort();
}

export async function readFile(sess, relPath) {
  return fs.readFile(safeJoin(sess.dir, relPath), 'utf8');
}

function sanitize(id) { return id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) || 'anon'; }
function safeJoin(base, rel) {
  const abs = path.resolve(base, rel);
  if (!abs.startsWith(base + path.sep) && abs !== base) throw new Error('path escape');
  return abs;
}