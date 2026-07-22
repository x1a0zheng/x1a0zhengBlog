export function connect({ sessionId, onOpen, onClose, onMessage }) {
  let ws;
  let closed = false;
  let queue = [];

  function open() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws?sessionId=${encodeURIComponent(sessionId)}`);
    ws.addEventListener('open', () => {
      onOpen?.();
      for (const m of queue.splice(0)) ws.send(JSON.stringify(m));
    });
    ws.addEventListener('message', (ev) => {
      let msg; try { msg = JSON.parse(ev.data); } catch { return; }
      onMessage?.(msg);
    });
    ws.addEventListener('close', () => {
      onClose?.();
      if (!closed) setTimeout(open, 1000);
    });
    ws.addEventListener('error', () => { try { ws.close(); } catch {} });
  }

  open();

  return {
    send(msg) {
      if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
      else queue.push(msg);
    },
    close() { closed = true; try { ws.close(); } catch {} },
  };
}