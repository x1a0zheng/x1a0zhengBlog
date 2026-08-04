import Docker from 'dockerode';

// 探测本机 Docker 是否可用,返回 { ok, version?, error? }
export async function checkDocker() {
  const docker = new Docker();
  try {
    const info = await docker.version();
    console.log('Docker version:', info.Version, 'api:', info.ApiVersion, 'os:', info.Os);
    return { ok: true, version: info.Version, apiVersion: info.ApiVersion, os: info.Os };
  } catch (err) {
    console.log('Docker check failed:', err);
    return { ok: false, error: err };
  }
}

// 检查 wc-agent:latest 镜像是否存在
export async function hasImage(name = 'wc-agent:latest') {
  const docker = new Docker();
  try {
    await docker.getImage(name).inspect();
    return true;
  } catch {
    return false;
  }
}

export function friendlyError(err) {
  const code = String(err?.code || '');
  const msg = String(err?.message || err || '');
  const isWin = process.platform === 'win32';
  if (code === 'ENOENT' || msg.includes('docker_engine') || msg.includes('/var/run/docker.sock')) {
    return isWin
      ? [
          'Docker Desktop 未启动或未安装。',
          '- 若已安装:在开始菜单启动 "Docker Desktop",等托盘图标变绿后重试。',
          '- 若未安装:https://www.docker.com/products/docker-desktop/',
          '- 或用 WSL2 里的 docker,设 DOCKER_HOST=tcp://localhost:2375(需在 Docker Desktop 中开启 "Expose daemon on tcp://...")。',
        ].join('\n')
      : [
          'Docker daemon 无法连接。',
          '- 检查 dockerd 是否运行:`systemctl status docker`',
          '- 你的用户是否在 docker 组:`groups` 里应有 docker',
        ].join('\n');
  }
  if (code === 'EACCES' || msg.includes('EACCES') || msg.includes('permission denied')) {
    return [
      'Docker socket 权限不足 (EACCES /var/run/docker.sock)。',
      '当前用户没有 docker 组权限,执行:',
      '  sudo usermod -aG docker $(whoami)',
      '然后让权限生效(任选其一):',
      '  1) newgrp docker           # 当前 shell 立即生效',
      '  2) wsl --shutdown          # 在 Windows PowerShell 里执行,重开 WSL',
      '  3) 关闭再打开终端窗口',
      '验证:  docker version  应返回 Server 版本;  groups  中含 docker',
    ].join('\n');
  }
  return `Docker 探测失败: ${msg}`;
}