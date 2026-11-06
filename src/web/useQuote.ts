import { useCallback, useEffect, useRef, useState } from 'react';
import type { FigureDesign } from '../engine/index';
import type { QuoteResponse } from '../shared/orders';
import { api } from './api';
import { createLatest } from './latest';

const DEBOUNCE_MS = 400;

/** Sunucudan fiyat teklifi alır. Fiyat tarayıcıda hesaplanmaz. */
export function useQuote(design: FigureDesign): {
  quote: QuoteResponse | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
} {
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const latest = useRef(createLatest());

  useEffect(() => {
    const id = latest.current.next();
    setLoading(true);
    setError(null);
    const timer = setTimeout(() => {
      api
        .quote(design)
        .then((q) => {
          if (!latest.current.isCurrent(id)) return;
          setQuote(q);
          setLoading(false);
        })
        .catch((err) => {
          if (!latest.current.isCurrent(id)) return;
          setError(err instanceof Error ? err.message : 'Fiyat alınamadı');
          setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      // Bekleyen yanıtı geçersiz kıl
      latest.current.next();
    };
  }, [design, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { quote, loading, error, retry };
}
