import { VoxelGrid } from '../voxels';
import { FigureDesign } from './design';
import { buildBody, bodyDims } from './body';
import { buildHead } from './head';
import { applyGlasses, applyHair } from './hair';

export * from './design';
export * from './head';
export * from './body';

/** Kaide hariç tüm figür: bacaklar, gövde, boyun ve kafa (saç ve gözlükle), alttan yukarı. */
export function buildFigureVoxels(design: FigureDesign): VoxelGrid {
  const body = buildBody(design);
  const head = buildHead(design);
  applyHair(head, design);
  applyGlasses(head, design);
  const { LH, TH, NH } = bodyDims(design.size);
  const base = LH + TH + NH;
  const g = new VoxelGrid(body.w, base + head.h, body.d);
  g.paste(body, 0, 0, 0);
  g.paste(head, 0, base, 0);
  return g;
}
