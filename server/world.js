// The shared underground: procedural generation, tile access, change tracking, chunk encoding.
import { W, H, SURFACE, CHUNK, T, TILES, LAYERS, TOWN, tileByKey, depthOf, layerOf } from '../shared/config.js';

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth 2D value noise in [0,1).
function makeNoise(seed) {
  const hash = (x, y) => {
    let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const s = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = s(x - x0), fy = s(y - y0);
    const a = hash(x0, y0), b = hash(x0 + 1, y0), c = hash(x0, y0 + 1), d = hash(x0 + 1, y0 + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}

const pickWeighted = (weights, roll) => {
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = roll * total;
  for (const [k, w] of entries) if ((r -= w) < 0) return k;
  return entries[entries.length - 1][0];
};

const PLAIN_ROCK = new Set([T.DIRT, T.CLAY, T.STONE, T.HARD, T.OBSIDIAN]);

export class World {
  constructor() {
    this.tiles = new Uint8Array(W * H);
    this.changes = [];
  }

  inBounds(x, y) { return x >= 0 && y >= 0 && x < W && y < H; }
  get(x, y) { return this.inBounds(x, y) ? this.tiles[y * W + x] : T.BEDROCK; }
  set(x, y, t) {
    if (!this.inBounds(x, y)) return;
    const i = y * W + x;
    if (this.tiles[i] === t) return;
    this.tiles[i] = t;
    this.changes.push(x, y, t);
  }
  isRock(t) { return PLAIN_ROCK.has(t); }

  generate(seed = (Math.random() * 2 ** 31) | 0) {
    const rnd = mulberry32(seed), noise = makeNoise(seed);
    const R = (a, b) => a + rnd() * (b - a);
    const t = this.tiles;
    for (let y = 0; y < H; y++) {
      const layer = layerOf(depthOf(y));
      for (let x = 0; x < W; x++) {
        let v;
        if (y < SURFACE) v = T.AIR;
        else if (y <= SURFACE + 1 && x >= TOWN.x0 && x <= TOWN.x1) v = T.CONCRETE;
        else if (y === SURFACE) v = T.GRASS;
        else if (y >= H - 1 || x === 0 || x === W - 1) v = T.BEDROCK;
        else v = tileByKey[pickWeighted(layer.rock, noise(x / 9, y / 6))];
        t[y * W + x] = v;
      }
    }

    // Random-walk blobs inside a depth band.
    const blob = (d0, d1, len, fill, canReplace) => {
      let x = Math.floor(R(2, W - 2)), y = SURFACE + 1 + Math.floor(R(d0, d1));
      for (let i = 0; i < len; i++) {
        if (x > 0 && x < W - 1 && y > SURFACE && y < H - 1 && canReplace(t[y * W + x])) t[y * W + x] = fill(x, y);
        if (rnd() < 0.5) x += rnd() < 0.5 ? -1 : 1; else y += rnd() < 0.5 ? -1 : 1;
      }
    };

    let d0 = 1;
    for (const layer of LAYERS) {
      const d1 = Math.min(layer.to, H - SURFACE - 2), area = (d1 - d0) * W;
      // Caves first, so ore can line their walls.
      for (let i = 0; i < area / 2500; i++) blob(d0 + 4, d1, Math.floor(R(25, 70)), () => T.AIR, (v) => PLAIN_ROCK.has(v));
      for (const [ore, pct] of Object.entries(layer.ores)) {
        for (let i = 0; i < (area * pct) / 100 / 5; i++) blob(d0, d1, Math.floor(R(3, 9)), () => tileByKey[ore], (v) => PLAIN_ROCK.has(v));
      }
      for (let i = 0; i < (area * layer.gas) / 100 / 4; i++) blob(d0, d1, Math.floor(R(2, 6)), () => T.GAS, (v) => PLAIN_ROCK.has(v));
      for (let i = 0; i < (area * layer.lava) / 100 / 12; i++) {
        const cx = R(3, W - 3), cy = SURFACE + 1 + R(d0, d1), rx = R(2, 6), ry = R(1, 2.5);
        for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
          if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 && x > 0 && x < W - 1 && y > SURFACE + 5 && y < H - 1) t[y * W + x] = T.LAVA;
        }
      }
      d0 = d1;
    }
    this.changes = [];
    return this;
  }

  // Sprinkle fresh ore into untouched rock between two depths (keeps the shallow grind alive).
  reseed(d0, d1, count) {
    let placed = 0;
    for (let i = 0; i < count * 20 && placed < count; i++) {
      const x = 1 + Math.floor(Math.random() * (W - 2)), y = SURFACE + 1 + d0 + Math.floor(Math.random() * (d1 - d0));
      if (!PLAIN_ROCK.has(this.get(x, y))) continue;
      const ores = layerOf(depthOf(y)).ores;
      this.set(x, y, tileByKey[pickWeighted(ores, Math.random())]);
      placed++;
    }
    return placed;
  }

  // Hollow out a room whose floor is solid, clearing hazards around it. Returns the NPC spot (floor centre).
  carveRoom(x0, y0, w, h) {
    for (let y = y0 - 1; y <= y0 + h; y++) for (let x = x0 - 1; x <= x0 + w; x++) {
      const t = this.get(x, y);
      if (t === T.LAVA || t === T.GAS) this.tiles[y * W + x] = T.STONE;
    }
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.tiles[y * W + x] = T.AIR;
    for (let x = x0; x < x0 + w; x++) if (this.get(x, y0 + h) === T.AIR) this.tiles[(y0 + h) * W + x] = T.STONE;
    return { x: x0 + Math.floor(w / 2), y: y0 + h - 1 };
  }

  takeChanges() {
    const c = this.changes;
    this.changes = [];
    return c;
  }

  encodeChunk(cy) {
    const y0 = cy * CHUNK, y1 = Math.min(H, y0 + CHUNK);
    return String.fromCharCode(...this.tiles.subarray(y0 * W, y1 * W).map((v) => v + 48));
  }

  serialize() { return Buffer.from(this.tiles).toString('base64'); }
  load(b64) {
    const buf = Buffer.from(b64, 'base64');
    if (buf.length !== this.tiles.length) return false;
    this.tiles.set(buf);
    return true;
  }
}

export { TILES };
