import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Designer } from './pages/Designer';
import { Checkout } from './pages/Checkout';
import { OrderStatusPage } from './pages/OrderStatus';
import { BuildGuide } from './pages/BuildGuide';
import { Admin } from './pages/Admin';
import { Privacy } from './pages/Privacy';
import { NotFound } from './pages/NotFound';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="tasarla" element={<Designer />} />
          <Route path="siparis" element={<Checkout />} />
          <Route path="siparis/:number" element={<OrderStatusPage />} />
          <Route path="kilavuz/onizleme" element={<BuildGuide preview />} />
          <Route path="kilavuz/:number" element={<BuildGuide />} />
          <Route path="admin" element={<Admin />} />
          <Route path="admin/:number" element={<Admin />} />
          <Route path="gizlilik" element={<Privacy />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
