import { CHARACTERS, beatById, visible } from '/shared/story.js';
import { playerPortrait } from '/shared/looks.js';
import { sfx, setDuck, setMood, hasMood } from './audio.js';
import { drawMiner } from './sprite.js';

const $ = (id) => document.getElementById(id);
const VOICE = {
  foreman: 1.3, madman: 1.6, hermit: 0.8, roller: 1, abyss: 0.5, mirror: 2, narrator: 0.7, you: 1.2,
  drill: 2.4, lastman: 1.1, child: 2.2, tomas: 0.9, tomaslamp: 0.7, letter: 1.05, scrap: 0.9, postman: 0.95, hills: 1.15, jo: 2.1, joletter: 1.9, memo: 0.8, jolamp: 0.7,
};

export class Dialog {
  constructor(send, getLook) {
    this.send = send;
    this.getLook = getLook;
    this.beat = null;
    this.queue = [];
    this.typing = null;
    this.chosen = false;
    this.isOpen = false;
    $('dialog').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-choice]');
      if (b) this.choose(Number(b.dataset.choice));
      else this.next();
    });
    $('act-card').addEventListener('click', () => this.next());
  }

  get open() { return this.isOpen; }

  // flags: the player's story flags, used to pick conditional lines and choices.
  playBeat(id, flags = {}, cards = true) {
    const b = beatById[id];
    if (!b) return this.send({ t: 'storyDone', id });
    this.beat = b;
    this.flags = flags;
    this.chosen = false;
    this.queue = [...(b.card && cards ? [['__card', b.card]] : []), ...b.lines.filter((l) => visible(l, flags))];
    const speaker = this.queue.find(([who]) => hasMood(who))?.[0];
    this.mood = b.mood ?? speaker ?? null;
    if (this.mood) setMood(this.mood);
    this.show();
  }

  say(npc, text) {
    this.beat = null;
    this.mood = null;
    this.queue = [[npc, text]];
    this.show();
  }

  show() {
    this.isOpen = true;
    $('dialog').classList.remove('hidden');
    setDuck(true);
    this.next();
  }

  next() {
    if (!this.isOpen) return;
    if (!$('act-card').classList.contains('hidden')) {
      $('act-card').classList.add('hidden');
      $('dialog').classList.remove('hidden');
    }
    if (this.typing) { this.finishTyping(); return; }
    if (!$('dlg-choices').classList.contains('hidden')) return; // waiting for a choice
    if (this.queue.length) return this.showLine(this.queue.shift());
    if (this.beat?.choices && !this.chosen) return this.showChoices();
    this.close();
  }

  showLine([who, text]) {
    if (who === '__card') {
      const [num, title] = text.split(' · ');
      $('act-num').textContent = num;
      $('act-title').textContent = title;
      $('dialog').classList.add('hidden');
      $('act-card').classList.remove('hidden');
      sfx.sting(num === 'III' ? 3 : num === 'II' ? 2 : 1);
      return;
    }
    let c = CHARACTERS[who] ?? CHARACTERS.narrator;
    if (who === 'you') {
      const look = this.getLook();
      c = { ...c, portrait: playerPortrait(look), color: look.color };
    }
    $('dlg-portrait').textContent = c.portrait.replace(/^\n/, '');
    $('dlg-portrait').style.color = c.color;
    $('dlg-portrait').classList.toggle('hidden', !c.portrait);
    $('dlg-name').textContent = c.name;
    const cv = $('dlg-sprite'), g = cv.getContext('2d');
    g.clearRect(0, 0, cv.width, cv.height);
    cv.classList.toggle('hidden', who !== 'you' && !c.mini);
    if (who === 'you') drawMiner(g, cv.width / 2, cv.height - 2, 40, { look: this.getLook() });
    else if (c.mini) drawMiner(g, cv.width / 2, cv.height - 2, 40, { npc: who });
    $('dlg-name').style.color = c.color;
    $('dlg-text').classList.toggle('narration', who === 'narrator');
    $('dlg-text').classList.toggle('letter', who === 'letter' || who === 'scrap' || who === 'hills' || who === 'joletter');
    $('dlg-hint').classList.add('hidden');
    const el = $('dlg-text');
    el.textContent = '';
    let i = 0;
    this.fullText = text;
    const PAUSE = { ',': 120, ';': 160, ':': 160, '.': 300, '!': 300, '?': 300, '—': 200, '…': 380 };
    const tick = () => {
      i++;
      el.textContent = text.slice(0, i);
      if (i % 2 === 0 && text[i] !== ' ') sfx.blip(VOICE[who] ?? 1);
      if (i >= text.length) return this.finishTyping();
      const ch = text[i - 1], after = text[i];
      const pause = after === ' ' || after === '\n' || ch === '—' || ch === '…' ? PAUSE[ch] ?? 0 : 0;
      this.typing = setTimeout(tick, 22 + pause);
    };
    this.typing = setTimeout(tick, 22);
  }

  finishTyping() {
    clearTimeout(this.typing);
    this.typing = null;
    $('dlg-text').textContent = this.fullText;
    $('dlg-hint').classList.remove('hidden');
  }

  showChoices() {
    $('dlg-hint').classList.add('hidden');
    $('dlg-choices').innerHTML = this.beat.choices
      .map((c, i) => `<button data-choice="${i}"><b>${i + 1}</b> ${c.label}</button>`).join('');
    $('dlg-choices').classList.remove('hidden');
  }

  choose(i) {
    const c = this.beat?.choices?.[i];
    if (!c || this.chosen) return;
    this.chosen = true;
    sfx.choose();
    $('dlg-choices').classList.add('hidden');
    this.send({ t: 'storyDone', id: this.beat.id, choice: i });
    this.queue = [['you', c.label], ...(c.reply ?? []).filter((l) => visible(l, this.flags))];
    this.next();
  }

  close() {
    if (this.beat && !this.chosen) this.send({ t: 'storyDone', id: this.beat.id });
    this.beat = null;
    this.mood = null;
    this.isOpen = false;
    $('dialog').classList.add('hidden');
    $('act-card').classList.add('hidden');
    $('dlg-choices').classList.add('hidden');
    setDuck(false);
  }

  // Keyboard: Space/Enter/F advance, 1-3 pick a choice. Returns true if the key was used.
  key(k) {
    if (!this.isOpen) return false;
    if (/^[1-9]$/.test(k)) this.choose(Number(k) - 1);
    else if (k === ' ' || k === 'enter' || k === 'f' || k === 'e') this.next();
    return true;
  }
}
