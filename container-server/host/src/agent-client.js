import WebSocket from 'ws';

export class AgentClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.readyPromise = null;
    this.subs = new Set();
    this.pending = new Map();       // id -> {resolve, reject}
    this.seq = 0;
  }

  waitReady(timeoutMs = 10000) {
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = new Promise((resolve, reject) => {
      const t0 = Date.now();
      const tryConnect = () => {
        const ws = new WebSocket(this.url);
        ws.on('open', () => {
          this.ws = ws;
          ws.on('message', (buf) => this._onMessage(buf));
          ws.on('close', () => { this.ws = null; });
          resolve();
        });
        ws.on('error', () => {
          if (Date.now() - t0 > timeoutMs) reject(new Error('agent not reachable'));
          else setTimeout(tryConnect, 300);
        });
      };
      tryConnect();
    });
    return this.readyPromise;
  }

  _onMessage(buf) {
    let msg; try { msg = JSON.parse(buf.toString('utf8')); } catch { return; }
    if (msg.id != null && this.pending.has(msg.id)) {
      const { resolve } = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      resolve(msg);
    }
    for (const cb of this.subs) cb(msg);
  }

  send(msg) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(msg));
  }

  request(msg, timeoutMs = 5000) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.send({ ...msg, id });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error('agent request timeout'));
        }
      }, timeoutMs);
    });
  }

  async list() {
    const res = await this.request({ type: 'fs.list' }, 10000);
    return res.files || {};
  }

  subscribe(cb) { this.subs.add(cb); return () => this.subs.delete(cb); }
  close() { try { this.ws?.close(); } catch {} }
}