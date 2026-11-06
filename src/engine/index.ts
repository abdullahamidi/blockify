import { buildBom, type BomLine } from './bom';
import { type Catalog, enabledColors, nearestEnabledColor } from './catalog';
import { BASEPLATE_FOR_SIZE, bodyDims, buildFigureVoxels, headDims, sanitizeDesign, type FigureDesign } from './figure';
import { packBricks, type Brick } from './packer';
import { PLATE_H_MM, STUD_MM, getPart } from './parts';
import { EMPTY, VoxelGrid, WILDCARD, colorCode, colorIdFromCode } from './voxels';

export * from './bom';
export * from './catalog';
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
  /** Parçaların kapladığı kutu: w, d stud; h plaka. */
  dims: { w: number; h: number; d: number };
  /** Figür ızgarasının parça koordinatlarındaki başlangıcı: parça = ızgara + offset. */
  offset: { x: number; y: number; z: number };
  bricks: Brick[];
  bom: BomLine[];
  stats: ModelStats;
}

export const ENGINE_VERSION = 2;

/**
 * Figürün sabit renkleri (göz, diş, ağız, ten gölgesi, gözlük) tasarım temizliğinden geçmez.
 * Katalogda 1x1 plakası kapalı her rengi en yakın açık renge çevirir; döşeyici her renk için p1x1 ister.
 */
function remapToCatalog(grid: VoxelGrid, catalog: Catalog): void {
  const open = new Set(enabledColors(catalog));
  if (open.size === 0) return;
  const map = new Map<number, number>();
  const cells = grid.cells;
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (c === EMPTY || c === WILDCARD) continue;
    let to = map.get(c);
    if (to === undefined) {
      const id = colorIdFromCode(c);
      to = open.has(id) ? c : colorCode(nearestEnabledColor(catalog, id));
      map.set(c, to);
    }
    cells[i] = to;
  }
}

/** Kaide plakası: uzun kenarı x ekseninde, gövdenin taban izine ortalı (ızgara koordinatları). */
function basePlate(design: FigureDesign): Brick {
  const part = getPart(BASEPLATE_FOR_SIZE[design.size]);
  const { W, D } = headDims(design.size);
  const { TW, TD } = bodyDims(design.size);
  const cx = 1 + (W - TW) / 2 + TW / 2;
  const cz = 1 + (D - TD) / 2 + TD / 2;
  return {
    id: 0,
    part: part.id,
    color: design.baseColor,
    x: Math.floor(cx - part.l / 2),
    y: 0,
    z: Math.floor(cz - part.w / 2),
    sx: part.l,
    sz: part.w,
    h: 1,
    step: 0,
    hanging: false,
    plate: true,
  };
}

export function generateModel(input: unknown, catalog: Catalog): FigureModel {
  const design = sanitizeDesign(input, catalog);
  const figure = buildFigureVoxels(design);
  remapToCatalog(figure, catalog);
  const pack = packBricks(figure.markHiddenAsWildcard(), catalog);

  let bricks = pack.bricks;
  const dy = design.base ? 1 : 0;
  if (design.base) {
    bricks = [basePlate(design), ...bricks.map((b) => ({ ...b, id: b.id + 1, y: b.y + 1, step: b.step + 1 }))];
  }

  let minX = Infinity;
  let minZ = Infinity;
  for (const b of bricks) {
    minX = Math.min(minX, b.x);
    minZ = Math.min(minZ, b.z);
  }
  let maxX = 0;
  let maxZ = 0;
  let maxTop = 0;
  for (const b of bricks) {
    b.x -= minX;
    b.z -= minZ;
    maxX = Math.max(maxX, b.x + b.sx);
    maxZ = Math.max(maxZ, b.z + b.sz);
    maxTop = Math.max(maxTop, b.y + (b.h ?? getPart(b.part).h));
  }

  const bom = buildBom(bricks);
  return {
    design,
    dims: { w: maxX, h: maxTop, d: maxZ },
    offset: { x: -minX, y: dy, z: -minZ },
    bricks,
    bom,
    stats: {
      brickCount: bricks.length,
      lineCount: bom.length,
      colorCount: new Set(bom.map((l) => l.color)).size,
      steps: new Set(bricks.map((b) => b.step)).size,
      widthMm: Math.round(maxX * STUD_MM),
      depthMm: Math.round(maxZ * STUD_MM),
      heightMm: Math.round(maxTop * PLATE_H_MM + 1.7),
      components: pack.components,
      looseBricks: pack.looseBricks,
    },
  };
}
