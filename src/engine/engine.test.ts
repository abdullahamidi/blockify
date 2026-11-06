import { describe, expect, it } from 'vitest';
import {
  BASEPLATE_FOR_SIZE,
  BASEPLATES,
  BOTTOM_STYLES,
  FACIAL_HAIR,
  FILLER_ID,
  HAIR_STYLES,
  PALETTE,
  SIZES,
  bodyDims,
  buildFigureVoxels,
  catalogKey,
  createCatalog,
  defaultCatalog,
  generateModel,
  getPart,
  headDims,
  priceFor,
  type Brick,
  type FigureModel,
} from './index';
import { VoxelGrid, WILDCARD } from './voxels';

/** Figürün en alttaki ayakkabı katları (body.ts SHOE_LAYERS). */
const SHOE_LAYERS = 3;

/** Parçanın kapladığı her hücre, figür ızgarasında (offset geri alınarak) WILDCARD olmalı. */
function expectAllWildcard(g: VoxelGrid, b: Brick, offset: { x: number; y: number; z: number }) {
  const h = b.h ?? getPart(b.part).h;
  for (let y = b.y; y < b.y + h; y++)
    for (let z = b.z; z < b.z + b.sz; z++)
      for (let x = b.x; x < b.x + b.sx; x++)
        expect(g.get(x - offset.x, y - offset.y, z - offset.z), JSON.stringify(b)).toBe(WILDCARD);
}

/**
 * Koordinatlar negatif değil ve en küçük x/z 0; tek kaide plakası en altta, uzun kenarı x ekseninde;
 * figürün alt katlarındaki parçalar (ayakkabılar) kaidenin x/z alanı içinde.
 */
function expectFeetOnBase(m: FigureModel) {
  for (const b of m.bricks) {
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.z).toBeGreaterThanOrEqual(0);
  }
  expect(Math.min(...m.bricks.map((b) => b.x))).toBe(0);
  expect(Math.min(...m.bricks.map((b) => b.z))).toBe(0);

  const plates = m.bricks.filter((b) => b.plate);
  expect(plates).toHaveLength(1);
  const [p] = plates;
  const part = getPart(p.part);
  expect(p.part).toBe(BASEPLATE_FOR_SIZE[m.design.size]);
  expect([p.y, p.h, p.step, p.sx, p.sz]).toEqual([0, 1, 0, part.l, part.w]);
  expect(m.bricks.filter((b) => !b.plate).every((b) => b.y >= 1)).toBe(true);
  expect(m.offset.y).toBe(1);
  // Kaide gövdenin taban izine ortalı (ızgara koordinatı + offset = parça koordinatı)
  const { W, D } = headDims(m.design.size);
  const { TW, TD } = bodyDims(m.design.size);
  expect(Math.abs(p.x + p.sx / 2 - (1 + (W - TW) / 2 + TW / 2 + m.offset.x))).toBeLessThanOrEqual(0.5);
  expect(Math.abs(p.z + p.sz / 2 - (1 + (D - TD) / 2 + TD / 2 + m.offset.z))).toBeLessThanOrEqual(0.5);

  const bottom = m.bricks.filter((b) => !b.plate && b.y < 1 + SHOE_LAYERS);
  expect(bottom.filter((b) => b.color === m.design.shoeColor).length).toBeGreaterThan(0);
  for (const b of bottom) {
    const where = JSON.stringify({ size: m.design.size, b, plate: p });
    expect(b.x, where).toBeGreaterThanOrEqual(p.x);
    expect(b.z, where).toBeGreaterThanOrEqual(p.z);
    expect(b.x + b.sx, where).toBeLessThanOrEqual(p.x + p.sx);
    expect(b.z + b.sz, where).toBeLessThanOrEqual(p.z + p.sz);
  }
}

const cat = defaultCatalog();
const sample = () =>
  SIZES.flatMap((size) =>
    HAIR_STYLES.flatMap((hairStyle, i) =>
      FACIAL_HAIR.map((facialHair, j) => ({
        size,
        hairStyle,
        facialHair,
        glasses: (i + j) % 2 === 0,
        jacket: j % 2 === 1,
        bottomStyle: BOTTOM_STYLES[(i + j) % 3],
        expression: { smile: j % 4 },
      })),
    ),
  );

describe('generateModel', () => {
  it('örnek tasarımlarda model her boyutta tek parça', () => {
    for (const input of sample()) {
      const m = generateModel(input, cat);
      expect(m.stats.looseBricks, JSON.stringify(input)).toBe(0);
      expect(m.stats.components).toBe(1);
    }
  }, 180_000);

  it('kısıtlı katalogla da tek parça ve yalnızca açık parçalar', () => {
    const keys = PALETTE.flatMap((c) => ['p1x1', 'p1x2', 'p2x2', '1x2', '2x2'].map((p) => catalogKey(p, c.id))).concat(
      BASEPLATES.map((b) => catalogKey(b.id, 'darkGray')),
    );
    const m = generateModel({ size: 'M', facialHair: 'fullBeard' }, createCatalog(keys));
    expect(m.stats.components).toBe(1);
    for (const b of m.bricks) if (b.color !== FILLER_ID) expect(keys).toContain(catalogKey(b.part, b.color));
  });

  it('katalogda olmayan sabit yüz renkleri en yakın açık renge döner', () => {
    // Beyaz kapalı: ayakkabı (tasarım rengi) ve göz akı / dişler (sabit renk) başka renge döner.
    const keys = [...defaultCatalog().enabled].filter((k) => !k.endsWith('|white'));
    const m = generateModel({ size: 'M', expression: { smile: 3 } }, createCatalog(keys));
    expect(m.stats.components).toBe(1);
    expect(m.bricks.some((b) => b.color === 'white')).toBe(false);
    for (const b of m.bricks) if (b.color !== FILLER_ID) expect(keys).toContain(catalogKey(b.part, b.color));
  });

  it('tuğlalı döşeme onarılır, yalnız plakalı döşemeye düşülmez', () => {
    // Son tasarım tek kurslu onarımda takılır (kollar ve sırttaki saç paneli aynı kursta bağlanır).
    const inputs = [
      ...SIZES.map((size) => ({ size })),
      { size: 'S', hairStyle: 'medium', facialHair: 'mustache', glasses: true, jacket: true, bottomStyle: 'skirt', expression: { smile: 1 } },
    ];
    for (const input of inputs) {
      const m = generateModel(input, cat);
      expect(m.stats.components).toBe(1);
      expect(m.bricks.some((b) => getPart(b.part).kind === 'brick'), JSON.stringify(input)).toBe(true);
    }
  });

  it('en ağır kombinasyon tek parça ve bütçe içinde', () => {
    const t = performance.now();
    const m = generateModel(
      { size: 'L', hairStyle: 'volume', facialHair: 'fullBeard', glasses: true, bottomStyle: 'skirt', expression: { smile: 3 } },
      cat,
    );
    expect(performance.now() - t).toBeLessThan(2000);
    expect(m.stats.components).toBe(1);
  });

  it('deterministiktir', () => {
    expect(generateModel({ size: 'L' }, cat).bricks).toEqual(generateModel({ size: 'L' }, cat).bricks);
  });

  it('iç dolgu parçaları dışarıdan görünmez', () => {
    const m = generateModel({ size: 'S', base: false }, cat);
    const g = buildFigureVoxels(m.design).markHiddenAsWildcard();
    const fillers = m.bricks.filter((x) => x.color === FILLER_ID);
    expect(fillers.length).toBeGreaterThan(0);
    for (const b of fillers) expectAllWildcard(g, b, m.offset);
  });

  it('kaide boyuta göre seçilir', () => {
    for (const [size, part] of [
      ['S', 'plate8x8'],
      ['M', 'plate8x16'],
      ['L', 'plate16x16'],
    ])
      expect(generateModel({ size }, cat).bom.find((l) => l.part === part)?.qty).toBe(1);
    expect(generateModel({ base: false }, cat).bom.some((l) => getPart(l.part).kind === 'baseplate')).toBe(false);
  });

  it('kaide plakası kapalıysa model kaidesiz üretilir', () => {
    const m = generateModel({ size: 'M' }, createCatalog([...defaultCatalog().enabled].filter((k) => !k.startsWith('plate'))));
    expect(m.design.base).toBe(false);
  });

  it('ayaklar kaidenin içinde, koordinatlar negatif değil', () => {
    for (const size of SIZES) expectFeetOnBase(generateModel({ size }, cat));
  });

  it('boylar ve parça sayıları makul', () => {
    const s = (size: string) => generateModel({ size }, cat).stats;
    expect(s('S').heightMm).toBeGreaterThanOrEqual(160);
    expect(s('S').heightMm).toBeLessThanOrEqual(185);
    expect(s('M').heightMm).toBeGreaterThanOrEqual(245);
    expect(s('M').heightMm).toBeLessThanOrEqual(275);
    expect(s('L').heightMm).toBeGreaterThanOrEqual(325);
    expect(s('L').heightMm).toBeLessThanOrEqual(355);
    expect(s('S').brickCount).toBeLessThan(s('M').brickCount);
    expect(s('M').brickCount).toBeLessThan(s('L').brickCount);
    expect(s('L').brickCount).toBeLessThan(2500);
  });

  it('parça listesi toplamı parça sayısına eşit, fiyat 9 ile biter', () => {
    const m = generateModel({ size: 'M' }, cat);
    expect(m.bom.reduce((a, l) => a + l.qty, 0)).toBe(m.bricks.length);
    const p = priceFor(m.bom);
    expect(p.total % 10).toBe(9);
    expect(p.parts + p.designFee + p.packaging + p.shipping).toBe(p.total);
  });
});
