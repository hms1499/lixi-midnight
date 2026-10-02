import { Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { Claim } from './pages/Claim';
import { Create } from './pages/Create';
import { Dashboard } from './pages/Dashboard';
import { Home } from './pages/Home';
import { NotFound } from './pages/NotFound';
import { Share } from './pages/Share';

export const App = () => (
  <Routes>
    <Route element={<Layout />}>
      <Route index element={<Home />} />
      <Route path="create" element={<Create />} />
      <Route path="share/:id" element={<Share />} />
      <Route path="c" element={<Claim />} />
      <Route path="dashboard" element={<Dashboard />} />
      <Route path="*" element={<NotFound />} />
    </Route>
  </Routes>
);
