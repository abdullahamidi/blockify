// Yaygın ve kolay temin edilen tuğla renkleri.
// `ref` alanı tedarik için BrickLink renk numarasıdır (yalnızca iç kullanım: toplama listesi).

export type ColorGroup = 'skin' | 'hair' | 'clothes' | 'detail' | 'base';

export interface BrickColor {
  id: string;
  name: string; // Türkçe görünen ad
  hex: string;
  ref: number; // BrickLink renk no
  refName: string; // BrickLink renk adı
  groups: ColorGroup[];
  transparent?: boolean;
}

export const FILLER_ID = 'filler';

export const PALETTE: BrickColor[] = [
  { id: 'white', name: 'Beyaz', hex: '#F2F3F2', ref: 1, refName: 'White', groups: ['hair', 'clothes', 'base'] },
  { id: 'black', name: 'Siyah', hex: '#1F1F22', ref: 11, refName: 'Black', groups: ['hair', 'clothes', 'detail', 'base'] },
  { id: 'lightGray', name: 'Açık Gri', hex: '#A0A5A9', ref: 86, refName: 'Light Bluish Gray', groups: ['hair', 'clothes', 'base'] },
  { id: 'darkGray', name: 'Koyu Gri', hex: '#6C6E68', ref: 85, refName: 'Dark Bluish Gray', groups: ['hair', 'clothes', 'base'] },
  { id: 'red', name: 'Kırmızı', hex: '#C91A09', ref: 5, refName: 'Red', groups: ['clothes', 'base'] },
  { id: 'darkRed', name: 'Bordo', hex: '#720E0F', ref: 59, refName: 'Dark Red', groups: ['clothes', 'detail'] },
  { id: 'orange', name: 'Turuncu', hex: '#FE8A18', ref: 4, refName: 'Orange', groups: ['clothes'] },
  { id: 'yellow', name: 'Sarı', hex: '#F2CD37', ref: 3, refName: 'Yellow', groups: ['clothes', 'hair'] },
  { id: 'brightGreen', name: 'Açık Yeşil', hex: '#4B9F4A', ref: 36, refName: 'Bright Green', groups: ['clothes', 'base'] },
  { id: 'green', name: 'Yeşil', hex: '#237841', ref: 6, refName: 'Green', groups: ['clothes', 'base'] },
  { id: 'darkGreen', name: 'Koyu Yeşil', hex: '#184632', ref: 80, refName: 'Dark Green', groups: ['clothes'] },
  { id: 'mediumBlue', name: 'Açık Mavi', hex: '#5A93DB', ref: 42, refName: 'Medium Blue', groups: ['clothes'] },
  { id: 'blue', name: 'Mavi', hex: '#0055BF', ref: 7, refName: 'Blue', groups: ['clothes', 'base'] },
  { id: 'darkBlue', name: 'Lacivert', hex: '#0A3463', ref: 63, refName: 'Dark Blue', groups: ['clothes'] },
  { id: 'lavender', name: 'Lila', hex: '#AC78BA', ref: 157, refName: 'Medium Lavender', groups: ['clothes'] },
  { id: 'pink', name: 'Pembe', hex: '#E4ADC8', ref: 104, refName: 'Bright Pink', groups: ['clothes'] },
  { id: 'darkPink', name: 'Fuşya', hex: '#C870A0', ref: 47, refName: 'Dark Pink', groups: ['clothes'] },
  { id: 'tan', name: 'Kum Beji', hex: '#E4CD9E', ref: 2, refName: 'Tan', groups: ['hair', 'clothes', 'skin'] },
  { id: 'darkTan', name: 'Koyu Bej', hex: '#958A73', ref: 69, refName: 'Dark Tan', groups: ['hair', 'clothes'] },
  { id: 'darkOrange', name: 'Bakır', hex: '#A95500', ref: 68, refName: 'Dark Orange', groups: ['hair', 'clothes'] },
  { id: 'reddishBrown', name: 'Kahverengi', hex: '#582A12', ref: 88, refName: 'Reddish Brown', groups: ['hair', 'clothes', 'skin'] },
  { id: 'darkBrown', name: 'Koyu Kahve', hex: '#352100', ref: 120, refName: 'Dark Brown', groups: ['hair', 'clothes', 'skin'] },
  { id: 'lightNougat', name: 'Açık Ten', hex: '#F6D7B3', ref: 90, refName: 'Light Nougat', groups: ['skin'] },
  { id: 'nougat', name: 'Buğday Ten', hex: '#D09168', ref: 28, refName: 'Nougat', groups: ['skin'] },
  { id: 'mediumNougat', name: 'Esmer Ten', hex: '#AA7D55', ref: 150, refName: 'Medium Nougat', groups: ['skin', 'hair'] },
  { id: 'transClear', name: 'Şeffaf', hex: '#E6F2F7', ref: 12, refName: 'Trans-Clear', groups: ['detail'], transparent: true },
];

export const FILLER_COLOR: BrickColor = {
  id: FILLER_ID,
  name: 'İç dolgu (renk fark etmez)',
  hex: '#B8B3AA',
  ref: 0,
  refName: 'Any color',
  groups: [],
};

const byId = new Map<string, BrickColor>(PALETTE.map((c) => [c.id, c]));
byId.set(FILLER_ID, FILLER_COLOR);

export function getColor(id: string): BrickColor {
  const c = byId.get(id);
  if (!c) throw new Error(`Bilinmeyen renk: ${id}`);
  return c;
}

export function isColorId(id: unknown): id is string {
  return typeof id === 'string' && byId.has(id) && id !== FILLER_ID;
}

export function colorsInGroup(group: ColorGroup): BrickColor[] {
  return PALETTE.filter((c) => c.groups.includes(group));
}

// ---- Renk eşleştirme (fotoğraftan alınan RGB -> en yakın palet rengi) ----

export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function srgbToLinear(v: number): number {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function rgbToLab([r, g, b]: RGB): [number, number, number] {
  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(b);
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f(X);
  const fy = f(Y);
  const fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/**
 * Fotoğraftaki ışık farklılıklarına karşı daha toleranslı olmak için
 * parlaklık (L) farkının ağırlığı düşürülmüş Lab mesafesi.
 */
export function labDistance(a: [number, number, number], b: [number, number, number], lightnessWeight = 0.6): number {
  const dl = (a[0] - b[0]) * lightnessWeight;
  return Math.sqrt(dl * dl + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

/**
 * En yakın palet rengini bulur. Fotoğraflardaki renkler tuğla renklerinden daha
 * soluk olduğu için `chromaBoost` ile doygunluk artırılabilir.
 */
export function nearestColor(rgb: RGB, candidates: BrickColor[], lightnessWeight = 0.6, chromaBoost = 1): BrickColor {
  const raw = rgbToLab(rgb);
  const lab: [number, number, number] = [raw[0], raw[1] * chromaBoost, raw[2] * chromaBoost];
  let best = candidates[0];
  let bestD = Infinity;
  for (const c of candidates) {
    const d = labDistance(lab, rgbToLab(hexToRgb(c.hex)), lightnessWeight);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}
