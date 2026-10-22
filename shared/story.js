// DEEP — story content. Characters, portraits and story beats.
// The server decides WHEN a beat fires (triggers, flags, effects); the client renders the text.

export const CHARACTERS = {
  foreman: {
    name: 'THE FOREMAN', color: '#ffcc33', glyph: 'F',
    portrait: String.raw`
     _________
    /  _____  \
   |__/     \__|
    |  o   o  |
    |    ^    |
    |  \___/  |
     \_______/
   ___|     |___
  / DEEP MINING \ `,
  },
  madman: {
    name: 'THE MADMAN', color: '#ff7a59', glyph: 'M',
    portrait: String.raw`
       ,  ,  ,
      (o)  (O)
        \__/        [*]
     .-'''''-.      _|_
    /  !    ! \____/
   |   \____/  |
    \_________/
      |  |  |`,
    idle: [
      'I lit a lantern at noon. Still looking for the sky.',
      'Every price on that board used to mean something. Then we sold the meaning, too.',
      'They will need festivals for this. New ones. The old ones are spent.',
      'Who measures the measurers? Not the market. The market only echoes.',
    ],
  },
  hermit: {
    name: 'THE HERMIT', color: '#8fd16a', glyph: 'H',
    portrait: String.raw`
       .----.
      /      \
     |  -  -  |
     |   ..   |
     (\______/)
     /||||||||\
    /|||||||||\
       |||||`,
    idle: [
      'Every convenience is a small surrender. Some are worth it. Count them.',
      'The forest kept no ledger.',
      'Autonomy is a muscle. It weakens when the machine lifts for you.',
      'Hunger is honest. It asks for food, not for upgrades.',
    ],
  },
  roller: {
    name: 'THE STONE-ROLLER', color: '#c9b8ff', glyph: 'S',
    portrait: String.raw`
               ____
       O      /    \
      /|\____|  ()  |
      / \     \____/
    ///////////////
   ////////////////`,
    idle: [
      'The top of the hill is a rumor. The pushing is real.',
      'It rolled back again. Good. I was not finished.',
      'A task without meaning is a blank page. Write on it.',
    ],
  },
  abyss: {
    name: 'THE ABYSS', color: '#9f8cff', glyph: '∅',
    portrait: String.raw`
   .  .  .  .  .  .
  .                 .
 .    ◉         ◉    .
  .                 .
   .  .  .  ∅  .  .`,
  },
  mirror: {
    name: 'THE ONE WHO OVERCOMES', color: '#8ff6ff', glyph: '◊',
    idle: ['You already chose. Every day you get to choose again.', 'The measure is yours now. Use it.'],
    portrait: String.raw`
   _____________
  |\           /|
  | \    @    / |
  |  \       /  |
  |   \     /   |
  |    \   /    |
  |      ∞      |
  |_____________|`,
  },
  you: { name: 'YOU', color: '#39ff88', glyph: '@', portrait: '' },
  narrator: { name: '', color: '#a5b3a8', glyph: '', portrait: '' },
};

// NPCs that live in town. `req` gates when they appear in story mode.
export const TOWN_NPCS = [{ npc: 'madman', dx: 29, req: { sells: 3 } }];

// Story sites carved into the solo world (depth in metres).
export const SITES = [
  { npc: 'hermit', depth: 140, w: 11, h: 4 },
  { npc: 'roller', depth: 320, w: 17, h: 4 },
  { npc: 'mirror', depth: 700, w: 13, h: 5 },
];
export const FINALE_DEPTH = 700;

// trigger: join | depth | sell | npc | rebirth
// choices: { label, reply?: [who, text][], set?: flag, effect?: string }
export const BEATS = [
  {
    id: 'intro', trigger: { type: 'join' }, modes: ['solo', 'world'],
    lines: [
      ['foreman', 'Welcome to DEEP MINING CO., employee number ∞. Your drill has been issued. Your needs have been anticipated.'],
      ['foreman', 'Dig. Sell. Upgrade. Repeat. Our studies show this is what you have always wanted.'],
      ['foreman', 'Questions are not a line item. Off you go — walk off the platform and down. The earth will not hollow itself.'],
    ],
  },
  {
    id: 'gaze', trigger: { type: 'depth', depth: 40 },
    lines: [
      ['narrator', 'Your lamp flickers. Below you the dark goes on for longer than it should.'],
      ['abyss', 'Careful, little light. When you look this long into the dark… the dark starts looking back.'],
    ],
  },
  {
    id: 'first-sale', trigger: { type: 'sell', count: 1 },
    lines: [
      ['foreman', 'Splendid! Your effort has been converted into currency.'],
      ['foreman', 'Currency converts into upgrades. Upgrades convert into more effort. Elegant, isn’t it? Nothing is ever wasted. Least of all you.'],
    ],
  },
  {
    id: 'madman', trigger: { type: 'npc', npc: 'madman' }, modes: ['solo', 'world'],
    lines: [
      ['madman', 'Have you not heard?! I lit a lantern in broad daylight and went looking for the sky!'],
      ['madman', 'We dug it away — you and I! We drained the horizon, one bucket at a time, to pay for better drills.'],
      ['madman', 'What were we doing when we unchained the earth from its sky? Who gave us the drill to wipe away everything above us?'],
      ['madman', 'And now — what is still up, what is down? We are falling in every direction and calling it progress.'],
    ],
    choices: [
      { label: 'Who are you?', reply: [['madman', 'Only the one who noticed too early. The news is still on its way down to everyone else.']], set: 'met-madman' },
      { label: 'You’re mad.', reply: [['madman', 'Of course! Sanity is a company policy. Read the handbook — page one.']], set: 'met-madman' },
    ],
  },
  {
    id: 'hermit', trigger: { type: 'npc', npc: 'hermit' },
    lines: [
      ['hermit', 'Ah. A visitor. One who still digs for them, by the shine of that drill.'],
      ['hermit', 'I worked the conveyor once. Every need I had was handed to me — then sold back to me at a markup.'],
      ['hermit', 'Down here I grow mushrooms and choose my own tasks. Hard ones. Real ones. Warmth, water, the next meal — goals I can reach with my own hands.'],
      ['hermit', 'Up there they give you substitutes: a bigger tank, a faster drill, a number on a board. Effort, yes. But never your own.'],
      ['hermit', 'So ask yourself: does the machine serve you — or did you become a part it cannot run without?'],
    ],
    choices: [
      { label: 'Then why not leave entirely?', reply: [['hermit', 'Leaving is a dig too. Slow, quiet, with no reward but yourself. Here — let me patch that hull. Resin and patience.']], set: 'hermit-listened', effect: 'repair' },
      { label: 'Progress is good. My drill makes me stronger.', reply: [['hermit', 'Stronger, yes. And more necessary to the drill. Watch which of you grows faster.']], set: 'hermit-dismissed' },
    ],
  },
  {
    id: 'roller', trigger: { type: 'npc', npc: 'roller' },
    lines: [
      ['roller', 'Mind the stone. It always rolls back. That’s rather the point.'],
      ['roller', 'They sentenced me to this. Push it up — watch it fall — again, forever. A punishment, they said.'],
      ['roller', 'But look. The stone is mine. The slope is mine. The striving itself is enough to fill a heart.'],
      ['roller', 'You grind too, little miner. Down, up, sell, again. Tell me — is it a punishment?'],
    ],
    choices: [
      { label: 'It’s meaningless.', reply: [['roller', 'Then you are free! A meaningless task is a blank page — it takes any meaning you dare to write. Take this, for the stones that won’t roll.']], set: 'roller-free', effect: 'dynamite' },
      { label: 'It’s my choice.', reply: [['roller', 'Then I imagine you happy. Push well. And take this, for the stones that won’t roll.']], set: 'roller-chosen', effect: 'dynamite' },
    ],
  },
  {
    id: 'magma', trigger: { type: 'depth', depth: 450 },
    lines: [
      ['abyss', 'You have been digging toward me for a long time. Did you think the depth was empty?'],
      ['abyss', 'Every layer you removed, you also removed from yourself. Lighter now? Or only hollower?'],
    ],
  },
  {
    id: 'valueless', trigger: { type: 'depth', depth: 600 },
    lines: [
      ['abyss', 'Down here the prices stop making sense. Gold is warm stone. Diamond is hard light.'],
      ['abyss', 'There is no bottom to value. Only the place where you stop asking the Company what things are worth.'],
    ],
  },
  {
    id: 'finale', trigger: { type: 'npc', npc: 'mirror' },
    lines: [
      ['narrator', 'At the heart of the earth stands a mirror. Your lamp finds a face. It is yours — but it does not flinch.'],
      ['mirror', 'You came down through their values. Copper, silver, gold — prices rising and falling like weather.'],
      ['mirror', 'Now there is nothing left to measure you against. You can create the measure… or borrow it back.'],
      ['mirror', 'Choose what you become.'],
    ],
    choices: [
      { label: 'Return to the Company.', effect: 'ending-company', reply: [
        ['foreman', 'Congratulations on your promotion to Foreman! You will now issue drills to others.'],
        ['foreman', 'Your needs have been anticipated. Theirs too. Please collect your bonus.'],
        ['narrator', 'ENDING — THE SYSTEM. The machine runs smoothly. You are one of its finest parts.'],
      ] },
      { label: 'Stay here, in the silence.', effect: 'ending-silence', reply: [
        ['narrator', 'You set the drill down. For the first time, the only sound is your own breathing.'],
        ['hermit', 'Nobody will buy this. That is how you know it is yours.'],
        ['narrator', 'ENDING — THE HOLLOW. Small, quiet, self-made. The ledger has no line for it.'],
      ] },
      { label: 'Live it all again — and will it.', effect: 'ending-recurrence', reply: [
        ['abyss', 'Then every shaft, every coin, every fall, every cave-in — again, infinitely, exactly the same.'],
        ['mirror', 'And you say: yes. Not because you must. Because you would choose nothing else.'],
        ['narrator', 'ENDING — AMOR FATI. The surface again. The drill again. But this time you know.'],
      ] },
    ],
  },
  {
    id: 'recurrence', trigger: { type: 'rebirth' },
    lines: [
      ['abyss', 'What if a voice crept after you into your loneliest shaft and said: this life — you will live it again, and again, innumerable times?'],
      ['abyss', 'Every shovel of dirt, every sale, every fall. Would you curse the voice… or call it divine?'],
    ],
    choices: [
      { label: 'Yes. Again. (rebirth with ★)', effect: 'rebirth' },
      { label: 'Not yet.' },
    ],
  },
];

export const beatById = Object.fromEntries(BEATS.map((b) => [b.id, b]));
