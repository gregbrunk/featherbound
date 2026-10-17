import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { StoreProvider, useStore } from './store';
import AppShell from './components/AppShell';
import Library from './screens/Library';
import SeriesPage from './screens/SeriesPage';
import BookPage from './screens/BookPage';
import AddBook from './screens/AddBook';
import Wizard from './screens/Wizard';
import SampleReview from './screens/SampleReview';
import RunProgress from './screens/RunProgress';
import Refine from './screens/Refine';
import History from './screens/History';
import Reader from './screens/Reader';
import Settings from './screens/Settings';
import MeetTuft from './screens/MeetTuft';
import { NotApproved, SignIn } from './screens/Gate';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

// While hand-off mode is on, every route leads back to the locked book.
function LockGuard({ children }: { children: React.ReactNode }) {
  const { lock } = useStore();
  const { pathname } = useLocation();
  if (lock && pathname !== `/read/edition/${lock.editionId}`) return <Navigate to={`/read/edition/${lock.editionId}`} replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <ScrollToTop />
        <LockGuard>
          <Routes>
            <Route path="/signin" element={<SignIn />} />
            <Route path="/private" element={<NotApproved />} />
            <Route path="/read/:kind/:id" element={<Reader />} />
            <Route element={<AppShell />}>
              <Route path="/" element={<Library />} />
              <Route path="/series/:id" element={<SeriesPage />} />
              <Route path="/book/:id" element={<BookPage />} />
              <Route path="/book/:id/new" element={<Wizard />} />
              <Route path="/add" element={<AddBook />} />
              <Route path="/edition/:id/samples" element={<SampleReview />} />
              <Route path="/edition/:id/progress" element={<RunProgress />} />
              <Route path="/edition/:id/refine" element={<Refine />} />
              <Route path="/edition/:id/history" element={<History />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/design" element={<MeetTuft />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </LockGuard>
      </HashRouter>
    </StoreProvider>
  );
}
