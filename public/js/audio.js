// Generative soundtrack + sound effects, all synthesized with WebAudio.
// Every mood is a small composition: a bass line walking a chord progression, a soft pad, and a lead
// that plays written motifs in song form (A A B A …) with slight variations each time round, plus
// one improvised bar and one bar of silence per cycle so it breathes. Layers get darker and slower
// with depth; story characters bring their own themes into a conversation.
//
// Motifs are 8 eighth notes: scale-step numbers (can go below 0 or past the octave) or null for a rest.
// A note rings until the next one. `prog` is the bass root of each bar, in semitones.
const S = {
  majPent: [0, 2, 4, 7, 9], minPent: [0, 3, 5, 7, 10], major: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], locrian: [0, 1, 3, 5, 6, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11], whole: [0, 2, 4, 6, 8, 10], lament: [0, 2, 3, 7, 8],
};
const _ = null;
const MOODS = {
  // ── places ──
  menu: { root: 57, scale: S.minPent, bpm: 76, wave: 'triangle', drone: 0.5, prog: [0, 8, 10, 0],
    A: [0, _, 2, 3, 4, _, 3, _], B: [5, _, 4, _, 3, 2, 1, _], vary: 0.15 },
  surface: { root: 60, scale: S.majPent, bpm: 96, wave: 'square', drone: 0.3, hats: true, prog: [0, 9, 5, 7],
    A: [5, _, 4, 3, 2, _, 3, _], B: [2, 3, 4, 5, 6, _, 5, 4], vary: 0.15 },
  topsoil: { root: 57, scale: S.minPent, bpm: 88, wave: 'square', drone: 0.4, hats: true, prog: [0, 5, 3, 7],
    A: [0, 1, 2, _, 4, _, 2, 1], B: [3, _, 2, _, 1, _, 0, _], vary: 0.2 },
  clay: { root: 62, scale: S.dorian, bpm: 80, wave: 'triangle', drone: 0.5, hats: true, prog: [0, 5, 0, 7],
    A: [0, 2, 4, _, 3, 2, 1, _], B: [5, _, 4, 3, 4, _, 2, _], vary: 0.2 },
  stone: { root: 52, scale: S.aeolian, bpm: 72, wave: 'triangle', drone: 0.6, prog: [0, 8, 3, 10],
    A: [4, _, _, 3, 2, _, _, _], B: [0, _, 2, _, 3, _, 1, _], vary: 0.25 },
  deep: { root: 49, scale: S.phrygian, bpm: 64, wave: 'triangle', drone: 0.75, prog: [0, 1, 0, 10],
    A: [0, _, 1, _, 0, _, _, _], B: [4, _, 3, _, 1, _, _, _], vary: 0.2, bell: true },
  magma: { root: 53, scale: S.locrian, bpm: 58, wave: 'sawtooth', drone: 0.9, prog: [0, 1, 6, 0],
    A: [0, _, _, 4, 3, _, _, _], B: [6, _, 4, _, 1, _, 0, _], vary: 0.25, bell: true },
  core: { root: 45, scale: [0, 1, 5, 7, 8], bpm: 48, wave: 'sine', drone: 1, prog: [0, 0, 1, 0],
    A: [0, _, _, _, 4, _, _, _], B: [2, _, _, _, 1, _, _, _], vary: 0.1, bell: true },
  lament: { root: 50, scale: S.lament, bpm: 52, wave: 'sine', drone: 0.7, prog: [0, 8, 3, 7],
    A: [4, _, 3, 2, 1, _, _, _], B: [2, 3, 4, _, 3, _, 2, _], vary: 0.1 },
  // ── characters (their theme plays while they talk) ──
  foreman: { root: 60, scale: S.major, bpm: 120, wave: 'square', drone: 0.15, hats: true, prog: [0, 5, 7, 0],
    A: [4, 4, 4, _, 2, _, 4, _], B: [7, _, 6, 5, 4, _, 0, _], vary: 0.05 },        // a cheerful company jingle
  lastman: { root: 72, scale: S.majPent, bpm: 66, wave: 'sine', drone: 0.1, prog: [0, 0, 5, 5],
    A: [4, _, 2, _, 3, _, 1, _], B: [2, _, 0, _, 1, _, _, _], vary: 0 },          // a music box, winding down
  madman: { root: 59, scale: S.whole, bpm: 104, wave: 'sawtooth', drone: 0.4, prog: [0, 2, 6, 4],
    A: [0, 3, 1, 4, 2, 5, _, 0], B: [5, _, 2, _, 6, 1, _, _], vary: 0.5 },        // whole-tone, unmoored
  hermit: { root: 62, scale: S.minPent, bpm: 60, wave: 'triangle', drone: 0.4, prog: [0, 0, 7, 0],
    A: [0, _, _, 1, 2, _, _, _], B: [3, _, 2, _, 1, _, 0, _], vary: 0.15 },        // a wooden flute by the fire
  roller: { root: 55, scale: S.dorian, bpm: 84, wave: 'triangle', drone: 0.4, prog: [0, 3, 5, 7],
    A: [0, _, 2, _, 4, _, 5, _], B: [7, 6, 5, 4, 3, 2, 1, 0], vary: 0.05 },        // up the hill… and back down
  drill: { root: 48, scale: S.phrygian, bpm: 112, wave: 'square', drone: 0.5, prog: [0, 0, 1, 0],
    A: [0, 2, 4, 7, 4, 2, 0, 2], B: [1, 3, 5, 8, 5, 3, 1, 3], vary: 0 },           // a machine: never varies
  abyss: { root: 43, scale: [0, 1, 5, 6, 7], bpm: 44, wave: 'sine', drone: 1, prog: [0, 1, 0, 6],
    A: [0, _, _, _, _, _, 3, _], B: [4, _, _, _, 1, _, _, _], vary: 0.1, bell: true },
  mirror: { root: 64, scale: S.lydian, bpm: 60, wave: 'sine', drone: 0.5, prog: [0, 2, 0, 7],
    A: [0, 4, 7, 4, 3, _, 2, _], B: [9, _, 7, _, 6, 4, _, _], vary: 0.1, bell: true },
  child: { root: 67, scale: S.major, bpm: 112, wave: 'triangle', drone: 0.1, hats: true, prog: [0, 5, 0, 7],
    A: [0, 2, 4, 2, 7, _, 4, _], B: [5, 4, 3, 2, 1, _, 0, _], vary: 0.2 },
  tomas: { root: 55, scale: S.major, bpm: 70, wave: 'square', drone: 0.4, prog: [0, 5, 0, 7],
    A: [2, _, 1, 0, _, _, 1, _], B: [4, _, 2, _, 1, _, 0, _], vary: 0.1 },         // an old harmonica tune
  jo: { root: 69, scale: S.majPent, bpm: 84, wave: 'triangle', drone: 0.15, prog: [0, 5, 9, 7],
    A: [0, 2, 4, 2, 3, _, 1, _], B: [4, _, 3, 2, 1, _, 0, _], vary: 0.1 },          // small, bright, a little too brave
  silence: { root: 45, scale: S.minPent, bpm: 40, wave: 'sine', drone: 0, mute: true, A: [], B: [] }, // nothing at all
  postman: { root: 62, scale: S.majPent, bpm: 92, wave: 'triangle', drone: 0.2, prog: [0, 5, 7, 0],
    A: [0, 1, 2, _, 2, 1, 0, _], B: [3, _, 2, 1, 2, _, 0, _], vary: 0.1 },        // a walking song over the hills
};
MOODS.tomaslamp = MOODS.lament;
MOODS.jolamp = MOODS.silence;
export const hasMood = (name) => !!MOODS[name];
// Which motif each bar of an 8-bar cycle plays: '~' improvises, '.' rests.
const FORM = ['A', 'A', 'B', 'A', 'A', 'B', '~', '.'];
export const LAYER_MOODS = ['topsoil', 'clay', 'stone', 'deep', 'magma', 'core'];

// The story reshapes the places' music as it goes. Each chapter changes how the same themes are
// played, so a layer stays recognisable while what has happened to you colours it:
//   minor / major: flatten (or brighten) the thirds, sixths and sevenths;  bpm: tempo factor;
//   thin: share of melody notes kept (gaps where something is missing);  drive: a pulsing bass;
//   edge: a harder lead;  counter: another theme's tune in the quiet bars, `drop` = notes lost from it.
const CHAPTERS = {
  burden: {},
  jo: { counter: { theme: 'jo', drop: 0 } },                                     // her tune, high and bright
  refusal: { drive: true, bpm: 1.08, edge: true },                               // the word "no", on a loop
  grief: { minor: true, bpm: 0.82, thin: 0.55, hats: false, counter: { theme: 'jo', drop: 0.45 } }, // her tune, broken
  reckoning: { minor: true, drive: true, bpm: 0.95, edge: true, counter: { theme: 'jo', drop: 0.45 } }, // grief turned to anger
  company: { minor: true, bpm: 0.9, counter: { theme: 'foreman', drop: 0.2 } }, // the jingle, gone sour
  hollow: { thin: 0.3, bpm: 0.7, hats: false },                                  // almost nothing, on purpose
  home: { major: true, bpm: 0.9, hats: false },                                  // warm and unhurried
  recurrence: { counter: { theme: 'jo', drop: 0 } },                             // the first song, and her tune whole again
};
const PLACES = new Set(['surface', ...LAYER_MOODS]);
const FLAT = { 4: 3, 9: 8, 11: 10 }, BRIGHT = { 3: 4, 8: 9, 10: 11 };
let chapter = CHAPTERS.burden, chapterName = 'burden';

// A place's theme as the current chapter plays it.
function shaped(name) {
  const base = MOODS[name], ch = chapter;
  if (!PLACES.has(name) || chapterName === 'burden') return base;
  const swap = ch.minor ? FLAT : ch.major ? BRIGHT : null;
  const tone = (v) => (swap ? swap[v] ?? v : v);
  return {
    ...base,
    scale: base.scale.map(tone), prog: base.prog?.map(tone),
    bpm: base.bpm * (ch.bpm ?? 1), hats: ch.hats ?? base.hats, thin: ch.thin, drive: ch.drive, counter: ch.counter,
    wave: ch.edge ? (base.wave === 'sine' ? 'triangle' : 'sawtooth') : base.wave,
  };
}

export function setChapter(name) {
  if (!CHAPTERS[name] || name === chapterName) return;
  chapterName = name;
  chapter = CHAPTERS[name];
  if (PLACES.has(moodName)) mood = shaped(moodName); // the same song carries on, changed
}

let ctx = null, master, music, sfxBus, delay, noise;
let mood = MOODS.menu, moodName = 'menu', drone = null;
let step = 0, nextTime = 0, lastNote = 7, timer = null, duck = 1;
let muted = false, musicVol = 1, sfxVol = 1;
try { muted = localStorage.getItem('deep-muted') === '1'; } catch {}

const freq = (midi) => 440 * 2 ** ((midi - 69) / 12);

export function initAudio() {
  if (ctx) { ctx.resume?.(); return; }
  try { ctx = new AudioContext(); } catch { return; }
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.8;
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp).connect(ctx.destination);
  music = ctx.createGain();
  music.gain.value = 0.22 * musicVol;
  music.connect(master);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = 0.35 * sfxVol;
  sfxBus.connect(master);
  // Echo for the lead voice — gives the mine its cavernous feel.
  delay = ctx.createDelay(1);
  delay.delayTime.value = 0.36;
  const fb = ctx.createGain();
  fb.gain.value = 0.38;
  const damp = ctx.createBiquadFilter();
  damp.type = 'lowpass';
  damp.frequency.value = 1800;
  delay.connect(damp).connect(fb).connect(delay);
  delay.connect(music);
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  startDrone();
  nextTime = ctx.currentTime + 0.1;
  timer = setInterval(schedule, 25);
}

export function setMood(name) {
  if (!MOODS[name] || name === moodName) return;
  moodName = name;
  mood = shaped(name);
  step = 0; // a new theme starts from its first bar
  if (!ctx || !drone) return;
  const t = ctx.currentTime;
  drone.oscs.forEach((o, i) => o.frequency.setTargetAtTime(freq(mood.root - 24 + (i === 2 ? 7 : 0)) * (i === 1 ? 1.004 : 1), t, 1.5));
  drone.gain.gain.setTargetAtTime(0.09 * mood.drone, t, mood.mute ? 0.3 : 2); // silence falls fast
  drone.filter.frequency.setTargetAtTime(300 + 500 * (1 - mood.drone), t, 2);
}

// Lower the music while someone is talking.
export function setDuck(on) {
  duck = on ? 0.4 : 1;
  if (music) music.gain.setTargetAtTime(0.22 * duck * musicVol, ctx.currentTime, 0.4);
}

// Volumes 0..1 from the settings menu.
export function setVolumes(m, s) {
  musicVol = m;
  sfxVol = s;
  if (!ctx) return;
  music.gain.setTargetAtTime(0.22 * duck * musicVol, ctx.currentTime, 0.1);
  sfxBus.gain.setTargetAtTime(0.35 * sfxVol, ctx.currentTime, 0.1);
}

export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem('deep-muted', muted ? '1' : '0'); } catch {}
  if (master) master.gain.setTargetAtTime(muted ? 0 : 0.8, ctx.currentTime, 0.1);
  return muted;
}
export const isMuted = () => muted;

function startDrone() {
  const gain = ctx.createGain();
  gain.gain.value = 0.09 * mood.drone;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 500;
  filter.Q.value = 4;
  const lfo = ctx.createOscillator(), lfoAmt = ctx.createGain();
  lfo.frequency.value = 0.07;
  lfoAmt.gain.value = 180;
  lfo.connect(lfoAmt).connect(filter.frequency);
  lfo.start();
  const oscs = [0, 1, 2].map((i) => {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq(mood.root - 24 + (i === 2 ? 7 : 0)) * (i === 1 ? 1.004 : 1);
    o.connect(filter);
    o.start();
    return o;
  });
  filter.connect(gain).connect(music);
  drone = { oscs, gain, filter };
}

function schedule() {
  if (!ctx) return;
  const spb = 60 / mood.bpm / 2; // eighth notes
  while (nextTime < ctx.currentTime + 0.12) {
    playStep(step, nextTime, spb);
    nextTime += spb;
    step++;
  }
}

// The pitch of scale step `d` (may be negative or past one octave).
function pitchOf(d) {
  const sc = mood.scale, n = sc.length, oct = Math.floor(d / n);
  return mood.root + 12 * oct + sc[((d % n) + n) % n];
}

function playStep(s, t, spb) {
  if (mood.mute) return;
  const pos = s % 8, bar = Math.floor(s / 8), part = FORM[bar % FORM.length];
  const chord = mood.root + (mood.prog?.[bar % mood.prog.length] ?? 0);
  const bass = chord - 12 - (chord - mood.root > 6 ? 12 : 0);
  // Bass: chord root on the bar, fifth on beat 3. Pad: a soft open fifth under the whole bar.
  if (mood.drive && pos % 2 === 0 && pos !== 0 && pos !== 4) note(bass, t, spb * 0.6, 'square', 0.07, 500);
  if (pos === 0) {
    note(bass, t, spb * 3, 'square', 0.12, 700);
    note(chord, t, spb * 8, 'sine', 0.022, 1200);
    note(chord + 7, t, spb * 8, 'sine', 0.016, 1200);
  } else if (pos === 4) note(bass + 7, t, spb * 2, 'square', 0.08, 600);
  // Lead.
  if (part === 'A' || part === 'B') {
    const motif = mood[part];
    let d = motif[pos];
    if (d != null && mood.thin && Math.random() > mood.thin) d = null; // a gap where a note should be
    if (d != null) {
      if (Math.random() < mood.vary) d += Math.random() < 0.5 ? -1 : 1;    // a little different each time
      let len = 1;
      while (pos + len < 8 && motif[pos + len] == null && len < 4) len++;  // ring until the next note
      lastNote = d;
      note(pitchOf(d), t, spb * len * 0.95 + 0.04, mood.wave, 0.07, 2600, true);
    }
  } else if (mood.counter) {
    // The two quiet bars at the end of each cycle belong to someone else's tune — it answers the place's
    // theme an octave above (and, in grief, with notes missing).
    const c = mood.counter, cm = MOODS[c.theme]?.[part === '~' ? 'A' : 'B'];
    if (cm?.[pos] != null && Math.random() >= c.drop) {
      let len = 1;
      while (pos + len < 8 && cm[pos + len] == null && len < 4) len++;
      note(pitchOf(cm[pos]) + 12, t, spb * len * 0.95 + 0.04, 'sine', 0.05, 3200, true);
    }
  } else if (part === '~' && Math.random() < 0.45) {
    // One bar of improvising around where the tune left off.
    lastNote = Math.max(-2, Math.min(mood.scale.length * 2 - 1, lastNote + Math.floor(Math.random() * 5) - 2));
    note(pitchOf(lastNote), t, spb * 1.2, mood.wave, 0.06, 2600, true);
  }
  // Soft ticks on the off-beats near the surface.
  if (mood.hats && s % 2 === 1) hit(t, 0.03, 8000, 0.015);
  // A rare deep bell in the dark places.
  if (mood.bell && s % 32 === 0 && Math.random() < 0.6) note(pitchOf(mood.scale.length * 2 + Math.floor(Math.random() * mood.scale.length)), t, 3, 'sine', 0.05, 5000, true);
}

function note(midi, t, dur, wave, vol, cutoff, echo = false) {
  const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
  o.type = wave;
  o.frequency.value = freq(midi);
  f.type = 'lowpass';
  f.frequency.value = cutoff;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f).connect(g).connect(music);
  if (echo) g.connect(delay);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function hit(t, dur, cutoff, vol, bus = music, type = 'highpass') {
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noise;
  f.type = type;
  f.frequency.value = cutoff;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(bus);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

function sfxTone(f0, f1, dur, vol, wave = 'square', at = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = wave;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(sfxBus);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export const sfx = {
  dig(hard = 1) { if (ctx) hit(ctx.currentTime, 0.05 + hard * 0.01, 600 + hard * 300, 0.25, sfxBus, 'bandpass'); },
  ore(value = 15) {
    const base = 600 + Math.min(1400, Math.log2(value) * 120);
    sfxTone(base, base * 1.5, 0.12, 0.18, 'triangle');
    sfxTone(base * 1.5, base * 2, 0.16, 0.14, 'triangle', 0.08);
  },
  coin() { [0, 0.07, 0.14].forEach((d, i) => sfxTone(988 * 1.26 ** i, 988 * 1.26 ** i, 0.12, 0.15, 'square', d)); },
  boom() { if (ctx) { hit(ctx.currentTime, 0.9, 200, 0.9, sfxBus, 'lowpass'); sfxTone(120, 30, 0.6, 0.4, 'sine'); } },
  hurt() { sfxTone(300, 80, 0.2, 0.3, 'sawtooth'); },
  blip(pitch = 1) { sfxTone(420 * pitch, 400 * pitch, 0.03, 0.05, 'square'); },
  choose() { sfxTone(500, 900, 0.1, 0.12, 'triangle'); },
  warp() { sfxTone(200, 1600, 0.4, 0.15, 'sine'); },
  denied() { sfxTone(160, 120, 0.12, 0.12, 'square'); },
  cough() { if (ctx) { hit(ctx.currentTime, 0.12, 900, 0.25, sfxBus, 'bandpass'); hit(ctx.currentTime + 0.18, 0.1, 800, 0.18, sfxBus, 'bandpass'); } },
  rumble() { if (ctx) { hit(ctx.currentTime, 1.6, 120, 0.7, sfxBus, 'lowpass'); sfxTone(60, 35, 1.4, 0.3, 'sine'); } },
  // The lift: a clank to start, the cage rattling on the way, a clank to stop.
  lift(dur = 2) {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    hit(t0, 0.25, 300, 0.5, sfxBus, 'bandpass');
    for (let k = 0.3; k < dur; k += 0.17) hit(t0 + k, 0.06, 900 + Math.random() * 600, 0.12, sfxBus, 'bandpass');
    hit(t0 + dur, 0.3, 250, 0.55, sfxBus, 'bandpass');
  },
  // An act title card: a slow swell. I is a minor chord, II hangs unresolved, III opens up.
  sting(act = 1) {
    if (!ctx) return;
    const chord = act === 1 ? [0, 3, 7] : act === 2 ? [0, 5, 10] : [0, 4, 7, 12];
    chord.forEach((n, i) => sfxTone(110 * 2 ** (n / 12), 110 * 2 ** (n / 12), 3.2, 0.09, 'triangle', i * 0.12));
    sfxTone(55, 55, 3.6, 0.12, 'sine');
  },
  toll() { [0, 1.6].forEach((d) => { sfxTone(196, 194, 2.4, 0.25, 'sine', d); sfxTone(392, 390, 1.8, 0.08, 'sine', d); }); },
};
