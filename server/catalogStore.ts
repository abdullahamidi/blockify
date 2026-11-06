import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { catalogKey, createCatalog, defaultCatalog, type Catalog } from '../src/engine/index';

/**
 * Parça kataloğu deposu. Bu planda salt okunurdur: `data/inventory.json` açılışta bir kez okunur.
 * Biçim: { "items": [{ "part": string, "color": string, "enabled": boolean }] }
 * Dosya yoksa ya da bozuksa varsayılan katalog kullanılır.
 */
export class CatalogStore {
  private readonly file: string;
  private catalog: Catalog = defaultCatalog();

  constructor(dataDir: string) {
    this.file = resolve(dataDir, 'inventory.json');
  }

  async init(): Promise<void> {
    if (!existsSync(this.file)) return;
    try {
      const raw = JSON.parse(await readFile(this.file, 'utf8'));
      if (!raw || !Array.isArray(raw.items)) throw new Error('"items" dizisi yok');
      const keys: string[] = [];
      for (const it of raw.items) {
        if (it && it.enabled === true && typeof it.part === 'string' && typeof it.color === 'string') {
          keys.push(catalogKey(it.part, it.color));
        }
      }
      this.catalog = createCatalog(keys);
    } catch (err) {
      console.error('Envanter dosyası okunamadı, varsayılan katalog kullanılıyor:', err);
      this.catalog = defaultCatalog();
    }
  }

  get(): Catalog {
    return this.catalog;
  }

  version(): string {
    const keys = [...this.catalog.enabled].sort();
    return createHash('sha1').update(keys.join('\n')).digest('hex').slice(0, 12);
  }
}
