import { useEffect, useMemo, useState } from 'react';
import type { Brick } from '../../engine/packer';
import { getColor, hexToRgb, FILLER_ID } from '../../engine/palette';
import { getPart } from '../../engine/parts';
import { LayerMap } from './LayerMap';
import { groupSteps, hangingCaption, type StepInfo } from './steps';
import { Viewer3D } from './Viewer3D';

export function useSteps(bricks: Brick[]): StepInfo[] {
  return useMemo(() => groupSteps(bricks), [bricks]);
}

function isLight(hex: string) {
  const [r, g, b] = hexToRgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

function StepParts({ items }: { items: Brick[] }) {
  const lines = new Map<string, { part: string; color: string; qty: number }>();
  for (const b of items) {
    const k = `${b.color}|${b.part}`;
    const l = lines.get(k) ?? { part: b.part, color: b.color, qty: 0 };
    l.qty++;
    lines.set(k, l);
  }
  return (
    <ul className="step-parts">
      {[...lines.values()].map((l) => {
        const c = getColor(l.color);
        const p = getPart(l.part);
        return (
          <li key={`${l.color}-${l.part}`}>
            <span
              className={`chip-brick ${l.color === FILLER_ID ? 'dot-any' : ''} ${isLight(c.hex) ? 'on-light' : ''}`}
              style={{ background: c.hex }}
            >
              {p.kind === 'baseplate' ? p.id.replace(/^plate/, '') : p.id}
            </span>
            <span>
              <b>{l.qty}×</b> {c.name}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function StepBody({ bricks, s, cell }: { bricks: Brick[]; s: StepInfo; cell?: number }) {
  const hangingLayers = [...new Set(s.hanging.map((b) => b.y))].sort((a, b) => b - a);
  return (
    <div className="step-body">
      <div className="step-maps">
        {s.mainLayers.map((y, i) => (
          <figure key={`m${y}`}>
            <LayerMap bricks={bricks} items={s.main.filter((b) => b.y === y)} refLayer={y - 1} cell={cell} />
            <figcaption>{s.mainLayers.length === 1 ? 'Bu sırayı yerleştir' : `${i + 1}. kat`}</figcaption>
          </figure>
        ))}
        {hangingLayers.map((y) => (
          <figure key={y}>
            <LayerMap bricks={bricks} items={s.hanging.filter((b) => b.y === y)} cell={cell} dashed />
            <figcaption>{hangingCaption(s, y)}</figcaption>
          </figure>
        ))}
      </div>
      <StepParts items={[...s.main, ...s.hanging]} />
    </div>
  );
}

export function InteractiveInstructions({ bricks }: { bricks: Brick[] }) {
  const steps = useSteps(bricks);
  const [i, setI] = useState(0);
  const s = steps[Math.min(i, steps.length - 1)];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setI((v) => Math.min(steps.length - 1, v + 1));
      if (e.key === 'ArrowLeft') setI((v) => Math.max(0, v - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [steps.length]);

  if (!s) return null;
  return (
    <div className="instructions">
      <div className="instr-top">
        <button className="btn btn-ghost" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}>
          ← Önceki
        </button>
        <div className="instr-progress">
          <b>
            Adım {i + 1} / {steps.length}
          </b>
          <div className="progress">
            <div style={{ width: `${((i + 1) / steps.length) * 100}%` }} />
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setI(Math.min(steps.length - 1, i + 1))} disabled={i === steps.length - 1}>
          Sonraki →
        </button>
      </div>
      <div className="instr-grid">
        <div className="card instr-3d">
          <Viewer3D bricks={bricks} upToStep={s.step} highlightStep={s.step} label={`Adım ${i + 1} 3D görünüm`} />
          <p className="muted small center">Turuncu kenarlı parçalar bu adımda eklenir. Sürükleyerek çevirebilirsin.</p>
        </div>
        <div className="card">
          <StepBody bricks={bricks} s={s} />
        </div>
      </div>
    </div>
  );
}

export function PrintableInstructions({ bricks, title }: { bricks: Brick[]; title?: string }) {
  const steps = useSteps(bricks);
  return (
    <div className="print-instructions">
      {title && <h2>{title}</h2>}
      <div className="print-steps">
        {steps.map((s, i) => (
          <section key={s.step} className="print-step">
            <h3>Adım {i + 1}</h3>
            <StepBody bricks={bricks} s={s} cell={14} />
          </section>
        ))}
      </div>
    </div>
  );
}
