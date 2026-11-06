import { describe, expect, it } from 'vitest';
import { EMPTY, VoxelGrid, colorCode } from '../voxels';
import { SIZES, sanitizeDesign, FigureDesign } from './design';
import { bodyDims, buildFigureVoxels, headDims } from './index';

/** En üstteki dolu katman + 1. */
function contentHeight(g: VoxelGrid): number {
  for (let y = g.h - 1; y >= 0; y--)
    for (let z = 0; z < g.d; z++) for (let x = 0; x < g.w; x++) if (g.get(x, y, z) !== EMPTY) return y + 1;
  return 0;
}

function isMirrorX(g: VoxelGrid): boolean {
  for (let y = 0; y < g.h; y++)
    for (let z = 0; z < g.d; z++)
      for (let x = 0; x < g.w; x++) if (g.get(x, y, z) !== g.get(g.w - 1 - x, y, z)) return false;
  return true;
}

/** Kafa tabanının (boyun üstü) altında kalan saç rengi hücre sayısı. */
function hairBelowHead(g: VoxelGrid, d: FigureDesign): number {
  const b = bodyDims(d.size);
  const hair = colorCode(d.hairColor);
  let n = 0;
  for (let y = 0; y < b.LH + b.TH + b.NH; y++)
    for (let z = 0; z < g.d; z++) for (let x = 0; x < g.w; x++) if (g.get(x, y, z) === hair) n++;
  return n;
}

/** Verilen renkteki hücrelerin x ekseni genişliği. */
function widthOf(g: VoxelGrid, color: string): number {
  const c = colorCode(color);
  let lo = Infinity;
  let hi = -Infinity;
  for (let y = 0; y < g.h; y++)
    for (let z = 0; z < g.d; z++)
      for (let x = 0; x < g.w; x++)
        if (g.get(x, y, z) === c) {
          lo = Math.min(lo, x);
          hi = Math.max(hi, x);
        }
  return hi < lo ? 0 : hi - lo + 1;
}

describe('figür birleştirme', () => {
  it('figür yüksekliği (plaka) boyuta göre', () => {
    const h = (size: string) => contentHeight(buildFigureVoxels(sanitizeDesign({ size, hairStyle: 'bald' })));
    expect([h('S'), h('M'), h('L')]).toEqual([52, 79, 104]);
  });
  it('simetrik tasarım x ekseninde aynadır (hizalama doğru)', () => {
    for (const size of SIZES) {
      const g = buildFigureVoxels(sanitizeDesign({ size, glasses: false, jacket: true, jacketOpen: true }));
      expect(isMirrorX(g)).toBe(true);
    }
  });
  it('uzun saç sırtta panel oluşturur', () => {
    const d = sanitizeDesign({ hairStyle: 'long' });
    expect(hairBelowHead(buildFigureVoxels(d), d)).toBeGreaterThan(0);
  });
  it('etek bacaklardan geniştir', () => {
    const d = sanitizeDesign({ bottomStyle: 'skirt', bottomColor: 'red', shirtColor: 'white', jacket: false });
    expect(widthOf(buildFigureVoxels(d), 'red')).toBeGreaterThan(bodyDims(d.size).TW);
  });
  it('ızgara kafa ızgarasıyla aynı taban alanına sahiptir', () => {
    for (const size of SIZES) {
      const g = buildFigureVoxels(sanitizeDesign({ size }));
      const { W, D } = headDims(size);
      expect([g.w, g.d]).toEqual([W + 2, D + 2]);
    }
  });
});
