import * as C from '/shared/config.js';
import { AsciiView } from './view.js';
import { HostView } from './host.js';
import { UI, statsOf, esc } from './ui.js';
import { Dialog } from './dialog.js';
import { HATS, FACES, BODIES, OUTFITS, LOOK_COLORS, sanitizeLook, playerPortrait, hatOf, faceOf } from '/shared/looks.js';
import { initAudio, setMood, setChapter, sfx, toggleMute, setVolumes, LAYER_MOODS } from './audio.js';
import { drawMiner } from './sprite.js';

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

let look = (() => { try { return sanitizeLook(JSON.parse(store.get('deep-look') ?? '{}')); } catch { return sanitizeLook(); } })();
const dialog = new Dialog(send, () => look);

function renderLook() {
  $('look-portrait').textContent = playerPortrait(look);
  $('look-portrait').style.color = look.color;
  $('look-hat').textContent = hatOf(look).name;
  $('look-face').textContent = faceOf(look).name;
  $('look-body').textContent = OUTFITS[look.body];
  for (const b of $('look-colors').children) b.classList.toggle('on', b.dataset.c === look.color);
  store.set('deep-look', JSON.stringify(look));
}
$('look-colors').innerHTML = LOOK_COLORS.map((c) => `<button data-c="${c}" style="background:${c};color:${c}" aria-label="colour"></button>`).join('');
$('look-colors').addEventListener('click', (e) => { const c = e.target.dataset.c; if (c) { look.color = c; renderLook(); } });
const cycle = (list, cur, d) => list[(list.indexOf(cur) + d + list.length) % list.length];
for (const b of document.querySelectorAll('[data-l]')) {
  b.addEventListener('click', () => {
    const d = Number(b.dataset.d), k = b.dataset.l;
    if (k === 'hat') look.hat = cycle(HATS.map((h) => h.key), look.hat, d);
    if (k === 'face') look.face = cycle(FACES.map((f) => f.key), look.face, d);
    if (k === 'body') look.body = cycle(BODIES, look.body, d);
    renderLook();
  });
}
const pick = (list) => list[Math.floor(Math.random() * list.length)];
$('look-random').onclick = () => {
  look = { hat: pick(HATS).key, face: pick(FACES).key, body: pick(BODIES), color: pick(LOOK_COLORS) };
  renderLook();
};
renderLook();
setInterval(() => {
  if (S.joined || !$('custom').open) return;
  const cv = $('look-sprite'), g = cv.getContext('2d'), now = performance.now();
  g.clearRect(0, 0, cv.width, cv.height);
  drawMiner(g, cv.width / 2, cv.height - 30, 90, { look, now, dig: now % 4000 > 2800 ? 'R' : null, walk: now % 4000 < 1400 ? now / 140 : null });
}, 50);


let storyLength = C.DIFFICULTIES[store.get('deep-length')] ? store.get('deep-length') : 'normal';
function renderLengths() {
  for (const id of ['lengths', 'set-lengths']) {
    $(id).innerHTML = `<span>${id === 'lengths' ? 'story length' : 'restart as'}</span>${C.DIFFICULTY_KEYS.map((k) => {
      const d = C.DIFFICULTIES[k];
      return `<button data-len="${k}" class="${k === storyLength ? 'on' : ''}">${d.label} <small>${d.hint}</small></button>`;
    }).join('')}`;
  }
}
for (const id of ['lengths', 'set-lengths']) {
  $(id).addEventListener('click', (e) => {
    const k = e.target.closest('[data-len]')?.dataset.len;
    if (!k) return;
    storyLength = k;
    store.set('deep-length', k);
    renderLengths();
  });
}
renderLengths();

const TAGS = [
  'the earth is a resource. so are you.',
  'all that is solid melts into air. the rest goes to market.',
  'you have nothing to lose but your drill.',
  'dig. sell. upgrade. repeat. you always wanted this.',
  'the deeper you go, the less it costs. we checked.',
  'rest is just work that hasn’t been invoiced yet.',
];
$('tag').firstChild.textContent = `> ${TAGS[Math.floor(Math.random() * TAGS.length)]}`;

$('name').value = store.get('deep-name') ?? '';
$('pin').value = store.get('deep-pin') ?? '';
$('play-solo').onclick = () => start(false, 'solo');
$('play-world').onclick = () => start(false, 'world');
$('host').onclick = () => start(true, 'world');
for (const id of ['name', 'pin']) $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') start(false, 'solo'); });
if (params.has('host')) start(true, 'world');
// Browsers only allow sound after a user gesture: start the menu music on the first one.
for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => initAudio(), { once: true });


const settings = (() => {
  const d = { music: 70, sfx: 80, shake: true, crt: true, feed: true };
  try { return { ...d, ...JSON.parse(store.get('deep-settings') ?? '{}') }; } catch { return d; }
})();
function applySettings() {
  setVolumes(settings.music / 100, settings.sfx / 100);
  document.body.classList.toggle('no-crt', !settings.crt);
  document.body.classList.toggle('no-feed', !settings.feed);
  if (view) view.shakeScale = settings.shake ? 1 : 0;
  store.set('deep-settings', JSON.stringify(settings));
}
for (const k of ['music', 'sfx']) {
  $(`set-${k}`).value = settings[k];
  $(`set-${k}`).oninput = (e) => { settings[k] = Number(e.target.value); applySettings(); };
}
for (const k of ['shake', 'crt', 'feed']) {
  $(`set-${k}`).checked = settings[k];
  $(`set-${k}`).onchange = (e) => { settings[k] = e.target.checked; applySettings(); };
}
applySettings();

const settingsOpen = () => !$('settings').classList.contains('hidden');
function toggleSettings(open = !settingsOpen()) {
  if (!S.joined || S.host) return;
  $('settings').classList.toggle('hidden', !open);
  $('set-title').textContent = S.mode === 'solo' ? 'PAUSED' : 'SETTINGS';
  held.length = 0;
  syncDir();
  if (S.mode === 'solo') send({ t: 'pause', on: open });
}
$('settings-btn').onclick = () => toggleSettings(true);
$('set-resume').onclick = () => toggleSettings(false);
$('settings').addEventListener('click', (e) => { if (e.target.id === 'settings') toggleSettings(false); });
$('set-leave').onclick = () => {
  toggleSettings(false);
  saveExplored();
  const ws = S.ws;
  S.ws = null; // no auto-reconnect
  ws?.close();
  S.joined = false;
  dialog.close();
  $('menu').classList.remove('hidden');
  $('hud').classList.add('hidden');
  setMood('menu');
};
$('set-restart').onclick = () => {
  const len = C.DIFFICULTIES[storyLength];
  if (!confirm(`Restart the story from the beginning, as a ${len.label} story (${len.hint})?\n\nThis wipes your story world, money, upgrades, debt and every choice you made. Your name, PIN and look stay. The Commons is not affected.`)) return;
  toggleSettings(false);
  dialog.close();
  $('obit').classList.add('hidden');
  obitOpen = false;
  $('payslip').classList.add('hidden');
  send({ t: 'restartStory', difficulty: storyLength });
};

async function refreshCommons() {
  if (S.joined) return;
  try {
    const info = await (await fetch('/api/info')).json();
    $('commons-info').textContent = `one shared mine · ${info.online}/${info.max} online`;
  } catch {}
}
refreshCommons();
setInterval(refreshCommons, 5000);

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
  connect({ t: 'join', name, pin, host, mode, look, difficulty: storyLength });
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
    case 'story': held.length = 0; syncDir(); dialog.playBeat(m.id, m.flags, S.mode === 'solo'); return;
    case 'say': dialog.say(m.npc, m.text); return;
    case 'think': S.thought = { text: m.text, until: performance.now() + 2600 + m.text.length * 55 }; return; // long enough to read
    case 'payslip': return showPayslip(m);
    case 'obit': return showObit(m);
    case 'reset':
      $('settings').classList.add('hidden');
      S.loaded.fill(0);
      S.explored.fill(0);
      S.npcs = m.npcs;
      saveExplored();
      ui.toast(S.mode === 'solo' ? 'A new story begins.' : 'The mine has been reset — a fresh world!');
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
    case 'ride':
      held.length = 0;
      syncDir();
      S.ride = { from: m.from, to: m.to, dur: m.dur, start: performance.now() };
      sfx.lift(m.dur);
      return;
  }
}


const money = (n) => `$${Math.round(n).toLocaleString('en')}`;
const dots = (label, value, w = 30) => `${label} ${'.'.repeat(Math.max(2, w - label.length - value.length))} ${value}`;
let slipTimer = null;
function showPayslip(m) {
  sfx.coin();
  $('payslip-text').innerHTML = [
    '   DEEP MINING CO. — PAYSLIP',
    `   employee #${S.me?.wk ?? 1}`,
    ' -------------------------------',
    ' ' + dots(`${m.n} ore sold`, money(m.gross)),
    ...m.lines.map(([label, amt]) => ' ' + dots(label, `-${money(amt)}`)),
    ' -------------------------------',
    `<span class="net"> ${dots('TAKE HOME', money(m.net))}</span>`,
    ' ' + dots('Debt remaining', money(m.debt)),
    '',
    '   Thank you for your service.',
  ].join('\n');
  $('payslip').classList.remove('hidden');
  document.body.classList.add('slip');
  clearTimeout(slipTimer);
  slipTimer = setTimeout(hidePayslip, 8000);
}
function hidePayslip() {
  $('payslip').classList.add('hidden');
  document.body.classList.remove('slip');
}
$('payslip').onclick = hidePayslip;

let obitOpen = false;
function showObit(m) {
  obitOpen = true;
  held.length = 0;
  syncDir();
  sfx.toll();
  setMood('lament');
  $('obit-text').textContent = [
    '  ╔══════════════════════════════════╗',
    '  ║           IN  MEMORIAM           ║',
    '  ╚══════════════════════════════════╝',
    '',
    `     Employee #${m.no}`,
    `     ${m.why} at ${m.depth} m.`,
    m.cargo ? `     ${m.cargo} ore lost with them.` : '     They were carrying nothing.',
    ...(m.letters ? [`     ${m.letters > 1 ? 'Letters were' : 'A letter was'} found in their coat,`, '     and passed to the next employee.'] : []),
    '',
    `     Funeral & replacement ..... -${money(m.fee)}`,
    `     Debt carried forward ...... ${money(m.debt)}`,
    '',
    '',
    '     A new employee arrives.',
    '     They look a lot like you.',
    '     They have your debt.',
  ].join('\n');
  $('obit').classList.remove('hidden');
}
$('obit-go').onclick = () => { $('obit').classList.add('hidden'); obitOpen = false; };

function newPlayer([id, name, color, look]) {
  return { id, name, color, look: look ?? null, x: 0, y: 0, rx: null, ry: null, act: 0, dir: 0 };
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
  applySettings();
  S.loaded.fill(0);
  S.explored.fill(0);
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
  for (const [id, x, y, act, dir, prog] of m.p) {
    const p = S.players.get(id);
    if (!p) continue;
    if (p.rx === null || Math.abs(p.rx - x) + Math.abs(p.ry - y) > 6) { p.rx = x; p.ry = y; }
    Object.assign(p, { x, y, act, dir, prog });
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
  if (m.k === 'rumble') { sfx.rumble(); if (view) view.shake = Math.max(view.shake, 9); return; }
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
function press(d) { if (dialog.open || obitOpen || settingsOpen()) return; if (!held.includes(d)) held.push(d); syncDir(); }
function release(d) { const i = held.indexOf(d); if (i >= 0) held.splice(i, 1); syncDir(); }

const KEEPSAKE_NOTES = {
  tomas: 'Take it to the postman at the edge of town (west of the fuel pump).',
  home: 'Take it to the postman at the edge of town (west of the fuel pump).',
  stone: 'The postman knows Jo’s house. He sits west of the fuel pump.',
  jostone: 'For luck, she said. You need it more than me.',
  drawing: 'Two people on top of a mountain. Neither of them has a drill.',
  memo: 'Inspection, 3rd March: unsafe. Do not use.',
};
let rescueArmed = 0;
function use(item) {
  if (item.startsWith('keep:')) return ui.toast(KEEPSAKE_NOTES[item.slice(5)] ?? '');
  if (item === 'rescue') {
    if (performance.now() - rescueArmed < 2500) { send({ t: 'rescue' }); rescueArmed = 0; }
    else { rescueArmed = performance.now(); ui.toast('Rescue drops your cargo — press again to confirm'); }
    return;
  }
  send({ t: 'use', k: item });
}

function interact() {
  const self = S.players.get(S.you);
  if (!self) return;
  const st = self.y <= C.SURFACE - 1 ? C.stationAt(self.x)?.key : null;
  const lift = C.liftStopAt(self.x, self.y);
  if (lift !== null) {
    const open = C.LIFT_STOPS.filter((d) => d <= (S.me?.r ?? 0));
    return send({ t: 'lift', to: lift === 0 ? open.at(-1) ?? 0 : 0 });
  }
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
  if (k === 'escape') {
    if ($('chat-form').classList.contains('hidden') && $('lb').classList.contains('hidden')) toggleSettings();
    else { $('lb').classList.add('hidden'); $('chat-form').classList.add('hidden'); }
    e.preventDefault();
    return;
  }
  if (settingsOpen()) return;
  if (dialog.key(k)) { e.preventDefault(); return; }
  if (k === 'm') { ui.toast(toggleMute() ? 'Sound off (M)' : 'Sound on (M)'); return; }
  if (obitOpen) { if (k === ' ' || k === 'enter') $('obit-go').click(); e.preventDefault(); return; }
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


let last = performance.now(), lastUi = 0, lastDig = 0, nextCough = 0;

function chapterOf(fl = {}) {
  const ending = { company: 'company', silence: 'hollow', home: 'home' }[fl.ending];
  if (ending) return ending;
  const refused = fl.refused || fl.hesitant;
  if (fl['jo-gone']) return refused ? 'reckoning' : 'grief';
  if (fl.ending === 'recurrence') return 'recurrence';
  if (refused) return 'refusal';
  return fl['jo-here'] ? 'jo' : 'burden';
}
function updateMood(self) {
  setChapter(S.host ? 'burden' : chapterOf(S.me?.fl));
  if (dialog.mood || obitOpen) return; // a letter or a death sets its own music
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

  // Glide toward the server position at a steady walking pace (faster when lagging behind),
  // so steps read as motion rather than an ease-out snap.
  for (const p of S.players.values()) {
    if (p.rx === null) continue;
    const ddx = p.x - p.rx, ddy = p.y - p.ry, dist = Math.hypot(ddx, ddy);
    if (dist < 0.01) { p.rx = p.x; p.ry = p.y; continue; }
    const step = Math.min(dist, (9 + dist * 12) * dt);
    p.rx += (ddx / dist) * step;
    p.ry += (ddy / dist) * step;
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
  if (S.mode === 'solo' && self && now > nextCough) {
    const tired = S.me?.t ?? 0, dusty = C.depthOf(self.y) > 250;
    if (tired > 55 || dusty) {
      S.pops.push({ x: self.rx - 1, y: self.ry - 0.8, text: '*cough*', color: '#9a9a9a', life: 1.4 });
      sfx.cough();
    }
    nextCough = now + 9000 + Math.random() * 12000 - Math.min(6000, tired * 60);
  }
}
requestAnimationFrame(frame);

