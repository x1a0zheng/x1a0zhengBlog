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
const dirty = new Set();
let currentPath = null;
let previewFrame = null;
let lastAssets = null;

function log(text, cls = '') {
  const line = document.createElement('div');
  line.className = 'log-line ' + cls;
  line.textContent = text;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

function refreshFiles() {
  renderFileList(filesEl, Object.keys(files).sort(), {
    activePath: currentPath, dirty, onSelect: openFile,
  });
}

function openFile(p) {
  if (currentPath === p) return;
  currentPath = p;
  editor.setFile(p, files[p]);
  refreshFiles();
}

async function loadInitialFiles() {
  const res = await fetch(`/session/${sessionId}/files`);
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

function reloadPreview() {
  if (previewFrame?.contentWindow) {
    previewFrame.contentWindow.postMessage({ type: 'reload', assets: lastAssets }, '*');
  }
}

const ws = connect({
  sessionId,
  onOpen: () => { statusEl.textContent = '已连接'; statusEl.className = 'status'; },
  onClose: () => { statusEl.textContent = '已断开,重连中…'; statusEl.className = 'status err'; },
  onMessage: (msg) => {
    if (msg.type === 'hello') ensurePreview(msg.previewPath);
    else if (msg.type === 'build.done') {
      lastAssets = msg.assets;
      log(`✅ build #${msg.version} (${msg.elapsedMs}ms) [${(msg.assets || []).join(', ')}]`, 'ok');
      for (const w of msg.warnings || []) log(`  warn: ${w.text}`, 'warn');
      reloadPreview();
    } else if (msg.type === 'build.error') {
      const first = msg.errors?.[0]?.text || 'unknown';
      log(`❌ build failed (${msg.elapsedMs}ms): ${first}`, 'err');
      for (const e of msg.errors || []) {
        const loc = e.location ? ` @${e.location.file}:${e.location.line}:${e.location.column}` : '';
        log(`  ${e.text}${loc}`, 'err');
      }
      if (previewFrame?.contentWindow) {
        const text = (msg.errors || []).map(e => e.text).join('\n\n');
        previewFrame.contentWindow.postMessage({ type: 'error', text }, '*');
      }
    } else if (msg.type === 'error') {
      log(`server error: ${msg.message}`, 'err');
    }
  },
});

editor.onChange((path, contents) => {
  files[path] = contents;
  dirty.add(path);
  refreshFiles();
  ws.send({ type: 'fs.write', path, contents });
  dirty.delete(path);
  refreshFiles();
});

loadInitialFiles().catch((err) => log(`加载文件失败: ${err.message}`, 'err'));