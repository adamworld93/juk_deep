// Generative chiptune / ambient soundtrack + sound effects, all synthesized with WebAudio.
// The mood follows where you are: bright on the surface, darker and slower the deeper you dig.

const MOODS = {
  menu:    { root: 57, scale: [0, 3, 5, 7, 10],        bpm: 76, density: 0.45, drone: 0.5, hats: false, wave: 'triangle' },
  surface: { root: 60, scale: [0, 2, 4, 7, 9],         bpm: 96, density: 0.55, drone: 0.3, hats: true,  wave: 'square' },
  topsoil: { root: 57, scale: [0, 3, 5, 7, 10],        bpm: 88, density: 0.5,  drone: 0.4, hats: true,  wave: 'square' },
  clay:    { root: 62, scale: [0, 2, 3, 5, 7, 9, 10],  bpm: 80, density: 0.45, drone: 0.5, hats: true,  wave: 'triangle' },
  stone:   { root: 52, scale: [0, 2, 3, 5, 7, 8, 10],  bpm: 72, density: 0.4,  drone: 0.6, hats: false, wave: 'triangle' },
  deep:    { root: 49, scale: [0, 1, 3, 5, 7, 8, 10],  bpm: 64, density: 0.32, drone: 0.75, hats: false, wave: 'triangle' },
  magma:   { root: 53, scale: [0, 1, 3, 5, 6, 8, 10],  bpm: 58, density: 0.28, drone: 0.9, hats: false, wave: 'sawtooth' },
  core:    { root: 45, scale: [0, 1, 5, 7, 8],         bpm: 48, density: 0.18, drone: 1,   hats: false, wave: 'sine' },
};
export const LAYER_MOODS = ['topsoil', 'clay', 'stone', 'deep', 'magma', 'core'];

let ctx = null, master, music, sfxBus, delay, noise;
let mood = MOODS.menu, moodName = 'menu', drone = null;
let step = 0, nextTime = 0, lastNote = 7, timer = null, duck = 1;
let muted = false;
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
  music.gain.value = 0.22;
  music.connect(master);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = 0.35;
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
  mood = MOODS[name];
  if (!ctx || !drone) return;
  const t = ctx.currentTime;
  drone.oscs.forEach((o, i) => o.frequency.setTargetAtTime(freq(mood.root - 24 + (i === 2 ? 7 : 0)) * (i === 1 ? 1.004 : 1), t, 1.5));
  drone.gain.gain.setTargetAtTime(0.09 * mood.drone, t, 2);
  drone.filter.frequency.setTargetAtTime(300 + 500 * (1 - mood.drone), t, 2);
}

// Lower the music while someone is talking.
export function setDuck(on) {
  duck = on ? 0.4 : 1;
  if (music) music.gain.setTargetAtTime(0.22 * duck, ctx.currentTime, 0.4);
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

function playStep(s, t, spb) {
  const sc = mood.scale;
  // Bass: root on the bar, fifth on beat 3.
  if (s % 8 === 0) note(mood.root - 12, t, spb * 3, 'square', 0.12, 700);
  else if (s % 8 === 4) note(mood.root - 12 + 7, t, spb * 2, 'square', 0.08, 600);
  // Lead: a random walk over the scale.
  if (Math.random() < mood.density) {
    lastNote = Math.max(0, Math.min(sc.length * 2 - 1, lastNote + Math.floor(Math.random() * 5) - 2));
    const pitch = mood.root + 12 * Math.floor(lastNote / sc.length) + sc[lastNote % sc.length];
    note(pitch, t, spb * (Math.random() < 0.2 ? 3 : 1.2), mood.wave, 0.07, 2600, true);
  }
  // Soft ticks on the off-beats near the surface.
  if (mood.hats && s % 2 === 1) hit(t, 0.03, 8000, 0.015);
  // Rare deep bell in the dark layers.
  if (mood.drone > 0.7 && s % 32 === 0 && Math.random() < 0.6) note(mood.root + 24 + sc[Math.floor(Math.random() * sc.length)], t, 3, 'sine', 0.05, 5000, true);
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
};
