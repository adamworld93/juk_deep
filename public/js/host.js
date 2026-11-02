import * as C from '/shared/config.js';

const { W, H, SURFACE, T, TILES } = C;
const FONT = '"JetBrains Mono", ui-monospace, monospace';

const rgb = (hex, k = 1) => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) * k, ((n >> 8) & 255) * k, (n & 255) * k];
};
const PALETTE = TILES.map((t, i) => {
  if (i === T.AIR) return [10, 14, 20];
  return rgb(t.color, t.ore || t.hazard === 'lava' ? 1 : 0.5);
});

export class HostView {
  constructor(canvas) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.buf = document.createElement('canvas');
    this.buf.width = W;
    this.buf.height = H;
    this.bctx = this.buf.getContext('2d');
    this.data = this.bctx.createImageData(W, H);
    this.dirty = true;
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.w = innerWidth;
    this.h = innerHeight;
    this.c.width = Math.round(this.w * this.dpr);
    this.c.height = Math.round(this.h * this.dpr);
    this.c.style.width = `${this.w}px`;
    this.c.style.height = `${this.h}px`;
  }

  setTile(x, y, t) {
    const i = (y * W + x) * 4, [r, g, b] = y < SURFACE ? [8, 16, 34] : PALETTE[t];
    const d = this.data.data;
    d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
    this.dirty = true;
  }

  draw(S, now) {
    const { ctx, dpr } = this;
    if (this.dirty) { this.bctx.putImageData(this.data, 0, 0); this.dirty = false; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#05070a';
    ctx.fillRect(0, 0, this.w, this.h);

    const wide = this.w > 900, aw = wide ? this.w - 400 : this.w, ah = wide ? this.h : this.h * 0.6;
    let deepest = SURFACE + 60;
    for (const p of S.players.values()) deepest = Math.max(deepest, p.y);
    const shown = Math.min(H, deepest + 40);
    const scale = Math.min((aw - 60) / W, (ah - 20) / shown);
    const ox = 50 + (aw - 60 - W * scale) / 2, oy = 10;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.buf, 0, 0, W, shown, ox, oy, W * scale, shown * scale);

    ctx.font = `11px ${FONT}`;
    ctx.fillStyle = '#5f8a6c';
    ctx.textAlign = 'right';
    const step = shown > 500 ? 100 : 50;
    for (let d = 0; d + SURFACE < shown; d += step) {
      const y = oy + (d + SURFACE) * scale;
      ctx.fillText(`${d}m`, ox - 6, y - 5);
      ctx.fillRect(ox - 4, y, 4, 1);
    }
    for (const l of C.LAYERS) {
      const y = oy + (l.to + SURFACE) * scale;
      if (l.to + SURFACE > shown) break;
      ctx.fillStyle = 'rgba(95,138,108,0.35)';
      ctx.fillRect(ox, y, W * scale, 1);
    }

    const at = (x, y) => [ox + (x + 0.5) * scale, oy + (y + 0.5) * scale];
    if (S.worm) {
      ctx.fillStyle = '#ff4fa3';
      for (let k = 0; k < S.worm.s.length; k += 2) {
        const [x, y] = at(S.worm.s[k], S.worm.s[k + 1]);
        ctx.fillRect(x - scale, y - scale, scale * 2, scale * 2);
      }
    }
    if (S.meteor) {
      const [x, y] = at(S.meteor.x, SURFACE - 1);
      ctx.fillStyle = Math.floor(now / 300) % 2 ? '#ff4f5e' : '#ffb86b';
      ctx.textAlign = 'center';
      ctx.font = `bold 14px ${FONT}`;
      ctx.fillText(`☄ ${S.meteor.left}s`, x, y - 8);
    }

    const fs = Math.max(11, Math.min(15, scale * 4));
    ctx.textAlign = 'center';
    for (const p of S.players.values()) {
      const [x, y] = at(p.rx, p.ry);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(3, scale * 1.4), 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.font = `bold ${fs}px ${FONT}`;
      ctx.fillText(p.name, x, y - Math.max(6, scale * 2));
    }
    ctx.textAlign = 'left';
  }
}
