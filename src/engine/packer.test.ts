import { describe, expect, it } from 'vitest';
import { catalogKey, createCatalog, defaultCatalog, footprints, isEnabled } from './catalog';
import { packBricks, type Brick } from './packer';
import { FILLER_ID, PALETTE } from './palette';
import { getPart } from './parts';
import { EMPTY, VoxelGrid, WILDCARD, colorCode, colorIdFromCode } from './voxels';

/** Renk kimliği, WILDCARD (görünmeyen iç hücre) ya da null (boş). */
type Cell = string | typeof WILDCARD | null;

function gridFrom(w: number, h: number, d: number, fn: (x: number, y: number, z: number) => Cell): VoxelGrid {
  const g = new VoxelGrid(w, h, d);
  for (let y = 0; y < h; y++)
    for (let z = 0; z < d; z++)
      for (let x = 0; x < w; x++) {
        const c = fn(x, y, z);
        if (c !== null) g.set(x, y, z, c === WILDCARD ? WILDCARD : colorCode(c));
      }
  return g;
}

const solidBox = (color: string, w: number, h: number, d: number) => gridFrom(w, h, d, () => color);

/** Renkler kat kat (her plaka katı bir sonraki renk) değişir. */
const stripedBox = (colors: string[], w: number, h: number, d: number) =>
  gridFrom(w, h, d, (_x, y) => colors[y % colors.length]);

/** Dış kabuk renkli, içi WILDCARD. */
const boxWithHiddenCore = (color: string, w: number, h: number, d: number) =>
  gridFrom(w, h, d, (x, y, z) => (x > 0 && x < w - 1 && y > 0 && y < h - 1 && z > 0 && z < d - 1 ? WILDCARD : color));

/** 6 kat yüksekliğinde ortada 2x2 sütun, en üstte 6x2 çıkıntılı kat. */
const tShape = (color: string) => gridFrom(6, 7, 2, (x, y) => (y === 6 || (x >= 2 && x <= 3) ? color : null));

/** 0-3. katlar: x0-1, z0-1 sütun. 3. kat: ayrıca (3,0) tek hücre. 4. kat: x0-3, z0-1. */
const overhangGrid = () =>
  gridFrom(4, 5, 2, (x, y, z) => {
    if (y <= 3 && x <= 1) return 'red';
    if (y === 3 && x === 3 && z === 0) return 'red';
    if (y === 4) return 'red';
    return null;
  });

/** Her dolu hücre tam bir kez kaplanır, renk tutar, yalnızca WILDCARD kaplayan parça FILLER_ID olur. */
function expectExactCover(g: VoxelGrid, bricks: Brick[]) {
  const seen = new Uint8Array(g.cells.length);
  for (const b of bricks) {
    const part = getPart(b.part);
    expect([part.w, part.l]).toEqual([b.sx, b.sz].sort((a, c) => a - c));
    expect(b.h).toBe(part.h);
    let allWildcard = true;
    for (let y = b.y; y < b.y + part.h; y++)
      for (let z = b.z; z < b.z + b.sz; z++)
        for (let x = b.x; x < b.x + b.sx; x++) {
          const code = g.get(x, y, z);
          expect(code).not.toBe(EMPTY);
          if (code !== WILDCARD) {
            allWildcard = false;
            expect(b.color).toBe(colorIdFromCode(code));
          }
          const i = g.idx(x, y, z);
          expect(seen[i]).toBe(0);
          seen[i] = 1;
        }
    if (allWildcard) expect(b.color).toBe(FILLER_ID);
  }
  for (let i = 0; i < g.cells.length; i++) if (g.cells[i] !== EMPTY) expect(seen[i]).toBe(1);
}

/** Tuğlanın altındaki her sütun 3 katta da dolu ve WILDCARD dışında tek renk. */
function expectUniformColumn(g: VoxelGrid, b: Brick) {
  for (let z = b.z; z < b.z + b.sz; z++)
    for (let x = b.x; x < b.x + b.sx; x++) {
      const codes = [0, 1, 2].map((k) => g.get(x, b.y + k, z));
      expect(codes).not.toContain(EMPTY);
      expect(new Set(codes.filter((c) => c !== WILDCARD)).size).toBeLessThanOrEqual(1);
    }
}

const restricted = createCatalog(
  PALETTE.flatMap((c) => ['p1x1', 'p1x2', 'p2x2', '1x2', '2x2'].map((p) => catalogKey(p, c.id))),
);

describe('packBricks', () => {
  it('her hücreyi tam bir kez, doğru renkle ve yalnızca açık parçalarla kaplar', () => {
    for (const cat of [defaultCatalog(), restricted])
      for (const g of [
        solidBox('red', 6, 9, 5),
        stripedBox(['red', 'white'], 6, 9, 4),
        boxWithHiddenCore('blue', 6, 9, 6),
      ]) {
        const r = packBricks(g, cat);
        expectExactCover(g, r.bricks);
        for (const b of r.bricks)
          if (b.color !== FILLER_ID) expect(isEnabled(cat, b.part, b.color)).toBe(true);
          else
            expect(
              footprints(cat, FILLER_ID, getPart(b.part).kind as 'brick' | 'plate').some((p) => p.id === b.part),
            ).toBe(true);
      }
  });

  it('tuğlalar kurs başında ve 3 katı da uyumlu hücrelerde', () => {
    const g = stripedBox(['red', 'white'], 6, 9, 4);
    for (const b of packBricks(g, defaultCatalog()).bricks.filter((b) => b.h === 3)) {
      expect(b.y % 3).toBe(0);
      expectUniformColumn(g, b);
    }
  });

  it('tuğla yalnızca 3 katı da aynı renk olan kurslarda kullanılır', () => {
    // 0-3. katlar kırmızı, 4-8. katlar beyaz: 1. kurs (3-5) karışık, 0. ve 2. kurs tek renk.
    const g = gridFrom(6, 9, 4, (_x, y) => (y <= 3 ? 'red' : 'white'));
    const r = packBricks(g, defaultCatalog());
    expectExactCover(g, r.bricks);
    const bricks = r.bricks.filter((b) => b.h === 3);
    expect(new Set(bricks.map((b) => b.y))).toEqual(new Set([0, 6]));
    for (const b of bricks) expectUniformColumn(g, b);
  });

  it('düz kutu ve çıkıntılı T şekli tek parça', () => {
    for (const g of [solidBox('red', 6, 12, 4), tShape('red')]) {
      const r = packBricks(g, defaultCatalog());
      expect(r.looseBricks).toBe(0);
      expect(r.components).toBe(1);
    }
  });

  it('deterministiktir', () => {
    const g = tShape('red');
    expect(packBricks(g, defaultCatalog()).bricks).toEqual(packBricks(g, defaultCatalog()).bricks);
  });

  it('desteksiz parça üstündeki parçayla aynı adımda takılır', () => {
    // 0-3. katlar: x0-1, z0-1 sütun. 3. kat: ayrıca (3,0) tek hücre. 4. kat: x0-3, z0-1.
    const r = packBricks(overhangGrid(), defaultCatalog());
    const lone = r.bricks.find((b) => b.y === 3 && b.x === 3)!;
    const above = r.bricks.find((b) => b.y === 4 && b.x <= 3 && b.x + b.sx > 3)!;
    expect(lone.hanging).toBe(true);
    expect(lone.step).toBe(above.step);
  });

  it('katalogda karşılığı olmayan renkte hata verir', () => {
    expect(() => packBricks(solidBox('red', 2, 2, 2), createCatalog(['p1x1|blue']))).toThrow(/1x1 plaka/);
  });
});
