import 'dotenv/config';
import fs from 'node:fs';
import { generateImage } from 'ai';
import { TESTS } from './run.mjs';
const sheet = { prompt: process.env.PROMPT || TESTS[0].prompt };
const ART = '../../prototype/public/art/oz/';
const [model, name, ...refs] = process.argv.slice(2);
const t0 = Date.now();
try {
  const r = await generateImage({ model, maxRetries: 0, aspectRatio: '3:2',
    prompt: refs.length ? { text: sheet.prompt, images: refs.map(f => fs.readFileSync(ART + f)) } : sheet.prompt });
  fs.writeFileSync(`probe/${name}.${r.image.mediaType.split('/')[1]}`, r.image.uint8Array);
  console.log(name, 'OK', ((Date.now()-t0)/1000).toFixed(0)+'s', JSON.stringify(r.providerMetadata?.gateway?.cost ?? ''));
} catch (e) { console.log(name, 'FAIL', String(e.message).slice(0, 200)); }
