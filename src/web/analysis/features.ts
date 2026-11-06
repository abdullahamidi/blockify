import {
  colorsInGroup,
  getColor,
  hexToRgb,
  labDistance,
  nearestColor,
  rgbToLab,
  type RGB,
} from '../../engine/palette';
import type { FigureDesign, FacialHair, HairStyle } from '../../engine/figure';

/** Çoklu sınıf segmentasyon modeli kategorileri */
export const CAT = { background: 0, hair: 1, bodySkin: 2, faceSkin: 3, clothes: 4, accessory: 5 } as const;

export interface AnalysisResult {
  design: Partial<FigureDesign>;
  /** Kullanıcıya gösterilecek kısa notlar */
  notes: string[];
  /** 0-1 arası güven */
  confidence: number;
  detected: {
    face: boolean;
    hair: boolean;
    clothes: boolean;
    pants: boolean;
  };
  /** Ayar yapmak için ölçülen ham değerler */
  debug: Record<string, unknown>;
}

interface Px {
  x: number;
  y: number;
  rgb: RGB;
}

/** k-means (Lab uzayında) ile baskın rengi bulur; en kalabalık kümenin RGB ortalamasını döner. */
export function dominantColor(pixels: RGB[], k = 3): RGB | null {
  if (pixels.length === 0) return null;
  const step = Math.max(1, Math.floor(pixels.length / 1500));
  const sample: RGB[] = [];
  for (let i = 0; i < pixels.length; i += step) sample.push(pixels[i]);
  const labs = sample.map(rgbToLab);
  const kk = Math.min(k, sample.length);
  // Deterministik başlangıç: parlaklığa göre sıralayıp çeyreklerden seç
  const order = labs.map((l, i) => [l[0], i] as const).sort((a, b) => a[0] - b[0]);
  let centers = Array.from({ length: kk }, (_, i) => labs[order[Math.floor(((i + 0.5) / kk) * order.length)][1]]);
  let assign = new Int32Array(labs.length);
  for (let iter = 0; iter < 10; iter++) {
    assign = new Int32Array(labs.length);
    for (let i = 0; i < labs.length; i++) {
      let best = 0;
      let bd = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const d = labDistance(labs[i], centers[c], 1);
        if (d < bd) {
          bd = d;
          best = c;
        }
      }
      assign[i] = best;
    }
    centers = centers.map((old, c) => {
      let n = 0;
      const s = [0, 0, 0];
      for (let i = 0; i < labs.length; i++)
        if (assign[i] === c) {
          n++;
          s[0] += labs[i][0];
          s[1] += labs[i][1];
          s[2] += labs[i][2];
        }
      return n ? ([s[0] / n, s[1] / n, s[2] / n] as [number, number, number]) : old;
    });
  }
  const counts = new Array(centers.length).fill(0);
  for (const a of assign) counts[a]++;
  const top = counts.indexOf(Math.max(...counts));
  const sum = [0, 0, 0];
  let n = 0;
  for (let i = 0; i < sample.length; i++)
    if (assign[i] === top) {
      sum[0] += sample[i][0];
      sum[1] += sample[i][1];
      sum[2] += sample[i][2];
      n++;
    }
  return [Math.round(sum[0] / n), Math.round(sum[1] / n), Math.round(sum[2] / n)];
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))))];
}

/**
 * Saç rengi: parlama ve arka plan karışmasını azaltmak için piksellerin
 * daha koyu %60'ının baskın rengi alınır.
 */
function hairColorOf(pixels: RGB[]): RGB | null {
  if (!pixels.length) return null;
  const lum = (p: RGB) => 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2];
  const sorted = [...pixels].sort((a, b) => lum(a) - lum(b));
  return dominantColor(sorted.slice(0, Math.max(1, Math.floor(sorted.length * 0.6))), 2);
}

const NATURAL_HAIR = ['black', 'darkBrown', 'reddishBrown', 'mediumNougat', 'darkTan', 'tan', 'darkOrange', 'darkGray', 'lightGray', 'white'].map(getColor);
const GLASSES = ['black', 'darkGray', 'darkBrown', 'reddishBrown', 'darkRed', 'darkBlue', 'lightGray'].map(getColor);

/**
 * Segmentasyon maskesi + piksellerden figür özelliklerini çıkarır.
 * rgba: w*h*4, mask: w*h (kategori indeksleri)
 */
export function extractFeatures(rgba: Uint8ClampedArray, mask: Uint8Array, w: number, h: number): AnalysisResult {
  const byCat: Px[][] = [[], [], [], [], [], []];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const c = mask[i];
      if (c === 0 || c > 5) continue;
      byCat[c].push({ x, y, rgb: [rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]] });
    }
  const notes: string[] = [];
  const design: Partial<FigureDesign> = {};
  const face = byCat[CAT.faceSkin];
  const detected = { face: false, hair: false, clothes: false, pants: false };
  const debug: Record<string, unknown> = {};

  if (face.length < w * h * 0.003) {
    notes.push('Fotoğrafta yüz net algılanamadı. Özellikleri aşağıdan elle seçebilirsin.');
    return { design, notes, confidence: 0.1, detected, debug };
  }
  detected.face = true;

  const fx = face.map((p) => p.x);
  const fy = face.map((p) => p.y);
  const left = percentile(fx, 0.02);
  const right = percentile(fx, 0.98);
  const top = percentile(fy, 0.02);
  const bottom = percentile(fy, 0.98);
  const fw = Math.max(1, right - left);
  const fh = Math.max(1, bottom - top);
  const cx = (left + right) / 2;
  const inBox = (p: Px, x0: number, x1: number, y0: number, y1: number) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;

  // --- Ten rengi: yüzün merkez bölgesi ---
  const skinPx = face
    .filter((p) => inBox(p, left + fw * 0.2, right - fw * 0.2, top + fh * 0.3, bottom - fh * 0.1))
    .map((p) => p.rgb);
  const skinRgb = dominantColor(skinPx.length > 50 ? skinPx : face.map((p) => p.rgb), 2);
  if (skinRgb) design.skin = nearestColor(skinRgb, colorsInGroup('skin'), 0.5).id;
  debug.skinRgb = skinRgb;

  // --- Saç ---
  const hair = byCat[CAT.hair];
  const beardBand = { x0: left + fw * 0.2, x1: right - fw * 0.2, y0: top + fh * 0.65, y1: bottom + fh * 0.35 };
  const isBeardArea = (p: Px) => inBox(p, beardBand.x0, beardBand.x1, beardBand.y0, beardBand.y1);
  const headHair = hair.filter((p) => !isBeardArea(p));
  const faceArea = face.length;

  const topHair = headHair.filter((p) => p.y < top + fh * 0.3);
  const topBandArea = fw * fh * 0.3 + fw * fh * 0.3; // alnın üstü + saç bölgesi
  let style: HairStyle = 'short';
  if (headHair.length < faceArea * 0.12 && topHair.length < topBandArea * 0.12) {
    style = 'bald';
  } else {
    detected.hair = true;
    const sideBelow = headHair.filter(
      (p) => p.y > bottom + fh * 0.2 && (p.x < left + fw * 0.08 || p.x > right - fw * 0.08),
    ).length;
    const longRatio = sideBelow / faceArea;
    if (longRatio > 0.4) style = 'long';
    else if (longRatio > 0.1) style = 'medium';

    const hx = headHair.map((p) => p.x);
    const hy = headHair.map((p) => p.y);
    const hairW = percentile(hx, 0.97) - percentile(hx, 0.03);
    const hairTop = percentile(hy, 0.02);
    const aboveBun = headHair.filter((p) => p.y < top - fh * 0.5);
    if (aboveBun.length > faceArea * 0.04) {
      const ax = aboveBun.map((p) => p.x);
      if (percentile(ax, 0.9) - percentile(ax, 0.1) < fw * 0.7) style = 'bun';
    }
    if (style !== 'bun' && hairW > fw * 1.75 && hairTop < top - fh * 0.5) style = 'volume';

    const hairRgb = hairColorOf((topHair.length > 80 ? topHair : headHair).map((p) => p.rgb));
    debug.hairRgb = hairRgb;
    debug.longRatio = longRatio;
    if (hairRgb) design.hairColor = nearestColor(hairRgb, NATURAL_HAIR, 0.9, 1.3).id;
  }
  design.hairStyle = style;

  // --- Sakal / bıyık ---
  let beardHair = 0;
  let beardTotal = 0;
  for (const cat of [CAT.hair, CAT.faceSkin, CAT.bodySkin] as const) {
    for (const p of byCat[cat])
      if (isBeardArea(p)) {
        beardTotal++;
        if (cat === CAT.hair) beardHair++;
      }
  }
  const beardFrac = beardTotal ? beardHair / beardTotal : 0;
  let facial: FacialHair = 'none';
  if (beardFrac > 0.3) facial = 'fullBeard';
  else if (beardFrac > 0.1) facial = 'mustache';
  design.facialHair = facial;
  debug.beardFrac = beardFrac;
  if (facial !== 'none' && !design.hairColor) {
    const rgb = hairColorOf(hair.filter(isBeardArea).map((p) => p.rgb));
    if (rgb) design.hairColor = nearestColor(rgb, NATURAL_HAIR, 0.9, 1.3).id;
  }

  // --- Gözlük ---
  const acc = byCat[CAT.accessory].filter((p) => inBox(p, left, right, top + fh * 0.2, top + fh * 0.62));
  const eyeBandArea = fw * fh * 0.42;
  design.glasses = acc.length > eyeBandArea * 0.03;
  debug.glassesFrac = acc.length / eyeBandArea;
  if (design.glasses) {
    const rgb = dominantColor(acc.map((p) => p.rgb), 2);
    design.glassesColor = rgb ? nearestColor(rgb, GLASSES, 1).id : 'black';
  }

  // --- Kıyafet ---
  const clothes = byCat[CAT.clothes].filter((p) => p.y > bottom);
  const shirtBand = clothes.filter((p) => p.y > bottom + fh * 0.3 && p.y < bottom + fh * 2.2);
  const clothesPalette = colorsInGroup('clothes');
  if (shirtBand.length > faceArea * 0.15) {
    detected.clothes = true;
    // Ceket tespiti: yakanın hemen altındaki orta şerit (gömlek) ile yanlar (ceket) farklı mı?
    const center = clothes
      .filter((p) => p.y > bottom + fh * 0.1 && p.y < bottom + fh * 0.9 && Math.abs(p.x - cx) < fw * 0.18)
      .map((p) => p.rgb);
    const sides = shirtBand
      .filter((p) => Math.abs(p.x - cx) > fw * 0.5 && Math.abs(p.x - cx) < fw * 1.5)
      .map((p) => p.rgb);
    const all = dominantColor(shirtBand.map((p) => p.rgb), 3)!;
    const cRgb = center.length > 40 ? dominantColor(center, 2) : null;
    const sRgb = sides.length > 60 ? dominantColor(sides, 2) : null;
    debug.shirtRgb = all;
    debug.centerRgb = cRgb;
    debug.sideRgb = sRgb;
    const match = (rgb: RGB) => nearestColor(rgb, clothesPalette, 0.8, 1.3).id;
    if (cRgb && sRgb && labDistance(rgbToLab(cRgb), rgbToLab(sRgb), 1) > 28) {
      design.shirtColor = match(cRgb);
      design.jacketColor = match(sRgb);
      design.jacket = design.shirtColor !== design.jacketColor;
    } else {
      design.jacket = false;
      design.shirtColor = match(all);
    }
  } else {
    notes.push('Kıyafet fotoğrafta az görünüyor; üst rengi için varsayılan kullanıldı.');
  }

  const lower = clothes.filter((p) => p.y > bottom + fh * 3.2);
  if (lower.length > faceArea * 0.3) {
    const rgb = dominantColor(lower.map((p) => p.rgb), 2);
    if (rgb) {
      detected.pants = true;
      design.bottomColor = nearestColor(rgb, clothesPalette, 0.8, 1.3).id;
    }
  }
  if (!detected.pants) notes.push('Alt giyim görünmüyor; rengini kendin seçebilirsin.');

  let confidence = 0.4;
  if (detected.hair || style === 'bald') confidence += 0.2;
  if (detected.clothes) confidence += 0.2;
  if (detected.pants) confidence += 0.1;
  return { design, notes, confidence: Math.min(1, confidence), detected, debug };
}

/** Test/yardımcı: hex rengini RGB'ye çevirir */
export const rgbOf = (id: string): RGB => hexToRgb(getColor(id).hex);
