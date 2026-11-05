import { useMemo, useRef, useState, type DragEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BOTTOM_STYLES,
  BOTTOM_STYLE_LABELS,
  FACIAL_HAIR,
  FACIAL_HAIR_LABELS,
  HAIR_STYLES,
  HAIR_STYLE_LABELS,
  colorsInGroup,
  formatPrice,
  generateModel,
  getColor,
  type FigureDesign,
} from '../../engine/index';
import { analyzePhoto, loadImage, makeThumbnail, preloadSegmenter } from '../analysis/analyzePhoto';
import { ColorPicker, Segmented, Toggle } from '../components/ColorPicker';
import { Viewer3D } from '../components/Viewer3D';
import { photoStore, useStoredDesign } from '../state';

type Status = 'idle' | 'analyzing' | 'done' | 'error';

const SKIN = colorsInGroup('skin');
const HAIR = colorsInGroup('hair');
const CLOTHES = colorsInGroup('clothes');
const BASE = colorsInGroup('base');
const GLASSES = ['black', 'darkGray', 'darkBrown', 'reddishBrown', 'darkRed', 'darkBlue', 'lightGray', 'yellow', 'red'].map(getColor);

export function Designer() {
  const [design, setDesign] = useStoredDesign();
  const [photo, setPhoto] = useState<string | null>(() => photoStore.get());
  const [status, setStatus] = useState<Status>('idle');
  const [notes, setNotes] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const model = useMemo(() => generateModel(design), [design]);

  const set = <K extends keyof FigureDesign>(key: K, value: FigureDesign[K]) => setDesign({ ...design, [key]: value });

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setStatus('error');
      setNotes(['Lütfen bir fotoğraf dosyası seç (JPG, PNG, HEIC).']);
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setStatus('error');
      setNotes(['Fotoğraf 20 MB’tan küçük olmalı.']);
      return;
    }
    setStatus('analyzing');
    setNotes([]);
    try {
      const img = await loadImage(file);
      const thumb = makeThumbnail(img);
      setPhoto(thumb);
      photoStore.set(thumb);
      const result = await analyzePhoto(img);
      setDesign({ ...design, ...result.design });
      setNotes(result.notes);
      setStatus('done');
    } catch (err) {
      console.error(err);
      setStatus('error');
      setNotes([
        err instanceof Error && err.message.startsWith('Görsel')
          ? err.message
          : 'Otomatik analiz şu an yapılamadı. Özellikleri aşağıdan elle seçebilirsin.',
      ]);
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void handleFile(e.dataTransfer.files?.[0]);
  };

  const openPicker = () => {
    preloadSegmenter();
    fileInput.current?.click();
  };

  return (
    <section className="container page designer">
      <div className="designer-upload">
        <h1 className="page-title">Figürünü tasarla</h1>

        <div
          className={`card dropzone ${dragging ? 'dragging' : ''} ${photo ? 'has-photo' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onPointerEnter={preloadSegmenter}
        >
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              void handleFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          {photo ? (
            <div className="photo-row">
              <img src={photo} alt="Yüklediğin fotoğraf" className="photo-thumb" />
              <div>
                <b>{status === 'analyzing' ? 'Fotoğrafın analiz ediliyor…' : 'Fotoğrafın yüklendi'}</b>
                <p className="muted small">
                  {status === 'analyzing'
                    ? 'İlk seferde analiz modeli indirildiği için birkaç saniye sürebilir.'
                    : 'Özellikler fotoğraftan alındı. Aşağıdan istediğin gibi değiştirebilirsin.'}
                </p>
                <button className="btn btn-ghost btn-sm" onClick={openPicker} disabled={status === 'analyzing'}>
                  Başka fotoğraf seç
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="dropzone-btn" onClick={openPicker} disabled={status === 'analyzing'}>
              <span className="dz-icon" aria-hidden="true">
                📷
              </span>
              <b>{status === 'analyzing' ? 'Analiz ediliyor…' : 'Fotoğrafını yükle'}</b>
              <span className="muted small">
                Yüzünün ve üst kıyafetinin net göründüğü, tek kişilik bir fotoğraf en iyi sonucu verir. Sürükleyip bırakabilirsin.
              </span>
            </button>
          )}
          {status === 'analyzing' && <div className="scanbar" aria-hidden="true" />}
          {notes.length > 0 && (
            <ul className={`notes ${status === 'error' ? 'error' : ''}`}>
              {notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
          <p className="privacy-hint small muted">🔒 Fotoğrafın sunucumuza yüklenmez, analiz tarayıcında yapılır.</p>
        </div>
      </div>

      <div className="designer-controls">

        <div className="card controls">
          <h2 className="ctl-title">Yüz</h2>
          <ColorPicker label="Ten rengi" value={design.skin} colors={SKIN} onChange={(v) => set('skin', v)} />
          <Toggle label="Gözlük" checked={design.glasses} onChange={(v) => set('glasses', v)} />
          {design.glasses && (
            <ColorPicker label="Çerçeve rengi" value={design.glassesColor} colors={GLASSES} onChange={(v) => set('glassesColor', v)} />
          )}
        </div>

        <div className="card controls">
          <h2 className="ctl-title">Saç ve sakal</h2>
          <Segmented label="Saç modeli" value={design.hairStyle} options={HAIR_STYLES} labels={HAIR_STYLE_LABELS} onChange={(v) => set('hairStyle', v)} />
          <ColorPicker label="Saç rengi" value={design.hairColor} colors={HAIR} onChange={(v) => set('hairColor', v)} />
          <Segmented label="Sakal / bıyık" value={design.facialHair} options={FACIAL_HAIR} labels={FACIAL_HAIR_LABELS} onChange={(v) => set('facialHair', v)} />
        </div>

        <div className="card controls">
          <h2 className="ctl-title">Kıyafet</h2>
          <ColorPicker label={design.jacket ? 'İçteki üst' : 'Üst'} value={design.shirtColor} colors={CLOTHES} onChange={(v) => set('shirtColor', v)} />
          <Toggle label="Ceket / hırka" checked={design.jacket} onChange={(v) => set('jacket', v)} />
          {design.jacket && (
            <ColorPicker label="Ceket rengi" value={design.jacketColor} colors={CLOTHES} onChange={(v) => set('jacketColor', v)} />
          )}
          <Segmented label="Alt" value={design.bottomStyle} options={BOTTOM_STYLES} labels={BOTTOM_STYLE_LABELS} onChange={(v) => set('bottomStyle', v)} />
          <ColorPicker label="Alt rengi" value={design.bottomColor} colors={CLOTHES} onChange={(v) => set('bottomColor', v)} />
          <ColorPicker label="Ayakkabı" value={design.shoeColor} colors={CLOTHES} onChange={(v) => set('shoeColor', v)} />
        </div>

        <div className="card controls">
          <h2 className="ctl-title">Kaide</h2>
          <Toggle label="Figür bir kaide üzerinde dursun" checked={design.base} onChange={(v) => set('base', v)} />
          {design.base && <ColorPicker label="Kaide rengi" value={design.baseColor} colors={BASE} onChange={(v) => set('baseColor', v)} />}
        </div>
      </div>

      <aside className="designer-preview">
        <div className="card preview-card">
          <div className="preview-stage">
            <Viewer3D bricks={model.bricks} azimuth={0.5} />
          </div>
          <div className="stats">
            <div>
              <b>{model.stats.brickCount}</b>
              <span>parça</span>
            </div>
            <div>
              <b>{(model.stats.heightMm / 10).toFixed(1)} cm</b>
              <span>boy</span>
            </div>
            <div>
              <b>{model.stats.steps}</b>
              <span>adım</span>
            </div>
          </div>
          <div className="price-row">
            <div>
              <span className="muted small">Kargo dahil</span>
              <div className="price">{formatPrice(model.price.total, model.price.currency)}</div>
            </div>
            <button className="btn btn-primary btn-lg" onClick={() => navigate('/siparis')} disabled={status === 'analyzing'}>
              Siparişe geç
            </button>
          </div>
          <Link to="/kilavuz/onizleme" className="small link-muted">
            Montaj kılavuzunu önizle →
          </Link>
        </div>
      </aside>
    </section>
  );
}
