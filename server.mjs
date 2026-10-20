import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const project = path.dirname(fileURLToPath(import.meta.url));
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml', '.jpg':'image/jpeg', '.png':'image/png', '.woff2':'font/woff2', '.ttf':'font/ttf', '.json':'application/json' };
function json(response,status,data) { response.writeHead(status,{ 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' }); response.end(JSON.stringify(data)); }
async function body(request) {
  if (!request.headers['content-type']?.startsWith('application/json')) throw new Error('Använd JSON för ändringar.');
  let text = '';
  for await (const chunk of request) { text += chunk; if (Buffer.byteLength(text) > 100000) throw new Error('Beställningen är för stor.'); }
  return JSON.parse(text);
}
export function createSiteServer({ backend = null, directory = 'dist' } = {}) {
  const root = path.resolve(project,directory);
  return http.createServer(async (request,response) => {
    const url = new URL(request.url,`http://${request.headers.host}`);
    try {
      if (url.pathname.startsWith('/api/demo/')) {
        if (!backend) { json(response,404,{ message:'Den här förhandsgranskningen använder webbläsardemon.' }); return; }
        if (!['127.0.0.1','localhost'].includes(url.hostname) || !['127.0.0.1','::ffff:127.0.0.1','::1'].includes(request.socket.remoteAddress)) { json(response,403,{ message:'Kassademon är endast tillgänglig lokalt.' }); return; }
        if (request.headers.origin && request.headers.origin !== url.origin) { json(response,403,{ message:'Anropet kom från en annan webbplats.' }); return; }
        const operation = url.pathname.slice('/api/demo/'.length);
        if (request.method === 'GET' && operation === 'runtime') { json(response,200,backend.runtime()); return; }
        if (request.method === 'GET' && operation === 'state') { json(response,200,backend.read()); return; }
        if (request.method !== 'POST') { json(response,405,{ message:'Anropet stöds inte.' }); return; }
        const input = await body(request);
        let result;
        if (operation === 'orders') result = backend.create(input.payload,input.key);
        else if (operation === 'transition') result = backend.transition(input.id,input.status,input.reason);
        else if (operation === 'operation') result = backend.operation(input.locationId,input.patch);
        else if (operation === 'sample') result = backend.sample(input.locationId);
        else { json(response,404,{ message:'Anropet finns inte.' }); return; }
        json(response,200,result); return;
      }
      if (!['GET','HEAD'].includes(request.method)) { json(response,405,{ message:'Förhandsgranskningen tar inte emot riktiga beställningar.' }); return; }
      if (url.pathname === '/_preview') {
        const requestedWidth = Number(url.searchParams.get('width') || 390);
        const width = Math.max(320,Math.min(1600,Number.isFinite(requestedWidth) ? requestedWidth : 390));
        const target = url.searchParams.get('page') === 'demo' ? '/demo/' : '/';
        response.writeHead(200,{ 'Content-Type':'text/html; charset=utf-8' });
        response.end(`<!doctype html><html lang="sv"><meta name="viewport" content="width=device-width"><title>Smashverket · ${width} px</title><style>body{margin:0;min-height:100vh;background:#18392e;display:grid;place-items:start center;padding:20px;box-sizing:border-box}iframe{border:1px solid #f9e6d250;border-radius:9px;width:${width}px;height:900px;background:#f9e6d2;box-shadow:0 10px 60px #0004}body>p{color:#f9e6d2;font:12px Arial;letter-spacing:1px;margin:0 0 15px}</style><body><p>RESPONSIV FÖRHANDSGRANSKNING · ${width} PX</p><iframe src="${target}" title="Restaurangmallen vid ${width} pixlars bredd"></iframe></body></html>`); return;
      }
      const pathname = decodeURIComponent(url.pathname);
      let target = path.resolve(root,`.${pathname}`);
      if (!target.startsWith(root + path.sep) && target !== root) throw new Error('Not found');
      if ((await stat(target)).isDirectory()) target = path.join(target,'index.html');
      if (!(await stat(target)).isFile()) throw new Error('Not found');
      response.writeHead(200,{ 'Content-Type':mime[path.extname(target)] || 'application/octet-stream', 'Cache-Control':'no-cache', 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'strict-origin-when-cross-origin', 'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'self'" });
      let data = await readFile(target);
      if (backend && path.extname(target) === '.html') data = data.toString().replace('name="demo-transport" content="browser"','name="demo-transport" content="pos"');
      response.end(request.method === 'HEAD' ? undefined : data);
    } catch (error) {
      if (url.pathname.startsWith('/api/demo/')) json(response,error.code ? 409 : 400,{ message:error.message || 'Ändringen kunde inte genomföras.', code:error.code || 'INVALID_REQUEST' });
      else { response.writeHead(404,{ 'Content-Type':'text/plain; charset=utf-8' }); response.end('Sidan finns inte.'); }
    }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT || 5187);
  createSiteServer().listen(port,'127.0.0.1',() => console.log(`Smashverket ready. Local: http://127.0.0.1:${port}`));
}
