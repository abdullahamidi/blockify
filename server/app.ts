import express, { type NextFunction, type Request, type Response } from 'express';
import { existsSync } from 'node:fs';
import { timingSafeEqual } from 'node:crypto';
import { ENGINE_VERSION, SIZES, generateModel, priceFor, sanitizeDesign, type FigureSize } from '../src/engine/index';
import {
  ORDER_STATUSES,
  type Order,
  type OrderStatus,
  type OrderSummary,
  type PublicCatalog,
  type PublicConfig,
  type PublicOrder,
  type QuoteResponse,
  publicDesign,
} from '../src/shared/orders';
import type { CatalogStore } from './catalogStore';
import type { config as appConfig } from './config';
import type { OrderStore } from './store';
import { ValidationError, parseJpegDataUrl, validateCustomer } from './validate';

type Config = typeof appConfig;

/** Basit IP başına istek sınırlayıcı */
function rateLimit(max: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (list.length >= max) {
      res.status(429).json({ error: 'Çok fazla istek. Lütfen biraz sonra tekrar deneyin.' });
      return;
    }
    list.push(now);
    hits.set(key, list);
    next();
  };
}

function toPublic(o: Order): PublicOrder {
  return {
    number: o.number,
    createdAt: o.createdAt,
    status: o.status,
    design: publicDesign(o.design),
    price: { ...o.price, partsCost: 0 },
    stats: o.stats,
    history: o.history.map(({ at, status }) => ({ at, status })),
    carrier: o.carrier,
    trackingNo: o.trackingNo,
    customerName: o.customer.name.split(' ')[0],
    city: o.customer.city,
  };
}

function toSummary(o: Order): OrderSummary {
  return {
    number: o.number,
    createdAt: o.createdAt,
    status: o.status,
    price: o.price,
    stats: o.stats,
    hasPhoto: o.hasPhoto,
    trackingNo: o.trackingNo,
    customerName: o.customer.name,
    city: o.customer.city,
  };
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function createApp(store: OrderStore, catalogs: CatalogStore, config: Config, staticDir?: string) {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));

  const api = express.Router();

  api.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  api.get('/config', (_req, res) => {
    const body: PublicConfig = {
      currency: config.pricing.currency,
      designFee: config.pricing.designFee,
      packaging: config.pricing.packaging,
      shipping: config.pricing.shipping,
      bank: config.bank,
      contactEmail: config.contactEmail,
    };
    res.json(body);
  });

  api.get('/catalog', (_req, res) => {
    const body: PublicCatalog = { version: catalogs.version(), enabled: [...catalogs.get().enabled] };
    res.json(body);
  });

  // Fiyat teklifi: tasarım sunucuda yeniden üretilir, istemcinin hesabına güvenilmez.
  // Üç boyutun da fiyatı döner; iç maliyet (partsCost) gizlenir.
  api.post('/quote', rateLimit(300, 60_000), (req, res) => {
    const catalog = catalogs.get();
    const design = sanitizeDesign(req.body?.design, catalog);
    const models = {} as Record<FigureSize, ReturnType<typeof generateModel>>;
    const prices = {} as Record<FigureSize, ReturnType<typeof priceFor>>;
    const sizes = {} as QuoteResponse['sizes'];
    for (const size of SIZES) {
      const m = generateModel({ ...design, size }, catalog);
      models[size] = m;
      prices[size] = priceFor(m.bom, config.pricing);
      sizes[size] = { total: prices[size].total, heightMm: m.stats.heightMm, brickCount: m.stats.brickCount };
    }
    const body: QuoteResponse = {
      design,
      price: { ...prices[design.size], partsCost: 0 },
      stats: models[design.size].stats,
      sizes,
    };
    res.json(body);
  });

  api.post('/orders', rateLimit(10, 10 * 60_000), async (req, res, next) => {
    try {
      const body = req.body ?? {};
      const customer = validateCustomer(body.customer);
      if (body.consent?.kvkk !== true)
        throw new ValidationError('Devam etmek için aydınlatma metnini onaylamalısınız', 'kvkk');
      const photoConsent = body.consent?.photo === true;
      const photo = photoConsent ? parseJpegDataUrl(body.photo) : null;

      const model = generateModel(body.design, catalogs.get());
      const price = priceFor(model.bom, config.pricing);
      if (model.stats.looseBricks > 0) throw new ValidationError('Bu tasarım üretilemiyor, lütfen değiştirin');

      const now = new Date().toISOString();
      const order: Order = {
        number: store.newNumber(),
        accessKey: store.newAccessKey(),
        createdAt: now,
        updatedAt: now,
        status: 'awaiting_payment',
        engineVersion: ENGINE_VERSION,
        design: model.design,
        price,
        stats: model.stats,
        bom: model.bom,
        bricks: model.bricks,
        customer,
        consent: { kvkk: true, photo: photoConsent, at: now },
        hasPhoto: !!photo,
        history: [{ at: now, status: 'awaiting_payment' }],
      };
      if (photo) await store.savePhoto(order.number, photo);
      await store.add(order);
      console.log(`Yeni sipariş ${order.number} - ${order.price.total} ${order.price.currency}`);
      res.status(201).json({ number: order.number, accessKey: order.accessKey, total: order.price.total });
    } catch (err) {
      next(err);
    }
  });

  const findWithKey = (req: Request, res: Response): Order | undefined => {
    const o = store.get(String(req.params.number));
    if (!o || typeof req.query.k !== 'string' || !safeEqual(req.query.k, o.accessKey)) {
      res.status(404).json({ error: 'Sipariş bulunamadı' });
      return undefined;
    }
    return o;
  };

  api.get('/orders/:number', (req, res) => {
    const o = findWithKey(req, res);
    if (o) res.json(toPublic(o));
  });

  // Montaj kılavuzu için parça yerleşimi
  api.get('/orders/:number/build', (req, res) => {
    const o = findWithKey(req, res);
    if (o) res.json({ number: o.number, design: publicDesign(o.design), bricks: o.bricks, bom: o.bom, stats: o.stats });
  });

  // ---- Yönetim ----
  const admin = express.Router();
  admin.use((req, res, next) => {
    const auth = req.get('authorization') ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : String(req.query.token ?? '');
    if (!config.adminToken || !token || !safeEqual(token, config.adminToken)) {
      res.status(401).json({ error: 'Yetkisiz' });
      return;
    }
    next();
  });

  admin.get('/orders', (_req, res) => {
    res.json(store.list().map(toSummary));
  });

  admin.get('/orders/:number', (req, res) => {
    const o = store.get(req.params.number);
    if (!o) {
      res.status(404).json({ error: 'Sipariş bulunamadı' });
      return;
    }
    res.json(o);
  });

  admin.get('/orders/:number/photo', (req, res) => {
    const o = store.get(req.params.number);
    const file = o?.hasPhoto ? store.photoPath(o.number) : '';
    if (!file || !existsSync(file)) {
      res.status(404).end();
      return;
    }
    res.sendFile(file);
  });

  admin.patch('/orders/:number', async (req, res, next) => {
    try {
      const b = req.body ?? {};
      if (b.status !== undefined && !(ORDER_STATUSES as readonly string[]).includes(b.status))
        throw new ValidationError('Geçersiz durum', 'status');
      const o = await store.update(req.params.number, (o) => {
        if (b.status && b.status !== o.status) {
          o.status = b.status as OrderStatus;
          o.history.push({ at: new Date().toISOString(), status: o.status });
        }
        if (typeof b.trackingNo === 'string') o.trackingNo = b.trackingNo.trim().slice(0, 60);
        if (typeof b.carrier === 'string') o.carrier = b.carrier.trim().slice(0, 60);
        if (typeof b.adminNote === 'string') o.adminNote = b.adminNote.slice(0, 2000);
      });
      if (!o) {
        res.status(404).json({ error: 'Sipariş bulunamadı' });
        return;
      }
      res.json(o);
    } catch (err) {
      next(err);
    }
  });

  api.use('/admin', admin);
  app.use('/api', api);
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Bulunamadı' });
  });

  if (staticDir && existsSync(staticDir)) {
    app.use(
      express.static(staticDir, {
        index: false,
        setHeaders(res, path) {
          if (path.includes('/assets/')) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        },
      }),
    );
    // Tek sayfa uygulaması: bilinmeyen yollar index.html'e
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile('index.html', { root: staticDir });
    });
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message, field: err.field });
      return;
    }
    if (err && typeof err === 'object' && 'type' in err && (err as { type: string }).type === 'entity.too.large') {
      res.status(413).json({ error: 'İstek çok büyük' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  });

  return app;
}
