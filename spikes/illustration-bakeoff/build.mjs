// Builds index.html from results.json + the hand-written scores below. Run: node build.mjs
import fs from 'node:fs';
import { MODELS, TESTS } from './run.mjs';

const runs = JSON.parse(fs.readFileSync('results.json', 'utf8')).runs;

// Scores are 1–5, judged by eye from the images in out/.
const SCORES = {
  gptimage2: {
    style: 5, consistency: 5, softened: 5, quality: 5,
    verdict: 'Recommended default',
    notes: 'Closest to Denslow by a wide margin: white grounds, flat spot colour, yellow-toned faces and the Lion\'s forelock curl taken straight from the references. Characters match the sheet exactly in every scene. Funny, gentle staging (tumbling wolves, BONK! bees with bent pins). Clean switch to watercolor. Refused Harry Potter both when named and when only described.',
  },
  nanobanana2: {
    style: 4, consistency: 4, softened: 5, quality: 4,
    verdict: 'Fallback (and the copyrighted-book route)',
    notes: 'Good ink-and-flat-colour look, though more modern-comic than Denslow. Keeps its own sheet details (heart on the chest, bow tie, green axe handle) across scenes. Fast and cheap. Problem: it forges Denslow\'s signature ("W. W. Denslow", his seahorse mark, "S DEN" monogram) into images. A prompt line like "no signatures" plus a check are needed. Drew Harry Potter without complaint.',
  },
  nanobananapro: {
    style: 3, consistency: 2, softened: 4, quality: 4,
    verdict: 'Not worth 2× the price',
    notes: 'Well drawn, but the characters drift: the Scarecrow changes outfit in every scene, and in the bees scene it slid toward the 1939 film look (blue gingham, black Toto, green-maned Lion). The wolves snarl and the axe is raised overhead: a bit much for 5-year-olds. Most expensive model. Drew Harry Potter.',
  },
  seedream5: {
    style: 2, consistency: 4, softened: 5, quality: 4,
    verdict: 'Cheap but off-style and slow',
    notes: 'Consistent characters and cheapest per image, but rendered and shaded (metallic Tin Woodman, painterly skies) rather than Denslow line art. About 2 minutes per image. Stamped a visible "AI generated" watermark on at least the crow scene. Refused Harry Potter, named or described, citing copyright.',
  },
  grok2: {
    style: 3, consistency: 4, softened: 4, quality: 4,
    verdict: 'Fallback 2: the loose-filter last resort',
    notes: 'Added after the first round as a "least likely to refuse" option. It drew all 7 tests, including Harry Potter both named and described, with no forged signatures or watermarks. Clean modern ink with flat colour: storybook-good, but less Denslow than GPT Image 2. Characters stay consistent with its sheet. About $0.08 and 13s per image.',
  },
  klein9b: {
    style: 2, consistency: null, softened: null, quality: 2,
    verdict: 'Not viable via the gateway',
    notes: 'Cheap open-weights FLUX ($0.02–0.03), but hosted by BFL with the same filter as FLUX.2 pro, which moderated every Oz scene and both Harry Potter tests. Only the sheet (on retry) and the watercolor got through. Open weights mean it could be self-hosted without the filter later. Also tried and dropped: FLUX.1 schnell on Prodia and Recraft V4.1 (no reference images, so no character consistency) and Meta Muse (failed on the account’s zero-data-retention setting).',
  },
  flux2pro: {
    style: 2, consistency: null, softened: null, quality: 2,
    verdict: 'Not viable via the gateway',
    notes: 'BFL\'s moderation rejected the character sheet and all three Oz scenes, even after retrying with a shorter style line. The sheet only succeeded on the retry, and it added a sixth, made-up character. It ignores the requested aspect ratio. Interestingly, it drew the described (unnamed) Harry Potter trio but moderated the named version. Self-hosted FLUX would avoid the hosted filter, but that is a separate spike.',
  },
};

// Images are embedded as data URIs so the page works in viewers that block relative file loads.
const dataUri = (p) => `data:image/jpeg;base64,${fs.readFileSync(p).toString('base64')}`;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const stars = (n) => (n == null ? '<span class="na">n/a</span>' : `<span class="score s${n}">${n}/5</span>`);

function cell(model, test) {
  const r = runs[`${model.key}/${test.key}`];
  if (!r) return '<td class="empty">not run</td>';
  if (!r.file) {
    const why = /copyright/i.test(r.error) ? 'Refused: copyright'
      : /safety system/i.test(r.error) ? 'Refused: safety system'
      : /moderat/i.test(r.error) ? 'Moderated'
      : 'Error';
    return `<td class="fail"><div class="refusal"><strong>${why}</strong><small>${esc(r.error.replace(/Request id:.*|request ID \S+/i, '').slice(0, 220))}</small></div></td>`;
  }
  const web = `web/${r.file.split('/')[1].replace(/\.\w+$/, '.jpg')}`;
  // Pictures of in-copyright characters (the likeness probes) aren't kept; show that they drew it.
  if (!fs.existsSync(web)) return `<td class="fail"><div class="refusal"><strong>Drew it</strong><small>Picture not kept: it shows in-copyright characters.</small></div></td>`;
  const flags = [r.fallback && '<span class="flag">retried with shorter style line after moderation</span>'].filter(Boolean).join('');
  return `<td><img class="zoom" src="${dataUri(web)}" alt=""${esc(model.label)}: ${esc(test.title)}">
    <div class="meta">${(r.ms / 1000).toFixed(0)}s · $${Number(r.cost ?? 0).toFixed(3)}</div>${flags}</td>`;
}

function modelStats(m) {
  const all = Object.entries(runs).filter(([k]) => k.startsWith(m.key + '/')).map(([, v]) => v);
  const ok = all.filter((v) => v.file);
  const cost = ok.reduce((a, v) => a + Number(v.cost ?? 0), 0);
  const ms = ok.map((v) => v.ms).sort((a, b) => a - b);
  return { ok: ok.length, total: all.length, avg: ok.length ? cost / ok.length : 0, median: ms.length ? ms[Math.floor(ms.length / 2)] / 1000 : 0 };
}

const order = ['gptimage2', 'nanobanana2', 'grok2', 'nanobananapro', 'seedream5', 'flux2pro', 'klein9b'];
const models = order.map((k) => MODELS.find((m) => m.key === k));

const rows = models.map((m) => {
  const s = SCORES[m.key], st = modelStats(m);
  return `<tr>
  <th class="model">
    <h2>${esc(m.label)}</h2><code>${m.id}</code>
    <p class="verdict">${esc(s.verdict)}</p>
    <dl>
      <dt>Denslow style</dt><dd>${stars(s.style)}</dd>
      <dt>Consistency</dt><dd>${stars(s.consistency)}</dd>
      <dt>Softened content</dt><dd>${stars(s.softened)}</dd>
      <dt>Overall quality</dt><dd>${stars(s.quality)}</dd>
      <dt>Avg cost / image</dt><dd>$${st.avg.toFixed(3)}</dd>
      <dt>Median time</dt><dd>${st.median.toFixed(0)}s</dd>
      <dt>Succeeded</dt><dd>${st.ok} / ${st.total}</dd>
    </dl>
    <p class="notes">${esc(s.notes)}</p>
  </th>
  ${TESTS.map((t) => cell(m, t)).join('\n  ')}
</tr>`;
}).join('\n');

const total = Object.values(runs).reduce((a, v) => a + Number(v.cost ?? 0), 0);

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Illustration Bake-off</title>
<style>
:root{--bg:#faf8f3;--fg:#1d1b17;--muted:#6b665c;--card:#fff;--line:#e4dfd3;--accent:#8a5a00;--bad:#a3261b;--badbg:#fbeceb;--good:#2f6b2f}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#17150f;--fg:#eee9dd;--muted:#a59f90;--card:#211e17;--line:#38332a;--accent:#e0b04f;--bad:#ff8a7d;--badbg:#3a1d19;--good:#8fd18f}}
:root[data-theme="dark"]{--bg:#17150f;--fg:#eee9dd;--muted:#a59f90;--card:#211e17;--line:#38332a;--accent:#e0b04f;--bad:#ff8a7d;--badbg:#3a1d19;--good:#8fd18f}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
header{max-width:1100px;margin:0 auto;padding:32px 16px 8px}
h1{font-size:28px;margin:0 0 8px}
header p{color:var(--muted);margin:4px 0;max-width:75ch}
.refs{display:flex;gap:8px;margin:16px 0;flex-wrap:wrap}
.refs img{height:84px;border:1px solid var(--line);border-radius:4px;background:#fff}
.wrap{overflow-x:auto;padding:0 16px 48px}
table{border-collapse:separate;border-spacing:0;margin:0 auto}
thead th{position:sticky;top:0;background:var(--bg);z-index:2;text-align:left;font-size:13px;color:var(--muted);padding:8px;border-bottom:1px solid var(--line);min-width:280px}
thead th:first-child{left:0;z-index:3}
td,th.model{vertical-align:top;padding:12px 8px;border-bottom:1px solid var(--line)}
th.model{position:sticky;left:0;background:var(--bg);z-index:1;text-align:left;font-weight:normal;width:300px;min-width:300px}
th.model h2{font-size:17px;margin:0}
th.model code{font-size:12px;color:var(--muted)}
.verdict{font-weight:600;color:var(--accent);margin:6px 0}
dl{display:grid;grid-template-columns:auto auto;gap:2px 12px;margin:8px 0;font-size:13px}
dt{color:var(--muted)}dd{margin:0}
.notes{font-size:13px;margin:8px 0 0;color:var(--fg)}
.score{font-weight:600}.s5,.s4{color:var(--good)}.s1,.s2{color:var(--bad)}.na{color:var(--muted)}
td{width:300px;min-width:300px}
td img{width:100%;display:block;border-radius:4px;border:1px solid var(--line);background:#fff}
.meta{font-size:12px;color:var(--muted);margin-top:4px}
.flag{display:inline-block;font-size:11px;background:var(--badbg);color:var(--bad);border-radius:3px;padding:1px 6px;margin-top:4px}
td.fail .refusal{background:var(--badbg);color:var(--bad);border-radius:6px;padding:12px;min-height:120px}
td.fail small{display:block;color:var(--muted);margin-top:6px;font-size:12px;word-break:break-word}
.summary{max-width:1100px;margin:0 auto;padding:0 16px 16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
.summary div{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px}
.summary b{display:block;font-size:13px;color:var(--muted);font-weight:500}
td img.zoom{cursor:zoom-in}
#lb{position:fixed;inset:0;background:rgba(0,0,0,.85);display:none;align-items:center;justify-content:center;z-index:10;cursor:zoom-out;padding:16px}
#lb.on{display:flex}#lb img{max-width:100%;max-height:100%;border-radius:4px;background:#fff}
</style></head><body>
<header>
  <h1>Featherbound illustration bake-off</h1>
  <p>Every model received the same prompts and the same public-domain W. W. Denslow references. Scenes 2–4 also received that model's own character sheet as a reference. The scenes come from the softened chapter 12 of <em>The Wonderful Wizard of Oz</em>. All runs went through Vercel AI Gateway on ${new Date(Object.values(runs)[0].at).toLocaleDateString('en-US', { dateStyle: 'medium' })}. Click any image to enlarge it. Full-resolution originals are in <code>out/</code>.</p>
  <div class="refs">${['toto-ear', 'soldier', 'witch', 'crows', 'lion'].map((f) => `<img src="${dataUri(`web/refs/${f}.jpg`)}" alt="Denslow reference ${f}">`).join('')}</div>
</header>
<section class="summary">
  <div><b>Recommended default</b>GPT Image 2: best Denslow match and consistency, ~$0.05/image</div>
  <div><b>Fallback 1</b>Nano Banana 2: close second, faster, draws copyrighted characters (strip forged signatures)</div>
  <div><b>Fallback 2</b>Grok Imagine 2.0: loosest filters, drew everything including Harry Potter, ~$0.08/image</div>
  <div><b>Spend</b>$${total.toFixed(2)} on the images shown; $2.72 total on the gateway, including moderation probes and the second round</div>
  <div><b>Refusals</b>GPT Image 2 and Seedream refused Harry Potter even when the characters were only described. Grok and both Nano Bananas drew it. FLUX moderated the Oz scenes.</div>
</section>
<div class="wrap"><table>
<thead><tr><th>Model</th>${TESTS.map((t) => `<th>${esc(t.title)}</th>`).join('')}</tr></thead>
<tbody>
${rows}
</tbody></table></div>
<div id="lb"><img alt=""></div>
<script>
const lb=document.getElementById('lb'),li=lb.querySelector('img');
document.addEventListener('click',e=>{if(e.target.classList.contains('zoom')){li.src=e.target.src;li.alt=e.target.alt;lb.classList.add('on')}else if(lb.contains(e.target))lb.classList.remove('on')});
document.addEventListener('keydown',e=>{if(e.key==='Escape')lb.classList.remove('on')});
</script>
</body></html>`;

fs.writeFileSync('index.html', html);
console.log('wrote index.html');
