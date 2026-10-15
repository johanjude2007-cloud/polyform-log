// Local production log server: the shared API (server/core.mjs) on the JSON file store
// (or Upstash Redis when its credentials are set), and the web app (Vite middleware in
// development, the built files in production). On Vercel, api/ serves the same API instead.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApi, httpError, parseJson } from './core.mjs';
import { openStore } from './store.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadEnv(path.join(ROOT, '.env'));
const PORT = Number(process.env.PORT || 3170);
const PASSWORD = process.env.APP_PASSWORD || '';
const DB_FILE = path.join(ROOT, 'data', 'db.json');
const PROD = process.env.NODE_ENV === 'production';

if (!PASSWORD) console.warn('APP_PASSWORD is not set; copy .env.example to .env and set one.');

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

// ------------------------------------------------------------ api
const store = openStore(process.env, { file: DB_FILE });
const api = createApi({ password: PASSWORD, secret: process.env.SESSION_SECRET, secure: PROD, store });
console.log(`Store: ${store.name}`);

function send(res, status, data, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(data));
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(httpError(413, 'Too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(parseJson(Buffer.concat(chunks).toString('utf8'))); } catch (err) { reject(err); } });
    req.on('error', reject);
  });
}
async function serveApi(req, res, url) {
  const out = await api({
    method: req.method,
    path: url.pathname,
    query: url.searchParams,
    header: (name) => req.headers[name],
    ip: req.socket.remoteAddress || '',
    readBody: (limit) => readBody(req, limit),
  });
  send(res, out.status, out.body, out.headers);
}

// ------------------------------------------------------------ web app
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
};
let vite;
if (!PROD) {
  const { createServer } = await import('vite');
  vite = await createServer({ root: ROOT, server: { middlewareMode: true, hmr: { port: PORT + 1000 } }, appType: 'spa' });
}
const DIST = path.join(ROOT, 'dist');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
function serveStatic(req, res, url) {
  let file = path.join(DIST, path.normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, ''));
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  const ext = path.extname(file);
  res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': file.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache', ...SECURITY_HEADERS });
  fs.createReadStream(file).pipe(res);
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://local');
  try {
    if (url.pathname.startsWith('/api/')) return await serveApi(req, res, url);
    if (vite) { for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v); return vite.middlewares(req, res); }
    serveStatic(req, res, url);
  } catch (err) {
    if (!res.headersSent) send(res, err.status || 500, { error: err.status ? err.message : 'Server error.' });
    if (!err.status) console.error(err);
  }
}).listen(PORT, () => console.log(`Polyform production log on http://localhost:${PORT}`));
