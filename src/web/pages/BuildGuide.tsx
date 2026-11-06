import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import type { BomLine } from '../../engine/bom';
import type { Brick } from '../../engine/packer';
import { api } from '../api';
import { BomTable } from '../components/BomTable';
import { InteractiveInstructions } from '../components/Instructions';
import { useCatalog } from '../catalog';
import { loadDesign } from '../state';
import { useModel } from '../useModel';

export function BuildGuide({ preview }: { preview?: boolean }) {
  const { number = '' } = useParams();
  const [params] = useSearchParams();
  const key = params.get('k') ?? '';
  const previewDesign = useMemo(loadDesign, []);
  const catalog = useCatalog();
  const { model: local } = useModel(previewDesign, preview ? catalog : null);
  const [fetched, setData] = useState<{ bricks: Brick[]; bom: BomLine[] } | null>(null);
  const data = preview ? local : fetched;
  const [error, setError] = useState('');

  useEffect(() => {
    if (preview) return;
    api.build(number, key).then(setData).catch((e) => setError(e.message));
  }, [preview, number, key]);

  if (error)
    return (
      <section className="container page narrow center">
        <h1>Kılavuz bulunamadı</h1>
        <p className="muted">Bağlantı hatalı olabilir.</p>
      </section>
    );
  if (!data) return <section className="container page narrow center muted">Yükleniyor…</section>;

  return (
    <section className="container page">
      <div className="guide-head">
        <div>
          <h1 className="page-title">Montaj kılavuzu</h1>
          <p className="muted">
            {preview ? 'Bu, şu anki tasarımının önizlemesi. ' : `Sipariş ${number}. `}
            Her adımda gösterilen katları alttan üste doğru yerleştir. Plan üstten görünüştür, figürün önü aşağıda.
          </p>
        </div>
        {preview && (
          <Link className="btn btn-ghost" to="/tasarla">
            ← Tasarıma dön
          </Link>
        )}
      </div>
      <InteractiveInstructions bricks={data.bricks} />
      <details className="card bom-details">
        <summary>Tüm parça listesi</summary>
        <BomTable bom={data.bom} />
      </details>
    </section>
  );
}
