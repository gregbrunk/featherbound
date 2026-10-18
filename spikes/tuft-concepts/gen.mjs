// Tuft concept art: one image per (direction, model). Usage: node gen.mjs [direction-id...]
import dotenv from 'dotenv';
import fs from 'node:fs';
import { generateImage, generateText } from 'ai';
dotenv.config({ path: '/Users/greg/Documents/featherbound/spikes/illustration-bakeoff/.env' });

const BASE = `Mascot character design for "Featherbound", a cozy enchanted-library reading app. The mascot is Tuft: a tiny, round, impossibly fluffy white long-tailed tit (shima enaga, the Japanese "snow fairy" bird) wearing a purple wizard hat that is much too big for him. He must read unmistakably as a BIRD: a tiny dark triangular beak, small round black eyes with a highlight, soft pink cheek blush, short feathered wings tucked against his sides (clearly wings with feather tips, never ear-like), two little tan bird feet, and his species' signature long slender tail feathers in soft grey and black fanning out behind him. The wizard hat is deep plum-to-violet with a few small gold stars, a gold band, a single clean pointed tip that flops gently to one side (no extra pieces, no pom-pom). Front three-quarter view, full body, centered, plain flat cream background (#FBF4E4), no text, no frame.`;

const DIRECTIONS = {
  flat: `${BASE} Style: polished flat vector mascot illustration, like a premium app icon character — clean geometric shapes, smooth gradients, crisp edges, limited palette of white, lavender-grey, plum, gold and blush pink, subtle soft shading only. Designed to be rebuilt as layered SVG.`,
  soft3d: `${BASE} Style: soft, rounded 3D-ish clay/vinyl toy render with gentle studio lighting, velvety feather texture, very cute and premium.`,
  storybook: `${BASE} Style: warm gouache-and-colored-pencil children's picture book illustration, visible soft feather texture, hand-drawn charm.`,
  sheet: `${BASE} Style: polished flat vector mascot illustration with clean shapes and soft gradients. Lay out a character expression sheet: six small poses of the same Tuft in a 3x2 grid — waving one wing, reading an open book, writing with a quill, sleeping with closed eyes, cheering with both wings up, thinking with a curious head tilt. Same design in every pose.`,
};
const MODELS = [
  { id: 'openai/gpt-image-2', slug: 'gpt', api: 'image' },
  { id: 'google/gemini-3.1-flash-image', slug: 'nano', api: 'text' },
];

const want = process.argv.slice(2);
const jobs = Object.entries(DIRECTIONS).filter(([k]) => !want.length || want.includes(k)).flatMap(([k, prompt]) => MODELS.map((m) => ({ k, prompt, m })));
await Promise.all(jobs.map(async ({ k, prompt, m }) => {
  const name = `${k}-${m.slug}`;
  const aspect = k === 'sheet' ? '3:2' : '1:1';
  try {
    let bytes, type;
    if (m.api === 'image') {
      const r = await generateImage({ model: m.id, prompt, aspectRatio: aspect, maxRetries: 1 });
      bytes = r.image.uint8Array; type = r.image.mediaType;
    } else {
      const r = await generateText({ model: m.id, maxRetries: 1, providerOptions: { google: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: aspect } } }, prompt });
      const f = r.files.find((x) => x.mediaType.startsWith('image/'));
      if (!f) throw new Error('no image: ' + r.text.slice(0, 120));
      bytes = f.uint8Array; type = f.mediaType;
    }
    fs.writeFileSync(`out/${name}.${type.split('/')[1]}`, bytes);
    console.log(name, 'OK');
  } catch (e) { console.log(name, 'FAIL', String(e.message).slice(0, 200)); }
}));
