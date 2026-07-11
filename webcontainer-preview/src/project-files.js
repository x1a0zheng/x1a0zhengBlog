const raw = import.meta.glob('./project-files/**/*', {
  eager: true,
  query: '?raw',
  import: 'default',
});

const PREFIX = './project-files/';

function relPath(absPath) {
  return absPath.slice(absPath.indexOf(PREFIX) + PREFIX.length);
}

export function loadProjectFiles() {
  const tree = {};
  for (const [absPath, contents] of Object.entries(raw)) {
    const parts = relPath(absPath).split('/');
    let cursor = tree;
    for (let i = 0; i < parts.length - 1; i++) {
      const dir = parts[i];
      if (!cursor[dir]) cursor[dir] = { directory: {} };
      cursor = cursor[dir].directory;
    }
    cursor[parts[parts.length - 1]] = { file: { contents } };
  }
  return tree;
}

export function flattenTree(tree, prefix = '') {
  const out = {};
  for (const [name, node] of Object.entries(tree)) {
    const path = prefix ? `${prefix}/${name}` : name;
    if (node.file) out[path] = node.file.contents;
    else if (node.directory) Object.assign(out, flattenTree(node.directory, path));
  }
  return out;
}