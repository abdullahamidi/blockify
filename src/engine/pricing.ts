import { getColor } from './palette';
import type { BomLine } from './bom';

export interface PricingConfig {
  currency: string;
  /** Parça tipine göre birim maliyet (TL) */
  partCost: Record<string, number>;
  /** Şeffaf parçalar için maliyet çarpanı */
  transparentMultiplier: number;
  /** Parça maliyetine uygulanan çarpan (işçilik, fire, kâr) */
  markup: number;
  designFee: number;
  packaging: number;
  shipping: number;
}

// NOT: Yer tutucu değerler. Gerçek tedarik fiyatlarıyla güncellenmeli (server/config.ts üzerinden).
export const DEFAULT_PRICING: PricingConfig = {
  currency: 'TRY',
  partCost: {
    '1x1': 0.8,
    '1x2': 1.0,
    '1x3': 1.3,
    '1x4': 1.5,
    '1x6': 2.0,
    '2x2': 1.4,
    '2x3': 1.8,
    '2x4': 2.2,
    p1x1: 0.5,
    p1x2: 0.6,
    p1x3: 0.8,
    p1x4: 0.9,
    p1x6: 1.2,
    p2x2: 0.9,
    p2x3: 1.1,
    p2x4: 1.3,
    plate8x8: 12,
    plate8x16: 20,
    plate16x16: 35,
  },
  transparentMultiplier: 1.5,
  markup: 2.5,
  designFee: 249,
  packaging: 60,
  shipping: 90,
};

export interface PriceBreakdown {
  currency: string;
  partsCost: number; // ham parça maliyeti (iç bilgi)
  parts: number; // müşteriye yansıyan parça bedeli
  designFee: number;
  packaging: number;
  shipping: number;
  total: number;
}

export function priceFor(bom: BomLine[], cfg: PricingConfig = DEFAULT_PRICING): PriceBreakdown {
  let partsCost = 0;
  for (const line of bom) {
    const unit = cfg.partCost[line.part] ?? 2;
    const mult = getColor(line.color).transparent ? cfg.transparentMultiplier : 1;
    partsCost += unit * mult * line.qty;
  }
  const parts = Math.round(partsCost * cfg.markup);
  const raw = parts + cfg.designFee + cfg.packaging + cfg.shipping;
  // Fiyatı ...9 ile biten bir tutara yuvarla (örn. 857 -> 859)
  const total = Math.ceil((raw + 1) / 10) * 10 - 1;
  return {
    currency: cfg.currency,
    partsCost: Math.round(partsCost * 100) / 100,
    parts: total - cfg.designFee - cfg.packaging - cfg.shipping,
    designFee: cfg.designFee,
    packaging: cfg.packaging,
    shipping: cfg.shipping,
    total,
  };
}

export function formatPrice(n: number, currency = 'TRY'): string {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
}
