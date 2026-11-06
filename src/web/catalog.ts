import { useEffect, useState } from 'react';
import { createCatalog, defaultCatalog, type Catalog } from '../engine/index';
import { api } from './api';

let promise: Promise<Catalog> | null = null;

function loadCatalog(): Promise<Catalog> {
  promise ??= api
    .catalog()
    .then((c) => createCatalog(c.enabled))
    .catch((err) => {
      console.error('Katalog alınamadı, varsayılan katalog kullanılıyor', err);
      return defaultCatalog();
    });
  return promise;
}

/** Sunucudaki açık parça/renk kataloğu. Yüklenene kadar null. */
export function useCatalog(): Catalog | null {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  useEffect(() => {
    let alive = true;
    void loadCatalog().then((c) => alive && setCatalog(c));
    return () => {
      alive = false;
    };
  }, []);
  return catalog;
}
