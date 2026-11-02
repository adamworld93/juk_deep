import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';

const PORT = 20000 + Math.floor(Math.random() * 20000);
const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'deep-server-test-'));
let server;

before(async () => {
  server = spawn('node', ['server/index.js'], {
    env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDirectory, TRUST_PROXY: '1', MAX_CONNECTIONS_PER_ADDRESS: '2' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((resolve) => server.stdout.once('data', resolve));
});

after(() => server.kill());

function getApiInfo(hostHeader) {
  return new Promise((resolve, reject) => {
    http.get({ port: PORT, path: '/api/info', headers: { host: hostHeader } }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve(JSON.parse(body)));
    }).on('error', reject);
  });
}

function connect(forwardedFor) {
  return new WebSocket(`ws://localhost:${PORT}/ws`, { headers: { 'x-forwarded-for': forwardedFor } });
}
const closeOf = (ws) => new Promise((resolve) => ws.once('close', resolve));
const openOf = (ws) => new Promise((resolve) => ws.once('open', resolve));

test('LAN addresses are only given to localhost', async () => {
  assert.deepEqual((await getApiInfo('game.example.com')).lan, []);
  assert.ok(Array.isArray((await getApiInfo(`localhost:${PORT}`)).lan));
});

test('private files are not served', async () => {
  for (const file of ['/data/world.json', '/shared/%2e%2e/server/index.js', '/shared/%2e%2e/package.json']) {
    const response = await fetch(`http://localhost:${PORT}${file}`);
    assert.equal(response.status, 404, file);
  }
});

test('one address is limited to its connection cap; other addresses and the real proxy entry still count', async () => {
  const first = connect('203.0.113.1');
  const second = connect('198.51.100.9, 203.0.113.1');
  await Promise.all([openOf(first), openOf(second)]);
  const refused = connect('203.0.113.1');
  assert.equal(await closeOf(refused), 1013);
  const otherAddress = connect('203.0.113.2');
  await openOf(otherAddress);
  const closed = closeOf(first);
  first.close();
  await closed;
  const afterRelease = connect('203.0.113.1');
  await openOf(afterRelease);
  for (const ws of [second, otherAddress, afterRelease]) ws.close();
});

test('a connection flooding messages is closed', async () => {
  const flooder = connect('203.0.113.3');
  await openOf(flooder);
  const closed = closeOf(flooder);
  for (let i = 0; i < 200; i++) flooder.send('{}');
  assert.equal(await closed, 1008);
});
