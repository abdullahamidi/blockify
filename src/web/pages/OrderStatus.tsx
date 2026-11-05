import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { formatPrice } from '../../engine/index';
import type { Brick } from '../../engine/packer';
import { ORDER_STATUSES, ORDER_STATUS_LABELS, type PublicConfig, type PublicOrder } from '../../shared/orders';
import { api } from '../api';
import { Viewer3D } from '../components/Viewer3D';

const FLOW = ORDER_STATUSES.filter((s) => s !== 'cancelled');

export function OrderStatusPage() {
  const { number = '' } = useParams();
  const [params] = useSearchParams();
  const key = params.get('k') ?? '';
  const isNew = params.get('yeni') === '1';
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [bricks, setBricks] = useState<Brick[]>([]);

  useEffect(() => {
    api.order(number, key).then(setOrder).catch((e) => setError(e.message));
    api
      .build(number, key)
      .then((b) => setBricks(b.bricks))
      .catch(() => undefined);
    api.config().then(setConfig).catch(() => undefined);
  }, [number, key]);

  if (error)
    return (
      <section className="container page narrow center">
        <h1>Sipariş bulunamadı</h1>
        <p className="muted">Bağlantı eksik ya da hatalı olabilir. Sipariş e-postandaki bağlantıyı kullanmayı dene.</p>
      </section>
    );
  if (!order) return <section className="container page narrow center muted">Yükleniyor…</section>;

  const link = `${window.location.origin}/siparis/${order.number}?k=${encodeURIComponent(key)}`;
  const stepIndex = FLOW.indexOf(order.status as (typeof FLOW)[number]);

  return (
    <section className="container page order-page">
      {isNew && (
        <div className="card success-card">
          <h1>Teşekkürler {order.customerName}! 🎉</h1>
          <p>
            Siparişin alındı. Sipariş numaran <b>{order.number}</b>. Bu sayfanın bağlantısını sakla; siparişinin durumunu ve 3D montaj
            kılavuzunu buradan takip edebilirsin.
          </p>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              void navigator.clipboard?.writeText(link).then(() => setCopied(true));
            }}
          >
            {copied ? 'Bağlantı kopyalandı ✓' : 'Bağlantıyı kopyala'}
          </button>
        </div>
      )}

      <div className="order-grid">
        <div>
          {!isNew && <h1 className="page-title">Sipariş {order.number}</h1>}

          {order.status === 'awaiting_payment' && (
            <div className="card pay-card">
              <h2 className="ctl-title">Ödeme bilgileri</h2>
              <p>
                <b>{formatPrice(order.price.total, order.price.currency)}</b> tutarını aşağıdaki hesaba gönderirken açıklamaya sipariş
                numaranı (<b>{order.number}</b>) yazmayı unutma.
              </p>
              {config && (
                <dl className="bank">
                  <dt>Banka</dt>
                  <dd>{config.bank.name}</dd>
                  <dt>Alıcı</dt>
                  <dd>{config.bank.holder}</dd>
                  <dt>IBAN</dt>
                  <dd className="mono">{config.bank.iban}</dd>
                </dl>
              )}
            </div>
          )}

          <div className="card">
            <h2 className="ctl-title">Durum</h2>
            {order.status === 'cancelled' ? (
              <p className="form-error">Bu sipariş iptal edildi.</p>
            ) : (
              <ol className="timeline">
                {FLOW.map((s, i) => {
                  const h = order.history.find((x) => x.status === s);
                  return (
                    <li key={s} className={i <= stepIndex ? 'done' : ''}>
                      <span className="tl-dot" />
                      <span>{ORDER_STATUS_LABELS[s]}</span>
                      {h && <span className="muted small">{new Date(h.at).toLocaleString('tr-TR')}</span>}
                    </li>
                  );
                })}
              </ol>
            )}
            {order.trackingNo && (
              <p>
                Kargo: <b>{order.carrier || 'Kargo'}</b> · Takip no: <b className="mono">{order.trackingNo}</b>
              </p>
            )}
          </div>

          <div className="card">
            <h2 className="ctl-title">Montaj kılavuzu</h2>
            <p className="muted">
              Kutun geldiğinde figürünü {order.stats.steps} adımda, her adımı 3D olarak çevirerek yapabilirsin. Basılı kılavuz da kutunda.
            </p>
            <Link className="btn btn-primary" to={`/kilavuz/${order.number}?k=${encodeURIComponent(key)}`}>
              3D kılavuzu aç
            </Link>
          </div>
        </div>
        <aside className="card">
          <div className="summary-stage">
            <Viewer3D bricks={bricks} autoRotate />
          </div>
          <p className="center muted small">
            {order.stats.brickCount} parça · {(order.stats.heightMm / 10).toFixed(1)} cm ·{' '}
            {formatPrice(order.price.total, order.price.currency)}
          </p>
          <p className="center small muted">Sorun mu var? {config?.contactEmail}</p>
        </aside>
      </div>
    </section>
  );
}
