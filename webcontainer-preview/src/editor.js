import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import 'monaco-editor/esm/vs/language/json/monaco.contribution';
import 'monaco-editor/esm/vs/language/css/monaco.contribution';
import 'monaco-editor/esm/vs/language/html/monaco.contribution';
import 'monaco-editor/esm/vs/language/typescript/monaco.contribution';
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

function languageOf(path) {
  if (path.endsWith('.json')) return 'json';
  if (path.endsWith('.html')) return 'html';
  if (path.endsWith('.css')) return 'css';
  // markdown contribution isn't bundled by default here — fall back to plaintext
  if (path.endsWith('.md')) return 'plaintext';
  if (/\.(t|j)sx?$/.test(path)) return 'javascript';
  return 'plaintext';
}

export function createEditor(container) {
  const editor = monaco.editor.create(container, {
    value: '',
    language: 'plaintext',
    theme: 'vs-dark',
    automaticLayout: true,
    fontSize: 13,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    tabSize: 2,
  });

  let currentPath = null;
  let onChangeCb = () => {};
  let debounceTimer = null;

  editor.onDidChangeModelContent(() => {
    if (!currentPath) return;
    clearTimeout(debounceTimer);
    const path = currentPath;
    debounceTimer = setTimeout(() => {
      onChangeCb(path, editor.getValue());
    }, 300);
  });

  return {
    setFile(path, contents) {
      currentPath = path;
      const lang = languageOf(path);
      const model = monaco.editor.createModel(contents, lang);
      const old = editor.getModel();
      editor.setModel(model);
      if (old) old.dispose();
    },
    onChange(cb) { onChangeCb = cb; },
  };
}