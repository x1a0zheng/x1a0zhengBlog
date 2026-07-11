export function renderFileList(container, paths, { activePath, dirty, onSelect }) {
  const ul = document.createElement('ul');
  for (const path of paths) {
    const li = document.createElement('li');
    li.textContent = path;
    li.title = path;
    if (path === activePath) li.classList.add('active');
    if (dirty.has(path)) li.classList.add('dirty');
    li.addEventListener('click', () => onSelect(path));
    ul.appendChild(li);
  }
  container.innerHTML = '';
  container.appendChild(ul);
}