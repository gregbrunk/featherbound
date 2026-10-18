// The adaptation prompt under test. Phase 4 will start from whatever wins here.

export const LEVELS = {
  keep: 'Keep: leave it as the author wrote it.',
  soften: 'Soften: keep it in the story but make it gentler and less intense for this age.',
  remove: 'Remove: move it off-page. The event still happens if the plot needs it, but it is not shown or described.',
};

export const CATEGORY_NAMES = {
  language: 'Language (profanity, slurs, crude insults)',
  violence: 'Violence & gore (battles, injuries, blood, cruelty)',
  scariness: 'Scariness & peril (monsters, dread, nightmares)',
  death: 'Death & grief (deaths, loss, mourning)',
  romance: 'Romance & sexuality',
  substances: 'Substances (drinking, smoking, drugs)',
  mature: 'Mature themes (war, abuse, slavery, despair)',
  meanness: 'Meanness & bullying',
  crude: 'Crude humor',
};

export function systemPrompt() {
  return `You adapt chapters of books that a family owns into gentler editions for their children. The family loves these books and wants their kids to experience the real story. The edition must feel like the same book, just softer.

Rules that never bend:
1. Full length. Adapt every paragraph. Never summarize, skip, merge or shorten scenes.
2. Same story. Plot events, outcomes, character choices and arcs stay the same. You may soften how an event is shown, or move it off-page, but you never change what happens. (The one exception: where the content filter says Remove for a death or act of violence that the later plot does not depend on, the creature or character may simply flee or be driven off instead.)
3. Same voice. Keep the author's tone, humor, rhythm and turns of phrase wherever the filters and reading level allow. Prefer the author's own words; change only what needs changing.
4. Same names and invented words, unless told otherwise.
5. Paragraph for paragraph. Return exactly one adapted paragraph for each original paragraph, in the same order, so they can be read side by side.

Then report what you changed: one short note per meaningful change, naming the filter category (or "Reading level") and whether you softened or removed it.`;
}

export function userPrompt({ settings, bible, chapterTitle, paragraphs }) {
  const filters = Object.entries(settings.filters)
    .map(([k, v]) => `- ${CATEGORY_NAMES[k]}: ${LEVELS[v]}`)
    .join('\n');
  const mode =
    settings.readingMode === 'read-aloud'
      ? `Read aloud by a grown-up to a ${settings.targetAge}-year-old. Language can stay fairly rich, since an adult is there to help, but swap words a child this age would not follow even when hearing them.`
      : `Read alone by a ${settings.targetAge}-year-old. Use vocabulary and sentence lengths they can read on their own, while keeping the story's flavor.`;
  return `<edition_settings>
Target age: ${settings.targetAge}
Reading mode: ${mode}
Faithfulness: ${settings.faithfulness < 34 ? 'Stay close to the author’s words.' : settings.faithfulness < 67 ? 'Balance the author’s words with kid-friendly language.' : 'Retell freely in kid-friendly language.'}
Content filters:
${filters}
Parent's notes: ${settings.notes || 'None.'}
</edition_settings>

<story_bible>
${bible}
</story_bible>

<chapter title="${chapterTitle}">
${paragraphs.map((p, i) => `<p n="${i + 1}">${p}</p>`).join('\n')}
</chapter>

Adapt this chapter. Return ${paragraphs.length} paragraphs.`;
}
