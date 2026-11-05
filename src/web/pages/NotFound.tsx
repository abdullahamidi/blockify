import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <section className="container page narrow center">
      <h1>Bu sayfa bulunamadı</h1>
      <p className="muted">Aradığın sayfa taşınmış ya da hiç var olmamış olabilir.</p>
      <Link to="/" className="btn btn-primary">
        Ana sayfaya dön
      </Link>
    </section>
  );
}
