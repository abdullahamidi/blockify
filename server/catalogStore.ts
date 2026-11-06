import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { catalogKey, catalogProblems, createCatalog, defaultCatalog, enabledColors, type Catalog } from '../src/engine/index';

/**
 * Parça kataloğu deposu. Bu planda salt okunurdur: `data/inventory.json` açılışta bir kez okunur.
 * Biçim: { "items": [{ "part": string, "color": string, "enabled": boolean }] }
 * Dosya yoksa, bozuksa ya da hiç kullanılabilir renk (1x1 plakası açık renk) vermiyorsa varsayılan katalog
 * kullanılır; yoksa her teklif ve sipariş 500 dönerdi.
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
      const c = createCatalog(keys);
      const problems = catalogProblems(c);
      if (problems.length) console.warn(`Envanter dosyasında sorunlar (${this.file}): ${problems.join('; ')}`);
      if (enabledColors(c).length === 0) {
        console.error(
          `!!! Envanter dosyası (${this.file}) hiç kullanılabilir renk vermiyor (1x1 plakası açık renk yok). ` +
            'VARSAYILAN KATALOG KULLANILIYOR, dosya düzeltilmeli.',
        );
        this.catalog = defaultCatalog();
        return;
      }
      this.catalog = c;
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
