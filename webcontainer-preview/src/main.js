import { createTerminal } from './terminal.js';
import { createEditor } from './editor.js';
import { renderFileList } from './file-explorer.js';
import { runReactApp } from './webcontainer-runner.js';
import { loadProjectFiles, flattenTree } from './project-files.js';

const term = createTerminal(document.getElementById('terminal'));
const previewEl = document.getElementById('preview');
const filesEl = document.getElementById('files');
const editorEl = document.getElementById('editor');

const tree = loadProjectFiles();
const files = flattenTree(tree); // { path: contents }
const editor = createEditor(editorEl);

let currentPath = null;
let writeFile = null;
const dirty = new Set();

function refreshFileList() {
  renderFileList(filesEl, Object.keys(files).sort(), {
    activePath: currentPath,
    dirty,
    onSelect: openFile,
  });
}

function openFile(path) {
  if (currentPath === path) return;
  currentPath = path;
  editor.setFile(path, files[path]);
  refreshFileList();
}

editor.onChange((path, contents) => {
  files[path] = contents;
  dirty.add(path);
  refreshFileList();
  if (writeFile) writeFile(path, contents).then(() => {
    dirty.delete(path);
    refreshFileList();
  });
});

refreshFileList();
openFile('src/App.jsx');

runReactApp({
  tree,
  onOutput: (chunk) => term.write(chunk),
  onLog: (line) => term.writeln(line),
  onServerReady: (port, url) => {
    term.writeln(`\r\n🎉 服务器就绪: ${url}`);
    previewEl.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.allow = 'cross-origin-isolated';
    previewEl.appendChild(iframe);
  },
  onReady: (api) => { writeFile = api.writeFile; },
}).catch((err) => {
  console.error(err);
  term.writeln(`\r\n❌ 错误: ${err.message}`);
});