import type { Brick } from '../../engine/packer';

export interface StepInfo {
  step: number;
  main: Brick[];
  hanging: Brick[];
  /** Ana parçaların sıralı, tekil `y` değerleri (alttan üste) */
  mainLayers: number[];
}

export function groupSteps(bricks: Brick[]): StepInfo[] {
  const map = new Map<number, StepInfo>();
  for (const b of bricks) {
    let s = map.get(b.step);
    if (!s) map.set(b.step, (s = { step: b.step, main: [], hanging: [], mainLayers: [] }));
    (b.hanging ? s.hanging : s.main).push(b);
  }
  const out = [...map.values()].sort((a, b) => a.step - b.step);
  for (const s of out) s.mainLayers = [...new Set(s.main.map((b) => b.y))].sort((a, b) => a - b);
  return out;
}

/** Asılı parçaların alt yazısı. `y`: açıklanan asılı katman. */
export function hangingCaption(s: StepInfo, y: number): string {
  const isV2 = [...s.main, ...s.hanging].some((b) => b.h !== undefined);
  if (!isV2) return `Bunları ${(s.mainLayers[0] ?? s.step) - y} sıra alttan tak`;
  if (!s.mainLayers.length) return 'Bunları üstteki parçaların altına tak';
  return `Bunları 1. katın ${Math.max(1, s.mainLayers[0] - y)} plaka altına tak`;
}
