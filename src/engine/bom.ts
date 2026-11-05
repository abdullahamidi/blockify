import { FILLER_ID, getColor } from './palette';
import { getPart } from './parts';
import type { Brick } from './packer';

export interface BomLine {
  part: string;
  partName: string;
  partRef: string;
  color: string;
  colorName: string;
  colorHex: string;
  colorRef: number;
  colorRefName: string;
  qty: number;
}

export function buildBom(bricks: Brick[]): BomLine[] {
  const map = new Map<string, BomLine>();
  for (const b of bricks) {
    const key = `${b.color}|${b.part}`;
    let line = map.get(key);
    if (!line) {
      const part = getPart(b.part);
      const color = getColor(b.color);
      line = {
        part: part.id,
        partName: part.name,
        partRef: part.ref,
        color: color.id,
        colorName: color.name,
        colorHex: color.hex,
        colorRef: color.ref,
        colorRefName: color.refName,
        qty: 0,
      };
      map.set(key, line);
    }
    line.qty++;
  }
  const partOrder = ['plate8x8', '2x4', '2x3', '2x2', '1x6', '1x4', '1x3', '1x2', '1x1'];
  return [...map.values()].sort((a, b) => {
    // İç dolgu en sona, sonra renk adı, sonra büyükten küçüğe parça
    if ((a.color === FILLER_ID) !== (b.color === FILLER_ID)) return a.color === FILLER_ID ? 1 : -1;
    if (a.color !== b.color) return a.colorName.localeCompare(b.colorName, 'tr');
    return partOrder.indexOf(a.part) - partOrder.indexOf(b.part);
  });
}
