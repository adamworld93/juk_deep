// Server behaviour tests: movement, death, hostile input, the story's inner voice.
// Run with `npm test`. Each test builds its own solo world in a temp folder; nothing touches data/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Game } from '../server/game.js';
import { AttemptLimiter, LOGIN_ATTEMPTS_BEFORE_LOCK } from '../server/limits.js';
import * as C from '../shared/config.js';
import { BEATS, SCRAPS, THOUGHTS } from '../shared/story.js';

const { T, SURFACE } = C;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'deep-test-'));

// A game whose clock we drive by hand. `sent` collects every message to the player.
function setup(mode = 'solo') {
  const g = new Game({ mode, saveFile: path.join(tmp, `${Math.random()}.json`) });
  clearInterval(g.loop);
  clearInterval(g.saver);
  const sent = [];
  const conn = { ws: { readyState: 1, bufferedAmount: 0, send: (s) => sent.push(JSON.parse(s)) }, player: null, host: false, chunks: new Set(), joined: false };
  g.join(conn, { t: 'join', name: 'Tester', pin: '1234' });
  const p = conn.player;
  if (p.dialog) g.storyDone(p, p.dialog);
  sent.length = 0;
  return { g, p, conn, sent, w: g.world };
}
const run = (g, sec) => { for (let i = 0; i < sec * C.TICK_RATE; i++) g.update(); };
// An empty cave (x 40–69) with a stone floor, 100 m down; the miner stands on the floor.
function cave(g, p) {
  const Y = SURFACE + 100;
  for (let y = Y - 20; y <= Y; y++) for (let x = 40; x < 70; x++) g.world.set(x, y, T.AIR);
  for (let x = 40; x < 70; x++) g.world.set(x, Y + 1, T.STONE);
  Object.assign(p, { x: 50, y: Y });
  p.story.done = BEATS.map((b) => b.id); // no story beats interrupting movement tests
  return Y;
}

test('walking along a tunnel floor costs no fuel', () => {
  const { g, p } = setup();
  cave(g, p);
  p.fuel = 0;
  g.onMessage(p.conn, { t: 'in', d: 'R' });
  run(g, 1);
  assert.ok(p.x > 55, `walked to x=${p.x}`);
});

test('holding up in open air with an empty tank hangs ladders instead of falling', () => {
  const { g, p, w } = setup();
  const Y = cave(g, p);
  p.fuel = 0;
  g.onMessage(p.conn, { t: 'in', d: 'U' });
  run(g, 2);
  assert.ok(p.y < Y, 'climbed');
  let ladders = 0;
  for (let y = p.y; y <= Y; y++) if (w.get(p.x, y) === T.LADDER) ladders++;
  assert.ok(ladders >= 3, `a trail of ladders below (${ladders})`);
  assert.ok(p.inv.ladder < C.START_INV.ladder);
  // Letting go on the ladder trail does not drop the miner.
  g.onMessage(p.conn, { t: 'in', d: '' });
  run(g, 0.5);
  const y = p.y;
  run(g, 1);
  assert.equal(p.y, y);
});

test('a tap shorter than a tick still moves one cell', () => {
  const { g, p } = setup();
  cave(g, p);
  g.onMessage(p.conn, { t: 'in', d: 'L' });
  g.onMessage(p.conn, { t: 'in', d: '' });
  run(g, 0.5);
  assert.equal(p.x, 49);
});

test('digging needs the button held: tapping or letting go early breaks nothing', () => {
  const { g, p, w } = setup();
  cave(g, p);
  const startY = p.y;
  g.onMessage(p.conn, { t: 'in', d: 'D' });
  g.onMessage(p.conn, { t: 'in', d: '' });
  run(g, 3);
  assert.equal(p.y, startY);
  assert.notEqual(w.get(p.x, startY + 1), T.AIR);
  for (let i = 0; i < 40; i++) {
    g.onMessage(p.conn, { t: 'in', d: 'D' });
    g.update();
    g.onMessage(p.conn, { t: 'in', d: '' });
    g.update();
  }
  assert.equal(p.y, startY);
  assert.notEqual(w.get(p.x, startY + 1), T.AIR);
  g.onMessage(p.conn, { t: 'in', d: 'D' });
  run(g, 3);
  assert.ok(p.y > startY);
});

test('the pause menu freezes the story', () => {
  const { g, p } = setup();
  cave(g, p);
  g.onMessage(p.conn, { t: 'pause', on: true });
  p.dir = 'R';
  run(g, 1);
  assert.equal(p.x, 50);
});

test('dying to a gas pocket leaves the miner in town', () => {
  const { g, p, w } = setup();
  const Y = cave(g, p);
  w.set(51, Y, T.GAS);
  p.hull = 5;
  g.finish(p, { type: 'dig', tx: 51, ty: Y, d: 'R' });
  assert.ok(p.y <= SURFACE - 1, `respawned at y=${p.y}`);
});

test('client messages naming inherited keys are ignored, not fatal', () => {
  const { g, p } = setup('world');
  p.x = C.STATIONS.find((s) => s.key === 'shop').x;
  p.y = SURFACE - 1;
  const money = (p.money = 500);
  for (const k of ['toString', '__proto__', 'constructor']) {
    g.onMessage(p.conn, { t: 'upgrade', k });
    g.onMessage(p.conn, { t: 'buy', k });
    g.onMessage(p.conn, { t: 'use', k });
    g.onMessage(p.conn, { t: 'in', d: k });
    g.onMessage(p.conn, { t: 'storyDone', id: 'intro', choice: k });
  }
  assert.doesNotThrow(() => run(g, 1));
  assert.equal(p.money, money);
  assert.equal(p.dir, '');
});

test('joining with a malformed look still works', () => {
  const g = new Game({ mode: 'solo', saveFile: path.join(tmp, 'look.json') });
  clearInterval(g.loop);
  clearInterval(g.saver);
  const conn = { ws: { readyState: 1, bufferedAmount: 0, send() {} }, player: null, host: false, chunks: new Set(), joined: false };
  assert.doesNotThrow(() => g.join(conn, { t: 'join', name: 'Looky', pin: '1234', look: null }));
  assert.ok(conn.joined);
});

test('inner thoughts do not repeat until the pool is used up', () => {
  const { g, p, sent } = setup();
  const pool = THOUGHTS.payday.filter((l) => typeof l === 'string').length;
  const lines = [];
  for (let i = 0; i < pool; i++) {
    p.thoughtAt = {};
    g.think(p, 'payday');
    lines.push(sent.pop().text);
  }
  assert.equal(new Set(lines).size, pool);
});

test('manifesto scraps turn up in order, one per trip, only deep enough', () => {
  const { g, p, sent } = setup();
  p.trip = {};
  for (let i = 0; i < 500; i++) g.maybeScrap(p, SURFACE + SCRAPS[0].depth - 5);
  assert.equal(p.story.scraps ?? 0, 0, 'none above the first depth');
  const found = [];
  for (let trip = 0; trip < 2000 && (p.story.scraps ?? 0) < SCRAPS.length; trip++) {
    p.trip = {};
    for (let k = 0; k < 20; k++) g.maybeScrap(p, SURFACE + 700);
    const beat = sent.findLast((m) => m.t === 'story');
    if (beat && p.dialog) { found.push(beat.id); g.storyDone(p, beat.id); }
  }
  assert.deepEqual(found, SCRAPS.map((_, i) => `scrap-${i + 1}`));
  assert.ok(p.story.flags['read-all']);
});

// Plays a story beat to the end with the given choice and returns its id.
function finishBeat(g, p, sent, choice) {
  const beat = sent.findLast((m) => m.t === 'story');
  assert.ok(beat && p.dialog === beat.id, 'a beat is playing');
  g.storyDone(p, beat.id, choice);
  return beat.id;
}

test('Tomas’s letter is carried up by hand and sent through the Postman', () => {
  const { g, p, sent } = setup();
  p.story.done.push('postman');
  p.story.flags['tomas-gone'] = true;
  g.talkTo(p, g.npcs.find((n) => n.npc === 'tomaslamp'));
  assert.equal(finishBeat(g, p, sent, 0), 'tomas-lamp');
  assert.deepEqual(p.story.carry, ['tomas']);
  assert.ok(!p.story.flags['carried-letter'], 'not delivered yet');

  p.cd = {};
  g.talkTo(p, g.npcs.find((n) => n.npc === 'postman'));
  assert.equal(finishBeat(g, p, sent, 0), 'post-tomas');
  assert.deepEqual(p.story.carry, []);
  assert.ok(p.story.flags['carried-letter'] && p.story.flags['added-note']);

  // The reply comes with the next pay (once no earlier sale beat is due).
  p.story.done.push(...BEATS.filter((b) => b.trigger.type === 'sell' && b.id !== 'hills-reply').map((b) => b.id));
  p.x = C.STATIONS.find((s) => s.key === 'sell').x;
  p.y = SURFACE - 1;
  const sell = () => { p.cargo = { copper: 1 }; sent.length = 0; g.onMessage(p.conn, { t: 'sell' }); };
  sell();
  assert.ok(!sent.some((m) => m.t === 'story'), 'no reply on the very next payday');
  sell();
  assert.equal(finishBeat(g, p, sent), 'hills-reply');
});

test('meeting the Postman with a letter hands it over in the same visit', () => {
  const { g, p, sent } = setup();
  p.story.flags['writing-home'] = true;
  g.carry(p, 'home', true);
  g.talkTo(p, g.npcs.find((n) => n.npc === 'postman'));
  assert.equal(finishBeat(g, p, sent), 'postman');
  assert.equal(finishBeat(g, p, sent), 'post-home');
  assert.ok(p.story.flags['wrote-home']);
  assert.deepEqual(p.story.carry, []);
});

test('an unmet character can be sensed nearby, with a direction', () => {
  const { g, p, sent } = setup();
  const hermit = g.npcs.find((n) => n.npc === 'hermit');
  Object.assign(p, { x: hermit.x + 20, y: hermit.y });
  g.senseNearby(p);
  const t = sent.findLast((m) => m.t === 'think');
  assert.ok(t && t.text.includes('to the left'), t?.text);
  // Once met, no more hints about them.
  p.story.done.push('hermit');
  p.thoughtAt = {};
  sent.length = 0;
  g.senseNearby(p);
  assert.ok(!sent.some((m) => m.t === 'think' && /smoke|humming|cooking/.test(m.text)));
});

test('town gossip points toward characters you have not met yet', () => {
  const { g, p, sent } = setup();
  p.story.done.push('madman');
  p.record = 120;
  g.talkTo(p, g.npcs.find((n) => n.npc === 'madman'));
  const say = sent.findLast((m) => m.t === 'say');
  assert.match(say.text, /(west|east) of town|right under the town/);
});

test('every character stands on concrete that cannot be dug out', () => {
  const { g, p } = setup();
  for (const n of g.npcs) {
    assert.equal(g.world.get(n.x, n.y + 1), T.CONCRETE, `${n.npc} stands on concrete`);
    // Try to dig the floor out from under them.
    Object.assign(p, { x: n.x, y: n.y, act: null, dir: '', fuel: 30, up: { ...p.up, drill: C.MAX_LEVEL } });
    p.story.done = BEATS.map((b) => b.id);
    g.onMessage(p.conn, { t: 'in', d: 'D' });
    run(g, 1);
    assert.equal(g.world.get(n.x, n.y + 1), T.CONCRETE, `${n.npc}'s floor survived digging`);
  }
});

test('a cave-in never buries a character', () => {
  const { g, p } = setup();
  const hermit = g.npcs.find((n) => n.npc === 'hermit');
  Object.assign(p, { x: hermit.x + 3, y: hermit.y });
  for (let i = 0; i < 40; i++) g.caveIn();
  assert.ok(C.passable(g.world.get(hermit.x, hermit.y)));
});

test('the lift carries you and your cargo between open stops, for a fare', () => {
  const { g, p, sent } = setup();
  const y100 = C.liftRow(100);
  assert.equal(g.world.get(C.LIFT.x, y100 + 1), T.CONCRETE, 'a landing floor at 100m');
  // Town → a landing you have never reached: refused.
  Object.assign(p, { x: C.LIFT.x, y: SURFACE - 1, record: 50, money: 500 });
  p.story.done = BEATS.map((b) => b.id);
  g.onMessage(p.conn, { t: 'lift', to: 100 });
  assert.equal(p.ride, undefined);
  // Once you've been that deep, it goes — and charges.
  p.record = 140;
  g.onMessage(p.conn, { t: 'lift', to: 100 });
  assert.ok(p.ride);
  assert.equal(p.money, 500 - C.liftFare(0, 100));
  run(g, 3);
  assert.deepEqual([p.x, p.y], [C.LIFT.x, y100]);
  // And back up, cargo and all.
  p.cargo = { gold: 3 };
  g.onMessage(p.conn, { t: 'lift', to: 0 });
  run(g, 3);
  assert.equal(p.y, SURFACE - 1);
  assert.deepEqual(p.cargo, { gold: 3 });
  // Broke in the story: the Company extends credit, at double.
  p.money = 0;
  const debt = p.debt;
  g.onMessage(p.conn, { t: 'lift', to: 100 });
  assert.equal(p.debt, debt + 2 * C.liftFare(0, 100));
  assert.ok(sent.some((m) => m.t === 'ride'));
});

test('Jo’s thread: a stone sent home, her arrival, and section nine on the debt', () => {
  const { g, p, sent } = setup();
  const quiet = BEATS.filter((b) => b.trigger.type === 'sell' && !b.id.startsWith('jo') && b.id !== 'letter-5' && b.id !== 'letter-3').map((b) => b.id);
  p.story.done.push('postman', ...quiet);
  const sellOnce = () => { Object.assign(p, { x: C.STATIONS.find((s) => s.key === 'sell').x, y: SURFACE - 1, cargo: { copper: 1 } }); sent.length = 0; g.onMessage(p.conn, { t: 'sell' }); };
  const play = (choice) => { const b = sent.findLast((m) => m.t === 'story'); g.storyDone(p, b.id, choice); return b.id; };
  const at = (id) => { p.story.sells = BEATS.find((b) => b.id === id).trigger.count - 1; sellOnce(); }; // the sale that brings it
  at('jo-letter-1');
  assert.equal(play(), 'jo-letter-1');
  g.collect(p, T.COPPER, SURFACE + 30);
  assert.ok(p.story.carry.includes('stone'), 'the next ore is a stone for Jo');
  g.talkTo(p, g.npcs.find((n) => n.npc === 'postman'));
  assert.equal(play(), 'post-stone');
  sellOnce(); sellOnce();
  assert.equal(play(), 'jo-letter-2');
  p.story.done.push('letter-3', 'letter-5');
  at('jo-letter-3');
  assert.equal(play(), 'jo-letter-3');
  at('jo-arrives');
  assert.equal(play(0), 'jo-arrives');
  assert.ok(p.story.carry.includes('jostone'), 'she gives the stone back');
  assert.ok(g.npcVisible(g.npcs.find((n) => n.npc === 'jo'), p));
  at('jo-2');
  assert.equal(play(), 'jo-2');
  at('jo-dies');
  const debt = p.debt; // after the payslip's own instalment
  assert.equal(play(), 'jo-dies');
  assert.equal(p.debt, debt + 2200);
  assert.ok(!g.npcVisible(g.npcs.find((n) => n.npc === 'jo'), p));
  assert.ok(g.npcVisible(g.npcs.find((n) => n.npc === 'jolamp'), p));
});

test('story length sets prices and when story moments land; one moment per payday', () => {
  const lengths = {};
  for (const len of C.DIFFICULTY_KEYS) {
    const g = new Game({ mode: 'solo', saveFile: path.join(tmp, `len-${len}.json`) });
    clearInterval(g.loop);
    clearInterval(g.saver);
    const sent = [];
    const conn = { ws: { readyState: 1, bufferedAmount: 0, send: (s) => sent.push(JSON.parse(s)) }, player: null, host: false, chunks: new Set(), joined: false };
    g.join(conn, { t: 'join', name: `Len${len}`, pin: '1234', difficulty: len });
    const p = conn.player;
    g.storyDone(p, p.dialog);
    assert.equal(p.difficulty, len);
    // Price of the first drill upgrade.
    Object.assign(p, { x: C.STATIONS.find((s) => s.key === 'shop').x, y: SURFACE - 1, money: 10000 });
    g.onMessage(conn, { t: 'upgrade', k: 'drill' });
    const price = 10000 - p.money;
    // The sale on which Jo's death lands.
    lengths[len] = { price, joDies: C.economy(len).sale(BEATS.find((b) => b.id === 'jo-dies').trigger.count) };
    // Two moments due on one payday: only one plays.
    p.story.done = BEATS.filter((b) => b.trigger.type === 'sell').map((b) => b.id).filter((id) => id !== 'bulletin-1' && id !== 'letter-1');
    Object.assign(p, { x: C.STATIONS.find((s) => s.key === 'sell').x, cargo: { copper: 1 } });
    p.story.sells = 4;
    sent.length = 0;
    g.onMessage(conn, { t: 'sell' });
    g.storyDone(p, p.dialog);
    assert.equal(sent.filter((m) => m.t === 'story').length, 1, 'one story moment this payday');
  }
  assert.ok(lengths.short.price < lengths.normal.price && lengths.normal.price < lengths.long.price);
  assert.ok(lengths.short.joDies < lengths.normal.joDies && lengths.normal.joDies < lengths.long.joDies);
});

test('wrong PINs lock a name for 15 minutes, even with the right PIN, then it opens again', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: 1_000_000 });
  const { g, sent } = setup('world');
  g.leave(g.players.values().next().value.conn);
  const attempt = (pin) => {
    const conn = { ws: { readyState: 1, bufferedAmount: 0, send: (s) => sent.push(JSON.parse(s)), close() {} }, player: null, chunks: new Set(), joined: false };
    sent.length = 0;
    g.join(conn, { t: 'join', name: 'Tester', pin });
    return { conn, error: sent.find((m) => m.t === 'error')?.text };
  };
  for (let i = 0; i < LOGIN_ATTEMPTS_BEFORE_LOCK; i++) assert.match(attempt('9999').error, /already taken/);
  const locked = attempt('1234');
  assert.match(locked.error, /Too many wrong PINs/);
  assert.equal(locked.conn.player, null);
  t.mock.timers.tick(15 * 60 * 1000 + 1);
  assert.ok(attempt('1234').conn.player);
});

test('a limiter blocks at its maximum, per key, until the window ends', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: 1_000_000 });
  const limiter = new AttemptLimiter(2, 1000);
  limiter.record('a');
  assert.equal(limiter.isBlocked('a'), false);
  limiter.record('a');
  assert.equal(limiter.isBlocked('a'), true);
  assert.equal(limiter.isBlocked('b'), false);
  t.mock.timers.tick(1001);
  assert.equal(limiter.isBlocked('a'), false);
});
