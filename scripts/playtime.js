// How long does the story take? An economic model of a careful player, built from the real numbers
// in shared/config.js and ore densities measured on freshly generated worlds:
//   each trip: ride the lift / dig down to the best rock the drill can cut (as far as half the tank
//   allows), collect ore until the bag is full or the fuel is spent, climb or ride back, sell through
//   the story payslip, refuel, buy upgrades. Plus time in town, character visits, reading every story
//   line, and a margin for being human (wrong turns, falls, looking around).
// Usage: node scripts/playtime.js [short|normal|long]   (no argument: all three)
import * as C from '../shared/config.js';
import { World } from '../server/world.js';
import { BEATS, SITES, FINALE_DEPTH } from '../shared/story.js';

const { TILES, SURFACE, W } = C;
const HUMAN = 1.3;       // a person is slower than the model: wrong turns, falls, looking around
const READ = 4.2;        // seconds per line of dialogue
const TOWN = 25;         // seconds in town per trip (sell, refuel, shop, chat)
const VISIT = 150;       // seconds to find and reach an underground character, beyond the trip itself
const START_DEBT = 2500;

// Ore density per layer, by ore type, measured on a few generated worlds.
const density = C.LAYERS.map(() => ({}));
for (let s = 1; s <= 3; s++) {
  const w = new World().generate(s * 7919);
  for (let y = SURFACE + 1; y < C.H - 1; y++) {
    const li = C.LAYERS.indexOf(C.layerOf(C.depthOf(y)));
    for (let x = 1; x < W - 1; x++) {
      const t = TILES[w.get(x, y)], k = t.ore ? t.key : '_rock';
      density[li][k] = (density[li][k] ?? 0) + 1;
    }
  }
}
for (const d of density) {
  const n = Object.values(d).reduce((a, b) => a + b, 0);
  for (const k of Object.keys(d)) d[k] /= n;
}

function estimate(length, verbose) {
const eco = C.economy(length);
const p = { money: 0, debt: START_DEBT, up: { drill: 0, tank: 0, cargo: 0, hull: 0, lamp: 0 }, record: 0, sells: 0 };
const st = () => ({
  speed: C.UPGRADES.drill.speed[p.up.drill], power: C.UPGRADES.drill.power[p.up.drill],
  tank: C.UPGRADES.tank.value[p.up.tank], cargo: C.UPGRADES.cargo.value[p.up.cargo],
});
const avgRock = (layer) => {
  const r = Object.entries(layer.rock), tot = r.reduce((a, [, v]) => a + v, 0);
  return r.reduce((a, [k, v]) => a + TILES[C.tileByKey[k]].hard * v, 0) / tot;
};
const cuts = (layer) => Math.max(...Object.keys(layer.rock).map((k) => TILES[C.tileByKey[k]].hard)) <= st().power;
const digTime = (hard) => ((C.DIG_TIME * hard) / st().speed) * 1.15 + C.DIG_BASE + C.MOVE_TIME; // ×1.15: weariness

let t = 0;
const log = [];
const mark = (label) => log.push([Math.round((t * HUMAN) / 60), label]);
const seen = new Set();
function payslip(gross) {
  const cuts = [];
  const take = (amt) => { amt = Math.min(Math.round(amt), gross - cuts.reduce((a, b) => a + b, 0)); if (amt > 0) cuts.push(amt); return amt; };
  const paid = p.debt > 0 ? take(Math.min(p.debt, gross * 0.2 * eco.cut)) : 0;
  take((gross * 0.04 + 3 * p.up.drill) * eco.cut); take((gross * 0.02 + 1) * eco.cut); take(gross * 0.03 * eco.cut);
  p.debt -= paid;
  return gross - cuts.reduce((a, b) => a + b, 0);
}

for (let trip = 1; trip < 3000 && p.record < FINALE_DEPTH; trip++) {
  const s = st();
  // How deep: the deepest layer this drill cuts, as far as half a tank of digging reaches.
  let target = 30;
  for (const [i, l] of C.LAYERS.entries()) if (cuts(l)) target = Math.min(l.to - 5, (C.LAYERS[i - 1]?.to ?? 0) + 60);
  target = Math.min(target, FINALE_DEPTH);
  const lift = Math.max(0, ...C.LIFT_STOPS.filter((d) => d <= p.record && d <= target));
  let fuel = s.tank, depth = lift, time = TOWN;
  if (lift) { p.money -= eco.fare(0, lift); time += 1.6 + lift / 220 + 3; }
  while (depth < target) {
    const cost = C.FUEL_DIG * avgRock(C.layerOf(depth));
    if (fuel - cost < s.tank * 0.5) break;
    fuel -= cost; time += digTime(avgRock(C.layerOf(depth))); depth++;
  }
  // Collect ore there. Ore comes in clumps of ~4-5 cells; a player who can see it digs
  // through the gap between clumps (wider where ore is scarce) to reach the next one.
  const l = C.layerOf(depth), d = density[C.LAYERS.indexOf(l)];
  const ores = Object.keys(d).filter((k) => k !== '_rock' && TILES[C.tileByKey[k]].hard <= s.power);
  const share = ores.reduce((a, k) => a + d[k], 0);
  const value = ores.reduce((a, k) => a + d[k] * TILES[C.tileByKey[k]].value, 0) / (share || 1);
  const oreHard = ores.reduce((a, k) => a + d[k] * TILES[C.tileByKey[k]].hard, 0) / (share || 1);
  const between = share ? Math.min(12, 0.9 / Math.sqrt(share)) / 4.5 : 99;
  let bag = 0, walked = 0;
  while (bag < s.cargo) {
    const f = C.FUEL_DIG * (oreHard + between * avgRock(l));
    if (fuel < f) break;
    fuel -= f; bag++; walked += 1 + between;
    time += digTime(oreHard) + between * digTime(avgRock(l));
  }
  // Home: walk back along the tunnel, then climb (free) or ride the lift from the landing above.
  time += walked * 0.5 * C.MOVE_TIME;
  const up = Math.max(0, ...C.LIFT_STOPS.filter((x) => x <= Math.max(p.record, depth) && x <= depth));
  if (up >= 100) { time += (depth - up) * C.CLIMB_TIME + 1.6 + up / 220; p.money -= eco.fare(up, 0); }
  else time += depth * C.CLIMB_TIME;
  p.record = Math.max(p.record, depth);
  t += time;
  // Town: sell, refuel, upgrade (the drill first whenever it is affordable).
  if (bag) { p.money += payslip(Math.round(bag * value)); p.sells++; }
  const refill = (s.tank - fuel) * eco.fuel;
  if (p.money >= refill) p.money -= refill; else { p.debt += (refill - p.money) * 2; p.money = 0; }
  for (let k = 0; k < 6; k++) {
    const opts = ['drill', 'cargo', 'tank', 'hull', 'lamp'].filter((u) => p.up[u] < C.MAX_LEVEL).map((u) => [u, eco.upgrade(u, p.up[u] + 1)])
      .filter(([, c]) => p.money - c > 50).sort((a, b) => (a[0] === 'drill' ? 0 : 1) - (b[0] === 'drill' ? 0 : 1) || a[1] - b[1]);
    if (!opts.length) break;
    p.money -= opts[0][1];
    p.up[opts[0][0]]++;
    if (opts[0][0] === 'drill') mark(`drill level ${p.up.drill + 1} (hardness ${C.UPGRADES.drill.power[p.up.drill]})`);
  }
  for (const site of SITES) if (p.record >= site.depth && !seen.has(site.npc)) { seen.add(site.npc); t += VISIT; mark(`meets ${site.npc} at ${site.depth}m`); }
  for (const id of ['tomas-dies', 'jo-arrives', 'jo-dies']) {
    const b = BEATS.find((x) => x.id === id);
    if (!seen.has(id) && p.sells >= eco.sale(b.trigger.count)) { seen.add(id); mark(`${id} (sale ${eco.sale(b.trigger.count)})`); }
  }
  if (trip % 15 === 0) mark(`trip ${trip}: ${p.record}m · ${p.sells} sales · $${Math.round(p.money)} · debt $${Math.round(p.debt)}`);
}

// Reading: every story-mode line once (about a quarter are conditional and skipped), choices and replies.
let lines = 0;
for (const b of BEATS) {
  if (!(b.modes ?? ['solo']).includes('solo')) continue;
  lines += b.lines.length * 0.75 + (b.choices ? 1 + (b.choices[0].reply?.length ?? 0) : 0);
}
const reading = (lines * READ) / 60, playing = (t * HUMAN) / 60;
if (verbose) for (const [min, label] of log) console.log(`  ${String(min).padStart(4)} min  ${label}`);
console.log(`${length.padEnd(6)}  playing ≈ ${Math.round(playing)} min + reading ≈ ${Math.round(reading)} min  →  about ${Math.round(playing + reading)} min to the mirror · ${p.sells} sales (Jo's thread needs ${eco.sale(21)})`);
}

const pick = process.argv[2];
for (const k of pick ? [pick] : C.DIFFICULTY_KEYS) estimate(k, !!pick);
