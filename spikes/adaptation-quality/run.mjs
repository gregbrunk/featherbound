// Adaptation quality spike: Claude Opus 5.5 adapts two public-domain Oz chapters at three
// settings. Writes results.json and a side-by-side index.html for review.
import { generateText, Output } from 'ai';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { z } from 'zod';
import { systemPrompt, userPrompt } from './prompt.mjs';

const MODEL = 'anthropic/claude-opus-5.5';
const PRICE = { in: 4, out: 20 }; // $ per million tokens

// Original text, straight from the prototype's data file.
const src = readFileSync('../../prototype/src/data/ozOriginal.ts', 'utf8');
const ORIGINAL = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf(';')));
const TITLES = { 1: 'The Cyclone', 12: 'The Search for the Wicked Witch' };

const BIBLE = `Characters: Dorothy (brave, practical Kansas farm girl), Toto (her little black dog, in nearly every scene), the Scarecrow (thinks he has no brains; has the best ideas), the Tin Woodman (thinks he has no heart; the most tender), the Cowardly Lion (thinks he lacks courage; brave when it counts), the Wicked Witch of the West (one far-seeing eye, a silver whistle, the Golden Cap; the villain), Aunt Em and Uncle Henry.
Threads: Dorothy wants to go home; each friend seeks what they already have; Oz sent them to stop the Witch.
Themes: home, friendship, you already have what you need.`;

const SETTINGS = {
  'age5-readaloud': {
    targetAge: 5, readingMode: 'read-aloud', faithfulness: 30,
    filters: { language: 'remove', violence: 'remove', scariness: 'soften', death: 'remove', romance: 'remove', substances: 'remove', mature: 'remove', meanness: 'soften', crude: 'keep' },
    notes: 'Keep Toto in every scene he’s in. Keep the Scarecrow, Tin Woodman and Lion funny. Make the scary bits bedtime-safe.',
  },
  'age8-independent': {
    targetAge: 8, readingMode: 'independent', faithfulness: 30,
    filters: { language: 'remove', violence: 'soften', scariness: 'soften', death: 'soften', romance: 'soften', substances: 'remove', mature: 'soften', meanness: 'soften', crude: 'keep' },
    notes: 'He’s reading this one by himself. Keep the adventure exciting.',
  },
  'age11-independent': {
    targetAge: 11, readingMode: 'independent', faithfulness: 20,
    filters: { language: 'soften', violence: 'soften', scariness: 'keep', death: 'soften', romance: 'soften', substances: 'soften', mature: 'soften', meanness: 'keep', crude: 'keep' },
    notes: '',
  },
};

const schema = z.object({
  paragraphs: z.array(z.string()).describe('Adapted paragraphs, one per original paragraph, same order.'),
  changeNotes: z.array(z.object({
    category: z.string(),
    level: z.enum(['Soften', 'Remove', 'Reading level']),
    note: z.string(),
  })),
});

const results = existsSync('results.json') ? JSON.parse(readFileSync('results.json', 'utf8')) : {};
const only = process.argv[2];

for (const [key, settings] of Object.entries(SETTINGS)) {
  if (only && key !== only) continue;
  for (const ch of [1, 12]) {
    const id = `${key}-ch${ch}`;
    if (results[id] && !process.argv.includes('--force')) { console.log(`skip ${id}`); continue; }
    const t0 = Date.now();
    process.stdout.write(`${id} … `);
    try {
      const res = await generateText({
        model: MODEL,
        system: systemPrompt(),
        prompt: userPrompt({ settings, bible: BIBLE, chapterTitle: TITLES[ch], paragraphs: ORIGINAL[ch] }),
        output: Output.object({ schema }),
        reasoning: 'high',
        maxOutputTokens: 32000,
      });
      const u = res.usage;
      const cost = ((u.inputTokens ?? 0) * PRICE.in + (u.outputTokens ?? 0) * PRICE.out) / 1e6;
      results[id] = {
        settings: key, chapter: ch, seconds: (Date.now() - t0) / 1000,
        inputTokens: u.inputTokens, outputTokens: u.outputTokens, cost,
        paragraphCountOk: res.output.paragraphs.length === ORIGINAL[ch].length,
        ...res.output,
      };
      console.log(`${results[id].seconds.toFixed(0)}s, $${cost.toFixed(3)}, ${res.output.paragraphs.length}/${ORIGINAL[ch].length} paragraphs`);
    } catch (e) {
      results[id] = { settings: key, chapter: ch, error: String(e?.message ?? e) };
      console.log(`ERROR ${results[id].error.slice(0, 200)}`);
    }
    writeFileSync('results.json', JSON.stringify(results, null, 2));
  }
}

// ---------- Side-by-side review page ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const total = Object.values(results).reduce((n, r) => n + (r.cost ?? 0), 0);
let body = '';
for (const key of Object.keys(SETTINGS)) {
  for (const ch of [1, 12]) {
    const r = results[`${key}-ch${ch}`];
    if (!r) continue;
    body += `<section><h2>${esc(key)} · Chapter ${ch}: ${esc(TITLES[ch])}</h2>`;
    if (r.error) { body += `<p class="err">${esc(r.error)}</p></section>`; continue; }
    body += `<p class="meta">${r.seconds.toFixed(0)}s · ${r.inputTokens} in / ${r.outputTokens} out tokens · $${r.cost.toFixed(3)} · paragraphs ${r.paragraphCountOk ? 'aligned ✓' : 'NOT aligned ✗'}</p>`;
    body += `<details open><summary>Change notes (${r.changeNotes.length})</summary><ul>${r.changeNotes.map((n) => `<li><b>${esc(n.level)}</b> · ${esc(n.category)}: ${esc(n.note)}</li>`).join('')}</ul></details>`;
    body += '<table><tr><th>Original</th><th>Adapted</th></tr>';
    ORIGINAL[ch].forEach((p, i) => { body += `<tr><td>${esc(p)}</td><td>${esc(r.paragraphs[i] ?? '')}</td></tr>`; });
    body += '</table></section>';
  }
}
writeFileSync('index.html', `<!doctype html><meta charset="utf-8"><title>Adaptation quality spike</title>
<style>body{font:15px/1.55 Georgia,serif;max-width:1200px;margin:24px auto;padding:0 16px;color:#2b2140;background:#fbf4e4}
h1,h2{font-family:system-ui;}.meta{font:13px system-ui;color:#6d6479}td{vertical-align:top;padding:8px 12px;border-top:1px solid #e6dcc4;width:50%}
td:first-child{color:#6d6479}th{text-align:left;font:13px system-ui}section{margin:36px 0;background:#fffdf7;padding:16px 20px;border-radius:14px}
li{font:14px system-ui;margin:4px 0}.err{color:#b23a52}</style>
<h1>Adaptation quality spike</h1><p class="meta">Model ${MODEL} · reasoning high · total $${total.toFixed(2)}</p>${body}`);
console.log(`Total $${total.toFixed(2)} · wrote index.html`);
