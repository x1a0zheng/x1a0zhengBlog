import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

self.MonacoEnvironment = {
  getWorker(_id, label) {
    if (label === 'json') return new JsonWorker();
    if (label === 'css' || label === 'scss' || label === 'less') return new CssWorker();
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new HtmlWorker();
    if (label === 'typescript' || label === 'javascript') return new TsWorker();
    return new EditorWorker();
  },
};

function languageOf(p) {
  if (p.endsWith('.json')) return 'json';
  if (p.endsWith('.html')) return 'html';
  if (p.endsWith('.css'))  return 'css';
  if (/\.(t|j)sx?$/.test(p)) return 'javascript';
  return 'plaintext';
}

export function createEditor(container) {
  const editor = monaco.editor.create(container, {
    value: '', language: 'plaintext', theme: 'vs-dark',
    automaticLayout: true, fontSize: 13, minimap: { enabled: false },
    scrollBeyondLastLine: false, tabSize: 2,
  });
  let currentPath = null;
  let onChangeCb = () => {};
  let t = null;
  editor.onDidChangeModelContent(() => {
    if (!currentPath) return;
    clearTimeout(t);
    const p = currentPath;
    t = setTimeout(() => onChangeCb(p, editor.getValue()), 250);
  });
  return {
    setFile(path, contents) {
      currentPath = path;
      const model = monaco.editor.createModel(contents, languageOf(path));
      const old = editor.getModel();
      editor.setModel(model);
      if (old) old.dispose();
    },
    onChange(cb) { onChangeCb = cb; },
  };
}