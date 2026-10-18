// Shared shapes for book import. The parser (parse-epub.ts / parse-pdf.ts) produces a
// ParsedBook from raw file bytes; the import job stores it and the review screen edits it.

/** One block of chapter content. `html` is a tiny, safe inline subset: <em>, <strong>, <br>. */
export type Block =
  | { type: 'p'; html: string }
  | { type: 'h'; level: 1 | 2 | 3; html: string }
  | { type: 'quote'; html: string }
  | { type: 'hr' }
  | { type: 'img'; imageId: string; alt: string };

export type SectionKind = 'chapter' | 'front' | 'back';

export type ParsedSection = {
  title: string;
  kind: SectionKind;
  /** Default include state: chapters true, front/back matter false. */
  include: boolean;
  blocks: Block[];
  words: number;
};

export type ParsedImage = { id: string; mediaType: string; bytes: Uint8Array };

export type ParsedMetadata = {
  title: string;
  authors: string[];
  description?: string;
  language?: string;
  publisher?: string;
  isbn?: string;
  /** From EPUB metadata (calibre:series or belongs-to-collection), if present. */
  series?: { name: string; position?: number };
  subjects: string[];
};

export type ParsedBook = {
  format: 'EPUB' | 'PDF';
  metadata: ParsedMetadata;
  sections: ParsedSection[];
  /** Embedded cover image, if the file has one. */
  cover?: ParsedImage;
  /** Images referenced by img blocks. */
  images: ParsedImage[];
  /** Notes for the review screen, e.g. "Chapter breaks were guessed from headings". */
  warnings: string[];
};

export type ParseResult =
  | { ok: true; book: ParsedBook }
  | { ok: false; reason: 'drm' | 'unsupported' | 'corrupt' | 'scanned'; detail: string };
