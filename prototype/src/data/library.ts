import type {
  Book, Edition, EditionSettings, FilterCategory, FilterLevel, Progress, ReadingMode, Run, Series,
} from './types';

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

export const CATEGORIES: { id: FilterCategory; name: string; examples: string; icon: string }[] = [
  { id: 'language', name: 'Language', examples: 'Profanity, slurs, crude insults', icon: '💬' },
  { id: 'violence', name: 'Violence & gore', examples: 'Battles, injury detail, blood, cruelty', icon: '⚔️' },
  { id: 'scariness', name: 'Scariness & peril', examples: 'Monsters, dread, nightmares, horror imagery', icon: '👻' },
  { id: 'death', name: 'Death & grief', examples: 'Character deaths, loss, mourning', icon: '🕯️' },
  { id: 'romance', name: 'Romance & sexuality', examples: 'Kissing, innuendo, sexual content', icon: '💌' },
  { id: 'substances', name: 'Substances', examples: 'Drinking, smoking, drugs', icon: '🍺' },
  { id: 'mature', name: 'Mature themes', examples: 'War, abuse, despair, moral horror', icon: '🌑' },
  { id: 'meanness', name: 'Meanness & bullying', examples: 'Cruelty between characters, humiliation', icon: '😠' },
  { id: 'crude', name: 'Crude humor', examples: 'Toilet and gross-out humor', icon: '💨' },
];

export const LEVEL_LABEL: Record<FilterLevel, string> = { keep: 'Keep', soften: 'Soften', remove: 'Remove' };

export const AGE_BANDS = [
  { name: 'Picture book', min: 3, max: 6, feel: 'Read aloud, simple, gentle, lots of pictures' },
  { name: 'Early reader', min: 5, max: 7, feel: 'Short sentences, simple vocabulary' },
  { name: 'Chapter book', min: 6, max: 9, feel: 'Short chapters, a picture every few pages' },
  { name: 'Middle grade', min: 8, max: 12, feel: 'Full novels, mild peril, light romance at most' },
  { name: 'Upper middle grade', min: 10, max: 14, feel: 'More complex themes, moderate peril' },
  { name: 'Young adult', min: 12, max: 17, feel: 'Mature themes handled carefully' },
];

export function bandFor(age: number) {
  if (age <= 4) return AGE_BANDS[0];
  if (age === 5) return AGE_BANDS[1];
  if (age <= 7) return AGE_BANDS[2];
  if (age <= 10) return AGE_BANDS[3];
  if (age <= 12) return AGE_BANDS[4];
  return AGE_BANDS[5];
}

export function gradeLevelFor(age: number, mode: ReadingMode, shift = 0) {
  // Read-aloud editions can run about two grades above what a child reads alone.
  const base = Math.max(0, age - 5) + (mode === 'read-aloud' ? 2 : 0) + shift;
  if (base <= 0) return 'Pre-K';
  if (base === 1) return 'Kindergarten';
  const g = Math.min(base - 1, 12);
  return `Grade ${g}`;
}

export function defaultFilters(age: number): Record<FilterCategory, FilterLevel> {
  if (age <= 5)
    return { language: 'remove', violence: 'remove', scariness: 'soften', death: 'remove', romance: 'remove', substances: 'remove', mature: 'remove', meanness: 'soften', crude: 'keep' };
  if (age <= 8)
    return { language: 'remove', violence: 'soften', scariness: 'soften', death: 'soften', romance: 'soften', substances: 'remove', mature: 'soften', meanness: 'soften', crude: 'keep' };
  if (age <= 11)
    return { language: 'soften', violence: 'soften', scariness: 'keep', death: 'soften', romance: 'soften', substances: 'soften', mature: 'soften', meanness: 'keep', crude: 'keep' };
  if (age <= 14)
    return { language: 'soften', violence: 'keep', scariness: 'keep', death: 'keep', romance: 'soften', substances: 'soften', mature: 'keep', meanness: 'keep', crude: 'keep' };
  return { language: 'soften', violence: 'keep', scariness: 'keep', death: 'keep', romance: 'keep', substances: 'keep', mature: 'keep', meanness: 'keep', crude: 'keep' };
}

export function defaultSettings(age = 7, mode: ReadingMode = 'read-aloud'): EditionSettings {
  return {
    targetAge: age,
    readingMode: mode,
    filters: defaultFilters(age),
    faithfulness: 30,
    readingLevelShift: 0,
    keepNames: true,
    extras: { kidTitles: false, recaps: age <= 8, glossary: false },
    picture: { on: false, every: 3, style: 'True to the book’s world', look: '' },
    notes: '',
  };
}

export function editionName(s: EditionSettings) {
  return [`Age ${s.targetAge}`, s.readingMode === 'read-aloud' ? 'Read-aloud' : 'Independent', s.picture.on ? 'Illustrated' : null]
    .filter(Boolean)
    .join(' · ');
}

export const ART_STYLES = [
  { name: 'True to the book’s world', desc: 'Matches the official look, as closely as possible', swatch: ['#4B2E83', '#D4A23A', '#2F7D62'] },
  { name: 'Watercolor storybook', desc: 'Soft washes, gentle edges, lots of light', swatch: ['#9CC7EE', '#F6B8C6', '#F6E3AE'] },
  { name: 'Ink & wash', desc: 'Classic pen lines with muted color', swatch: ['#2B2140', '#B07D55', '#EAD9B4'] },
  { name: 'Cozy gouache', desc: 'Thick, warm, matte colors', swatch: ['#B23A52', '#D4A23A', '#3462A8'] },
  { name: 'Bright cartoon', desc: 'Bold shapes, big expressions', swatch: ['#FF8A3D', '#3DB2FF', '#7ED957'] },
  { name: 'Woodcut', desc: 'Carved lines, two or three colors', swatch: ['#1F1A17', '#C0392B', '#F4E8CD'] },
];

export type OfficialLook = { name: string; note: string; bestFor: [number, number] };

export const OFFICIAL_LOOKS: Record<string, OfficialLook[]> = {
  oz: [
    { name: 'W. W. Denslow’s 1900 illustrations', note: 'The original art: bright, flat color and friendly round shapes.', bestFor: [3, 8] },
    { name: 'Modern illustrated editions', note: 'Lush, detailed fantasy painting.', bestFor: [8, 12] },
    { name: 'The 1939 film', note: 'The ruby slippers and Technicolor world most people picture.', bestFor: [9, 17] },
  ],
  hp1: [
    { name: 'Jim Kay illustrated editions', note: 'Warm, painterly and full of wonder; made for young readers.', bestFor: [3, 9] },
    { name: 'Original US cover and chapter art', note: 'The classic cover look and chapter-opening drawings.', bestFor: [8, 12] },
    { name: 'The films', note: 'The actors and sets everyone recognizes. Darker in later books.', bestFor: [10, 17] },
  ],
  hobbit: [
    { name: 'The 1977 animated film', note: 'Soft, storybook-like and gentle on scary creatures.', bestFor: [3, 7] },
    { name: 'Tolkien’s own drawings', note: 'The author’s watercolors and maps.', bestFor: [6, 12] },
    { name: 'Alan Lee & John Howe', note: 'The definitive illustrated editions; epic and detailed.', bestFor: [9, 17] },
    { name: 'The 2012–2014 films', note: 'Cinematic, with intense creature designs.', bestFor: [12, 17] },
  ],
};

export function looksFor(bookId: string): OfficialLook[] {
  if (bookId.startsWith('hp')) return OFFICIAL_LOOKS.hp1;
  if (bookId === 'hobbit' || bookId.startsWith('lotr')) return OFFICIAL_LOOKS.hobbit;
  if (bookId === 'oz') return OFFICIAL_LOOKS.oz;
  return [
    { name: 'Official cover art', note: 'Built from the covers and any official promo art.', bestFor: [3, 17] },
    { name: 'Fan art favorites', note: 'Popular community art, used as reference.', bestFor: [8, 17] },
  ];
}

export function recommendedLook(bookId: string, age: number) {
  const looks = looksFor(bookId);
  return looks.find((l) => age >= l.bestFor[0] && age <= l.bestFor[1]) ?? looks[0];
}

export const OZ_CHAPTERS = [
  'The Cyclone', 'The Council with the Munchkins', 'How Dorothy Saved the Scarecrow', 'The Road Through the Forest',
  'The Rescue of the Tin Woodman', 'The Cowardly Lion', 'The Journey to the Great Oz', 'The Deadly Poppy Field',
  'The Queen of the Field Mice', 'The Guardian of the Gate', 'The Wonderful City of Oz', 'The Search for the Wicked Witch',
  'The Rescue', 'The Winged Monkeys', 'The Discovery of Oz, the Terrible', 'The Magic Art of the Great Humbug',
  'How the Balloon Was Launched', 'Away to the South', 'Attacked by the Fighting Trees', 'The Dainty China Country',
  'The Lion Becomes the King of Beasts', 'The Country of the Quadlings', 'Glinda The Good Witch Grants Dorothy’s Wish',
  'Home Again',
];

export const OZ_KID_TITLES: Record<number, string> = {
  1: 'Whoosh! Up Goes the House',
  12: 'Clang, Boo and Buzz',
};

// ---------------------------------------------------------------------------
// Library
// Covers come from the Open Library Covers API (one of the sources Calibre can use).
// ---------------------------------------------------------------------------

export const olCover = (id: number) => `https://covers.openlibrary.org/b/id/${id}-L.jpg`;

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

export const SERIES: Series[] = [
  { id: 'middle-earth', name: 'Middle-earth', author: 'J.R.R. Tolkien', cover: { from: '#3f6b4a', to: '#1d3326', emblem: 'ring', ink: '#F2D48A' } },
  { id: 'hp', name: 'Harry Potter', author: 'J.K. Rowling', cover: { from: '#7a2433', to: '#3d0f1a', emblem: 'bolt', ink: '#F2D48A' } },
  { id: 'boc', name: 'Beware of Chicken', author: 'Casualfarmer', cover: { from: '#e3a33b', to: '#a2541d', emblem: 'chicken' } },
  { id: 'pj', name: 'Percy Jackson and the Olympians', author: 'Rick Riordan', cover: { from: '#2d8fc4', to: '#123f69', emblem: 'trident' } },
  { id: 'inheritance', name: 'The Inheritance Cycle', author: 'Christopher Paolini', cover: { from: '#2f5fb3', to: '#14244f', emblem: 'egg' } },
  { id: 'ender', name: 'Ender’s Saga', author: 'Orson Scott Card', cover: { from: '#2b2f45', to: '#0b0d18', emblem: 'planet', ink: '#9CC7EE' } },
  { id: 'hwfwm', name: 'He Who Fights With Monsters', author: 'Shirtaloon', cover: { from: '#5a2d7a', to: '#1e0d2e', emblem: 'sword' } },
  { id: 'hf', name: 'Heretical Fishing', author: 'Haylock Jobson', cover: { from: '#2aa69a', to: '#0f4f53', emblem: 'fish' } },
];

export const BOOKS: Book[] = [
  {
    id: 'oz', coverUrl: olCover(12648655), title: 'The Wonderful Wizard of Oz', author: 'L. Frank Baum', genres: ['Fantasy', 'Classic'], tags: ['Public domain', 'Prototype sample'],
    description: 'A Kansas farm girl and her dog are whisked by cyclone to a magical land, and set off down the yellow brick road to find a wizard who can send them home.',
    cover: { from: '#3fae6a', to: '#0f5a3a', emblem: 'house', ink: '#F6E3AE' }, words: 39_800, chapters: 24, addedAt: '2026-10-12', format: 'EPUB', hasRealText: true,
  },
  {
    id: 'hobbit', coverUrl: olCover(14624642), title: 'The Hobbit', author: 'J.R.R. Tolkien', seriesId: 'middle-earth', seriesOrder: 0, seriesLabel: 'Prequel',
    genres: ['Fantasy'], tags: ['Adventure', 'Dragons'],
    description: 'A comfort-loving hobbit is swept out his round green door on a quest with thirteen dwarves and a wizard to reclaim a dragon-guarded treasure.',
    cover: { from: '#4d8a5b', to: '#1f4029', emblem: 'mountain', ink: '#F2D48A' }, words: 95_000, chapters: 19, addedAt: '2026-09-02', format: 'EPUB',
  },
  {
    id: 'lotr1', coverUrl: olCover(14951350), title: 'The Fellowship of the Ring', author: 'J.R.R. Tolkien', seriesId: 'middle-earth', seriesOrder: 1, seriesLabel: 'Book 1',
    genres: ['Fantasy', 'Epic'], tags: ['Quest'],
    description: 'Frodo inherits a ring of terrible power, and a fellowship of nine sets out to destroy it before the Dark Lord can reclaim it.',
    cover: { from: '#3f6b4a', to: '#1d3326', emblem: 'ring', ink: '#F2D48A' }, words: 187_000, chapters: 22, addedAt: '2026-09-20', format: 'EPUB',
  },
  {
    id: 'lotr2', coverUrl: olCover(12617859), title: 'The Two Towers', author: 'J.R.R. Tolkien', seriesId: 'middle-earth', seriesOrder: 2, seriesLabel: 'Book 2',
    genres: ['Fantasy', 'Epic'], tags: ['Quest'],
    description: 'The fellowship is scattered. Some ride to war with Rohan while Frodo and Sam press on toward Mordor with an unlikely guide.',
    cover: { from: '#5a5f73', to: '#24262f', emblem: 'tower', ink: '#F2D48A' }, words: 156_000, chapters: 21, addedAt: '2026-09-20', format: 'EPUB',
  },
  {
    id: 'lotr3', coverUrl: olCover(14951359), title: 'The Return of the King', author: 'J.R.R. Tolkien', seriesId: 'middle-earth', seriesOrder: 3, seriesLabel: 'Book 3',
    genres: ['Fantasy', 'Epic'], tags: ['Quest'],
    description: 'The war for Middle-earth comes to its end as two hobbits climb toward the fires of Mount Doom.',
    cover: { from: '#8a6a2b', to: '#3a2a0d', emblem: 'crown', ink: '#fff' }, words: 137_000, chapters: 19, addedAt: '2026-09-20', format: 'EPUB',
  },
  {
    id: 'hp1', coverUrl: olCover(15235364), title: 'Harry Potter and the Sorcerer’s Stone', author: 'J.K. Rowling', seriesId: 'hp', seriesOrder: 1, seriesLabel: 'Book 1',
    genres: ['Fantasy'], tags: ['School', 'Magic'],
    description: 'On his eleventh birthday, a boy who lives under the stairs learns he is a wizard, and heads off to a school of magic.',
    cover: { from: '#7a2433', to: '#3d0f1a', emblem: 'bolt', ink: '#F2D48A' }, words: 77_000, chapters: 17, addedAt: '2026-08-14', format: 'EPUB',
  },
  {
    id: 'hp2', coverUrl: olCover(15244785), title: 'Harry Potter and the Chamber of Secrets', author: 'J.K. Rowling', seriesId: 'hp', seriesOrder: 2, seriesLabel: 'Book 2',
    genres: ['Fantasy'], tags: ['School', 'Magic'],
    description: 'Harry’s second year brings a warning house-elf, a flying car, and a mysterious voice in the walls.',
    cover: { from: '#2f6b3f', to: '#12301b', emblem: 'serpent', ink: '#E8E8E8' }, words: 85_000, chapters: 18, addedAt: '2026-10-01', format: 'EPUB',
  },
  {
    id: 'hp3', coverUrl: olCover(14656870), title: 'Harry Potter and the Prisoner of Azkaban', author: 'J.K. Rowling', seriesId: 'hp', seriesOrder: 3, seriesLabel: 'Book 3',
    genres: ['Fantasy'], tags: ['School', 'Magic'],
    description: 'An escaped prisoner is on the loose, and the school is guarded by chilling creatures as Harry starts his third year.',
    cover: { from: '#4a3a7a', to: '#1c1438', emblem: 'stag', ink: '#CFE3F5' }, words: 107_000, chapters: 22, addedAt: '2026-10-15', format: 'EPUB',
  },
  {
    id: 'boc1', coverUrl: olCover(14718151), title: 'Beware of Chicken', author: 'Casualfarmer', seriesId: 'boc', seriesOrder: 1, seriesLabel: 'Book 1',
    genres: ['Fantasy', 'Cozy', 'Cultivation'], tags: ['Farming', 'Humor'],
    description: 'Reborn into a world of sword-flying cultivators, Jin decides the heroic life isn’t for him and starts a farm instead, with a very unusual rooster.',
    cover: { from: '#e3a33b', to: '#a2541d', emblem: 'chicken' }, words: 132_000, chapters: 41, addedAt: '2026-07-30', format: 'EPUB',
  },
  {
    id: 'boc2', coverUrl: olCover(15160333), title: 'Beware of Chicken 2', author: 'Casualfarmer', seriesId: 'boc', seriesOrder: 2, seriesLabel: 'Book 2',
    genres: ['Fantasy', 'Cozy', 'Cultivation'], tags: ['Farming', 'Humor'],
    description: 'Life on Fa Ram keeps growing: new friends, new crops, and a rooster with ever bigger plans.',
    cover: { from: '#d98a3a', to: '#8a3d16', emblem: 'chicken' }, words: 141_000, chapters: 44, addedAt: '2026-10-08', format: 'EPUB',
  },
  {
    id: 'pj1', coverUrl: olCover(7239831), title: 'The Lightning Thief', author: 'Rick Riordan', seriesId: 'pj', seriesOrder: 1, seriesLabel: 'Book 1',
    genres: ['Fantasy', 'Mythology'], tags: ['Greek myth', 'Quest'],
    description: 'Percy discovers he is the son of a Greek god, and has ten days to find a stolen lightning bolt and prevent a war on Olympus.',
    cover: { from: '#2d8fc4', to: '#123f69', emblem: 'trident' }, words: 87_000, chapters: 22, addedAt: '2026-08-02', format: 'EPUB',
  },
  {
    id: 'eragon', coverUrl: olCover(6495870), title: 'Eragon', author: 'Christopher Paolini', seriesId: 'inheritance', seriesOrder: 1, seriesLabel: 'Book 1',
    genres: ['Fantasy'], tags: ['Dragons'],
    description: 'A farm boy finds a polished blue stone in the mountains, which hatches into a dragon, and his quiet life is over.',
    cover: { from: '#2f5fb3', to: '#14244f', emblem: 'egg' }, words: 157_000, chapters: 59, addedAt: '2026-10-16', format: 'EPUB',
  },
  {
    id: 'ender1', coverUrl: olCover(14700676), title: 'Ender’s Game', author: 'Orson Scott Card', seriesId: 'ender', seriesOrder: 1, seriesLabel: 'Book 1',
    genres: ['Science fiction'], tags: ['Space', 'School'],
    description: 'A gifted boy is sent to Battle School in orbit to train as the commander humanity needs against an alien threat.',
    cover: { from: '#2b2f45', to: '#0b0d18', emblem: 'planet', ink: '#9CC7EE' }, words: 101_000, chapters: 15, addedAt: '2026-07-18', format: 'EPUB',
  },
  {
    id: 'rpo', coverUrl: olCover(8270105), title: 'Ready Player One', author: 'Ernest Cline', genres: ['Science fiction'], tags: ['Video games', 'Puzzles'],
    description: 'In a bleak future, everyone escapes into a vast virtual world, where a hidden prize sets off the ultimate treasure hunt.',
    cover: { from: '#ff5fa2', to: '#2b1460', emblem: 'visor' }, words: 136_000, chapters: 39, addedAt: '2026-09-11', format: 'PDF',
  },
  {
    id: 'hwfwm1', coverUrl: olCover(15250745), title: 'He Who Fights With Monsters', author: 'Shirtaloon', seriesId: 'hwfwm', seriesOrder: 1, seriesLabel: 'Book 1',
    genres: ['Fantasy', 'LitRPG'], tags: ['Portal fantasy', 'Humor'],
    description: 'Jason wakes up in a world of magic and monsters, armed mostly with sarcasm and some very strange powers.',
    cover: { from: '#5a2d7a', to: '#1e0d2e', emblem: 'sword' }, words: 168_000, chapters: 46, addedAt: '2026-09-28', format: 'EPUB',
  },
  {
    id: 'hf1', coverUrl: olCover(15004617), title: 'Heretical Fishing', author: 'Haylock Jobson', seriesId: 'hf', seriesOrder: 1, seriesLabel: 'Book 1',
    genres: ['Fantasy', 'Cozy'], tags: ['Fishing', 'Humor'],
    description: 'A man in a fantasy world just wants to fish in peace, but his fishing keeps causing trouble for everyone around him.',
    cover: { from: '#2aa69a', to: '#0f4f53', emblem: 'fish' }, words: 118_000, chapters: 38, addedAt: '2026-10-05', format: 'EPUB',
  },
];

// ---------------------------------------------------------------------------
// Editions
// ---------------------------------------------------------------------------

function settings(age: number, mode: ReadingMode, patch: Partial<EditionSettings> = {}, pic?: Partial<EditionSettings['picture']>) {
  const s = defaultSettings(age, mode);
  return { ...s, ...patch, picture: { ...s.picture, ...(pic ?? {}) } };
}

export const EDITIONS: Edition[] = [
  {
    id: 'oz-5', bookId: 'oz', name: 'Age 5 · Read-aloud · Illustrated', createdAt: '2026-10-12',
    settings: settings(5, 'read-aloud', {
      notes: 'Keep Toto in every scene he’s in. Keep the Scarecrow, Tin Woodman and Lion funny. Make the scary bits bedtime-safe.',
      extras: { kidTitles: true, recaps: true, glossary: false },
    }, { on: true, every: 3, style: 'True to the book’s world', look: 'W. W. Denslow’s 1900 illustrations' }),
    sampleGuidance: ['A touch less babyish in chapter 1; keep some of Baum’s old-fashioned charm.', 'The wolves running away is perfect.'],
    status: 'ready',
    versions: [
      {
        number: '1.0.0', name: 'First Light', level: 'initial', date: '2026-10-12', cost: 3.84, guidance: '',
        description: 'The first full adaptation for a 5-year-old listener: violence moved off-page, the Witch’s creatures chased away instead of killed, and 41 illustrations in Denslow’s style.',
      },
      {
        number: '1.1.0', name: 'The Grumpy Witch', level: 'minor', date: '2026-10-15', cost: 0.62,
        guidance: 'The Wicked Witch is still a little too scary for bedtime. Make her more grumpy and silly than frightening, without losing that she’s the villain.',
        description: 'Made the Wicked Witch grumpier and sillier in chapters 12–14 and 23. She huffs, hops and loses her hat instead of raging. She’s still clearly the villain.',
      },
    ],
    currentVersion: '1.1.0',
  },
  {
    id: 'oz-8', bookId: 'oz', name: 'Age 8 · Independent', createdAt: '2026-10-17',
    settings: settings(8, 'independent', { notes: 'He’s reading this one by himself. Keep the adventure exciting.' }),
    sampleGuidance: [],
    status: 'samples-ready',
    versions: [],
    currentVersion: '',
  },
  {
    id: 'hobbit-6', bookId: 'hobbit', name: 'Age 6 · Read-aloud · Illustrated', createdAt: '2026-09-04',
    settings: settings(6, 'read-aloud', {
      notes: 'Tone down the spiders in Mirkwood a lot. Keep Bilbo’s humor and the riddles exactly.',
    }, { on: true, every: 3, style: 'Watercolor storybook', look: 'The 1977 animated film' }),
    sampleGuidance: ['Gollum should be creepy-funny, not scary.'],
    status: 'ready',
    versions: [
      { number: '1.0.0', name: 'There and Back Again', level: 'initial', date: '2026-09-04', cost: 9.12, guidance: '', description: 'First full adaptation for a 6-year-old listener, with 58 watercolor illustrations.' },
      { number: '1.1.0', name: 'Kinder Spiders', level: 'minor', date: '2026-09-09', cost: 1.04, guidance: 'The Mirkwood spiders are still too much. Make them more like grumpy, greedy bugs.', description: 'Rewrote the Mirkwood spiders in chapter 8 as greedy, bumbling bugs, and redrew their two illustrations.' },
      { number: '1.2.0', name: 'Thorin’s Farewell', level: 'minor', date: '2026-09-21', cost: 0.71, guidance: 'Thorin’s death needs a bit more warmth and closure. She cried and that’s ok, but give her a hopeful ending.', description: 'Thorin’s goodbye in chapter 18 is gentler and more hopeful, with Bilbo’s friendship at its center. Death stays on-page but soft.' },
    ],
    currentVersion: '1.2.0',
  },
  {
    id: 'hobbit-9', bookId: 'hobbit', name: 'Age 9 · Independent', createdAt: '2026-10-02',
    settings: settings(9, 'independent'),
    sampleGuidance: [],
    status: 'ready',
    versions: [{ number: '1.0.0', name: 'Riddles in the Dark', level: 'initial', date: '2026-10-02', cost: 7.88, guidance: '', description: 'First full adaptation for a 9-year-old reading alone. Battles stay exciting but less graphic.' }],
    currentVersion: '1.0.0',
  },
  {
    id: 'lotr1-8', bookId: 'lotr1', name: 'Age 8 · Read-aloud', createdAt: '2026-09-25',
    settings: settings(8, 'read-aloud', { notes: 'The Black Riders should be mysterious, not terrifying. Keep Tom Bombadil.' }),
    sampleGuidance: [],
    status: 'ready',
    versions: [{ number: '1.0.0', name: 'The Road Goes Ever On', level: 'initial', date: '2026-09-25', cost: 14.6, guidance: '', description: 'First full adaptation for an 8-year-old listener.' }],
    currentVersion: '1.0.0',
  },
  {
    id: 'hp1-7', bookId: 'hp1', name: 'Age 7 · Read-aloud · Illustrated', createdAt: '2026-08-16',
    settings: settings(7, 'read-aloud', {}, { on: true, every: 3, style: 'True to the book’s world', look: 'Jim Kay illustrated editions' }),
    sampleGuidance: ['Keep the Dursleys funny-mean, not cruel.'],
    status: 'ready',
    versions: [
      { number: '1.0.0', name: 'The Boy Who Lived', level: 'initial', date: '2026-08-16', cost: 8.3, guidance: '', description: 'First full adaptation for a 7-year-old listener, with 46 illustrations in the Jim Kay style.' },
      { number: '2.0.0', name: 'Warmer Hogwarts', level: 'major', date: '2026-08-30', cost: 6.1, guidance: 'The whole thing reads a bit flat. Bring back more of the author’s humor and wonder throughout.', description: 'A pass through the whole book restoring more original humor, wordplay and sense of wonder, while keeping the same softening.' },
    ],
    currentVersion: '2.0.0',
  },
  {
    id: 'hp2-7', bookId: 'hp2', name: 'Age 7 · Read-aloud · Illustrated', createdAt: '2026-10-17',
    settings: settings(7, 'read-aloud', {}, { on: true, every: 3, style: 'True to the book’s world', look: 'Jim Kay illustrated editions' }),
    sampleGuidance: ['The spiders should match how we did Mirkwood: grumpy, not scary.'],
    status: 'running',
    run: { chapter: 11, of: 18, spent: 5.12, estimate: 8.9, cap: 12 },
    versions: [],
    currentVersion: '',
  },
  {
    id: 'boc1-8', bookId: 'boc1', name: 'Age 8 · Read-aloud', createdAt: '2026-08-01',
    settings: settings(8, 'read-aloud', { notes: 'Big Bi the rooster should stay hilarious.' }),
    sampleGuidance: [],
    status: 'ready',
    versions: [{ number: '1.0.0', name: 'Fa Ram', level: 'initial', date: '2026-08-01', cost: 11.4, guidance: '', description: 'First full adaptation for an 8-year-old listener. Cultivation battles kept light and funny.' }],
    currentVersion: '1.0.0',
  },
  {
    id: 'boc2-8', bookId: 'boc2', name: 'Age 8 · Read-aloud', createdAt: '2026-10-09',
    settings: settings(8, 'read-aloud'),
    sampleGuidance: [],
    status: 'paused-cap',
    run: { chapter: 37, of: 44, spent: 13.9, estimate: 11.8, cap: 14 },
    versions: [],
    currentVersion: '',
  },
  {
    id: 'pj1-9', bookId: 'pj1', name: 'Age 9 · Independent', createdAt: '2026-08-05',
    settings: settings(9, 'independent'),
    sampleGuidance: [],
    status: 'ready',
    versions: [{ number: '1.0.0', name: 'Half-Blood', level: 'initial', date: '2026-08-05', cost: 7.2, guidance: '', description: 'First full adaptation for a 9-year-old reading alone.' }],
    currentVersion: '1.0.0',
  },
  {
    id: 'ender1-11', bookId: 'ender1', name: 'Age 11 · Independent', createdAt: '2026-07-20',
    settings: settings(11, 'independent', { notes: 'Keep the moral weight of the ending; soften the fights in the bathroom and shower.' }),
    sampleGuidance: [],
    status: 'ready',
    versions: [
      { number: '1.0.0', name: 'Battle School', level: 'initial', date: '2026-07-20', cost: 8.7, guidance: '', description: 'First full adaptation for an 11-year-old reading alone.' },
      { number: '1.0.1', name: 'Kinder Words', level: 'patch', date: '2026-07-24', cost: 0.18, guidance: 'A few insults in chapter 3 slipped through.', description: 'Softened leftover insults in chapter 3.' },
    ],
    currentVersion: '1.0.1',
  },
];

// ---------------------------------------------------------------------------
// Reading progress (for the signed-in user)
// ---------------------------------------------------------------------------

export const PROGRESS: Record<string, Progress> = {
  'oz-5': { chapter: 12, percent: 48, updatedAt: '2026-10-16' },
  'hobbit-6': { chapter: 5, percent: 24, updatedAt: '2026-10-14' },
  'hp1-7': { chapter: 9, percent: 51, updatedAt: '2026-10-11' },
  'boc1-8': { chapter: 33, percent: 80, updatedAt: '2026-10-02' },
};

// ---------------------------------------------------------------------------
// Usage (example figures for the prototype)
// ---------------------------------------------------------------------------

export const MONTHLY = [
  { month: 'May', text: 0, images: 0 },
  { month: 'Jun', text: 0, images: 0 },
  { month: 'Jul', text: 14.2, images: 0 },
  { month: 'Aug', text: 31.7, images: 9.8 },
  { month: 'Sep', text: 27.4, images: 12.6 },
  { month: 'Oct', text: 22.9, images: 8.4 },
];

export const RUNS: Run[] = [
  { id: 'r1', date: '2026-10-17', bookId: 'oz', editionId: 'oz-8', type: 'Samples', tokensIn: 41_200, tokensOut: 6_900, images: 0, estimate: 0.35, actual: 0.31 },
  { id: 'r2', date: '2026-10-17', bookId: 'hp2', editionId: 'hp2-7', type: 'Full adaptation', tokensIn: 512_000, tokensOut: 61_000, images: 24, estimate: 8.9, actual: 5.12 },
  { id: 'r3', date: '2026-10-16', bookId: 'hp2', editionId: 'hp2-7', type: 'Visual research', tokensIn: 38_000, tokensOut: 4_100, images: 0, estimate: 0.4, actual: 0.22 },
  { id: 'r4', date: '2026-10-16', bookId: 'eragon', type: 'Analysis', tokensIn: 214_000, tokensOut: 18_400, images: 0, estimate: 1.6, actual: 1.48 },
  { id: 'r5', date: '2026-10-15', bookId: 'oz', editionId: 'oz-5', type: 'Refinement', tokensIn: 84_000, tokensOut: 9_800, images: 2, estimate: 0.7, actual: 0.62 },
  { id: 'r6', date: '2026-10-12', bookId: 'oz', editionId: 'oz-5', type: 'Full adaptation', tokensIn: 268_000, tokensOut: 54_000, images: 41, estimate: 3.6, actual: 3.84 },
  { id: 'r7', date: '2026-10-09', bookId: 'boc2', editionId: 'boc2-8', type: 'Full adaptation', tokensIn: 905_000, tokensOut: 162_000, images: 0, estimate: 11.8, actual: 13.9 },
  { id: 'r8', date: '2026-10-02', bookId: 'hobbit', editionId: 'hobbit-9', type: 'Full adaptation', tokensIn: 620_000, tokensOut: 118_000, images: 0, estimate: 8.1, actual: 7.88 },
  { id: 'r9', date: '2026-09-25', bookId: 'lotr1', editionId: 'lotr1-8', type: 'Full adaptation', tokensIn: 1_210_000, tokensOut: 231_000, images: 0, estimate: 15.2, actual: 14.6 },
  { id: 'r10', date: '2026-09-21', bookId: 'hobbit', editionId: 'hobbit-6', type: 'Refinement', tokensIn: 92_000, tokensOut: 8_200, images: 1, estimate: 0.8, actual: 0.71 },
];

// ---------------------------------------------------------------------------
// Content report (example: real-ish for Oz, generated for the rest)
// ---------------------------------------------------------------------------

const OZ_REPORT: Partial<Record<FilterCategory, Record<number, number>>> = {
  violence: { 5: 1, 6: 1, 9: 2, 12: 3, 13: 1, 14: 2, 19: 1, 21: 2 },
  scariness: { 1: 1, 2: 1, 6: 1, 8: 2, 12: 3, 13: 2, 14: 3, 19: 2, 21: 1 },
  death: { 2: 2, 5: 1, 9: 1, 12: 3, 13: 2, 21: 1 },
  meanness: { 7: 1, 12: 2, 13: 2, 15: 1 },
  mature: { 1: 1, 12: 1, 13: 1, 15: 1 },
  crude: {},
  language: {},
  romance: { 5: 1 },
  substances: {},
};

function seeded(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export function contentReport(book: Book): Record<FilterCategory, number[]> {
  const out = {} as Record<FilterCategory, number[]>;
  const rand = seeded(book.id);
  const weights: Record<FilterCategory, number> = {
    language: 0.15, violence: 0.35, scariness: 0.4, death: 0.15, romance: 0.08, substances: 0.1, mature: 0.2, meanness: 0.2, crude: 0.08,
  };
  for (const c of CATEGORIES) {
    out[c.id] = Array.from({ length: book.chapters }, (_, i) => {
      if (book.id === 'oz') return OZ_REPORT[c.id]?.[i + 1] ?? 0;
      const r = rand();
      const climax = i / book.chapters > 0.75 ? 1.6 : 1;
      if (r > weights[c.id] * climax) return 0;
      return r < weights[c.id] * 0.25 ? 3 : r < weights[c.id] * 0.6 ? 2 : 1;
    });
  }
  return out;
}

export const OZ_BIBLE = {
  characters: [
    { name: 'Dorothy', role: 'Hero', look: 'A Kansas farm girl in a blue-and-white checked gingham dress and silver shoes; braids.', note: 'Brave, practical, kind. Always wants to go home to Aunt Em.' },
    { name: 'Toto', role: 'Companion', look: 'A little black dog with long silky hair and twinkly eyes.', note: 'Present in almost every scene. Never forgotten.' },
    { name: 'The Scarecrow', role: 'Friend', look: 'Straw-stuffed, painted face, floppy blue Munchkin hat.', note: 'Thinks he has no brains; has the best ideas.' },
    { name: 'The Tin Woodman', role: 'Friend', look: 'Jointed tin, funnel hat, carries an axe; needs his oil can.', note: 'Thinks he has no heart; the most tender-hearted of all.' },
    { name: 'The Cowardly Lion', role: 'Friend', look: 'Big shaggy lion with a tangled mane.', note: 'Thinks he has no courage; brave when it counts.' },
    { name: 'The Wicked Witch of the West', role: 'Villain', look: 'One far-seeing eye, a silver whistle, the Golden Cap.', note: 'Softened editions: grumpy and bossy, still clearly the villain.' },
  ],
  places: ['Kansas farm', 'Munchkin Country', 'The yellow brick road', 'The Emerald City', 'Country of the Winkies', 'Quadling Country'],
  threads: ['Dorothy wants to go home', 'Each friend seeks what they already have', 'The Wizard isn’t what he seems', 'The silver shoes’ hidden power'],
  themes: ['Home and belonging', 'Friendship', 'You already have what you need', 'Courage, kindness and cleverness'],
};
