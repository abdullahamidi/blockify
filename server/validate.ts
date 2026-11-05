import type { CustomerInfo } from '../src/shared/orders';

export class ValidationError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
  }
}

function str(v: unknown, field: string, label: string, min: number, max: number): string {
  const s = typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '';
  if (s.length < min) throw new ValidationError(`${label} gerekli`, field);
  if (s.length > max) throw new ValidationError(`${label} en fazla ${max} karakter olabilir`, field);
  return s;
}

export function validateCustomer(input: unknown): CustomerInfo {
  const c = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const name = str(c.name, 'name', 'Ad soyad', 3, 100);
  const email = str(c.email, 'email', 'E-posta', 5, 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new ValidationError('Geçerli bir e-posta girin', 'email');
  const phoneRaw = str(c.phone, 'phone', 'Telefon', 10, 20);
  const digits = phoneRaw.replace(/[^\d+]/g, '');
  if (!/^\+?\d{10,14}$/.test(digits)) throw new ValidationError('Geçerli bir telefon numarası girin', 'phone');
  const address = str(c.address, 'address', 'Adres', 10, 500);
  const district = str(c.district, 'district', 'İlçe', 2, 60);
  const city = str(c.city, 'city', 'İl', 2, 60);
  const postalCode = typeof c.postalCode === 'string' ? c.postalCode.trim() : '';
  if (postalCode && !/^\d{5}$/.test(postalCode)) throw new ValidationError('Posta kodu 5 haneli olmalı', 'postalCode');
  const note = typeof c.note === 'string' ? c.note.trim().slice(0, 500) : '';
  return { name, email, phone: digits, address, district, city, postalCode, note };
}

/** "data:image/jpeg;base64,..." -> Buffer (en fazla ~400 KB) */
export function parseJpegDataUrl(v: unknown): Buffer | null {
  if (typeof v !== 'string' || !v.startsWith('data:image/jpeg;base64,')) return null;
  const buf = Buffer.from(v.slice('data:image/jpeg;base64,'.length), 'base64');
  if (buf.length > 400_000) throw new ValidationError('Fotoğraf çok büyük', 'photo');
  if (buf[0] !== 0xff || buf[1] !== 0xd8) throw new ValidationError('Geçersiz fotoğraf', 'photo');
  return buf;
}
