# Adaptation quality spike: results

Run 17 Oct 2026. Claude Opus 5.5 (`anthropic/claude-opus-5.5` via Vercel AI Gateway, reasoning `high`) adapted two public-domain *Wonderful Wizard of Oz* chapters at three settings, using the prompt in `prompt.mjs`. Open `index.html` to compare each chapter paragraph by paragraph with the original.

| Setting | Chapter 1 | Chapter 12 |
|---|---|---|
| Age 5 · read-aloud · violence & death removed | 49 s · $0.09 | 50 s · $0.13 |
| Age 8 · independent · violence softened | 29 s · $0.09 | 44 s · $0.09 |
| Age 11 · independent · mostly kept | 31 s · $0.07 | 47 s · $0.10 |

**Total: $0.56.** All six runs returned exactly one adapted paragraph per original paragraph.

## What it shows

- **The core idea works.** Each age reads differently, and every version still sounds like Baum.
  - **Age 5:** the wolves flee from a flashing, clanging axe, and the crows get shaken and fly home. The rest stays close to Baum's own sentences.
  - **Age 8:** the fights still happen, without the beheading or neck-wringing detail.
  - **Age 11:** very close to the original.
- **Plot held at every level.** The Witch's attacks, the order of events and the outcomes are the same in all three.
- **"Slaves" was handled consistently** at every age: "servants" or "made to work for the Witch."
- **The change notes are specific and useful**, 8 to 11 per chapter, with paragraph references. They are good enough to show parents in sample review as they are.
- **Cost and speed:** about $0.03–0.04 per 1,000 words, which works out to roughly $3–4 for a 100k-word novel before retries. That's in line with the PRD estimates. About 30–50 seconds per chapter, so a whole-book run needs parallel chapters (Phase 4) to finish in about an hour.

## Notes for Phase 4

- The faithfulness setting and the reading mode visibly change the output, so keep both in the prompt as they are.
- "Remove" for a death the plot doesn't depend on (wolves, crows, bees) was correctly interpreted as "they flee". Keep rule 2's exception wording.
- Next: Greg reviews `index.html`. The passages he approves become the first **golden fixtures** for the CI quality suite.

## Reproduce

```bash
cd spikes/adaptation-quality
npm install
node --env-file=.env run.mjs            # all settings; skips ones already in results.json
node --env-file=.env run.mjs age8-independent --force
```
Needs `AI_GATEWAY_API_KEY` in `.env` (gitignored).
