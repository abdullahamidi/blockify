import { describe, expect, it } from 'vitest';
import { facialHairLabel, sizeLabel } from './designLabels';

describe('tasarım etiketleri (yönetim)', () => {
  it('yüz kılı: v2 değerleri ve v1 "beard"', () => {
    expect(facialHairLabel('mustache')).toBe('Bıyık');
    expect(facialHairLabel('fullBeard')).toBe('Dolgun sakal');
    expect(facialHairLabel('beard')).toBe('Dolgun sakal');
    expect(facialHairLabel('none')).toBe('Yok');
  });
  it('boy: v2 etiketi, boyu olmayan v1 siparişte açıklama', () => {
    expect(sizeLabel('S')).toBe('Küçük');
    expect(sizeLabel('L')).toBe('Büyük');
    expect(sizeLabel(undefined)).toBe('belirtilmemiş (eski sipariş)');
  });
});
