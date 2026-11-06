import { describe, expect, it } from 'vitest';
import type { Brick } from '../../engine/packer';
import { brickBox, occupies } from './geometry';

describe('geometry', () => {
  it('v2 parçası plaka biriminde', () => {
    expect(brickBox({ y: 4, h: 3 } as Brick, true)).toEqual({ bottomMm: 12.8, heightMm: 9.6 });
    expect(brickBox({ y: 0, h: 1, plate: true } as Brick, true)).toEqual({ bottomMm: 0, heightMm: 3.2 });
  });
  it('v1 parçası eski formülle', () => {
    expect(brickBox({ y: 0, plate: true } as Brick, true)).toEqual({ bottomMm: 0, heightMm: 3.2 });
    expect(brickBox({ y: 2 } as Brick, true)).toEqual({ bottomMm: 12.8, heightMm: 9.6 });
    expect(brickBox({ y: 2 } as Brick, false)).toEqual({ bottomMm: 19.2, heightMm: 9.6 });
  });
  it('occupies tuğlanın 3 katını da kapsar', () => {
    expect([3, 4, 5, 6].map((l) => occupies({ y: 3, h: 3 } as Brick, l))).toEqual([true, true, true, false]);
  });
  it('v1 parçası yalnızca kendi katmanını kaplar', () => {
    expect([1, 2, 3].map((l) => occupies({ y: 2 } as Brick, l))).toEqual([false, true, false]);
  });
});
