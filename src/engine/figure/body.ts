import { VoxelGrid, colorCode } from '../voxels';
import { FigureDesign, FigureSize } from './design';
import { headDims } from './head';

export interface BodyDims {
  /** Gövde genişliği / derinliği / yüksekliği. */
  TW: number;
  TD: number;
  TH: number;
  /** Bacak ve boyun yüksekliği. */
  LH: number;
  NH: number;
  /** Kol genişliği / derinliği. */
  AW: number;
  AD: number;
}

export function bodyDims(size: FigureSize): BodyDims {
  const { W, H } = headDims(size);
  const TW = 2 * Math.round(W * 0.35);
  const TD = Math.max(4, 2 * Math.round(W * 0.25));
  const AW = Math.max(2, Math.round(W * 0.17));
  return {
    TW,
    TD,
    TH: Math.round(H * 0.6),
    LH: Math.round(H * 0.42),
    NH: Math.max(1, Math.round(H * 0.05)),
    AW,
    AD: Math.min(TD - 2, AW + 1),
  };
}

const SHOE_LAYERS = 3;

/**
 * Bacak, gövde, kol ve boyun. Izgara kafa ızgarasıyla aynı taban alanındadır (W+2, D+2);
 * kafa x ∈ [1, W], z ∈ [1, D] aralığındadır, gövde bu sütunların ortasına hizalanır.
 * Dönen ızgara yalnızca gövde yüksekliğini (LH+TH+NH) kapsar.
 */
export function buildBody(design: FigureDesign): VoxelGrid {
  const { W, D } = headDims(design.size);
  const { TW, TD, TH, LH, NH, AW, AD } = bodyDims(design.size);
  const g = new VoxelGrid(W + 2, LH + TH + NH, D + 2);
  const x0 = 1 + (W - TW) / 2;
  const z0 = 1 + (D - TD) / 2;
  const zf = z0 + TD - 1;
  const tcx = x0 + (TW - 1) / 2;

  const skin = colorCode(design.skin);
  const shirt = colorCode(design.shirtColor);
  const jacketC = colorCode(design.jacketColor);
  const bottom = colorCode(design.bottomColor);
  const shoe = colorCode(design.shoeColor);
  const hairC = colorCode(design.hairColor);

  // Bacaklar
  const gap = TW >= 8 ? 2 : 0;
  const LW = (TW - gap) / 2;
  const shinTop = SHOE_LAYERS + Math.round(LH * 0.4);
  for (const lx of [x0, x0 + LW + gap])
    for (let x = lx; x < lx + LW; x++) {
      for (let y = 0; y < LH; y++) {
        let c = bottom;
        if (y < SHOE_LAYERS) c = shoe;
        else if (design.bottomStyle === 'shorts' && y < shinTop) c = skin;
        for (let z = z0 + 1; z <= z0 + TD - 2; z++) g.set(x, y, z, c);
      }
      for (let y = 0; y < SHOE_LAYERS; y++) g.set(x, y, zf, shoe);
    }
  if (design.bottomStyle === 'skirt') {
    const y0 = LH - Math.round(LH * 0.5);
    g.fill(x0 - 1, x0 + TW, y0, LH - 1, z0, zf, bottom);
  }

  // Gövde
  const yT0 = LH;
  const yT1 = LH + TH - 1;
  const bodyC = design.jacket ? jacketC : shirt;
  const open = design.jacket && design.jacketOpen;
  for (let y = yT0; y <= yT1; y++)
    for (let x = x0; x < x0 + TW; x++)
      for (let z = z0; z < z0 + TD; z++) {
        if (TW >= 8 && (x === x0 || x === x0 + TW - 1) && (z === z0 || z === zf)) continue;
        const ut = (x - tcx) / (TW / 2);
        const vt = (y - yT0 + 0.5) / TH;
        let c = bodyC;
        if (z === zf) {
          const openW = 0.2 + 0.28 * Math.max(0, (vt - 0.5) / 0.5);
          if (open && Math.abs(ut) < openW) c = shirt;
          if (vt > 0.86 && Math.abs(ut) < 0.12 + (vt - 0.86) * 1.2) c = skin;
          if (design.collar && vt > 0.85 && Math.abs(ut) >= 0.12 && Math.abs(ut) <= 0.3) {
            c = shirt;
            if (W >= 12) g.set(x, y, z + 1, shirt);
          }
          if (open && W >= 12 && vt > 0.62 && Math.abs(ut) >= openW && Math.abs(ut) < openW + 0.22)
            g.set(x, y, z + 1, jacketC);
        }
        g.set(x, y, z, c);
      }

  // Kollar
  const sleeve = design.jacket ? jacketC : shirt;
  const az0 = z0 + Math.floor((TD - AD) / 2);
  const ay0 = yT0 + Math.round(TH * 0.05);
  const ay1 = yT1 - Math.max(1, Math.round(TH * 0.06));
  for (const [ax0, ax1] of [
    [x0 - AW, x0 - 1],
    [x0 + TW, x0 + TW + AW - 1],
  ])
    for (let x = ax0; x <= ax1; x++)
      for (let y = ay0; y <= ay1; y++)
        for (let z = az0; z < az0 + AD; z++) g.set(x, y, z, y < ay0 + 3 ? skin : sleeve);

  // Boyun
  const NW = Math.max(2, 2 * Math.round(W * 0.18));
  const ND = Math.max(2, NW - 2);
  const nx0 = 1 + (W - NW) / 2;
  const nz0 = 1 + Math.round((D - ND) / 2);
  g.fill(nx0, nx0 + NW - 1, LH + TH, LH + TH + NH - 1, nz0, nz0 + ND - 1, skin);

  // Saç paneli (sırt)
  if (design.hairStyle === 'long' || design.hairStyle === 'medium') {
    const rows = Math.round(TH * (design.hairStyle === 'long' ? 0.4 : 0.15));
    g.fill(x0 + 1, x0 + TW - 2, yT1 - rows + 1, yT1, z0 - 1, z0 - 1, hairC);
  }
  return g;
}
