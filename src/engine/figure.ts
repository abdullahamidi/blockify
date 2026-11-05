import { isColorId } from './palette';
import { VoxelGrid, colorCode } from './voxels';

export const HAIR_STYLES = ['short', 'medium', 'long', 'bun', 'volume', 'bald'] as const;
export const FACIAL_HAIR = ['none', 'mustache', 'goatee', 'beard'] as const;
export const BOTTOM_STYLES = ['pants', 'shorts', 'skirt'] as const;

export type HairStyle = (typeof HAIR_STYLES)[number];
export type FacialHair = (typeof FACIAL_HAIR)[number];
export type BottomStyle = (typeof BOTTOM_STYLES)[number];

export const HAIR_STYLE_LABELS: Record<HairStyle, string> = {
  short: 'Kısa',
  medium: 'Omuz boyu',
  long: 'Uzun',
  bun: 'Topuz',
  volume: 'Kabarık',
  bald: 'Kel',
};

export const FACIAL_HAIR_LABELS: Record<FacialHair, string> = {
  none: 'Yok',
  mustache: 'Bıyık',
  goatee: 'Keçi sakal',
  beard: 'Sakal',
};

export const BOTTOM_STYLE_LABELS: Record<BottomStyle, string> = {
  pants: 'Pantolon',
  shorts: 'Şort',
  skirt: 'Etek',
};

export interface FigureDesign {
  skin: string;
  hairColor: string;
  hairStyle: HairStyle;
  facialHair: FacialHair;
  glasses: boolean;
  glassesColor: string;
  shirtColor: string;
  jacket: boolean;
  jacketColor: string;
  bottomStyle: BottomStyle;
  bottomColor: string;
  shoeColor: string;
  base: boolean;
  baseColor: string;
}

export const DEFAULT_DESIGN: FigureDesign = {
  skin: 'lightNougat',
  hairColor: 'darkBrown',
  hairStyle: 'short',
  facialHair: 'none',
  glasses: false,
  glassesColor: 'black',
  shirtColor: 'red',
  jacket: false,
  jacketColor: 'darkBlue',
  bottomStyle: 'pants',
  bottomColor: 'darkBlue',
  shoeColor: 'white',
  base: true,
  baseColor: 'darkGray',
};

/** Dışarıdan gelen (güvenilmeyen) veriyi geçerli bir tasarıma çevirir. */
export function sanitizeDesign(input: unknown): FigureDesign {
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const out: FigureDesign = { ...DEFAULT_DESIGN };
  const colorKeys = [
    'skin',
    'hairColor',
    'glassesColor',
    'shirtColor',
    'jacketColor',
    'bottomColor',
    'shoeColor',
    'baseColor',
  ] as const;
  for (const k of colorKeys) {
    const v = src[k];
    if (isColorId(v) && v !== 'transClear') out[k] = v;
  }
  if ((HAIR_STYLES as readonly unknown[]).includes(src.hairStyle)) out.hairStyle = src.hairStyle as HairStyle;
  if ((FACIAL_HAIR as readonly unknown[]).includes(src.facialHair)) out.facialHair = src.facialHair as FacialHair;
  if ((BOTTOM_STYLES as readonly unknown[]).includes(src.bottomStyle))
    out.bottomStyle = src.bottomStyle as BottomStyle;
  for (const k of ['glasses', 'jacket', 'base'] as const) {
    if (typeof src[k] === 'boolean') out[k] = src[k] as boolean;
  }
  return out;
}

/** Izgara boyutları (stud / tuğla birimi) */
export const GRID_W = 10;
export const GRID_D = 10;
const BODY_H = 19; // katman sayısı (kaide plakası ayrıca eklenir)

/**
 * Tasarımdan voksel ızgarası üretir.
 *
 * Kaide plakası buraya dahil değildir (generateModel ekler).
 * Yerleşim (y): 0 ayakkabı, 1-2 bacak, 3 bel, 4-7 gövde+kollar,
 * 8 boyun, 9-16 kafa (8x8x8), 17-18 topuz/kabarık saç.
 * Ön yüz z = 8 (kafa), gövde ön yüzü z = 6.
 */
export function buildFigureVoxels(design: FigureDesign): VoxelGrid {
  const g = new VoxelGrid(GRID_W, BODY_H, GRID_D);
  const C = colorCode;

  const skin = C(design.skin);
  const hair = C(design.hairColor);
  const shirt = C(design.shirtColor);
  const outer = design.jacket ? C(design.jacketColor) : shirt;
  const bottom = C(design.bottomColor);
  const shoes = C(design.shoeColor);

  const fill = g.fill.bind(g);
  const paint = g.paint.bind(g);
  const set = g.set.bind(g);

  // --- Ayakkabılar ---
  fill(3, 6, 0, 0, 3, 6, shoes);

  // --- Alt giyim ---
  if (design.bottomStyle === 'pants') {
    fill(3, 6, 1, 2, 3, 5, bottom);
  } else if (design.bottomStyle === 'shorts') {
    fill(3, 6, 1, 1, 3, 5, skin);
    fill(3, 6, 2, 2, 3, 5, bottom);
  } else {
    fill(3, 6, 1, 1, 3, 5, skin);
    fill(2, 7, 2, 2, 2, 6, bottom); // etek genişler
  }
  fill(3, 6, 3, 3, 3, 6, bottom); // bel

  // --- Gövde ---
  fill(3, 6, 4, 7, 3, 6, outer);
  if (design.jacket) fill(4, 5, 4, 7, 6, 6, shirt); // ceketin önü açık, içte gömlek görünür

  // --- Kollar (eller altta) ---
  for (const x of [2, 7]) {
    fill(x, x, 4, 4, 4, 5, skin);
    fill(x, x, 5, 7, 4, 5, outer);
  }

  // --- Boyun ---
  fill(3, 6, 8, 8, 4, 5, skin);

  // --- Kafa: önce tamamen ten, sonra saç ve yüz detayları ---
  const HY = 9; // kafanın alt katmanı
  fill(1, 8, HY, HY + 7, 1, 8, skin);
  const r = (row: number) => HY + row; // kafa satırı -> y

  const style = design.hairStyle;
  if (style !== 'bald') {
    // Üst katman ve saç çizgisi
    fill(1, 8, r(7), r(7), 1, 8, hair);
    fill(1, 8, r(6), r(6), 1, 8, hair);
    // Yanlar (kulak üstü) ve arka
    paint(1, 1, r(4), r(5), 1, 8, hair);
    paint(8, 8, r(4), r(5), 1, 8, hair);
    paint(1, 1, r(2), r(3), 1, 3, hair);
    paint(8, 8, r(2), r(3), 1, 3, hair);
    paint(1, 8, r(2), r(5), 1, 1, hair);
  }

  if (style === 'medium' || style === 'long') {
    paint(1, 1, r(0), r(5), 1, 8, hair);
    paint(8, 8, r(0), r(5), 1, 8, hair);
    paint(1, 8, r(0), r(5), 1, 1, hair);
    // Kafanın altından sarkan saç (sırtta)
    const from = style === 'long' ? 5 : 7;
    fill(2, 7, from, HY - 1, 1, 2, hair);
  }

  if (style === 'bun') {
    fill(3, 6, r(8), r(8), 2, 5, hair);
    fill(4, 5, r(9), r(9), 3, 4, hair);
  }

  if (style === 'volume') {
    // Kafanın etrafında bir kat daha saç
    fill(0, 0, r(3), r(7), 2, 7, hair);
    fill(9, 9, r(3), r(7), 2, 7, hair);
    fill(2, 7, r(2), r(7), 0, 0, hair);
    fill(2, 7, r(8), r(8), 2, 7, hair);
  }

  // --- Yüz (ön yüz z = 8) ---
  const FZ = 8;
  set(3, r(3), FZ, C('black')); // gözler
  set(6, r(3), FZ, C('black'));
  set(4, r(1), FZ, C('darkRed')); // ağız
  set(5, r(1), FZ, C('darkRed'));

  const fh = design.facialHair;
  if (fh === 'mustache' || fh === 'goatee') {
    for (let x = 3; x <= 6; x++) set(x, r(2), FZ, hair); // bıyık
  }
  if (fh === 'goatee') {
    set(4, r(0), FZ, hair);
    set(5, r(0), FZ, hair);
  }
  if (fh === 'beard') {
    for (let x = 2; x <= 7; x++) set(x, r(0), FZ, hair);
    for (const x of [2, 3, 6, 7]) set(x, r(1), FZ, hair);
    for (const x of [2, 4, 5, 7]) set(x, r(2), FZ, hair); // yanaklar açık, ağız üstünde bıyık
    paint(1, 1, r(0), r(3), 4, 8, hair);
    paint(8, 8, r(0), r(3), 4, 8, hair);
    paint(1, 8, r(0), r(0), 4, 8, hair); // çene altı
  }

  if (design.glasses) {
    const frame = C(design.glassesColor);
    for (let x = 2; x <= 7; x++) set(x, r(3), FZ, frame);
    // Camlar şeffaf, gözler camın arkasında
    for (const x of [3, 6]) {
      set(x, r(3), FZ, C('transClear'));
      set(x, r(3), FZ - 1, C('black'));
    }
    // Sap kısmı yanlarda
    for (let z = 5; z <= 8; z++) {
      set(1, r(3), z, frame);
      set(8, r(3), z, frame);
    }
  }

  // Kafanın dikey köşelerini pahla: daha yuvarlak bir kafa silueti
  for (let y = HY; y <= HY + 7; y++) {
    for (const [x, z] of [
      [1, 1],
      [8, 1],
      [1, 8],
      [8, 8],
    ])
      g.set(x, y, z, 0);
  }

  return g;
}
