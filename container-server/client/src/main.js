import { createEditor } from './editor.js';
import { renderFileList } from './file-explorer.js';
import { connect } from './ws-client.js';

const filesEl = document.getElementById('files');
const editorEl = document.getElementById('editor');
const previewEl = document.getElementById('preview');
const logEl = document.getElementById('log');
const statusEl = document.getElementById('status');

const editor = createEditor(editorEl);

const sessionId = localStorage.getItem('sessionId') || (() => {
  const id = 'sess-' + Math.random().toString(36).slice(2, 10);
  localStorage.setItem('sessionId', id);
  return id;
})();

const files = {};
let currentPath = null;
let previewFrame = null;

function log(text, cls = '') {
  const line = document.createElement('div');
  line.className = 'log-line ' + cls;
  line.textContent = text;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

function refreshFiles() {
  renderFileList(filesEl, Object.keys(files).sort(), {
    activePath: currentPath, onSelect: openFile,
  });
}
function openFile(p) {
  if (currentPath === p) return;
  currentPath = p;
  editor.setFile(p, files[p]);
  refreshFiles();
}

async function loadInitialFiles() {
  const res = await fetch(`/api/session/${sessionId}/files`);
  if (!res.ok) throw new Error(`load files failed: ${res.status}`);
  const data = await res.json();
  Object.assign(files, data.files);
  refreshFiles();
  const entry = files['src/App.jsx'] ? 'src/App.jsx' : Object.keys(files)[0];
  if (entry) openFile(entry);
}

function ensurePreview(previewPath) {
  if (previewFrame) return;
  previewEl.innerHTML = '';
  previewFrame = document.createElement('iframe');
  previewFrame.src = previewPath;
  previewEl.appendChild(previewFrame);
}

const ws = connect({
  sessionId,
  onOpen:  () => { statusEl.textContent = '已连接'; statusEl.className = 'status'; log('WS connected', 'ok'); },
  onClose: () => { statusEl.textContent = '已断开,重连中…'; statusEl.className = 'status err'; },
  onMessage: (msg) => {
    if (msg.type === 'hello') {
      log(`容器就绪:${msg.previewPath}`, 'ok');
      ensurePreview(msg.previewPath);
      loadInitialFiles().catch((err) => log('加载文件失败:' + err.message, 'err'));
    } else if (msg.type === 'log') {
      log((msg.stream === 'stderr' ? '! ' : '  ') + msg.chunk.replace(/\n+$/, ''));
    } else if (msg.type === 'ack') {
      // 写入确认,当前不显示
    } else if (msg.type === 'error') {
      log('agent error: ' + msg.message, 'err');
    }
  },
});

editor.onChange((path, contents) => {
  files[path] = contents;
  ws.send({ type: 'fs.write', path, contents });
  // Vite 自己会通过 HMR ws 通知预览 iframe 更新,无需前端手动 reload
});