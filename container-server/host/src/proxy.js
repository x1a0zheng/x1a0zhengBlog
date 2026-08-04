import httpProxy from 'http-proxy';

export function createProxy() {
  const proxy = httpProxy.createProxyServer({
    ws: true,
    changeOrigin: true,
    xfwd: true,
  });

  proxy.on('error', (err, req, res) => {
    console.error('[proxy] error', err.message);
    try {
      if (res && res.writeHead) { res.writeHead(502).end('bad gateway'); }
      else if (res && res.destroy) res.destroy();
    } catch {}
  });

  return {
    web(req, res, opts)  { proxy.web(req, res, opts); },
    ws(req, socket, head, opts) { proxy.ws(req, socket, head, opts); },
  };
}