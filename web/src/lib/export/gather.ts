import type { Block } from '../import/types';
import { getEdition } from '../analysis';
import { getBook, listSections } from '../library';
import { getVersion, listVersionChapters } from '../runs';
import { paths, readBlob, readJson } from '../storage';
import { sniffImage } from './xhtml';

// Everything an exporter needs, gathered once: the original book or one version of an edition.

export type ExportImage = { id: string; bytes: Uint8Array; type: string; ext: string };
export type ExportChapter = { title: string; subtitle?: string; recap?: string; blocks: Block[] };
export type ExportBook = {
  id: string;
  title: string;
  author: string;
  language: string;
  /** e.g. "Age 7 · Read-aloud · v1.0.0 “Softer Winds”" for editions. */
  edition?: { name: string; version: string; versionName: string };
  cover?: ExportImage;
  chapters: ExportChapter[];
  images: Map<string, ExportImage>;
  fileBase: string;
};

async function loadImages(userId: string, bookId: string, chapters: ExportChapter[]) {
  const ids = new Set(chapters.flatMap((c) => c.blocks.flatMap((b) => (b.type === 'img' ? [b.imageId] : []))));
  const images = new Map<string, ExportImage>();
  await Promise.all([...ids].map(async (id) => {
    try {
      const bytes = await readBlob(paths.bookFile(userId, bookId, `images/${id}`));
      const t = sniffImage(bytes);
      if (t) images.set(id, { id, bytes, ...t });
    } catch {
      // A missing picture is left out rather than failing the whole export.
    }
  }));
  return images;
}

async function loadCover(coverPath: string | null): Promise<ExportImage | undefined> {
  if (!coverPath) return undefined;
  try {
    const bytes = await readBlob(coverPath);
    const t = sniffImage(bytes);
    return t && t.type !== 'image/svg+xml' ? { id: 'cover', bytes, ...t } : undefined;
  } catch {
    return undefined;
  }
}

export async function gatherOriginal(userId: string, bookId: string): Promise<ExportBook | null> {
  const book = await getBook(userId, bookId);
  if (!book) return null;
  const sections = (await listSections(userId, bookId)).filter((s) => s.include);
  const chapters = await Promise.all(sections.map(async (s) => ({ title: s.title, blocks: (await readJson<{ blocks: Block[] }>(s.textPath)).blocks })));
  const [images, cover] = await Promise.all([loadImages(userId, bookId, chapters), loadCover(book.coverPath)]);
  return { id: book.id, title: book.title, author: book.author, language: book.language ?? 'en', cover, chapters, images, fileBase: book.title };
}

export async function gatherEdition(userId: string, editionId: string, number?: string | null): Promise<ExportBook | null> {
  const ed = await getEdition(userId, editionId);
  const v = number ?? ed?.currentVersion;
  if (!ed || !v) return null;
  const [book, version] = await Promise.all([getBook(userId, ed.bookId), getVersion(userId, ed.id, v)]);
  if (!book || !version) return null;
  const rows = await listVersionChapters(userId, version.manifest);
  const chapters = await Promise.all(rows.map(async (c) => ({
    title: c.kidTitle ?? c.title,
    subtitle: c.kidTitle ? c.title : undefined,
    recap: c.recap ?? undefined,
    blocks: (await readJson<{ blocks: Block[] }>(c.textPath)).blocks,
  })));
  const [images, cover] = await Promise.all([loadImages(userId, ed.bookId, chapters), loadCover(book.coverPath)]);
  return {
    id: `${ed.id}-${version.number}`,
    title: book.title,
    author: book.author,
    language: book.language ?? 'en',
    edition: { name: ed.name, version: version.number, versionName: version.name },
    cover,
    chapters,
    images,
    fileBase: `${book.title} (${ed.name.replace(/ · /g, ', ')}, v${version.number})`,
  };
}

/** The title-page note every edition carries. */
export const editionNote = (b: ExportBook) =>
  b.edition ? `${b.edition.name} · v${b.edition.version} “${b.edition.versionName}” · Featherbound` : 'Original text · Featherbound';
