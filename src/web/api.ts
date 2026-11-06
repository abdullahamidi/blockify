import type { FigureDesign } from '../engine/figure';
import type { Brick } from '../engine/packer';
import type { BomLine } from '../engine/bom';
import type { ModelStats } from '../engine/index';
import type {
  CustomerInfo,
  Order,
  OrderStatus,
  OrderSummary,
  PublicCatalog,
  PublicConfig,
  PublicDesign,
  PublicOrder,
  QuoteResponse,
} from '../shared/orders';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly field?: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    });
  } catch {
    throw new ApiError('Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.', 0);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? 'Beklenmeyen bir hata oluştu', res.status, body.field);
  return body as T;
}

export const api = {
  config: () => request<PublicConfig>('/config'),
  catalog: () => request<PublicCatalog>('/catalog'),
  quote: (design: FigureDesign) =>
    request<QuoteResponse>('/quote', {
      method: 'POST',
      body: JSON.stringify({ design }),
    }),
  createOrder: (payload: {
    design: FigureDesign;
    customer: CustomerInfo;
    consent: { kvkk: boolean; photo: boolean };
    photo?: string;
  }) =>
    request<{ number: string; accessKey: string; total: number }>('/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  order: (number: string, key: string) =>
    request<PublicOrder>(`/orders/${encodeURIComponent(number)}?k=${encodeURIComponent(key)}`),
  build: (number: string, key: string) =>
    request<{ number: string; design: PublicDesign; bricks: Brick[]; bom: BomLine[]; stats: ModelStats }>(
      `/orders/${encodeURIComponent(number)}/build?k=${encodeURIComponent(key)}`,
    ),
};

export function adminApi(token: string) {
  const headers = { authorization: `Bearer ${token}` };
  return {
    list: () => request<OrderSummary[]>('/admin/orders', { headers }),
    get: (number: string) => request<Order>(`/admin/orders/${encodeURIComponent(number)}`, { headers }),
    update: (number: string, patch: { status?: OrderStatus; trackingNo?: string; carrier?: string; adminNote?: string }) =>
      request<Order>(`/admin/orders/${encodeURIComponent(number)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(patch),
      }),
    photoUrl: (number: string) => `/api/admin/orders/${encodeURIComponent(number)}/photo?token=${encodeURIComponent(token)}`,
  };
}
