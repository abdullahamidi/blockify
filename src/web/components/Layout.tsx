import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Logo } from './Logo';

export function Layout() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <div className="app">
      <header className="site-header no-print">
        <div className="container header-inner">
          <Link to="/" aria-label="Blockify ana sayfa">
            <Logo />
          </Link>
          <nav className="nav">
            <NavLink to="/#nasil">Nasıl çalışır?</NavLink>
            <NavLink to="/#sss">SSS</NavLink>
            <Link to="/tasarla" className="btn btn-primary btn-sm">
              Figürünü tasarla
            </Link>
          </nav>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="site-footer no-print">
        <div className="container footer-inner">
          <div>
            <Logo size={26} />
            <p className="muted small">Fotoğrafından sana özel tuğla figür. Standart, kolay bulunan parçalarla.</p>
          </div>
          <div className="footer-links">
            <Link to="/gizlilik">Gizlilik ve KVKK</Link>
            <Link to="/tasarla">Tasarla</Link>
          </div>
          <p className="muted small">© {new Date().getFullYear()} Blockify</p>
        </div>
      </footer>
    </div>
  );
}
