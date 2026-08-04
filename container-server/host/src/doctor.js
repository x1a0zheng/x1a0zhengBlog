#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import Docker from 'dockerode';
import { checkDocker, hasImage, friendlyError } from './docker-check.js';

const pexec = promisify(execFile);
const IMAGE = process.env.AGENT_IMAGE || 'wc-agent:latest';

console.log('=== container-server doctor ===\n');
console.log('platform:', process.platform, 'node:', process.version);
if (process.platform === 'win32') console.log('docker pipe expected: \\\\.\\pipe\\docker_engine');
if (process.env.DOCKER_HOST) console.log('DOCKER_HOST=', process.env.DOCKER_HOST);
console.log('');

const st = await checkDocker();
if (st.ok) {
  console.log(`✅ Docker daemon 可用: ${st.version} (${st.os}, api ${st.apiVersion})`);
} else {
  console.log('❌ Docker daemon 不可用');
  console.log(friendlyError(st.error));

  if (process.platform === 'win32') {
    // 尝试透过 wsl 检测 Linux 侧的 docker
    const wsl = await tryWsl();
    console.log('\n--- WSL 探测 ---');
    if (wsl.available) {
      console.log(`✅ WSL 里有 docker: ${wsl.version}`);
      console.log('看起来 daemon 跑在 WSL 里但 Windows 侧连不上。二选一:');
      console.log('  A) 直接进 WSL 跑:  wsl -e bash -lc "cd /mnt/c/${cwdFromWsl()} && npm run doctor"');
      console.log('  B) 让 WSL dockerd 也监听 tcp://127.0.0.1:2375, 然后:  set DOCKER_HOST=tcp://localhost:2375');
      console.log('     (具体步骤见 README 或问 codex)');
    } else if (wsl.reason) {
      console.log('ℹ️  WSL 探测:', wsl.reason);
    }
  }

  process.exit(1);
}

const has = await hasImage(IMAGE);
console.log(has ? `✅ 镜像 ${IMAGE} 已存在` : `⚠️  镜像 ${IMAGE} 不存在,请先运行: npm run build:image`);

try {
  const containers = await new Docker().listContainers({ filters: { name: ['wc-'] } });
  console.log(`ℹ️  当前运行中的沙盒容器: ${containers.length}`);
  for (const c of containers) console.log('   -', c.Names.join(','), c.Status);
} catch {}

console.log('\n若上述均 ✅,可以 `npm run dev` 启动。');

async function tryWsl() {
  const { spawn } = await import('node:child_process');
  return await new Promise((resolve) => {
    const p = spawn('wsl.exe', ['-e', 'docker', 'version', '--format', '{{.Server.Version}}']);
    let out = '', err = '';
    p.stdout.on('data', (b) => out += b.toString('utf8'));
    p.stderr.on('data', (b) => err += b.toString('utf8'));
    p.on('error', (e) => resolve({ available: false, reason: e.code === 'ENOENT' ? '未装 WSL' : String(e.message) }));
    p.on('close', (code) => {
      if (code === 0 && out.trim()) return resolve({ available: true, version: out.trim() });
      const text = (err || out || '').trim().split(/\r?\n/).filter(Boolean).join(' | ');
      if (/permission denied/i.test(text)) {
        resolve({ available: false, reason: 'WSL 里有 docker 但当前用户没权限:\n     ' + text + '\n     修复:  wsl -e bash -lc \"sudo usermod -aG docker \\" 然后 wsl --shutdown 再重开' });
      } else {
        resolve({ available: false, reason: 'WSL 里也访问不到 docker: ' + text });
      }
    });
  });
}
async function _unused() {
  try { throw new Error(); } catch (err) {
    if (err.code === 'ENOENT') return { available: false, reason: '未装 WSL' };
    const errText = String(err.stderr || err.message);
    const first = errText.trim().split('\n')[0];
    if (/permission denied/i.test(errText)) {
      return { available: false, reason: 'WSL 里有 docker 但当前用户没权限:\n     ' + first + '\n     修复:  wsl -e bash -lc "sudo usermod -aG docker $(whoami)" 后重启 WSL(`wsl --shutdown`)'};
    }
    return { available: false, reason: 'WSL 里也访问不到 docker: ' + first };
  }
}
function cwdFromWsl() {
  // "C:\\Users\\A\\..." → "Users/A/..."
  return process.cwd().replace(/^[A-Za-z]:\\?/, '').replace(/\\/g, '/');
}