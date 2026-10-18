import { neon } from '@neondatabase/serverless';
import { describe, expect, it } from 'vitest';
import { getEdition, getReadyAnalysis, getStoryBible, listEditions, listSectionAnalyses } from '../src/lib/analysis';
import { getBook, getProgress, getSeries, listBooks, listBookmarks, listSections, listSeries } from '../src/lib/library';
import { getRun, getSheet, getVersion, listRuns, listSheets, listVersionChapters, listVersions } from '../src/lib/runs';
import { getUsage } from '../src/lib/usage';

// Account isolation, checked against the real database without writing anything: for each
// account that has data, a different (made-up) account must see none of it through any of
// the account-scoped reads the app uses. Run with `npm run quality` (needs DATABASE_URL).

const url = process.env.DATABASE_URL;
const OTHER = 'isolation-check-not-a-real-user';

describe.skipIf(!url)('account isolation', () => {
  it('another account sees nothing of yours', { timeout: 120_000 }, async () => {
    const sql = neon(url!);
    const owners = (await sql.query('select distinct user_id from books')) as { user_id: string }[];
    expect(owners.length).toBeGreaterThan(0);
    for (const { user_id: owner } of owners) {
      // The owner can see their things…
      const books = await listBooks(owner);
      expect(books.length).toBeGreaterThan(0);
      // …and nobody else can, by listing or by id.
      expect(await listBooks(OTHER)).toEqual([]);
      expect(await listSeries(OTHER)).toEqual([]);
      expect(await listRuns(OTHER)).toEqual([]);
      for (const b of books) {
        expect(await getBook(OTHER, b.id)).toBeNull();
        expect(await listSections(OTHER, b.id)).toEqual([]);
        expect(await getStoryBible(OTHER, b.id)).toBeNull();
        expect(await getReadyAnalysis(OTHER, b.id)).toBeNull();
        expect(await getProgress(OTHER, `book:${b.id}`)).toBeNull();
        expect(await listBookmarks(OTHER, `book:${b.id}`)).toEqual([]);
        expect(await listEditions(OTHER, b.id)).toEqual([]);
        if (b.seriesId) expect(await getSeries(OTHER, b.seriesId)).toBeNull();
        const analysis = await getReadyAnalysis(owner, b.id);
        if (analysis) expect(await listSectionAnalyses(OTHER, analysis.id)).toEqual([]);
        for (const e of await listEditions(owner, b.id)) {
          expect(await getEdition(OTHER, e.id)).toBeNull();
          expect(await listVersions(OTHER, e.id)).toEqual([]);
          expect(await listSheets(OTHER, e.id)).toEqual([]);
          for (const s of await listSheets(owner, e.id)) expect(await getSheet(OTHER, s.id)).toBeNull();
          if (e.currentVersion) {
            expect(await getVersion(OTHER, e.id, e.currentVersion)).toBeNull();
            const v = await getVersion(owner, e.id, e.currentVersion);
            expect(await listVersionChapters(OTHER, v!.manifest)).toEqual([]);
          }
        }
      }
      for (const r of (await listRuns(owner)).slice(0, 20)) expect(await getRun(OTHER, r.id)).toBeNull();
      const usage = await getUsage(OTHER);
      expect(usage.allTime).toBe(0);
    }
  });
});
