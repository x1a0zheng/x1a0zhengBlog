export function connect({ sessionId, onOpen, onClose, onMessage }) {
  let ws;
  let closed = false;
  let queue = [];
  function open() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws?sessionId=${encodeURIComponent(sessionId)}`);
    ws.addEventListener('open', () => { onOpen?.(); for (const m of queue.splice(0)) ws.send(JSON.stringify(m)); });
    ws.addEventListener('message', (ev) => { let m; try { m = JSON.parse(ev.data); } catch { return; } onMessage?.(m); });
    ws.addEventListener('close', () => { onClose?.(); if (!closed) setTimeout(open, 1000); });
    ws.addEventListener('error', () => { try { ws.close(); } catch {} });
  }
  open();
  return {
    send(m) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); else queue.push(m); },
    close() { closed = true; try { ws.close(); } catch {} },
  };
}