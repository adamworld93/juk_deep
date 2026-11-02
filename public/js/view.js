import * as C from '/shared/config.js';
import { CHARACTERS } from '/shared/story.js';
import { drawMiner } from './sprite.js';

const { W, H, SURFACE, T, TILES } = C;
const FONT = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace';
const STATION_COLORS = { fuel: '#ffcc33', sell: '#39ff88', shop: '#6bcbff' };
const SPARKS = ['*', '.', "'", ',', '`', '+'];

// Town buildings (10 columns × 5 rows), drawn starting one column left of the station's x.
const BUILDINGS = {
  fuel: [' ________ ', '|  FUEL  |', '|  .--.  |', '|  |##|  |', '|__|##|__|'],
  sell: ['/\\/\\/\\/\\/\\', '| MARKET |', '|$ .--. $|', '|  |  |  |', '|__|__|__|'],
  shop: ['  _/==\\_  ', ' / SHOP \\ ', '| [=][=] |', '|  .--.  |', '|__|  |__|'],
};
// Mine headframe with a turning sheave wheel (W is replaced by the wheel frame).
const HEADFRAME = ['   W   ', '  ╱║╲  ', ' ╱ ║ ╲ ', ' ║╲║╱║ ', ' ║╱║╲║ ', ' ║╲║╱║ ', ' ║╱║╲║ ', '═╩═╩═╩═'];
const WHEEL = ['◐', '◓', '◑', '◒'];
const HEADFRAME_X = W / 2 + 21;
const SMOKE = ['°', 'o', '·', '.'];
const mountain = (x) => Math.floor(1.5 + 2.2 * (Math.sin(x * 0.09) + 1) + 1.6 * (Math.sin(x * 0.23 + 1.3) + 1));

const BG = TILES.map((t) => {
  const n = parseInt(t.color.slice(1), 16), k = t.ore ? 0.22 : 0.3;
  return `rgb(${((n >> 16) & 255) * k | 0},${((n >> 8) & 255) * k | 0},${(n & 255) * k | 0})`;
});

const hash = (x, y) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

export class AsciiView {
  constructor(canvas) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.hurt = 0;
    this.shake = 0;
    this.resize();
    addEventListener('resize', () => this.resize());
    document.fonts?.load(`16px ${FONT}`).then(() => this.resize());
  }

  resize() {
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.w = innerWidth;
    this.h = innerHeight;
    this.c.width = Math.round(this.w * this.dpr);
    this.c.height = Math.round(this.h * this.dpr);
    this.c.style.width = `${this.w}px`;
    this.c.style.height = `${this.h}px`;
    this.size = Math.max(14, Math.min(28, Math.round(Math.min(this.w / 52, this.h / 30) * 1.6)));
    this.ctx.font = `${this.size}px ${FONT}`;
    this.cw = Math.ceil(this.ctx.measureText('M').width);
    this.ch = Math.round(this.size * 1.12);
  }

  draw(S, now) {
    const { ctx, dpr, cw, ch } = this;
    const cam = S.cam;
    const shake = this.shake * (this.shakeScale ?? 1);
    const sx0 = (Math.random() - 0.5) * shake, sy0 = (Math.random() - 0.5) * shake;
    this.shake *= 0.85;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#05070a';
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.font = `${this.size}px ${FONT}`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';

    const ox = this.w / 2 - cw / 2 - cam.x * cw + sx0, oy = this.h / 2 - ch / 2 - cam.y * ch + sy0;
    const sxOf = (x) => ox + x * cw, syOf = (y) => oy + y * ch;
    const cols = Math.ceil(this.w / cw) + 2, rows = Math.ceil(this.h / ch) + 2;
    const x0 = Math.floor(cam.x - cols / 2), y0 = Math.floor(cam.y - rows / 2);

    const lights = [];
    for (const p of S.players.values()) {
      if (Math.abs(p.rx - cam.x) > cols || Math.abs(p.ry - cam.y) > rows) continue;
      lights.push({ x: p.rx, y: p.ry, r: p.id === S.you ? S.lamp : 3.5 });
    }
    const lavaHot = Math.floor(now / 180);

    for (let y = y0; y < y0 + rows; y++) {
      if (y < 0 || y >= H) continue;
      const sy = syOf(y);
      if (y < SURFACE) { this.drawSkyRow(S, y, x0, cols, sxOf, sy, now); continue; }
      if (!S.loaded[Math.floor(y / C.CHUNK)]) continue;
      const daylight = Math.max(0, 1 - (y - SURFACE) / 4);
      for (let x = x0; x < x0 + cols; x++) {
        if (x < 0 || x >= W) continue;
        const i = y * W + x, t = S.tiles[i];
        let L = daylight;
        for (const l of lights) {
          const d = Math.hypot(x - l.x, y - l.y);
          if (d < l.r) L = Math.max(L, 1 - (d / l.r) ** 2 * 0.75);
        }
        if (L > 0.05) S.explored[i] = 1;
        else if (S.explored[i]) L = 0.22;
        if (L <= 0 || t === T.AIR) continue;
        const def = TILES[t];
        let color = def.color;
        if (t === T.LAVA) color = (hash(x, y + lavaHot) < 0.5) ? '#ff5a1f' : '#ffa21f';
        const sx = sxOf(x);
        ctx.globalAlpha = L;
        if (t !== T.LADDER) { // ladders hang in open space: no block behind them
          ctx.fillStyle = BG[t];
          ctx.fillRect(sx, sy, cw + 0.5, ch + 0.5);
        }
        ctx.fillStyle = color;
        ctx.fillText(def.ch, sx, sy);
      }
    }
    ctx.globalAlpha = 1;

    this.drawCracks(S, sxOf, syOf);
    this.drawLift(S, sxOf, syOf, y0, rows, now);
    this.drawTown(S, sxOf, syOf, now);
    this.drawMeteor(S, sxOf, syOf, now);
    this.drawWorm(S, sxOf, syOf, now);
    this.drawNpcs(S, sxOf, syOf, now);
    this.drawPlayers(S, sxOf, syOf, now);
    this.drawFx(S, sxOf, syOf);

    this.drawRide(S, now);
    if (this.hurt > 0.02) {
      ctx.fillStyle = `rgba(255,30,50,${this.hurt * 0.35})`;
      ctx.fillRect(0, 0, this.w, this.h);
      this.hurt *= 0.88;
    }
  }

  drawSkyRow(S, y, x0, cols, sxOf, sy, now) {
    const { ctx } = this;
    for (let x = x0; x < x0 + cols; x++) {
      if (x < 0 || x >= W) continue;
      const h = hash(x, y), up = SURFACE - y, mh = mountain(x);
      if (y === SURFACE - 1 && h > 0.94 && (x < C.TOWN.x0 - 2 || x > C.TOWN.x1 + 2) && S.tiles[SURFACE * W + x] !== T.AIR) {
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = '#2f8f3f';
        ctx.fillText(h > 0.975 ? '♣' : '♠', sxOf(x), sy);
      } else if (up <= mh) {
        ctx.globalAlpha = up === mh ? 0.55 : 0.3;
        ctx.fillStyle = '#3a3f66';
        ctx.fillText(up === mh ? (mountain(x - 1) < mh ? '/' : mountain(x + 1) < mh ? '\\' : '^') : '▒', sxOf(x), sy);
      } else if (h < 0.03) {
        ctx.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(now / 900 + h * 400));
        ctx.fillStyle = '#9fb6d9';
        ctx.fillText(h < 0.008 ? '*' : '.', sxOf(x), sy);
      }
    }
    if (y === 2) {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#fff6c8';
      ctx.fillText('●', sxOf(W / 2 + 34), sy);
    }
    ctx.globalAlpha = 1;
  }

  drawArt(lines, x, y, color, sxOf, syOf, alpha = 1) {
    const { ctx, cw, ch } = this;
    ctx.fillStyle = '#05070a';
    lines.forEach((line, r) => {
      const a = line.search(/\S/), b = line.length - line.trimEnd().length;
      if (a >= 0) ctx.fillRect(sxOf(x + a), syOf(y + r), (line.length - a - b) * cw, ch);
    });
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    lines.forEach((line, r) => {
      [...line].forEach((c, k) => { if (c !== ' ') ctx.fillText(c, sxOf(x + k), syOf(y + r)); });
    });
    ctx.globalAlpha = 1;
  }

  drawTown(S, sxOf, syOf, now) {
    const { ctx } = this;
    for (const s of C.STATIONS) this.drawArt(BUILDINGS[s.key], s.x - 1, SURFACE - 5, STATION_COLORS[s.key], sxOf, syOf);
    const fuel = C.STATIONS.find((s) => s.key === 'fuel'), cx = fuel.x + 6;
    ctx.fillStyle = '#ffcc33';
    ctx.fillText('▌', sxOf(cx), syOf(SURFACE - 6));
    for (let k = 0; k < 5; k++) {
      const ph = (now / 900 + k / 5) % 1;
      ctx.globalAlpha = 0.55 * (1 - ph);
      ctx.fillStyle = '#9aa0a6';
      ctx.fillText(SMOKE[Math.min(3, Math.floor(ph * 4))], sxOf(cx + ph * 3 + Math.sin(now / 500 + k) * 0.4), syOf(SURFACE - 7 - ph * 5));
    }
    ctx.globalAlpha = 1;
    const frame = HEADFRAME.map((l) => l.replace('W', WHEEL[Math.floor(now / 250) % 4]));
    this.drawArt(frame, HEADFRAME_X, SURFACE - HEADFRAME.length, '#8f969e', sxOf, syOf);
    const sign = '~ DEEP MINING CO. ~';
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#c9cfd6';
    [...sign].forEach((c, k) => ctx.fillText(c, sxOf(W / 2 - Math.floor(sign.length / 2) + k), syOf(SURFACE - 8)));
    ctx.globalAlpha = 1;
  }

  drawCracks(S, sxOf, syOf) {
    const { ctx, cw, ch } = this;
    ctx.strokeStyle = 'rgba(255,240,210,0.75)';
    ctx.lineWidth = 1.2;
    for (const p of S.players.values()) {
      if (p.act !== 2 || !p.prog) continue;
      const [dx, dy] = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]][p.dir] ?? [0, 0];
      const tx = p.x + dx, ty = p.y + dy, x = sxOf(tx), y = syOf(ty);
      ctx.fillStyle = `rgba(0,0,0,${p.prog * 0.04})`;
      ctx.fillRect(x, y, cw, ch);
      ctx.beginPath();
      for (let k = 0; k < Math.ceil(p.prog / 2); k++) {
        const h1 = hash(tx * 7 + k, ty * 13), h2 = hash(tx * 3, ty * 5 + k);
        ctx.moveTo(x + cw * (0.35 + h1 * 0.3), y + ch * (0.35 + h2 * 0.3));
        ctx.lineTo(x + cw * h2, y + ch * (k % 2 ? h1 : 1 - h1));
      }
      ctx.stroke();
    }
  }

  drawLabel(text, x, y, color, alpha = 0.85) {
    const { ctx } = this;
    ctx.font = `${Math.round(this.size * 0.42)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = `${this.size}px ${FONT}`;
  }

  drawLift(S, sxOf, syOf, y0, rows, now) {
    const { ctx, cw, ch } = this, L = C.LIFT;
    const open = C.LIFT_STOPS.filter((d) => d <= (S.me?.r ?? 0)), bottom = open.length ? C.liftRow(open.at(-1)) : SURFACE - 1;
    ctx.fillStyle = '#8f969e';
    for (let y = Math.max(SURFACE, y0); y < Math.min(bottom, y0 + rows); y++) {
      if (C.liftStopAt(L.x, y) !== null || S.tiles[y * W + L.x] === T.AIR) continue;
      ctx.globalAlpha = 0.28;
      ctx.fillText('¦', sxOf(L.x), syOf(y));
    }
    for (const d of C.LIFT_STOPS) {
      const y = C.liftRow(d);
      if (y < y0 - 2 || y > y0 + rows || !S.explored[y * W + L.x]) continue;
      const on = d <= (S.me?.r ?? 0);
      this.drawLabel(`⛓ LIFT ${d}m`, sxOf(L.x) + cw / 2, syOf(y - 1), on ? '#c9cfd6' : '#5a5f66', on ? 0.85 : 0.6);
      ctx.globalAlpha = on ? 0.9 : 0.4;
      ctx.fillStyle = '#8f969e';
      ctx.fillText('╤', sxOf(L.x + 2) + Math.sin(now / 600) * 1.5, syOf(y - 2));
      ctx.fillText('▣', sxOf(L.x + 2), syOf(y));
      ctx.globalAlpha = 1;
    }
  }

  drawRide(S, now) {
    const r = S.ride;
    if (!r) return;
    const { ctx } = this, t = (now - r.start) / 1000, fadeIn = 0.35;
    if (t > r.dur + 0.6) { S.ride = null; return; }
    const a = t < fadeIn ? t / fadeIn : t > r.dur ? Math.max(0, 1 - (t - r.dur) / 0.6) : 1;
    const k = Math.min(1, Math.max(0, (t - fadeIn) / (r.dur - fadeIn)));
    const depth = Math.round(r.from + (r.to - r.from) * k * k * (3 - 2 * k));
    ctx.globalAlpha = a * 0.94;
    ctx.fillStyle = '#020304';
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#c9cfd6';
    const jig = t < r.dur ? (Math.random() - 0.5) * 2 : 0;
    ctx.fillText(`⛓  ${r.to < r.from ? '▲' : '▼'}  ${depth === 0 ? 'TOWN' : `${depth}m`}`, this.w / 2 + jig, this.h / 2 - this.ch + jig);
    if (S.thought && S.thought.until > now) {
      ctx.font = `italic ${Math.round(this.size * 0.6)}px ${FONT}`;
      ctx.fillStyle = '#c9d6cc';
      ctx.globalAlpha = a * 0.85;
      ctx.fillText(`( ${S.thought.text} )`, this.w / 2, this.h / 2 + this.ch * 0.6);
      ctx.font = `${this.size}px ${FONT}`;
    }
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }

  drawGlow(x, y, color, now) {
    const { ctx, cw } = this;
    const r = cw * (3 + Math.sin(now / 700)), g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'transparent');
    ctx.globalAlpha = 0.16 + 0.06 * Math.sin(now / 450);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
  }

  drawNpcs(S, sxOf, syOf, now) {
    const { ctx, cw, ch } = this;
    const self = S.players.get(S.you);
    for (const n of S.npcs ?? []) {
      // Same rules as the server's npcVisible: story progress, a flag that must (not) be set.
      const r = n.req, fl = S.me?.fl ?? {};
      if (r && ((S.me?.ss ?? 0) < (r.sells ?? 0) || (r.flag && !fl[r.flag]) || (r.notFlag && fl[r.notFlag]))) continue;
      const c = CHARACTERS[n.npc];
      if (n.y >= SURFACE && !S.explored[n.y * W + n.x]) {
        if (self && Math.hypot(self.x - n.x, self.y - n.y) < 22) this.drawGlow(sxOf(n.x) + cw / 2, syOf(n.y) + ch / 2, c.color, now);
        continue;
      }
      let x = n.x, facing = self && self.x < n.x ? -1 : 1;
      if (n.npc === 'roller') {
        const k = Math.sin(now / 1600), dir = Math.cos(now / 1600) >= 0 ? 1 : -1;
        x = n.x + Math.round(k * 5);
        facing = dir;
        ctx.font = `800 ${Math.round(this.size * 1.4)}px ${FONT}`;
        ctx.fillStyle = '#b9b0a0';
        ctx.fillText('●', sxOf(x + dir) - cw * 0.15, syOf(n.y) - ch * 0.35);
        ctx.font = `${this.size}px ${FONT}`;
      }
      if (n.npc === 'hermit') {
        ctx.fillStyle = Math.random() < 0.5 ? '#ff7a1f' : '#ffdf5a';
        ctx.fillText(['^', '*', '"', '^'][Math.floor(now / 140) % 4], sxOf(n.x - 3), syOf(n.y));
        ctx.fillStyle = '#d98cff';
        for (const dx of [3, 4]) ctx.fillText('♠', sxOf(n.x + dx), syOf(n.y));
      }
      if (n.npc === 'mirror') {
        for (const [dx, dy] of [[-4, 0], [-5, -1], [4, 0], [5, -2], [-3, -3], [3, -3]]) {
          ctx.globalAlpha = 0.5 + 0.5 * Math.sin(now / 400 + dx);
          ctx.fillStyle = '#8ff6ff';
          ctx.fillText('◆', sxOf(n.x + dx), syOf(n.y + dy));
        }
        ctx.globalAlpha = 1;
      }
      let top = syOf(n.y);
      if (c.mini) {
        top = drawMiner(ctx, sxOf(x) + cw / 2, syOf(n.y) + ch, ch, { npc: n.npc, facing, now, fit: cw }).top;
      } else {
        ctx.font = `800 ${this.size}px ${FONT}`;
        ctx.fillStyle = c.color;
        ctx.shadowColor = c.color;
        ctx.shadowBlur = n.npc === 'mirror' ? 10 + 6 * Math.sin(now / 300) : 6;
        ctx.fillText(c.glyph, sxOf(x), syOf(n.y));
        ctx.shadowBlur = 0;
        ctx.font = `${this.size}px ${FONT}`;
      }
      const near = self && Math.abs(self.x - n.x) + Math.abs(self.y - n.y) <= 2;
      this.drawLabel(near ? '[F] talk' : c.name.toLowerCase(), sxOf(x) + cw / 2, top - 2, near ? '#ffffff' : c.color, near ? 1 : 0.75);
    }
  }

  drawPlayers(S, sxOf, syOf, now) {
    const { ctx, cw, ch } = this;
    for (const p of S.players.values()) {
      if (p.rx == null) continue;
      const me = p.id === S.you;
      const sx = sxOf(p.rx), sy = syOf(p.ry);
      if (p.dir === 1) p.facing = -1;
      else if (p.dir === 2) p.facing = 1;
      const tile = (x, y) => S.tiles[y * W + x];
      const onLadder = tile(p.x, p.y) === T.LADDER;
      const wall = (x) => !C.passable(tile(x, p.y));
      const fly = p.dir === 3 && !onLadder && (p.act === 1 || (p.act === 0 && !wall(p.x - 1) && !wall(p.x + 1) && C.passable(tile(p.x, p.y + 1))));
      const moving = Math.abs(p.rx - p.x) + Math.abs(p.ry - p.y) > 0.05 && p.act !== 3;
      const res = drawMiner(ctx, sx + cw / 2, sy + ch, ch, {
        look: p.look ?? { color: p.color }, fit: cw, facing: p.facing ?? 1, now, fly,
        walk: moving && !fly ? now / 140 : null,
        dig: p.act === 2 ? ['', 'L', 'R', 'U', 'D'][p.dir] : null,
        drill: me ? S.me?.u?.drill ?? 0 : 0,
        tired: me && S.mode === 'solo' ? (S.me?.t ?? 0) / 130 : 0,
      });
      if (p.act === 2) {
        const [dx, dy] = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]][p.dir] ?? [0, 0];
        ctx.fillStyle = '#ffdf5a';
        for (let k = 0; k < 2; k++) {
          ctx.fillText(SPARKS[Math.floor(Math.random() * SPARKS.length)], sx + dx * cw * 0.8 + (Math.random() - 0.5) * cw, sy + dy * ch * 0.8 + (Math.random() - 0.5) * ch);
        }
      }
      let above = res.top - 2;
      if (!me && !S.host) { this.drawLabel(p.name, sx + cw / 2, above, p.color); above -= this.size * 0.55; }
      const thought = me && S.thought && S.thought.until > now ? S.thought : null;
      if (thought) {
        const a = Math.min(1, (thought.until - now) / 800);
        ctx.font = `italic ${Math.round(this.size * 0.6)}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.globalAlpha = 0.85 * a;
        ctx.fillStyle = '#c9d6cc';
        ctx.fillText(`( ${thought.text} )`, sx + cw / 2, above - 4);
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.font = `${this.size}px ${FONT}`;
      }
      if (p.say && p.say.until > now) {
        ctx.font = `${Math.round(this.size * 0.6)}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const text = `"${p.say.text}"`, tw = ctx.measureText(text).width + 10, h = this.size * 0.8;
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(sx + cw / 2 - tw / 2, above - h - 2, tw, h);
        ctx.fillStyle = '#e8ffe9';
        ctx.fillText(text, sx + cw / 2, above - 3);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.font = `${this.size}px ${FONT}`;
      }
    }
  }

  drawWorm(S, sxOf, syOf, now) {
    const wm = S.worm;
    if (!wm) return;
    const { ctx, cw } = this;
    ctx.font = `800 ${this.size}px ${FONT}`;
    for (let k = wm.s.length / 2 - 1; k >= 0; k--) {
      const x = wm.s[k * 2], y = wm.s[k * 2 + 1];
      ctx.fillStyle = k === 0 ? '#ff2d7a' : k % 2 ? '#ff7ab0' : '#ff4fa3';
      ctx.shadowColor = '#ff2d7a';
      ctx.shadowBlur = k === 0 ? 14 : 4;
      ctx.fillText(k === 0 ? 'Ö' : k % 2 ? 'o' : 'O', sxOf(x), syOf(y));
    }
    ctx.shadowBlur = 0;
    ctx.font = `${Math.round(this.size * 0.6)}px ${FONT}`;
    const n = 10, filled = Math.round((wm.hp / wm.mx) * n);
    ctx.fillStyle = '#ff4fa3';
    ctx.fillText(`WORM [${'█'.repeat(filled)}${'░'.repeat(n - filled)}]`, sxOf(wm.s[0]) - cw * 2, syOf(wm.s[1]) - this.size * 0.9);
    ctx.font = `${this.size}px ${FONT}`;
  }

  drawMeteor(S, sxOf, syOf, now) {
    const m = S.meteor;
    if (!m) return;
    const { ctx } = this;
    const k = Math.max(0, Math.min(1, 1 - m.left / 25));
    const y = -6 + k * (SURFACE + 5), x = m.x - (1 - k) * 12;
    ctx.fillStyle = '#ffb86b';
    ctx.shadowColor = '#ff7a1f';
    ctx.shadowBlur = 16;
    ctx.fillText('☄', sxOf(x), syOf(y));
    ctx.shadowBlur = 0;
    if (Math.floor(now / 300) % 2) {
      ctx.fillStyle = '#ff4f5e';
      ctx.fillText('▼', sxOf(m.x), syOf(SURFACE - 1));
      ctx.font = `${Math.round(this.size * 0.6)}px ${FONT}`;
      ctx.fillText(`IMPACT ${m.left}s`, sxOf(m.x - 3), syOf(SURFACE - 2));
      ctx.font = `${this.size}px ${FONT}`;
    }
  }

  drawFx(S, sxOf, syOf) {
    const { ctx } = this;
    for (const f of S.fx) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life / f.max * 1.5));
      ctx.fillStyle = f.color;
      ctx.fillText(f.ch, sxOf(f.x), syOf(f.y));
    }
    ctx.font = `800 ${Math.round(this.size * 0.75)}px ${FONT}`;
    for (const p of S.pops) {
      ctx.globalAlpha = Math.min(1, p.life * 1.5);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, sxOf(p.x), syOf(p.y));
    }
    ctx.font = `${this.size}px ${FONT}`;
    ctx.globalAlpha = 1;
  }
}
