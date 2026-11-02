// One persistent shared mine: players, digging, economy, world events, saving.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as C from '../shared/config.js';
import { World } from './world.js';
import { sanitizeLook } from '../shared/looks.js';
import { failedLogins, newAccounts } from './limits.js';
import { BEATS, beatById, CHARACTERS, SITES, TOWN_NPCS, THOUGHTS, SCRAPS, HINTS, MEETS, visible, lineText } from '../shared/story.js';

const { T, TILES, W, H, SURFACE } = C;
const DIRS = { L: [-1, 0], R: [1, 0], U: [0, -1], D: [0, 1] };
const DIR_IDX = { '': 0, L: 1, R: 2, U: 3, D: 4 };
const ACT_IDX = { move: 1, dig: 2, fall: 3 };
const EVENT_SCALE = Number(process.env.EVENT_SCALE ?? 1); // <1 = more frequent world events
const SAVE_FIELDS = ['name', 'key', 'pin', 'color', 'money', 'earned', 'stars', 'record', 'runDepth', 'up', 'inv', 'cargo', 'fuel', 'hull', 'x', 'y', 'story', 'debt', 'workers', 'tired', 'look', 'difficulty'];
const START_DEBT = 2500;      // story mode: "relocation & equipment"
const DEATH_FEE = 400;        // story mode: funeral + replacement worker
const REPEATABLE = new Set(['rebirth', 'debt']);
// Story flags for things that happen to people (not choices you made): relived after the AMOR FATI ending.
const RELIVED = /^(tomas-gone|carrying-tomas|carried-letter|added-note|writing-home|wrote-home|jo-|stone-|has-memo|lamp-lit)/;

const rand = (a, b) => a + Math.random() * (b - a);
// Look up a key a client sent, ignoring anything inherited ("toString", "__proto__"…).
const own = (obj, k) => (typeof k === 'string' && Object.hasOwn(obj, k) ? obj[k] : undefined);
const MAX_COMMONS_ACCOUNTS = 2000;
const hashPin = (key, pin) => crypto.createHash('sha256').update(`deep:${key}:${pin}`).digest('hex');
const r1 = (v) => Math.round(v * 10) / 10;

export function stats(p) {
  const U = C.UPGRADES;
  return {
    speed: U.drill.speed[p.up.drill] * (1 + 0.05 * p.stars),
    power: U.drill.power[p.up.drill],
    tank: U.tank.value[p.up.tank],
    cargo: U.cargo.value[p.up.cargo],
    hull: U.hull.value[p.up.hull],
    lamp: U.lamp.value[p.up.lamp],
  };
}
const cargoCount = (p) => Object.values(p.cargo).reduce((s, n) => s + n, 0);
const noUpgrades = () => Object.fromEntries(C.UPGRADE_KEYS.map((k) => [k, 0]));
const newStory = () => ({ done: [], flags: {}, sells: 0 });
const onSurface = (p) => p.y <= SURFACE - 1;

const ADMIN_KEY = process.env.ADMIN_KEY ?? '';

export class Game {
  static MAX_PLAYERS = Number(process.env.MAX_PLAYERS ?? 60);

  // mode 'world' = THE COMMONS (shared multiplayer mine); 'solo' = a private story world.
  constructor({ saveFile, mode = 'world', onEmpty = null }) {
    this.saveFile = saveFile;
    this.mode = mode;
    this.onEmpty = onEmpty;
    this.npcs = [];
    this.world = new World();
    this.accounts = new Map();
    this.players = new Map();
    this.conns = new Set();
    this.nextId = 1;
    this.tick = 0;
    this.time = 0;
    this.market = Object.fromEntries(C.ORES.map((k) => [k, 1]));
    this.rush = null;
    this.worm = null;
    this.meteor = null;
    this.feedLog = [];
    this.nextEvent = rand(90, 150) * EVENT_SCALE;
    this.nextVeins = 480 * EVENT_SCALE;
    this.load();
    this.loop = setInterval(() => {
      // One bad tick must not take every other player's game down with it.
      try { this.update(); } catch (e) { console.error(`[${this.mode}] tick failed:`, e); }
    }, 1000 / C.TICK_RATE);
    this.saver = setInterval(() => this.save(), 30_000);
  }

  // ---------- persistence ----------

  load() {
    try {
      const data = JSON.parse(fs.readFileSync(this.saveFile, 'utf8'));
      if (this.world.load(data.world)) {
        for (const a of data.accounts ?? []) this.accounts.set(a.key, a);
        this.market = { ...this.market, ...(data.market ?? {}) };
        // Town NPCs always come from the current story config; carved story sites come from the save.
        this.npcs = [...this.townNpcs(), ...(data.npcs ?? []).filter((n) => !TOWN_NPCS.some((t) => t.npc === n.npc))];
        // Older saves: carve any character sites added since the world was made.
        for (const site of this.sites()) if (!this.npcs.some((n) => n.npc === site.npc)) this.carveSite(site);
        this.anchorNpcs(); // worlds saved before characters stood on concrete
        if (this.mode === 'world') console.log(`Loaded world + ${this.accounts.size} miners from ${this.saveFile}`);
        return;
      }
    } catch {}
    this.resetWorld();
  }

  townNpcs() {
    return TOWN_NPCS
      .filter((n) => this.mode === 'solo' || !n.soloOnly)
      .map((n) => ({ npc: n.npc, x: W / 2 + n.dx, y: SURFACE - 1, req: this.mode === 'solo' ? n.req : null }));
  }


  // Underground character sites for this world (the Commons skips story-only ones).
  sites() {
    return SITES.filter((s) => this.mode === 'solo' || !s.soloOnly);
  }

  carveSite(site) {
    const x0 = Math.floor(rand(8, W - 8 - site.w)), y0 = SURFACE + site.depth - site.h + 1;
    const spot = this.world.carveRoom(x0, y0, site.w, site.h);
    this.npcs.push({ npc: site.npc, ...spot, req: site.req ?? null, room: { x0, y0, w: site.w, h: site.h } });
    if (site.also) this.npcs.push({ npc: site.also.npc, ...spot, req: site.also.req ?? null });
  }

  // Prices and story pacing for this miner: their chosen story length, or 'normal' in the Commons.
  eco(p) {
    return C.economy(this.mode === 'solo' ? p.difficulty : 'normal');
  }

  // Everything a miner starts with: no money, base equipment, full tank and hull — and, in the story, the debt.
  newCareer() {
    return {
      money: 0, earned: 0, stars: 0, record: 0, runDepth: 0,
      up: noUpgrades(), inv: { ...C.START_INV }, cargo: {},
      fuel: C.UPGRADES.tank.value[0], hull: C.UPGRADES.hull.value[0],
      debt: this.mode === 'solo' ? START_DEBT : 0, workers: 1, tired: 0,
    };
  }

  // Every character stands on concrete, so nobody can dig the ground out from under them:
  // two layers under each one in town, and the whole floor of each underground room.
  // The lift landings are built here too.
  anchorNpcs() {
    const w = this.world, pour = (x, y) => { if (w.inBounds(x, y) && w.get(x, y) !== T.BEDROCK) w.set(x, y, T.CONCRETE); };
    // Lift landings: a small hollow with a concrete floor at every stop down the shaft.
    for (const d of C.LIFT_STOPS) {
      const y = C.liftRow(d);
      if (w.get(C.LIFT.x, y + 1) === T.CONCRETE) continue; // already built
      w.carveRoom(C.LIFT.x - 2, y - 2, 5, 3);
      for (let x = C.LIFT.x - 2; x <= C.LIFT.x + 2; x++) pour(x, y + 1);
    }
    for (const n of this.npcs) {
      if (n.room) {
        const { x0, y0, w: rw, h } = n.room;
        for (let x = x0; x < x0 + rw; x++) pour(x, y0 + h);
      } else {
        for (let x = n.x - 1; x <= n.x + 1; x++) { pour(x, n.y + 1); pour(x, n.y + 2); }
      }
    }
  }

  // Story mode: a brand-new world and a brand-new miner (same name, PIN and look).
  restartStory(p, difficulty) {
    Object.assign(p, this.newCareer(), {
      difficulty: C.economy(difficulty ?? p.difficulty).key,
      story: newStory(), dialog: null, act: null, fallN: 0, thoughtAt: {}, trip: null, bags: {},
    });
    this.resetWorld();
    this.save();
    this.trigger(p, 'join');
  }

  // Fresh map. Accounts keep their progress but are moved back to town.
  resetWorld() {
    this.world.generate();
    this.npcs = this.townNpcs();
    for (const site of this.sites()) this.carveSite(site);
    this.anchorNpcs();
    this.world.changes = [];
    for (const a of this.accounts.values()) Object.assign(a, this.spawnPoint(), { cargo: {}, act: null, fallN: 0 });
    for (const c of this.conns) { c.chunks.clear(); this.send(c, { t: 'reset', npcs: this.npcs }); if (c.host) for (let cy = 0; cy * C.CHUNK < H; cy++) this.sendChunk(c, cy); }
  }

  save() {
    const data = {
      v: 1, world: this.world.serialize(), market: this.market, npcs: this.npcs,
      accounts: [...this.accounts.values()].map((a) => Object.fromEntries(SAVE_FIELDS.map((f) => [f, a[f]]))),
    };
    fs.mkdirSync(path.dirname(this.saveFile), { recursive: true });
    fs.writeFileSync(`${this.saveFile}.tmp`, JSON.stringify(data));
    fs.renameSync(`${this.saveFile}.tmp`, this.saveFile);
  }

  // ---------- connections ----------

  send(conn, msg) {
    const ws = conn.ws;
    if (ws.readyState === 1 && ws.bufferedAmount < 2 << 20) ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  broadcast(msg) {
    const s = JSON.stringify(msg);
    for (const c of this.conns) this.send(c, s);
  }
  tell(p, text, tag = text) {
    // Throttle repeated warnings ("too hard", "out of fuel"...) per player.
    p.told ??= {};
    if ((p.told[tag] ?? -1) > this.time) return;
    p.told[tag] = this.time + 2;
    if (p.conn) this.send(p.conn, { t: 'toast', text });
  }
  feed(text, kind = 'info') {
    if (this.mode === 'solo') return; // the story has no public event log
    const f = { text, kind };
    this.feedLog.push(f);
    if (this.feedLog.length > 30) this.feedLog.shift();
    this.broadcast({ t: 'feed', ...f });
  }

  join(conn, m) {
    if (m.host) {
      conn.host = true;
    } else {
      const name = String(m.name ?? '').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 14);
      const pin = String(m.pin ?? '');
      if (name.length < 2) return this.send(conn, { t: 'error', text: 'Pick a name (2+ characters).' });
      if (!/^\d{4}$/.test(pin)) return this.send(conn, { t: 'error', text: 'PIN must be 4 digits.' });
      const key = name.toLowerCase();
      if (this.mode === 'world' && this.players.size >= Game.MAX_PLAYERS) {
        return this.send(conn, { t: 'error', text: `The Commons is full (${Game.MAX_PLAYERS}/${Game.MAX_PLAYERS}). Try STORY mode, or come back in a bit.` });
      }
      const look = sanitizeLook(m.look);
      let p = this.accounts.get(key);
      const loginKey = `${this.mode}:${key}`;
      const isLoginLocked = !!p && failedLogins.isBlocked(loginKey);
      if (p && (isLoginLocked || p.pin !== hashPin(key, pin))) {
        if (!isLoginLocked) failedLogins.record(loginKey);
        // Someone else owns this name: suggest a free variant instead of leaving the player stuck.
        let n = 2, suggest;
        do suggest = `${name.slice(0, 12)}${n++}`; while (this.accounts.has(suggest.toLowerCase()));
        return this.send(conn, {
          t: 'error', suggest,
          text: isLoginLocked
            ? `Too many wrong PINs for "${name}". Try again in 15 minutes, or play as "${suggest}" — just press DIG IN.`
            : `"${name}" is already taken by another miner. Enter its PIN to continue that save, or play as "${suggest}" — just press DIG IN.`,
        });
      }
      if (p) failedLogins.clear(loginKey);
      if (!p) {
        if (this.mode === 'world') {
          if (this.accounts.size >= MAX_COMMONS_ACCOUNTS || newAccounts.isBlocked(conn.address)) {
            return this.send(conn, { t: 'error', text: 'Too many new miners right now. Try again later.' });
          }
          newAccounts.record(conn.address);
        }
        p = { name, key, pin: hashPin(key, pin), color: look.color, look, ...this.newCareer(), ...this.spawnPoint(), difficulty: C.economy(m.difficulty).key };
        this.accounts.set(key, p);
      }
      if (p.conn) { this.send(p.conn, { t: 'error', text: 'Logged in from another device.' }); p.conn.ws.close(); this.leave(p.conn); }
      p.story ??= newStory();
      // The look chosen on the menu replaces the saved one each time you log in.
      if (m.look) { p.look = look; p.color = look.color; }
      p.look ??= sanitizeLook({ color: p.color });
      p.debt ??= this.mode === 'solo' ? START_DEBT : 0;
      p.workers ??= 1;
      p.difficulty ??= 'normal';
      p.tired ??= 0;
      p.inv.ladder ??= C.START_INV.ladder;
      Object.assign(p, { id: this.nextId++, conn, dir: '', act: null, fallN: 0, cd: {}, told: {}, dialog: null, paused: false });
      if (!C.passable(this.world.get(p.x, p.y))) Object.assign(p, this.spawnPoint());
      conn.player = p;
      this.players.set(p.id, p);
      this.broadcast({ t: 'pj', p: [p.id, p.name, p.color, p.look] });
      if (this.mode === 'world') this.feed(`${p.name} entered the mine`, 'join');
    }
    conn.joined = true;
    this.conns.add(conn);
    this.send(conn, {
      t: 'welcome', you: conn.player?.id ?? null, host: conn.host, mode: this.mode, npcs: this.npcs,
      roster: [...this.players.values()].map((q) => [q.id, q.name, q.color, q.look]),
      feed: this.feedLog.slice(-8), market: this.marketRow(),
    });
    if (conn.host) for (let cy = 0; cy * C.CHUNK < H; cy++) this.sendChunk(conn, cy);
    else this.streamChunks(conn);
    this.send(conn, this.leaderboard());
    if (conn.player) this.trigger(conn.player, 'join');
  }

  leave(conn) {
    if (!this.conns.delete(conn)) return;
    const p = conn.player;
    if (!p || p.conn !== conn) return;
    p.conn = null;
    p.act = null;
    this.players.delete(p.id);
    this.broadcast({ t: 'pl', id: p.id });
    if (this.mode === 'world') this.feed(`${p.name} left`, 'join');
    if (this.conns.size === 0) this.onEmpty?.();
  }

  dispose() {
    clearInterval(this.loop);
    clearInterval(this.saver);
    if (this.accounts.size) this.save(); // nobody ever got in (e.g. a wrong PIN): nothing worth keeping
  }

  spawnPoint() {
    return { x: Math.floor(W / 2 + rand(-3, 4)), y: SURFACE - 1 };
  }

  sendChunk(conn, cy) {
    conn.chunks.add(cy);
    this.send(conn, { t: 'chunk', cy, d: this.world.encodeChunk(cy) });
  }

  streamChunks(conn) {
    const p = conn.player;
    if (!p) return;
    const c = Math.floor(p.y / C.CHUNK), max = Math.ceil(H / C.CHUNK) - 1;
    for (let cy = Math.max(0, c - 2); cy <= Math.min(max, c + 2); cy++) if (!conn.chunks.has(cy)) this.sendChunk(conn, cy);
  }

  // ---------- player commands ----------

  onMessage(conn, m) {
    if (m.t === 'admin') {
      // Big-screen admin controls, enabled by setting ADMIN_KEY on the server.
      if (!ADMIN_KEY || m.key !== ADMIN_KEY) return this.send(conn, { t: 'toast', text: 'Wrong admin key.' });
      if (m.a === 'reset') { this.resetWorld(); this.feed('🌋 The mine has been reset. A fresh world awaits!', 'big'); this.save(); }
      return;
    }
    const p = conn.player;
    if (!p) return;
    const surface = onSurface(p), station = surface ? C.stationAt(p.x)?.key : null;
    const st = stats(p);
    switch (m.t) {
      case 'in':
        p.dir = own(DIRS, m.d) ? m.d : '';
        p.thrust = !!m.up; // thruster held while steering sideways
        // A quick tap can be released before the next tick: remember it so it still moves you one cell.
        if (p.dir) p.tap = p.dir;
        break;
      case 'sell': {
        if (station !== 'sell') return this.tell(p, 'Go to the MARKET to sell.');
        let total = 0, n = 0;
        for (const [k, cnt] of Object.entries(p.cargo)) {
          total += this.price(k) * cnt * (1 + C.REBIRTH_BONUS * p.stars);
          this.market[k] = Math.max(0.35, this.market[k] - 0.006 * cnt);
          n += cnt;
        }
        if (!n) return this.tell(p, 'Your cargo is empty — go dig!');
        total = Math.round(total);
        p.cargo = {};
        p.earned += total;
        if (this.mode === 'solo') {
          // The payslip: the Company takes its cut before you see a cent.
          const lines = [];
          const take = (label, amt) => { amt = Math.min(Math.round(amt), total - lines.reduce((a, l) => a + l[1], 0)); if (amt > 0) lines.push([label, amt]); };
          const cut = this.eco(p).cut; // a longer story: the Company takes more
          if (p.debt > 0) take('Debt instalment', Math.min(p.debt, total * 0.2 * cut));
          take('Drill lease', (total * 0.04 + 3 * p.up.drill) * cut);
          take('Lamp oil', (total * 0.02 + 1) * cut);
          take('Bunk & board', total * 0.03 * cut);
          const paid = lines[0]?.[0] === 'Debt instalment' ? lines[0][1] : 0;
          const net = total - lines.reduce((a, l) => a + l[1], 0);
          p.debt -= paid;
          p.money += net;
          this.send(conn, { t: 'payslip', gross: total, lines, net, debt: p.debt, n });
          if (net < total * 0.6) this.think(p, 'payday');
          if (paid > 0 && p.debt <= 0) { p.debt = 0; p.story.debtCleared = true; }
        } else {
          p.money += total;
          this.send(conn, { t: 'toast', text: `Sold ${n} ore for $${total.toLocaleString('en')}`, kind: 'money' });
        }
        if (total >= 3000 && this.mode === 'world') this.feed(`💰 ${p.name} sold a haul worth $${total.toLocaleString('en')}`, 'money');
        p.story.sells++;
        if (p.story.debtCleared) { p.story.debtCleared = false; if (this.trigger(p, 'debt')) break; }
        this.trigger(p, 'sell');
        break;
      }
      case 'fuel': {
        if (station !== 'fuel') return this.tell(p, 'Go to the FUEL pump.');
        const price = this.eco(p).fuel;
        if (p.fuel < st.tank * 0.25 && p.money < price * st.tank * 0.25) {
          // Broke and empty: the pump gives an advance so you can always get back to work.
          const advance = st.tank * 0.25 - p.fuel;
          p.fuel += advance;
          if (this.mode === 'solo') {
            p.debt += Math.ceil(advance * price * 2);
            this.send(conn, { t: 'toast', text: `Company fuel advance: +${Math.round(advance)} fuel, added to your debt at double price.` });
          } else {
            this.send(conn, { t: 'toast', text: `Emergency fuel: +${Math.round(advance)} on the house.` });
          }
          break;
        }
        const units = Math.min(st.tank - p.fuel, Math.floor(p.money / price));
        if (units <= 0) return this.tell(p, p.fuel >= st.tank ? 'Tank is already full.' : 'Not enough money.');
        p.money -= Math.ceil(units * price);
        p.fuel += units;
        if (st.tank - p.fuel < 1) p.fuel = st.tank;
        break;
      }
      case 'repair': {
        if (station !== 'shop') return this.tell(p, 'Repairs are at the SHOP.');
        const pts = Math.min(st.hull - p.hull, Math.floor(p.money / C.REPAIR_PRICE));
        if (pts <= 0) return this.tell(p, p.hull >= st.hull ? 'Hull is fine.' : 'Not enough money.');
        p.money -= Math.ceil(pts * C.REPAIR_PRICE);
        p.hull += pts;
        break;
      }
      case 'upgrade': {
        const U = own(C.UPGRADES, m.k);
        if (!U || station !== 'shop') return;
        const lvl = p.up[m.k];
        if (lvl >= C.MAX_LEVEL) return this.tell(p, 'Already maxed out!');
        const cost = this.eco(p).upgrade(m.k, lvl + 1);
        if (p.money < cost) return this.tell(p, `Need $${cost.toLocaleString('en')}.`);
        p.money -= cost;
        p.up[m.k]++;
        this.trigger(p, 'upgrade', { k: m.k, level: p.up[m.k] + 1 });
        const ns = stats(p);
        if (m.k === 'tank') p.fuel = ns.tank;
        if (m.k === 'hull') p.hull = ns.hull;
        this.send(conn, { t: 'toast', text: `${U.name} upgraded to level ${p.up[m.k] + 1}!`, kind: 'money' });
        if (p.up[m.k] === C.MAX_LEVEL) this.feed(`⭐ ${p.name} maxed out their ${U.name}`, 'money');
        break;
      }
      case 'buy': {
        const it = own(C.ITEMS, m.k);
        if (!it || station !== 'shop') return;
        const price = this.eco(p).item(m.k);
        if (p.money < price) return this.tell(p, `Need $${price}.`);
        p.money -= price;
        p.inv[m.k] = (p.inv[m.k] ?? 0) + (it.qty ?? 1);
        break;
      }
      case 'use': this.useItem(p, m.k); break;
      case 'lift': this.callLift(p, m.to); break;
      case 'rescue': {
        if (surface) return;
        p.cargo = {};
        this.teleportUp(p);
        p.fuel = Math.max(p.fuel, st.tank * 0.25);
        this.send(conn, { t: 'toast', text: 'Rescued! Your cargo was left behind.' });
        break;
      }
      case 'rebirth': {
        if (p.runDepth < C.REBIRTH_DEPTH) return this.tell(p, `Reach ${C.REBIRTH_DEPTH}m first.`);
        if (this.mode === 'solo') this.trigger(p, 'rebirth');
        else this.rebirth(p);
        break;
      }
      case 'talk': {
        const n = this.npcs.find((q) => Math.abs(q.x - p.x) + Math.abs(q.y - p.y) <= 1 && this.npcVisible(q, p));
        if (n) this.talkTo(p, n);
        break;
      }
      case 'storyDone': this.storyDone(p, m.id, m.choice); break;
      case 'pause': if (this.mode === 'solo') { p.paused = !!m.on; p.dir = ''; p.thrust = false; } break;
      case 'restartStory': {
        if (this.mode !== 'solo') return;
        this.restartStory(p, m.difficulty);
        break;
      }
      case 'chat': {
        const text = String(m.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
        if (!text || (p.cd.chat ?? 0) > this.time) return;
        p.cd.chat = this.time + 1;
        this.broadcast({ t: 'chat', id: p.id, name: p.name, color: p.color, text });
        break;
      }
    }
  }

  // Ride the Company lift from the stop you stand at to another open one. Cargo comes with you.
  callLift(p, to) {
    const from = C.liftStopAt(p.x, p.y);
    if (from === null || p.ride || p.dialog) return;
    const open = [0, ...C.LIFT_STOPS.filter((d) => d <= p.record)];
    if (!Number.isInteger(to) || to === from || !open.includes(to)) {
      return this.tell(p, open.length > 1 ? 'The lift doesn’t stop there yet.' : `The first landing opens once you’ve been ${C.LIFT.every}m down.`);
    }
    const fare = this.eco(p).fare(from, to);
    if (p.money >= fare) p.money -= fare;
    else if (this.mode === 'solo') {
      p.debt += fare * 2;
      this.send(p.conn, { t: 'toast', text: `Lift fare on credit: $${fare * 2} added to your debt.` });
    } else this.send(p.conn, { t: 'toast', text: 'The operator waves you through. Pay next time.' });
    const dur = 1.6 + Math.abs(to - from) / 220;
    Object.assign(p, { ride: { to, t: dur }, act: null, dir: '', tap: '' });
    this.send(p.conn, { t: 'ride', from, to, dur, fare });
    this.think(p, to < from ? 'liftUp' : 'liftDown');
  }

  rebirth(p) {
    p.stars++;
    Object.assign(p, {
      money: 0, runDepth: 0, cargo: {}, up: noUpgrades(),
      inv: { ...C.START_INV },
    });
    this.teleportUp(p);
    const ns = stats(p);
    p.fuel = ns.tank; p.hull = ns.hull;
    const msg = `🌟 ${p.name} was reborn — ★${p.stars} (+${Math.round(C.REBIRTH_BONUS * 100 * p.stars)}% ore value)`;
    if (this.mode === 'world') this.feed(msg, 'big');
    else if (p.conn) this.send(p.conn, { t: 'toast', text: msg, kind: 'money' });
  }

  // ---------- story ----------

  npcVisible(n, p) {
    if (!n.req) return true;
    if (n.req.flag && !p.story?.flags[n.req.flag]) return false;
    if (n.req.notFlag && p.story?.flags[n.req.notFlag]) return false;
    return (p.story?.sells ?? 0) >= (n.req.sells ?? 0);
  }

  // Story requirements: earlier beats seen, flags set, depth record, drill level (1-based).
  meets(p, req) {
    if (!req) return true;
    if (req.done && !req.done.every((d) => p.story.done.includes(d))) return false;
    if (req.flags && !req.flags.every((f) => p.story.flags[f])) return false;
    if (req.record && p.record < req.record) return false;
    if (req.drill && p.up.drill + 1 < req.drill) return false;
    if (req.sells && p.story.sells < this.eco(p).sale(req.sells)) return false;
    if (req.reply && p.story.sells < (p.story.marks?.[req.reply[0]] ?? Infinity) + req.reply[1]) return false;
    return true;
  }

  // Fire the first matching, not-yet-seen story beat. Returns true if one started.
  trigger(p, type, data = {}) {
    if (p.dialog || !p.conn) return false;
    // At most one story moment per payday; any others wait, in order, for the next ones.
    if (type === 'sell' && p.story.sellBeatAt === p.story.sells) return false;
    for (const b of BEATS) {
      const t = b.trigger;
      if (t.type !== type || !(b.modes ?? ['solo']).includes(this.mode)) continue;
      if (!REPEATABLE.has(type) && p.story.done.includes(b.id)) continue;
      if (type === 'depth' && (data.depth ?? 0) < t.depth) continue;
      if (type === 'sell' && p.story.sells < this.eco(p).sale(t.count)) continue;
      if (type === 'scrap' && (p.story.scraps ?? 0) < t.count) continue;
      if (type === 'npc' && t.npc !== data.npc) continue;
      if (type === 'upgrade' && (t.k !== data.k || data.level < t.level)) continue;
      if (!this.meets(p, b.req)) continue;
      p.dialog = b.id;
      if (type === 'sell') p.story.sellBeatAt = p.story.sells;
      p.act = null;
      p.dir = '';
      this.send(p.conn, { t: 'story', id: b.id, flags: p.story.flags });
      return true;
    }
    return false;
  }

  talkTo(p, n) {
    if ((p.cd.talk ?? 0) > this.time) return;
    p.cd.talk = this.time + 0.8;
    if (this.trigger(p, 'npc', { npc: n.npc })) return;
    const idle = CHARACTERS[n.npc]?.idle;
    const line = idle && this.pickLine(p, `idle:${n.npc}`, idle);
    if (line && p.conn) this.send(p.conn, { t: 'say', npc: n.npc, text: this.fill(line, p) });
  }

  storyDone(p, id, choice) {
    if (!p.dialog || p.dialog !== id) return;
    p.dialog = null;
    const b = beatById[id];
    if (!b) return;
    if (!REPEATABLE.has(b.trigger.type) && !p.story.done.includes(id)) p.story.done.push(id);
    const c = Number.isInteger(choice) ? b.choices?.[choice] : undefined;
    if (c?.set) p.story.flags[c.set] = true;
    this.applyEffect(p, b.effect);
    this.applyEffect(p, c?.effect);
    // Catch up on beats that were skipped while this one played (e.g. two depth marks crossed quickly).
    if (!p.dialog) {
      (b.trigger.npc === 'postman' && this.trigger(p, 'npc', { npc: 'postman' })) // hand over a letter right after saying hello
        || this.trigger(p, 'depth', { depth: p.runDepth }) || this.trigger(p, 'upgrade', { k: 'drill', level: p.up.drill + 1 })
        || (onSurface(p) && this.trigger(p, 'sell')) || this.trigger(p, 'scrap');
    }
  }

  applyEffect(p, effect) {
    const st = stats(p);
    switch (effect) {
      case 'repair': p.hull = st.hull; break;
      case 'refuel': p.fuel = st.tank; break;
      case 'dynamite': p.inv.dynamite = (p.inv.dynamite ?? 0) + 2; break;
      case 'ending-company': p.money += 50000; p.earned += 50000; p.story.flags.ending = 'company'; break;
      case 'ending-silence': p.story.flags.ending = 'silence'; break;
      case 'ending-recurrence':
        // The cycle begins again: you meet everyone anew, but your choices are remembered.
        p.story.flags.ending = 'recurrence';
        p.story.done = p.story.done.filter((d) => d === 'intro');
        // Everything that happened, happens again: Tomas and Jo are back, and so is what comes for them.
        for (const f of Object.keys(p.story.flags)) if (RELIVED.test(f)) delete p.story.flags[f];
        p.story.carry = [];
        p.story.marks = {};
        this.rebirth(p);
        break;
      case 'rebirth': this.rebirth(p); break;
      case 'tomas-dies': this.collapseTomas(p); break;
      case 'read-all': p.story.flags['read-all'] = true; break;
      // Letters are carried by hand: into your coat, up the shaft, over to the Postman.
      case 'take-tomas': this.carry(p, 'tomas', true); break;
      case 'take-home': this.carry(p, 'home', true); break;
      case 'post-tomas':
        this.carry(p, 'tomas', false);
        p.story.flags['carried-letter'] = true;
        this.mark(p, 'tomas'); // the reply takes a few paydays to come back over the hills
        break;
      // Jo: a stone sent home, then Jo herself, then section nine.
      case 'jo-asked': p.story.flags['jo-asked'] = true; break;
      case 'post-stone': this.carry(p, 'stone', false); p.story.flags['stone-sent'] = true; this.mark(p, 'stone'); break;
      case 'jo-arrives':
        p.story.flags['jo-here'] = true;
        if (p.story.flags['stone-sent']) this.carry(p, 'jostone', true); // she gives it back, for luck
        break;
      case 'jo-drawing': p.story.flags['jo-drawing'] = true; this.carry(p, 'drawing', true); break;
      case 'jo-dies':
        p.story.flags['jo-gone'] = true;
        p.debt += 400 + 1800; // funeral (dependant) + the rest of her contract, passed to next of kin
        this.mark(p, 'jo');
        break;
      case 'take-memo': this.carry(p, 'memo', true); break;
      case 'post-home': this.carry(p, 'home', false); p.story.flags['wrote-home'] = true; break;
      case 'new-debt': {
        // The new contract: lease on everything you were already using.
        let leased = 0;
        for (const k of C.UPGRADE_KEYS) for (let l = 1; l <= p.up[k]; l++) leased += this.eco(p).upgrade(k, l);
        p.debt = Math.round(START_DEBT + leased * 0.4);
        break;
      }
      case 'ending-home':
        p.story.flags.ending = 'home';
        this.teleportUp(p);
        break;
    }
  }

  // Remember the payday on which something happened, for beats that come "n sales later".
  mark(p, key) {
    (p.story.marks ??= {})[key] = p.story.sells;
  }

  // Story items in the miner's coat (letters). They survive death: the next employee finds them.
  carry(p, item, on) {
    const c = (p.story.carry ??= []).filter((k) => k !== item);
    p.story.carry = on ? [...c, item] : c;
  }

  // Tomas's hollow caves in. Only his lamp is left.
  collapseTomas(p) {
    p.story.flags['tomas-gone'] = true;
    const t = this.npcs.find((n) => n.npc === 'tomas');
    if (!t?.room) return;
    const { x0, y0, w, h } = t.room;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const keep = (x === t.x && y === t.y) || (y === t.y && Math.abs(x - t.x) === 1);
      if (!keep && Math.random() < 0.7) this.world.set(x, y, T.DIRT);
    }
  }

  // The miner's inner voice — rate-limited per kind of thought.
  think(p, key, pool = THOUGHTS[key], vars = {}) {
    if (this.mode !== 'solo' || !p.conn) return;
    p.thoughtAt ??= {};
    if ((p.thoughtAt[key] ?? -1e9) > this.time || (p.thoughtAt._any ?? -1e9) > this.time) return;
    const line = this.pickLine(p, `t:${key}`, pool);
    if (!line) return;
    const text = this.fill(line, p, vars);
    p.thoughtAt[key] = this.time + 120;
    p.thoughtAt._any = this.time + 12;
    this.send(p.conn, { t: 'think', text });
  }

  // Draw a line from a pool like a shuffled deck: no repeats until every line that fits the
  // player's story so far has been used. Bags live in memory; a fresh session reshuffles.
  pickLine(p, bagKey, pool) {
    const at = { done: p.story?.done ?? [], depth: C.depthOf(p.y), record: p.record ?? 0 };
    const ok = (i) => visible(pool[i], p.story?.flags ?? {}, at);
    p.bags ??= {};
    let bag = (p.bags[bagKey] ?? []).filter(ok);
    if (!bag.length) {
      bag = pool.map((_, i) => i).filter(ok).filter((i) => i !== p.bags[`${bagKey}:last`] || pool.length === 1);
      for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
      // Lines unlocked by the story so far come first — they are the freshest news.
      bag.sort((a, b) => (Array.isArray(pool[b]) ? 1 : 0) - (Array.isArray(pool[a]) ? 1 : 0));
    }
    if (!bag.length) return null;
    const i = bag.shift();
    p.bags[bagKey] = bag;
    p.bags[`${bagKey}:last`] = i;
    return lineText(pool[i]);
  }

  // Fill a line's placeholders: {dir} (given) and {where:npc} — roughly where that character lives,
  // as people in town would put it ("west of town").
  fill(text, p, vars = {}) {
    return text
      .replace(/\{dir\}/g, vars.dir ?? 'nearby')
      .replace(/\{where:(\w+)\}/g, (_, k) => {
        const n = this.npcs.find((q) => q.npc === k);
        if (!n) return 'somewhere below';
        const off = n.x - W / 2;
        return Math.abs(off) < 12 ? 'right under the town' : off < 0 ? 'west of town' : 'east of town';
      });
  }

  // Story mode: the miner senses a character they haven't met when they get close —
  // a cough, woodsmoke, a rumble — and roughly which way it comes from.
  senseNearby(p) {
    for (const n of this.npcs) {
      const pool = HINTS[n.npc];
      if (!pool || !n.room || !this.npcVisible(n, p) || p.story.done.includes(MEETS[n.npc])) continue;
      const dx = n.x - p.x, dy = n.y - p.y;
      if (Math.abs(dx) > 45 || Math.abs(dy) > 16 || Math.abs(dx) + Math.abs(dy) < 6) continue;
      const side = dx < -3 ? 'to the left' : dx > 3 ? 'to the right' : '';
      const vert = dy > 3 ? 'below' : dy < -3 ? 'above' : '';
      const dir = vert && side && Math.abs(dy) * 3 > Math.abs(dx) ? `${vert}, ${side}` : side || vert || 'very close';
      this.think(p, `hint:${n.npc}`, pool, { dir });
      return;
    }
  }

  useItem(p, k) {
    const it = own(C.ITEMS, k);
    if (!it || !(p.inv[k] > 0)) return this.tell(p, `No ${it?.name ?? 'item'} — buy at the SHOP.`);
    const st = stats(p);
    if (k === 'dynamite') {
      if (onSurface(p)) return this.tell(p, 'Not on the surface!');
      this.explode(p.x, p.y, 2.5, p, true);
    } else if (k === 'teleport') {
      if (onSurface(p)) return this.tell(p, 'You are already on the surface.');
      this.teleportUp(p);
    } else if (k === 'repair') {
      if (p.hull >= st.hull) return this.tell(p, 'Hull is fine.');
      p.hull = Math.min(st.hull, p.hull + 50);
    } else if (k === 'fuel') {
      if (p.fuel >= st.tank) return this.tell(p, 'Tank is full.');
      p.fuel = Math.min(st.tank, p.fuel + 40);
    } else if (k === 'ladder') {
      if (!this.placeLadder(p)) return this.tell(p, onSurface(p) ? 'No need for a ladder up here.' : 'There is already a ladder here.');
      return;
    }
    p.inv[k]--;
  }

  // Hang a ladder in the miner's cell (uses one from the inventory).
  placeLadder(p) {
    if (onSurface(p) || !(p.inv.ladder > 0) || this.world.get(p.x, p.y) !== T.AIR) return false;
    this.world.set(p.x, p.y, T.LADDER);
    p.inv.ladder--;
    return true;
  }

  teleportUp(p) {
    Object.assign(p, this.spawnPoint(), { act: null, fallN: 0 });
    this.broadcast({ t: 'fx', k: 'warp', x: p.x, y: p.y });
  }

  // ---------- simulation ----------

  update() {
    this.tick++;
    this.time += C.DT;
    for (const p of this.players.values()) this.updatePlayer(p);
    this.updateWorm();
    this.updateMeteor();
    this.updateEvents();
    for (const k of C.ORES) this.market[k] += (1 - this.market[k]) * 0.004 * C.DT;
    if (this.rush && this.time > this.rush.until) { this.rush = null; this.feed('The rush is over — prices are back to normal'); }

    const changes = this.world.takeChanges();
    if (changes.length) this.broadcast({ t: 'tc', c: changes });
    if (this.mode === 'solo' || this.tick % 2 === 0) this.snapshot(); // one viewer: send every tick for smoother motion
    if (this.tick % 5 === 0) for (const c of this.conns) this.streamChunks(c);
    if (this.tick % 40 === 0) this.broadcast({ t: 'mk', ...this.marketRow() });
    if (this.tick % 100 === 0) this.broadcast(this.leaderboard());
  }

  // Story mode: the body wears down underground and only recovers resting in town.
  wear(p) {
    if (this.mode !== 'solo') return;
    const surface = onSurface(p), before = p.tired;
    if (surface && p.trip) {
      p.trip = null;
      if (p.story.carry?.length) this.think(p, 'letter'); // back in town with a letter still in your coat
    }
    if (surface && !p.act && !p.dir) {
      p.tired = Math.max(0, p.tired - 5 * C.DT);
      if (before > 30 && p.tired <= 30) this.think(p, 'rest');
    } else if (!surface) {
      p.tired = Math.min(100, p.tired + 0.12 * C.DT);
      p.trip ??= {};
      const d = C.depthOf(p.y);
      if (d > 100 && !p.trip.alone) { p.trip.alone = true; if (Math.random() < 0.5) this.think(p, 'alone'); }
      if (d > 300 && !p.trip.deep) { p.trip.deep = true; this.think(p, 'deep'); }
      if (p.fuel < stats(p).tank * 0.2 && !p.trip.fuel) { p.trip.fuel = true; this.think(p, 'lowFuel'); }
      if (this.tick % (5 * C.TICK_RATE) === 0) this.senseNearby(p);
      // Long quiet stretches get a passing thought.
      p.trip.driftAt ??= this.time + 45 + Math.random() * 30;
      if (this.time > p.trip.driftAt && !p.dialog) { p.trip.driftAt = this.time + 80 + Math.random() * 60; this.think(p, 'drift'); }
    }
    if (before < 50 && p.tired >= 50) this.think(p, 'tired50');
    if (before < 80 && p.tired >= 80) this.think(p, 'tired80');
  }

  updatePlayer(p) {
    if (p.dialog || p.paused) return; // frozen while reading story dialogue or in the pause menu
    if (p.ride) {
      if ((p.ride.t -= C.DT) > 0) return;
      Object.assign(p, { x: C.LIFT.x, y: C.liftRow(p.ride.to), fallN: 0, ride: null });
      return;
    }
    this.wear(p);
    let carry = 0;
    if (p.act?.type === 'dig' && p.dir !== p.act.d) p.act = null;
    if (p.act) {
      p.act.t -= C.DT;
      if (p.act.t > 0) return;
      const a = p.act;
      p.act = null;
      carry = -a.t;
      this.finish(p, a);
      if (p.dialog) return; // the step opened a story beat: wait for it before doing anything else
    }
    this.startAction(p);
    // Leftover time from the finished action counts toward the next one, so speed isn't capped by the tick rate.
    if (p.act && carry) p.act.t -= carry;
  }

  // Is there something solid to grab on the left or right of this cell — or of the cell just below,
  // so you can hang on to the lip of a shaft and step out sideways?
  besideWall(x, y) {
    const w = this.world, solid = (cx, cy) => !C.passable(w.get(cx, cy));
    return solid(x - 1, y) || solid(x + 1, y) || solid(x - 1, y + 1) || solid(x + 1, y + 1);
  }

  // Somewhere you can climb without the thruster: a wall to grip or a ladder.
  climbable(x, y) {
    return this.world.get(x, y) === T.LADDER || this.besideWall(x, y);
  }

  startAction(p) {
    const w = this.world;
    const st = stats(p);
    // Holding ↑ keeps you up: against a wall you cling for free; in open air the thruster burns fuel.
    const dir = p.dir || p.tap || '';
    p.tap = '';
    const holdingUp = dir === 'U' || p.thrust;
    const onLadder = w.get(p.x, p.y) === T.LADDER;
    // Dry tank, open air, nothing to hold: hang a ladder instead of dropping.
    if (holdingUp && p.fuel <= 0 && !onLadder && !this.besideWall(p.x, p.y) && this.placeLadder(p)) return;
    const hovering = holdingUp && (p.fuel > 0 || this.climbable(p.x, p.y));
    if (C.passable(w.get(p.x, p.y + 1)) && !hovering && !onLadder) {
      p.act = { type: 'fall', t: C.FALL_TIME };
      return;
    }
    if (onLadder) p.fallN = 0; // caught a ladder: no hard landing
    if (p.fallN > 0) {
      const safe = 8 + 2 * p.up.hull;
      if (p.fallN > safe) this.hurt(p, (p.fallN - safe) * C.FALL_DAMAGE, 'fell too far');
      p.fallN = 0;
    }
    if (!dir) return;
    const [dx, dy] = DIRS[dir], tx = p.x + dx, ty = p.y + dy;
    // Walking is free — on the surface, along any tunnel floor, or on a ladder — so an empty tank never strands you.
    // Only the drill and the thruster burn fuel.
    const grounded = !C.passable(w.get(p.x, p.y + 1)) || onLadder;
    const stroll = C.passable(w.get(tx, ty)) && ((dy === 0 && grounded) || (dy > 0 && (onLadder || w.get(tx, ty) === T.LADDER)));
    // Climbing up a shaft with a wall beside you costs no fuel, so you can always get out of a hole you dug.
    const climb = dy < 0 && C.passable(w.get(tx, ty)) && this.climbable(p.x, p.y);
    if (p.fuel <= 0 && !stroll && !climb) {
      return this.tell(p, onSurface(p) ? 'Out of fuel — walk to the FUEL pump.' : 'Out of fuel! Walk, hang a ladder [5], use a fuel can [4] or call rescue [R].', 'nofuel');
    }
    if (!w.inBounds(tx, ty)) return;
    if (this.wormAt(tx, ty)) {
      if ((p.cd.atk ?? 0) > this.time) return;
      p.cd.atk = this.time + 0.25;
      p.fuel = Math.max(0, p.fuel - 0.2);
      this.hitWorm(p, 8 * st.speed, tx, ty);
      return;
    }
    const t = w.get(tx, ty);
    if (C.passable(t)) {
      p.act = { type: 'move', tx, ty, t: climb ? C.CLIMB_TIME : dy < 0 ? C.UP_TIME : C.MOVE_TIME, d: dir, climb };
      if (!stroll && !climb) p.fuel = Math.max(0, p.fuel - (dy < 0 ? C.FUEL_UP : C.FUEL_MOVE));
      return;
    }
    if (t === T.LAVA) {
      if ((p.cd.lava ?? 0) < this.time) { p.cd.lava = this.time + 0.6; this.hurt(p, 12, 'melted in lava'); }
      return this.tell(p, 'LAVA! Too hot to dig.', 'lava');
    }
    const def = TILES[t];
    if (def.hard > st.power) return this.tell(p, `${def.name ?? def.key} is too hard — upgrade your drill.`, 'hard');
    if (p.dir !== dir) return; // a tap walks one cell, but digging takes a held button
    const weary = this.mode === 'solo' ? 1 + (p.tired / 100) ** 2 * 0.8 : 1; // tired hands dig slower
    const dur = ((C.DIG_TIME * def.hard) / st.speed) * weary + C.DIG_BASE;
    if (this.mode === 'solo' && p.trip && !p.trip.dug) { p.trip.dug = true; this.think(p, 'firstDig'); }
    p.act = { type: 'dig', tx, ty, t: dur, total: dur, d: dir };
  }

  finish(p, a) {
    const w = this.world;
    if (a.type === 'fall') {
      if (C.passable(w.get(p.x, p.y + 1))) { p.y++; p.fallN++; }
    } else if (a.type === 'move') {
      if (C.passable(w.get(a.tx, a.ty))) {
        // A long climb home gets the miner thinking.
        if (a.ty < p.y && p.trip && (p.trip.climbed = (p.trip.climbed ?? 0) + 1) % 40 === 25) this.think(p, 'ascent');
        p.x = a.tx; p.y = a.ty;
      }
    } else if (a.type === 'dig') {
      const t = w.get(a.tx, a.ty), def = TILES[t];
      if (t === T.GAS) {
        this.explode(a.tx, a.ty, 2, null, false);
        if (this.hurt(p, 25, 'hit a gas pocket')) return; // died: already back in town
      } else if (t !== T.AIR && def.hard < 99) {
        p.fuel = Math.max(0, p.fuel - C.FUEL_DIG * def.hard);
        if (def.ore) this.collect(p, t, a.ty);
        if (this.mode === 'solo') p.tired = Math.min(100, p.tired + 0.25);
        w.set(a.tx, a.ty, T.AIR);
      }
      if (C.passable(w.get(a.tx, a.ty))) { p.x = a.tx; p.y = a.ty; }
    }
    const d = C.depthOf(p.y);
    if (d > p.runDepth) p.runDepth = d;
    if (d > 0 && d % 10 === 0) this.trigger(p, 'depth', { depth: d });
    if (d > p.record) {
      const before = C.layerOf(p.record), now = C.layerOf(d);
      if (now !== before && this.mode === 'world') this.feed(`⛏ ${p.name} broke into ${now.name} (${d}m)!`, 'big');
      p.record = d;
    }
  }

  collect(p, t, y) {
    const def = TILES[t];
    if (cargoCount(p) >= stats(p).cargo) return this.tell(p, 'Cargo full! Sell at the MARKET.', 'full');
    if (cargoCount(p) + 1 >= stats(p).cargo) this.think(p, 'full');
    p.cargo[def.key] = (p.cargo[def.key] ?? 0) + 1;
    if (p.conn) this.send(p.conn, { t: 'ore', k: def.key });
    // Jo asked for a shiny stone from inside the mountain: the first one you find after that is hers.
    const fl = p.story?.flags;
    if (this.mode === 'solo' && fl?.['jo-asked'] && !fl['stone-found']) {
      fl['stone-found'] = true;
      this.carry(p, 'stone', true);
      if (p.conn) this.send(p.conn, { t: 'think', text: 'That one. It catches the lamp. That one’s for Jo.' });
    }
    this.maybeScrap(p, y);
    if (def.value >= 800) this.feed(`✨ ${p.name} found ${def.name === 'Artifact' ? 'an' : 'a'} ${def.name} at ${C.depthOf(y)}m!`, 'rare');
  }

  // Story mode: now and then a scrap of an old manifesto turns up in the ore (at most one per trip).
  maybeScrap(p, y) {
    if (this.mode !== 'solo' || !p.trip || p.trip.scrap) return;
    const next = SCRAPS[p.story.scraps ?? 0];
    if (!next || C.depthOf(y) < next.depth || Math.random() > 0.07) return;
    p.trip.scrap = true;
    p.story.scraps = (p.story.scraps ?? 0) + 1;
    this.trigger(p, 'scrap');
  }

  // Returns true if the miner died (and has been sent back to town).
  hurt(p, dmg, why) {
    p.hull -= dmg;
    if (p.conn) this.send(p.conn, { t: 'hurt', v: Math.round(dmg) });
    if (p.hull > 0) return false;
    const d = C.depthOf(p.y);
    if (this.mode === 'solo') {
      // No respawn — a replacement. Same boots, same debt, a new number.
      p.debt += DEATH_FEE;
      if (p.conn) this.send(p.conn, { t: 'obit', why, depth: d, no: p.workers, fee: DEATH_FEE, debt: p.debt, cargo: cargoCount(p), letters: p.story.carry?.length ?? 0 });
      p.workers++;
      p.tired = 0;
      p.thoughtAt = {};
      setTimeout(() => this.think(p, 'respawn'), 1500);
    } else {
      this.feed(`💀 ${p.name} ${why} at ${d}m and lost their cargo`, 'death');
    }
    const st = stats(p);
    p.cargo = {};
    Object.assign(p, this.spawnPoint(), { act: null, fallN: 0, hull: st.hull, fuel: Math.max(p.fuel, st.tank * 0.5) });
    return true;
  }

  explode(cx, cy, r, by, collect) {
    const w = this.world;
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > r * r || y <= SURFACE) continue;
      const t = w.get(x, y);
      if (t === T.AIR || TILES[t].hard >= 99) continue;
      if (collect && by && TILES[t].ore) this.collect(by, t, y);
      w.set(x, y, T.AIR);
    }
    this.broadcast({ t: 'fx', k: 'boom', x: cx, y: cy, r });
  }

  price(k) {
    const base = TILES[C.tileByKey[k]].value;
    return base * this.market[k] * (this.rush?.ore === k ? this.rush.mult : 1);
  }

  marketRow() {
    return { p: Object.fromEntries(C.ORES.map((k) => [k, Math.round(this.price(k))])), rush: this.rush ? { ore: this.rush.ore, left: Math.ceil(this.rush.until - this.time) } : null };
  }

  leaderboard() {
    const all = [...this.accounts.values()];
    return {
      t: 'lb',
      deep: all.sort((a, b) => b.record - a.record).slice(0, 10).map((a) => [a.name, a.record, a.stars, a.conn ? 1 : 0]),
      rich: all.sort((a, b) => b.earned - a.earned).slice(0, 10).map((a) => [a.name, Math.round(a.earned), a.stars, a.conn ? 1 : 0]),
    };
  }

  snapshot() {
    const rows = [...this.players.values()].map((p) => [
      p.id, p.x, p.y, p.act?.climb ? 4 : ACT_IDX[p.act?.type] ?? 0, DIR_IDX[p.act?.d ?? p.dir] ?? 0,
      p.act?.type === 'dig' ? Math.round((1 - p.act.t / p.act.total) * 9) : 0,
    ]);
    const worm = this.worm ? { s: this.worm.seg.flatMap((s) => [s.x, s.y]), hp: Math.ceil(this.worm.hp), mx: this.worm.maxHp } : null;
    const meteor = this.meteor ? { x: this.meteor.x, left: Math.ceil(this.meteor.at - this.time) } : null;
    const base = JSON.stringify({ p: rows, worm, meteor }).slice(1, -1);
    for (const conn of this.conns) {
      const p = conn.player;
      let me = '';
      if (p) {
        me = `,"me":${JSON.stringify({
          m: Math.floor(p.money), f: r1(p.fuel), h: Math.ceil(p.hull), c: p.cargo, i: p.inv, u: p.up, s: p.stars, r: p.record, rd: p.runDepth,
          ss: p.story?.sells ?? 0, fl: p.story?.flags ?? {}, k: p.story?.carry ?? [], debt: Math.round(p.debt ?? 0), t: Math.round(p.tired ?? 0), wk: p.workers ?? 1, df: p.difficulty ?? 'normal',
        })}`;
      }
      this.send(conn, `{"t":"s",${base}${me}}`);
    }
  }

  // ---------- world events ----------

  updateEvents() {
    if (this.time >= this.nextVeins) {
      this.nextVeins = this.time + 480 * EVENT_SCALE;
      if (this.world.reseed(1, 200, 350)) this.feed('⛏ Fresh ore veins discovered in the upper layers', 'info');
    }
    if (this.time < this.nextEvent || this.players.size === 0) return;
    this.nextEvent = this.time + rand(150, 240) * EVENT_SCALE;
    // The story keeps only the quiet dread of a cave-in; rushes, meteors and the worm belong to the Commons.
    if (this.mode === 'solo') return void this.caveIn();
    const deep = [...this.players.values()].filter((p) => C.depthOf(p.y) > 80);
    const options = ['rush', 'rush', 'meteor', 'cavein'];
    if (deep.length && !this.worm) options.push('worm', 'worm');
    const pick = options[Math.floor(Math.random() * options.length)];
    if (pick === 'rush') this.startRush();
    else if (pick === 'meteor') this.startMeteor();
    else if (pick === 'cavein') this.caveIn();
    else this.spawnWorm(deep[Math.floor(Math.random() * deep.length)]);
  }

  startRush() {
    const ore = C.ORES.slice(0, 7)[Math.floor(Math.random() * 7)];
    this.rush = { ore, mult: 3, until: this.time + 120 };
    this.feed(`💰 RUSH! ${TILES[C.tileByKey[ore]].name} sells for 3× for the next 2 minutes`, 'big');
    this.broadcast({ t: 'mk', ...this.marketRow() });
  }

  startMeteor() {
    if (this.meteor) return;
    let x;
    do x = Math.floor(rand(10, W - 10)); while (x > C.TOWN.x0 - 8 && x < C.TOWN.x1 + 8);
    this.meteor = { x, at: this.time + 25 };
    this.feed(`☄ METEOR incoming! Impact in 25s — watch the sky`, 'big');
  }

  updateMeteor() {
    const m = this.meteor;
    if (!m || this.time < m.at) return;
    this.meteor = null;
    const w = this.world, cx = m.x, cy = SURFACE + 1, r = 4.5;
    for (let y = SURFACE; y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r && TILES[w.get(x, y)].hard < 99) w.set(x, y, T.AIR);
    }
    let placed = 0;
    for (let i = 0; i < 80 && placed < 7; i++) {
      const a = rand(0.15, Math.PI - 0.15), d = rand(r + 0.5, r + 2.5);
      const x = Math.round(cx + Math.cos(a) * d), y = Math.round(cy + Math.sin(a) * d);
      if (y > SURFACE && w.isRock(w.get(x, y))) { w.set(x, y, T.METEORITE); placed++; }
    }
    for (const p of this.players.values()) if (Math.hypot(p.x - cx, p.y - cy) < 7) this.hurt(p, 30, 'was flattened by a meteor');
    this.broadcast({ t: 'fx', k: 'boom', x: cx, y: cy, r: 6 });
    this.feed(`☄ Meteor impact at column ${cx}! Meteorite ✦ is worth $1,500 each`, 'big');
  }

  caveIn() {
    const candidates = [...this.players.values()].filter((p) => C.depthOf(p.y) > 15);
    if (!candidates.length) return this.mode === 'world' && this.startRush();
    const target = candidates[Math.floor(Math.random() * candidates.length)];
    const cx = Math.round(target.x + rand(-25, 25)), cy = Math.round(target.y + rand(-8, 8));
    const w = this.world, occupied = new Set([...this.players.values(), ...this.npcs].map((q) => `${q.x},${q.y}`));
    let filled = 0;
    for (let y = cy - 5; y <= cy + 5; y++) for (let x = cx - 12; x <= cx + 12; x++) {
      if (y <= SURFACE + 1 || w.get(x, y) !== T.AIR || occupied.has(`${x},${y}`) || Math.random() > 0.55) continue;
      const rock = Object.keys(C.layerOf(C.depthOf(y)).rock)[0];
      w.set(x, y, C.tileByKey[rock]);
      filled++;
    }
    if (!filled) return;
    this.feed(`⚠ CAVE-IN around ${C.depthOf(cy)}m! Tunnels collapsed`, 'death');
    if (this.mode === 'solo' && target.conn) {
      this.send(target.conn, { t: 'toast', text: 'The rock groans. Somewhere nearby, a tunnel caves in.' });
      this.broadcast({ t: 'fx', k: 'rumble', x: cx, y: cy });
    }
  }

  spawnWorm(near) {
    if (!near) return;
    const y = Math.max(SURFACE + 15, Math.min(H - 10, near.y + Math.round(rand(-12, 12))));
    const x0 = near.x < W / 2 ? Math.min(W - 15, near.x + 25) : Math.max(15, near.x - 25);
    const nearby = [...this.players.values()].filter((p) => Math.abs(p.y - y) < 60).length;
    const maxHp = 250 + 150 * nearby;
    this.worm = { seg: Array.from({ length: 10 }, (_, i) => ({ x: x0 + i, y })), hp: maxHp, maxHp, dmg: new Map(), until: this.time + 240, moveT: 0 };
    this.feed(`🐛 A GIANT WORM is tunnelling at ${C.depthOf(y)}m! Drill into it together for a big reward`, 'big');
  }

  wormAt(x, y) {
    return this.worm?.seg.some((s) => s.x === x && s.y === y) ?? false;
  }

  updateWorm() {
    const wm = this.worm;
    if (!wm) return;
    if (this.time > wm.until) { this.worm = null; this.feed('🐛 The worm burrowed away into the dark…'); return; }
    if ((wm.moveT -= C.DT) > 0) return;
    wm.moveT = 0.3;
    const head = wm.seg[0], w = this.world;
    let target = null, best = 50;
    for (const p of this.players.values()) {
      const d = Math.abs(p.x - head.x) + Math.abs(p.y - head.y);
      if (d < best) { best = d; target = p; }
    }
    const opts = Object.values(DIRS)
      .map(([dx, dy]) => ({ x: head.x + dx, y: head.y + dy }))
      .filter((c) => c.x > 0 && c.x < W - 1 && c.y > SURFACE + 3 && c.y < H - 1 && TILES[w.get(c.x, c.y)].hard < 99 && !wm.seg.some((s) => s.x === c.x && s.y === c.y))
      .map((c) => ({ ...c, score: (target ? Math.abs(c.x - target.x) + Math.abs(c.y - target.y) : 0) + Math.random() * 4 }))
      .sort((a, b) => a.score - b.score);
    const next = opts[0];
    if (!next) return;
    const t = w.get(next.x, next.y);
    if (t !== T.LAVA && TILES[t].hard < 99) w.set(next.x, next.y, T.AIR);
    wm.seg.unshift({ x: next.x, y: next.y });
    wm.seg.pop();
    for (const p of this.players.values()) {
      if (Math.abs(p.x - next.x) + Math.abs(p.y - next.y) <= 1 && (p.cd.worm ?? 0) < this.time) {
        p.cd.worm = this.time + 1;
        this.hurt(p, 12, 'was eaten by the worm');
      }
    }
  }

  hitWorm(p, dmg, x, y) {
    const wm = this.worm;
    wm.hp -= dmg;
    wm.dmg.set(p, (wm.dmg.get(p) ?? 0) + dmg);
    this.broadcast({ t: 'fx', k: 'hit', x, y });
    if (wm.hp > 0) return;
    this.worm = null;
    const layer = C.LAYERS.indexOf(C.layerOf(C.depthOf(wm.seg[0].y)));
    const pool = 1500 + 600 * layer, total = [...wm.dmg.values()].reduce((s, v) => s + v, 0);
    const ranked = [...wm.dmg.entries()].sort((a, b) => b[1] - a[1]);
    for (const [q, d] of ranked) {
      const reward = Math.round((pool * d) / total);
      q.money += reward;
      q.earned += reward;
      if (q.conn) this.send(q.conn, { t: 'toast', text: `Worm slain! +$${reward.toLocaleString('en')}`, kind: 'money' });
    }
    for (const s of wm.seg) if (Math.random() < 0.5 && this.world.get(s.x, s.y) === T.AIR) this.world.set(s.x, s.y, Math.random() < 0.3 ? T.ARTIFACT : T.RUBY);
    this.broadcast({ t: 'fx', k: 'boom', x: wm.seg[0].x, y: wm.seg[0].y, r: 4 });
    this.feed(`🏆 The worm was slain! MVP: ${ranked[0][0].name}. It dropped treasure…`, 'big');
  }
}
