import type { FigureDesign, FigureSize } from '../engine/figure';
import type { BomLine } from '../engine/bom';
import type { Brick } from '../engine/packer';
import type { PriceBreakdown } from '../engine/pricing';
import type { ModelStats } from '../engine/index';

export const ORDER_STATUSES = ['awaiting_payment', 'paid', 'packing', 'shipped', 'delivered', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  awaiting_payment: 'Ödeme bekleniyor',
  paid: 'Ödeme alındı',
  packing: 'Paketleniyor',
  shipped: 'Kargoya verildi',
  delivered: 'Teslim edildi',
  cancelled: 'İptal edildi',
};

export interface CustomerInfo {
  name: string;
  email: string;
  phone: string;
  address: string;
  district: string;
  city: string;
  postalCode: string;
  note: string;
}

export interface OrderHistoryEntry {
  at: string;
  status: OrderStatus;
  note?: string;
}

export interface Order {
  number: string;
  accessKey: string;
  createdAt: string;
  updatedAt: string;
  status: OrderStatus;
  engineVersion: number;
  design: FigureDesign;
  price: PriceBreakdown;
  stats: ModelStats;
  bom: BomLine[];
  bricks: Brick[];
  customer: CustomerInfo;
  consent: { kvkk: boolean; photo: boolean; at: string };
  hasPhoto: boolean;
  carrier?: string;
  trackingNo?: string;
  adminNote?: string;
  history: OrderHistoryEntry[];
}

/** Herkese açık yanıtlarda yüz ölçüleri ve ifade (kişisel stil verisi) bulunmaz. */
export type PublicDesign = Omit<FigureDesign, 'face' | 'expression'>;

/** v1 biçimli eski tasarımlarda bu alanlar yoktur; bu durumda da hata vermez. */
export function publicDesign(d: FigureDesign): PublicDesign {
  const { face: _face, expression: _expression, ...rest } = d;
  return rest;
}

/** Müşterinin sipariş takip sayfasında gördüğü alanlar */
export type PublicOrder = Pick<Order, 'number' | 'createdAt' | 'status' | 'price' | 'stats' | 'history' | 'carrier' | 'trackingNo'> & {
  design: PublicDesign;
  customerName: string;
  city: string;
};

export type OrderSummary = Pick<Order, 'number' | 'createdAt' | 'status' | 'price' | 'stats' | 'hasPhoto' | 'trackingNo'> & {
  customerName: string;
  city: string;
};

export interface PublicConfig {
  currency: string;
  designFee: number;
  packaging: number;
  shipping: number;
  bank: { name: string; holder: string; iban: string } | null;
  contactEmail: string;
}

export interface PublicCatalog {
  version: string;
  enabled: string[];
}

export interface QuoteResponse {
  design: FigureDesign;
  price: PriceBreakdown;
  stats: ModelStats;
  sizes: Record<FigureSize, { total: number; heightMm: number; brickCount: number }>;
}
