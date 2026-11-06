import { describe, expect, it } from 'vitest';
import type { Brick } from '../../engine/packer';
import { groupSteps, hangingCaption, hangingGroups } from './steps';

const mk = (id: number, y: number, step: number, hanging = false, h = 1): Brick =>
  ({ id, part: '2x2', color: 'red', x: 0, y, z: 0, sx: 2, sz: 2, h, step, hanging }) as Brick;

function fixtureStep(): Brick[] {
  return [mk(0, 0, 0), mk(1, 5, 1), mk(2, 3, 1), mk(3, 4, 1), mk(4, 4, 1), mk(5, 2, 1, true), mk(6, 6, 2)];
}

describe('groupSteps', () => {
  it('v2 adımı katlarını sıralı döner, asılı parçaları ayırır', () => {
    const s = groupSteps(fixtureStep())[1];
    expect(s.mainLayers).toEqual([3, 4, 5]);
    expect(s.main).toHaveLength(4);
    expect(s.hanging.every((b) => b.hanging)).toBe(true);
    expect(s.hanging).toHaveLength(1);
  });
  it('adımları sıralar', () => {
    expect(groupSteps(fixtureStep()).map((s) => s.step)).toEqual([0, 1, 2]);
  });
  it('v1 adımı tek ana kat verir', () => {
    const v1 = [{ id: 0, y: 2, step: 2, hanging: false }, { id: 1, y: 2, step: 2, hanging: false }] as Brick[];
    expect(groupSteps(v1)[0].mainLayers).toEqual([2]);
  });
});

describe('hangingCaption', () => {
  it('v2: ilk katın altında; doğrudan 1. kata takılan ve plaka cinsinden uzakta olan', () => {
    const s = groupSteps([mk(1, 3, 1), mk(2, 4, 1), mk(3, 5, 1), mk(4, 2, 1, true), mk(5, 1, 1, true)])[0];
    expect(hangingCaption(s, 2, 1)).toBe('Bunları 1. kattaki parçaların altına tak');
    expect(hangingCaption(s, 1, 1)).toBe('Bunları 1. katın 2 plaka altına tak');
  });
  it('v2: adımın kendi katları arasında asılı parça, üstündeki katın altına takılır', () => {
    // S, omuz boyu saç: ana katlar [25, 26, 27], 25. katta asılı 1x1 plaka 26. katın (2. kat) altına takılır
    const s = groupSteps([mk(1, 25, 7), mk(2, 26, 7), mk(3, 27, 7), mk(4, 25, 7, true)])[0];
    expect(s.mainLayers).toEqual([25, 26, 27]);
    expect(hangingCaption(s, 25, 1)).toBe('Bunları 2. kattaki parçaların altına tak');
  });
  it('v2: asılı parçanın yüksekliği hesaba katılır', () => {
    const s = groupSteps([mk(1, 25, 7), mk(2, 26, 7), mk(3, 22, 7, true, 3), mk(4, 21, 7, true, 3)])[0];
    expect(hangingCaption(s, 22, 3)).toBe('Bunları 1. kattaki parçaların altına tak');
    expect(hangingCaption(s, 21, 3)).toBe('Bunları 1. katın 4 plaka altına tak');
  });
  it('v2: yalnızca asılı adım', () => {
    const s = groupSteps([mk(1, 2, 1, true)])[0];
    expect(hangingCaption(s, 2, 1)).toBe('Bunları üstteki parçaların altına tak');
  });
  it('v1: eski metin', () => {
    const s = groupSteps([
      { id: 0, y: 3, step: 3, hanging: false },
      { id: 1, y: 1, step: 3, hanging: true },
    ] as Brick[])[0];
    expect(hangingCaption(s, 1, 1)).toBe('Bunları 2 sıra alttan tak');
  });
});

describe('hangingGroups', () => {
  it('v2: aynı katta asılı plaka ve tuğla ayrı gruplanır, her biri kendi yüksekliğiyle açıklanır', () => {
    // ana katlar [27, 28, 29]; 24. katta asılı tuğla (h=3) 27. kata, aynı kattaki plaka (h=1) 25. kata takılır
    const s = groupSteps([mk(1, 27, 9), mk(2, 28, 9), mk(3, 24, 9, true, 3), mk(4, 24, 9, true, 1), mk(5, 26, 9, true, 1)])[0];
    const g = hangingGroups(s);
    expect(g.map((x) => [x.y, x.h, x.items.map((b) => b.id)])).toEqual([
      [26, 1, [5]],
      [24, 3, [3]],
      [24, 1, [4]],
    ]);
    expect(g.map((x) => hangingCaption(s, x.y, x.h))).toEqual([
      'Bunları 1. kattaki parçaların altına tak',
      'Bunları 1. kattaki parçaların altına tak',
      'Bunları 1. katın 3 plaka altına tak',
    ]);
  });
  it('v1 parçalarında yükseklik 1 sayılır, aynı kattakiler tek grupta kalır', () => {
    const s = groupSteps([
      { id: 0, y: 3, step: 3, hanging: false },
      { id: 1, y: 1, step: 3, hanging: true },
      { id: 2, y: 1, step: 3, hanging: true },
    ] as Brick[])[0];
    expect(hangingGroups(s).map((g) => [g.y, g.h, g.items.length])).toEqual([[1, 1, 2]]);
  });
});
