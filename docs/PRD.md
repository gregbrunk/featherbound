# Featherbound — Product Requirements

**Status:** v1.0, approved for build · **Last updated:** 2026-10-17 · **Prototype:** tag `prototype-v1`

> Priority key: **P0** = must have for first release · **P1** = should have soon after · **P2** = later / nice to have
>
> Featherbound was the "10 Ply Book Library" project: books made softer than 2-ply.

---

## 1. Summary

Featherbound is a private library app. Each account has its own library: you upload books you own and love, and the app uses AI to make "softened" editions for a young audience. Each edition keeps the full story, characters, plot and key themes, and changes the content that's too mature, too scary or too hard for the age it's made for. Optionally it adds illustrations every few pages, like a good chapter book.

The app is a whimsical, fantasy-themed library that makes reading feel fun. A soft, scholarly bird mascot guides you through it. It works well on desktop, tablet and phone. Each book can have many editions, and each edition can be refined over time with feedback. Every refinement is saved as a version you can roll back to.

## 2. Goals & non-goals

### Goals
1. **Adapt without ruining the book.** Adapted editions keep the original's full length, story, characters, plot, voice and key themes.
2. **Fit the audience.** Each edition is made for a target age and reading mode (read aloud, or read alone by the kid), with detailed content controls.
3. **Grow with your kids.** Each book can have many editions. Every edition shows the settings it was made with, so it's easy to tell when it's time for a new one.
4. **Refine without risk.** Give the AI feedback to improve an edition at any time; every change is a version you can roll back.
5. **Make reading magical.** Whimsical design, a lovable mascot guide, optional illustrations true to the book's world, and a reader kids want to open.
6. **Read anywhere.** A first-class reading experience on phone, tablet and desktop, with progress synced.
7. **No cost surprises.** Estimates before every AI run, caps that stop runaway runs, and a clear usage dashboard.

### Non-goals
- **Kid accounts or kid profiles.** Kids don't sign in. A parent reads to them or hands them a device (see Hand-off mode). The app has no record of individual children, doesn't assign books to them, and doesn't send nudges.
- **Shortening books.** Editions are always full length; the app changes content and language, not length.
- **Changing plot outcomes.** Events can be softened or moved off-page, but what happens in the story never changes.
- **Editing text by hand.** All changes to an edition's text come from AI revisions guided by parent feedback.
- **Carrying settings across a series.** Each book's editions are set up from scratch, even book 3 of a series.
- **Public sharing or distribution.** This is a private tool; there's no public sharing or marketplace.
- **Sharing between accounts.** Each account's library, books, editions, API keys, settings and usage are its own. There are no shared or family libraries, no shared books, and no shared keys.
- **DRM removal.** The app accepts DRM-free files only. Encrypted files get a friendly error message with links to legal options.
- **Copyright checks.** The app doesn't verify where a file came from. That's the account holder's responsibility.

## 3. Users & access

- **One account, one library.** Each approved Google account gets its own private library, with its own books, editions, API keys, settings, PIN and usage. Accounts never see each other's data.
- **Approved accounts** sign in with Google. Only emails on the allow list can sign in.
- **Admin** (parent@example.com) is the first approved account. The admin can also add and remove emails on the allow list in Settings. That's the only extra power: the admin can't see or use anyone else's library or keys.
- **A new account starts fresh:** an empty library and a short first-visit guide from the mascot (add your AI key, then add your first book).
- **Reading progress** and bookmarks are saved for each book and edition, and synced across that account's devices.

## 4. Core concepts

- **Series**: books grouped in order (e.g. *Harry Potter* 1–7). Used to organize the shelf. Settings don't carry over from book to book.
- **Book**: one uploaded original work (the source file plus its metadata). Read-only after import; the original text is never changed.
- **Edition**: one adapted version of a book, made for one set of settings.
  - It records the **settings used to make it** (target age, reading mode, content filters, style, picture settings, notes).
  - It gets a readable name made from its settings, e.g. "Age 6 · Read-aloud · Illustrated". Parents can rename it.
  - A book can have many editions. A different target age or other settings means a new edition, not a new version.
- **Version**: one saved state of an edition's text and illustrations.
  - The first full adaptation is version 1.0.0. Each later refinement creates a new version.
  - Each version has a **number** (semantic versioning, see §5.6), an **AI-generated friendly name** (e.g. "The Gentler Mirkwood"), an AI-generated **description** of what changed and why, and the **parent guidance** that produced it.
  - One version is **current**. That's the one the reader opens and the one exported. Older versions are kept and can be restored.
- **Story Bible**: an AI-generated reference for each book: characters, places, plot threads, key themes, important scenes, and visual descriptions. The adaptation uses it to keep the story consistent from chapter to chapter, and the illustrations use it to keep the art consistent.
- **Content Report**: an AI scan of the original, chapter by chapter, that flags content in each filter category and how intense it is. It lets parents see what's in a book before deciding how to change it.

## 5. Feature requirements

### 5.1 Library (P0)
- Shows books on bookshelves with their covers, **grouped as much as possible**:
  - A **series** sits on the shelf as one stack or box set, which opens to show its books in order.
  - A **book** shows once, with a small badge for its number of editions. Its editions are nested inside it.
- **View / Sort / Filter controls:**
  - **View:** shelf (covers) or list.
  - **Group by:** series (default), author, genre, or none.
  - **Show editions:** nested inside each book (default) or each on its own spot on the shelf.
  - **Sort:** title, author, series order, recently read, recently added.
  - **Filter:** genre, author, series, edition target age, reading mode, illustrated or not, status (e.g. editions being made).
  - The app remembers the account's last view settings.
- Search by title, author, series or character.
- **Series page:** the books in order, with their editions.
- **Book detail page:** the original and all its editions. Each edition shows a **settings card**: target age, reading mode, filter levels, picture settings, notes, current version, and the date it was made. From that card you can:
  - Read the edition.
  - Download it.
  - Rename it.
  - Refine it (see §5.6).
  - See its version history.
  - **"New edition from these settings"**, which opens the wizard pre-filled with that edition's settings to adjust.
- Parents can edit book metadata: title, author, series and position in it, genre(s), description, cover image, tags.
- Full create, read, update and delete for series, books and editions. Deleting asks for confirmation and warns if editions, versions or reading progress will be lost.

### 5.2 Upload & import (P0)
- Upload from desktop by drag-and-drop or file picker. (Upload on tablet and phone isn't required, but it's fine if it works there too.)
- **Supported formats:**
  - **P0:** EPUB (preferred, since it keeps chapter structure) and PDF (text-based).
  - **P1:** MOBI/AZW3 (DRM-free only), DOCX, TXT/Markdown, HTML.
  - **P2:** Scanned/image PDFs using OCR.
- On import, the app:
  - Reads the metadata and cover.
  - Splits the book into chapters.
  - **Suggests a series and book number** using the file's metadata and AI ("This looks like *Harry Potter*, book 3"). It matches an existing series on the shelf when there is one, or offers to create a new series. The parent confirms or corrects it. Standalone books are fine.
  - Suggests genres.
  - **Finds the real cover art**: uses the cover inside the file if there is one; otherwise looks it up in Open Library and Google Books (the same catalogs Calibre uses), preferring the English edition that matches the file. The parent can pick a different cover or upload one.
  - Shows a preview so the parent can fix chapter breaks and metadata before saving.
- Recognizes DRM-protected files and explains, kindly, that they can't be imported, with tips on legal DRM-free sources (Kobo "DRM-Free" label, Amazon EPUB downloads from KDP authors, buying from the author directly).
- Import must get the text right: no lost paragraphs, scrambled order, or headers and footers mixed into the story. PDF import removes page numbers and running headers.

### 5.3 "Kid-ify" wizard (P0)
After import, or from "New edition" on any book, the mascot walks the parent through these steps. Settings always start from defaults, never from another book in the series.

1. **Who's it for?**
   - **Target age** (3–17). The app shows the matching publishing-industry age band as a guide (see §6.1).
   - **Reading mode:** *Read aloud* (an adult reads it to the kid) or *Independent reader* (the kid reads it alone). Independent reader mode simplifies vocabulary and sentence structure to suit the age. Read-aloud mode can keep richer language.
2. **What's in this book?** Shows the Content Report summary: which categories show up, how intense they are, and in which chapters. For example: "Scariness: high in chapters 8, 12 and 19."
3. **Content filters.** One control per category (see §6.2). Each has three levels: **Keep**, **Soften**, **Remove (move off-page)**. Defaults come from the target age, and parents can change any of them.
4. **Story & style.**
   - **Faithfulness:** a slider from "stay close to the author's words" to "retell freely in kid-friendly language".
   - **Reading level:** comes from the age and reading mode, and can be adjusted.
   - Keep original names and invented terms (default on).
   - **Optional extras:** kid-friendly chapter titles, a short "story so far" recap at the start of each chapter, and a glossary of characters and places (P1).
5. **Picture Book mode** (toggle). Turning it on opens extra settings: **image density**, which official look to match, and the art style (see §5.7). Moving the density slider updates the predicted cost and time for the whole book as you go.
6. **Anything else?** Free-text notes for the AI. For example: "Tone down the spiders in Mirkwood a lot." "Keep Bilbo's humor." "Gandalf's 'fall' is important to us; soften it but keep its weight."
7. **Review & start.**
   - Shows a summary of all settings.
   - Shows the **cost and time estimate** (see §5.10).
   - Lets the parent set a **cost cap** for the full run, pre-filled with a sensible margin above the estimate.
   - Ends with a **Make sample chapters** button.

Parents can save their settings as **presets** (e.g. "Age 6 read-aloud, gentle") to reuse on other books (P1). Presets are chosen on purpose; nothing is applied automatically.

### 5.4 Sample review loop (P0)
- Before adapting the full book, the app adapts **1–2 sample chapters**. It picks them automatically: one early chapter, to check voice and tone, and the chapter with the most flagged content, which is the hardest test. Parents can pick different chapters.
- The parent compares the samples **side by side** with the original, can highlight passages and leave comments, and can add general notes ("too babyish", "kept too much of the battle").
- The parent's feedback becomes guidance for the adaptation. They can make the samples again with that guidance (as many times as they want), or approve them and start the full book.
- The approved guidance is saved with the edition and shown on its settings card, so you can see later why it reads the way it does.

### 5.5 Full adaptation (P0)
- Runs in the background. Parents can close the app; progress is shown on the book ("Chapter 14 of 32"), and a notification is sent when it's done.
- The app adapts the book chapter by chapter using the Story Bible, the approved guidance, and summaries of earlier adapted chapters, so it stays consistent across the whole book.
- **Full length, same story.** Every chapter and scene stays in the edition. Plot events, outcomes and character arcs are never changed. Something hard (a death, a battle) can be softened, made less graphic or moved off-page, but it still happens.
- **Cost cap:** before starting each chapter, the run checks whether the next chapter would likely go over the cap. If so, it **pauses at the end of the current chapter** and notifies the parent, who can raise the cap and resume, or stop.
- The finished adaptation becomes **version 1.0.0** of the edition.
- Each version keeps a **change log** for each chapter: what was changed from the original and why (e.g. "Softened the troll scene: removed the threat to cook the dwarves alive").

### 5.6 Refinement & version history (P0)
- **Refine an edition:** at any time after it's made, a parent can give the AI more guidance to improve it.
  - Guidance can apply to the **whole edition** ("Bilbo should sound a bit more grown-up throughout") or to **specific chapters or passages** (highlight a passage and comment, as in sample review).
  - The app shows a cost and time estimate first, and the cost cap applies.
  - The AI makes only the changes the guidance asks for and keeps the rest of the edition stable, with the same Story Bible and consistency checks as the full run.
  - If the guidance really changes the edition's settings (e.g. "make it for age 9 now"), the mascot suggests making a **new edition** instead.
- **Each refinement creates a new version.** Version numbers use semantic versioning:
  - **Major (2.0.0):** a revision across the whole book (e.g. the tone of the whole edition changes).
  - **Minor (1.1.0):** several chapters revised.
  - **Patch (1.0.1):** a small, targeted fix (one passage, one chapter, or swapping illustrations).
  - The AI suggests the version level and the parent can change it.
- Each version gets an **AI-generated friendly name and description**, plus the parent's guidance and per-chapter change notes.
- **Version history** for each edition: a list of versions with names, descriptions, dates and costs. Parents can:
  - Read any past version.
  - **Compare** two versions, chapter by chapter, showing what changed (P1).
  - **Roll back:** make a past version current again. Rollback never deletes anything; later versions stay in the history and can be restored.
- Reading progress stays put through refinements and rollbacks, because chapters stay the same.

### 5.7 Picture Book mode (P1, designed now)
- Places illustrations at story moments worth showing (new characters, new places, action beats), at the edition's **image density**.
- **Image density** is a slider from **every page** to **once per chapter**, with steps in between (every 2, 3, 5 or 8 pages; 3 or 2 per chapter). Only the steps that make sense for the book are shown, ordered from most to fewest pictures. For example, "every 8 pages" is dropped when chapters are shorter than that.
  - As the slider moves, the app shows the number of pictures, the **full-book cost** (text plus pictures) and the **total time**, and updates them live. A small table lists every step side by side, so it's easy to trade pictures against cost and time.
  - The estimate uses the chosen picture models' real prices and speeds (§5.14). It also shows the most the run could cost if every picture had to fall back to the priciest backup model.
- **Art style is chosen per edition.** The default is **"True to the book's world"**:
  - When official visual media exists (book illustrations, cover art, films), the app studies it and makes the art match. Characters, places, costumes and creatures look the way fans know them. *Harry Potter* should be unmistakably *Harry Potter*.
  - **When there are several official looks** (e.g. *Harry Potter*'s original book art, the illustrated editions, and the films), the app **defaults to the one that best suits the edition's target age** and explains why. The parent can pick a different one.
  - Parents can choose a different style (e.g. watercolor storybook, ink and wash, bright cartoon). Character likeness still follows the chosen official look.
- **How images are made:**
  - **Main approach: AI-generated illustrations in one consistent style** for the whole edition, based on the Story Bible's visual descriptions.
  - **Found art as reference:** before generating, the app looks for official illustrations and high-quality fan art of the book's characters and places, and uses what it finds as **visual reference**.
  - **Found art placed by hand:** parents can also put a found or uploaded image straight into the book in place of a generated one.
- **Visual research phase:** every Picture Book run starts with a short research step that looks for the book's official visual media and fan art, and records what it finds as the book's **visual direction**.
  - **Across a series**, the visual direction from earlier books is the starting point, which keeps research costs down. The research step still runs for each book, because the look can change from book to book (as it does across *Harry Potter*). It only looks for what's new or different.
- A **character visual sheet** for each book keeps each character looking the same from picture to picture. In a series, it starts from the previous book's sheets. Parents can approve or regenerate each sheet before illustrations are made.
- Parents can swap, regenerate, upload their own, or remove any illustration. Illustration changes count as refinements and create new versions.
- Image source and attribution are recorded for each illustration.
- **Found art must pass the edition's filters too.** Official art can show exactly what the edition softens. For example, Denslow's original *Oz* art shows the Tin Woodman sitting on a dead wolf. The app checks each found image against the content filters, and redraws any that don't fit, in the same style.

### 5.8 Reader (P0)
- Reads both originals and editions, with a first-class layout on phone, tablet and desktop. On phone, it uses swipe or tap page turns; on tablet and desktop, it can show one page or a two-page spread.
- **Reading settings:**
  - Font size.
  - Typeface, including a dyslexia-friendly option.
  - Line spacing.
  - Theme: Day / Sepia "parchment" / Night.
- Table of contents, bookmarks, and a progress bar with chapter markers.
- **Progress is saved for each book and edition** and synced across the account's devices. You pick up where you left off.
- Illustrations show inline and can be tapped to view full-screen.
- **P1:** Parent "compare mode" that shows the original and the adaptation side by side, and a fun "you finished a chapter!" moment from the mascot.
- **P2:** Read-aloud with text-to-speech and word highlighting, and offline reading (installable app).

### 5.9 Hand-off mode (P1)
- From the reader, a parent can **lock the app to the edition being read** before handing the device to a kid.
- While locked, the kid can:
  - Turn pages.
  - Use the table of contents and change reading settings.
  - See illustrations.
- While locked, the kid **can't**:
  - Leave the reader.
  - Open originals, other books or settings.
  - Refine or delete anything.
- **Parent trap to unlock:** press and hold the mascot, then enter a **4-digit parent PIN**, set once in Settings.
- Lock stays on if the app is closed and reopened on that device.

### 5.10 Cost & usage (P0)
- **Estimates before every AI run:** sample chapters, full adaptation, refinements, and illustrations. Each estimate shows expected tokens, cost and time.
- **Pictures are always in the math.** Whenever an estimate is shown for an illustrated edition (the wizard, sample review, refinement, run progress), its cost and time include visual research, character sheets, illustrations and expected redraws, priced with the chosen picture models. Refinements include redrawing the pictures in rewritten chapters whose scenes changed. Pictures are drawn while later chapters are written, so time estimates account for the overlap.
- **Cost caps for each run.** A full run or refinement pauses cleanly at a chapter boundary before it would go over its cap (see §5.5).
- **Usage dashboard** in Settings:
  - Totals for this month and all time: tokens and cost, split into text and images.
  - Breakdown by book, edition and run type (analysis, samples, full run, refinement, illustrations).
  - A trend chart over time, with this month's projected total.
  - Estimate vs. actual for each run, so estimates can be tuned over time.
  - An optional **monthly budget** with a warning as it gets close (P1).

### 5.11 Export (P0)
- Download any original, or any version of an edition (current by default), as **EPUB** or **PDF**, with illustrations and the edition's cover.
- Exported files include a title-page note naming the edition, its version and its main settings (e.g. "Age 6 · Read-aloud · v1.2.0 'The Gentler Mirkwood' · Featherbound · Oct 2026").

### 5.12 Accounts & access (P0)
- Sign in with Google.
- Only emails on the **allow list** can get in. To start, that's parent@example.com, the admin. The admin can add and remove emails in **Settings → Sign-in access** at any time.
- Anyone not on the list sees a friendly "This library is private" page.
- **Every account is separate** (see §3). Adding someone to the allow list gives them their own empty library, not access to yours.
- **First visit:** a new account lands on a welcome screen where the mascot walks them through adding their AI key and their first book.

### 5.13 Mascot & brand (P0)
- **Name:** Featherbound.
- **Mascot:** a cute, extra-soft, scholarly fantasy bird. It's the app icon, and appears throughout the app as the reader's friend and guide, the way Duo appears throughout Duolingo:
  - Guiding the parent through the wizard.
  - Showing up on empty shelves.
  - Animating while editions are being made.
  - Celebrating finished chapters and books.
  - Reacting in error states.
  - Guarding the Hand-off lock.
- **Concept:** the softest round, white puffball bird (inspired by the long-tailed tit, the "snow fairy" of Hokkaido), wearing a wizard hat that's much too big for it. Details and a name get worked out in the prototype.
- Visual direction: whimsical fantasy, like a cozy enchanted library. Warm parchment, deep jewel tones, hand-drawn touches, floating feathers, and little bits of magic (sparkles, page flutter, candlelight). It should be playful but never cluttered, and the reading screen stays calm and easy to read.

### 5.14 AI models & keys (P0)
- **Settings → AI models & keys** lets each account:
  - Choose the **writing model** (default: Claude Opus 5.5).
  - Choose three **picture models** in order: **main**, **backup 1** and **backup 2**. If a model refuses a picture (common with famous characters), the run tries the next one, and records which model drew each picture.
  - Each model shows its price per picture, speed, how well it matched the book's art, character consistency, and how strict its content filters are. The app warns if no picture model has loose filters, or if one model fills two slots.
- **Defaults** (from the October 2026 illustration bake-off; see `spikes/illustration-bakeoff/RESULTS.md`):
  - Main: **GPT Image 2**. Best match to official art and most consistent characters. Refuses famous copyrighted characters, even when they are only described.
  - Backup 1: **Nano Banana 2** (Gemini 3.1 Flash Image). Close second and faster, and it draws copyrighted characters. Its prompts forbid signatures, because it copies artists' signatures.
  - Backup 2: **Grok Imagine 2.0**. The loosest filters tested; it drew every test scene, including *Harry Potter*. This is the last resort, so books like *Harry Potter* still get pictures.
- **API keys belong to the account.** Each account adds its own keys in Settings, and everything that account runs is billed to those keys. Keys are never shared between accounts, and a new account can't run anything until it adds a key.
  - **Recommended:** one **Vercel AI Gateway** key. It reaches every model at the providers' list prices, with no markup or platform fee (card processing fees may apply), and gives one bill and one spend log.
  - **Or** direct keys for Anthropic, OpenAI, Google and xAI. Prices are the same; the trade-off is more keys and more bills. A model is usable when the account has the gateway key or that model's own provider key.
  - Keys are checked when saved, encrypted at rest, never shown again (only the last four characters), and never sent to the browser after saving.

## 6. Adaptation model

### 6.1 Age bands
The wizard takes a target age and shows the closest standard publishing band. The band is a reference only; the app uses the target age and reading mode.

| Band | Typical ages | Feel |
|---|---|---|
| Picture book | 3–6 | Read aloud, simple, gentle, lots of pictures |
| Early reader | 5–7 | Short sentences, simple vocabulary |
| Chapter book | 6–9 | Short chapters, a picture every few pages (Magic Tree House) |
| Middle grade | 8–12 | Full novels, mild peril, light romance at most |
| Upper middle grade | 10–14 | More complex themes, moderate peril |
| Young adult | 12–17 | Mature themes handled carefully |

### 6.2 Content filter categories
These are modeled on the categories Common Sense Media uses. Each one can be set to Keep, Soften or Remove, and each starts from a default based on the target age.

| Category | Examples |
|---|---|
| Language | Profanity, slurs, crude insults |
| Violence & gore | Battles, injury detail, blood, cruelty |
| Scariness & peril | Monsters, dread, nightmares, horror imagery (kept separate from violence: the Nazgûl are scary without being gory) |
| Death & grief | Character deaths, loss, mourning |
| Romance & sexuality | Kissing, innuendo, sexual content |
| Substances | Drinking, smoking (Gandalf's pipe), drugs |
| Mature themes | War, abuse, torture, despair, existential themes, moral horror |
| Meanness & bullying | Cruelty between characters, humiliation |
| Crude humor | Toilet and gross-out humor (some families want *more* of this for little kids!) |

### 6.3 AI approach (direction only; details go in the build plan)
- **Text:** a top-tier Claude model is the recommended starting point. It handles long input, writes faithfully in an author's style, and judges content well. Local and open-source models aren't recommended: book-length creative work done faithfully is where quality differences show most, and the volume (a few books a month) doesn't call for self-hosting. The pipeline is built so the model can be swapped.
- **Pipeline:** import → Story Bible and Content Report → (Picture Book mode: visual research) → samples → feedback → full run chapter by chapter (with rolling context) → consistency check → version 1.0.0 → refinements (new versions).
- **Images:** a chain of three models (main and two backups), chosen in Settings (§5.14). Defaults: GPT Image 2, then Nano Banana 2, then Grok Imagine 2.0. Every model call goes through one interface (the AI SDK), so models can be swapped without pipeline changes. Self-hosting an open-weights model (e.g. FLUX.2 klein) would avoid hosted filters entirely; it's a later option if all three hosted models keep refusing.
- **Usage tracking:** every AI call records its tokens and cost against the book, edition, version and run, which feeds the estimates, caps and usage dashboard.

## 7. Platform & non-functional requirements
- **Hosting:** a web app, hosted online, reachable from anywhere over HTTPS. It's responsive and mobile-first for library and reader screens; upload, the wizard and refinement are designed for desktop first.
- **Isolation:** every record and file belongs to exactly one account, and every read and write is checked against the signed-in account.
- **Storage:** original files, editions, versions, illustrations and exports are stored privately; nothing is public. Each file is reached through a link that only works for a short time. Versions store only what changed where practical, so a long version history doesn't use much storage.
- **Performance:**
  - The library loads quickly on phone over Wi-Fi.
  - Opening a book to the last-read page takes under 2 seconds.
  - A full adaptation of a book under ~150k words should finish in about an hour or less. (Picture Book mode may take longer.)
- **Reliability:** an adaptation or refinement that fails or pauses partway can resume from the last finished chapter. Nothing is lost when someone closes the browser.
- **Accessibility:** WCAG 2.2 AA for the interface, text size that can be changed, a dyslexia-friendly font option, and alt text on illustrations.
- **Privacy:** no analytics or tracking from outside services beyond what's needed to run the app.

## 8. Success criteria
- A parent can go from upload to an approved, readable edition in one evening.
- Parents rate their sample chapters "this feels like the real book" most of the time.
- Kids love the books and illustrations (the whimsy works).
- Editions stay consistent: no characters forgotten, no plot holes added, names and details steady from chapter to chapter.
- Actual costs stay within roughly ±25% of estimates, and no run goes past its cap.

## 9. Open questions
| # | Question | Default if not decided |
|---|---|---|
| Q1 | Mascot name: "Tuft" is the working name (others: Pip, Mochi, Wisp, Dumpling, Snowdrop). | Tuft |

## 9a. Prototype
A clickable prototype lives in `prototype/` (see the README to run it). It covers every P0 flow plus several P1 ones: library shelves with View / Sort / Filter, series box sets, book page with editions and settings cards, import with AI series suggestion and DRM error, the 7-step Kid-ify wizard with estimate and cost cap (including the image density slider with live cost and time), AI models & keys settings, sample review with highlight-to-comment, background runs with the cap pause, the reader (page turns, two-page spread, themes, fonts, illustrations, recaps, compare mode), Hand-off mode with PIN unlock, refinement, version history with compare and rollback, the usage dashboard, sign-in access, a new account's first visit (`/#/welcome`), and the sign-in and private pages. "Meet Tuft" (`/#/design`) shows the mascot poses, palette and type.

The prototype is **locked** at git tag `prototype-v1` and is the design reference for the build. It uses public-domain *Wonderful Wizard of Oz* text (chapters 1 and 12, with hand-written softened versions standing in for AI output) as sample content for every book.

## 10. Decision log
| Date | Decision | Why |
|---|---|---|
| 2026-10-17 | Private tool. No DRM removal; legality of sources is the account holder's responsibility. | Keeps the scope focused; the app only needs to read DRM-free files accurately. |
| 2026-10-17 | Sample-chapter review before every full adaptation is a permanent feature. | Quality decides whether the app works; fixing things early is cheap. |
| 2026-10-17 | Each edition has a target age plus a reading mode (read-aloud or independent), with industry bands shown as a guide. | A 6-year-old being read to and a 6-year-old reading alone need different text. Decided book by book, not kid by kid. |
| 2026-10-17 | No kid profiles or kid accounts; each edition shows the settings it was made with. | Simpler. Parents judge whether an edition still fits and make a new one when needed. |
| 2026-10-17 | Editions are always full length. | The goal is a softer version of the real book, not a summary. |
| 2026-10-17 | Plot outcomes never change; only how events are shown. | Keeps story continuity and the author's intent. |
| 2026-10-17 | Picture Book mode: AI-generated art in one consistent style is the main approach. Found official or fan art is used as reference, or placed by hand. | Matching found art to scenes automatically is unreliable, and pictures from different artists clash. |
| 2026-10-17 | Sign-in is Google with an approved list, starting with parent@example.com. More emails can be added later. | Private access. |
| 2026-10-17 | App name is **Featherbound**; mascot is a soft, scholarly fantasy bird. | Feather-soft fits the "softer books" idea, and it sounds like a fantasy library. |
| 2026-10-17 | Library nests editions under books and books under series by default, with View / Sort / Filter controls to change it. | Keeps the shelf tidy as editions pile up. |
| 2026-10-17 | No settings carry over across a series. Series and book number are suggested by AI on import and confirmed by the parent. | Every book deserves its own decisions; AI keeps the shelf organized. |
| 2026-10-17 | Estimates before every run, a cost cap for each run that pauses at a chapter boundary, and a usage dashboard in Settings. | Keeps AI spending predictable and visible. |
| 2026-10-17 | No hand-editing of text. Editions are refined by AI from parent guidance, with semantic-versioned versions, AI-generated names and descriptions, and non-destructive rollback. | Keeps all changes consistent with the Story Bible and makes every change reversible. |
| 2026-10-17 | Art style is chosen per edition and defaults to "true to the book's world", following official visual media where it exists. | Kids should recognize the world they know; well-known worlds should look right. |
| 2026-10-17 | Hand-off mode locks the app to one edition, with a parent trap to unlock. | Lets a parent hand a device to a kid without risk. |
| 2026-10-17 | Mascot: the softest white puffball bird in a too-big wizard hat. | Merges the cutest bird with a scholarly, magical touch. |
| 2026-10-17 | Each Picture Book run starts with a visual research phase. In a series, earlier books' visual direction and character sheets are the starting point. | Saves research cost while letting the look change from book to book. |
| 2026-10-17 | When there are several official looks, default to the one that best suits the target age; the parent can pick another. | The right look for a 5-year-old may differ from the right look for a 12-year-old. |
| 2026-10-17 | Hand-off unlock uses a 4-digit parent PIN. | Simple and reliable. |
| 2026-10-17 | Repo and project folder renamed to `featherbound`. | Matches the app name. |
| 2026-10-17 | Prototype built as a Vite + React app in `prototype/`, using public-domain Oz text as sample content. | Lets us review real screens and real-feeling softened text without copyrighted material. |
| 2026-10-17 | Cover art comes from the file, then Open Library and Google Books, preferring the matching English edition. | Real covers make the shelf feel like your library. Catalog data is mixed (library scans, foreign editions), so the app picks carefully and lets the parent change it. |
| 2026-10-17 | Found official art is checked against the edition's filters and redrawn if needed. | Original illustrations can show the very content an edition removes. |
| 2026-10-17 | Picture models: GPT Image 2 (main), Nano Banana 2 (backup 1), Grok Imagine 2.0 (backup 2), all changeable in Settings. | Bake-off winner on style and consistency, with backups that don't refuse famous characters. GPT Image 2 and Seedream refuse *Harry Potter* even when the characters are only described. |
| 2026-10-17 | API keys are per person, entered in Settings. Vercel AI Gateway is the recommended key; direct provider keys also work. | New users can set up without help, and nobody spends someone else's credits by accident. The gateway adds no markup. |
| 2026-10-17 | Image density runs from every page to once per chapter, with live full-book cost and time as the slider moves. Picture cost and time are included in every estimate. | Parents can balance how many pictures they get against cost and wait. |
| 2026-10-17 | **One account, one library.** No shared or family libraries and no key sharing. The admin only manages the sign-in allow list; new accounts start with an empty library and add their own keys. Supersedes the earlier shared family library. | Keeps everyone's books, costs and keys separate and simple. |
| 2026-10-17 | Prototype locked as `prototype-v1`; PRD v1.0 approved for the build plan. | Scope, requirements and design are aligned. |
