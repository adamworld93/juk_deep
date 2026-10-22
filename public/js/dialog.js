// Story dialogue box: ASCII portrait, typewriter text, numbered choices.
import { CHARACTERS, beatById } from '/shared/story.js';
import { sfx, setDuck } from './audio.js';

const $ = (id) => document.getElementById(id);
const VOICE = { foreman: 1.3, madman: 1.6, hermit: 0.8, roller: 1, abyss: 0.5, mirror: 2, narrator: 0.7, you: 1.2 };

export class Dialog {
  constructor(send) {
    this.send = send;
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
  }

  get open() { return this.isOpen; }

  playBeat(id) {
    const b = beatById[id];
    if (!b) return this.send({ t: 'storyDone', id });
    this.beat = b;
    this.chosen = false;
    this.queue = [...b.lines];
    this.show();
  }

  say(npc, text) {
    this.beat = null;
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
    if (this.typing) { this.finishTyping(); return; }
    if (!$('dlg-choices').classList.contains('hidden')) return; // waiting for a choice
    if (this.queue.length) return this.showLine(this.queue.shift());
    if (this.beat?.choices && !this.chosen) return this.showChoices();
    this.close();
  }

  showLine([who, text]) {
    const c = CHARACTERS[who] ?? CHARACTERS.narrator;
    $('dlg-portrait').textContent = c.portrait.replace(/^\n/, '');
    $('dlg-portrait').style.color = c.color;
    $('dlg-portrait').classList.toggle('hidden', !c.portrait);
    $('dlg-name').textContent = c.name;
    $('dlg-name').style.color = c.color;
    $('dlg-text').classList.toggle('narration', who === 'narrator');
    $('dlg-hint').classList.add('hidden');
    const el = $('dlg-text');
    el.textContent = '';
    let i = 0;
    this.fullText = text;
    this.typing = setInterval(() => {
      i++;
      el.textContent = text.slice(0, i);
      if (i % 2 === 0 && text[i] !== ' ') sfx.blip(VOICE[who] ?? 1);
      if (i >= text.length) this.finishTyping();
    }, 22);
  }

  finishTyping() {
    clearInterval(this.typing);
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
    this.queue = [['you', c.label], ...(c.reply ?? [])];
    this.next();
  }

  close() {
    if (this.beat && !this.chosen) this.send({ t: 'storyDone', id: this.beat.id });
    this.beat = null;
    this.isOpen = false;
    $('dialog').classList.add('hidden');
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
