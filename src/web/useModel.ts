import { useEffect, useRef, useState } from 'react';
import { createCatalog, generateModel, type Catalog, type FigureDesign, type FigureModel } from '../engine/index';
import { createLatest } from './latest';

type Reply = { id: number; model?: FigureModel; error?: string };

/**
 * Modeli Web Worker'da üretir; arayüz donmaz. Worker yoksa ya da kurulamazsa
 * aynı işi setTimeout içinde eşzamanlı yapar.
 */
export function useModel(design: FigureDesign, catalog: Catalog | null): { model: FigureModel | null; busy: boolean } {
  const [model, setModel] = useState<FigureModel | null>(null);
  const [busy, setBusy] = useState(false);
  const latest = useRef(createLatest());
  const worker = useRef<Worker | null>(null);
  const failed = useRef(false);

  useEffect(() => {
    try {
      const w = new Worker(new URL('./engineWorker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (e: MessageEvent<Reply>) => {
        if (!latest.current.isCurrent(e.data.id)) return;
        setBusy(false);
        if (e.data.model) setModel(e.data.model);
        else console.error('Model üretilemedi:', e.data.error);
      };
      w.onerror = (e) => {
        console.error('Motor worker hatası', e.message);
        failed.current = true;
        setBusy(false);
      };
      worker.current = w;
    } catch (err) {
      console.error('Worker kurulamadı, doğrudan üretilecek', err);
      failed.current = true;
    }
    return () => {
      worker.current?.terminate();
      worker.current = null;
    };
  }, []);

  useEffect(() => {
    if (!catalog) return;
    const id = latest.current.next();
    setBusy(true);
    const enabled = [...catalog.enabled];
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fallback = () => {
      timer = setTimeout(() => {
        if (!latest.current.isCurrent(id)) return;
        try {
          setModel(generateModel(design, createCatalog(enabled)));
        } catch (err) {
          console.error('Model üretilemedi:', err);
        }
        setBusy(false);
      }, 0);
    };
    if (worker.current && !failed.current) {
      try {
        worker.current.postMessage({ id, design, enabled });
      } catch {
        fallback();
      }
    } else {
      fallback();
    }
    return () => clearTimeout(timer);
  }, [design, catalog]);

  return catalog ? { model, busy } : { model: null, busy: false };
}
