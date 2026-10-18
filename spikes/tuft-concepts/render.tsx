// Renders every pose of the old and new Tuft to static SVG for the review page.
import fs from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Tuft from '../../web/src/components/Tuft';
import TuftOld from './TuftOld';
const poses = ['hello', 'wave', 'read', 'write', 'cheer', 'sleep', 'think', 'worry', 'guard'] as const;
const out: Record<string, Record<string, string>> = { old: {}, new: {} };
for (const p of poses) {
  out.old[p] = renderToStaticMarkup(createElement(TuftOld, { pose: p, size: 160 })).replaceAll('id="tuft', 'id="old-tuft').replaceAll('url(#tuft', 'url(#old-tuft');
  out.new[p] = renderToStaticMarkup(createElement(Tuft, { pose: p, size: 160 })).replaceAll('id="tuft', `id="${p}-tuft`).replaceAll('url(#tuft', `url(#${p}-tuft`);
}
fs.writeFileSync('svgs.json', JSON.stringify(out));
console.log('ok');
