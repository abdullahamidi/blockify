import { describe, expect, it } from 'vitest';
import { createLatest } from './latest';

describe('createLatest', () => {
  it('yalnızca son istek güncel sayılır', () => {
    const l = createLatest();
    const a = l.next();
    const b = l.next();
    expect(l.isCurrent(a)).toBe(false);
    expect(l.isCurrent(b)).toBe(true);
  });
});
