import { existsSync, mkdirSync } from 'node:fs';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { randomBytes, randomInt } from 'node:crypto';
import { resolve } from 'node:path';
import type { Order } from '../src/shared/orders';

/**
 * Basit dosya tabanlı sipariş deposu (MVP).
 * Tüm siparişler bellekte tutulur, her değişiklikte JSON dosyasına atomik olarak yazılır.
 * Sipariş hacmi büyüdüğünde aynı arayüzle SQLite/Postgres'e geçilebilir.
 */
export class OrderStore {
  private orders: Order[] = [];
  private writing: Promise<void> = Promise.resolve();
  private readonly file: string;
  readonly photoDir: string;

  constructor(dataDir: string) {
    this.file = resolve(dataDir, 'orders.json');
    this.photoDir = resolve(dataDir, 'photos');
  }

  async init(): Promise<void> {
    mkdirSync(this.photoDir, { recursive: true });
    if (existsSync(this.file)) {
      this.orders = JSON.parse(await readFile(this.file, 'utf8'));
    }
  }

  private persist(): Promise<void> {
    const snapshot = JSON.stringify(this.orders);
    this.writing = this.writing.then(async () => {
      const tmp = `${this.file}.${process.pid}.tmp`;
      await writeFile(tmp, snapshot);
      await rename(tmp, this.file);
    });
    return this.writing;
  }

  list(): Order[] {
    return [...this.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  get(number: string): Order | undefined {
    return this.orders.find((o) => o.number === number);
  }

  newNumber(): string {
    const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    for (;;) {
      let s = 'BLK-';
      for (let i = 0; i < 6; i++) s += alphabet[randomInt(alphabet.length)];
      if (!this.get(s)) return s;
    }
  }

  newAccessKey(): string {
    return randomBytes(12).toString('base64url');
  }

  async add(order: Order): Promise<void> {
    this.orders.push(order);
    await this.persist();
  }

  async update(number: string, patch: (o: Order) => void): Promise<Order | undefined> {
    const o = this.get(number);
    if (!o) return undefined;
    patch(o);
    o.updatedAt = new Date().toISOString();
    await this.persist();
    return o;
  }

  photoPath(number: string): string {
    return resolve(this.photoDir, `${number}.jpg`);
  }

  async savePhoto(number: string, jpeg: Buffer): Promise<void> {
    await writeFile(this.photoPath(number), jpeg);
  }
}
