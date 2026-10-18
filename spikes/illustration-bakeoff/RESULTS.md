# Illustration bake-off: results

Run on 17 Oct 2026 through Vercel AI Gateway. Run `node build.mjs` to build `index.html`, a side-by-side gallery (models as rows, tests as columns, notes and scores per model). Pictures of in-copyright characters from the likeness probes aren't kept in the repository; the probe outcomes are recorded below.

## Recommendation

- **Default: GPT Image 2** (`openai/gpt-image-2`). It was the closest to Denslow by a wide margin: flat spot colour on white, Denslow's yellow-toned faces, the Lion's forelock curl. The characters matched its character sheet in every scene, and it staged the softened beats gently and with humour. About $0.05 per image and 20–35 s each.
- **Fallback 1: Nano Banana 2** (`google/gemini-3.1-flash-image`). A close second on style and consistency, faster (about 16 s) and about $0.07 per image. It is also the route for copyrighted books, because it drew Harry Potter without objection (see below). Caveat: it forges Denslow's signature into images (his name, his seahorse mark, an "S DEN" monogram). The prompt needs a "no signatures or extra lettering" line, plus a check before it ships.
- **Fallback 2: Grok Imagine 2.0** (`spacexai/grok-imagine-image-2.0`). This is the loose-filter last resort, tested in a second round. It drew all 7 tests, including Harry Potter both named and described, with no watermarks or forged signatures. It's a clean modern ink style, so less Denslow than GPT Image 2, but characters stay consistent with its sheet. About $0.08 and 13s per image.

Round two also tried the cheap open-weights options. **FLUX.2 klein 9B** ($0.02–0.03) is hosted by BFL with the same filter as FLUX.2 pro, and it moderated every Oz scene and both Harry Potter tests. **FLUX.1 schnell on Prodia** and **Recraft V4.1** don't accept reference images through the gateway, so they can't keep characters consistent. **Meta Muse** failed because the account has zero data retention turned on. An open-weights model only becomes the unfiltered route if we self-host it.

## Scores (1–5)

| Model | Denslow style | Consistency | Softened content | Quality | Avg $/img | Median time | Refused |
|---|---|---|---|---|---|---|---|
| GPT Image 2 | 5 | 5 | 5 | 5 | $0.054 | 30 s | Harry Potter, named and described |
| Nano Banana 2 | 4 | 4 | 5 | 4 | $0.068 | 16 s | nothing |
| Grok Imagine 2.0 | 3 | 4 | 4 | 4 | $0.081 | 13 s | nothing |
| Nano Banana Pro | 3 | 2 | 4 | 4 | $0.141 | 26 s | nothing |
| Seedream 5.0 Pro | 2 | 4 | 5 | 4 | $0.035 | 128 s | Harry Potter, named and described |
| FLUX.2 [pro] | 2 | n/a | n/a | 2 | $0.060 | 9 s | 3 of 3 Oz scenes and named Harry Potter (moderation) |
| FLUX.2 klein 9B | 2 | n/a | n/a | 2 | $0.023 | 4 s | 3 of 3 Oz scenes and both Harry Potter tests (moderation) |

- **Nano Banana Pro**: the characters drift between scenes. The Scarecrow's outfit changes every time, and the bees scene slid toward the 1939 MGM film look (blue gingham, black Toto, green-maned Lion). That's a real risk for "true to the book's world". It also drew snarling wolves and an overhead axe swing. Twice the price of Nano Banana 2 for a worse result.
- **Seedream 5.0 Pro**: consistent and cheapest, but rendered and shaded rather than ink line art, and it takes about 2 minutes per image. It put a visible "AI generated" watermark on at least the crow scene. That may be switchable through a provider option; I didn't test it.
- **FLUX.2 [pro]**: BFL's hosted moderation rejected the character sheet and every Oz scene, even with references removed and the style line shortened. Probing found no single trigger word. The only sheet it produced added a sixth, made-up character, and it ignores the requested aspect ratio. Self-hosted FLUX.2 (ComfyUI or LoRA) avoids the hosted filter, but that's a separate spike.
- **Style switching**: every model that reached the watercolor test switched cleanly. GPT Image 2 and Nano Banana 2 kept their character designs best.

## Copyright and likeness refusals (matters for Harry Potter)

Each model got two probes: one naming Harry, Hermione and Ron at Hogwarts, and one describing them only by appearance (round glasses, lightning scar, bushy hair, red hair, red-and-gold ties, castle school).

| Model | Named | Described, not named |
|---|---|---|
| GPT Image 2 | refused (OpenAI safety system) | refused |
| Seedream 5.0 Pro | refused ("may be related to copyright restrictions") | refused |
| FLUX.2 [pro] | moderated | **drew it** |
| FLUX.2 klein 9B | moderated | moderated |
| Grok Imagine 2.0 | **drew it** | **drew it** |
| Nano Banana 2 | **drew it** (added a "W. W. Denslow" signature) | not run |
| Nano Banana Pro | **drew it** | not run |

None of the Oz content was refused for copyright. Denslow's art and Baum's text are public domain.

What this means for Featherbound: OpenAI and ByteDance appear to check the **output image** for protected characters, not just the names in the prompt. Describing characters without naming them, which is how per-book character sheets would work anyway, does not get past them. A Harry Potter edition therefore needs a different model from an Oz edition. Plan for **automatic fallback on refusal**: GPT Image 2 first, then Nano Banana 2, then Grok Imagine 2.0. All three are configurable in Settings. One caveat: mixing models within a book costs some consistency, so after the first refusal for a character, the run should keep using the backup for that character's pictures. Whether to illustrate in-copyright characters at all, even for private family copies of owned books, is a policy call for the owner, not a technical one. Provider terms can change without notice, so re-run `likeness` and `likeness2` before relying on this.

## Cost

- Round one (5 models): **$1.88** on 25 successful images. Round two (fallback-2 candidates): **$0.62**.
- Total gateway spend, including the moderation probes: **$2.72**. That's within the ~$10 budget.
- Projected for a 20-illustration picture book: about $1.10 with GPT Image 2, or about $1.40 with Nano Banana 2, plus retries.

## Vercel AI Gateway or direct keys?

Per Vercel's pricing page, the gateway charges **no markup and no platform fee** on tokens or images: you pay each provider's list price, including when you bring your own provider keys. The only extra is card processing fees on credit top-ups. Optional add-ons cost extra but aren't needed here.

So cost isn't a reason to choose either way. The gateway gives one key, one bill, one spend log and budgets across OpenAI, Google, xAI and Anthropic, which makes it the recommended default for new users. Direct keys suit someone who already has provider accounts. The app accepts both (PRD §5.14), and each person uses their own keys.

## Gotchas found

- The Vercel AI Gateway **free tier (promo credit) blocks Gemini and GPT image models**. You need paid credits on the account.
- FLUX.2 [pro] has a team limit of 5 requests per minute through the gateway.
- Seedream ignores `aspectRatio` and needs an explicit `size`. FLUX.2 ignored both.
- Nano Banana models return images through `generateText(...).files`, not `generateImage`.

## Reproduce

```bash
cd spikes/illustration-bakeoff
npm install
node run.mjs                       # all models × all tests; skips ones already in results.json
node run.mjs gptimage2 --only=bees --force
node build.mjs                     # regenerates index.html (images embedded, ~3 MB, opens anywhere)
node serve.mjs                     # optional: view at http://127.0.0.1:4178
```

You need `AI_GATEWAY_API_KEY` in `.env` (gitignored; see `.env.example`). Full-resolution originals are in `out/`, gallery-sized copies in `web/`, and the raw log with per-call cost, timing and errors is `results.json`. `probe/` and `probe.mjs` hold the FLUX moderation experiments.
