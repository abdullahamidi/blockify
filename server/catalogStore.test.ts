import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CatalogStore } from './catalogStore';
import { defaultCatalog, enabledColors } from '../src/engine/index';

async function storeWith(content?: string): Promise<CatalogStore> {
  const dir = mkdtempSync(join(tmpdir(), 'blockify-cat-'));
  if (content !== undefined) writeFileSync(join(dir, 'inventory.json'), content);
  const s = new CatalogStore(dir);
  await s.init();
  return s;
}

const items = (list: { part: string; color: string; enabled: boolean }[]) => JSON.stringify({ items: list });

describe('CatalogStore', () => {
  afterEach(() => vi.restoreAllMocks());

  it('dosya yoksa varsayılan katalog', async () => {
    const s = await storeWith();
    expect([...s.get().enabled].sort()).toEqual([...defaultCatalog().enabled].sort());
  });

  it('bozuk JSON varsayılana düşer', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const def = await storeWith();
    const s = await storeWith('{ "items": [ bozuk');
    expect(enabledColors(s.get())).toEqual(enabledColors(defaultCatalog()));
    expect(s.version()).toBe(def.version());
  });

  it('bütün parçaları kapalı dosya varsayılana düşer ve yüksek sesle loglanır', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const def = await storeWith();
    const s = await storeWith(
      items([
        { part: 'p1x1', color: 'black', enabled: false },
        { part: '1x2', color: 'red', enabled: false },
      ]),
    );
    expect(enabledColors(s.get()).length).toBeGreaterThan(0);
    expect(s.version()).toBe(def.version());
    expect(error).toHaveBeenCalled();
  });

  it('hiç 1x1 plakası açık olmayan dosya varsayılana düşer', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const def = await storeWith();
    const s = await storeWith(items([{ part: '1x2', color: 'red', enabled: true }]));
    expect(s.version()).toBe(def.version());
  });

  it('kullanılabilir dosya korunur, katalog sorunları loglanır', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = await storeWith(
      items([
        { part: 'p1x1', color: 'black', enabled: true },
        { part: '1x2', color: 'red', enabled: true }, // kırmızının 1x1 plakası yok
      ]),
    );
    expect(enabledColors(s.get())).toEqual(['black']);
    expect(warn).toHaveBeenCalled();
    expect(String(warn.mock.calls.flat().join(' '))).toContain('1x1 plaka');
  });
});
