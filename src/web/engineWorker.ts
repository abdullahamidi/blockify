/// <reference lib="webworker" />
import { createCatalog, generateModel, type Catalog } from '../engine/index';

let cachedKey = '';
let cached: Catalog | null = null;

self.onmessage = (e: MessageEvent<{ id: number; design: unknown; enabled: string[] }>) => {
  const { id, design, enabled } = e.data;
  try {
    const key = enabled.join(',');
    if (!cached || key !== cachedKey) {
      cached = createCatalog(enabled);
      cachedKey = key;
    }
    self.postMessage({ id, model: generateModel(design, cached) });
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
