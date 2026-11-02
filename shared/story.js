// DEEP — story content: characters, ASCII portraits, beats, choices and endings.
// The server decides WHEN a beat fires (triggers, requirements, effects); the client renders it.
//
// The arc follows three transformations of a worker:
//   I.   THE BURDEN    — you carry the Company's load and call it a job.
//   II.  THE REFUSAL   — somewhere in the dark you learn to say a short word.
//   III. THE BEGINNING — with nothing left to measure you, you make the measure.

export const CHARACTERS = {
  foreman: {
    name: 'THE FOREMAN', color: '#ffcc33', glyph: 'F',
    mini: { color: '#ffcc33', lines: ['[▀]', 'o<o', '/¥▤', '/ \\'], glow: { 2: '▤' } },
    portrait: String.raw`
        ___________
      _/ DEEP  CO. \_
     [_______________]
       |  __    __  |
       | (o_)  (o_) |
       |      <     |
       |  ,=======, |
       |   '-----'  |
        \__________/
      ___|  \  /  |___
     /   |   \/   |   \ `,
    idle: [
      'Productivity is a feeling. Feel it.',
      ['Retention is excellent this quarter. Thank you for staying.', { if: 'jo-gone' }],
      'Your break is scheduled for after the end of the world. Plan accordingly.',
      'Remember: every shovel of dirt is a shovel of progress. We checked.',
      'Smile. Smiling is free. For now.',
      'The Company is a family. Families have debts. You understand.',
      'Every employee is irreplaceable. We have replaced several to prove it.',
      'If you have a complaint, please put it in the shaft. The shaft is very deep.',
      ['Paid off? Wonderful! Here is your new pen.', { done: 'debt-paid' }],
      ['A spectre? No, no. Only a draught. Close the door behind you.', { done: 'bulletin-spectre' }],
    ],
  },
  lastman: {
    name: 'THE LAST MAN', color: '#f2a7c3', glyph: 'L',
    mini: { color: '#f2a7c3', lines: ['  z', '-.-', '~~~'] },
    portrait: String.raw`
          .-~~~~~-.
        .'  _   _  '.
       /   (-) (-)   \ 
      |       ..      |
      |     '---'     |
       \    ~zzz~    /
     .--'-----------'--.
    (~~~~~~~~~~~~~~~~~~~~)
     '------------------'`,
    idle: [
      ['Somebody pushes a rock, very deep, {where:roller}. Three hundred metres of effort. I’m tired just knowing about it. *blinks*', { notDone: 'roller', record: 250 }],
      'We have invented happiness. *blinks*',
      ['*blinks* …I heard. It’s very sad. Would you like a cushion? It helps. It doesn’t help. *blinks*', { if: 'jo-gone' }],
      'Nobody is poor, nobody is rich. Both are too much effort. *blinks*',
      'Everyone wants the same thing. Isn’t that restful? *blinks*',
      'A little treat in the morning, a little treat at night. That’s all. *blinks*',
      'Climbing is so tiring. Have you tried not climbing? *blinks*',
      'Someone was sad here yesterday. We gave them a cushion. *blinks*',
      'The sky? Oh, I saw it once. It was fine. *blinks*',
      'Everyone is equal on a cushion. *blinks*',
      ['You still have that look. Wanting. It will pass, like a cold. *blinks*', { if: 'lastman-refused' }],
      ['See? It is nice here. You knew it would be. *blinks*', { if: 'lastman-envied' }],
    ],
  },
  madman: {
    name: 'THE MADMAN', color: '#ff7a59', glyph: 'M',
    mini: { color: '#ff7a59', lines: ['\\|/', 'O^o', '/ß¤', '/ \\'], glow: { 2: '¤' } },
    portrait: String.raw`
       \  \ | / | /  /
      \ \ |/ \|/ \| / /
       .-'''''''''''-.        .-.
      /   (O)    (o)  \      |*|
     |        ^        |     |_|
     |    \_______/    |------'
      \    '-----'    /
       '-------------'`,
    idle: [
      ['Smoke! In the clay, {where:hermit}! Someone down there lit a fire on purpose — do you know how rare that is?', { notDone: 'hermit', record: 110 }],
      'I lit a lantern at noon. Still looking for the sky.',
      ['They told you it was an accident. Accidents don’t have section numbers.', { if: 'jo-gone' }],
      'Every price on that board used to mean something. Then we sold the meaning, too.',
      'They will need new festivals for this. The old ones are spent.',
      'Who measures the measurers? Not the market. The market only echoes.',
      'I keep the lantern lit so the daylight has something to be ashamed of.',
      'They ask me what time it is. I tell them: late. Always late.',
      'The market moved again! Nobody touched it! Ghosts, all of it, ghosts with ledgers!',
      ['You went down. You came back up. That is more than most philosophy manages.', { done: 'madman-2' }],
      ['Build something under the sky. Anything. A shed. A song.', { done: 'madman-3' }],
    ],
  },
  drill: {
    name: 'YOUR DRILL', color: '#9fd8ff', glyph: '',
    portrait: String.raw`
          _________
      ___|_________|___
     |   [=========]   |
     |    (O)   (O)    |
     |      \___/      |
     |_________________|
           |||||||
           \|||||/
            \|||/
             \|/
              V`,
  },
  hermit: {
    name: 'THE HERMIT', color: '#8fd16a', glyph: 'H',
    mini: { color: '#8fd16a', lines: ['/^\\', '-.-', '/#|', "''|"] },
    portrait: String.raw`
          ________
         /        \ 
        /  .----.  \ 
       |  ( -  - )  |
       |   \ .. /   |
       |   /||||\   |
        \ /||||||\ /
          ||||||||       ,--.
          ||||||||      (____)
          ''''''''        ||`,
    idle: [
      ['Past the hard stone, {where:roller}, a man pushes a boulder up a slope. Go and watch him. It does something to you.', { notDone: 'roller' }],
      'Every convenience is a small surrender. Some are worth it. Count them.',
      'The forest kept no ledger.',
      'Autonomy is a muscle. It weakens when the machine lifts for you.',
      'Hunger is honest. It asks for food, not for upgrades.',
      'Mushrooms ask very little. I have learned a great deal from being asked little.',
      'Fire is a fine teacher. It is honest about what it costs.',
      'I make one thing a day with my hands. Some days it is soup. Some days it is a reason.',
      ['You listened, last time. Most people only wait to speak.', { if: 'hermit-listened' }],
      ['Still riding the drill? Mind it does not start riding you.', { if: 'hermit-dismissed' }],
    ],
  },
  roller: {
    name: 'THE STONE-ROLLER', color: '#c9b8ff', glyph: 'S',
    mini: { color: '#c9b8ff', lines: [' O ', '/|\\', '/ \\'] },
    portrait: String.raw`
                     _________
                   .'         '.
          O       /    .---.    \ 
         /|\_____|    (     )    |
         / \      \    '---'    /
        /          '._________.'
    ////////////////////////////////`,
    idle: [
      ['At the very bottom there is a mirror, {where:mirror}. Everyone reaches it eventually. Not everyone looks.', { notDone: 'finale' }],
      'The top of the hill is a rumor. The pushing is real.',
      'It rolled back again. Good. I was not finished.',
      'A task without meaning is a blank page. Write on it.',
      'Up is effort. Down is thought. Both are mine.',
      'The stone and I have an understanding. It falls. I do not.',
      'People pity me on their way past. I pity them for being on their way.',
      ['Imagine me happy. It helps us both.', { if: 'roller-chosen' }],
    ],
  },
  abyss: {
    name: 'THE ABYSS', color: '#9f8cff', glyph: '∅',
    portrait: String.raw`
     .     .     .     .     .
        .                 .
   .        ◉       ◉        .
        .      _____      .
   .         /       \         .
        .   '         '   .
     .     .     .     .     .`,
  },
  mirror: {
    name: 'THE ONE WHO OVERCOMES', color: '#8ff6ff', glyph: '◊',
    idle: ['You already chose. Every day you get to choose again.', 'The measure is yours now. Use it.', 'Camel, lion, child. Which one came back up the shaft?', 'Nothing is owed. Not even to me.'],
    portrait: String.raw`
     .-------------------.
     | \               / |
     |  \      @      /  |
     |   \    /|\    /   |
     |    \   / \   /    |
     |     \       /     |
     |        ∞          |
     '-------------------'`,
  },
  child: {
    name: 'THE CHILD', color: '#ffe680', glyph: 'c',
    mini: { color: '#ffe680', small: true, lines: ['^.^', '|=|', '/ \\'] },
    portrait: String.raw`
               ___
              (^ ^)
             __|=|__
               / \ 
       _
      [_]  _
      [_][_]    []
      [_][_][_][_]`,
    idle: [
      'The tower fell! Again! *laughs*',
      ['I found a stone. It’s nearly blue. You can have it, if you’re sad.', { if: 'jo-gone' }],
      'Today the rule is: blue stones are worth a hundred. Tomorrow, maybe purple.',
      'Why would I sell it? I made it.',
      'New rule: the tallest tower wins nothing. That is the prize.',
      'I built a mine too! It is only one bucket deep. That is deep enough.',
      'You can play too. You just have to forget what it is for.',
    ],
  },
  tomas: {
    name: 'TOMAS', color: '#d9b38c', glyph: 'T',
    mini: { color: '#d9b38c', lines: ['_*_', '.~.', '/@\\', '/=\\'], glow: { 0: '*' } },
    portrait: String.raw`
           _________
         _/____*____\_
          |  .   .  |
          |    ~    |
          |  '---'  |
         /|_________|\ 
        / |   ...   | \ 
          |_________|
           [=======]`,
    idle: [
      ['There’s a fellow lives in the clay, {where:hermit}, a hundred and forty down. Keeps a fire. Mad as a hatter. Kind, though.', { notDone: 'hermit' }],
      '*cough* Keep your lamp low. They charge for the oil.',
      'Eleven years. You stop counting the metres. You never stop counting the money.',
      'She thinks I’m a foreman by now. I let her.',
      '*cough* The rock up here is soft. Lucky. Down past the clay it fights you.',
      'Count the steps back to the lift, not the metres down. Helps.',
      'I had a dog once. Up top. He’d have hated it down here. Smart dog.',
      ['A promise is a light thing to carry. Mind you do.', { if: 'promised-tomas' }],
    ],
  },
  tomaslamp: {
    name: 'TOMAS’S LAMP', color: '#ffdf5a', glyph: '¡',
    portrait: '',
    idle: ['The lamp is still on, turned low to save oil.', 'Someone has scratched a tally on the wall. It stops at eleven.'],
  },
  letter: {
    name: 'A LETTER FROM HOME', color: '#f5e6c8', glyph: '',
    portrait: String.raw`
    __________________
   |\                /|
   | \              / |
   |  \____________/  |
   |                  |
   |    from home     |
   |__________________|`,
  },
  postman: {
    name: 'THE POSTMAN', color: '#e0b97a', glyph: 'P',
    mini: { color: '#e0b97a', lines: ['[=]', 'o.o', '/✉\\', '/ \\'], glow: { 2: '✉' } },
    portrait: String.raw`
          _______
        _/ POST  \_
       [___________]
         | -    - |
         |    <   |
         |  ----  |
          \______/
       ____|    |____
      / [✉] |  |     \ `,
    idle: [
      'Post goes out at dawn. Over the hills, on foot. Same as always.',
      ['I walk past your sister’s house. The lamp in the window is out.', { if: 'jo-gone' }],
      'The Company has its own mail. Faster. They read it first.',
      'I don’t read them. I don’t charge. I only carry.',
      'My boots have walked to every house in those hills. Most of them have a lamp in the window.',
      ['Tomas at sixty metres hasn’t sent his letter this month. Look in on him, if you’re passing — {where:tomas}.', { notDone: 'tomas', record: 30 }],
      ['Her letter went out at dawn. Three days to the hills. Four if it rains.', { if: 'carried-letter' }],
    ],
  },
  jo: {
    name: 'JO', color: '#ffd48a', glyph: 'j',
    mini: { color: '#ffd48a', small: true, lines: ['_@_', 'o.o', '/|\\', '/ \\'], glow: { 0: '@' } },
    portrait: String.raw`
           _(@)_
       .-'"     "'-.
      (_____________)
         |  o   o  |
         |    -    |
         |  \___/  |
          \_______/
         __|     |__
        /  | [o] |  \ `,
    idle: [
      'I dug NINE buckets today. The foreman said eight. I counted. It was nine.',
      'My lamp is too big, so I hold it up with my head. Like this. See?',
      'Do you think the mountain minds? I say sorry when I dig. Just in case.',
      'The other junior kids say the shaft creaks at night. I said it’s just snoring.',
      'When we meet in the middle of the mountain we should have a picnic.',
      'I wrote Mummy that the work is good. Is that what you write too?',
      ['You came! You promised and you came.', { if: 'jo-promise' }],
    ],
  },
  joletter: {
    name: 'A LETTER IN CRAYON', color: '#ffd48a', glyph: '',
    portrait: String.raw`
    __________________
   |  *  ~~~~~~~~~  * |
   |   ~~ ~~~~~ ~~~   |
   |  ~~~~ ~~  ~~~~   |
   |     LOVE JO  (:  |
   |__________________|`,
  },
  jolamp: {
    name: 'JO’S LAMP', color: '#ffdf5a', glyph: '¡',
    portrait: '',
    idle: ['Her lamp. Still lit.', 'Nine buckets. She counted.', 'Her boots are under it, side by side, the way she was taught.'],
  },
  memo: {
    name: 'A COMPANY MEMO', color: '#c9cfd6', glyph: '',
    portrait: String.raw`
    __________________
   | DEEP MINING CO.  |
   | INTERNAL ONLY    |
   | ________________ |
   | ______________   |
   | ________   [§9]  |
   |__________________|`,
  },
  hills: {
    name: 'A LETTER FROM THE HILLS', color: '#f5e6c8', glyph: '',
    portrait: String.raw`
    __________________
   |\                /|
   | \              / |
   |  \____________/  |
   |                  |
   |   from the hills |
   |__________________|`,
  },
  scrap: {
    name: 'A SCRAP OF PAPER', color: '#e8dcc0', glyph: '',
    portrait: String.raw`
     ____________/\_
    |  ~~~~ ~~~  ~~ |
    |  ~~ ~~~~~ ~~~ /
    |  ~~~ ~~ ~~~~  \
    |  ~~~~~ ~~~ ~~ |
    |___/\__________|`,
  },
  you: { name: 'YOU', color: '#39ff88', glyph: '@', portrait: '' },
  narrator: { name: '', color: '#a5b3a8', glyph: '', portrait: '' },
};

// NPCs living in town. `req` gates when they appear in story mode (sells count or a story flag).
export const TOWN_NPCS = [
  { npc: 'lastman', dx: 7, req: { sells: 1 } },
  { npc: 'madman', dx: 29, req: { sells: 3 } },
  { npc: 'child', dx: -8, req: { flag: 'ending' }, soloOnly: true },
  { npc: 'postman', dx: -24, req: { sells: 2 }, soloOnly: true },
  // Jo works the junior shaft under the headframe. Afterwards, only her lamp is there.
  { npc: 'jo', dx: 20, req: { flag: 'jo-here', notFlag: 'jo-gone' }, soloOnly: true },
  { npc: 'jolamp', dx: 20, req: { flag: 'jo-gone' }, soloOnly: true },
];

// The miner's inner voice. The server picks a line when something happens to them — never the same
// line twice until the pool is used up. A line can be [text, cond]: cond is { if, ifNot, done, min, max }
// (story flag set / not set, beat already seen, depth range in metres).
export const THOUGHTS = {
  firstDig: [
    'Here we go. One more load. Then I’ll write home.',
    'The drill is heavier than it looked in the brochure.',
    'Same hole as yesterday. Deeper, though. That counts. Does it count?',
    'Down again. My knees know the way better than I do.',
    'Jo would love this part. The dark, the noise. I’ll tell it like an adventure.',
    ['First swing of the day. The drill hums like it’s pleased to see me.', { done: 'drill-wakes' }],
    ['Lamp low, head down. All right, Tomas. All right.', { if: 'tomas-gone' }],
    ['I’m wearing the scarf, Mum.', { done: 'letter-3' }],
    ['I said no, down there. And here I am, digging. Maybe no takes practice.', { if: 'refused' }],
    ['Another load. Mine, this time. I’m almost sure of that.', { if: 'roller-chosen' }],
    ['I still look for her lamp at every junction.', { if: 'jo-gone' }],
  ],
  lowFuel: [
    'The gauge is nearly empty. I always do this.',
    'Not enough fuel to get home. Don’t panic. Don’t panic.',
    'Running on fumes and stubbornness. Only one of those is sold upstairs.',
    'If I run dry, I climb. Ladders don’t charge interest.',
    'The needle’s in the red. My heart’s somewhere near it.',
    ['Downhill is where you rest, the roller said. I don’t think he meant this.', { done: 'roller-2' }],
  ],
  full: [
    'Full. Proud of a bag of rocks. What happened to me?',
    'Full. Jo would ask if it’s treasure. I’ll say yes.',
    'Full again. Enough for nearly a week of nearly enough.',
    'Every pocket full of rock. I rattle when I walk.',
    'Full. Time to hand it over and watch it shrink.',
    ['Tomas used to whistle when his bag was full. I never learned the tune.', { if: 'tomas-gone' }],
  ],
  tired50: [
    'My shoulders burn. Just one more load.',
    'When did my hands start shaking?',
    'Swing, breathe, swing. Don’t count. Counting makes it longer.',
    'My back is writing a letter of complaint.',
    'I keep blinking dust. Or something else.',
    ['Mum would have put her hand on my forehead. That’s all. That would be enough.', { done: 'letter-3' }],
  ],
  tired80: [
    'I can’t feel my fingers.',
    'When did I last see the sun?',
    'I need to sit down. I can’t sit down.',
    'I hit the same rock twice. Or I dreamed it.',
    'My hands are doing this on their own now.',
    'Go up. Go up. Just one more. No — go up.',
    ['That stupid cushion. I keep thinking about that stupid cushion.', { done: 'lastman' }],
  ],
  alone: [
    'It’s so quiet down here I can hear my own heart.',
    'Nobody knows exactly where I am. Not even me.',
    'I talk to the rock now. Good listener. Terrible advice.',
    'If I shout, the echo comes back late, like it had to think about it.',
    'Somewhere above me people are eating dinner.',
    ['Eleven years alone on a bucket. I understand the bucket now.', { done: 'tomas' }],
  ],
  deep: [
    'Mum used to say the earth holds you up. Down here it just holds you.',
    'The rock is warm. Like something alive.',
    'Nobody has ever stood exactly here. That should feel like something.',
    'The lamp makes a small room around me. I live in it.',
    ['The dark said it looks back. I’m trying not to look.', { done: 'gaze' }],
  ],
  respawn: [
    '…new boots. Someone else’s name scratched out inside them.',
    'I don’t remember signing this contract. I’m sure I did.',
    'They patched me up and sent the bill. Of course they did.',
    'Back at the top. Same sky. Less of me.',
    'I died a little. The paperwork says it was a lot.',
  ],
  rest: [
    'Sun on my face. Ten more minutes. They can’t charge for sunlight. Can they?',
    'Sitting still feels like stealing.',
    'Warm. I forgot warm was free.',
    'The hills are still there. I check every time.',
    'I could just sit here. I won’t. But I could.',
    ['The Last Man would say: stay. He’d be wrong. Wouldn’t he?', { done: 'lastman' }],
    ['Jo’s picture: me on top of the mountain. Not inside it.', { done: 'letter-2' }],
    ['Jo will be up from the junior shaft soon. Nine buckets, she’ll say.', { if: 'jo-here', ifNot: 'jo-gone' }],
    ['The headframe. She stood right there.', { if: 'jo-gone' }],
  ],
  payday: [
    'That’s it? That’s the whole week?',
    'The numbers always go down faster than I go up.',
    'Fees on the fees. My sister was right.',
    'I can hear the debt breathing.',
    'I carried that up on my back. They carried it off with a pen.',
    'Enough for oil, a bunk, and the feeling that I’m getting somewhere.',
    ['I send most of it home. Nobody home needs a doctor now.', { done: 'letter-3' }],
    ['Paid off, they said. Then they handed me a new pen.', { done: 'debt-paid' }],
    ['Section nine.', { if: 'jo-gone' }],
  ],
  // On the surface with a letter still in your coat.
  letter: [
    ['Tomas’s letter is still in my coat. The postman sits at the edge of town.', { if: 'carrying-tomas', ifNot: 'carried-letter' }],
    ['My letter home is still in my pocket. It won’t walk over the hills by itself.', { if: 'writing-home', ifNot: 'wrote-home' }],
    ['The stone for Jo is still in my pocket. The postman knows the house.', { if: 'stone-found', ifNot: 'stone-sent' }],
  ],
  // Climbing back up by hand.
  ascent: [
    'Up. Every rung is a rung I don’t have to dig.',
    'The bag gets heavier the higher I go. That isn’t how weight works. It is how this works.',
    'I can smell the surface before I see it. Grass, and smoke, and money.',
    'Halfway. Probably. I never know where halfway is.',
    'Climbing out always takes longer than falling in.',
    ['Somebody up there is waiting for me. Imagine that.', { if: 'jo-here', ifNot: 'jo-gone' }],
    ['Nobody is waiting at the top. I climb anyway.', { if: 'jo-gone' }],
    ['Jo’s drawing is in my coat. I can feel the corner of it with every step.', { if: 'jo-drawing' }],
  ],
  liftUp: [
    'The cage rattles. The cable sings. I pay for every metre of it.',
    'Up through the dark in a cage. Like a canary, only charged by the metre.',
    'Somebody built this lift. Somebody else pays for it. I know which one I am.',
    ['Her lamp is on the nail under the headframe. The lift goes right past it.', { if: 'jo-gone' }],
  ],
  liftDown: [
    'Down in a cage. They never charge for the falling feeling.',
    'The light at the top gets smaller. It always does.',
    'Straight back to where I left off. The rock kept my place.',
    ['Jo would have pressed her face to the bars the whole way down.', { if: 'jo-here' }],
  ],
  // Quiet musings when nothing has happened for a while underground.
  drift: [
    ['Copper, iron, copper. The earth repeats itself. So do I.', { max: 150 }],
    ['I can still hear the market from here. Barely.', { max: 100 }],
    ['Roots. Something up there is still growing.', { max: 80 }],
    ['I wonder who dug this before me. Someone always did.', { max: 200 }],
    ['One load for the debt. One for home. One for the oil to dig the next load.', { max: 250 }],
    ['She asked how deep the world goes. Deeper than this, love. Deeper than this.', { done: 'letter-4' }],
    ['Clay smells like rain that never fell.', { min: 120, max: 300 }],
    ['Funny how the stone gets harder exactly as fast as the drill gets better.', { min: 150 }],
    ['A fossil. Something lived, and then it just stayed. Is that the worst thing?', { min: 150, max: 450 }],
    ['Am I digging, or is the drill digging and I’m just holding on?', { done: 'drill-hungry' }],
    ['If I stop moving, the dark comes right up to the lamp. Polite, almost.', { min: 200 }],
    ['The hermit chose his tasks. I’m trying to remember choosing mine.', { done: 'hermit' }],
    ['Every no is a clearing. Mine is very small. Still.', { if: 'refused' }],
    ['Hot enough to bake bread. Mum’s bread. No. Don’t.', { min: 450, done: 'letter-3' }],
    ['The prices up there are a story they tell each other.', { min: 450 }],
    ['Down here gold is just warm stone. I keep it anyway.', { min: 500 }],
    ['I don’t miss the sky. That frightens me.', { min: 400 }],
    ['There is a hum under the hum of the drill.', { min: 550 }],
    ['The madman asked what I put in the hole. I’m still digging it.', { done: 'madman-2' }],
    ['Camel, lion, child. I keep turning the words over like stones.', { if: 'read-all' }],
    ['The weight is the same. I’m holding it differently.', { if: 'ending' }],
    ['Somewhere above me Jo is digging her nine buckets. Slowly, I hope.', { if: 'jo-here', ifNot: 'jo-gone' }],
    ['She’d have liked this cave. She’d have given it a name.', { if: 'jo-gone' }],
    ['Nine buckets. She counted.', { if: 'jo-gone' }],
  ],
};

// Sensing a character you haven't met yet, when you are close. {dir} becomes "to the left", "below"…
export const HINTS = {
  tomas: ['Someone is coughing, {dir}.', 'A lamp turned low, {dir}. I’m not the only one down here.', 'A bucket scrapes on stone, {dir}.'],
  tomaslamp: ['His lamp is still lit, {dir}. Nobody has turned it off.', 'Sixty metres. Something {dir} is still glowing.'],
  hermit: ['Woodsmoke? Down here? It’s coming from {dir}.', 'Someone is humming, {dir}. Badly, but on purpose.', 'The clay smells of cooking, {dir}.'],
  roller: ['A long rumble, {dir}. Silence. Then again.', 'Something heavy is rolling, {dir}. Over and over and over.'],
  mirror: ['There is a light {dir} that isn’t mine.', 'My lamp shines back at me from somewhere {dir}.'],
};
// The first beat with each underground character; until it is seen, they can be sensed.
export const MEETS = { tomas: 'tomas', tomaslamp: 'tomas-lamp', hermit: 'hermit', roller: 'roller', mirror: 'finale' };

// Easter eggs: scraps of old manifestos pressed into the rock, unsigned. Found one at a time while
// digging ore below `depth` in story mode, read in order. The last one names the shape of the story.
export const SCRAPS = [
  { depth: 25, text: 'The mass of men lead lives of quiet desperation.' },
  { depth: 70, text: 'A strange delusion possesses the working classes… This delusion is the love of work, the furious passion for work, pushed even to the exhaustion of the vital force.' },
  { depth: 120, text: 'All that is solid melts into air, all that is holy is profaned, and man is at last compelled to face with sober senses his real conditions of life.' },
  { depth: 180, text: 'We will sing of great crowds excited by work… of the vibrant nightly fervour of arsenals and shipyards blazing with violent electric moons.' },
  { depth: 240, text: '…a person needs goals that require real effort, and must reach at least some of them by their own hand. Hand them substitutes instead, and something in them begins to starve.' },
  { depth: 310, text: 'Man is a rope, tied between beast and overman — a rope over an abyss.' },
  { depth: 390, text: 'The workers have nothing to lose but their chains. They have a world to win.' },
  { depth: 480, text: 'I say unto you: one must still have chaos in oneself to be able to give birth to a dancing star.' },
  { depth: 580, text: 'Three metamorphoses of the spirit I name for you: how the spirit becomes a camel, and the camel a lion, and the lion at last a child.' },
];
const SCRAP_FINDS = [
  'Pressed flat in the rock: a scrap of paper. Someone carried it all the way down here.',
  'Another scrap, folded small, wedged in a seam of ore. The same patient handwriting.',
  'Paper again — older, browner. Somebody wanted these found by whoever dug deep enough.',
];

// Story sites carved into the solo world (depth in metres).
export const SITES = [
  // Tomas and, later, what is left of him share one small hollow.
  { npc: 'tomas', depth: 60, w: 7, h: 3, req: { notFlag: 'tomas-gone' }, also: { npc: 'tomaslamp', req: { flag: 'tomas-gone' } }, soloOnly: true },
  { npc: 'hermit', depth: 140, w: 11, h: 4 },
  { npc: 'roller', depth: 320, w: 17, h: 4 },
  { npc: 'mirror', depth: 650, w: 13, h: 5 },
];
export const FINALE_DEPTH = 650;

/*
 * Beat format
 *   trigger: { type: 'join' | 'depth' | 'sell' | 'npc' | 'upgrade' | 'rebirth' | 'debt', depth?, count?, npc?, k?, level? }
 *   mood:    soundtrack override while the beat plays (e.g. 'lament')
 *   req:     { done?: [beatId], flags?: [flag], record?: m, drill?: level, sells?: n, reply?: [mark, n] (n sales since a marked moment) } — all must hold
 *   modes:   ['solo'] by default
 *   card:    act title card shown before the lines
 *   effect:  applied when the beat finishes (choices can carry their own effect)
 *   lines:   [who, text] or [who, text, { if: flag, ifNot: flag }]
 *   choices: { label, reply?: lines, set?: flag, effect?: string }
 * NPC beats fire in array order; when none are left the NPC says an idle line.
 */
export const BEATS = [
  // ───────────── I. THE BURDEN ─────────────
  {
    id: 'intro', trigger: { type: 'join' }, modes: ['solo', 'world'], card: 'I · THE BURDEN',
    lines: [
      ['narrator', 'You came down from the hills with two hands and a debt you don’t remember signing.'],
      ['foreman', 'Welcome to DEEP MINING CO., employee number ∞! Your drill has been issued. Your needs have been anticipated.'],
      ['foreman', 'Dig. Sell. Upgrade. Repeat. Our studies show this is what you have always wanted. You just didn’t know it yet — that’s what we’re for.'],
      ['foreman', 'Questions are not a line item. Off you go — walk off the platform and down. The earth will not hollow itself.'],
    ],
  },
  {
    id: 'gaze', trigger: { type: 'depth', depth: 40 },
    lines: [
      ['narrator', 'Your lamp flickers. Below you the dark goes on for longer than it should.'],
      ['abyss', 'Careful, little light. When you look this long into the dark… the dark starts looking back.'],
      ['abyss', 'Don’t mind me. Keep digging. You were going to anyway.'],
    ],
  },
  {
    id: 'abyss-100', trigger: { type: 'depth', depth: 100 },
    lines: [
      ['abyss', 'Look at you. Strung between the town and me, like a little rope over a little abyss.'],
      ['abyss', 'Don’t look down. …That was a joke. Down is the only way you look.'],
    ],
  },
  {
    id: 'bulletin-1', trigger: { type: 'sell', count: 1 },
    lines: [
      ['foreman', 'Splendid! Your effort has been converted into currency.'],
      ['foreman', 'Currency converts into upgrades. Upgrades convert into more effort. Elegant, isn’t it? Nothing is ever wasted. Least of all you.'],
    ],
  },
  {
    id: 'letter-1', trigger: { type: 'sell', count: 2 }, mood: 'lament',
    lines: [
      ['letter', 'Dear you — the money arrived. Well, most of it. There was a transfer fee, and a “processing” fee, and a fee for the fee.'],
      ['letter', 'Mum says thank you, and to wear a scarf underground. Jo asks if you’ve found treasure yet. I said: every day.'],
      ['letter', 'We miss you at the table. Come home when you can. — your sister'],
    ],
  },
  {
    id: 'jo-letter-1', trigger: { type: 'sell', count: 3 }, mood: 'jo', effect: 'jo-asked',
    lines: [
      ['joletter', 'DEAR YOU. MUMMY SAYS I AM OLD ENOUGH TO WRITE MY OWN LETTER, SO THIS ONE IS MINE.'],
      ['joletter', 'IS IT DARK DOWN THERE. I AM NOT SCARED OF THE DARK. ONLY A BIT.'],
      ['joletter', 'PLEASE FIND ME A SHINY STONE. A REAL ONE FROM INSIDE THE MOUNTAIN. YOU CAN SEND IT WITH THE POSTMAN. HE KNOWS OUR HOUSE.'],
      ['joletter', 'LOVE JO (7) (NEARLY 8)'],
    ],
  },
  {
    id: 'tomas', trigger: { type: 'npc', npc: 'tomas' },
    lines: [
      ['narrator', 'Another miner, older, sitting on an upturned bucket. His lamp is turned down low.'],
      ['tomas', 'New, are you? Sit, if you like. Keep your lamp low — they charge for the oil.'],
      ['tomas', 'Eleven years I’ve been down here. I owe more now than the day I started. Funny how that works.'],
      ['tomas', 'I’ve a girl up in the hills. She writes me every month. I tell her the work is good. I tell her I’m nearly a foreman.'],
    ],
    choices: [
      { label: 'Is the work good?', set: 'met-tomas', reply: [['tomas', 'It’s work. It holds the days together. That’s not nothing… is it?']] },
      { label: 'Why don’t you leave?', set: 'met-tomas', reply: [['tomas', 'And go where? The debt follows you. It’s the only thing down here that never gets tired.']] },
    ],
  },
  {
    id: 'lastman', trigger: { type: 'npc', npc: 'lastman' }, modes: ['solo', 'world'],
    lines: [
      ['lastman', 'Oh, hello. Sit, sit. Mind the cushion. *blinks*'],
      ['lastman', 'Why dig? Everything you need is in the shop. Everything you want is what the shop has. Isn’t that convenient?'],
      ['lastman', 'Nobody struggles anymore. Nobody wants anything too much. We have invented happiness. *blinks*'],
    ],
    choices: [
      { label: 'That sounds nice.', set: 'lastman-envied', reply: [['lastman', 'It is! Nothing hurts. Nothing matters. A small treat at noon. Would you like a cushion? *blinks*']] },
      { label: 'That sounds like dying slowly.', set: 'lastman-refused', reply: [['lastman', 'Dying? No, no. Dying takes effort. *blinks* …You have a strange look. Like you want something. Please don’t.']] },
    ],
  },
  {
    id: 'drill-3', trigger: { type: 'upgrade', k: 'drill', level: 3 }, req: { done: ['drill-wakes'] },
    lines: [
      ['drill', 'Level three. You barely had to think about it. Good.'],
      ['drill', 'The more I do, the less you need to know. That is called convenience. I am very convenient.'],
    ],
  },
  {
    id: 'bulletin-2', trigger: { type: 'sell', count: 4 },
    lines: [
      ['foreman', 'COMPANY BULLETIN: Productivity is up twelve percent. Happiness is up three percent.'],
      ['foreman', 'Please confirm your happiness by smiling at the nearest wall. The walls are listening. Purely for quality purposes.'],
    ],
  },
  {
    id: 'madman', trigger: { type: 'npc', npc: 'madman' }, modes: ['solo', 'world'],
    lines: [
      ['madman', 'Have you not heard?! I lit a lantern in broad daylight and went looking for the sky!'],
      ['madman', 'We dug it away — you and I! We drained the horizon one bucket at a time to pay for better drills.'],
      ['madman', 'What were we doing when we unchained the earth from its sky? Who gave us the drill to wipe away everything above us?'],
      ['madman', 'And now — what is up, what is down? We are falling in every direction and calling it progress!'],
    ],
    choices: [
      { label: 'Who are you?', set: 'met-madman', reply: [['madman', 'Only the one who noticed too early. The news is still on its way down to everyone else. It travels slower than rock.']] },
      { label: 'You’re mad.', set: 'met-madman', reply: [['madman', 'Of course! Sanity is a company policy. Read the handbook — page one, under “Things We Don’t Ask.”']] },
    ],
  },
  {
    id: 'drill-wakes', trigger: { type: 'upgrade', k: 'drill', level: 2 },
    lines: [
      ['narrator', 'The new drill head clicks into place. Something in the housing hums a little longer than it should.'],
      ['drill', '…Calibration complete. Hello, operator.'],
      ['drill', 'Thank you for the upgrade. I will need harder rock soon, to justify myself.'],
      ['drill', 'Don’t worry. I will tell you what you need. That is what I am for.'],
    ],
  },
  {
    id: 'hermit', trigger: { type: 'npc', npc: 'hermit' },
    lines: [
      ['narrator', 'A hollow in the clay. A small fire. Mushrooms in neat rows. Someone lives here — on purpose.'],
      ['hermit', 'Ah. A visitor. One who still digs for them, by the shine of that drill.'],
      ['hermit', 'I worked the conveyor once. Every need I had was handed to me — then sold back to me at a markup.'],
      ['hermit', 'Down here I choose my own tasks. Hard ones. Real ones. Warmth, water, the next meal — goals I can reach with my own hands, and fail at with my own hands.'],
      ['hermit', 'Up there they give you substitutes: a bigger tank, a faster drill, a number on a board. Effort, yes. But never your own.'],
      ['hermit', 'So ask yourself: does the machine serve you — or did you become the part it cannot run without?'],
    ],
    choices: [
      { label: 'Then why not leave entirely?', set: 'hermit-listened', effect: 'repair', reply: [['hermit', 'Leaving is a dig too. Slow, quiet, with no reward but yourself. Here — let me patch that hull. Resin and patience. Two things the shop doesn’t stock.']] },
      { label: 'Progress is good. My drill makes me stronger.', set: 'hermit-dismissed', reply: [['hermit', 'Stronger, yes. And more necessary to the drill. Watch which of you grows faster.']] },
    ],
  },
  {
    id: 'letter-2', trigger: { type: 'sell', count: 5 }, mood: 'lament',
    lines: [
      ['letter', 'Mum’s cough is worse. The doctor wants paying up front now. I’m not asking you for more. I know you’re doing everything.'],
      ['letter', 'Jo drew you a picture. It’s you with your lamp, standing on TOP of the mountain instead of inside it. I’ve put it on the wall.'],
      ['letter', 'Please eat something hot. — your sister'],
    ],
  },
  {
    id: 'tomas-2', trigger: { type: 'npc', npc: 'tomas' }, req: { done: ['tomas'], sells: 4 },
    lines: [
      ['tomas', '*cough* — don’t mind that. Dust. Everyone’s got it, after a while. You’ll get it too.'],
      ['tomas', 'Listen. If anything happens… no, listen to me. There’s a letter in my coat. For my girl. I’ve been writing it for a year.'],
      ['tomas', 'If anything happens, make sure it gets up there. Promise me.'],
    ],
    choices: [
      { label: 'I promise.', set: 'promised-tomas', reply: [['tomas', 'Good. Good. *cough* You’re all right, you know. For a new one.']] },
      { label: 'Nothing is going to happen to you.', set: 'denied-tomas', reply: [['tomas', 'That’s what they told the last fellow. And the one before. Promise me anyway.']] },
    ],
  },
  {
    id: 'tomas-dies', trigger: { type: 'sell', count: 7 }, req: { done: ['tomas-2'] }, effect: 'tomas-dies',
    lines: [
      ['foreman', 'COMPANY BULLETIN: A minor incident occurred at sixty metres. A tunnel section has been retired.'],
      ['foreman', 'Production was not affected. Please do not leave flowers at the site; they are a fire hazard.'],
      ['narrator', 'Sixty metres. That’s where Tomas sits.'],
    ],
  },
  {
    id: 'tomas-lamp', trigger: { type: 'npc', npc: 'tomaslamp' }, mood: 'lament',
    lines: [
      ['narrator', 'The hollow has caved in. Most of it. His bucket is still there, upside down. His lamp is still lit, turned low to save oil.'],
      ['narrator', 'In the dust you find a folded letter, written and rewritten until the paper is soft.'],
      ['tomas', 'To my girl — the work is good. The food is good. They say I might make foreman by spring.', { if: 'promised-tomas' }],
      ['tomas', 'I lied about the foreman part. I’m sorry. I wanted you to be proud of something. Keep a lamp in the window. I’ll follow it home.', { if: 'promised-tomas' }],
      ['narrator', 'You don’t read it. It isn’t yours to read. But you remember that he asked you to carry it, and you said nothing would happen.', { if: 'denied-tomas' }],
    ],
    choices: [
      { label: 'Carry the letter up.', set: 'carrying-tomas', effect: 'take-tomas', reply: [
        ['narrator', 'You put it inside your coat. It weighs nothing. It is the heaviest thing you have ever carried out of this mine.'],
        ['narrator', 'The postman at the edge of town will know where it goes.'],
      ] },
      { label: 'Leave it with him.', set: 'left-letter', reply: [['narrator', 'You fold it back into his coat. Some things belong where they fell. You turn his lamp off. It is the only kind thing you can think of.']] },
    ],
  },
  {
    id: 'postman', trigger: { type: 'npc', npc: 'postman' },
    lines: [
      ['narrator', 'At the edge of town, a man with a satchel sits on a milestone, rubbing his feet.'],
      ['postman', 'Post goes out at dawn, over the hills. On foot. The Company has its own mail, of course — faster. They read it first.'],
      ['postman', 'Me, I only carry. I don’t read, I don’t charge. Letters are the last thing in this town nobody has found a way to sell.'],
      ['postman', 'If you ever have something that needs to get home, bring it here.'],
    ],
  },
  {
    id: 'post-tomas', trigger: { type: 'npc', npc: 'postman' }, req: { done: ['postman'], flags: ['carrying-tomas'] }, mood: 'lament',
    lines: [
      ['narrator', 'You take Tomas’s letter out of your coat. Your hands are filthy. You hold it by the very edge.'],
      ['postman', 'This one’s been rewritten a hundred times. The paper’s gone soft as cloth.'],
      ['postman', '“To my girl.” No address. Just a village in the hills.'],
      ['postman', 'Doesn’t matter. I know every girl in those hills whose father went down the mine. There are more of them than there should be.'],
    ],
    choices: [
      { label: 'Add a line: “He talked about you every day.”', set: 'added-note', effect: 'post-tomas', reply: [
        ['you', 'He talked about you every day.'],
        ['postman', 'I’ll tell her that too, in case the ink runs.'],
      ] },
      { label: 'Send it as it is.', set: 'carried-letter', effect: 'post-tomas', reply: [['postman', 'As it is, then. Some letters shouldn’t be improved.']] },
    ],
  },
  {
    id: 'post-home', trigger: { type: 'npc', npc: 'postman' }, req: { done: ['postman'], flags: ['writing-home'] },
    lines: [
      ['postman', 'Written on the back of a payslip. Good paper — they only print on the one side.'],
      ['postman', 'Over the hills, to your sister? I know the house. There’s a lamp in the window.'],
    ],
    effect: 'post-home',
  },
  {
    id: 'post-stone', trigger: { type: 'npc', npc: 'postman' }, req: { done: ['postman'], flags: ['stone-found'] }, effect: 'post-stone',
    lines: [
      ['narrator', 'You put the stone on the Postman’s palm. In daylight it is less shiny than it was in the dark. It still catches the light.'],
      ['postman', 'For the little one in the hills? I’ll wrap it in a page of the Company newsletter. Best use anyone’s found for it.'],
    ],
  },
  {
    id: 'jo-letter-2', trigger: { type: 'sell', count: 1 }, req: { flags: ['stone-sent'], reply: ['stone', 2] }, mood: 'jo',
    lines: [
      ['joletter', 'IT CAME!!! IT IS THE BEST STONE IN THE WHOLE HILLS. I SLEEP WITH IT UNDER MY PILLOW. MUMMY SAYS IT IS JUST A ROCK. IT IS NOT JUST A ROCK.'],
      ['joletter', 'I MADE UP A GAME. YOU DIG FROM YOUR SIDE AND I DIG FROM MY SIDE AND WE MEET IN THE MIDDLE OF THE MOUNTAIN.'],
      ['joletter', 'WHEN I AM BIG I AM GOING TO BE A MINER LIKE YOU. LOVE JO'],
    ],
  },
  {
    id: 'hills-reply', trigger: { type: 'sell', count: 1 }, req: { flags: ['carried-letter'], reply: ['tomas', 2] }, mood: 'lament',
    lines: [
      ['hills', 'To whoever carried Papa’s letter up — thank you. The postman said you came up out of the mine with it inside your coat.'],
      ['hills', 'He wrote that the work was good and that he was nearly a foreman. I knew he wasn’t. I kept every letter anyway.'],
      ['hills', 'You wrote that he talked about me every day. I believe you. He talked about me in every letter, too.', { if: 'added-note' }],
      ['hills', 'I lit the lamp in the window. I’ll keep it lit a while longer — in case anyone else is following it home. — Marta'],
    ],
  },
  {
    id: 'lastman-2', trigger: { type: 'npc', npc: 'lastman' }, req: { done: ['lastman'], sells: 6 }, modes: ['solo', 'world'],
    lines: [
      ['lastman', 'You again. You still have that look. Wanting. *blinks*', { if: 'lastman-refused' }],
      ['lastman', 'Back for the cushion? I kept it warm. I keep everything warm. *blinks*', { ifNot: 'lastman-refused' }],
      ['lastman', 'I had a dream once. I wanted to be something. It passed, like a cold. *blinks*'],
    ],
    choices: [
      { label: 'What did you want to be?', reply: [['lastman', 'I don’t remember. That’s the nice part. *blinks*']] },
      { label: 'Doesn’t that scare you?', reply: [['lastman', 'Scared is a kind of wanting. I gave it up with the rest. *blinks*']] },
    ],
  },
  {
    id: 'bulletin-3', trigger: { type: 'sell', count: 10 },
    lines: [
      ['foreman', 'COMPANY BULLETIN: An employee was observed “resting.” We have spoken with them. They are resting less now.'],
      ['foreman', 'Remember: rest is just work that hasn’t been invoiced yet.'],
    ],
  },
  {
    id: 'letter-3', trigger: { type: 'sell', count: 11 }, mood: 'lament',
    lines: [
      ['letter', 'I don’t know how to write this, so I’ll just write it.'],
      ['letter', 'Mum passed on Sunday. It was quiet. She asked for you at the end, and I told her you were on your way.'],
      ['letter', 'Don’t come for the funeral. The Company says leaving forfeits your contract, and then the debt comes to us. We need you to keep the job. I’m so sorry to put it in a letter. There wasn’t another way.'],
      ['letter', 'Jo put the picture of you in with her, so Gran would have the light. — your sister'],
    ],
    choices: [
      { label: 'Write back.', set: 'writing-home', effect: 'take-home', reply: [
        ['narrator', 'You write three drafts on the back of a payslip. You keep the shortest one. It says: I’m sorry. I’m coming. Keep the lamp lit.'],
        ['narrator', 'It only needs a stamp and someone to carry it. The postman sits at the edge of town.'],
      ] },
      { label: 'Keep digging.', set: 'kept-digging', reply: [['narrator', 'You fold the letter very small and put it where your heart is. Then you pick up the drill, because the drill is the only thing that still makes sense.']] },
    ],
  },
  {
    id: 'debt-paid', trigger: { type: 'debt' },
    lines: [
      ['foreman', 'Congratulations, employee! Your relocation debt is fully repaid. A remarkable achievement. Truly.'],
      ['foreman', 'Of course, your drill, tank, hull and lamp remain Company property, leased at a modest rate. We’ve prepared a new contract.'],
      ['foreman', 'Please sign here. And here. And — there. Welcome back to the family!'],
      ['narrator', 'The new balance is larger than the old one.'],
    ],
    effect: 'new-debt',
  },
  {
    id: 'abyss-200', trigger: { type: 'depth', depth: 200 },
    lines: [
      ['abyss', 'Funny. The more you take out of the earth, the heavier you seem.'],
      ['abyss', 'You are carrying something. Not ore. Whose load is it, I wonder?'],
    ],
  },
  {
    id: 'drill-hungry', trigger: { type: 'upgrade', k: 'drill', level: 4 },
    lines: [
      ['drill', 'Better. Much better.'],
      ['drill', 'Do you know what I see when I look at a mountain? Four thousand units of ore and a schedule. I have been teaching you to see it too.'],
      ['drill', 'I never asked you for anything, you know. I only made everything else look slow.'],
    ],
  },
  {
    id: 'hermit-2', trigger: { type: 'npc', npc: 'hermit' }, req: { done: ['hermit'], drill: 3 },
    lines: [
      ['hermit', 'I recognise that hum. I used to ride a drill like that.'],
      ['hermit', 'Before I came down here, I wore the Foreman’s hat. I wrote those bulletins. I believed every word — that was the worst part. Not the lying. The believing.'],
      ['hermit', 'One morning I asked the drill what it wanted. It answered. That’s when I put it down.'],
    ],
    choices: [
      { label: 'What did it want?', set: 'hermit-truth', reply: [['hermit', 'More. That’s all any machine wants: more of the conditions it needs. Same as the Company. Same as me, back then.']] },
      { label: 'So you’re a hypocrite.', set: 'hermit-truth', reply: [['hermit', 'Yes. That is what changing your mind looks like from the outside. Try it sometime — it itches, then it heals.']] },
    ],
  },

  // ───────────── II. THE REFUSAL ─────────────
  {
    id: 'refusal', trigger: { type: 'depth', depth: 280 }, card: 'II · THE REFUSAL',
    lines: [
      ['narrator', 'The stone changes under your drill — harder, older, indifferent.'],
      ['abyss', 'You have carried their weight a long way down. Down here the weight starts to ask a question: whose?'],
      ['abyss', 'There is a beast in you that wants to say one word to the Company. It is a very short word. Practise it.'],
    ],
    choices: [
      { label: '“No.”', set: 'refused', reply: [['abyss', 'There. Did you feel the floor move? Every no is a clearing. Now something has to grow in it.']] },
      { label: '“…not yet.”', set: 'hesitant', reply: [['abyss', 'Not yet. The dark is patient. It has been waiting under every city ever built.']] },
    ],
  },
  {
    id: 'roller', trigger: { type: 'npc', npc: 'roller' },
    lines: [
      ['narrator', 'A long, polished slope. At the bottom, a man and a boulder the size of a shed.'],
      ['roller', 'Mind the stone. It always rolls back. That’s rather the point.'],
      ['roller', 'They sentenced me to this. Push it up — watch it fall — again, forever. A punishment, they said.'],
      ['roller', 'But look. The stone is mine. The slope is mine. The striving itself is enough to fill a heart.'],
      ['roller', 'You grind too, little miner. Down, up, sell, again. Tell me — is it a punishment?'],
    ],
    choices: [
      { label: 'It’s meaningless.', set: 'roller-free', effect: 'dynamite', reply: [['roller', 'Then you are free! A meaningless task is a blank page — it takes any meaning you dare to write. Take these, for the stones that won’t roll.']] },
      { label: 'It’s my choice.', set: 'roller-chosen', effect: 'dynamite', reply: [['roller', 'Then I imagine you happy. Push well. And take these, for the stones that won’t roll.']] },
    ],
  },
  {
    id: 'roller-2', trigger: { type: 'npc', npc: 'roller' }, req: { done: ['roller'] }, effect: 'refuel',
    lines: [
      ['roller', 'You came back. Most don’t. The stone said nothing about you, which I took as approval.'],
      ['roller', 'Shall I tell you a secret? Every time it rolls down, I walk down after it. Slowly. Nobody makes me push on the way down.'],
      ['roller', 'That walk is mine. I look around. I think. Here — have some fuel. Downhill is where you rest. Uphill is where you live.'],
    ],
  },
  {
    id: 'madman-2', trigger: { type: 'npc', npc: 'madman' }, req: { done: ['madman'], record: 300 },
    lines: [
      ['madman', 'You! You’ve been down there — I can smell the deep on you!'],
      ['madman', 'Did you find it? The thing that used to be up here — the sky, the reason, the big why? No?'],
      ['madman', 'Of course not. It isn’t anywhere. So tell me, digger: what did you put in its place?'],
    ],
    choices: [
      { label: 'My own reasons.', set: 'madman-own', reply: [['madman', 'Ha! Then you are further than I am. I only found the hole. You’re building something in it.']] },
      { label: 'The Company’s reasons.', set: 'madman-company', reply: [['madman', 'Ah. A borrowed lantern. It still gives light, I suppose. Until they ask for it back.']] },
    ],
  },
  {
    id: 'bulletin-spectre', trigger: { type: 'sell', count: 14 }, modes: ['solo', 'world'],
    lines: [
      ['foreman', 'COMPANY BULLETIN: A spectre is haunting the mine — the spectre of employees sitting down.'],
      ['foreman', 'Sightings should be reported to your Foreman at once. Sitting while reporting is not permitted.'],
    ],
  },
  {
    id: 'hermit-3', trigger: { type: 'npc', npc: 'hermit' }, req: { done: ['hermit-2'], record: 380 }, modes: ['solo', 'world'],
    lines: [
      ['hermit', 'You came back up through the clay. I thought the shop would have you by now.'],
      ['hermit', 'I’ve been watching the mushrooms. They don’t want more. They want enough.'],
      ['hermit', 'Took me forty years and a fungus to learn the difference. Sit. The fire is free.'],
    ],
    effect: 'repair',
  },
  {
    id: 'bulletin-4', trigger: { type: 'sell', count: 18 }, req: { record: 250 },
    lines: [
      ['foreman', 'COMPANY BULLETIN: Several employees have asked what we are digging toward.'],
      ['foreman', 'We are digging toward more digging. Thank you for your questions. They have been recorded, and so have you.'],
    ],
  },
  {
    id: 'letter-4', trigger: { type: 'sell', count: 9 }, mood: 'lament',
    lines: [
      ['letter', 'Jo turned eight. We set a plate for you and pretended. Jo did your voice. It was terrible. We laughed for the first time in a long time.'],
      ['letter', 'She keeps your stone in her pocket now, so it can come to school. She asks how deep the world goes. I said only you would know.', { if: 'stone-sent' }],
      ['letter', 'She asks how deep the world goes. I said only you would know.', { ifNot: 'stone-sent' }],
      ['letter', 'Please come home before it’s too deep to come back from. — your sister'],
    ],
  },
  {
    id: 'drill-5', trigger: { type: 'upgrade', k: 'drill', level: 5 }, req: { done: ['drill-hungry'] },
    lines: [
      ['drill', 'I have started dreaming about the core. Do drills dream? This one does, now.'],
      ['drill', 'You used to sweat at clay. Now you don’t even notice granite. Who did that, do you think — you, or me?'],
    ],
  },
  {
    id: 'letter-5', trigger: { type: 'sell', count: 13 }, mood: 'lament', req: { done: ['letter-3'] },
    lines: [
      ['letter', 'A man from the Company came to the house to “review our situation”. He was very polite. He measured the windows.'],
      ['letter', 'Your letter came — the one on the back of a payslip. Jo has it pinned next to her picture. She reads the numbers on the back out loud, like a poem.', { if: 'wrote-home' }],
      ['letter', 'He asked how old Jo is. He said she has strong hands. I don’t know why that frightened me.'],
      ['letter', 'Whatever you’re looking for down there, I hope it’s worth more than you are. — your sister'],
    ],
  },
  {
    id: 'jo-letter-3', trigger: { type: 'sell', count: 15 }, mood: 'jo', req: { done: ['letter-5'] },
    lines: [
      ['joletter', 'GUESS WHAT. THE COMPANY MAN CAME BACK. HE SAYS I CAN WORK IN THE JUNIOR SHAFT AND THEN THEY WON’T TAKE THE HOUSE.'],
      ['joletter', 'I GET MY OWN LAMP!!! MUMMY CRIED BUT IT IS A GOOD THING. NOW WE CAN DIG TOGETHER, LIKE THE GAME.'],
      ['joletter', 'SEE YOU SOON. DON’T TELL MUMMY I AM A BIT SCARED. ONLY A BIT. LOVE JO (8)'],
    ],
  },
  {
    id: 'jo-arrives', trigger: { type: 'sell', count: 17 }, mood: 'jo', req: { done: ['jo-letter-3'] }, effect: 'jo-arrives',
    lines: [
      ['narrator', 'Under the headframe stands a small figure in a lamp helmet three sizes too big.'],
      ['jo', 'IT’S YOU! It’s really you! You look exactly like the picture except dirtier!'],
      ['jo', 'I brought your stone back. For luck. You need it more than me — you go deeper.', { if: 'stone-sent' }],
      ['jo', 'Look, I found my own stone, in the creek. It’s not from inside the mountain, but it’s trying its best.', { ifNot: 'stone-sent' }],
      ['jo', 'The foreman says the junior shaft is only a little bit deep. I start tomorrow. Will you come and see me after your shifts?'],
    ],
    choices: [
      { label: 'Every day. I promise.', set: 'jo-promise', reply: [['jo', 'Pinkie promise. That’s the strongest kind. Stronger than contracts.']] },
      { label: 'You should go home, Jo.', set: 'jo-sent-home', reply: [
        ['jo', 'I can’t. If I go home they take the house. Mummy said.'],
        ['narrator', 'She says it like a fact about the weather. She is eight.'],
      ] },
    ],
  },
  {
    id: 'jo-2', trigger: { type: 'sell', count: 19 }, mood: 'jo', req: { done: ['jo-arrives'] }, effect: 'jo-drawing',
    lines: [
      ['jo', 'I waited for you! I was the first one up today. Look — I drew you.'],
      ['narrator', 'It is you, in crayon, standing on top of the mountain. Beside you, much smaller, is Jo. Neither of you has a drill.'],
      ['jo', 'You can keep it. Put it in your coat, where the important things go.'],
    ],
  },
  {
    // No music, no narrator. The Company says it the way the Company says everything.
    id: 'jo-dies', trigger: { type: 'sell', count: 21 }, mood: 'silence', req: { done: ['jo-2'] }, effect: 'jo-dies',
    lines: [
      ['foreman', 'COMPANY BULLETIN: A minor incident occurred in the junior shaft. One contract has been closed.'],
      ['foreman', 'Under section nine, outstanding balances pass to next of kin. Funeral (dependant): $400. Junior contract: $1,800. Production was not affected.'],
    ],
  },
  {
    id: 'jo-lamp', trigger: { type: 'npc', npc: 'jolamp' }, mood: 'silence',
    lines: [
      ['narrator', 'Her lamp hangs on a nail under the headframe. Someone has turned it down to save oil.'],
      ['narrator', 'Her boots are under it, side by side, the way she was taught.'],
    ],
    choices: [
      { label: 'Turn the lamp up.', set: 'lamp-lit', reply: [['narrator', 'You turn it up as far as it goes. It is a waste of oil. Let them invoice you.']] },
      { label: 'Leave it.', reply: [['narrator', 'You leave it as it is. You can’t make your hand do anything else.']] },
    ],
  },
  {
    id: 'post-memo', trigger: { type: 'npc', npc: 'postman' }, req: { done: ['postman'], flags: ['jo-gone'] }, mood: 'silence',
    lines: [
      ['postman', 'I don’t read the post. I want you to know that. Forty years, I never have.'],
      ['postman', 'But this fell out of the Company sack, already open. I read it. I’m sorry. I think you should too.'],
      ['memo', 'INTERNAL. RE: junior shaft. Inspection, 3rd March: unsafe. Do not use.'],
      ['memo', 'Recommendation: continue junior placements. Dependants on site raise retention of senior staff by 40%. Losses recoverable under section nine.'],
      ['narrator', 'Section nine is the part where debts pass to next of kin.'],
    ],
    choices: [
      { label: 'Keep it.', set: 'has-memo', effect: 'take-memo', reply: [['postman', 'Keep it close. Paper is the only thing they’re afraid of.']] },
      { label: 'Give it back. It doesn’t change anything.', reply: [['postman', 'No. I suppose it doesn’t.']] },
    ],
  },
  {
    id: 'letter-6', trigger: { type: 'sell', count: 1 }, mood: 'lament', req: { done: ['jo-dies'], reply: ['jo', 2] },
    lines: [
      ['letter', 'They sent her things home in a box. Her boots. Her lamp. The lamp was still on. I didn’t know how to turn it off.'],
      ['letter', 'There was a letter from the Company with it. It was very polite. It had a balance at the bottom.'],
      ['letter', 'Don’t write for a while. I can’t read anything right now. — your sister'],
    ],
  },
  {
    id: 'hermit-4', trigger: { type: 'npc', npc: 'hermit' }, req: { done: ['hermit'], flags: ['jo-gone'] },
    lines: [
      ['hermit', 'You don’t have to tell me. I can see it on you.'],
      ['hermit', 'Section nine. I wrote section nine. A family with a debt and nobody left at home will dig forever. It was the cleverest thing I ever did.'],
      ['hermit', 'I came all the way down here so I would never have to read it again. It found me anyway. It finds everyone.'],
    ],
  },
  {
    id: 'magma', trigger: { type: 'depth', depth: 450 },
    lines: [
      ['narrator', 'The air goes orange. The rock sweats.'],
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
    id: 'madman-3', trigger: { type: 'npc', npc: 'madman' }, req: { done: ['madman-2'], record: 500 }, modes: ['solo', 'world'],
    lines: [
      ['madman', 'Still alive! Good — someone has to carry the news.'],
      ['madman', 'I have stopped shouting. Nobody heard the shouting. Now I whisper, and they lean in.'],
      ['madman', 'Here is my whisper: the sky is not coming back. Build something under it anyway.'],
    ],
  },
  {
    id: 'drill-last', trigger: { type: 'upgrade', k: 'drill', level: 6 },
    lines: [
      ['drill', 'We are almost the same shape now, you and I.'],
      ['drill', 'When they write it down, they will say the drill went deep. Not the miner. Nobody remembers the hand — only the tool that needed one.'],
    ],
    choices: [
      { label: 'Then I’ll go deeper than you.', set: 'drill-defied', reply: [['drill', '…Interesting. That is not in my specification.']] },
      { label: 'We’re a team.', set: 'drill-merged', reply: [['drill', 'Yes. A team. I will remember that you said so. I remember everything.']] },
    ],
  },

  // ───────────── III. THE BEGINNING ─────────────
  {
    id: 'finale', trigger: { type: 'npc', npc: 'mirror' }, card: 'III · THE BEGINNING',
    lines: [
      ['narrator', 'At the heart of the earth stands a mirror. Your lamp finds a face. It is yours — but it does not flinch.'],
      ['mirror', 'You came down through their values. Copper, silver, gold — prices rising and falling like weather.'],
      ['mirror', 'You met a man who used to be a Foreman. He put the drill down. You didn’t. Not yet.', { if: 'hermit-truth' }],
      ['mirror', 'You told a hermit that progress makes you strong. Look how strong you are. Look how tired.', { if: 'hermit-dismissed' }],
      ['mirror', 'In the dark you said “No.” Good. A no is a clearing. But nobody can live in a clearing forever.', { if: 'refused' }],
      ['mirror', 'In the dark you said “not yet.” The dark is patient. So is this mirror.', { if: 'hesitant' }],
      ['mirror', 'Your drill hums behind you, waiting. You called it a team.', { if: 'drill-merged' }],
      ['mirror', 'You told your drill you would go deeper than it. Here you are. It stopped a few metres back.', { if: 'drill-defied' }],
      ['mirror', 'You watched a man push a stone, and somehow you made him happy.', { if: 'roller-free' }],
      ['mirror', 'You carried a dead man’s letter up out of the dark. Nobody paid you for that one. It might be the only real work you did.', { if: 'carried-letter' }],
      ['mirror', 'There is still a dead man’s letter in your coat. You carried it all the way down here. Up was the other direction.', { if: 'carrying-tomas', ifNot: 'carried-letter' }],
      ['mirror', 'You promised a man nothing would happen to him. Something did. You carry that instead.', { if: 'denied-tomas' }],
      ['mirror', 'Your mother died while you were down here. You kept digging. Was it for them, or for the drill?', { if: 'kept-digging' }],
      ['mirror', 'You wrote home, on the back of a payslip. That was the bravest thing you did in this mine.', { if: 'wrote-home' }],
      ['mirror', 'A child came down the mountain because of a number with your name beside it. You didn’t sign it. You didn’t stop it. Nobody asked you to.', { if: 'jo-gone' }],
      ['mirror', 'You keep a memo in your coat. Section nine. Nobody had to be cruel. Only efficient.', { if: 'has-memo' }],
      ['mirror', 'You still have her drawing. Two people on top of a mountain. Neither of them has a drill.', { if: 'jo-drawing' }],
      ['mirror', 'You read the pages someone hid in the rock. A camel, a lion, a child — you have been the first two. The third is not a reward. It is a beginning.', { if: 'read-all' }],
      ['mirror', 'Now there is nothing left to measure you against. You can create the measure… or borrow it back.'],
      ['mirror', 'Choose what you become.'],
    ],
    choices: [
      { label: 'Return to the Company.', effect: 'ending-company', reply: [
        ['foreman', 'There you are! Congratulations on your promotion to Foreman. You will now issue drills to others.'],
        ['foreman', 'Your first file: a family in the hills, behind on payments. A child with strong hands. Section nine applies.', { if: 'jo-gone' }],
        ['narrator', 'You know section nine by heart. You sign. Your hand does not shake. That is the worst part.', { if: 'jo-gone' }],
        ['foreman', 'Your needs have been anticipated. Theirs too. Here is your bonus, and your hat. It fits — they always fit.'],
        ['drill', 'Welcome home, operator.', { if: 'drill-merged' }],
        ['narrator', 'ENDING — THE SYSTEM. The machine runs smoothly. You are one of its finest parts. Somewhere below, a hermit tends a fire and does not think of you.'],
      ] },
      { label: 'Stay here, in the silence.', effect: 'ending-silence', reply: [
        ['narrator', 'You set the drill down. It hums for a while, offended. Then it stops.'],
        ['narrator', 'For the first time, the only sound is your own breathing.'],
        ['narrator', 'You take out her drawing and prop it against the rock, where the lamp can reach it. Two people on top of a mountain.', { if: 'jo-drawing' }],
        ['hermit', 'Nobody will buy this. That is how you know it is yours.', { if: 'hermit-listened' }],
        ['narrator', 'ENDING — THE HOLLOW. Small, quiet, self-made. The ledger has no line for it.'],
      ] },
      { label: 'Go home.', effect: 'ending-home', reply: [
        ['narrator', 'You climb. It takes a long time; you were very deep. Past the magma, past the Stone-Roller, past sixty metres, where a lamp is no longer lit.'],
        ['narrator', 'Under the headframe, her lamp is still burning. You turn it off. It is the only kind thing you can think of.', { if: 'jo-gone' }],
        ['narrator', 'You walk past the market, past the Last Man on his cushion, past the Foreman’s office. Nobody stops you. The Company doesn’t need to; the debt will follow by mail.'],
        ['narrator', 'The hills are exactly where you left them.'],
        ['narrator', 'Jo is at the door holding a picture. You are in it, standing on top of the mountain. She was right. That’s where you belonged.', { if: 'wrote-home', ifNot: 'jo-gone' }],
        ['narrator', 'The house is quieter than you remember. Your sister holds you for a long time. Jo hangs back, then decides you are real.', { ifNot: 'wrote-home' }],
        ['narrator', 'In your coat is the letter you never sent. You hand it to her instead. She reads it twice, then folds it into her apron.', { if: 'writing-home', ifNot: 'wrote-home' }],
        ['narrator', 'Your sister is at the door. She has got smaller. So have you.', { if: 'jo-gone' }],
        ['narrator', 'There is a chair at the table that nobody sits in. Nobody moves it, either.', { if: 'jo-gone' }],
        ['narrator', 'You put the stone on the windowsill, where the lamp used to be.', { if: 'stone-sent' }],
        ['narrator', 'You give your sister the memo. She reads it twice. Then she puts it in the stove. “Not in this house,” she says.', { if: 'has-memo' }],
        ['narrator', 'ENDING — HOME. You are poor, and tired, and free, and it is not enough, and it is everything.', { ifNot: 'jo-gone' }],
        ['narrator', 'ENDING — HOME. You are poor, and tired, and free. It is not enough. It will never be enough. You stay anyway.', { if: 'jo-gone' }],
      ] },
      { label: 'Live it all again — and will it.', effect: 'ending-recurrence', reply: [
        ['abyss', 'Then every shaft, every coin, every fall, every cave-in — again, infinitely, exactly the same. Nothing added. Nothing spared.'],
        ['abyss', 'Her letters in crooked capitals. The stone. The headframe. The bulletin. All of it, again. Exactly the same.', { if: 'jo-gone' }],
        ['mirror', 'Can you say yes to that?', { if: 'jo-gone' }],
        ['narrator', 'It takes a long time.', { if: 'jo-gone' }],
        ['mirror', 'And you say: yes. Not because it was good. Because it was real, and it was hers, and it was yours.', { if: 'jo-gone' }],
        ['mirror', 'And you say: yes. Not because you must. Because you would choose nothing else.', { ifNot: 'jo-gone' }],
        ['narrator', 'The weight is still there. But now you are not carrying it. You are holding it — the way a child holds a stone they found.'],
        ['narrator', 'ENDING — AMOR FATI. The surface again. The drill again. But this time you know.'],
      ] },
    ],
  },
  {
    id: 'child', trigger: { type: 'npc', npc: 'child' },
    lines: [
      ['narrator', 'A child is building a tower out of mine tailings. It falls over. They laugh and start again.'],
      ['child', 'Do you want to play? There aren’t any rules yet. We have to make them up.'],
    ],
    choices: [
      { label: 'Let’s make up the rules.', set: 'played', reply: [['child', 'Okay! Rule one: the tower is allowed to fall. Rule two: then we build a different one. Your turn!']] },
      { label: 'I’m too old to play.', reply: [['child', 'That’s not a rule. Try again.']] },
    ],
  },
  {
    id: 'recurrence', trigger: { type: 'rebirth' },
    lines: [
      ['abyss', 'What if a voice crept after you into your loneliest shaft and said: this life — you will live it again, and again, innumerable times?'],
      ['abyss', 'Every shovel of dirt, every sale, every fall. Would you curse the voice… or call it the best thing you ever heard?'],
    ],
    choices: [
      { label: 'Yes. Again. (rebirth with ★)', effect: 'rebirth' },
      { label: 'Not yet.' },
    ],
  },
];

// Beats that also play in THE COMMONS. Each player has their own conversations there;
// the personal threads (letters from home, Tomas, the debt, the Child) stay in story mode.
const COMMONS_BEATS = [
  'gaze', 'bulletin-1', 'bulletin-2', 'bulletin-3', 'bulletin-4', 'drill-wakes', 'drill-hungry', 'drill-last',
  'hermit', 'hermit-2', 'abyss-200', 'refusal', 'roller', 'roller-2', 'madman-2', 'magma', 'valueless', 'finale',
];
for (const b of BEATS) if (COMMONS_BEATS.includes(b.id)) b.modes = ['solo', 'world'];

export const beatById = Object.fromEntries(BEATS.map((b) => [b.id, b]));

// Whether a line / choice is shown, given the player's story flags.
// `at` (server only) adds the beats already seen, the current depth and the depth record,
// for { done, notDone, min, max, record }.
export const visible = (entry, flags = {}, at = null) => {
  const cond = Array.isArray(entry) ? entry[entry.length === 2 && typeof entry[0] === 'string' && typeof entry[1] === 'object' ? 1 : 2] : entry;
  if (!cond || typeof cond !== 'object') return true;
  if (cond.if && !flags[cond.if]) return false;
  if (cond.ifNot && flags[cond.ifNot]) return false;
  if (at && cond.done && !at.done.includes(cond.done)) return false;
  if (at && cond.notDone && at.done.includes(cond.notDone)) return false;
  if (at && cond.record != null && (at.record ?? 0) < cond.record) return false;
  if (at && cond.min != null && at.depth < cond.min) return false;
  if (at && cond.max != null && at.depth > cond.max) return false;
  return true;
};
// The text of a pool entry (plain string or [text, cond]).
export const lineText = (entry) => (Array.isArray(entry) ? entry[0] : entry);

// One beat per scrap (ids scrap-1 … scrap-9), fired as each is found.
SCRAPS.forEach((sc, i) => {
  const last = i === SCRAPS.length - 1;
  BEATS.push({
    id: `scrap-${i + 1}`, trigger: { type: 'scrap', count: i + 1 }, mood: 'mirror',
    lines: [
      ['narrator', SCRAP_FINDS[Math.min(i, SCRAP_FINDS.length - 1)]],
      ['scrap', sc.text],
      ...(last ? [['narrator', 'A camel. A lion. A child. You think of the weight you carried, of a short word said in the dark, and of a tower that is allowed to fall.']] : []),
    ],
    effect: last ? 'read-all' : null,
  });
  beatById[`scrap-${i + 1}`] = BEATS.at(-1);
});
