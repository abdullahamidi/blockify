// Etkin parça kataloğu: hangi parça hangi renkte kullanılabilir (parça x renk).
// Döşeyici yalnızca burada açık olan parçaları kullanır.

import { BASEPLATES, PARTS, type PartType } from './parts';
import {
  colorsInGroup,
  FILLER_ID,
  getColor,
  hexToRgb,
  labDistance,
  PALETTE,
  rgbToLab,
  type ColorGroup,
} from './palette';

export interface Catalog {
  readonly enabled: ReadonlySet<string>;
}

export function catalogKey(partId: string, colorId: string): string {
  return `${partId}|${colorId}`;
}

const validPartIds = new Set([...PARTS, ...BASEPLATES].map((p) => p.id));
const validColorIds = new Set(PALETTE.map((c) => c.id));

/** Bilinmeyen parça ya da renk içeren anahtarları atar. */
export function createCatalog(keys: Iterable<string>): Catalog {
  const enabled = new Set<string>();
  for (const key of keys) {
    const [partId, colorId, ...rest] = key.split('|');
    if (rest.length === 0 && validPartIds.has(partId) && validColorIds.has(colorId)) {
      enabled.add(catalogKey(partId, colorId));
    }
  }
  return { enabled };
}

export function defaultCatalog(): Catalog {
  const keys: string[] = [];
  const baseColors = new Set(colorsInGroup('base').map((c) => c.id));
  for (const color of PALETTE) {
    if (color.transparent) {
      // Şeffaf renk yalnızca 1x1 plaka ve 1x1 tuğla olarak bulunur.
      keys.push(catalogKey('p1x1', color.id), catalogKey('1x1', color.id));
      continue;
    }
    for (const part of PARTS) keys.push(catalogKey(part.id, color.id));
    if (baseColors.has(color.id)) {
      for (const part of BASEPLATES) keys.push(catalogKey(part.id, color.id));
    }
  }
  return createCatalog(keys);
}

export function isEnabled(c: Catalog, partId: string, colorId: string): boolean {
  return c.enabled.has(catalogKey(partId, colorId));
}

/** Palet sırasıyla, 1x1 plakası açık olan renkler. */
export function enabledColors(c: Catalog): string[] {
  return PALETTE.filter((col) => isEnabled(c, 'p1x1', col.id)).map((col) => col.id);
}

/**
 * Verilen renk için açık parçalar, alana göre büyükten küçüğe.
 * `FILLER_ID` için herhangi bir renkte açık olan parçalar döner.
 */
export function footprints(c: Catalog, colorId: string, kind: 'brick' | 'plate'): PartType[] {
  return PARTS.filter(
    (p) =>
      p.kind === kind &&
      (colorId === FILLER_ID ? PALETTE.some((col) => isEnabled(c, p.id, col.id)) : isEnabled(c, p.id, colorId)),
  ).sort((a, b) => b.w * b.l - a.w * a.l || b.l - a.l);
}

/** Bir rengin herhangi bir parçası açıkken 1x1 plakası kapalıysa sorun bildirilir. */
export function catalogProblems(c: Catalog): string[] {
  const problems: string[] = [];
  for (const color of PALETTE) {
    const anyOpen = [...PARTS, ...BASEPLATES].some((p) => isEnabled(c, p.id, color.id));
    if (anyOpen && !isEnabled(c, 'p1x1', color.id)) {
      problems.push(`"${getColor(color.id).name}" için 1x1 plaka açık değil`);
    }
  }
  return problems;
}

/**
 * Renk açıksa kendisi, değilse Lab uzaklığı en yakın açık renk.
 * Opak renk için şeffaf aday seçilmez; hiç opak açık renk yoksa renk aynen döner.
 */
export function nearestEnabledColor(c: Catalog, colorId: string, group?: ColorGroup): string {
  const open = enabledColors(c);
  if (open.includes(colorId)) return colorId;
  const opaqueSource = !getColor(colorId).transparent;
  const allowed = opaqueSource ? open.filter((id) => !getColor(id).transparent) : open;
  if (allowed.length === 0) return colorId;
  let candidates = allowed;
  if (group) {
    const inGroup = allowed.filter((id) => getColor(id).groups.includes(group));
    if (inGroup.length > 0) candidates = inGroup;
  }
  const target = rgbToLab(hexToRgb(getColor(colorId).hex));
  let best = candidates[0];
  let bestDist = Infinity;
  for (const id of candidates) {
    const d = labDistance(target, rgbToLab(hexToRgb(getColor(id).hex)));
    if (d < bestDist) {
      bestDist = d;
      best = id;
    }
  }
  return best;
}
