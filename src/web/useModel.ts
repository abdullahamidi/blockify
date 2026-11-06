import { useEffect, useRef, useState } from 'react';
import { createCatalog, generateModel, type Catalog, type FigureDesign, type FigureModel } from '../engine/index';
import { createLatest } from './latest';
import { createPending } from './pendingRequest';

type Reply = { id: number; model?: FigureModel; error?: string };
type ModelRequest = { id: number; design: FigureDesign; enabled: string[] };

/**
 * Modeli Web Worker'da üretir; arayüz donmaz. Worker yoksa, kurulamazsa ya da sonradan çökerse
 * aynı işi setTimeout içinde eşzamanlı yapar (çökme anında bekleyen istek de burada üretilir).
 */
export function useModel(design: FigureDesign, catalog: Catalog | null): { model: FigureModel | null; busy: boolean } {
  const [model, setModel] = useState<FigureModel | null>(null);
  const [busy, setBusy] = useState(false);
  const latest = useRef(createLatest());
  const worker = useRef<Worker | null>(null);
  const failed = useRef(false);
  const pending = useRef(createPending<ModelRequest>());

  // Yalnızca ref'lere ve setState'e dokunur; her çizimde aynı işi yapar.
  const generateHere = (req: ModelRequest) =>
    setTimeout(() => {
      if (!latest.current.isCurrent(req.id)) return;
      try {
        setModel(generateModel(req.design, createCatalog(req.enabled)));
      } catch (err) {
        console.error('Model üretilemedi:', err);
      }
      setBusy(false);
    }, 0);

  useEffect(() => {
    try {
      const w = new Worker(new URL('./engineWorker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (e: MessageEvent<Reply>) => {
        pending.current.answered(e.data.id);
        if (!latest.current.isCurrent(e.data.id)) return;
        setBusy(false);
        if (e.data.model) setModel(e.data.model);
        else console.error('Model üretilemedi:', e.data.error);
      };
      w.onerror = (e) => {
        console.error('Motor worker hatası, doğrudan üretilecek', e.message);
        failed.current = true;
        const req = pending.current.takeOnFailure(latest.current.isCurrent);
        if (req) generateHere(req);
        else setBusy(false);
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
    // generateHere yalnızca kararlı ref'leri ve setState'i kullanır
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!catalog) return;
    const req: ModelRequest = { id: latest.current.next(), design, enabled: [...catalog.enabled] };
    setBusy(true);
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (worker.current && !failed.current) {
      try {
        worker.current.postMessage(req);
        pending.current.sent(req);
      } catch {
        timer = generateHere(req);
      }
    } else {
      timer = generateHere(req);
    }
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design, catalog]);

  return catalog ? { model, busy } : { model: null, busy: false };
}
