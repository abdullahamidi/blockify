import { Catalog, isEnabled, nearestEnabledColor } from '../catalog';
import { ColorGroup, PALETTE, isColorId } from '../palette';

export const SIZES = ['S', 'M', 'L'] as const;
export type FigureSize = (typeof SIZES)[number];
export const SIZE_LABELS: Record<FigureSize, string> = { S: 'Küçük', M: 'Orta', L: 'Büyük' };
export const HEAD_WIDTH: Record<FigureSize, number> = { S: 8, M: 12, L: 16 };
export const BASEPLATE_FOR_SIZE: Record<FigureSize, string> = {
  S: 'plate8x8',
  M: 'plate8x16',
  L: 'plate16x16',
};

export const HAIR_STYLES = ['short', 'medium', 'long', 'bun', 'volume', 'bald'] as const;
export const FACIAL_HAIR = ['none', 'mustache', 'goatee', 'shortBeard', 'fullBeard'] as const;
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
  shortBeard: 'Kısa sakal',
  fullBeard: 'Dolgun sakal',
};

export const BOTTOM_STYLE_LABELS: Record<BottomStyle, string> = {
  pants: 'Pantolon',
  shorts: 'Şort',
  skirt: 'Etek',
};

/** Yüz ölçekleri: normalize birim (u: kafa genişliğinde -1..1, v: çene altı 0, tepe 1). */
export const FACE_SCALE = {
  browHeight: { values: [0.715, 0.73, 0.745, 0.76, 0.775], def: 2 },
  browTilt: { values: [-0.03, -0.015, 0, 0.015, 0.03], def: 2 },
  browThickness: { values: [0.02, 0.026, 0.034], def: 1 },
  browGap: { values: [0.12, 0.16, 0.22], def: 1 },
  eyeHeight: { values: [0.55, 0.575, 0.6, 0.625, 0.65], def: 2 },
  eyeSpacing: { values: [0.34, 0.4, 0.46], def: 1 },
  eyeWidth: { values: [0.15, 0.185, 0.22], def: 2 },
  noseBottom: { values: [0.42, 0.445, 0.47, 0.495], def: 1 },
  noseWidth: { values: [0.16, 0.22, 0.28], def: 1 },
  mouthHeight: { values: [0.29, 0.32, 0.345, 0.37], def: 2 },
  mouthWidth: { values: [0.22, 0.28, 0.34], def: 1 },
  chinTaper: { values: [0.3, 0.5, 0.7], def: 1 },
  crownRound: { values: [0.82, 0.78, 0.74], def: 1 },
  earHeight: { values: [0.38, 0.42, 0.46], def: 1 },
} as const satisfies Record<string, { values: readonly number[]; def: number }>;

export type FaceKey = keyof typeof FACE_SCALE;
export type FaceParams = Record<FaceKey, number>;
const FACE_KEYS = Object.keys(FACE_SCALE) as FaceKey[];

export interface ExpressionParams {
  smile: number; // 0..3
  browRaiseL: number; // -1..2
  browRaiseR: number; // -1..2
  eyeOpen: number; // 0..2 (0 kısık göz; kapalı göz yok)
}

const EXPRESSION_RANGE: Record<keyof ExpressionParams, { min: number; max: number; def: number }> = {
  smile: { min: 0, max: 3, def: 0 },
  browRaiseL: { min: -1, max: 2, def: 0 },
  browRaiseR: { min: -1, max: 2, def: 0 },
  eyeOpen: { min: 0, max: 2, def: 1 },
};
const EXPRESSION_KEYS = Object.keys(EXPRESSION_RANGE) as (keyof ExpressionParams)[];

export interface FigureDesign {
  size: FigureSize;
  skin: string;
  hairColor: string;
  hairStyle: HairStyle;
  hairline: number; // 0..2
  facialHair: FacialHair;
  beardLine: number; // 0..2
  glasses: boolean;
  glassesColor: string;
  face: FaceParams;
  expression: ExpressionParams;
  shirtColor: string;
  collar: boolean;
  jacket: boolean;
  jacketOpen: boolean;
  jacketColor: string;
  bottomStyle: BottomStyle;
  bottomColor: string;
  shoeColor: string;
  base: boolean;
  baseColor: string;
}

const DEFAULT_FACE = Object.fromEntries(FACE_KEYS.map((k) => [k, FACE_SCALE[k].def])) as FaceParams;
const DEFAULT_EXPRESSION = Object.fromEntries(
  EXPRESSION_KEYS.map((k) => [k, EXPRESSION_RANGE[k].def]),
) as unknown as ExpressionParams;

export const DEFAULT_DESIGN: FigureDesign = {
  size: 'M',
  skin: 'lightNougat',
  hairColor: 'darkBrown',
  hairStyle: 'short',
  hairline: 1,
  facialHair: 'none',
  beardLine: 1,
  glasses: false,
  glassesColor: 'black',
  face: DEFAULT_FACE,
  expression: DEFAULT_EXPRESSION,
  shirtColor: 'red',
  collar: false,
  jacket: false,
  jacketOpen: true,
  jacketColor: 'darkBlue',
  bottomStyle: 'pants',
  bottomColor: 'darkBlue',
  shoeColor: 'white',
  base: true,
  baseColor: 'darkGray',
};

const COLOR_GROUPS = {
  skin: 'skin',
  hairColor: 'hair',
  glassesColor: 'detail',
  shirtColor: 'clothes',
  jacketColor: 'clothes',
  bottomColor: 'clothes',
  shoeColor: 'clothes',
  baseColor: 'base',
} as const satisfies Record<string, ColorGroup>;

function level(v: unknown, min: number, max: number, def: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return def;
  return Math.min(max, Math.max(min, Math.round(v)));
}

/** Seviyenin karşılığı olan normalize değer. */
export function faceValue(design: FigureDesign, key: FaceKey): number {
  return FACE_SCALE[key].values[design.face[key]];
}

/** Dışarıdan gelen (güvenilmeyen) veriyi geçerli bir tasarıma çevirir. Katalog verilirse renkler ona uydurulur. */
export function sanitizeDesign(input: unknown, catalog?: Catalog): FigureDesign {
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const out: FigureDesign = { ...DEFAULT_DESIGN, face: { ...DEFAULT_FACE }, expression: { ...DEFAULT_EXPRESSION } };

  if ((SIZES as readonly unknown[]).includes(src.size)) out.size = src.size as FigureSize;

  for (const k of Object.keys(COLOR_GROUPS) as (keyof typeof COLOR_GROUPS)[]) {
    const v = src[k];
    if (isColorId(v) && v !== 'transClear') out[k] = v;
    if (catalog) out[k] = nearestEnabledColor(catalog, out[k], COLOR_GROUPS[k]);
  }

  if ((HAIR_STYLES as readonly unknown[]).includes(src.hairStyle)) out.hairStyle = src.hairStyle as HairStyle;
  if (src.facialHair === 'beard') out.facialHair = 'fullBeard';
  else if ((FACIAL_HAIR as readonly unknown[]).includes(src.facialHair)) out.facialHair = src.facialHair as FacialHair;
  if ((BOTTOM_STYLES as readonly unknown[]).includes(src.bottomStyle)) out.bottomStyle = src.bottomStyle as BottomStyle;

  out.hairline = level(src.hairline, 0, 2, DEFAULT_DESIGN.hairline);
  out.beardLine = level(src.beardLine, 0, 2, DEFAULT_DESIGN.beardLine);

  for (const k of ['glasses', 'jacket', 'base', 'collar', 'jacketOpen'] as const) {
    if (typeof src[k] === 'boolean') out[k] = src[k] as boolean;
  }

  const face = src.face && typeof src.face === 'object' ? (src.face as Record<string, unknown>) : {};
  for (const k of FACE_KEYS) {
    out.face[k] = level(face[k], 0, FACE_SCALE[k].values.length - 1, FACE_SCALE[k].def);
  }
  const expr = src.expression && typeof src.expression === 'object' ? (src.expression as Record<string, unknown>) : {};
  for (const k of EXPRESSION_KEYS) {
    const r = EXPRESSION_RANGE[k];
    out.expression[k] = level(expr[k], r.min, r.max, r.def);
  }

  if (catalog && out.base) {
    const plate = BASEPLATE_FOR_SIZE[out.size];
    if (!isEnabled(catalog, plate, out.baseColor)) {
      const found = PALETTE.find((c) => isEnabled(catalog, plate, c.id));
      if (found) out.baseColor = found.id;
      else out.base = false;
    }
  }
  return out;
}
