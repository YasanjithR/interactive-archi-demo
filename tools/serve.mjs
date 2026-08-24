/* Static file server. No dependencies — node's own http and fs only.
   Exists so `npm start` works on any machine with node and nothing else. */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT || process.argv[2] || 8080);

const TYPES = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',   '.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml',  '.mp3':'audio/mpeg',  '.m4a':'audio/mp4',
  '.avif':'image/avif',    '.webp':'image/webp', '.jpg':'image/jpeg',
  '.jpeg':'image/jpeg',    '.png':'image/png',   '.ico':'image/x-icon'
};

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ''));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }

    const info = await stat(file);
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
      'content-length': info.size,
      'cache-control': 'no-cache'
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`\n  Resonance Field  →  http://localhost:${PORT}\n  ctrl-c to stop\n`);
});
