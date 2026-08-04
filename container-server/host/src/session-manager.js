import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import Docker from 'dockerode';
import { AgentClient } from './agent-client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const WORKSPACES = path.join(ROOT, 'workspaces');
const IMAGE = process.env.AGENT_IMAGE || 'wc-agent:latest';

const docker = new Docker();  // 走本机默认 socket
const sessions = new Map();

export function listSessions() {
  return [...sessions.values()].map(s => ({
    id: s.id, containerId: s.containerId, agentPort: s.agentPort, vitePort: s.vitePort,
  }));
}

export async function getOrCreateSession(id) {
  const existing = sessions.get(id);
  if (existing) return existing.ready;

  const rec = { id };
  rec.ready = spinUp(rec).then((s) => { Object.assign(rec, s); return rec; });
  sessions.set(id, rec);
  return rec.ready;
}

async function spinUp(rec) {
  const wsDir = path.join(WORKSPACES, sanitize(rec.id));
  await fs.mkdir(wsDir, { recursive: true });

  console.log(`[session ${rec.id}] creating container`);
  const container = await docker.createContainer({
    Image: IMAGE,
    name: `wc-${sanitize(rec.id)}`,
    Tty: false,
    ExposedPorts: { '8000/tcp': {}, '5173/tcp': {} },
    HostConfig: {
      // 随机映射到宿主端口
      PortBindings: { '8000/tcp': [{ HostPort: '' }], '5173/tcp': [{ HostPort: '' }] },
      // 持久化 workspace: 主机目录挂进容器
      Binds: [`${wsDir}:/workspace`],
      AutoRemove: true,
      // 简单资源配额
      Memory: 512 * 1024 * 1024,
      NanoCpus: 1_000_000_000, // 1 core
    },
  });

  await container.start();
  const info = await container.inspect();
  const ports = info.NetworkSettings.Ports;
  const agentPort = Number(ports['8000/tcp']?.[0]?.HostPort);
  const vitePort  = Number(ports['5173/tcp']?.[0]?.HostPort);
  if (!agentPort || !vitePort) throw new Error('port allocation failed');

  console.log(`[session ${rec.id}] container=${info.Id.slice(0,12)} agent=${agentPort} vite=${vitePort}`);

  // 等 agent WS 就绪
  const agent = new AgentClient(`ws://127.0.0.1:${agentPort}/ws`);
  await agent.waitReady(15000);

  // 等 Vite 端口就绪
  await waitForHttp(`http://127.0.0.1:${vitePort}/`, 20000);

  return {
    id: rec.id,
    containerId: info.Id,
    container,
    workspaceDir: wsDir,
    agentPort, vitePort,
    agent,
    agentUrl: `ws://127.0.0.1:${agentPort}/ws`,
    viteUrl:  `http://127.0.0.1:${vitePort}`,
  };
}

export async function stopSession(id) {
  const rec = sessions.get(id);
  if (!rec) return;
  sessions.delete(id);
  try {
    const s = await rec.ready;
    s.agent.close();
    await s.container.stop({ t: 2 }).catch(() => {});
  } catch {}
}

function sanitize(id) { return id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || 'anon'; }

async function waitForHttp(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.status < 500) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`timeout waiting for ${url}`);
}