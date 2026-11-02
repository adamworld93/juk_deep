
export const LOOK_COLORS = [
  '#ff6b6b', '#ffd93d', '#6bcbff', '#b388ff', '#7dff9b', '#ff9f43',
  '#ff7ad9', '#4dd4c6', '#f7f78a', '#9fa8ff', '#ffb3a7', '#e8e8e8',
];

// `art` tops the dialogue portrait (17 columns wide).
export const HATS = [
  { key: 'hardhat', name: 'hard hat', art: ['    .________.   ', '  _/   (*)    \\_ ', ' [______________]'] },
  { key: 'lamp', name: 'lamp helmet', art: ['      _(@)_      ', "   .-'     '-.   ", '  (___________)  '] },
  { key: 'beanie', name: 'beanie', art: ['       (o)       ', '    .-"""""-.    ', '   (_________)   '] },
  { key: 'cap', name: 'cap', art: ['                 ', '     .-----.     ', '    (_______)==  '] },
  { key: 'bandana', name: 'bandana', art: ['                 ', '    _________    ', '  <|=========|   '] },
  { key: 'tophat', name: 'top hat', art: ['     _______     ', '    |       |    ', '  __|_______|__  '] },
  { key: 'hood', name: 'hood', art: ['      _____      ', '    /       \\    ', '   /         \\   '] },
  { key: 'none', name: 'bare head', art: ['                 ', '      ,,,,,,     ', '     (((((((     '] },
];

export const FACES = [
  { key: 'tired', name: 'tired', eyes: '-   -', mouth: ' ___ ' },
  { key: 'hopeful', name: 'hopeful', eyes: 'o   o', mouth: ' \\_/ ' },
  { key: 'stern', name: 'stern', eyes: '>   <', mouth: ' --- ' },
  { key: 'worried', name: 'worried', eyes: 'O   o', mouth: ' ~~~ ' },
  { key: 'calm', name: 'calm', eyes: '^   ^', mouth: '  -  ' },
  { key: 'bearded', name: 'bearded', eyes: '•   •', mouth: '#####' },
];

export const BODIES = ['@', '&', 'Ö', '§', '¥', 'ß'];
export const OUTFITS = { '@': 'overalls', '&': 'jacket', 'Ö': 'sweater', '§': 'striped shirt', '¥': 'vest', 'ß': 'long coat' };

export const DEFAULT_LOOK = { hat: 'hardhat', face: 'tired', body: '@', color: LOOK_COLORS[0] };

export function sanitizeLook(l) {
  if (!l || typeof l !== 'object') l = {};
  return {
    hat: HATS.some((h) => h.key === l.hat) ? l.hat : DEFAULT_LOOK.hat,
    face: FACES.some((f) => f.key === l.face) ? l.face : DEFAULT_LOOK.face,
    body: BODIES.includes(l.body) ? l.body : DEFAULT_LOOK.body,
    color: LOOK_COLORS.includes(l.color) ? l.color : DEFAULT_LOOK.color,
  };
}

export const hatOf = (look) => HATS.find((h) => h.key === look?.hat) ?? HATS[0];
export const faceOf = (look) => FACES.find((f) => f.key === look?.face) ?? FACES[0];

export function playerPortrait(look) {
  const f = faceOf(look);
  return [
    ...hatOf(look).art,
    `   |  ${f.eyes}  |`,
    '   |    >    |',
    `   |  ${f.mouth}  |`,
    '    \\_______/',
    '   __|     |__',
    `  /   | ${look?.body ?? '@'} |   \\`,
  ].join('\n');
}
