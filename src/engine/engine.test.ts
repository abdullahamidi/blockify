import { describe, expect, it } from 'vitest';
import {
  BOTTOM_STYLES,
  FACIAL_HAIR,
  HAIR_STYLES,
  buildFigureVoxels,
  generateModel,
  sanitizeDesign,
  priceFor,
  FILLER_ID,
  getPart,
} from './index';
import { EMPTY, WILDCARD, colorIdFromCode } from './voxels';

function allDesigns() {
  const out: Record<string, unknown>[] = [];
  for (const hairStyle of HAIR_STYLES)
    for (const facialHair of FACIAL_HAIR)
      for (const bottomStyle of BOTTOM_STYLES)
        for (const glasses of [false, true])
          for (const jacket of [false, true]) out.push({ hairStyle, facialHair, bottomStyle, glasses, jacket });
  return out;
}

describe('sanitizeDesign', () => {
  it('geçersiz değerleri varsayılana çevirir', () => {
    const d = sanitizeDesign({ skin: 'neon', hairStyle: 'mohawk', glasses: 'yes', shirtColor: 'blue' });
    expect(d.skin).toBe('lightNougat');
    expect(d.hairStyle).toBe('short');
    expect(d.glasses).toBe(false);
    expect(d.shirtColor).toBe('blue');
  });
  it('şeffaf rengi kıyafet için kabul etmez', () => {
    expect(sanitizeDesign({ shirtColor: 'transClear' }).shirtColor).toBe('red');
  });
});

describe('packBricks', () => {
  it('her vokseli tam bir kez, doğru renkle kaplar', () => {
    for (const input of allDesigns().filter((_, i) => i % 7 === 0)) {
      const design = sanitizeDesign({ ...input, base: false });
      const grid = buildFigureVoxels(design).markHiddenAsWildcard();
      const model = generateModel({ ...input, base: false });
      const seen = new Int8Array(grid.cells.length);
      for (const b of model.bricks) {
        const part = getPart(b.part);
        expect([part.w, part.l].sort()).toEqual([b.sx, b.sz].sort());
        for (let z = b.z; z < b.z + b.sz; z++)
          for (let x = b.x; x < b.x + b.sx; x++) {
            const code = grid.get(x, b.y, z);
            expect(code).not.toBe(EMPTY);
            if (code !== WILDCARD) expect(b.color).toBe(colorIdFromCode(code));
            const i = grid.idx(x, b.y, z);
            expect(seen[i]).toBe(0);
            seen[i] = 1;
          }
      }
      for (let i = 0; i < grid.cells.length; i++) if (grid.cells[i] !== EMPTY) expect(seen[i]).toBe(1);
    }
  });

  it('tüm tasarım kombinasyonlarında model tek parça (kopuk tuğla yok)', () => {
    for (const input of allDesigns()) {
      for (const base of [true, false]) {
        const m = generateModel({ ...input, base });
        expect(m.stats.looseBricks, JSON.stringify({ ...input, base })).toBe(0);
        expect(m.stats.components).toBe(1);
      }
    }
  }, 60_000);

  it('deterministiktir', () => {
    const a = generateModel({ hairStyle: 'long', glasses: true });
    const b = generateModel({ hairStyle: 'long', glasses: true });
    expect(a.bricks).toEqual(b.bricks);
    expect(a.price.total).toBe(b.price.total);
  });

  it('iç dolgu parçaları dışarıdan görünmez', () => {
    const design = sanitizeDesign({ base: false });
    const grid = buildFigureVoxels(design).markHiddenAsWildcard();
    const m = generateModel({ base: false });
    for (const b of m.bricks.filter((x) => x.color === FILLER_ID)) {
      for (let z = b.z; z < b.z + b.sz; z++)
        for (let x = b.x; x < b.x + b.sx; x++) expect(grid.get(x, b.y, z)).toBe(WILDCARD);
    }
  });
});

describe('BOM ve fiyat', () => {
  it('parça listesi toplamı tuğla sayısına eşit', () => {
    const m = generateModel({ hairStyle: 'bun', facialHair: 'beard' });
    expect(m.bom.reduce((s, l) => s + l.qty, 0)).toBe(m.bricks.length);
  });
  it('kaide plakası listede yer alır', () => {
    const m = generateModel({ base: true });
    expect(m.bom.find((l) => l.part === 'plate8x8')?.qty).toBe(1);
    expect(generateModel({ base: false }).bom.find((l) => l.part === 'plate8x8')).toBeUndefined();
  });
  it('fiyat 9 ile biter ve bileşenleri toplamı tutar', () => {
    const m = generateModel({});
    const p = priceFor(m.bom);
    expect(p.total % 10).toBe(9);
    expect(p.parts + p.designFee + p.packaging + p.shipping).toBe(p.total);
  });
});
