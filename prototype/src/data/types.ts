export type CoverSpec = { from: string; to: string; emblem: string; ink?: string };

export type FilterCategory =
  | 'language'
  | 'violence'
  | 'scariness'
  | 'death'
  | 'romance'
  | 'substances'
  | 'mature'
  | 'meanness'
  | 'crude';

export type FilterLevel = 'keep' | 'soften' | 'remove';

export type ReadingMode = 'read-aloud' | 'independent';

export type PictureSettings = {
  on: boolean;
  every: number; // roughly one picture every N pages
  style: string;
  look: string;
};

export type EditionSettings = {
  targetAge: number;
  readingMode: ReadingMode;
  filters: Record<FilterCategory, FilterLevel>;
  faithfulness: number; // 0 = author's words, 100 = free retelling
  readingLevelShift: number; // -2..+2 grade levels from the default
  keepNames: boolean;
  extras: { kidTitles: boolean; recaps: boolean; glossary: boolean };
  picture: PictureSettings;
  notes: string;
};

export type Version = {
  number: string;
  name: string;
  description: string;
  guidance: string;
  date: string;
  cost: number;
  level: 'initial' | 'major' | 'minor' | 'patch';
};

export type EditionStatus = 'ready' | 'samples-ready' | 'making-samples' | 'running' | 'paused-cap';

export type Edition = {
  id: string;
  bookId: string;
  name: string;
  createdAt: string;
  settings: EditionSettings;
  sampleGuidance: string[];
  status: EditionStatus;
  run?: {
    chapter: number;
    of: number;
    spent: number;
    estimate: number;
    cap: number;
    // Set for refinement runs.
    level?: 'major' | 'minor' | 'patch';
    guidance?: string;
    versionName?: string;
    versionDescription?: string;
  };
  versions: Version[];
  currentVersion: string;
};

export type Series = {
  id: string;
  name: string;
  author: string;
  cover: CoverSpec;
};

export type Book = {
  id: string;
  title: string;
  author: string;
  seriesId?: string;
  seriesOrder?: number;
  seriesLabel?: string;
  genres: string[];
  tags: string[];
  description: string;
  cover: CoverSpec;
  coverUrl?: string;
  words: number;
  chapters: number;
  addedAt: string;
  format: 'EPUB' | 'PDF';
  hasRealText?: boolean;
};

export type Run = {
  id: string;
  date: string;
  bookId: string;
  editionId?: string;
  type: 'Analysis' | 'Samples' | 'Full adaptation' | 'Refinement' | 'Illustrations' | 'Visual research';
  tokensIn: number;
  tokensOut: number;
  images: number;
  estimate: number;
  actual: number;
};

export type Progress = { chapter: number; percent: number; updatedAt: string };
