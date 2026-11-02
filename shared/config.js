// DEEP — shared game data. Tweak balance here; server and client both import this file.

export const W = 160;                 // world width (columns)
export const SURFACE = 12;            // row index of the grass line; rows above are sky
export const DEPTH = 1000;            // diggable rows below the surface
export const H = SURFACE + DEPTH + 1; // + bedrock floor
export const CHUNK = 32;              // rows per network chunk

export const TICK_RATE = 20;
export const DT = 1 / TICK_RATE;

// Tile ids are indexes into TILES.
export const T = {
  AIR: 0, GRASS: 1, DIRT: 2, CLAY: 3, STONE: 4, HARD: 5, OBSIDIAN: 6, BEDROCK: 7,
  COPPER: 8, IRON: 9, SILVER: 10, GOLD: 11, RUBY: 12, EMERALD: 13, DIAMOND: 14, ARTIFACT: 15, METEORITE: 16,
  GAS: 17, LAVA: 18, CONCRETE: 19, LADDER: 20,
};

export const TILES = [
  { key: 'air',       ch: ' ', color: '#000000', hard: 0 },
  { key: 'grass',     ch: '"', color: '#63d36b', hard: 1 },
  { key: 'dirt',      ch: '░', color: '#9b6b3d', hard: 1 },
  { key: 'clay',      ch: '▒', color: '#b5653a', hard: 2 },
  { key: 'stone',     ch: '▒', color: '#8a8d93', hard: 3 },
  { key: 'hard',      ch: '▓', color: '#6d7078', hard: 4 },
  { key: 'obsidian',  ch: '▓', color: '#6a46a8', hard: 6 },
  { key: 'bedrock',   ch: '█', color: '#2c2c33', hard: 99 },
  { key: 'copper',    ch: '•', color: '#e8893a', hard: 2, ore: true, value: 15,   name: 'Copper' },
  { key: 'iron',      ch: '%', color: '#d0a888', hard: 3, ore: true, value: 30,   name: 'Iron' },
  { key: 'silver',    ch: '*', color: '#e6eef7', hard: 3, ore: true, value: 60,   name: 'Silver' },
  { key: 'gold',      ch: '$', color: '#ffd23f', hard: 4, ore: true, value: 120,  name: 'Gold' },
  { key: 'ruby',      ch: '♦', color: '#ff3b5c', hard: 5, ore: true, value: 250,  name: 'Ruby' },
  { key: 'emerald',   ch: '♣', color: '#2fe58a', hard: 5, ore: true, value: 400,  name: 'Emerald' },
  { key: 'diamond',   ch: '◆', color: '#8ff6ff', hard: 6, ore: true, value: 800,  name: 'Diamond' },
  { key: 'artifact',  ch: '¤', color: '#ff8af0', hard: 6, ore: true, value: 2000, name: 'Artifact' },
  { key: 'meteorite', ch: '✦', color: '#ffb86b', hard: 5, ore: true, value: 1500, name: 'Meteorite' },
  { key: 'gas',       ch: '▒', color: '#7f9a6c', hard: 3, hazard: 'gas' },
  { key: 'lava',      ch: '≈', color: '#ff5a1f', hard: 99, hazard: 'lava' },
  { key: 'concrete',  ch: '▀', color: '#8f969e', hard: 99 },
  { key: 'ladder',    ch: 'H', color: '#c8a060', hard: 0 },
];
export const ORES = TILES.filter((t) => t.ore).map((t) => t.key);
export const tileByKey = Object.fromEntries(TILES.map((t, i) => [t.key, i]));
// Ladders are open space you can also stand and climb on.
export const passable = (t) => t === T.AIR || t === T.LADDER;

// Layers: depth = rows below the grass line. Rock mix + ore chances per cell.
export const LAYERS = [
  { name: 'Topsoil',   to: 60,   rock: { dirt: 80, clay: 20 },                 ores: { copper: 3.5, iron: 1.5 },                                   gas: 0,   lava: 0 },
  { name: 'Clay Beds', to: 150,  rock: { clay: 60, dirt: 15, stone: 25 },      ores: { copper: 3, iron: 4, silver: 1.5 },                        gas: 0.6, lava: 0 },
  { name: 'Stone',     to: 280,  rock: { stone: 70, hard: 30 },                ores: { iron: 3, silver: 3.5, gold: 1.5 },                        gas: 1.2, lava: 0 },
  { name: 'Deep Rock', to: 450,  rock: { hard: 80, stone: 20 },                ores: { silver: 2, gold: 3, ruby: 1.2, emerald: 0.5 },            gas: 1.2, lava: 0.6 },
  { name: 'Magma',     to: 700,  rock: { hard: 55, obsidian: 45 },             ores: { gold: 2, ruby: 2, emerald: 1.4, diamond: 0.5 },           gas: 0.8, lava: 1.8 },
  { name: 'The Core',  to: 1001, rock: { obsidian: 85, hard: 15 },             ores: { ruby: 2, emerald: 2, diamond: 1.4, artifact: 0.25 },      gas: 0.5, lava: 2.5 },
];
export const depthOf = (y) => Math.max(0, y - SURFACE + 1);
export const layerOf = (depth) => LAYERS.find((l) => depth < l.to) ?? LAYERS[LAYERS.length - 1];

// Upgrades: 8 levels each (index 0 = starting gear).
export const UPGRADES = {
  drill: { name: 'Drill',  desc: 'dig speed + hardness', cost: [0, 200, 500, 1300, 3000, 7000, 18000, 45000],
           speed: [1, 1.35, 1.8, 2.4, 3.1, 4, 5.2, 6.6], power: [3, 3, 4, 4, 5, 6, 6, 7] },
  tank:  { name: 'Fuel tank', desc: 'max fuel', cost: [0, 100, 280, 800, 1800, 4500, 11000, 25000],
           value: [30, 45, 65, 90, 125, 170, 230, 300] },
  cargo: { name: 'Cargo bay', desc: 'ore capacity', cost: [0, 150, 400, 1000, 2600, 6300, 15000, 33000],
           value: [8, 12, 18, 26, 36, 50, 70, 100] },
  hull:  { name: 'Hull', desc: 'max HP + safe fall', cost: [0, 120, 350, 950, 2400, 5600, 13000, 31000],
           value: [40, 60, 85, 115, 155, 205, 270, 350] },
  lamp:  { name: 'Lamp', desc: 'light radius', cost: [0, 80, 250, 700, 1750, 4200, 10000, 23000],
           value: [5, 6, 7, 8, 10, 12, 14, 17] },
};
export const UPGRADE_KEYS = Object.keys(UPGRADES);
export const MAX_LEVEL = 7;

export const ITEMS = {
  dynamite: { name: 'Dynamite', key: '1', price: 300, desc: 'blast a hole, grab the ore' },
  teleport: { name: 'Teleporter', key: '2', price: 300, desc: 'warp to the surface with your cargo' },
  repair:   { name: 'Repair kit', key: '3', price: 250, desc: '+50 hull anywhere' },
  fuel:     { name: 'Fuel can', key: '4', price: 150, desc: '+40 fuel anywhere' },
  ladder:   { name: 'Ladder', key: '5', price: 40, qty: 5, desc: 'climb without fuel · placed for you when the tank is dry' },
};
export const START_INV = { dynamite: 1, teleport: 1, repair: 0, fuel: 0, ladder: 10 };
export const ITEM_KEYS = Object.keys(ITEMS);

// Costs and timings
export const FUEL_PRICE = 0.6;        // $ per fuel unit at the pump ('normal'; see DIFFICULTIES)
export const REPAIR_PRICE = 4;        // $ per hull point at the shop
export const MOVE_TIME = 0.11;
export const UP_TIME = 0.15;          // thruster: flying up through open air
export const CLIMB_TIME = 0.24;       // climbing a shaft wall: slower, but free
export const FALL_TIME = 0.055;
export const DIG_TIME = 0.36;         // × hardness / drill speed
export const DIG_BASE = 0.06;         // flat time added to every dig
export const FUEL_MOVE = 0.08;
export const FUEL_UP = 0.25;
export const FUEL_DIG = 0.18;         // × hardness
export const FALL_DAMAGE = 3;         // per cell beyond the safe fall height (safe = 8 + 2 × hull level)
export const REBIRTH_DEPTH = 450;     // reach the Magma layer to unlock rebirth
export const REBIRTH_BONUS = 0.15;    // +15% sell price per star

// Surface buildings (x = left column of the sign).
export const STATIONS = [
  { key: 'fuel', name: 'FUEL', x: W / 2 - 18, w: 8 },
  { key: 'sell', name: 'MARKET', x: W / 2 - 4, w: 8 },
  { key: 'shop', name: 'SHOP', x: W / 2 + 10, w: 8 },
];
// The town sits on an indestructible platform so nobody can dig a shaft under the shops.
export const TOWN = { x0: W / 2 - 20, x1: W / 2 + 31 };
export const stationAt = (x) => STATIONS.find((s) => x >= s.x - 1 && x <= s.x + s.w);

// The Company lift: a shaft under the headframe with a landing every 100 m. A landing opens once
// you have been that deep. Riding costs money (more the further you go).
export const LIFT = { x: W / 2 + 24, every: 100, deepest: 600 };
export const LIFT_STOPS = Array.from({ length: LIFT.deepest / LIFT.every }, (_, i) => (i + 1) * LIFT.every);
export const liftRow = (d) => SURFACE - 1 + d; // the row you stand on at a stop (0 = town)
// The stop you are standing at (0 = town, else the landing's depth), or null.
export const liftStopAt = (x, y) => {
  if (Math.abs(x - LIFT.x) > 2) return null;
  if (y === SURFACE - 1) return 0;
  const d = depthOf(y);
  return LIFT_STOPS.includes(d) ? d : null;
};
export const liftFare = (from, to) => 10 + Math.round(Math.abs(from - to) / 10);

// Story length. The same world and story; what changes is the economy (prices, the Company's cut)
// and how many paydays apart the story's moments are. The Commons always plays 'normal'.
export const DIFFICULTIES = {
  short:  { label: 'short',  hint: '~1 hour',  cost: 0.25, fuel: 0.3, cut: 0.5, pace: 0.5 },
  normal: { label: 'normal', hint: '~2 hours', cost: 1,    fuel: 0.6, cut: 1,   pace: 1 },
  long:   { label: 'long',   hint: '~4 hours', cost: 2.3,  fuel: 1,   cut: 1.3, pace: 1.6 },
};
export const DIFFICULTY_KEYS = Object.keys(DIFFICULTIES);
const nice = (v) => (v >= 1000 ? Math.round(v / 100) * 100 : v >= 100 ? Math.round(v / 10) * 10 : Math.round(v));
// Every price and cut in one place, for a given story length.
export function economy(key) {
  const d = DIFFICULTIES[key] ?? DIFFICULTIES.normal;
  return {
    key: DIFFICULTIES[key] ? key : 'normal',
    fuel: d.fuel, repair: REPAIR_PRICE,
    upgrade: (k, level) => nice(UPGRADES[k].cost[level] * d.cost),
    item: (k) => nice(ITEMS[k].price * Math.sqrt(d.cost)),
    fare: (from, to) => Math.round(liftFare(from, to) * Math.sqrt(d.cost)),
    cut: d.cut,
    // The payday on which a story moment lands (later moments stretch, the first ones stay put).
    sale: (n) => (n <= 2 ? n : Math.max(3, Math.round(n * d.pace))),
  };
}
