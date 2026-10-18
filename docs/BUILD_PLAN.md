# Featherbound — Phased Development Plan

**Status:** v1.0, approved · **Last updated:** 2026-10-17
**Inputs:** [PRD v1.0](PRD.md) · prototype at git tag `prototype-v1` · [illustration bake-off results](../spikes/illustration-bakeoff/RESULTS.md)

This plan turns the PRD and the locked prototype into a production app, in phases that each end with something real you can use. P0 features come first, P1 next, P2 last, matching the PRD's priorities.

---

## Progress

| Phase | Status |
|---|---|
| 0 · Foundations | Done (2026-10-17). Live at featherbound.ink; adaptation spike passed. |
| 1 · Accounts, access & keys | Done (2026-10-17). Better Auth with Google, allow list, encrypted keys, model settings, themed dropdowns. |
| 2 · Library & import | Done (2026-10-17). EPUB/PDF import job, review screen, library, book and series pages, reader with synced progress. Re-import added after nested-part chapters were fixed. Exporting a rebuilt EPUB moves to Phase 5, alongside edition export; originals download as the uploaded file. |
| 3 · Analysis, wizard & estimates | Done (2026-10-17). Content reports checked on real books in production. Analysis job (per-chapter ratings in batches of 5, then the Story Bible) starts only after the parent sees its estimate. Book page tabs, the 7-step wizard, estimates and a cost cap are in. The wizard saves a draft edition; "Make sample chapters" arrives with Phase 4. Oz: estimate $0.94, actual $0.84, about 2 minutes. |
| 4 · Adaptation engine | Built (2026-10-17); awaiting Greg's read of a real book. Sample rounds with highlight comments, full runs with chapters three at a time and each ~2,000-word part as its own step, cost-cap pause and resume, consistency check, version 1.0.0 with an AI name, edition reader with kid titles and recaps, library notices, usage dashboard, and a judged quality suite (`npm run quality`, manual GitHub workflow). Oz at age 7: 24 chapters, full length, $2.93 plus $0.39 samples, 8 minutes. The estimate was recalibrated from that run (now within 6%). |
| 5 · Refinement, versions & export | Built (2026-10-18); awaiting Greg's check on an e-reader and a printout. Refine by whole edition, chapters or one passage, with suggested semantic version level, estimate and cap; only targeted chapters are rewritten and the rest is reused through the manifest. Version history with read-any-version, make-current (nothing deleted) and a paragraph diff. EPUB (EPUB 3 plus toc.ncx) and PDF (6×9 in, headless Chrome) export for any version and for originals; files over 4 MB go through a signed Blob link. Oz passage refinement: one paragraph changed, $0.05. |
| 6 · Picture Book mode | Next |

## 1. Architecture at a glance

| Layer | Choice | Why |
|---|---|---|
| **App framework** | **Next.js 16** (App Router, TypeScript, React) | Server components keep keys and book text on the server. One codebase for the UI and the API. |
| **Hosting** | **Vercel** (Node.js 24 on Fluid Compute) | Preview deploy for every pull request, a 300-second default function timeout, and native support for the job runner below. |
| **Database** | **Neon Postgres** (Vercel Marketplace) + **Drizzle ORM** | Relational data with typed queries and migrations. Each preview deploy gets its own database branch. |
| **File storage** | **Vercel Blob, private store** | Originals, chapter text, illustrations, covers and exports. Nothing is public; files are served through our own authenticated routes or short-lived presigned URLs. |
| **Sign-in** | **Better Auth** (self-hosted in the app, tables in our Neon database), Google as the only sign-in method | Works on any domain. A database hook refuses sign-up for emails not on the **allow list**, which lives in our own database so the admin manages it in the app (PRD §5.12). Chosen over Clerk (needs a custom domain for production) and Neon Auth (no server hooks). |
| **Background runs** | **Vercel Workflow SDK** (`"use workflow"` / `"use step"`) | Durable runs: each chapter is a retryable step, runs survive restarts, and a **hook** pauses a run at the cost cap until the parent decides (PRD §5.5). |
| **AI calls** | **AI SDK 7**, using each **account's own key** | One interface for the writing model and every picture model. A Vercel AI Gateway key (recommended) or direct provider keys (PRD §5.14). |
| **Default models** | Text: **Claude Opus 5.5** · Pictures: **GPT Image 2 → Nano Banana 2 → Grok Imagine 2.0** | From the PRD and the bake-off. All can be changed in Settings. |
| **Design system** | Port the prototype's CSS tokens and components (Tuft, BookCover, Icon, the reader) | The prototype *is* the design spec. Its look comes from hand-written CSS, so we keep that rather than switch to a component library. **Every dropdown uses the themed `Select` component; no native browser `<select>` anywhere** (Greg's rule). |
| **Testing** | Vitest (unit), `@workflow/vitest` (runs), Playwright (end-to-end), plus an **adaptation quality suite** | The quality suite guards the thing that matters most: editions that still feel like the real book. |

### How the pieces fit

```
Browser (phone / tablet / desktop)
   │  Better Auth session (Google)
   ▼
Next.js on Vercel ── proxy.ts: signed in? on the allow list? ──► "This library is private"
   │
   ├─ Server components & actions ──► Drizzle ──► Neon Postgres (every row has account_id)
   ├─ File routes (auth-checked) ───► Vercel Blob (private)
   └─ start(run) ───────────────────► Vercel Workflow
                                         ├─ step: analyze chapter / adapt chapter / draw picture
                                         ├─ AI SDK ──► AI Gateway or provider (account's own key)
                                         ├─ records every AI call ──► usage table
                                         └─ hook: "paused at cost cap" ◄── parent raises cap / stops
```

### Account isolation (PRD §3, §7)
- Every table except the allow list has an `account_id`. All database access goes through one data-access layer that requires the signed-in account; no screen or route queries tables directly.
- Blob paths are prefixed `accounts/<account_id>/…`. File routes check the prefix against the session before streaming.
- API keys are encrypted with AES-256-GCM. The master key is an environment variable, and each key has its own data key. Keys are decrypted only inside server functions, never sent to the browser, and shown only as their last four characters.
- The admin role adds exactly one ability, managing the allow list. There is no admin view into other libraries.

### Storing editions and versions efficiently (PRD §5.6, §7)
- Chapter text is stored **content-addressed**: each chapter body is saved in Blob under the SHA-256 of its text.
- A **version** is a small manifest mapping chapter number to text hash and illustration IDs. A refinement that changes 3 chapters writes 3 new chapter objects plus one manifest, so long version histories cost almost nothing, and rollback just switches the current manifest.
- Reading progress is stored per chapter, so it survives refinements and rollbacks (PRD §5.6).

### Data model (first cut)

| Table | Holds |
|---|---|
| `allowed_emails` | Allow list; `is_admin` flag |
| `user`, `session`, `account`, `verification` | Better Auth's tables. A `user` is a Featherbound account and owns one library |
| `account_settings` | Hand-off PIN hash, first-visit flag, preferences |
| `api_keys` | Encrypted key, provider, last four characters, status, checked-at time |
| `model_settings` | Writing model and the three picture models, in order |
| `series`, `books`, `book_chapters` | Library structure; chapter titles, word counts and the original text hash |
| `story_bibles`, `content_reports`, `visual_directions`, `character_sheets` | AI analysis per book (visual direction can start from earlier books in the series) |
| `editions` | Settings (JSON), name, status, sample guidance |
| `sample_rounds`, `comments` | Sample review rounds and highlight comments |
| `versions` | Number, level, AI name and description, guidance, manifest, cost, `is_current` |
| `change_notes` | Per-chapter "what changed and why" for each version |
| `illustrations` | Placement, prompt, model used, source and attribution, Blob path |
| `runs` | Type, status, estimate, cap, spent, chapter progress, Workflow run ID |
| `ai_calls` | Every model call: run, model, tokens in/out, images, cost, time, refused or not |
| `reading_progress`, `bookmarks` | Per book or edition, synced across devices |

---

## 2. Phases

Each phase ends with a working, deployed app and a clear exit check. Sizes are relative: **S** about a few focused days, **M** about a week, **L** about two weeks.

### Phase 0 — Foundations · S
**Goal:** a deployed, signed-out skeleton with the real design system.

- Create the Next.js app in `web/` and keep `prototype/` alongside as the design reference.
- Port the design system: CSS tokens, base styles, Tuft (all poses), Icon, BookCover, Modal, Guide, Segmented, Switch, toasts.
- Link the Vercel project and connect the GitHub repo. Every pull request gets a preview deploy; `main` deploys to production.
- Provision **Neon** and a **private Blob store** through the Vercel Marketplace, and pull env vars locally (`vercel env pull`).
- Set up Drizzle with a first migration, a lazy database client and a seed script.
- CI with GitHub Actions: type check, lint and unit tests on every pull request.
- **Adaptation quality spike** (runs in parallel; this is the earliest real test of the core idea):
  - Script Claude Opus 5.5 to adapt the two public-domain Oz chapters from the prototype at two or three settings.
  - Have Greg judge the output and save it as the first **golden fixtures** for the quality suite.
  - Tune the adaptation prompt before Phase 4 depends on it.

**Exit:** the production URL shows the Featherbound shell with Tuft. CI is green. The quality spike output reads like the real book.

### Phase 1 — Accounts, access & keys · M
**Goal:** Greg can sign in on any device and set up his own AI keys; anyone else gets their own empty library.

- **Better Auth** with Google as the only sign-in method. `proxy.ts` sends anyone not signed in to sign-in. A sign-up hook refuses emails not on the allow list, and `requireAccount()` re-checks the list on every request, sending anyone removed to the "This library is private" page.
- **Allow list and admin:** seed `parent@example.com` as admin, and build **Settings → Sign-in access** (add and remove emails).
- **Account bootstrap** on first sign-in, plus the **first-visit welcome**: add your key, then add your first book.
- **Settings → AI models & keys:**
  - Encrypted key storage, with a live validity check on save (one cheap call per provider).
  - Writing model and three picture-model slots, with the warnings from PRD §5.14.
- **Model and price catalog:** one config file with each model's prices, speed and filter strictness, used by every estimate.
- **AI client factory:** `getModels(accountId)` returns AI SDK models wired to that account's gateway key or direct keys, with a clear "add a key first" error otherwise.
- **Usage recording:** a wrapper around every AI call that writes `ai_calls` (tokens, images, cost, time, refusals).
- **Settings → Hand-off PIN:** stored hashed. The lock itself comes in Phase 7.

**Exit:** Greg signs in on phone and laptop and adds a gateway key that shows "Working". A second test Google account sees an empty library and no access to Greg's.

### Phase 2 — Library & import · L
**Goal:** Greg's real books are on the shelves, and the originals are readable.

- **Upload:** desktop drag-and-drop, sent straight from the browser to private Blob (client upload with a server-issued token).
- **Import pipeline** (one Workflow run per import):
  - **DRM check first:** EPUB `META-INF/encryption.xml` / `rights.xml`; PDF encryption dictionary. If it's locked, show the friendly error screen from the prototype.
  - **EPUB:** read the OPF metadata, spine and table of contents; split into chapters; keep front and back matter but exclude them by default.
  - **PDF (text-based):** extract text, strip page numbers and running headers, and rebuild paragraphs and chapter breaks. Use a small model call only to confirm ambiguous chapter breaks.
  - **Cover:** the image inside the file first, then Open Library, then Google Books, preferring the matching English edition. Copy the chosen cover into Blob.
  - **AI suggestions:** series and book number, matched to existing series on the shelf, plus genres.
- **Review screen** (as in the prototype): edit metadata, include or exclude sections, rename/merge/split chapters, and choose the series.
- **Library:**
  - Shelves with box-set series and nested editions.
  - View / Sort / Filter, saved per account; search; list view.
  - Series page, book page (Details and Edit), and delete with typed confirmation.
- **Reader for originals:**
  - Port the prototype reader: column pagination, swipe/tap/keys, two-page spread, themes, fonts, line spacing, table of contents, bookmarks.
  - **Progress sync** (debounced) across devices.
  - Performance target: opens to the last-read page in under 2 seconds.
- **Export originals** as EPUB (rebuilt from the stored chapters).
- **Import quality checks:** a fixture set of real EPUBs and PDFs (including *Ender's Game* from Kobo and a Royal Road-origin title), with tests that no paragraphs are lost or reordered.

**Exit:** five or more real books imported with correct chapters, covers and series; read on phone and tablet with synced progress.

### Phase 3 — Analysis, wizard & estimates · M
**Goal:** every book has a Content Report and Story Bible, and the Kid-ify wizard works end to end up to "Make sample chapters".

- **Analysis run** (Workflow): reads the book chapter by chapter, then builds:
  - **Story Bible:** characters with looks, places, plot threads, themes, key scenes.
  - **Content Report:** per-chapter intensity for each of the nine categories.
- **Book page tabs:** What's inside (heat map) and Story Bible.
- **The 7-step wizard,** ported from the prototype: age and reading mode, content report, filters with age defaults, story and style, Pictures (density slider, official look, art style), notes, review.
- **Estimate engine:** one shared `estimate()` (already shaped in the prototype), priced from the model catalog and calibrated against past `ai_calls`. Used by the wizard, sample review, refinement and run progress.
- **Cost cap** input with a sensible default margin.
- **"New edition from these settings"** pre-fills the wizard.

**Exit:** content reports for three real books match what Greg knows is in them; estimates are produced for text and picture editions.

### Phase 4 — Adaptation engine (the heart) · L
**Goal:** go from settings to a finished, readable edition, with the sample review loop.

- **Sample run:** adapt chapter 1 plus the hardest chapter, using the settings, Story Bible and notes.
- **Sample review UI:**
  - Side-by-side compare, highlight-to-comment, overall notes and quick chips.
  - "Rewrite samples with my notes", which becomes a new sample round.
  - "Looks great: write the whole book".
- **Full adaptation run** (Workflow, one step per chapter):
  - Rolling context: the Story Bible, approved guidance, and summaries of earlier adapted chapters.
  - Rules enforced in the prompt and the checks: **full length, same plot**, filter levels honored.
  - **Per-chapter change notes.**
  - **Consistency check** at the end (names, details, threads). Flagged chapters are rewritten automatically, within the cap.
  - **Cost cap:** before each chapter, compare the projected spend to the cap. If it would go over, pause at a hook and notify; resume with a raised cap, or stop and keep finished chapters.
  - **Resumable:** a failed or paused run continues from the last finished chapter.
- **Run progress screen** (chapter dots, cost meter, pause-at-cap choices), and **in-app notices** on the library ("Samples ready", "Paused at cap", "Ready").
- **Version 1.0.0** is created on completion, with an AI-generated name and description.
- **Edition reader,** with "story so far" recaps and kid-friendly chapter titles when enabled.
- **Usage dashboard:** totals, by book, by kind of run, trend with projection, estimate vs. actual.
- **Quality suite** runs in CI on golden fixtures, using an LLM-as-judge rubric:
  - Plot events preserved.
  - Filter levels respected.
  - Reading level on target.
  - No characters forgotten.

**Exit:** one real book fully adapted within ±25% of its estimate and under its cap. Greg reads it to the kids, and it "feels like the real book".

### Phase 5 — Refinement, versions & export · M
**Goal:** improve editions safely over time, and take them anywhere.

- **Refine flow:**
  - Scope: whole edition, chapters, or a passage.
  - Guidance and suggestion chips, plus a "this sounds like a new edition" nudge.
  - Estimate and cap.
  - Semantic version level, suggested and editable.
- **Refinement run:** only the targeted chapters are rewritten; the rest of the edition is reused through the manifest.
- **Version history:** timeline, read any version, **rollback** (switch the current manifest; nothing is deleted), and **compare** two versions (paragraph diff, P1).
- **Export editions** as **EPUB** and **PDF**, any version, with cover, illustrations (once Phase 6 lands) and the title-page note.
  - PDF is rendered from the reader's HTML in a server function.

**Exit:** a refinement changes only what was asked; rollback works; exported EPUB opens on a Kobo or Apple Books and the PDF prints cleanly.

### Phase 6 — Picture Book mode · L
**Goal:** illustrated editions that look true to the book's world.

- **Visual research step:**
  - Find the official looks and suitable references.
  - Pick the default look for the target age.
  - Reuse the series' visual direction when there is one.
- **Character sheets:** generate one per main character, then an **approval screen** (approve or redraw each) before any scene is drawn.
- **Placement:** choose story moments at the edition's density and write a prompt for each, grounded in the Story Bible and character sheets.
- **Model chain with fallback:**
  - Main → backup 1 → backup 2 when a model refuses.
  - **Per-character stickiness:** once a character falls back, it stays on that model.
  - Prompts include "no signatures or extra lettering" (bake-off finding).
  - Record which model drew each picture, and its cost.
- **Found-art filter check:** official or found images are checked against the edition's filters and redrawn if needed (the Denslow wolf case).
- **Illustration management** in Refine: swap, redraw, upload your own, remove. Each change creates a patch version.
- Pictures included in **every estimate**, in the **reader** (inline and full screen), and in **exports**.
- Pictures are drawn alongside text chapters, so they add little to total run time.

**Exit:** an illustrated *Oz* edition with consistent characters, and a *Harry Potter* test that succeeds through the backup chain.

### Phase 7 — Hand-off mode, polish & hardening · M
**Goal:** ready for daily family use.

- **Hand-off mode:** lock to one edition, hold Tuft then enter the PIN, and the lock persists across app restarts on that device.
- **Mascot moments:** chapter-finished cheer, empty states, error states. Also **compare mode** in the reader (P1).
- **Notifications:** an email when a run finishes or pauses at its cap. Pick the email provider from the Vercel Marketplace's messaging category at this point.
- **Monthly budget** warning (P1).
- **Accessibility audit** to WCAG 2.2 AA: keyboard paths, screen-reader labels, contrast, illustration alt text.
- **Performance pass:** library load on phone, reader under 2 seconds, image sizes.
- **Device QA:** iPhone, iPad and desktop browsers.
- **Security review:** isolation tests, encrypted-key handling, and file-route authorization.
- **Backups:** confirm Neon point-in-time restore, and document how to restore an account.

**Exit:** two weeks of real use with no blocking bugs.

### Phase 8 — Later (P1/P2 backlog)
- More import formats: MOBI/AZW3 (DRM-free), DOCX, TXT/Markdown, HTML; then OCR for scanned PDFs.
- Settings **presets**; who's-who **glossary** extra.
- **Read-aloud** with text-to-speech and word highlighting.
- **Offline reading** as an installable app.
- **Self-hosted open-weights image model**, if hosted models keep refusing.

---

## 3. Sequencing and parallel work

```
Phase 0 ─► Phase 1 ─► Phase 2 ─► Phase 3 ─► Phase 4 ─► Phase 5 ─► Phase 6 ─► Phase 7
   └─ adaptation quality spike ─────────────────┘ (feeds the Phase 4 prompts)
```

- Within Phase 2, **import** and **library/reader** can be built in parallel once the data model is in. Within Phase 4, the **usage dashboard** can be built in parallel with the run engine.
- Phase 6 depends on Phases 3–5 (Story Bible, placement in chapters, versions), so it comes after them, even though it was designed early.
- Each phase is merged through pull requests with preview deploys; Greg reviews on the preview URL before it reaches production.

## 4. Risks and how we handle them

| Risk | Mitigation |
|---|---|
| **Adaptations don't feel like the real book** | Quality spike in Phase 0, sample review in every edition, golden-fixture suite in CI, Claude Opus 5.5 by default. |
| **Messy EPUB/PDF structure** (lost paragraphs, wrong chapter breaks) | Import review screen to fix by hand; fixture tests on real files; PDF is P0 for text-based files only. |
| **Long runs time out** | Every chapter is a Workflow step: durable, retryable and resumable. No single function call does a whole book. |
| **Costs drift from estimates** | Calibrate from `ai_calls`, cap check before each chapter, estimate-vs-actual on the dashboard. |
| **Picture models refuse famous characters** | Three-model fallback chain with per-character stickiness. The provider-policy probes from the bake-off are re-run before Phase 6. |
| **Character drift across pictures** | Approved character sheets passed as references on every picture; the bake-off winner was chosen for consistency. |
| **Keys leak** | Encrypted at rest, decrypted only in server code, never logged or sent to the browser; covered by the Phase 7 security review. |
| **Data mixes between accounts** | One data-access layer requires an `account_id`; isolation tests with two accounts in CI. |

## 5. Running costs (to confirm at setup)
- **Vercel:** Hobby may be enough for personal use; move to Pro if Workflow, Blob or function limits get in the way.
- **Neon and Blob:** free tiers should cover a family library to start.
- **Better Auth:** open source, no fee.
- **Domain:** featherbound.ink, bought by Greg.
- **AI:** paid by each account's own keys, as tracked on the usage dashboard. From the bake-off and prototype estimates:
  - Roughly $2–$15 per text edition, depending on book length.
  - About $0.05–$0.08 per picture.

## 6. Decisions (answered 2026-10-17)
1. **Repo layout:** the real app goes in `web/`; `prototype/` stays as the design reference.
2. **Hosting:** Greg's existing Vercel **Hobby** plan. We move to Pro only if limits get in the way.
3. **Domain:** **featherbound.ink** (Greg changed this after buying the domain). `www` redirects to it.
4. **Mascot name:** **Tuft** is confirmed.
