import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

export function createTerminal(container) {
  const term = new Terminal({
    convertEol: true,
    cursorBlink: true,
    fontFamily: 'Consolas, "Courier New", monospace',
    fontSize: 12,
    theme: { background: '#1e1e1e', foreground: '#d4d4d4' },
  });
  const fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  term.open(container);
  const doFit = () => { try { fitAddon.fit(); } catch {} };
  requestAnimationFrame(doFit);
  window.addEventListener('resize', doFit);
  new ResizeObserver(doFit).observe(container);
  return term;
}