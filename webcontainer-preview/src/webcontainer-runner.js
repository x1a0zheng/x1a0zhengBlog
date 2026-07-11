import { WebContainer } from '@webcontainer/api';

let bootPromise;
function bootOnce() {
  if (!bootPromise) bootPromise = WebContainer.boot();
  return bootPromise;
}

export async function runReactApp({ tree, onOutput, onLog, onServerReady, onReady }) {
  onLog('🔄 正在启动 WebContainer...');
  const webcontainer = await bootOnce();
  onLog('✅ WebContainer 已启动');

  onLog('📂 正在挂载项目文件...');
  await webcontainer.mount(tree);
  onLog('✅ 文件挂载完成');

  const writeFile = async (path, contents) => {
    await webcontainer.fs.writeFile(path, contents);
  };
  onReady?.({ writeFile, webcontainer });

  onLog('📦 正在安装依赖 (npm install)...');
  const install = await webcontainer.spawn('npm', ['install']);
  install.output.pipeTo(new WritableStream({ write: onOutput }));
  const code = await install.exit;
  if (code !== 0) throw new Error(`npm install 退出码 ${code}`);
  onLog('✅ 依赖安装完成');

  onLog('🔥 正在启动 Vite 开发服务器...');
  const dev = await webcontainer.spawn('npm', ['run', 'dev']);
  dev.output.pipeTo(new WritableStream({ write: onOutput }));

  webcontainer.on('server-ready', onServerReady);
  return webcontainer;
}