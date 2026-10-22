// Spawns N fake miners that dig around. Usage: node scripts/loadtest.js [miners] [ws-url]
import WebSocket from 'ws';

const N = Number(process.argv[2] ?? 30);
const URL = process.argv[3] ?? 'ws://localhost:3000/ws';
const DURATION = Number(process.env.DURATION ?? 20) * 1000;
const DIRS = ['L', 'R', 'D', 'D', 'D', 'U'];
let bytes = 0;

for (let i = 0; i < N; i++) {
  const ws = new WebSocket(URL);
  ws.on('open', () => {
    ws.send(JSON.stringify({ t: 'join', name: `bot${i}`, pin: '0000' }));
    // Walk off the town platform first, then wander.
    const side = i % 2 ? 'L' : 'R';
    ws.send(JSON.stringify({ t: 'in', d: side }));
    setTimeout(() => setInterval(() => ws.send(JSON.stringify({ t: 'in', d: DIRS[Math.floor(Math.random() * DIRS.length)] })), 1500), 4000);
  });
  ws.on('message', (d) => { bytes += d.length; });
}
const t0 = Date.now();
const timer = setInterval(() => {
  const s = (Date.now() - t0) / 1000;
  console.log(`${s.toFixed(0)}s  KB/s per client=${(bytes / s / N / 1024).toFixed(1)}`);
}, 5000);
setTimeout(() => { clearInterval(timer); process.exit(0); }, DURATION);
