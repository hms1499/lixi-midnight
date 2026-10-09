import { lazy, Suspense, type ReactNode } from 'react';
import { Route, Routes, useLocation } from 'react-router';
import { EnvelopeChecking } from './components/Envelope';
import { Layout, Page } from './components/Layout';
import { LoadBoundary } from './components/LoadBoundary';
import { Working } from './components/ui';
import { Home } from './pages/Home';
import { NotFound } from './pages/NotFound';
import { useServices } from './services';

// These pages need the SDK and its ledger WASM (~4.8 MB), so they load on demand and Home paints at once
// (user moments spec §3.1). `npm run build` fails if the shell starts importing WASM again.
const pages = {
  create: () => import('./pages/Create'),
  share: () => import('./pages/Share'),
  claim: () => import('./pages/Claim'),
  dashboard: () => import('./pages/Dashboard'),
};
const Create = lazy(() => pages.create().then((m) => ({ default: m.Create })));
const Share = lazy(() => pages.share().then((m) => ({ default: m.Share })));
const Claim = lazy(() => pages.claim().then((m) => ({ default: m.Claim })));
const Dashboard = lazy(() => pages.dashboard().then((m) => ({ default: m.Dashboard })));

/** Starts loading every lazy page, so a later click does not wait. */
export const preloadPages = (): void => {
  // A failed preload is fine: opening the page loads it again, and the load boundary explains a failure there.
  for (const load of Object.values(pages)) load().catch(() => undefined);
};

const Loading = () => (
  <Page>
    <Working>Lighting the lanterns…</Working>
  </Page>
);

const ClaimLoading = () => (
  <Page>
    <div className="mx-auto max-w-xl space-y-5 text-center">
      <EnvelopeChecking />
    </div>
  </Page>
);

/** A lazy page with its loading view, and a reload offer if its code fails to load. */
export const Lazy = ({ children, fallback = <Loading /> }: { children: ReactNode; fallback?: ReactNode }) => {
  const { reload } = useServices();
  // Keyed by path: react-router reuses route elements, so a failed page would otherwise stick to the next one.
  const { pathname } = useLocation();
  return (
    <LoadBoundary key={pathname} onReload={reload}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </LoadBoundary>
  );
};

export const App = () => (
  <Routes>
    <Route element={<Layout />}>
      <Route index element={<Home />} />
      <Route
        path="create"
        element={
          <Lazy>
            <Create />
          </Lazy>
        }
      />
      <Route
        path="share/:id"
        element={
          <Lazy>
            <Share />
          </Lazy>
        }
      />
      <Route
        path="c"
        element={
          <Lazy fallback={<ClaimLoading />}>
            <Claim />
          </Lazy>
        }
      />
      <Route
        path="dashboard"
        element={
          <Lazy>
            <Dashboard />
          </Lazy>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Route>
  </Routes>
);
