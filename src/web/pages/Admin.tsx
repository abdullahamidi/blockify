import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatPrice, getColor, HAIR_STYLE_LABELS, BOTTOM_STYLE_LABELS } from '../../engine/index';
import { ORDER_STATUSES, ORDER_STATUS_LABELS, type Order, type OrderStatus, type OrderSummary } from '../../shared/orders';
import { adminApi, ApiError } from '../api';
import { facialHairLabel, sizeLabel } from '../designLabels';
import { BomTable } from '../components/BomTable';
import { PrintableInstructions } from '../components/Instructions';
import { Viewer3D } from '../components/Viewer3D';

const TOKEN_KEY = 'blockify.admin.token';

function getToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function Admin() {
  const [token, setToken] = useState(getToken);
  const { number } = useParams();
  const logout = useCallback(() => {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* yok say */
    }
    setToken('');
  }, []);
  if (!token) return <Login onLogin={setToken} />;
  return number ? <OrderDetail token={token} number={number} onAuthError={logout} /> : <OrderList token={token} onAuthError={logout} />;
}

function Login({ onLogin }: { onLogin: (t: string) => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await adminApi(value).list();
      try {
        sessionStorage.setItem(TOKEN_KEY, value);
      } catch {
        /* yok say */
      }
      onLogin(value);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? 'Anahtar hatalı' : 'Sunucuya ulaşılamadı');
    }
  }
  return (
    <section className="container page narrow">
      <form className="card form" onSubmit={submit}>
        <h1 className="page-title">Yönetim paneli</h1>
        <label>
          Yönetici anahtarı
          <input type="password" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-primary">Giriş</button>
      </form>
    </section>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`badge badge-${status}`}>{ORDER_STATUS_LABELS[status]}</span>;
}

function OrderList({ token, onAuthError }: { token: string; onAuthError: () => void }) {
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const navigate = useNavigate();
  useEffect(() => {
    adminApi(token)
      .list()
      .then(setOrders)
      .catch((e) => (e instanceof ApiError && e.status === 401 ? onAuthError() : setOrders([])));
  }, [token, onAuthError]);

  const shown = (orders ?? []).filter((o) => filter === 'all' || o.status === filter);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const o of orders ?? []) c[o.status] = (c[o.status] ?? 0) + 1;
    return c;
  }, [orders]);

  return (
    <section className="container page">
      <div className="guide-head">
        <h1 className="page-title">Siparişler</h1>
        <button className="btn btn-ghost btn-sm" onClick={onAuthError}>
          Çıkış
        </button>
      </div>
      <div className="filters">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
          Tümü ({orders?.length ?? 0})
        </button>
        {ORDER_STATUSES.map((s) => (
          <button key={s} className={filter === s ? 'active' : ''} onClick={() => setFilter(s)}>
            {ORDER_STATUS_LABELS[s]} ({counts[s] ?? 0})
          </button>
        ))}
      </div>
      <div className="card table-wrap">
        {orders === null ? (
          <p className="muted">Yükleniyor…</p>
        ) : shown.length === 0 ? (
          <p className="muted">Bu filtrede sipariş yok.</p>
        ) : (
          <table className="orders">
            <thead>
              <tr>
                <th>No</th>
                <th>Tarih</th>
                <th>Müşteri</th>
                <th>İl</th>
                <th>Parça</th>
                <th>Tutar</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((o) => (
                <tr key={o.number} onClick={() => navigate(`/admin/${o.number}`)} className="clickable">
                  <td className="mono">{o.number}</td>
                  <td>{new Date(o.createdAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td>{o.customerName}</td>
                  <td>{o.city}</td>
                  <td>{o.stats.brickCount}</td>
                  <td>{formatPrice(o.price.total, o.price.currency)}</td>
                  <td>
                    <StatusBadge status={o.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

type Tab = 'pick' | 'guide' | 'label';

function OrderDetail({ token, number, onAuthError }: { token: string; number: string; onAuthError: () => void }) {
  const api = useMemo(() => adminApi(token), [token]);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('pick');
  const [form, setForm] = useState({ status: 'awaiting_payment' as OrderStatus, carrier: '', trackingNo: '', adminNote: '' });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .get(number)
      .then((o) => {
        setOrder(o);
        setForm({ status: o.status, carrier: o.carrier ?? '', trackingNo: o.trackingNo ?? '', adminNote: o.adminNote ?? '' });
      })
      .catch((e) => (e instanceof ApiError && e.status === 401 ? onAuthError() : setError(e.message)));
  }, [api, number, onAuthError]);

  async function save(e: FormEvent) {
    e.preventDefault();
    const o = await api.update(number, form);
    setOrder(o);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (error) return <section className="container page">{error}</section>;
  if (!order) return <section className="container page muted">Yükleniyor…</section>;
  const d = order.design;
  const c = order.customer;
  const customerLink = `${window.location.origin}/siparis/${order.number}?k=${order.accessKey}`;

  return (
    <section className="container page admin-detail">
      <div className="guide-head no-print">
        <div>
          <Link to="/admin" className="small link-muted">
            ← Siparişler
          </Link>
          <h1 className="page-title">
            {order.number} <StatusBadge status={order.status} />
          </h1>
          <p className="muted small">
            {new Date(order.createdAt).toLocaleString('tr-TR')} · {formatPrice(order.price.total, order.price.currency)} · parça maliyeti{' '}
            {formatPrice(order.price.partsCost, order.price.currency)}
          </p>
        </div>
      </div>

      <div className="admin-grid no-print">
        <div className="card">
          <h2 className="ctl-title">Müşteri</h2>
          <p>
            <b>{c.name}</b>
            <br />
            {c.phone} · {c.email}
            <br />
            {c.address}
            <br />
            {c.district} / {c.city} {c.postalCode}
          </p>
          {c.note && <p className="notice">Not: {c.note}</p>}
          <p className="small">
            Müşteri bağlantısı:{' '}
            <a href={customerLink} target="_blank" rel="noreferrer">
              takip sayfası
            </a>
          </p>
          {order.hasPhoto && <img className="admin-photo" src={api.photoUrl(order.number)} alt="Müşteri fotoğrafı" />}
        </div>

        <form className="card form" onSubmit={save}>
          <h2 className="ctl-title">Durum ve kargo</h2>
          <label>
            Durum
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as OrderStatus })}>
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ORDER_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <div className="grid2">
            <label>
              Kargo firması
              <input value={form.carrier} onChange={(e) => setForm({ ...form, carrier: e.target.value })} />
            </label>
            <label>
              Takip no
              <input value={form.trackingNo} onChange={(e) => setForm({ ...form, trackingNo: e.target.value })} />
            </label>
          </div>
          <label>
            İç not
            <textarea rows={3} value={form.adminNote} onChange={(e) => setForm({ ...form, adminNote: e.target.value })} />
          </label>
          <button className="btn btn-primary">{saved ? 'Kaydedildi ✓' : 'Kaydet'}</button>
          <ul className="history small muted">
            {order.history.map((h) => (
              <li key={h.at + h.status}>
                {new Date(h.at).toLocaleString('tr-TR')} · {ORDER_STATUS_LABELS[h.status]}
              </li>
            ))}
          </ul>
        </form>

        <div className="card">
          <div className="summary-stage">
            <Viewer3D bricks={order.bricks} />
          </div>
          <ul className="design-summary small">
            <li>Boy: {sizeLabel(d.size)}</li>
            <li>Ten: {getColor(d.skin).name}</li>
            <li>
              Saç: {HAIR_STYLE_LABELS[d.hairStyle]}, {getColor(d.hairColor).name}
            </li>
            <li>Sakal: {facialHairLabel(d.facialHair)}</li>
            <li>Gözlük: {d.glasses ? getColor(d.glassesColor).name : 'yok'}</li>
            <li>
              Üst: {getColor(d.shirtColor).name}
              {d.jacket ? `, ceket ${getColor(d.jacketColor).name}` : ''}
            </li>
            <li>
              Alt: {BOTTOM_STYLE_LABELS[d.bottomStyle]}, {getColor(d.bottomColor).name}
            </li>
            <li>Ayakkabı: {getColor(d.shoeColor).name}</li>
            <li>Kaide: {d.base ? getColor(d.baseColor).name : 'yok'}</li>
          </ul>
        </div>
      </div>

      <div className="tabs no-print">
        <button className={tab === 'pick' ? 'active' : ''} onClick={() => setTab('pick')}>
          Toplama listesi
        </button>
        <button className={tab === 'guide' ? 'active' : ''} onClick={() => setTab('guide')}>
          Montaj kılavuzu
        </button>
        <button className={tab === 'label' ? 'active' : ''} onClick={() => setTab('label')}>
          Kargo etiketi
        </button>
        <button className="btn btn-ghost btn-sm print-btn" onClick={() => window.print()}>
          Yazdır
        </button>
      </div>

      <div className="card print-area">
        {tab === 'pick' && (
          <>
            <h2 className="print-only">
              {order.number} · Toplama listesi · {c.name}
            </h2>
            <BomTable bom={order.bom} picking />
          </>
        )}
        {tab === 'guide' && <PrintableInstructions bricks={order.bricks} title={`Montaj kılavuzu · ${order.number}`} />}
        {tab === 'label' && (
          <div className="ship-label">
            <p className="small muted">ALICI</p>
            <p className="big">
              <b>{c.name}</b>
            </p>
            <p>
              {c.address}
              <br />
              {c.district} / {c.city} {c.postalCode}
              <br />
              Tel: {c.phone}
            </p>
            <p className="mono">Sipariş: {order.number}</p>
          </div>
        )}
      </div>
    </section>
  );
}
