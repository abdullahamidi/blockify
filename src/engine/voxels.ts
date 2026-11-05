import { PALETTE, FILLER_ID } from './palette';

/** Hücre değerleri: 0 = boş, WILDCARD = görünmeyen iç hücre (herhangi bir renk olabilir), >0 = PALETTE indeksi + 1 */
export const EMPTY = 0;
export const WILDCARD = -1;

const indexById = new Map(PALETTE.map((c, i) => [c.id, i + 1]));

export function colorCode(id: string): number {
  const code = indexById.get(id);
  if (code === undefined) throw new Error(`Bilinmeyen renk: ${id}`);
  return code;
}

export function colorIdFromCode(code: number): string {
  if (code === WILDCARD) return FILLER_ID;
  const c = PALETTE[code - 1];
  if (!c) throw new Error(`Geçersiz renk kodu: ${code}`);
  return c.id;
}

export function isTransparentCode(code: number): boolean {
  return code > 0 && !!PALETTE[code - 1]?.transparent;
}

/** x: genişlik (sol→sağ), y: yükseklik (katman), z: derinlik (arka→ön, ön yüz z=d-1) */
export class VoxelGrid {
  readonly cells: Int16Array;
  constructor(
    readonly w: number,
    readonly h: number,
    readonly d: number,
  ) {
    this.cells = new Int16Array(w * h * d);
  }

  inBounds(x: number, y: number, z: number): boolean {
    return x >= 0 && y >= 0 && z >= 0 && x < this.w && y < this.h && z < this.d;
  }

  idx(x: number, y: number, z: number): number {
    return x + this.w * (z + this.d * y);
  }

  get(x: number, y: number, z: number): number {
    return this.inBounds(x, y, z) ? this.cells[this.idx(x, y, z)] : EMPTY;
  }

  set(x: number, y: number, z: number, code: number): void {
    if (this.inBounds(x, y, z)) this.cells[this.idx(x, y, z)] = code;
  }

  /** Kapsayıcı aralıklarla kutu doldurur. */
  fill(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, code: number): void {
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) this.set(x, y, z, code);
  }

  /** Sadece dolu hücrelerin rengini değiştirir. */
  paint(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, code: number): void {
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++) if (this.get(x, y, z) !== EMPTY) this.set(x, y, z, code);
  }

  count(): number {
    let n = 0;
    for (const c of this.cells) if (c !== EMPTY) n++;
    return n;
  }

  /**
   * Altı yüzü de opak dolu komşularla kapalı hücreleri WILDCARD yapar.
   * Bu hücreler dışarıdan görünmez, iç dolgu parçalarıyla doldurulabilir.
   */
  markHiddenAsWildcard(): VoxelGrid {
    const out = new VoxelGrid(this.w, this.h, this.d);
    const opaque = (x: number, y: number, z: number) => {
      const c = this.get(x, y, z);
      return c !== EMPTY && !isTransparentCode(c);
    };
    for (let y = 0; y < this.h; y++)
      for (let z = 0; z < this.d; z++)
        for (let x = 0; x < this.w; x++) {
          const c = this.get(x, y, z);
          if (c === EMPTY) continue;
          const hidden =
            !isTransparentCode(c) &&
            opaque(x - 1, y, z) &&
            opaque(x + 1, y, z) &&
            opaque(x, y - 1, z) &&
            opaque(x, y + 1, z) &&
            opaque(x, y, z - 1) &&
            opaque(x, y, z + 1);
          out.set(x, y, z, hidden ? WILDCARD : c);
        }
    return out;
  }
}
