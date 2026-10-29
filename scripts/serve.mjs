#!/usr/bin/env node
/**
 * Zero-dependency static server for local development.
 *
 *   node scripts/serve.mjs                 -> http://localhost:8080/
 *   node scripts/serve.mjs --port 3000
 *   node scripts/serve.mjs --base /RetroBuddy/   (mimic a GitHub Pages project site)
 *   node scripts/serve.mjs --host 0.0.0.0        (test from a phone on the same Wi-Fi)
 *
 * Response headers from vercel.json are applied so local behaviour matches Vercel.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const PORT = Number(arg('port', process.env.PORT || 8080));
const HOST = arg('host', process.env.HOST || '127.0.0.1');
let BASE = arg('base', '/');
if (!BASE.startsWith('/')) BASE = `/${BASE}`;
if (!BASE.endsWith('/')) BASE = `${BASE}/`;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

function loadHeaderRules() {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
    return (cfg.headers || []).map((rule) => ({
      re: new RegExp(`^${rule.source.replace(/\//g, '\\/')}$`),
      headers: rule.headers,
    }));
  } catch {
    return [];
  }
}
const headerRules = loadHeaderRules();

function applyHeaders(res, urlPath) {
  for (const rule of headerRules) {
    if (rule.re.test(urlPath)) rule.headers.forEach(({ key, value }) => res.setHeader(key, value));
  }
}

function send(res, status, filePath, urlPath, method) {
  const ext = path.extname(filePath).toLowerCase();
  res.statusCode = status;
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  applyHeaders(res, urlPath);
  const stat = fs.statSync(filePath);
  res.setHeader('Content-Length', stat.size);
  if (method === 'HEAD') return res.end();
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  const started = Date.now();
  res.on('finish', () => {
    console.log(`${res.statusCode} ${req.method} ${req.url} ${Date.now() - started}ms`);
  });

  if (!['GET', 'HEAD'].includes(req.method)) {
    res.statusCode = 405;
    return res.end('Method Not Allowed');
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.statusCode = 400;
    return res.end('Bad Request');
  }

  if (BASE !== '/' && pathname === BASE.slice(0, -1)) {
    res.writeHead(301, { Location: BASE });
    return res.end();
  }
  if (!pathname.startsWith(BASE)) {
    res.statusCode = 404;
    return res.end('Not Found');
  }

  const rel = pathname.slice(BASE.length);
  const urlPath = `/${rel}`;
  let filePath = path.normalize(path.join(ROOT, rel));
  if (!filePath.startsWith(ROOT)) {
    res.statusCode = 403;
    return res.end('Forbidden');
  }
  if (path.relative(ROOT, filePath).split(path.sep).some((p) => p.startsWith('.') && p !== '.')) {
    res.statusCode = 404;
    return res.end('Not Found');
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }
  if (fs.existsSync(filePath)) return send(res, 200, filePath, urlPath, req.method);
  return send(res, 404, path.join(ROOT, '404.html'), urlPath, req.method);
});

server.listen(PORT, HOST, () => {
  const shown = HOST === '0.0.0.0' ? 'localhost' : HOST;
  console.log(`RetroBuddy running at http://${shown}:${PORT}${BASE}`);
  if (HOST === '0.0.0.0') console.log('Listening on all interfaces — open http://<your-computer-ip>:' + PORT + BASE + ' on your phone.');
});
