import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mht': 'multipart/related',
  '.mhtml': 'multipart/related',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

function resolveRequestPath(root, requestUrl) {
  const safeUrl = decodeURIComponent(String(requestUrl || '/').split('?')[0] || '/');
  const relativePath = safeUrl === '/' || safeUrl === ''
    ? 'index.html'
    : safeUrl.replace(/^\/+/u, '');
  const filePath = path.resolve(root, relativePath);
  const relativeToRoot = path.relative(root, filePath);

  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    return null;
  }

  return filePath;
}

export function createStaticServer(root, options = {}) {
  const servedRoot = path.resolve(root);
  const mimeTypes = { ...DEFAULT_MIME_TYPES, ...(options.mimeTypes || {}) };

  return http.createServer((req, res) => {
    try {
      const filePath = resolveRequestPath(servedRoot, req && req.url);
      if (!filePath) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    } catch (err) {
      res.writeHead(500);
      res.end(String(err));
    }
  });
}

export async function closeServer(server) {
  if (!server || !server.listening) return;
  await new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export async function startStaticServer(root, options = {}) {
  const host = options.host || '127.0.0.1';
  const port = Number.isInteger(options.port) ? options.port : 0;
  const server = createStaticServer(root, options);

  await new Promise((resolve, reject) => {
    server.listen(port, host, resolve);
    server.on('error', reject);
  });

  const address = server.address();
  const resolvedPort = address && typeof address === 'object' ? address.port : port;

  return {
    server,
    host,
    port: resolvedPort,
    baseUrl: `http://${host}:${resolvedPort}`,
    close: async () => closeServer(server)
  };
}