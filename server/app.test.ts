import { describe, expect, it, beforeAll } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { createApp } from './app';
import { CatalogStore } from './catalogStore';
import type { Order } from '../src/shared/orders';
import { OrderStore } from './store';
import { config } from './config';

const customer = {
  name: 'Ayşe Yılmaz',
  email: 'ayse@example.com',
  phone: '0532 123 45 67',
  address: 'Örnek Mah. Deneme Sok. No:5 D:3',
  district: 'Kadıköy',
  city: 'İstanbul',
  postalCode: '34710',
};

const V1_ORDER = {
  number: 'BLK-OLD001',
  accessKey: 'oldkey',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  status: 'paid',
  engineVersion: 1,
  design: {
    skin: 'lightNougat',
    hairColor: 'darkBrown',
    hairStyle: 'short',
    facialHair: 'beard',
    glasses: false,
    shirtColor: 'blue',
    pantsColor: 'darkBlue',
    shoeColor: 'black',
  },
  price: { currency: 'TRY', partsCost: 10, total: 100 },
  stats: { brickCount: 2, lineCount: 2, colorCount: 2, steps: 1, widthMm: 32, depthMm: 16, heightMm: 20, components: 1, looseBricks: 0 },
  bom: [],
  bricks: [
    { id: 0, part: 'plate8x8', color: 'darkGray', x: 0, y: 0, z: 0, sx: 8, sz: 8, step: 0, hanging: false, plate: true },
    { id: 1, part: '2x4', color: 'blue', x: 0, y: 0, z: 0, sx: 4, sz: 2, step: 1, hanging: false },
  ],
  customer: { name: 'Eski Müşteri', email: 'eski@example.com', phone: '0', address: 'x', district: 'x', city: 'Ankara', postalCode: '06000', note: '' },
  consent: { kvkk: true, photo: false, at: '2025-01-01T00:00:00.000Z' },
  hasPhoto: false,
  history: [{ at: '2025-01-01T00:00:00.000Z', status: 'paid' }],
} as unknown as Order;

const INVENTORY = {
  items: [
    ...['black', 'white', 'lightNougat', 'darkBrown', 'darkBlue', 'darkGray'].flatMap((color) =>
      ['p1x1', 'p1x2', 'p2x2', '1x2', '2x2'].map((part) => ({ part, color, enabled: true })),
    ),
    ...['plate8x8', 'plate8x16', 'plate16x16'].map((part) => ({ part, color: 'darkGray', enabled: true })),
    { part: 'p1x1', color: 'red', enabled: false },
  ],
};

let base = '';
let base2 = '';
let base3 = '';
async function start(dir: string): Promise<{ url: string; close: () => void }> {
  const store = new OrderStore(dir);
  await store.init();
  const catalogs = new CatalogStore(dir);
  await catalogs.init();
  const app = createApp(store, catalogs, { ...config, adminToken: 'test-token' });
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`, close: () => server.close() };
}
beforeAll(async () => {
  const tmp = () => mkdtempSync(join(tmpdir(), 'blockify-'));
  const d2 = tmp();
  writeFileSync(join(d2, 'inventory.json'), JSON.stringify(INVENTORY));
  const d3 = tmp();
  writeFileSync(join(d3, 'orders.json'), JSON.stringify([V1_ORDER]));
  const [a, b, c] = await Promise.all([start(tmp()), start(d2), start(d3)]);
  base = a.url;
  base2 = b.url;
  base3 = c.url;
  return () => {
    a.close();
    b.close();
    c.close();
  };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;
const json = async (r: Response): Promise<Json> => r.json();

const post = (path: string, body: unknown, headers: Record<string, string> = {}, url = base) =>
  fetch(url + path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

describe('API', () => {
  it('kataloğu döner', async () => {
    const j = await json(await fetch(base + '/catalog'));
    expect(j.enabled).toContain('p1x1|red');
    expect(j.version).toMatch(/^[0-9a-f]{12}$/);
  });

  it('teklif üç boyutun fiyatını döner ve iç maliyeti gizler', async () => {
    const j = await json(await post('/quote', { design: { size: 'S' } }));
    expect(j.sizes.L.total).toBeGreaterThan(j.sizes.M.total);
    expect(j.sizes.M.total).toBeGreaterThan(j.sizes.S.total);
    expect(j.price.total).toBe(j.sizes.S.total);
    expect(j.price.partsCost).toBe(0);
  });

  it('herkese açık siparişte ve kılavuzda yüz ölçüleri yok, yöneticide var', async () => {
    const r = await post('/orders', { design: { face: { browTilt: 4 } }, customer, consent: { kvkk: true } });
    const { number, accessKey } = await json(r);
    const pub = await json(await fetch(`${base}/orders/${number}?k=${accessKey}`));
    const build = await json(await fetch(`${base}/orders/${number}/build?k=${accessKey}`));
    expect(pub.design.face).toBeUndefined();
    expect(pub.design.expression).toBeUndefined();
    expect(build.design.face).toBeUndefined();
    const adm = await json(await fetch(`${base}/admin/orders/${number}`, { headers: { authorization: 'Bearer test-token' } }));
    expect(adm.design.face.browTilt).toBe(4);
  });

  it('inventory.json ile kapatılan renk teklifte kullanılmaz', async () => {
    const j = await json(await post('/quote', { design: { shirtColor: 'red' } }, {}, base2));
    expect(['black', 'white', 'lightNougat', 'darkBrown', 'darkBlue', 'darkGray']).toContain(j.design.shirtColor);
  });

  it('eski (v1) sipariş kılavuzu bozulmadan döner', async () => {
    const build = await json(await fetch(`${base3}/orders/BLK-OLD001/build?k=oldkey`));
    expect(build.bricks).toEqual(V1_ORDER.bricks);
    expect(build.design.facialHair).toBe('beard');
    const pub = await json(await fetch(`${base3}/orders/BLK-OLD001?k=oldkey`));
    expect(pub.design.face).toBeUndefined();
    expect(pub.price.partsCost).toBe(0);
  });

  it('fiyat teklifini sunucuda hesaplar', async () => {
    const r = await post('/quote', { design: { hairStyle: 'long', glasses: true } });
    expect(r.status).toBe(200);
    const j = await json(r);
    expect(j.price.total).toBeGreaterThan(0);
    expect(j.price.partsCost).toBe(0); // iç maliyet gizli
    expect(j.design.hairStyle).toBe('long');
  });

  it('eksik bilgiyle sipariş reddedilir', async () => {
    const r = await post('/orders', { design: {}, customer: { ...customer, email: 'x' }, consent: { kvkk: true } });
    expect(r.status).toBe(400);
    expect((await json(r)).field).toBe('email');
    const r2 = await post('/orders', { design: {}, customer, consent: { kvkk: false } });
    expect(r2.status).toBe(400);
  });

  it('sipariş oluşturur, müşteri anahtarla görür, yönetici günceller', async () => {
    const r = await post('/orders', { design: { shirtColor: 'blue', total: 1 }, customer, consent: { kvkk: true } });
    expect(r.status).toBe(201);
    const { number, accessKey, total } = await json(r);
    expect(number).toMatch(/^BLK-[A-Z0-9]{6}$/);
    expect(total).toBeGreaterThan(0);

    expect((await fetch(`${base}/orders/${number}?k=wrong`)).status).toBe(404);
    const pub = await json(await fetch(`${base}/orders/${number}?k=${accessKey}`));
    expect(pub.status).toBe('awaiting_payment');
    expect(pub.design.shirtColor).toBe('blue');
    expect(pub.customer).toBeUndefined();

    const build = await json(await fetch(`${base}/orders/${number}/build?k=${accessKey}`));
    expect(build.bricks.length).toBe(pub.stats.brickCount);

    expect((await fetch(`${base}/admin/orders`)).status).toBe(401);
    const auth = { authorization: 'Bearer test-token' };
    const list = await json(await fetch(`${base}/admin/orders`, { headers: auth }));
    expect(list[0].number).toBe(number);

    const upd = await fetch(`${base}/admin/orders/${number}`, {
      method: 'PATCH',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'shipped', trackingNo: '123', carrier: 'Yurtiçi' }),
    });
    expect(upd.status).toBe(200);
    const after = await json(await fetch(`${base}/orders/${number}?k=${accessKey}`));
    expect(after.status).toBe('shipped');
    expect(after.history).toHaveLength(2);
  });
});
