import { describe, expect, it } from 'vitest';
import { createLatest } from './latest';
import { createPending } from './pendingRequest';

type Req = { id: number; design: string };

describe('createPending', () => {
  it('worker çökünce yanıtlanmamış son istek ana iş parçacığında yeniden çalıştırılmak üzere döner', () => {
    const latest = createLatest();
    const p = createPending<Req>();
    const req = { id: latest.next(), design: 'a' };
    p.sent(req);
    expect(p.takeOnFailure(latest.isCurrent)).toBe(req);
  });

  it('yanıtı gelmiş istek yeniden çalıştırılmaz', () => {
    const latest = createLatest();
    const p = createPending<Req>();
    const id = latest.next();
    p.sent({ id, design: 'a' });
    p.answered(id);
    expect(p.takeOnFailure(latest.isCurrent)).toBeNull();
  });

  it('yalnızca en son gönderilen istek tutulur; eski yanıt onu silmez', () => {
    const latest = createLatest();
    const p = createPending<Req>();
    const a = { id: latest.next(), design: 'a' };
    const b = { id: latest.next(), design: 'b' };
    p.sent(a);
    p.sent(b);
    p.answered(a.id);
    expect(p.takeOnFailure(latest.isCurrent)).toBe(b);
  });

  it('artık en son olmayan istek yeniden çalıştırılmaz', () => {
    const latest = createLatest();
    const p = createPending<Req>();
    p.sent({ id: latest.next(), design: 'a' });
    latest.next(); // tasarım değişti, yeni istek henüz gönderilmedi
    expect(p.takeOnFailure(latest.isCurrent)).toBeNull();
  });

  it('aynı istek bir kez döner', () => {
    const latest = createLatest();
    const p = createPending<Req>();
    p.sent({ id: latest.next(), design: 'a' });
    expect(p.takeOnFailure(latest.isCurrent)).not.toBeNull();
    expect(p.takeOnFailure(latest.isCurrent)).toBeNull();
  });

  it('hiç istek yokken çökme bir şey döndürmez', () => {
    expect(createPending<Req>().takeOnFailure(() => true)).toBeNull();
  });
});
