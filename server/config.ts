import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULT_PRICING, type PricingConfig } from '../src/engine/pricing';

const isProd = process.env.NODE_ENV === 'production';

function loadPricing(dataDir: string): PricingConfig {
  // Öncelik: PRICING_JSON ortam değişkeni > data/pricing.json > varsayılan
  let override: Partial<PricingConfig> = {};
  try {
    if (process.env.PRICING_JSON) override = JSON.parse(process.env.PRICING_JSON);
    else {
      const file = resolve(dataDir, 'pricing.json');
      if (existsSync(file)) override = JSON.parse(readFileSync(file, 'utf8'));
    }
  } catch (err) {
    console.error('Fiyat yapılandırması okunamadı, varsayılan kullanılıyor:', err);
  }
  return {
    ...DEFAULT_PRICING,
    ...override,
    partCost: { ...DEFAULT_PRICING.partCost, ...(override.partCost ?? {}) },
  };
}

const dataDir = resolve(process.env.DATA_DIR || 'data');

if (isProd && !process.env.ADMIN_TOKEN) {
  console.warn('UYARI: ADMIN_TOKEN tanımlı değil. Yönetim paneli kapalı.');
}

export const config = {
  isProd,
  port: Number(process.env.PORT || 8787),
  dataDir,
  /** Yönetim paneli erişim anahtarı. Üretimde mutlaka uzun, rastgele bir değer verin. */
  adminToken: process.env.ADMIN_TOKEN || (isProd ? '' : 'dev-admin'),
  pricing: loadPricing(dataDir),
  bank: {
    name: process.env.BANK_NAME || 'Banka adı (ayarlanmadı)',
    holder: process.env.BANK_HOLDER || 'Hesap sahibi (ayarlanmadı)',
    iban: process.env.BANK_IBAN || 'TR00 0000 0000 0000 0000 0000 00',
  },
  contactEmail: process.env.CONTACT_EMAIL || 'merhaba@example.com',
  /** Ters vekil (nginx, Cloudflare) arkasında gerçek IP için */
  trustProxy: process.env.TRUST_PROXY === '1',
};
