import { FACIAL_HAIR_LABELS, SIZE_LABELS, type FacialHair, type FigureSize } from '../engine/index';

/** Kayıtlı tasarımın yüz kılı etiketi; v1 siparişlerdeki 'beard' bugünkü 'fullBeard' karşılığıdır. */
export function facialHairLabel(value: string): string {
  const v = (value === 'beard' ? 'fullBeard' : value) as FacialHair;
  return FACIAL_HAIR_LABELS[v] ?? value;
}

/** Kayıtlı tasarımın boy etiketi; v1 siparişlerde boy alanı yoktur. */
export function sizeLabel(size: unknown): string {
  return SIZE_LABELS[size as FigureSize] ?? 'belirtilmemiş (eski sipariş)';
}
