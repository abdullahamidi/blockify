// Kullanılan evrensel tuğla tipleri (standart 8 mm modül, 9.6 mm yükseklik).
// `ref` tedarik/arama için yaygın kullanılan parça numarasıdır (yalnızca iç kullanım).

export interface PartType {
  id: string; // "2x4" gibi, küçük boyut önce
  name: string;
  w: number; // kısa kenar (stud)
  l: number; // uzun kenar (stud)
  ref: string;
}

export const PARTS: PartType[] = [
  { id: '2x4', name: 'Tuğla 2x4', w: 2, l: 4, ref: '3001' },
  { id: '2x3', name: 'Tuğla 2x3', w: 2, l: 3, ref: '3002' },
  { id: '1x6', name: 'Tuğla 1x6', w: 1, l: 6, ref: '3009' },
  { id: '2x2', name: 'Tuğla 2x2', w: 2, l: 2, ref: '3003' },
  { id: '1x4', name: 'Tuğla 1x4', w: 1, l: 4, ref: '3010' },
  { id: '1x3', name: 'Tuğla 1x3', w: 1, l: 3, ref: '3622' },
  { id: '1x2', name: 'Tuğla 1x2', w: 1, l: 2, ref: '3004' },
  { id: '1x1', name: 'Tuğla 1x1', w: 1, l: 1, ref: '3005' },
];

/** Kaide için tek parça plaka (3.2 mm yükseklik) */
export const BASE_PLATE: PartType = { id: 'plate8x8', name: 'Plaka 8x8 (kaide)', w: 8, l: 8, ref: '41539' };

const byId = new Map([...PARTS, BASE_PLATE].map((p) => [p.id, p]));

export function getPart(id: string): PartType {
  const p = byId.get(id);
  if (!p) throw new Error(`Bilinmeyen parça: ${id}`);
  return p;
}

export function partForFootprint(sx: number, sz: number): PartType | undefined {
  const w = Math.min(sx, sz);
  const l = Math.max(sx, sz);
  return PARTS.find((p) => p.w === w && p.l === l);
}

/** Standart ölçüler (mm) */
export const STUD_MM = 8;
export const BRICK_H_MM = 9.6;
export const PLATE_H_MM = 3.2;
