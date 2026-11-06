import { describe, expect, it } from 'vitest';
import { EMPTY, VoxelGrid, colorCode, frontView } from '../voxels';
import { FigureDesign, SIZES, faceValue, sanitizeDesign } from './design';
import { buildHead, headDims, skinShade } from './head';

type Side = 'L' | 'R';
interface FaceCell {
  x: number;
  y: number;
  u: number;
  v: number;
  c: number;
}

// Aynı tasarım nesnesi için ön görünüm bir kez üretilir (yardımcılar aynı d ile tekrar tekrar çağrılır).
const faces = new WeakMap<FigureDesign, Int16Array>();
const face = (d: FigureDesign) => {
  let f = faces.get(d);
  if (!f) faces.set(d, (f = frontView(buildHead(d))));
  return f;
};

/** Ön görünümdeki kafa sütunlarının (x ∈ [1, W]) hücreleri; u = (x - cx) / (W/2), v = (y + 0.5) / H. */
function cells(f: Int16Array, d: FigureDesign): FaceCell[] {
  const { W, H } = headDims(d.size);
  const w = W + 2;
  const cx = (W + 1) / 2;
  const out: FaceCell[] = [];
  for (let y = 0; y < f.length / w; y++)
    for (let x = 1; x <= W; x++) out.push({ x, y, u: (x - cx) / (W / 2), v: (y + 0.5) / H, c: f[x + w * y] });
  return out;
}

const onSide = (u: number, side: Side) => (side === 'L' ? u < 0 : u > 0);

function centerColumnsHairAbove(d: FigureDesign, v0: number): boolean {
  const { W } = headDims(d.size);
  const hair = colorCode(d.hairColor);
  return cells(face(d), d).some((p) => (p.x === W / 2 || p.x === W / 2 + 1) && p.v >= v0 && p.c === hair);
}

/** Kaş hücreleri: o taraftaki, v > eyeHeight + 0.05 olan hairColor hücreleri. */
function browCells(d: FigureDesign, side: Side): FaceCell[] {
  const hair = colorCode(d.hairColor);
  const vMin = faceValue(d, 'eyeHeight') + 0.05;
  return cells(face(d), d).filter((p) => onSide(p.u, side) && p.c === hair && p.v > vMin);
}

function browTop(d: FigureDesign, side: Side, pick: 'inner' | 'outer'): number {
  const brow = browCells(d, side);
  if (!brow.length) throw new Error(`kaş yok (${d.size}, ${side})`);
  const au = brow.map((p) => Math.abs(p.u));
  const col = pick === 'inner' ? Math.min(...au) : Math.max(...au);
  return Math.max(...brow.filter((p) => Math.abs(p.u) === col).map((p) => p.y));
}
const browInnerTop = (d: FigureDesign, side: Side) => browTop(d, side, 'inner');
const browOuterTop = (d: FigureDesign, side: Side) => browTop(d, side, 'outer');

function countSide(f: Int16Array, d: FigureDesign, color: string, side: Side): number {
  const c = colorCode(color);
  return cells(f, d).filter((p) => onSide(p.u, side) && p.c === c).length;
}

const lipColor = (d: FigureDesign) => (d.skin === 'reddishBrown' || d.skin === 'darkBrown' ? 'black' : 'reddishBrown');

/** Köşe sütunları |u| > 0.6 * mouthWidth; küçük boyutta köşe, dudak çizgisi rengini taşıyan en dış sütundur. */
function mouthCornerTop(d: FigureDesign): number {
  const lip = colorCode(lipColor(d));
  const line = cells(face(d), d).filter((p) => p.c === lip);
  const outer = Math.max(...line.map((p) => Math.abs(p.u)));
  const mw = faceValue(d, 'mouthWidth');
  const ys = line.filter((p) => (d.size === 'S' ? Math.abs(p.u) === outer : Math.abs(p.u) > 0.6 * mw)).map((p) => p.y);
  if (!ys.length) throw new Error('ağız köşesi yok');
  return Math.max(...ys);
}

function whiteInMouth(d: FigureDesign): boolean {
  const white = colorCode('white');
  const mh = faceValue(d, 'mouthHeight');
  const mw = faceValue(d, 'mouthWidth');
  return cells(face(d), d).some((p) => p.c === white && p.v >= mh - 0.06 && p.v <= mh + 0.03 && Math.abs(p.u) <= mw);
}

function hairCellsBelow(d: FigureDesign, v0: number): number {
  const hair = colorCode(d.hairColor);
  return cells(face(d), d).filter((p) => p.c === hair && p.v < v0).length;
}

function hairOnlyBetween(d: FigureDesign, lo: 'mouth', hi: 'nose'): boolean {
  const key = { mouth: 'mouthHeight', nose: 'noseBottom' } as const;
  const a = faceValue(d, key[lo]);
  const b = faceValue(d, key[hi]);
  const hair = colorCode(d.hairColor);
  const eh = faceValue(d, 'eyeHeight');
  return cells(face(d), d)
    .filter((p) => p.c === hair && p.v < eh)
    .every((p) => p.v >= a && p.v < b);
}

/**
 * Ağız hücreleri (alt dudak, dudak çizgisi, diş). Ağız en son çizildiği için yüz kılından bağımsızdır; renkleri
 * sakalla karışabileceğinden hücreler aynı tasarımın sakalsız ikizinde, burun altının (noseBottom) altında aranır.
 */
function mouthCells(d: FigureDesign): FaceCell[] {
  const twin = sanitizeDesign({ ...d, facialHair: 'none' });
  const codes = [colorCode(lipColor(d)), colorCode('white'), colorCode(skinShade(d.skin))];
  const nb = faceValue(d, 'noseBottom');
  return cells(face(twin), twin).filter((p) => p.v < nb && codes.includes(p.c));
}

function hasCellAtZ(g: VoxelGrid, z: number, color: string): boolean {
  const c = colorCode(color);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.get(x, y, z) === c) return true;
  return false;
}

describe('frontView', () => {
  it('her (x, y) için en öndeki dolu hücreyi, boşsa EMPTY verir', () => {
    const g = new VoxelGrid(2, 2, 3);
    g.set(0, 0, 0, colorCode('red'));
    g.set(0, 0, 2, colorCode('blue'));
    g.set(1, 1, 1, colorCode('white'));
    expect(Array.from(frontView(g))).toEqual([colorCode('blue'), 0, 0, colorCode('white')]);
  });
});

describe('kafa ve yüz', () => {
  it('boyutlara göre kafa ölçüleri', () => {
    expect(headDims('S')).toEqual({ W: 8, D: 6, H: 25 });
    expect(headDims('M')).toEqual({ W: 12, D: 10, H: 38 });
    expect(headDims('L')).toEqual({ W: 16, D: 14, H: 50 });
  });
  it('kaşlar hiçbir boyutta ve ayarda birleşmez (asimetrik ifade dahil)', () => {
    for (const size of SIZES)
      for (const browGap of [0, 1, 2])
        for (const browThickness of [0, 1, 2])
          for (const [browRaiseL, browRaiseR] of [
            [0, 0],
            [2, -1],
            [-1, 2],
          ]) {
            const d = sanitizeDesign({ size, hairStyle: 'bald', facialHair: 'none', face: { browGap, browThickness }, expression: { browRaiseL, browRaiseR } });
            // iki orta sütun, v >= 0.6 satırlarında hiçbir zaman kaş (saç rengi) değildir
            expect(centerColumnsHairAbove(d, 0.6)).toBe(false);
          }
  });
  it('nötr ifadede kaşın iç ucu dış ucundan en fazla 1 plaka yüksektir', () => {
    for (const size of SIZES)
      for (const browTilt of [0, 1, 2, 3, 4])
        for (const browHeight of [0, 2, 4])
          for (const browThickness of [0, 1, 2])
            for (const browGap of [0, 1, 2])
              for (const browRaiseR of [0, 2]) {
                const face = { browTilt, browHeight, browThickness, browGap };
                const d = sanitizeDesign({ size, hairStyle: 'bald', face, expression: { browRaiseR } });
                // kalkık sağ kaş kuraldan muaftır; nötr kalan sol kaş yine kurala uyar
                for (const side of browRaiseR ? (['L'] as const) : (['L', 'R'] as const))
                  expect(browInnerTop(d, side) - browOuterTop(d, side), JSON.stringify({ size, ...face, browRaiseR, side })).toBeLessThanOrEqual(1);
              }
  });
  it('gözler her boyutta ve açıklıkta görünür', () => {
    for (const size of SIZES)
      for (const eyeOpen of [0, 1, 2]) {
        const d = sanitizeDesign({ size, expression: { eyeOpen } });
        expect(countSide(face(d), d, 'black', 'L')).toBeGreaterThan(0);
        expect(countSide(face(d), d, 'black', 'R')).toBeGreaterThan(0);
      }
    // iris bandına hiçbir sütun merkezi düşmese de en yakın sütun iris olur
    const narrow = sanitizeDesign({ size: 'M', face: { eyeSpacing: 0, eyeWidth: 0 } });
    expect(countSide(face(narrow), narrow, 'black', 'L')).toBeGreaterThan(0);
    expect(countSide(face(narrow), narrow, 'black', 'R')).toBeGreaterThan(0);
  });
  it('bandına satır merkezi düşmeyen hat kaybolmaz (ağız çizgisi, ince kaş, bıyık)', () => {
    for (const size of SIZES) {
      const d = sanitizeDesign({ size });
      expect(countSide(face(d), d, lipColor(d), 'L') + countSide(face(d), d, lipColor(d), 'R')).toBeGreaterThan(0);
    }
    const thin = sanitizeDesign({ size: 'S', hairStyle: 'bald', face: { browHeight: 3, browThickness: 0 } });
    expect(browCells(thin, 'L').length).toBeGreaterThan(0);
    expect(browCells(thin, 'R').length).toBeGreaterThan(0);
    // S'de bıyık bandı [0.398, 0.42) hiçbir satır merkezini içermez
    const must = sanitizeDesign({ size: 'S', hairStyle: 'bald', facialHair: 'mustache', face: { mouthHeight: 3, noseBottom: 0 } });
    expect(hairCellsBelow(must, faceValue(must, 'eyeHeight'))).toBeGreaterThan(0);
  });
  it('farklı yüz ayarları farklı yüz üretir', () => {
    const base = face(sanitizeDesign({}));
    for (const f of [{ eyeSpacing: 0 }, { mouthWidth: 0 }, { browHeight: 4 }, { noseBottom: 3 }])
      expect(face(sanitizeDesign({ face: f }))).not.toEqual(base);
  });
  it('gülümseme ağız köşelerini kaldırır', () => {
    const corner = (smile: number) => mouthCornerTop(sanitizeDesign({ size: 'M', expression: { smile } }));
    expect(corner(2)).toBeGreaterThan(corner(0));
  });
  it('küçük boyutta gülümseme ağız köşelerini kaldırır', () => {
    const corner = (smile: number) => mouthCornerTop(sanitizeDesign({ size: 'S', expression: { smile } }));
    expect(corner(1)).toBeGreaterThan(corner(0));
  });
  it('açık gülümsemede dişler yalnızca orta ve büyük boyutta görünür', () => {
    expect(whiteInMouth(sanitizeDesign({ size: 'M', expression: { smile: 3 } }))).toBe(true);
    expect(whiteInMouth(sanitizeDesign({ size: 'S', expression: { smile: 3 } }))).toBe(false);
  });
  it('yüz kılı türleri', () => {
    const m = (facialHair: string) => sanitizeDesign({ size: 'M', hairStyle: 'bald', facialHair });
    expect(hairCellsBelow(m('none'), 0.55)).toBe(0);
    expect(hairOnlyBetween(m('mustache'), 'mouth', 'nose')).toBe(true);
    // hairOnlyBetween bıyık hiç yokken de doğru döner; bıyığın gerçekten çizildiğini ayrıca doğrula
    expect(hairCellsBelow(m('mustache'), faceValue(m('mustache'), 'eyeHeight'))).toBeGreaterThan(0);
    expect(hairCellsBelow(m('fullBeard'), 0.2)).toBeGreaterThan(0);
    expect(hasCellAtZ(buildHead(m('fullBeard')), headDims('M').D + 1, m('fullBeard').hairColor)).toBe(true);
  });
  it('dolgun sakal hacmi ağzın (alt dudak, çizgi, diş) önüne gelmez; renk eşleşse bile', () => {
    for (const o of [
      { size: 'M', skin: 'reddishBrown', hairColor: 'darkBrown', facialHair: 'fullBeard' }, // skinShade = hairColor
      { size: 'M', hairColor: 'white', facialHair: 'fullBeard', expression: { smile: 3 } }, // dişler = hairColor
    ]) {
      const d = sanitizeDesign(o);
      const { D } = headDims(d.size);
      const g = buildHead(d);
      expect(hasCellAtZ(g, D + 1, d.hairColor)).toBe(true); // sakal hacmi gerçekten var
      const mouth = mouthCells(d);
      expect(mouth.length).toBeGreaterThan(0);
      for (const p of mouth) expect(g.get(p.x, p.y, D + 1), JSON.stringify({ ...o, x: p.x, y: p.y })).toBe(EMPTY);
    }
  });
});
