// Art is written facing right and mirrored character-by-character when facing left.
import { CHARACTERS } from '/shared/story.js';

const FONT = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace';
const PICK_HEADS = ['#9aa0a6', '#9aa0a6', '#c8ccd2', '#e6eef7', '#ffd23f', '#ff3b5c', '#2fe58a', '#8ff6ff'];

const hex = (c) => parseInt(c.slice(1), 16);
const toHex = (n) => `#${n.toString(16).padStart(6, '0')}`;
export function shade(c, k) {
  const n = hex(c), f = (v) => Math.max(0, Math.min(255, Math.round(k > 1 ? v + (255 - v) * (k - 1) : v * k)));
  return toHex((f((n >> 16) & 255) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255));
}
export function grey(c, k) {
  if (!k) return c;
  const n = hex(c), m = Math.min(1, Math.max(0, k)), f = (v) => Math.round(v + (0x80 - v) * m);
  return toHex((f((n >> 16) & 255) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255));
}

const HAT_ART = {
  hardhat: '[*]', lamp: '_@_', beanie: '.o.', cap: '(_=', bandana: '<==', tophat: '[#]', hood: '/^\\', none: ',,,',
};
const FACE_ART = { tired: '-_-', hopeful: 'o_o', stern: '>_<', worried: 'O~o', calm: '^.^', bearded: '•#•' };
const GLOW = '#ffdf5a';

const SWAP = { '/': '\\', '\\': '/', '(': ')', ')': '(', '[': ']', ']': '[', '<': '>', '>': '<', '{': '}', '}': '{' };
const mirror = (s) => [...s].reverse().map((c) => SWAP[c] ?? c).join('');

function playerArt(look, o) {
  const step = o.walk != null ? Math.floor(o.walk * 2) % 2 : -1;
  const legs = o.fly ? '/"\\' : look.body === 'ß' ? '/_\\' : step === 0 ? '/| ' : step === 1 ? ' |\\' : '/ \\';
  return {
    lines: [HAT_ART[look.hat] ?? HAT_ART.hardhat, FACE_ART[look.face] ?? FACE_ART.tired, `/${look.body ?? '@'}\\`, legs],
    color: look.color ?? '#39ff88',
    glow: { 0: '*@' }, // the helmet lamp
  };
}

// Draw a figure. cx = centre of their cell, by = bottom of their cell, cell = cell height in px.
// o: { look | npc, facing (1|-1), walk (anim phase or null), dig (null|'L'|'R'|'U'|'D'), fly, tired (0..1),
//      drill (level), now, alpha, fit }. Returns { top, height } of the drawn figure.
export function drawMiner(ctx, cx, by, cell, o) {
  const art = o.npc ? CHARACTERS[o.npc]?.mini : playerArt(o.look ?? {}, o);
  if (!art) return { top: by - cell, height: cell };
  const facing = o.facing ?? 1;
  const fs = Math.max(8, Math.round(cell * 0.37 * (art.small ? 0.85 : 1)));
  const lh = fs * 0.98;
  const t = (o.now ?? 0) / 1000;
  const bob = o.walk != null ? Math.floor(o.walk * 2) % 2 : 0;
  const lines = art.lines.map((l) => (facing < 0 ? mirror(l) : l));
  const width = Math.max(...lines.map((l) => [...l].length));
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.font = `800 ${fs}px ${FONT}`;
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'left';
  const cwid = ctx.measureText('M').width;
  // Squeeze sideways so the figure fits its one cell (o.fit = cell width in px).
  // On tiny (phone) cells it may spill over a little rather than turn to mush.
  const sx = o.fit ? Math.min(1, Math.max(0.8, o.fit / (width * cwid))) : 1;
  ctx.translate(cx, 0);
  ctx.scale(sx, 1);
  ctx.translate(-cx, 0);
  const left = cx - (width * cwid) / 2;
  const top = by - lines.length * lh;
  const base = grey(art.color, o.tired ?? 0);
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.lineWidth = Math.max(2, fs * 0.28);
  ctx.lineJoin = 'round';
  lines.forEach((line, row) => {
    const last = row === lines.length - 1;
    const y = top + (row + 1) * lh - (last ? 0 : bob);
    const glow = art.glow?.[row] ?? art.glow?.all ?? '';
    const col = last && !o.npc ? shade(base, 0.75) : base;
    [...line].forEach((ch, i) => {
      if (ch === ' ') return;
      ctx.strokeText(ch, left + i * cwid, y);
      ctx.fillStyle = glow.includes(ch) ? GLOW : col;
      ctx.fillText(ch, left + i * cwid, y);
    });
  });

  ctx.restore();

  if (o.dig && !o.npc) {
    const swing = 0.5 + 0.5 * Math.sin(t * 22);
    // Angle from "forward", positive = down.
    const a = o.dig === 'D' ? 0.9 + 0.8 * swing : o.dig === 'U' ? -1.7 + 0.8 * swing : -0.8 + 1.3 * swing;
    const hx = cx + facing * ((width * cwid * sx) / 2 - fs * 0.15), hy = top + 2.4 * lh;
    const L = fs * 0.95, H = fs * 0.45;
    const ex = hx + facing * Math.cos(a) * L, ey = hy + Math.sin(a) * L;
    const nx = -facing * Math.sin(a) * H, ny = Math.cos(a) * H;
    ctx.save();
    ctx.lineCap = 'round';
    const pick = (w, handle, head) => {
      ctx.lineWidth = w;
      ctx.strokeStyle = handle;
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.strokeStyle = head;
      ctx.beginPath(); ctx.moveTo(ex - nx, ey - ny); ctx.lineTo(ex + nx * 0.6, ey + ny * 0.6); ctx.stroke();
    };
    const w = Math.max(1.5, fs * 0.16);
    pick(w + 2, 'rgba(0,0,0,0.85)', 'rgba(0,0,0,0.85)');
    pick(w, '#a8743f', PICK_HEADS[o.drill ?? 0] ?? PICK_HEADS[0]);
    ctx.restore();
  }

  if (o.fly) {
    ctx.save();
    ctx.font = `800 ${fs}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = Math.random() < 0.5 ? '#ffa21f' : GLOW;
    ctx.fillText(["'", '*', ',', '"'][Math.floor(Math.random() * 4)], cx - facing * cwid * 0.5, by - 1);
    ctx.restore();
  }
  return { top, height: by - top };
}
