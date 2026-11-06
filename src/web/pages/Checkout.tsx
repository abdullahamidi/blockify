import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatPrice } from '../../engine/index';
import type { CustomerInfo } from '../../shared/orders';
import { ApiError, api } from '../api';
import { Viewer3D } from '../components/Viewer3D';
import { useCatalog } from '../catalog';
import { clearDraft, loadDesign, photoStore } from '../state';
import { useModel } from '../useModel';
import { useQuote } from '../useQuote';

const EMPTY: CustomerInfo = { name: '', email: '', phone: '', address: '', district: '', city: '', postalCode: '', note: '' };

export function Checkout() {
  const design = useMemo(loadDesign, []);
  const catalog = useCatalog();
  const { model } = useModel(design, catalog);
  const { quote, error: quoteError } = useQuote(design);
  const photo = useMemo(() => photoStore.get(), []);
  const [customer, setCustomer] = useState<CustomerInfo>(EMPTY);
  const [kvkk, setKvkk] = useState(false);
  const [sharePhoto, setSharePhoto] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [sending, setSending] = useState(false);
  const navigate = useNavigate();

  const price = quote && quote.design.size === design.size ? quote.price : null;
  const field = (k: keyof CustomerInfo) => ({
    value: customer[k],
    onChange: (e: { target: { value: string } }) => setCustomer({ ...customer, [k]: e.target.value }),
    'aria-invalid': error?.field === k || undefined,
    name: k,
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!kvkk) {
      setError({ message: 'Devam etmek için aydınlatma metnini onaylamalısın.', field: 'kvkk' });
      return;
    }
    setSending(true);
    try {
      const res = await api.createOrder({
        design,
        customer,
        consent: { kvkk, photo: sharePhoto && !!photo },
        photo: sharePhoto && photo ? photo : undefined,
      });
      clearDraft();
      navigate(`/siparis/${res.number}?k=${encodeURIComponent(res.accessKey)}&yeni=1`);
    } catch (err) {
      setError(err instanceof ApiError ? { message: err.message, field: err.field } : { message: 'Sipariş gönderilemedi.' });
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="container page checkout">
      <div>
        <h1 className="page-title">Siparişi tamamla</h1>
        <form className="card form" onSubmit={submit} noValidate>
          <h2 className="ctl-title">Teslimat bilgileri</h2>
          <div className="grid2">
            <label>
              Ad soyad
              <input {...field('name')} autoComplete="name" required />
            </label>
            <label>
              Telefon
              <input {...field('phone')} autoComplete="tel" inputMode="tel" placeholder="05xx xxx xx xx" required />
            </label>
          </div>
          <label>
            E-posta
            <input {...field('email')} type="email" autoComplete="email" required />
          </label>
          <label>
            Adres
            <textarea {...field('address')} autoComplete="street-address" rows={3} required />
          </label>
          <div className="grid3">
            <label>
              İlçe
              <input {...field('district')} autoComplete="address-level2" required />
            </label>
            <label>
              İl
              <input {...field('city')} autoComplete="address-level1" required />
            </label>
            <label>
              Posta kodu
              <input {...field('postalCode')} autoComplete="postal-code" inputMode="numeric" maxLength={5} />
            </label>
          </div>
          <label>
            Not (isteğe bağlı)
            <textarea {...field('note')} rows={2} placeholder="Hediye paketi, kapı kodu vb." />
          </label>

          <h2 className="ctl-title">Ödeme</h2>
          <div className="pay-option">
            <input type="radio" checked readOnly id="pay-eft" />
            <label htmlFor="pay-eft">
              <b>Havale / EFT</b>
              <span className="muted small">
                Sipariş sonrası ödeme bilgilerini sana ileteceğiz. Ödemen ulaşınca figürün hazırlanmaya başlar.
              </span>
            </label>
          </div>

          <label className="check">
            <input type="checkbox" checked={kvkk} onChange={(e) => setKvkk(e.target.checked)} aria-invalid={error?.field === 'kvkk' || undefined} />
            <span>
              <Link to="/gizlilik" target="_blank">
                Aydınlatma metnini
              </Link>{' '}
              okudum, kişisel verilerimin siparişimin hazırlanması ve teslimi için işlenmesini kabul ediyorum.
            </span>
          </label>
          {photo && (
            <label className="check">
              <input type="checkbox" checked={sharePhoto} onChange={(e) => setSharePhoto(e.target.checked)} />
              <span>
                Fotoğrafımın küçük bir kopyasının yalnızca üretim kontrolü için siparişimle birlikte saklanmasına izin veriyorum
                (isteğe bağlı).
              </span>
            </label>
          )}

          {error && (
            <p className="form-error" role="alert">
              {error.message}
            </p>
          )}
          <button className="btn btn-primary btn-lg block" disabled={sending || !price}>
            {sending
              ? 'Gönderiliyor…'
              : price
                ? `Siparişi ver · ${formatPrice(price.total, price.currency)}`
                : quoteError
                  ? 'Fiyat alınamadı'
                  : 'Hesaplanıyor…'}
          </button>
        </form>
      </div>

      <aside className="checkout-summary">
        <div className="card">
          <div className="summary-stage">
            {model && <Viewer3D bricks={model.bricks} autoRotate azimuth={0.4} />}
          </div>
          <Link to="/tasarla" className="small link-muted">
            ← Tasarımı düzenle
          </Link>
          <table className="price-table">
            <tbody>
              <tr>
                <td>Parçalar ({quote?.stats.brickCount ?? '…'} adet)</td>
                <td>{price ? formatPrice(price.parts, price.currency) : 'Hesaplanıyor…'}</td>
              </tr>
              <tr>
                <td>Tasarım ve montaj kılavuzu</td>
                <td>{price ? formatPrice(price.designFee, price.currency) : '…'}</td>
              </tr>
              <tr>
                <td>Paketleme</td>
                <td>{price ? formatPrice(price.packaging, price.currency) : '…'}</td>
              </tr>
              <tr>
                <td>Kargo</td>
                <td>{price ? formatPrice(price.shipping, price.currency) : '…'}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td>Toplam</td>
                <td>{price ? formatPrice(price.total, price.currency) : '…'}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </aside>
    </section>
  );
}
