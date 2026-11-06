import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DEFAULT_DESIGN, FACE_SCALE, SIZES, SIZE_LABELS, sanitizeDesign, type FaceKey, type FigureDesign, type FigureSize } from '../../engine/index';
import { Viewer3D } from '../components/Viewer3D';
import { useCatalog } from '../catalog';
import { useModel } from '../useModel';

const EXPRESSION_RANGES = {
  smile: { min: 0, max: 3 },
  browRaiseL: { min: -1, max: 2 },
  browRaiseR: { min: -1, max: 2 },
  eyeOpen: { min: 0, max: 2 },
} as const;

function decode(d: string | null): FigureDesign {
  if (!d) return sanitizeDesign({});
  try {
    const b64 = d.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const json = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
    return sanitizeDesign(JSON.parse(json));
  } catch {
    return sanitizeDesign(DEFAULT_DESIGN);
  }
}

function encode(design: FigureDesign): string {
  const bytes = new TextEncoder().encode(JSON.stringify(design));
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function SizeView({ design, size, catalog }: { design: FigureDesign; size: FigureSize; catalog: ReturnType<typeof useCatalog> }) {
  const sized = useMemo(() => ({ ...design, size }), [design, size]);
  const { model } = useModel(sized, catalog);
  return (
    <figure style={{ flex: 1, margin: 0, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        {model && <Viewer3D bricks={model.bricks} azimuth={0.35} label={`${SIZE_LABELS[size]} boy figür`} />}
      </div>
      <figcaption style={{ textAlign: 'center', padding: 8, fontSize: 14 }}>
        {SIZE_LABELS[size]}
        {model ? ` · yaklaşık ${Math.round(model.stats.heightMm / 10)} cm · ${model.stats.brickCount} parça` : ' · üretiliyor'}
      </figcaption>
    </figure>
  );
}

export function DevFigure() {
  const [params, setParams] = useSearchParams();
  const shot = params.get('shot') === '1';
  const d = params.get('d');
  const design = useMemo(() => decode(d), [d]);
  const catalog = useCatalog();

  const update = (next: FigureDesign) => {
    const p = new URLSearchParams(params);
    p.set('d', encode(next));
    setParams(p, { replace: true });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: 12, boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
        {SIZES.map((s) => (
          <SizeView key={s} design={design} size={s} catalog={catalog} />
        ))}
      </div>
      {!shot && (
        <form style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', paddingTop: 8, fontSize: 12 }} onSubmit={(e) => e.preventDefault()}>
          {(Object.keys(FACE_SCALE) as FaceKey[]).map((k) => (
            <label key={k}>
              {k} {design.face[k]}{' '}
              <input type="range" min={0} max={FACE_SCALE[k].values.length - 1} step={1} value={design.face[k]}
                onChange={(e) => update({ ...design, face: { ...design.face, [k]: Number(e.target.value) } })} />
            </label>
          ))}
          {(Object.keys(EXPRESSION_RANGES) as (keyof typeof EXPRESSION_RANGES)[]).map((k) => (
            <label key={k}>
              {k} {design.expression[k]}{' '}
              <input type="range" min={EXPRESSION_RANGES[k].min} max={EXPRESSION_RANGES[k].max} step={1} value={design.expression[k]}
                onChange={(e) => update({ ...design, expression: { ...design.expression, [k]: Number(e.target.value) } })} />
            </label>
          ))}
        </form>
      )}
    </div>
  );
}
