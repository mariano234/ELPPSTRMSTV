import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, relative, resolve } from 'node:path';

const root = resolve('dist');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

createServer(async (request, response) => {
  try {
    const { pathname } = new URL(request.url, 'http://127.0.0.1');
    const path = pathname.startsWith('/assets/') || extname(pathname) ? pathname : '/index.html';
    const filename = resolve(root, `.${decodeURIComponent(path)}`);
    const fromRoot = relative(root, filename);
    if (fromRoot.startsWith('..') || fromRoot.includes(':')) throw new Error('Outside test fixtures');
    const bytes = await readFile(filename);
    response.writeHead(200, { 'Content-Type': mime[extname(filename)] || 'application/octet-stream' });
    response.end(bytes);
  } catch { response.writeHead(404).end(); }
}).listen(8788, '127.0.0.1');
