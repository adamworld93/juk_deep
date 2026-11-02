import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import QRCode from 'qrcode';
import { Game } from './game.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR ?? path.join(ROOT, 'data');
const STATIC = [['/shared/', path.join(ROOT, 'shared')], ['/', path.join(ROOT, 'public')]];
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json',
};

function lanUrls() {
  return Object.values(os.networkInterfaces()).flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal)
    .map((n) => `http://${n.address}:${PORT}`);
}

const game = new Game({ saveFile: path.join(DATA_DIR, 'world.json') });

const solos = new Map();
function soloFor(name) {
  const key = String(name ?? '').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 14).toLowerCase();
  if (key.length < 2) return null;
  let g = solos.get(key);
  if (!g) {
    g = new Game({
      mode: 'solo',
      saveFile: path.join(DATA_DIR, 'solo', `${encodeURIComponent(key)}.json`),
      onEmpty: () => setTimeout(() => {
        if (g.conns.size === 0 && solos.get(key) === g) { g.dispose(); solos.delete(key); }
      }, 30_000),
    });
    solos.set(key, g);
  }
  return g;
}

// Lets other sites (e.g. an event platform) fetch or embed the game.
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': '*',
  'cross-origin-resource-policy': 'cross-origin',
};

// Absolute origin of this server as the client sees it (behind tunnels/proxies too).
function originOf(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  const proto = String(req.headers['x-forwarded-proto'] ?? 'http').split(',')[0];
  const host = req.headers['x-forwarded-host'] ?? req.headers.host;
  return `${proto}://${host}`;
}

async function serveStatic(pathname, req, res) {
  for (const [prefix, dir] of STATIC) {
    if (!pathname.startsWith(prefix)) continue;
    let rel;
    try { rel = decodeURIComponent(pathname.slice(prefix.length)) || 'index.html'; } catch { break; } // malformed %-escape
    const file = path.join(dir, path.normalize(rel));
    if (!file.startsWith(dir + path.sep)) break;
    try {
      let body = await fs.readFile(file);
      // A <base> tag keeps every asset + API URL pointing here even if the page is loaded from another origin.
      if (file.endsWith('.html')) body = body.toString().replace('<head>', `<head>\n  <base href="${originOf(req)}/">`);
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
      res.end(body);
      return;
    } catch { break; }
  }
  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('not found');
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => {
    console.error('request failed:', req.url, e);
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('server error');
  });
});

async function handle(req, res) {
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/qr.svg') {
    const text = (url.searchParams.get('text') ?? '').slice(0, 500);
    const svg = await QRCode.toString(text || ' ', { type: 'svg', margin: 1, color: { dark: '#39ff88', light: '#00000000' } });
    res.writeHead(200, { 'content-type': 'image/svg+xml', 'cache-control': 'no-store' });
    res.end(svg);
  } else if (url.pathname === '/api/info') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      publicUrl: process.env.PUBLIC_URL ?? null, lan: lanUrls(),
      online: game.players.size, max: Game.MAX_PLAYERS, storyPlayers: solos.size,
    }));
  } else if (url.pathname === '/healthz') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('ok');
  } else {
    await serveStatic(url.pathname, req, res);
  }
}

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096, perMessageDeflate: { threshold: 1024 } });
wss.on('connection', (ws) => {
  const conn = { ws, player: null, host: false, chunks: new Set(), joined: false };
  let target = null;
  ws.on('message', (data) => {
    let m;
    try { m = JSON.parse(data); } catch { return; }
    if (!m || typeof m !== 'object') return;
    try {
      if (target) return target.onMessage(conn, m);
      if (m.t !== 'join') return;
      const g = m.mode === 'solo' && !m.host ? soloFor(m.name) : game;
      if (!g) return ws.send(JSON.stringify({ t: 'error', text: 'Pick a name (2+ characters).' }));
      g.join(conn, m);
      if (conn.joined) target = g;
      // A failed login (wrong PIN…) must not leave a story world loaded with nobody in it.
      else if (g !== game && g.conns.size === 0) g.onEmpty?.();
    } catch (e) {
      console.error('message failed:', m?.t, e);
    }
  });
  ws.on('close', () => target?.leave(conn));
  ws.on('error', () => {});
});

server.listen(PORT, () => {
  console.log(`DEEP is running:\n  http://localhost:${PORT}`);
  for (const u of lanUrls()) console.log(`  ${u}`);
  console.log(`Big screen: http://localhost:${PORT}/?host`);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    game.save();
    for (const g of solos.values()) g.save();
    console.log('\nWorld saved. Bye!');
    process.exit(0);
  });
}
