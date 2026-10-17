import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { BOOKS, EDITIONS, PROGRESS, SERIES, editionName } from './data/library';
import type { Book, Edition, EditionSettings, Progress, Series, Version } from './data/types';
import { DEFAULT_AI } from './data/models';
import type { AiChoice, Provider } from './data/models';
import Tuft from './components/Tuft';
import type { TuftPose } from './components/Tuft';

// In-memory store for the prototype. Nothing is saved to a server; a reload resets the library
// (except view preferences and the hand-off lock, which live in localStorage like the real app would).

export type ViewPrefs = {
  view: 'shelf' | 'list';
  groupBy: 'series' | 'author' | 'genre' | 'none';
  editions: 'nested' | 'separate';
  sort: 'title' | 'author' | 'series' | 'recent-read' | 'recent-added';
  filters: { genre: string[]; age: string[]; mode: string[]; illustrated: boolean | null; status: string[] };
};

const DEFAULT_PREFS: ViewPrefs = {
  view: 'shelf',
  groupBy: 'series',
  editions: 'nested',
  sort: 'series',
  filters: { genre: [], age: [], mode: [], illustrated: null, status: [] },
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: preferences just won't persist */
  }
}

// Each account has its own private library, settings and API keys. Nothing is shared between accounts.
// The prototype only keeps a masked hint in memory and never stores or sends the key itself.
export type SavedKey = { hint: string; added: string; status: 'ok' | 'checking' };
export type AiSettings = AiChoice & { keys: Partial<Record<Provider, SavedKey>> };

type Toast = { id: number; text: string; pose: TuftPose };

type Store = {
  books: Book[];
  series: Series[];
  editions: Edition[];
  progress: Record<string, Progress>;
  approved: { email: string; admin?: boolean; added: string }[];
  pin: string;
  prefs: ViewPrefs;
  lock: { editionId: string; bookId: string } | null;
  ai: AiSettings;
  setAi: (p: Partial<AiSettings>) => void;
  setPrefs: (p: Partial<ViewPrefs>) => void;
  updateBook: (id: string, patch: Partial<Book>) => void;
  addBook: (b: Book) => void;
  deleteBook: (id: string) => void;
  addSeries: (s: Series) => void;
  createEdition: (bookId: string, s: EditionSettings) => Edition;
  updateEdition: (id: string, patch: Partial<Edition>) => void;
  deleteEdition: (id: string) => void;
  addVersion: (id: string, v: Version) => void;
  setCurrentVersion: (id: string, number: string) => void;
  setProgress: (key: string, p: Progress) => void;
  addEmail: (email: string) => void;
  removeEmail: (email: string) => void;
  setPin: (pin: string) => void;
  setLock: (l: Store['lock']) => void;
  toast: (text: string, pose?: TuftPose) => void;
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [books, setBooks] = useState<Book[]>(BOOKS);
  const [series, setSeries] = useState<Series[]>(SERIES);
  const [editions, setEditions] = useState<Edition[]>(EDITIONS);
  const [progress, setProgressState] = useState<Record<string, Progress>>(PROGRESS);
  const [approved, setApproved] = useState<Store['approved']>([{ email: 'greg.brunk@gmail.com', admin: true, added: '2026-10-17' }]);
  const [pin, setPin] = useState('1234');
  const [prefs, setPrefsState] = useState<ViewPrefs>(() => load('fb.prefs', DEFAULT_PREFS));
  const [lock, setLockState] = useState<Store['lock']>(() => {
    try {
      const raw = localStorage.getItem('fb.lock');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [aiChoice, setAiChoice] = useState<AiChoice>(() => load('fb.models', DEFAULT_AI));
  const [aiKeys, setAiKeys] = useState<Pick<AiSettings, 'keys'>>({
    keys: { gateway: { hint: '••••3f9a', added: '2026-10-17', status: 'ok' } },
  });
  const ai = useMemo<AiSettings>(() => ({ ...aiChoice, ...aiKeys }), [aiChoice, aiKeys]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  useEffect(() => { save('fb.prefs', prefs); }, [prefs]);
  useEffect(() => { save('fb.models', { text: aiChoice.text, images: aiChoice.images }); }, [aiChoice]);

  const toast = useCallback((text: string, pose: TuftPose = 'cheer') => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, text, pose }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);

  const store = useMemo<Store>(
    () => ({
      books, series, editions, progress, approved, pin, prefs, lock, ai,
      setAi: ({ text, images, keys }) => {
        if (text || images) setAiChoice((c) => ({ text: text ?? c.text, images: images ?? c.images }));
        if (keys) setAiKeys({ keys });
      },
      setPrefs: (p) => setPrefsState((prev) => ({ ...prev, ...p })),
      updateBook: (id, patch) => setBooks((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b))),
      addBook: (b) => setBooks((bs) => [...bs, b]),
      deleteBook: (id) => {
        setBooks((bs) => bs.filter((b) => b.id !== id));
        setEditions((es) => es.filter((e) => e.bookId !== id));
      },
      addSeries: (s) => setSeries((ss) => [...ss, s]),
      createEdition: (bookId, s) => {
        const e: Edition = {
          id: `${bookId}-${Date.now().toString(36)}`,
          bookId,
          name: editionName(s),
          createdAt: '2026-10-17',
          settings: s,
          sampleGuidance: [],
          status: 'making-samples',
          versions: [],
          currentVersion: '',
        };
        setEditions((es) => [...es, e]);
        return e;
      },
      updateEdition: (id, patch) => setEditions((es) => es.map((e) => (e.id === id ? { ...e, ...patch } : e))),
      deleteEdition: (id) => setEditions((es) => es.filter((e) => e.id !== id)),
      addVersion: (id, v) =>
        setEditions((es) => es.map((e) => (e.id === id ? { ...e, versions: [...e.versions, v], currentVersion: v.number, status: 'ready', run: undefined } : e))),
      setCurrentVersion: (id, number) => setEditions((es) => es.map((e) => (e.id === id ? { ...e, currentVersion: number } : e))),
      setProgress: (key, p) => setProgressState((pr) => ({ ...pr, [key]: p })),
      addEmail: (email) => setApproved((a) => (a.some((x) => x.email === email) ? a : [...a, { email, added: '2026-10-17' }])),
      removeEmail: (email) => setApproved((a) => a.filter((x) => x.email !== email || x.admin)),
      setPin,
      setLock: (l) => {
        setLockState(l);
        try {
          if (l) localStorage.setItem('fb.lock', JSON.stringify(l));
          else localStorage.removeItem('fb.lock');
        } catch {
          /* ignore */
        }
      },
      toast,
    }),
    [books, series, editions, progress, approved, pin, prefs, lock, ai, toast],
  );

  return (
    <Ctx.Provider value={store}>
      {children}
      <div aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            <Tuft pose={t.pose} size={40} />
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside provider');
  return s;
}

export function currentVersionOf(e: Edition) {
  return e.versions.find((v) => v.number === e.currentVersion);
}

export function nextVersion(current: string, level: 'major' | 'minor' | 'patch') {
  const [ma, mi, pa] = (current || '1.0.0').split('.').map(Number);
  if (level === 'major') return `${ma + 1}.0.0`;
  if (level === 'minor') return `${ma}.${mi + 1}.0`;
  return `${ma}.${mi}.${pa + 1}`;
}
