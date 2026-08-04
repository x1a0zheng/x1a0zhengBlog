export function renderFileList(container, paths, { activePath, onSelect }) {
  const ul = document.createElement('ul');
  for (const p of paths) {
    const li = document.createElement('li');
    li.textContent = p;
    li.title = p;
    if (p === activePath) li.classList.add('active');
    li.addEventListener('click', () => onSelect(p));
    ul.appendChild(li);
  }
  container.innerHTML = '';
  container.appendChild(ul);
}