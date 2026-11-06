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
