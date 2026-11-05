import { useEffect, useState } from 'react';
import { DEFAULT_DESIGN, sanitizeDesign, type FigureDesign } from '../engine/figure';

const DESIGN_KEY = 'blockify.design.v1';
const PHOTO_KEY = 'blockify.photo.v1';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* depolama kapalı olabilir */
  }
}

export function loadDesign(): FigureDesign {
  const raw = read(DESIGN_KEY);
  if (!raw) return { ...DEFAULT_DESIGN };
  try {
    return sanitizeDesign(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_DESIGN };
  }
}

export function useStoredDesign(): [FigureDesign, (d: FigureDesign) => void] {
  const [design, setDesign] = useState<FigureDesign>(loadDesign);
  useEffect(() => {
    write(DESIGN_KEY, JSON.stringify(design));
  }, [design]);
  return [design, setDesign];
}

/** Fotoğrafın küçük kopyası yalnızca bu tarayıcıda tutulur; siparişte izin verilirse gönderilir. */
export const photoStore = {
  get: () => read(PHOTO_KEY),
  set: (dataUrl: string | null) => write(PHOTO_KEY, dataUrl),
};

export function clearDraft() {
  write(DESIGN_KEY, null);
  write(PHOTO_KEY, null);
}
