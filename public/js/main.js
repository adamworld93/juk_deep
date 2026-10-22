// DEEP client: connection, world state, input, game loop.
import * as C from '/shared/config.js';
import { AsciiView } from './view.js';
import { HostView } from './host.js';
import { UI, statsOf, esc } from './ui.js';
import { Dialog } from './dialog.js';
import { initAudio, setMood, sfx, toggleMute, isMuted, LAYER_MOODS } from './audio.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
// The game server's address. Comes from the <base> tag, so it's right even when the page is embedded on another site.
const BASE = new URL(document.baseURI);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
const canvas = $('game');
const touch = matchMedia('(pointer: coarse)').matches;
if (touch) document.body.classList.add('touch');

const S = {
  ws: null, joined: false, host: false, you: null, name: '', mode: 'world', npcs: [],
  tiles: new Uint8Array(C.W * C.H), loaded: new Uint8Array(Math.ceil(C.H / C.CHUNK)), explored: new Uint8Array(C.W * C.H),
  players: new Map(), me: null, worm: null, meteor: null, lamp: 4,
  cam: { x: C.W / 2, y: C.SURFACE }, fx: [], pops: [],
};
let view = null;
const ui = new UI({ send, use });
const dialog = new Dialog(send);

// ---------- menu ----------

$('name').value = store.get('deep-name') ?? '';
$('pin').value = store.get('deep-pin') ?? '';
$('play-solo').onclick = () => start(false, 'solo');
$('play-world').onclick = () => start(false, 'world');
$('host').onclick = () => start(true, 'world');
for (const id of ['name', 'pin']) $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') start(false, 'solo'); });
if (params.has('host')) start(true, 'world');
// Browsers only allow sound after a user gesture: start the menu music on the first one.
for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => initAudio(), { once: true });
$('mute').onclick = () => $('mute').classList.toggle('off', toggleMute());
$('mute').classList.toggle('off', isMuted());

// Live player count for the Commons on the menu.
async function refreshCommons() {
  if (S.joined) return;
  try {
    const info = await (await fetch('/api/info')).json();
    $('commons-info').textContent = `one shared mine · ${info.online}/${info.max} online`;
  } catch {}
}
refreshCommons();
setInterval(refreshCommons, 5000);

// Animated title scene: the headframe wheel turns, a lamp swings down the shaft.
const WHEEL = ['◐', '◓', '◑', '◒'];
setInterval(() => {
  if (S.joined) return;
  const t = Date.now(), w = WHEEL[Math.floor(t / 250) % 4], d = Math.floor(t / 400) % 5;
  const shaft = Array.from({ length: 5 }, (_, i) => (i === d ? '*' : '│'));
  $('scene').textContent = [
    `      ${w}           .        *     .   ●`,
    `     ╱║╲     /\\        /\\  .     /\\`,
    `    ╱ ║ ╲   /  \\  /\\   /  \\   /\\  /  \\`,
    `""""""║"""""""""""""""""""""""""""""""""`,
    `░░░░░░${shaft[0]}░░░░░░░▒▒▒░░░░░░•░░░░░░░░░░░░░`,
    `▒▒▒•▒▒${shaft[1]}▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒$▒▒▒▒▒▒`,
    `▓▓▓▓▓▓${shaft[2]}▓▓▓▓♦▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓`,
  ].join('\n');
}, 120);

function start(host, mode) {
  const name = $('name').value.trim(), pin = $('pin').value.trim();
  if (!host) {
    if (name.length < 2) { $('menu-error').textContent = 'Pick a name (2+ characters).'; return; }
    if (!/^\d{4}$/.test(pin)) { $('menu-error').textContent = 'PIN must be 4 digits — it protects your save.'; return; }
    store.set('deep-name', name);
    store.set('deep-pin', pin);
    if (touch) document.documentElement.requestFullscreen?.().catch(() => {});
  }
  initAudio();
  S.host = host;
  S.name = name;
  S.mode = mode;
  connect({ t: 'join', name, pin, host, mode });
}

function send(msg) {
  if (S.ws?.readyState === 1) S.ws.send(JSON.stringify(msg));
}

function connect(join) {
  const ws = new WebSocket(`${BASE.protocol === 'https:' ? 'wss' : 'ws'}://${BASE.host}/ws`);
  S.ws = ws;
  ws.onopen = () => ws.send(JSON.stringify(join));
  ws.onmessage = (e) => onMessage(JSON.parse(e.data));
  ws.onclose = () => {
    if (S.ws !== ws) return;
    saveExplored();
    if (S.joined) { $('menu-error').textContent = 'Disconnected — reconnecting…'; setTimeout(() => connect(join), 1500); }
    S.joined = false;
    $('menu').classList.remove('hidden');
    $('hud').classList.add('hidden');
  };
}

// ---------- fog-of-war memory (per miner, in this browser) ----------

const exploredKey = () => `deep-explored-${S.mode}-${S.name.toLowerCase()}`;

function loadExplored() {
  try {
    const b64 = localStorage.getItem(exploredKey());
    if (!b64) return;
    const bits = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    for (let i = 0; i < S.explored.length; i++) S.explored[i] = (bits[i >> 3] >> (i & 7)) & 1;
  } catch {}
}
function saveExplored() {
  if (S.host || !S.name) return;
  try {
    const bits = new Uint8Array(Math.ceil(S.explored.length / 8));
    for (let i = 0; i < S.explored.length; i++) if (S.explored[i]) bits[i >> 3] |= 1 << (i & 7);
    let s = '';
    for (let i = 0; i < bits.length; i += 8192) s += String.fromCharCode(...bits.subarray(i, i + 8192));
    localStorage.setItem(exploredKey(), btoa(s));
  } catch {}
}
setInterval(saveExplored, 15000);
addEventListener('pagehide', saveExplored);

// ---------- messages ----------

function onMessage(m) {
  switch (m.t) {
    case 's': return onSnapshot(m);
    case 'tc': {
      const c = m.c;
      for (let k = 0; k < c.length; k += 3) {
        S.tiles[c[k + 1] * C.W + c[k]] = c[k + 2];
        if (S.host) view.setTile(c[k], c[k + 1], c[k + 2]);
      }
      return;
    }
    case 'chunk': {
      const y0 = m.cy * C.CHUNK * C.W;
      for (let i = 0; i < m.d.length; i++) S.tiles[y0 + i] = m.d.charCodeAt(i) - 48;
      S.loaded[m.cy] = 1;
      if (S.host) for (let i = 0; i < m.d.length; i++) view.setTile((y0 + i) % C.W, Math.floor((y0 + i) / C.W), S.tiles[y0 + i]);
      return;
    }
    case 'welcome': return onWelcome(m);
    case 'story': held.length = 0; syncDir(); dialog.playBeat(m.id); return;
    case 'say': dialog.say(m.npc, m.text); return;
    case 'reset':
      S.loaded.fill(0);
      S.explored.fill(0);
      S.npcs = m.npcs;
      saveExplored();
      ui.toast('The mine has been reset — a fresh world!');
      return;
    case 'pj': S.players.set(m.p[0], newPlayer(m.p)); return;
    case 'pl': S.players.delete(m.id); return;
    case 'feed': return ui.addFeed(esc(m.text), m.kind);
    case 'chat': {
      ui.addFeed(`<b style="color:${m.color}">${esc(m.name)}:</b> ${esc(m.text)}`, 'chat');
      const p = S.players.get(m.id);
      if (p) p.say = { text: m.text, until: performance.now() + 5000 };
      return;
    }
    case 'toast':
      if (m.kind === 'money') sfx.coin();
      return ui.toast(m.text, m.kind);
    case 'error':
      $('menu-error').textContent = m.text;
      if (m.suggest) { $('name').value = m.suggest; $('name').focus(); }
      S.joined = false;
      S.ws?.close();
      return;
    case 'mk': return ui.setMarket(m);
    case 'lb': ui.lb = m; return;
    case 'ore': {
      const self = S.players.get(S.you), d = C.TILES[C.tileByKey[m.k]];
      if (self) S.pops.push({ x: self.rx, y: self.ry - 0.5, text: `+${d.ch} ${d.name}`, color: d.color, life: 1.2 });
      sfx.ore(d.value);
      return;
    }
    case 'hurt': if (view) { view.hurt = 1; view.shake = 10; } sfx.hurt(); return;
    case 'fx': return onFx(m);
  }
}

function newPlayer([id, name, color]) {
  return { id, name, color, x: 0, y: 0, rx: null, ry: null, act: 0, dir: 0 };
}

function onWelcome(m) {
  S.joined = true;
  S.you = m.you;
  S.host = m.host;
  S.mode = m.mode;
  S.npcs = m.npcs ?? [];
  document.body.dataset.mode = m.mode;
  S.players = new Map(m.roster.map((r) => [r[0], newPlayer(r)]));
  if (!view) view = S.host ? new HostView(canvas) : new AsciiView(canvas);
  if (!S.host) loadExplored();
  ui.host = S.host;
  ui.setMarket(m.market);
  for (const f of m.feed) ui.addFeed(esc(f.text), f.kind);
  $('menu').classList.add('hidden');
  $('menu-error').textContent = '';
  $('hud').classList.toggle('hidden', S.host);
  $('hostpanel').classList.toggle('hidden', !S.host);
  $('crt').classList.toggle('hidden', S.host);
  if (S.host) setupHost();
  else if (m.mode === 'world') ui.toast('Welcome to THE COMMONS — walk off the platform and dig ▼');
  if (S.host && params.get('key')) {
    $('host-reset').classList.remove('hidden');
    $('host-reset').onclick = () => {
      if (confirm('Reset the whole Commons world? Everyone keeps money and upgrades, but the map is regenerated.')) send({ t: 'admin', key: params.get('key'), a: 'reset' });
    };
  }
}

async function setupHost() {
  let base = BASE.origin;
  try {
    const info = await (await fetch('/api/info')).json();
    if (info.publicUrl) base = info.publicUrl.replace(/\/$/, '');
    else if (/^(localhost|127\.)/.test(BASE.hostname) && info.lan.length) base = info.lan[0];
  } catch {}
  $('qr').src = `/qr.svg?text=${encodeURIComponent(base)}`;
  $('join-url').textContent = base.replace(/^https?:\/\//, '');
}

function onSnapshot(m) {
  for (const [id, x, y, act, dir] of m.p) {
    const p = S.players.get(id);
    if (!p) continue;
    if (p.rx === null || Math.abs(p.rx - x) + Math.abs(p.ry - y) > 6) { p.rx = x; p.ry = y; }
    Object.assign(p, { x, y, act, dir });
  }
  S.worm = m.worm;
  S.meteor = m.meteor;
  if (m.me) {
    S.me = m.me;
    S.lamp = statsOf(m.me).lamp;
  }
}

function onFx(m) {
  const near = Math.hypot(m.x - S.cam.x, m.y - S.cam.y) < 30;
  if (m.k === 'boom' && near) sfx.boom();
  if (m.k === 'warp' && near) sfx.warp();
  if (m.k === 'boom') {
    if (view && !S.host) view.shake = Math.max(view.shake, 14 - Math.min(12, Math.hypot(m.x - S.cam.x, m.y - S.cam.y)));
    for (let i = 0; i < 26 * m.r; i++) {
      const a = Math.random() * Math.PI * 2, v = 3 + Math.random() * 9 * m.r / 2;
      S.fx.push({ x: m.x, y: m.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, ch: ['#', '*', '+', '.', '%'][i % 5], color: ['#ffdf5a', '#ff7a1f', '#ff4f5e'][i % 3], life: 0.7, max: 0.7 });
    }
  } else if (m.k === 'hit') {
    for (let i = 0; i < 6; i++) S.fx.push({ x: m.x, y: m.y, vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10, ch: '*', color: '#ff4fa3', life: 0.35, max: 0.35 });
  } else if (m.k === 'warp') {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      S.fx.push({ x: m.x, y: m.y, vx: Math.cos(a) * 6, vy: Math.sin(a) * 4, ch: '~', color: '#8ff6ff', life: 0.6, max: 0.6 });
    }
  }
}

// ---------- input ----------

const KEY_DIR = { arrowleft: 'L', a: 'L', arrowright: 'R', d: 'R', arrowup: 'U', w: 'U', arrowdown: 'D', s: 'D' };
const held = [];
let sentDir = '', sentUp = false;
// The last pressed direction moves/digs; holding ↑ at the same time keeps the thruster on,
// so you can hover in a shaft and dig or walk sideways out of it.
function syncDir() {
  const up = held.includes('U');
  let d = held[held.length - 1] ?? '';
  if (d === 'U') d = [...held].reverse().find((k) => k === 'L' || k === 'R') ?? 'U';
  if (d !== sentDir || up !== sentUp) { sentDir = d; sentUp = up; send({ t: 'in', d, up }); }
}
function press(d) { if (dialog.open) return; if (!held.includes(d)) held.push(d); syncDir(); }
function release(d) { const i = held.indexOf(d); if (i >= 0) held.splice(i, 1); syncDir(); }

let rescueArmed = 0;
function use(item) {
  if (item === 'rescue') {
    if (performance.now() - rescueArmed < 2500) { send({ t: 'rescue' }); rescueArmed = 0; }
    else { rescueArmed = performance.now(); ui.toast('Rescue drops your cargo — press again to confirm'); }
    return;
  }
  send({ t: 'use', k: item });
}

// Primary action at whichever building you stand next to.
function interact() {
  const self = S.players.get(S.you);
  if (!self) return;
  const st = self.y <= C.SURFACE - 1 ? C.stationAt(self.x)?.key : null;
  if (st === 'fuel') send({ t: 'fuel' });
  else if (st === 'sell') send({ t: 'sell' });
  else if (st === 'shop') send({ t: 'repair' });
  else send({ t: 'talk' });
}

function openChat() {
  $('chat-form').classList.remove('hidden');
  $('chat').focus();
  held.length = 0;
  syncDir();
}
$('chat-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('chat').value.trim();
  if (text) send({ t: 'chat', text });
  $('chat').value = '';
  $('chat-form').classList.add('hidden');
  $('chat').blur();
});
$('chat').addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { $('chat-form').classList.add('hidden'); $('chat').blur(); }
});

addEventListener('keydown', (e) => {
  if (!S.joined || S.host || e.target instanceof HTMLInputElement) return;
  const k = e.key.toLowerCase();
  if (dialog.key(k)) { e.preventDefault(); return; }
  if (k === 'm') { $('mute').classList.toggle('off', toggleMute()); return; }
  if (KEY_DIR[k]) { e.preventDefault(); press(KEY_DIR[k]); return; }
  if (e.repeat) return;
  if (k === 'f' || k === 'e' || k === 'enter') interact();
  else if (k === 't') { e.preventDefault(); openChat(); }
  else if (k === 'l' || k === 'tab') { e.preventDefault(); ui.toggleLb(); ui.renderLb(); }
  else if (k === 'r') use('rescue');
  else {
    const item = C.ITEM_KEYS.find((i) => C.ITEMS[i].key === k);
    if (item) use(item);
  }
});
addEventListener('keyup', (e) => { const d = KEY_DIR[e.key.toLowerCase()]; if (d) release(d); });
addEventListener('blur', () => { held.length = 0; syncDir(); });

for (const b of document.querySelectorAll('#dpad button')) {
  const d = b.dataset.d;
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add('on'); press(d); });
  const up = () => { b.classList.remove('on'); release(d); };
  b.addEventListener('pointerup', up);
  b.addEventListener('pointercancel', up);
}
$('btn-act').onclick = () => (dialog.open ? dialog.next() : interact());
$('btn-chat').onclick = openChat;
$('btn-lb').onclick = () => { ui.toggleLb(); ui.renderLb(); };

// ---------- loop ----------

let last = performance.now(), lastUi = 0, lastDig = 0;

// Soundtrack follows depth: surface jingle, then darker, slower moods per layer.
function updateMood(self) {
  if (S.host) return setMood('surface');
  if (!self) return;
  if (self.y < C.SURFACE) return setMood('surface');
  setMood(LAYER_MOODS[C.LAYERS.indexOf(C.layerOf(C.depthOf(self.y)))] ?? 'core');
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!S.joined || !view) return;

  const k = Math.min(1, dt * 22);
  for (const p of S.players.values()) {
    if (p.rx === null) continue;
    p.rx += (p.x - p.rx) * k;
    p.ry += (p.y - p.ry) * k;
  }
  for (const f of S.fx) { f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 0.9; f.vy *= 0.9; f.life -= dt; }
  S.fx = S.fx.filter((f) => f.life > 0);
  for (const p of S.pops) { p.y -= dt * 1.5; p.life -= dt; }
  S.pops = S.pops.filter((p) => p.life > 0);

  const self = S.players.get(S.you);
  if (self?.rx != null) {
    S.cam.x += (self.rx - S.cam.x) * Math.min(1, dt * 10);
    S.cam.y += (self.ry - S.cam.y) * Math.min(1, dt * 10);
  }
  view.draw(S, now);
  if (now - lastUi > 100) { lastUi = now; ui.update(S); updateMood(self); }
  if (self?.act === 2 && now - lastDig > 120) { lastDig = now; sfx.dig(); }
}
requestAnimationFrame(frame);

window.S = S; // handy for debugging in the console
