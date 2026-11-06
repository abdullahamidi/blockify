// Kullanılan evrensel parça tipleri (standart 8 mm modül).
// Tuğla 9.6 mm (h: 3 plaka), plaka 3.2 mm (h: 1 plaka) yüksekliğindedir.
// `ref` tedarik/arama için yaygın kullanılan parça numarasıdır (yalnızca iç kullanım).

export type PartKind = 'brick' | 'plate' | 'baseplate';

export interface PartType {
  id: string; // "2x4", "p2x4" gibi, küçük boyut önce
  kind: PartKind;
  name: string;
  w: number; // kısa kenar (stud)
  l: number; // uzun kenar (stud)
  h: 1 | 3; // yükseklik (plaka cinsinden)
  ref: string;
}

function brick(w: number, l: number, ref: string): PartType {
  return { id: `${w}x${l}`, kind: 'brick', name: `Tuğla ${w}x${l}`, w, l, h: 3, ref };
}

function plate(w: number, l: number, ref: string): PartType {
  return { id: `p${w}x${l}`, kind: 'plate', name: `Plaka ${w}x${l}`, w, l, h: 1, ref };
}

function baseplate(w: number, l: number, ref: string): PartType {
  return { id: `plate${w}x${l}`, kind: 'baseplate', name: `Plaka ${w}x${l} (kaide)`, w, l, h: 1, ref };
}

export const BRICKS: PartType[] = [
  brick(1, 1, '3005'),
  brick(1, 2, '3004'),
  brick(1, 3, '3622'),
  brick(1, 4, '3010'),
  brick(1, 6, '3009'),
  brick(2, 2, '3003'),
  brick(2, 3, '3002'),
  brick(2, 4, '3001'),
];

export const PLATES: PartType[] = [
  plate(1, 1, '3024'),
  plate(1, 2, '3023'),
  plate(1, 3, '3623'),
  plate(1, 4, '3710'),
  plate(1, 6, '3666'),
  plate(2, 2, '3022'),
  plate(2, 3, '3021'),
  plate(2, 4, '3020'),
];

export const BASEPLATES: PartType[] = [
  baseplate(8, 8, '41539'),
  baseplate(8, 16, '92438'),
  baseplate(16, 16, '91405'),
];

/** Döşenebilir parçalar: tuğla + plaka */
export const PARTS: PartType[] = [...BRICKS, ...PLATES];

const byId = new Map([...PARTS, ...BASEPLATES].map((p) => [p.id, p]));

export function getPart(id: string): PartType {
  const p = byId.get(id);
  if (!p) throw new Error(`Bilinmeyen parça: ${id}`);
  return p;
}

export function partForFootprint(sx: number, sz: number, kind: 'brick' | 'plate'): PartType | undefined {
  const w = Math.min(sx, sz);
  const l = Math.max(sx, sz);
  return PARTS.find((p) => p.kind === kind && p.w === w && p.l === l);
}

/** Standart ölçüler (mm) */
export const STUD_MM = 8;
export const BRICK_H_MM = 9.6;
export const PLATE_H_MM = 3.2;
