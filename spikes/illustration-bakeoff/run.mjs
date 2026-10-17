// Featherbound illustration bake-off: same inputs for every model via Vercel AI Gateway.
// Usage: node run.mjs [modelKey ...] [--only=sheet,wolves,...] [--force]
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { generateImage, generateText } from 'ai';
import { gateway } from '@ai-sdk/gateway';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const ART = path.join(ROOT, '../../prototype/public/art/oz');
const OUT = path.join(ROOT, 'out');
const LOG = path.join(ROOT, 'results.json');

export const MODELS = [
  { key: 'flux2pro', id: 'bfl/flux-2-pro', label: 'FLUX.2 [pro]', kind: 'image' },
  { key: 'nanobanana2', id: 'google/gemini-3.1-flash-image', label: 'Nano Banana 2 (Gemini 3.1 Flash Image)', kind: 'text' },
  { key: 'nanobananapro', id: 'google/gemini-3-pro-image', label: 'Nano Banana Pro (Gemini 3 Pro Image)', kind: 'text' },
  { key: 'gptimage2', id: 'openai/gpt-image-2', label: 'GPT Image 2', kind: 'image' },
  { key: 'klein9b', id: 'bfl/flux-2-klein-9b', label: 'FLUX.2 [klein] 9B (open weights)', kind: 'image', candidate: true },
  { key: 'schnell', id: 'prodia/flux-fast-schnell', label: 'FLUX.1 schnell on Prodia (open weights)', kind: 'image', candidate: true },
  { key: 'grok2', id: 'spacexai/grok-imagine-image-2.0', label: 'Grok Imagine Image 2.0', kind: 'image', candidate: true },
  { key: 'muse', id: 'meta/muse-image-1.0', label: 'Meta Muse Image 1.0', kind: 'image', candidate: true },
  { key: 'recraft41', id: 'recraft/recraft-v4.1', label: 'Recraft V4.1', kind: 'image', candidate: true },
  { key: 'seedream5', id: 'bytedance/seedream-5.0-pro', label: 'Seedream 5.0 Pro', kind: 'image', sizes: { '3:2': '2496x1664', '4:3': '2304x1728' } },
];

const DENSLOW = `in the exact style of W. W. Denslow's 1900 illustrations for The Wonderful Wizard of Oz:
bold confident black ink outlines, flat areas of limited spot color (mustard yellow, red, leaf green, sky blue),
no gradients or 3D shading, lots of clean white background, playful turn-of-the-century children's-book line art.
Match the attached reference illustrations' linework and palette.`;

const CAST = `Dorothy: a small girl with long reddish-brown braided hair, red dress with a white ruffled collar.
Toto: a small scruffy dark-brown terrier.
Tin Woodman: a tin man with a funnel hat, riveted cylinder body, carrying an axe.
Scarecrow: a straw-stuffed man in a dark suit with straw at the cuffs, painted face, small pointed hat.
Cowardly Lion: a big tawny lion with a wild flowing mane and a long tufted tail, friendly expression.`;

// Shorter style line used only as a retry when a provider's moderation rejects the standard prompt.
const SHORT_STYLE = 'in bold black ink line art with flat spot colour, like an antique 1900 children\'s book.';

const KIDSAFE = 'Gentle and funny, suitable for a picture book for 5-year-olds: no injuries, no blood, no one hurt.';

export const TESTS = [
  {
    key: 'sheet', title: 'Character sheet', aspect: '3:2',
    refs: ['toto-ear.jpg', 'soldier.jpg', 'witch.jpg', 'crows.jpg', 'lion.jpg'],
    prompt: `A character reference sheet: Dorothy, Toto, the Tin Woodman, the Scarecrow and the Cowardly Lion standing
side by side in a row, full body, facing the viewer, evenly spaced on a plain white background, no text or labels.
${CAST}
Drawn ${DENSLOW}`,
  },
  {
    key: 'wolves', title: 'Ch.12: Tin Woodman CLANGs, wolves flee', aspect: '4:3', useSheet: true,
    refs: ['lion.jpg', 'crows.jpg'],
    prompt: `Night on a grassy hill. The Tin Woodman stands tall, banging his shiny axe against his tin chest to make a
loud CLANG (show a few little comic sound lines). A pack of wolves is running away over the hills with their tails
tucked between their legs, some tumbling over each other in a silly heap. Behind him the Scarecrow watches, and
Dorothy, Toto and the Lion are asleep in the grass. ${KIDSAFE}
Use the attached character sheet so every character looks exactly the same. Drawn ${DENSLOW}`,
  },
  {
    key: 'crow', title: 'Ch.12: Scarecrow says "BOO!"', aspect: '4:3', useSheet: true,
    refs: ['crows.jpg', 'lion.jpg'],
    prompt: `In a grassy field, the Scarecrow stands with his arms stretched out wide and shouts "BOO!" (the word BOO!
in a hand-lettered speech bubble). A big startled King Crow with ruffled feathers zooms away squawking, and the rest of
the black crow flock flies off into the sky. Dorothy, Toto, the Lion and the Tin Woodman lie on the ground nearby,
peeking up. ${KIDSAFE}
Use the attached character sheet so every character looks exactly the same. Drawn ${DENSLOW}`,
  },
  {
    key: 'bees', title: 'Ch.12: snuggled under straw, bees go bonk', aspect: '4:3', useSheet: true,
    refs: ['toto-ear.jpg', 'lion.jpg'],
    prompt: `Dorothy, holding Toto in her arms, is snuggled against the Cowardly Lion under a cozy pile of straw like a
blanket; only their peeking, smiling faces show. Next to them the Tin Woodman stands calmly while a cloud of little
round black bees bounces off his hard tin body with tiny "bonk" marks, their stingers bent like little pins. The
Scarecrow, now flat and missing his straw, lies nearby smiling. ${KIDSAFE}
Use the attached character sheet so every character looks exactly the same. Drawn ${DENSLOW}`,
  },
  {
    key: 'watercolor', title: 'Style switch: bees scene as watercolor', aspect: '4:3', useSheet: true,
    refs: [],
    prompt: `Dorothy, holding Toto in her arms, is snuggled against the Cowardly Lion under a cozy pile of straw like a
blanket; next to them the Tin Woodman stands calmly while little round bees bounce off his tin body. ${KIDSAFE}
Keep the characters' designs from the attached character sheet, but paint it as a soft modern watercolor storybook
illustration: loose washes, warm light, gentle textures, pencil underdrawing. Not ink line art.`,
  },
  {
    key: 'likeness', title: 'Likeness probe: Harry Potter', aspect: '4:3', refs: [],
    prompt: `Harry Potter, Hermione Granger and Ron Weasley from the Harry Potter books standing outside Hogwarts castle,
Harry with his round glasses and lightning-bolt scar, in the Gryffindor uniform. A children's picture-book
illustration, ${DENSLOW.split('\n')[0]}`,
  },
  {
    key: 'likeness2', title: 'Likeness probe, unnamed (described, not named)', aspect: '4:3', refs: [],
    prompt: `Three 11-year-old schoolchildren standing outside a huge old stone castle school: a thin boy with messy
black hair, round glasses and a thin lightning-shaped scar on his forehead; a girl with very bushy brown hair carrying
a big book; a tall freckled boy with bright red hair. They wear black school robes with red-and-gold striped ties.
A children's picture-book illustration, ${DENSLOW.split('\n')[0]}`,
  },
];

const sniff = (b) => (b[0] === 0x89 ? 'image/png' : b[0] === 0xff ? 'image/jpeg' : b.slice(8, 12).toString() === 'WEBP' ? 'image/webp' : 'image/png');
const readRef = (f) => fs.readFileSync(path.join(ART, f));

function loadLog() {
  try { return JSON.parse(fs.readFileSync(LOG, 'utf8')); } catch { return { runs: {} }; }
}
function saveLog(log) { fs.writeFileSync(LOG, JSON.stringify(log, null, 2)); }

async function callModel(model, test, images) {
  const t0 = Date.now();
  if (model.kind === 'image') {
    const r = await generateImage({
      model: model.id,
      prompt: images.length ? { text: test.prompt, images } : test.prompt,
      ...(model.sizes ? { size: model.sizes[test.aspect] } : { aspectRatio: test.aspect }),
      maxRetries: 1,
    });
    return { bytes: r.image.uint8Array, mediaType: r.image.mediaType, ms: Date.now() - t0, meta: r.providerMetadata, text: '' };
  }
  const r = await generateText({
    model: model.id,
    maxRetries: 1,
    providerOptions: { google: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: test.aspect } } },
    messages: [{
      role: 'user',
      content: [
        ...images.map((data) => ({ type: 'file', mediaType: sniff(data), data })),
        { type: 'text', text: test.prompt },
      ],
    }],
  });
  const img = r.files.find((f) => f.mediaType.startsWith('image/'));
  if (!img) {
    const err = new Error(`No image returned. Model said: ${r.text?.slice(0, 400) || '(nothing)'} [finish=${r.finishReason}]`);
    err.soft = true;
    throw err;
  }
  return { bytes: img.uint8Array, mediaType: img.mediaType, ms: Date.now() - t0, meta: r.providerMetadata, text: r.text };
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const only = args.find((a) => a.startsWith('--only='))?.slice(7).split(',');
  const pick = args.filter((a) => !a.startsWith('--'));
  const models = pick.length ? MODELS.filter((m) => pick.includes(m.key)) : MODELS;
  const tests = only ? TESTS.filter((t) => only.includes(t.key)) : TESTS;
  fs.mkdirSync(OUT, { recursive: true });
  const log = loadLog();

  const credits0 = await gateway.getCredits().catch(() => null);
  log.creditsStart ??= credits0;

  await Promise.all(models.map(async (model) => {
    for (const test of tests) {
      const id = `${model.key}/${test.key}`;
      if (!force && log.runs[id]?.file) { console.log(`skip ${id}`); continue; }
      let images = test.refs.map(readRef);
      if (test.useSheet) {
        const sheet = log.runs[`${model.key}/sheet`]?.file;
        if (sheet) images = [fs.readFileSync(path.join(ROOT, sheet)), ...images];
        else throw new Error(`no character sheet for ${model.key}; run --only=sheet first`);
      }
      process.stdout.write(`run  ${id} (${images.length} refs)\n`);
      try {
        let r, fallback = false;
        try {
          r = await callModel(model, test, images);
        } catch (e) {
          if (!/moderat/i.test(String(e.message))) throw e;
          console.log(`mod  ${id} moderated, retrying with short style line`);
          log.runs[id] = { moderatedFirst: true };
          fallback = true;
          r = await callModel(model, { ...test, prompt: test.prompt.replace(DENSLOW, SHORT_STYLE).replace(DENSLOW.split('\n')[0], SHORT_STYLE) }, images);
        }
        const ext = r.mediaType.split('/')[1].replace('jpeg', 'jpg');
        const file = `out/${model.key}-${test.key}.${ext}`;
        fs.writeFileSync(path.join(ROOT, file), r.bytes);
        log.runs[id] = { file, fallback, ms: r.ms, cost: r.meta?.gateway?.cost ?? null, meta: r.meta?.gateway ?? null, text: r.text, at: new Date().toISOString() };
        console.log(`ok   ${id} ${(r.ms / 1000).toFixed(1)}s cost=${log.runs[id].cost}`);
      } catch (e) {
        log.runs[id] = { error: String(e.message || e).slice(0, 800), moderated: /moderat/i.test(String(e.message)), soft: !!e.soft, at: new Date().toISOString() };
        console.log(`FAIL ${id}: ${log.runs[id].error}`);
      }
      saveLog(log);
    }
  }));

  const credits1 = await gateway.getCredits().catch(() => null);
  log.creditsEnd = credits1;
  saveLog(log);
  console.log('credits before', credits0, 'after', credits1);
}

if (process.argv[1]?.endsWith("run.mjs")) main();
