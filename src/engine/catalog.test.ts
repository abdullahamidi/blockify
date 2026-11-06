import { describe, expect, it } from 'vitest';
import { FILLER_ID } from './palette';
import {
  catalogProblems,
  createCatalog,
  defaultCatalog,
  enabledColors,
  footprints,
  isEnabled,
  nearestEnabledColor,
} from './catalog';

describe('parça kataloğu', () => {
  it('varsayılan katalog sorunsuzdur ve temel renkleri içerir', () => {
    const c = defaultCatalog();
    expect(catalogProblems(c)).toEqual([]);
    expect(enabledColors(c)).toEqual(expect.arrayContaining(['lightNougat', 'darkBrown', 'darkBlue']));
    expect(isEnabled(c, 'plate16x16', 'darkGray')).toBe(true);
  });
  it('bilinmeyen anahtarlar atılır', () => {
    expect(createCatalog(['p1x1|red', 'zz|red', 'p1x1|neon']).enabled.size).toBe(1);
  });
  it('footprints yalnızca açık parçaları büyükten küçüğe döner', () => {
    const c = createCatalog(['p1x1|red', 'p2x4|red', 'p1x2|blue']);
    expect(footprints(c, 'red', 'plate').map((p) => p.id)).toEqual(['p2x4', 'p1x1']);
    expect(footprints(c, FILLER_ID, 'plate').map((p) => p.id)).toEqual(['p2x4', 'p1x2', 'p1x1']);
    expect(footprints(c, 'red', 'brick')).toEqual([]);
  });
  it('1x1 plakası olmayan renk sorun olarak bildirilir', () => {
    const p = catalogProblems(createCatalog(['p2x4|red']));
    expect(p).toHaveLength(1);
    expect(p[0]).toContain('Kırmızı');
  });
  it('kapalı renk en yakın açık renge düşer', () => {
    const c = createCatalog(['p1x1|black', 'p1x1|white']);
    expect(nearestEnabledColor(c, 'darkGray')).toBe('black');
    expect(nearestEnabledColor(c, 'white')).toBe('white');
  });
});
