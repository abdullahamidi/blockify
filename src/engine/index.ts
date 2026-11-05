import { buildBom, type BomLine } from './bom';
import { buildFigureVoxels, sanitizeDesign, type FigureDesign } from './figure';
import { packBricks, type Brick } from './packer';
import { BASE_PLATE, BRICK_H_MM, PLATE_H_MM, STUD_MM } from './parts';
import { DEFAULT_PRICING, priceFor, type PriceBreakdown, type PricingConfig } from './pricing';

export * from './bom';
export * from './figure';
export * from './packer';
export * from './palette';
export * from './parts';
export * from './pricing';

export interface ModelStats {
  brickCount: number;
  lineCount: number;
  colorCount: number;
  steps: number;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  components: number;
  looseBricks: number;
}

export interface FigureModel {
  design: FigureDesign;
  dims: { w: number; h: number; d: number };
  bricks: Brick[];
  bom: BomLine[];
  stats: ModelStats;
  price: PriceBreakdown;
}

export const ENGINE_VERSION = 1;

export function generateModel(input: unknown, pricing: PricingConfig = DEFAULT_PRICING): FigureModel {
  const design = sanitizeDesign(input);
  const voxels = buildFigureVoxels(design).markHiddenAsWildcard();
  const pack = packBricks(voxels);
  let bricks = pack.bricks;
  if (design.base) {
    // Kaide: tek parça plaka, figür bunun üstüne kurulur (katman 0 = plaka)
    const plate: Brick = {
      id: 0,
      part: BASE_PLATE.id,
      color: design.baseColor,
      x: 1,
      y: 0,
      z: 1,
      sx: BASE_PLATE.w,
      sz: BASE_PLATE.l,
      step: 0,
      hanging: false,
      plate: true,
    };
    bricks = [plate, ...bricks.map((b) => ({ ...b, id: b.id + 1, y: b.y + 1, step: b.step + 1 }))];
  }
  const bom = buildBom(bricks);

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const b of bricks) {
    minX = Math.min(minX, b.x);
    maxX = Math.max(maxX, b.x + b.sx);
    minZ = Math.min(minZ, b.z);
    maxZ = Math.max(maxZ, b.z + b.sz);
  }
  const steps = new Set(bricks.map((b) => b.step)).size;

  return {
    design,
    dims: { w: voxels.w, h: voxels.h + (design.base ? 1 : 0), d: voxels.d },
    bricks,
    bom,
    stats: {
      brickCount: bricks.length,
      lineCount: bom.length,
      colorCount: new Set(bom.map((l) => l.color)).size,
      steps,
      widthMm: Math.round((maxX - minX) * STUD_MM),
      depthMm: Math.round((maxZ - minZ) * STUD_MM),
      heightMm: Math.round(voxels.h * BRICK_H_MM + (design.base ? PLATE_H_MM : 0) + 1.7),
      components: pack.components,
      looseBricks: pack.looseBricks,
    },
    price: priceFor(bom, pricing),
  };
}
