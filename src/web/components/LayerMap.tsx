import type { Brick } from '../../engine/packer';
import { getColor } from '../../engine/palette';
import { getPart } from '../../engine/parts';
import { occupies } from '../viewer/geometry';

interface Props {
  bricks: Brick[];
  /** Çizilecek parçalar */
  items: Brick[];
  /** Referans olarak soluk gösterilecek katman (genelde bir alt katman) */
  refLayer?: number;
  cell?: number;
  dashed?: boolean;
}

function gridExtent(bricks: Brick[]) {
  let w = 0;
  let d = 0;
  for (const b of bricks) {
    w = Math.max(w, b.x + b.sx);
    d = Math.max(d, b.z + b.sz);
  }
  return { w, d };
}

/** Katmanın üstten görünüşü. Ön yüz aşağıda. */
export function LayerMap({ bricks, items, refLayer, cell = 22, dashed }: Props) {
  const { w, d } = gridExtent(bricks);
  const pad = 4;
  const width = w * cell + pad * 2;
  const height = d * cell + pad * 2 + 16;
  const ref = refLayer === undefined ? [] : bricks.filter((b) => occupies(b, refLayer) && !items.includes(b));
  const rect = (b: Brick) => ({ x: pad + b.x * cell, y: pad + b.z * cell, w: b.sx * cell, h: b.sz * cell });

  return (
    <svg className="layer-map" viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label="Katman yerleşim planı">
      {Array.from({ length: w + 1 }, (_, i) => (
        <line key={`v${i}`} x1={pad + i * cell} y1={pad} x2={pad + i * cell} y2={pad + d * cell} className="grid-line" />
      ))}
      {Array.from({ length: d + 1 }, (_, i) => (
        <line key={`h${i}`} x1={pad} y1={pad + i * cell} x2={pad + w * cell} y2={pad + i * cell} className="grid-line" />
      ))}
      {ref.map((b) => {
        const r = rect(b);
        return <rect key={`r${b.id}`} x={r.x + 1} y={r.y + 1} width={r.w - 2} height={r.h - 2} rx={3} className="ref-brick" />;
      })}
      {items.map((b) => {
        const r = rect(b);
        const c = getColor(b.color);
        const studs = [];
        for (let z = 0; z < b.sz; z++)
          for (let x = 0; x < b.sx; x++)
            studs.push(
              <circle key={`${x}-${z}`} cx={r.x + (x + 0.5) * cell} cy={r.y + (z + 0.5) * cell} r={cell * 0.28} className="stud" />,
            );
        return (
          <g key={b.id}>
            <rect
              x={r.x + 1.5}
              y={r.y + 1.5}
              width={r.w - 3}
              height={r.h - 3}
              rx={3}
              fill={c.hex}
              fillOpacity={c.transparent ? 0.45 : 1}
              className="brick-rect"
              strokeDasharray={dashed ? '4 3' : undefined}
            />
            {getPart(b.part).kind !== 'baseplate' && studs}
          </g>
        );
      })}
      <text x={width / 2} y={height - 3} textAnchor="middle" className="front-label">
        ▼ ÖN
      </text>
    </svg>
  );
}
