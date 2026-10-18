// Word-level differences between an original paragraph and its adaptation, for highlighting
// what changed. Paragraphs are aligned one-to-one by the adaptation rules, so each pair is
// diffed on its own: a longest-common-subsequence over word and punctuation tokens.

export type Seg = { text: string; changed: boolean };

const TOKEN = /\s+|[\p{L}\p{N}’'-]+|[^\s\p{L}\p{N}]/gu;

/** Plain text of a stored paragraph (inline tags dropped, common entities decoded). */
export function plainText(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, '’');
}

function merge(segs: Seg[]): Seg[] {
  const out: Seg[] = [];
  for (const s of segs) {
    if (!s.text) continue;
    const last = out[out.length - 1];
    if (last && last.changed === s.changed) last.text += s.text;
    else out.push({ ...s });
  }
  // A lone space between two changes reads better as part of the change.
  for (let i = 1; i < out.length - 1; i++) {
    if (!out[i].changed && /^\s+$/.test(out[i].text) && out[i - 1].changed && out[i + 1].changed) out[i].changed = true;
  }
  return merge2(out);
}

function merge2(segs: Seg[]): Seg[] {
  const out: Seg[] = [];
  for (const s of segs) {
    const last = out[out.length - 1];
    if (last && last.changed === s.changed) last.text += s.text;
    else out.push({ ...s });
  }
  return out;
}

/** What was removed from `a` (left) and added in `b` (right), as marked segments of each. */
export function diffWords(a: string, b: string): { left: Seg[]; right: Seg[]; changed: boolean } {
  if (a === b) return { left: [{ text: a, changed: false }], right: [{ text: b, changed: false }], changed: false };
  const x = a.match(TOKEN) ?? [];
  const y = b.match(TOKEN) ?? [];
  const n = x.length;
  const m = y.length;
  // Very long paragraphs: skip the quadratic table and mark the whole thing as changed.
  if (n * m > 1_500_000) return { left: [{ text: a, changed: true }], right: [{ text: b, changed: true }], changed: true };

  const lcs = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = x[i] === y[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const left: Seg[] = [];
  const right: Seg[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) { left.push({ text: x[i], changed: false }); right.push({ text: y[j], changed: false }); i++; j++; }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) left.push({ text: x[i++], changed: true });
    else right.push({ text: y[j++], changed: true });
  }
  while (i < n) left.push({ text: x[i++], changed: true });
  while (j < m) right.push({ text: y[j++], changed: true });
  // Whitespace on its own isn't a change worth showing.
  const quiet = (s: Seg) => (s.changed && /^\s+$/.test(s.text) ? { ...s, changed: false } : s);
  return { left: merge(left.map(quiet)), right: merge(right.map(quiet)), changed: true };
}

/** Share of words changed in the adaptation, for a summary line. */
export function changedShare(segs: Seg[]) {
  const words = (s: string) => (s.match(/[\p{L}\p{N}]+/gu) ?? []).length;
  const total = segs.reduce((n, s) => n + words(s.text), 0);
  return total ? segs.filter((s) => s.changed).reduce((n, s) => n + words(s.text), 0) / total : 0;
}
