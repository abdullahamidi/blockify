import { describe, expect, it, beforeAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { createApp } from './app';
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

let base = '';
beforeAll(async () => {
  const store = new OrderStore(mkdtempSync(join(tmpdir(), 'blockify-')));
  await store.init();
  const app = createApp(store, { ...config, adminToken: 'test-token' });
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  return () => server.close();
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;
const json = async (r: Response): Promise<Json> => r.json();

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

describe('API', () => {
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
