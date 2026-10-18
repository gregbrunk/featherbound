<p align="center">
  <img src="docs/assets/tuft.svg" width="160" alt="Tuft, Featherbound's mascot: a fluffy white bird in a too-big wizard hat, bobbing and blinking among twinkling stars" />
</p>

<p align="center">
  <strong>Featherbound</strong><br/>
  <em>Your private family library, where every book is a little softer.</em>
</p>

<p align="center">
  <a href="https://featherbound.ink">featherbound.ink</a> ·
  <a href="docs/PRD.md">Product requirements</a> ·
  <a href="docs/BUILD_PLAN.md">Build plan</a> ·
  <a href="docs/OPERATIONS.md">Operations</a>
</p>

---

Featherbound turns books a family already owns into gentler editions for their kids. Everything the reader loves stays the same: the plot, the characters, the author's voice and full length. What changes is only what a parent chooses to soften, such as language, violence, scariness or grief, for a reader of a particular age.

A parent imports a DRM-free EPUB or PDF. Featherbound reads it through and reports what's in each chapter. The parent picks settings in a short wizard and reviews two sample chapters side by side with the original. Then Featherbound writes the whole book. Illustrated editions can add pictures drawn in the style of the book's own art, with characters that look the same on every page.

> **Status: public beta.** Featherbound runs privately for one family, behind a Google sign-in allow list. Each account brings its own AI keys and pays its own AI costs.

## Contents

- [Features](#features)
- [How it works](#how-it-works)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Project layout](#project-layout)
- [Testing and quality](#testing-and-quality)
- [Deployment](#deployment)
- [Costs](#costs)
- [Privacy and safety](#privacy-and-safety)
- [Responsible use](#responsible-use)
- [Documentation](#documentation)
- [License](#license)

## Features

**Library**
- Import DRM-free **EPUB and PDF**. Chapters, cover, series and genre are detected, and you review them before the book goes on the shelf.
- Shelves with series box sets, filters and sorting, and a "Now reading" hero with a queue.
- A paged reader for phone, tablet and desktop: themes, fonts, text size, two-page spreads, bookmarks, and reading progress synced across devices.

**Softened editions**
- **What's inside:** a chapter-by-chapter content report across nine categories, and a **Story Bible** of characters, places, plot threads and themes.
- **Seven-step wizard:**
  - Target age and reading mode (read-aloud or independent).
  - Keep, soften or remove for each content category.
  - Faithfulness to the author's words and reading level.
  - Kid-friendly chapter titles and "story so far" recaps.
  - Pictures.
  - Your own notes.
- **Sample review:** two chapters (the first, and the most intense) shown side by side with the original, with changed words highlighted and highlight-to-comment. Rewrite them with your notes until they're right, or carry on.
- **Full-length adaptation:** paragraph for paragraph, with the same plot and outcomes, guided by the Story Bible. A consistency check across the whole book rewrites any chapter that drifts.
- **Refinements and versions:** ask for a change to the whole edition, some chapters or one passage. Each change makes a new semantic version, with history, side-by-side compare and rollback.
- **Export** any version as EPUB (for e-readers) or PDF (6 × 9 in, for print).

**Picture Book mode**
- Researches the book's look: its original illustrations, cover art, or the look an earlier book in the series used.
- Draws a **character sheet** for each main character. You approve each one before any scene is drawn.
- Chooses moments as the text is written and draws them in a consistent style at the density you pick. It falls back through three image models when one refuses, and redraws the book's own pictures if they're too intense for the edition.
- Redraw, upload your own, or remove any picture, each as a new version.

**For parents**
- **Hand-off mode** locks a device to one edition. Unlocking means pressing and holding Tuft, then a parent PIN, and the lock survives the app being closed.
- An **estimate before every AI run**, a **cost cap** that pauses at the end of a chapter, a **usage dashboard** with a monthly budget, and **email notices** when samples are ready, a book is done, or a run needs you.

## How it works

```
Import ─▶ Read through ─▶ Wizard ─▶ Samples ─▶ Full book ─▶ Read · Refine · Export
          (content report,           (review &   (chapters in parallel,
           Story Bible)               comment)    pictures alongside,
                                                  cost cap, consistency check)
```

- Long jobs (import, reading a book, samples, full runs, refinements) are durable background **workflows**. Each chapter part is its own retryable step, so runs survive restarts and resume where they stopped.
- Chapter text is stored **content-addressed**. An edition version is just a manifest of chapters, so versions share unchanged chapters, and rollback is instant and never deletes anything.
- Every AI call is made with **the signed-in account's own key** and recorded with its tokens and cost. Those records drive the estimates, the caps and the usage dashboard.

## Tech stack

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router, Cache Components), React 19, TypeScript |
| Hosting | Vercel (Fluid Compute, Node.js 24) |
| Background jobs | Workflow SDK (durable workflows and steps, hooks for the cost-cap pause) |
| AI | AI SDK 7, with Vercel AI Gateway or direct Anthropic, OpenAI, Google and xAI keys |
| Writing model | Claude Opus 5.5 by default (configurable) |
| Picture models | GPT Image 2, then Nano Banana 2, then Grok Imagine 2.0 (configurable chain) |
| Database | Neon Postgres via the Vercel Marketplace, Drizzle ORM |
| Files | Vercel Blob (private store) |
| Auth | Better Auth with Google sign-in and an allow list |
| Email | Resend via the Vercel Marketplace |
| Export | EPUB built in-house; PDF rendered by headless Chrome (`@sparticuz/chromium`) |

## Getting started

### Prerequisites

- Node.js 24 and npm
- A Vercel account (Neon, Blob and Resend are added through the Vercel Marketplace)
- A Google Cloud OAuth client for sign-in
- Google Chrome installed locally, for PDF export in development

### Setup

```bash
git clone https://github.com/gregbrunk/featherbound.git
cd featherbound/web
npm install

# Link the Vercel project and pull its development environment variables
npx vercel@latest link
npx vercel@latest env pull .env.local

# Create the database tables and add the first admin to the allow list
npm run db:migrate
ADMIN_EMAIL=you@example.com npm run db:seed

npm run dev            # http://localhost:3000
```

Sign in with Google, then add an AI key in **Settings → AI models & keys**. One Vercel AI Gateway key covers every model.

### The prototype

`prototype/` is the clickable design prototype the app was built from, locked at tag `prototype-v1`. It runs entirely in the browser with sample data:

```bash
npm --prefix prototype install
npm --prefix prototype run dev    # http://localhost:5173
```

## Configuration

Set these in the Vercel project. `vercel env pull` writes them to `web/.env.local` for development.

| Variable | Required | What it's for |
|---|---|---|
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | Yes | Neon Postgres (added by the Marketplace integration) |
| `BLOB_READ_WRITE_TOKEN` | Yes | Vercel Blob private store |
| `BETTER_AUTH_SECRET` | Yes | Signs sessions and the hand-off lock |
| `BETTER_AUTH_URL` | Yes | The app's public URL (`http://localhost:3000` in development) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Yes | Google sign-in |
| `KEY_ENCRYPTION_KEY` | Yes | Encrypts saved AI keys (AES-256-GCM). Keep it the same across environments, and never lose it |
| `RESEND_API_KEY`, `RESEND_EMAIL_DOMAIN` | For email | Email notices (added by the Resend integration) |
| `EMAIL_FROM` | No | Overrides the sender (default `Tuft at Featherbound <tuft@RESEND_EMAIL_DOMAIN>`) |
| `CRON_SECRET` | For backups | Lets Vercel Cron run the nightly backup |
| `CHROME_PATH` | No | Local Chrome for PDF export, if it isn't in the default macOS location |

AI keys are **not** environment variables. Each person adds their own in Settings. They're encrypted at rest and never sent to the browser.

## Project layout

```
docs/                  PRD, build plan, operations and backups
prototype/             Locked clickable prototype (Vite + React)
spikes/                Experiments behind key decisions (adaptation quality, illustration bake-off, mascot)
web/                   The app
  src/app/             Routes: library, books, editions, reader, settings, API
  src/workflows/       Durable jobs: import, read-through, adapt and illustrate
  src/lib/             Adaptation engine, estimates, pictures, export, storage, auth helpers
  src/db/              Drizzle schema
  drizzle/             SQL migrations
  quality/             Paid quality suite and the database isolation check
  scripts/             Seed and account restore
```

## Testing and quality

```bash
cd web
npm run typecheck && npm run lint && npm test && npm run build
```

- **Unit tests** (`npm test`, run in CI on every push) cover the importer, estimates, adaptation helpers, diffing, export, hand-off locking and versioning. They also include static **security checks**: every API route and server action must check the signed-in account.
- **Adaptation quality suite** (`npm run quality`, about $0.40, needs `AI_GATEWAY_API_KEY`): adapts golden public-domain chapters and has a judge model grade plot, filters, reading level and characters. A manual GitHub workflow runs it when a repository secret is set.
- **Account isolation check** (`quality/isolation.quality.ts`): read-only, against the real database. It confirms one account can't see another's data.

## Deployment

Pushes to `main` deploy to production on Vercel. CI (`.github/workflows/ci.yml`) type-checks, lints, tests and builds every push. Database migrations live in `web/drizzle/` and are applied with `npm run db:migrate`.

A nightly Vercel Cron job backs up the database to the private Blob store and keeps 30 days. [docs/OPERATIONS.md](docs/OPERATIONS.md) covers restoring an account or the whole database.

## Costs

Featherbound has no costs of its own beyond hosting. AI usage is billed to each account's own keys at the providers' list prices. Typical figures from real runs with Claude Opus 5.5:

| | Cost | Time |
|---|---|---|
| Reading a 39,000-word book for its content report | about $0.85 | about 2 min |
| Two sample chapters | about $0.40 | about 2 min |
| Full text-only adaptation (39,000 words) | about $3 | about 8 min |
| Full illustrated adaptation, one picture per chapter (24) | about $5 | about 15 min |
| Refining one passage | about $0.05 | under a minute |

Every run shows its estimate first and stops at its cost cap.

## Privacy and safety

- **One account, one library.** Nothing is shared between accounts: books, editions, keys and settings all stay private. Sign-in is limited to an allow list managed by the admin.
- **Your keys, your bill.** AI calls always use the signed-in account's key, passed explicitly. Keys are encrypted at rest, and Settings only ever shows their last four characters.
- **Private files.** Book files, text and pictures live in a private store and are only served to their owner.
- **Kids can't wander.** Hand-off mode is enforced on the server, not just hidden in the page.

## Responsible use

Featherbound is for **personal, private use with books you own**. It reads DRM-free files only and doesn't remove DRM. Editions are private copies for your own family. Don't distribute them.

Adaptations are made by AI. The checks keep the plot and characters intact, but a parent should still read what their child will read, and sample review exists for exactly that.

## Documentation

- [Product requirements (PRD)](docs/PRD.md): what Featherbound does and why
- [Build plan](docs/BUILD_PLAN.md): phases, decisions and progress
- [Operations](docs/OPERATIONS.md): where data lives, backups, restores and security checks
- [Adaptation quality spike](spikes/adaptation-quality/RESULTS.md) and [illustration bake-off](spikes/illustration-bakeoff/RESULTS.md): the experiments behind the model choices

## License

[MIT](LICENSE) © 2026 Greg Brunk.

Third-party content keeps its own terms. *The Wonderful Wizard of Oz* (L. Frank Baum, 1900) and W. W. Denslow's illustrations, used as sample text, test fixtures and style references, are in the public domain. Featherbound doesn't include anyone else's books, and you need your own right to any book you import.

<p align="center"><sub>Made with care by Greg Brunk and Tuft, the puffball bird in a too-big wizard hat.</sub></p>
