import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const port = Number(process.env.PORT || 5187);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.json': 'application/json' };
const server = http.createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { 'Content-Type': 'application/json', Allow: 'GET, HEAD' });
    response.end(JSON.stringify({ error: 'This preview server has no live ordering backend. Keep demo mode enabled.' }));
    return;
  }
  try {
    const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
    if (pathname === '/_preview') {
      const requestedWidth = Number(new URL(request.url, `http://${request.headers.host}`).searchParams.get('width') || 390);
      const width = Math.max(320, Math.min(1600, Number.isFinite(requestedWidth) ? requestedWidth : 390));
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(`<!doctype html><html lang="sv"><meta name="viewport" content="width=device-width"><title>Smashverket · responsiv förhandsgranskning</title><style>body{margin:0;min-height:100vh;background:#18392e;display:grid;place-items:start center;padding:20px;box-sizing:border-box}iframe{border:1px solid #f9e6d250;border-radius:9px;width:${width}px;height:900px;background:#f9e6d2;box-shadow:0 10px 60px #0004}body>p{color:#f9e6d2;font:12px Arial;letter-spacing:1px;margin:0 0 15px}</style><body><p>RESPONSIV FÖRHANDSGRANSKNING · ${width} PX</p><iframe src="/" title="Restaurangmallen vid ${width} pixlars bredd"></iframe></body></html>`);
      return;
    }
    const target = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!target.startsWith(root + path.sep) || !(await stat(target)).isFile()) throw new Error('Not found');
    response.writeHead(200, {
      'Content-Type': mime[path.extname(target)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'self'",
    });
    response.end(request.method === 'HEAD' ? undefined : await readFile(target));
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Sidan finns inte.');
  }
});
server.listen(port, '127.0.0.1', () => console.log(`Smashverket ready. Local: http://127.0.0.1:${port}`));
