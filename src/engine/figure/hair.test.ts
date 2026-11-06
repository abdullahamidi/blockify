import { describe, expect, it } from 'vitest';
import { EMPTY, VoxelGrid, colorCode } from '../voxels';
import { FigureDesign, SIZES, sanitizeDesign } from './design';
import { buildHead, eyeCells, headDims } from './head';
import { applyGlasses, applyHair } from './hair';

const head = (o: object) => {
  const d = sanitizeDesign(o);
  const g = buildHead(d);
  applyHair(g, d);
  applyGlasses(g, d);
  return { d, g };
};

function count(g: VoxelGrid, color: string): number {
  const c = colorCode(color);
  let n = 0;
  for (const v of g.cells) if (v === c) n++;
  return n;
}

function maxYOf(g: VoxelGrid, color: string): number {
  const c = colorCode(color);
  let m = -1;
  for (let y = 0; y < g.h; y++)
    for (let z = 0; z < g.d; z++) for (let x = 0; x < g.w; x++) if (g.get(x, y, z) === c) m = y;
  return m;
}

/** Her (x, z) sütununun en üst dolu hücresi (kafa gövdesinde, x ∈ [1, W]) yeterince yüksekse saç rengindedir. */
function topLayerAll(g: VoxelGrid, d: FigureDesign): boolean {
  const { W, D, H } = headDims(d.size);
  const hair = colorCode(d.hairColor);
  for (let z = 1; z <= D; z++)
    for (let x = 1; x <= W; x++) {
      let top = -1;
      for (let y = g.h - 1; y >= 0; y--)
        if (g.get(x, y, z) !== EMPTY) {
          top = y;
          break;
        }
      if (top >= 0 && (top + 0.5) / H >= 0.9 && g.get(x, top, z) !== hair) return false;
    }
  return true;
}

/** Ön görünümdeki (x, y) en öndeki hücre. */
function frontCell(g: VoxelGrid, x: number, y: number): number {
  for (let z = g.d - 1; z >= 0; z--) if (g.get(x, y, z) !== EMPTY) return g.get(x, y, z);
  return EMPTY;
}

function frontHairCount(r: { d: FigureDesign; g: VoxelGrid }, vMin = 0, vMax = 2): number {
  const { W, H } = headDims(r.d.size);
  const hair = colorCode(r.d.hairColor);
  let n = 0;
  for (let y = 0; y < H; y++) {
    const v = (y + 0.5) / H;
    if (v < vMin || v >= vMax) continue;
    for (let x = 1; x <= W; x++) if (frontCell(r.g, x, y) === hair) n++;
  }
  return n;
}

describe('saç ve gözlük', () => {
  it('kel ve sakalsız kafaya saç eklenmez (yalnızca kaşlar kalır)', () => {
    const { d, g } = head({ hairStyle: 'bald', facialHair: 'none' });
    expect(count(g, d.hairColor)).toBe(count(buildHead(d), d.hairColor));
  });

  it('kısa saç: kafa tepesi saç, gözlerin altı saç değil', () => {
    const r = head({ hairStyle: 'short', facialHair: 'none' });
    expect(topLayerAll(r.g, r.d)).toBe(true);
    // v < 0.6 ön yüzde yalnızca kaşlar saç rengindedir; kaşlar kel kafayla aynı sayıdadır.
    const bald = head({ hairStyle: 'bald', facialHair: 'none' });
    expect(frontHairCount(r, 0, 0.6)).toBe(frontHairCount(bald, 0, 0.6));
  });

  it('saç çizgisi alçaldıkça önde daha çok saç görünür', () => {
    const n = (hairline: number) => frontHairCount(head({ hairStyle: 'short', hairline }));
    expect(n(0)).toBeGreaterThan(n(2));
  });

  it('topuz kafanın üstüne çıkar', () => {
    for (const size of SIZES) {
      const { d, g } = head({ hairStyle: 'bun', size });
      expect(maxYOf(g, d.hairColor)).toBeGreaterThanOrEqual(headDims(d.size).H);
    }
  });

  it('gözlük çerçevesi gözleri kapatmaz', () => {
    const a = head({ glasses: false });
    const b = head({ glasses: true, glassesColor: 'red' });
    expect(count(b.g, 'black')).toBe(count(a.g, 'black'));
    expect(count(b.g, 'red')).toBeGreaterThan(0);
  });

  it('gözlük göz hücrelerine dokunmaz, saç kaş/yüz kılı/burun hücrelerine dokunmaz', () => {
    for (const size of SIZES)
      for (const hairStyle of ['short', 'medium', 'long', 'bun', 'volume', 'bald']) {
        const o = { size, hairStyle, facialHair: 'mustache', glasses: true, glassesColor: 'red' };
        const d = sanitizeDesign(o);
        const base = buildHead(d);
        const g = buildHead(d);
        applyHair(g, d);
        applyGlasses(g, d);
        const eyes = new Set(eyeCells(d).map((e) => `${e.x},${e.y}`));
        const skin = colorCode(d.skin);
        for (let y = 0; y < base.h; y++)
          for (let z = 0; z < base.d; z++)
            for (let x = 0; x < base.w; x++) {
              const b = base.get(x, y, z);
              if (b === EMPTY || b === skin) continue;
              // Ten dışındaki her hücre (kaş, göz, ağız, yüz kılı, gölge tonları) değişmeden kalır,
              // yalnızca gözlük çerçevesi gölge ya da kıl hücresi olmayan tene yazılır.
              if (eyes.has(`${x},${y}`) && frontCell(base, x, y) === b) expect(g.get(x, y, z)).toBe(b);
              if (g.get(x, y, z) !== b) expect(g.get(x, y, z)).toBe(colorCode('red'));
            }
      }
  });

  it('simetrik tasarımda sonuç x ekseninde aynalıdır', () => {
    for (const size of SIZES)
      for (const hairStyle of ['short', 'medium', 'long', 'bun', 'volume', 'bald']) {
        const { g } = head({ size, hairStyle, glasses: true });
        for (let y = 0; y < g.h; y++)
          for (let z = 0; z < g.d; z++)
            for (let x = 0; x < g.w; x++) expect(g.get(x, y, z)).toBe(g.get(g.w - 1 - x, y, z));
      }
  });

  it('long kafada medium ile aynıdır; medium yanlarda kısadan fazla saç taşır', () => {
    const m = head({ hairStyle: 'medium' }).g;
    const l = head({ hairStyle: 'long' }).g;
    expect(Array.from(l.cells)).toEqual(Array.from(m.cells));
    expect(count(m, 'darkBrown')).toBeGreaterThan(count(head({ hairStyle: 'short' }).g, 'darkBrown'));
  });

  it('volume kısadan fazla saç hücresi ekler', () => {
    expect(count(head({ hairStyle: 'volume' }).g, 'darkBrown')).toBeGreaterThan(
      count(head({ hairStyle: 'short' }).g, 'darkBrown'),
    );
  });
});
