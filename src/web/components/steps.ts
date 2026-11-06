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

export interface HangingGroup {
  y: number;
  /** Gruptaki parçaların yüksekliği (plaka); v1 parçalarında `h` yoktur, 1 sayılır. */
  h: number;
  items: Brick[];
}

/**
 * Asılı parçaları kat ve yüksekliğe göre gruplar. Aynı kattaki plaka `y + 1`, tuğla `y + 3` katının
 * altına takıldığı için ayrı gösterilir. Üstten alta, aynı katta önce yüksek parçalar.
 */
export function hangingGroups(s: StepInfo): HangingGroup[] {
  const map = new Map<string, HangingGroup>();
  for (const b of s.hanging) {
    const h = b.h ?? 1;
    const key = `${b.y}:${h}`;
    let g = map.get(key);
    if (!g) map.set(key, (g = { y: b.y, h, items: [] }));
    g.items.push(b);
  }
  return [...map.values()].sort((a, b) => b.y - a.y || b.h - a.h);
}

/**
 * Asılı parçaların alt yazısı. `y`: açıklanan asılı katman, `h`: o katmandaki parçaların yüksekliği.
 * Asılı parça y..y+h-1 aralığını kaplar ve `y + h` katındaki parçanın altına takılır.
 */
export function hangingCaption(s: StepInfo, y: number, h: number): string {
  const isV2 = [...s.main, ...s.hanging].some((b) => b.h !== undefined);
  if (!isV2) return `Bunları ${(s.mainLayers[0] ?? s.step) - y} sıra alttan tak`;
  if (!s.mainLayers.length) return 'Bunları üstteki parçaların altına tak';
  const k = s.mainLayers.indexOf(y + h);
  if (k >= 0) return `Bunları ${k + 1}. kattaki parçaların altına tak`;
  return `Bunları 1. katın ${s.mainLayers[0] - y} plaka altına tak`;
}
