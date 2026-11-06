import { describe, expect, it } from 'vitest';
import { LruCache } from './quoteCache';

describe('LruCache', () => {
  it('sınırı aşınca en eskiyi atar', () => {
    const c = new LruCache<number>(3);
    for (let i = 0; i < 5; i++) c.set(`k${i}`, i);
    expect(c.size).toBe(3);
    expect(c.get('k0')).toBeUndefined();
    expect(c.get('k4')).toBe(4);
  });
  it('isabet kaydı tazeler', () => {
    const c = new LruCache<number>(2);
    c.set('a', 1);
    c.set('b', 2);
    c.get('a');
    c.set('c', 3);
    expect(c.get('a')).toBe(1);
    expect(c.get('b')).toBeUndefined();
  });
});
