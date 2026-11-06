import type { Brick } from '../../engine/packer';
import { BRICK_H_MM, PLATE_H_MM } from '../../engine/parts';

const r = (v: number) => Math.round(v * 1000) / 1000;

/**
 * Parçanın alt yüzü ve yüksekliği (mm).
 * v2 parçalarında `h` vardır ve `y` plaka katıdır. v1 siparişlerinde `h` yoktur,
 * `y` tuğla katmanıdır (taban plakası varsa 0. katman plakadır).
 */
export function brickBox(b: Brick, hasBase: boolean): { bottomMm: number; heightMm: number } {
  if (b.h !== undefined) return { bottomMm: r(b.y * PLATE_H_MM), heightMm: r(b.h * PLATE_H_MM) };
  if (!hasBase) return { bottomMm: r(b.y * BRICK_H_MM), heightMm: BRICK_H_MM };
  if (b.y === 0) return { bottomMm: 0, heightMm: PLATE_H_MM };
  return { bottomMm: r(PLATE_H_MM + (b.y - 1) * BRICK_H_MM), heightMm: BRICK_H_MM };
}

/** Parça bu kat (v2: plaka katı, v1: tuğla katmanı) içinde yer kaplıyor mu? */
export function occupies(b: Brick, layer: number): boolean {
  return layer >= b.y && layer < b.y + (b.h ?? 1);
}
