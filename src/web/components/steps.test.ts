import { describe, expect, it } from 'vitest';
import type { Brick } from '../../engine/packer';
import { groupSteps } from './steps';

const mk = (id: number, y: number, step: number, hanging = false): Brick =>
  ({ id, part: '2x2', color: 'red', x: 0, y, z: 0, sx: 2, sz: 2, h: 1, step, hanging }) as Brick;

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
