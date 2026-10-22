// One persistent shared mine: players, digging, economy, world events, saving.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as C from '../shared/config.js';
import { World } from './world.js';
import { BEATS, beatById, CHARACTERS, SITES, TOWN_NPCS } from '../shared/story.js';

const { T, TILES, W, H, SURFACE } = C;
const COLORS = ['#ff6b6b', '#ffd93d', '#6bcbff', '#b388ff', '#7dff9b', '#ff9f43', '#ff7ad9', '#4dd4c6',
  '#f7f78a', '#9fa8ff', '#ffb3a7', '#a0ff6b', '#ff5ea0', '#5ef0ff', '#ffc46b', '#d4a5ff'];
const DIRS = { L: [-1, 0], R: [1, 0], U: [0, -1], D: [0, 1] };
const DIR_IDX = { '': 0, L: 1, R: 2, U: 3, D: 4 };
const ACT_IDX = { move: 1, dig: 2, fall: 3 };
const EVENT_SCALE = Number(process.env.EVENT_SCALE ?? 1); // <1 = more frequent world events
const SAVE_FIELDS = ['name', 'key', 'pin', 'color', 'money', 'earned', 'stars', 'record', 'runDepth', 'up', 'inv', 'cargo', 'fuel', 'hull', 'x', 'y', 'story'];

const rand = (a, b) => a + Math.random() * (b - a);
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
    this.loop = setInterval(() => this.update(), 1000 / C.TICK_RATE);
    this.saver = setInterval(() => this.save(), 30_000);
  }

  // ---------- persistence ----------

  load() {
    try {
      const data = JSON.parse(fs.readFileSync(this.saveFile, 'utf8'));
      if (this.world.load(data.world)) {
        for (const a of data.accounts ?? []) this.accounts.set(a.key, a);
        this.market = { ...this.market, ...(data.market ?? {}) };
        this.npcs = data.npcs ?? this.townNpcs();
        if (this.mode === 'world') console.log(`Loaded world + ${this.accounts.size} miners from ${this.saveFile}`);
        return;
      }
    } catch {}
    this.resetWorld();
  }

  townNpcs() {
    return TOWN_NPCS.map((n) => ({ npc: n.npc, x: W / 2 + n.dx, y: SURFACE - 1, req: this.mode === 'solo' ? n.req : null }));
  }

  // Fresh map. Accounts keep their progress but are moved back to town.
  resetWorld() {
    this.world.generate();
    this.npcs = this.townNpcs();
    if (this.mode === 'solo') {
      for (const site of SITES) {
        const x0 = Math.floor(rand(8, W - 8 - site.w)), y0 = SURFACE + site.depth - site.h + 1;
        this.npcs.push({ npc: site.npc, ...this.world.carveRoom(x0, y0, site.w, site.h) });
      }
    }
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
      let p = this.accounts.get(key);
      if (p && p.pin !== hashPin(key, pin)) {
        // Someone else owns this name: suggest a free variant instead of leaving the player stuck.
        let n = 2, suggest;
        do suggest = `${name.slice(0, 12)}${n++}`; while (this.accounts.has(suggest.toLowerCase()));
        return this.send(conn, {
          t: 'error', suggest,
          text: `"${name}" is already taken by another miner. Enter its PIN to continue that save, or play as "${suggest}" — just press DIG IN.`,
        });
      }
      if (!p) {
        const s0 = { tank: C.UPGRADES.tank.value[0], hull: C.UPGRADES.hull.value[0] };
        p = {
          name, key, pin: hashPin(key, pin), color: COLORS[this.accounts.size % COLORS.length],
          money: 0, earned: 0, stars: 0, record: 0, runDepth: 0,
          up: Object.fromEntries(C.UPGRADE_KEYS.map((k) => [k, 0])),
          inv: { dynamite: 1, teleport: 1, repair: 0, fuel: 0 }, cargo: {},
          fuel: s0.tank, hull: s0.hull, ...this.spawnPoint(),
        };
        this.accounts.set(key, p);
      }
      if (p.conn) { this.send(p.conn, { t: 'error', text: 'Logged in from another device.' }); p.conn.ws.close(); this.leave(p.conn); }
      p.story ??= { done: [], flags: {}, sells: 0 };
      Object.assign(p, { id: this.nextId++, conn, dir: '', act: null, fallN: 0, cd: {}, told: {}, dialog: null });
      if (this.world.get(p.x, p.y) !== T.AIR) Object.assign(p, this.spawnPoint());
      conn.player = p;
      this.players.set(p.id, p);
      this.broadcast({ t: 'pj', p: [p.id, p.name, p.color] });
      if (this.mode === 'world') this.feed(`${p.name} entered the mine`, 'join');
    }
    conn.joined = true;
    this.conns.add(conn);
    this.send(conn, {
      t: 'welcome', you: conn.player?.id ?? null, host: conn.host, mode: this.mode, npcs: this.npcs,
      roster: [...this.players.values()].map((q) => [q.id, q.name, q.color]),
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
    this.save();
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
    const surface = p.y <= SURFACE - 1, station = surface ? C.stationAt(p.x)?.key : null;
    const st = stats(p);
    switch (m.t) {
      case 'in':
        p.dir = DIRS[m.d] ? m.d : '';
        p.thrust = !!m.up; // thruster held while steering sideways
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
        p.money += total;
        p.earned += total;
        this.send(conn, { t: 'toast', text: `Sold ${n} ore for $${total.toLocaleString('en')}`, kind: 'money' });
        if (total >= 3000 && this.mode === 'world') this.feed(`💰 ${p.name} sold a haul worth $${total.toLocaleString('en')}`, 'money');
        p.story.sells++;
        this.trigger(p, 'sell');
        break;
      }
      case 'fuel': {
        if (station !== 'fuel') return this.tell(p, 'Go to the FUEL pump.');
        const units = Math.min(st.tank - p.fuel, Math.floor(p.money / C.FUEL_PRICE));
        if (units <= 0) return this.tell(p, p.fuel >= st.tank ? 'Tank is already full.' : 'Not enough money.');
        p.money -= Math.ceil(units * C.FUEL_PRICE);
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
        const U = C.UPGRADES[m.k];
        if (!U || station !== 'shop') return;
        const lvl = p.up[m.k];
        if (lvl >= C.MAX_LEVEL) return this.tell(p, 'Already maxed out!');
        const cost = U.cost[lvl + 1];
        if (p.money < cost) return this.tell(p, `Need $${cost.toLocaleString('en')}.`);
        p.money -= cost;
        p.up[m.k]++;
        const ns = stats(p);
        if (m.k === 'tank') p.fuel = ns.tank;
        if (m.k === 'hull') p.hull = ns.hull;
        this.send(conn, { t: 'toast', text: `${U.name} upgraded to level ${p.up[m.k] + 1}!`, kind: 'money' });
        if (p.up[m.k] === C.MAX_LEVEL) this.feed(`⭐ ${p.name} maxed out their ${U.name}`, 'money');
        break;
      }
      case 'buy': {
        const it = C.ITEMS[m.k];
        if (!it || station !== 'shop') return;
        if (p.money < it.price) return this.tell(p, `Need $${it.price}.`);
        p.money -= it.price;
        p.inv[m.k] = (p.inv[m.k] ?? 0) + 1;
        break;
      }
      case 'use': this.useItem(p, m.k); break;
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
      case 'chat': {
        const text = String(m.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
        if (!text || (p.cd.chat ?? 0) > this.time) return;
        p.cd.chat = this.time + 1;
        this.broadcast({ t: 'chat', id: p.id, name: p.name, color: p.color, text });
        break;
      }
    }
  }

  rebirth(p) {
    p.stars++;
    Object.assign(p, {
      money: 0, runDepth: 0, cargo: {}, up: Object.fromEntries(C.UPGRADE_KEYS.map((k) => [k, 0])),
      inv: { dynamite: 1, teleport: 1, repair: 0, fuel: 0 },
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
    return !n.req || (p.story?.sells ?? 0) >= (n.req.sells ?? 0);
  }

  // Fire the first matching, not-yet-seen story beat. Returns true if one started.
  trigger(p, type, data = {}) {
    if (p.dialog || !p.conn) return false;
    for (const b of BEATS) {
      const t = b.trigger;
      if (t.type !== type || !(b.modes ?? ['solo']).includes(this.mode)) continue;
      if (type !== 'rebirth' && p.story.done.includes(b.id)) continue;
      if (type === 'depth' && (data.depth ?? 0) < t.depth) continue;
      if (type === 'sell' && p.story.sells < t.count) continue;
      if (type === 'npc' && t.npc !== data.npc) continue;
      p.dialog = b.id;
      p.act = null;
      p.dir = '';
      this.send(p.conn, { t: 'story', id: b.id });
      return true;
    }
    return false;
  }

  talkTo(p, n) {
    if ((p.cd.talk ?? 0) > this.time) return;
    p.cd.talk = this.time + 0.8;
    if (this.trigger(p, 'npc', { npc: n.npc })) return;
    const idle = CHARACTERS[n.npc]?.idle;
    if (idle && p.conn) this.send(p.conn, { t: 'say', npc: n.npc, text: idle[Math.floor(Math.random() * idle.length)] });
  }

  storyDone(p, id, choice) {
    if (!p.dialog || p.dialog !== id) return;
    p.dialog = null;
    const b = beatById[id];
    if (!b) return;
    if (b.trigger.type !== 'rebirth' && !p.story.done.includes(id)) p.story.done.push(id);
    const c = b.choices?.[choice];
    if (!c) return;
    if (c.set) p.story.flags[c.set] = true;
    const st = stats(p);
    switch (c.effect) {
      case 'repair': p.hull = st.hull; break;
      case 'dynamite': p.inv.dynamite = (p.inv.dynamite ?? 0) + 2; break;
      case 'ending-company': p.money += 50000; p.earned += 50000; p.story.flags.ending = 'company'; break;
      case 'ending-silence': p.story.flags.ending = 'silence'; break;
      case 'ending-recurrence': p.story.flags.ending = 'recurrence'; p.story.done = p.story.done.filter((d) => d === 'intro'); this.rebirth(p); break;
      case 'rebirth': this.rebirth(p); break;
    }
  }

  useItem(p, k) {
    if (!C.ITEMS[k] || !(p.inv[k] > 0)) return this.tell(p, `No ${C.ITEMS[k]?.name ?? 'item'} — buy at the SHOP.`);
    const st = stats(p);
    if (k === 'dynamite') {
      if (p.y <= SURFACE - 1) return this.tell(p, 'Not on the surface!');
      this.explode(p.x, p.y, 2.5, p, true);
    } else if (k === 'teleport') {
      if (p.y <= SURFACE - 1) return this.tell(p, 'You are already on the surface.');
      this.teleportUp(p);
    } else if (k === 'repair') {
      if (p.hull >= st.hull) return this.tell(p, 'Hull is fine.');
      p.hull = Math.min(st.hull, p.hull + 50);
    } else if (k === 'fuel') {
      if (p.fuel >= st.tank) return this.tell(p, 'Tank is full.');
      p.fuel = Math.min(st.tank, p.fuel + 40);
    }
    p.inv[k]--;
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
    if (this.tick % 2 === 0) this.snapshot();
    if (this.tick % 5 === 0) for (const c of this.conns) this.streamChunks(c);
    if (this.tick % 40 === 0) this.broadcast({ t: 'mk', ...this.marketRow() });
    if (this.tick % 100 === 0) this.broadcast(this.leaderboard());
  }

  updatePlayer(p) {
    if (p.dialog) return; // frozen while reading story dialogue
    let carry = 0;
    if (p.act) {
      p.act.t -= C.DT;
      if (p.act.t > 0) return;
      const a = p.act;
      p.act = null;
      carry = -a.t;
      this.finish(p, a);
    }
    this.startAction(p);
    // Leftover time from the finished action counts toward the next one, so speed isn't capped by the tick rate.
    if (p.act && carry) p.act.t -= carry;
  }

  startAction(p) {
    const w = this.world;
    const st = stats(p);
    const hovering = (p.dir === 'U' || p.thrust) && p.fuel > 0;
    if (C.passable(w.get(p.x, p.y + 1)) && !hovering) {
      p.act = { type: 'fall', t: C.FALL_TIME };
      return;
    }
    if (p.fallN > 0) {
      const safe = 5 + 2 * p.up.hull;
      if (p.fallN > safe) this.hurt(p, (p.fallN - safe) * C.FALL_DAMAGE, 'fell too far');
      p.fallN = 0;
    }
    if (!p.dir) return;
    if (p.fuel <= 0) return this.tell(p, 'Out of fuel! Use a fuel can [4] or call rescue [R].', 'nofuel');

    const [dx, dy] = DIRS[p.dir], tx = p.x + dx, ty = p.y + dy;
    if (!w.inBounds(tx, ty)) return;
    const npc = this.npcs.find((n) => n.x === tx && n.y === ty && this.npcVisible(n, p));
    if (npc) return this.talkTo(p, npc);
    if (this.wormAt(tx, ty)) {
      if ((p.cd.atk ?? 0) > this.time) return;
      p.cd.atk = this.time + 0.25;
      p.fuel = Math.max(0, p.fuel - 0.2);
      this.hitWorm(p, 8 * st.speed, tx, ty);
      return;
    }
    const t = w.get(tx, ty);
    if (C.passable(t)) {
      p.act = { type: 'move', tx, ty, t: dy < 0 ? C.UP_TIME : C.MOVE_TIME, d: p.dir };
      p.fuel = Math.max(0, p.fuel - (dy < 0 ? C.FUEL_UP : C.FUEL_MOVE));
      return;
    }
    if (t === T.LAVA) {
      if ((p.cd.lava ?? 0) < this.time) { p.cd.lava = this.time + 0.6; this.hurt(p, 12, 'melted in lava'); }
      return this.tell(p, 'LAVA! Too hot to dig.', 'lava');
    }
    const def = TILES[t];
    if (def.hard > st.power) return this.tell(p, `${def.name ?? def.key} is too hard — upgrade your drill.`, 'hard');
    const dur = (C.DIG_TIME * def.hard) / st.speed + 0.03;
    p.act = { type: 'dig', tx, ty, t: dur, total: dur, d: p.dir };
  }

  finish(p, a) {
    const w = this.world;
    if (a.type === 'fall') {
      if (C.passable(w.get(p.x, p.y + 1))) { p.y++; p.fallN++; }
    } else if (a.type === 'move') {
      if (C.passable(w.get(a.tx, a.ty))) { p.x = a.tx; p.y = a.ty; }
    } else if (a.type === 'dig') {
      const t = w.get(a.tx, a.ty), def = TILES[t];
      if (t === T.GAS) {
        this.explode(a.tx, a.ty, 2, null, false);
        this.hurt(p, 25, 'hit a gas pocket');
      } else if (t !== T.AIR && def.hard < 99) {
        p.fuel = Math.max(0, p.fuel - C.FUEL_DIG * def.hard);
        if (def.ore) this.collect(p, t, a.ty);
        w.set(a.tx, a.ty, T.AIR);
      }
      if (C.passable(w.get(a.tx, a.ty)) && p.hull > 0) { p.x = a.tx; p.y = a.ty; }
    }
    const d = C.depthOf(p.y);
    if (d > p.runDepth) p.runDepth = d;
    if (this.mode === 'solo' && d > 0 && d % 10 === 0) this.trigger(p, 'depth', { depth: d });
    if (d > p.record) {
      const before = C.layerOf(p.record), now = C.layerOf(d);
      if (now !== before && this.mode === 'world') this.feed(`⛏ ${p.name} broke into ${now.name} (${d}m)!`, 'big');
      p.record = d;
    }
  }

  collect(p, t, y) {
    const def = TILES[t];
    if (cargoCount(p) >= stats(p).cargo) return this.tell(p, 'Cargo full! Sell at the MARKET.', 'full');
    p.cargo[def.key] = (p.cargo[def.key] ?? 0) + 1;
    if (p.conn) this.send(p.conn, { t: 'ore', k: def.key });
    if (def.value >= 800) this.feed(`✨ ${p.name} found ${def.name === 'Artifact' ? 'an' : 'a'} ${def.name} at ${C.depthOf(y)}m!`, 'rare');
  }

  hurt(p, dmg, why) {
    p.hull -= dmg;
    if (p.conn) this.send(p.conn, { t: 'hurt', v: Math.round(dmg) });
    if (p.hull > 0) return;
    const d = C.depthOf(p.y);
    this.feed(`💀 ${p.name} ${why} at ${d}m and lost their cargo`, 'death');
    const st = stats(p);
    p.cargo = {};
    Object.assign(p, this.spawnPoint(), { act: null, fallN: 0, hull: st.hull, fuel: Math.max(p.fuel, st.tank * 0.5) });
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
      p.id, p.x, p.y, ACT_IDX[p.act?.type] ?? 0, DIR_IDX[p.act?.d ?? p.dir] ?? 0,
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
          ss: p.story?.sells ?? 0, end: p.story?.flags.ending ?? null,
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
    if (!candidates.length) return this.startRush();
    const target = candidates[Math.floor(Math.random() * candidates.length)];
    const cx = Math.round(target.x + rand(-25, 25)), cy = Math.round(target.y + rand(-8, 8));
    const w = this.world, occupied = new Set([...this.players.values()].map((p) => `${p.x},${p.y}`));
    let filled = 0;
    for (let y = cy - 5; y <= cy + 5; y++) for (let x = cx - 12; x <= cx + 12; x++) {
      if (y <= SURFACE + 1 || w.get(x, y) !== T.AIR || occupied.has(`${x},${y}`) || Math.random() > 0.55) continue;
      const rock = Object.keys(C.layerOf(C.depthOf(y)).rock)[0];
      w.set(x, y, C.tileByKey[rock]);
      filled++;
    }
    if (filled) this.feed(`⚠ CAVE-IN around ${C.depthOf(cy)}m! Tunnels collapsed`, 'death');
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
      .filter((c) => c.x > 0 && c.x < W - 1 && c.y > SURFACE + 3 && c.y < H - 1 && !wm.seg.some((s) => s.x === c.x && s.y === c.y))
      .map((c) => ({ ...c, score: (target ? Math.abs(c.x - target.x) + Math.abs(c.y - target.y) : 0) + Math.random() * 4 }))
      .sort((a, b) => a.score - b.score);
    const next = opts[0];
    if (!next) return;
    if (w.get(next.x, next.y) !== T.LAVA) w.set(next.x, next.y, T.AIR);
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
