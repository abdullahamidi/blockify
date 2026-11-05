import { FILLER_ID } from './palette';
import { PARTS, partForFootprint } from './parts';
import { EMPTY, VoxelGrid, WILDCARD, colorIdFromCode } from './voxels';

export interface Brick {
  id: number;
  part: string; // "2x4" gibi
  color: string; // palet renk kimliği ya da "filler"
  x: number; // en küçük köşe
  y: number; // katman
  z: number;
  sx: number; // x yönündeki uzunluk (stud)
  sz: number; // z yönündeki uzunluk (stud)
  /** Montaj adımı: parçanın takıldığı katman. Asılı parçalar üstteki katmanla birlikte takılır. */
  step: number;
  /** Altında destek yok; bir üst katmandaki parçanın altına takılır. */
  hanging: boolean;
  /** Tuğla yerine ince plaka (kaide) */
  plate?: boolean;
}

export interface PackResult {
  bricks: Brick[];
  components: number;
  /** Ana gövdeye bağlanamayan parça sayısı (0 olmalı) */
  looseBricks: number;
}

// ---------- Yardımcılar ----------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface RawBrick {
  x: number;
  z: number;
  sx: number;
  sz: number;
  code: number; // renk kodu ya da WILDCARD
}

/** Kafes simetrileri: (u,v) tarama uzayından (x,z) ızgara uzayına. */
interface Transform {
  swap: boolean;
  flipU: boolean;
  flipV: boolean;
}

const FOOTPRINTS: Array<[number, number]> = [];
for (const p of PARTS) {
  FOOTPRINTS.push([p.w, p.l]);
  if (p.w !== p.l) FOOTPRINTS.push([p.l, p.w]);
}

class Layer {
  bricks: RawBrick[] = [];
  /** hücre -> bu katmandaki tuğla indeksi (-1 boş) */
  owner: Int32Array;
  constructor(size: number) {
    this.owner = new Int32Array(size).fill(-1);
  }
}

function packLayer(
  grid: VoxelGrid,
  y: number,
  below: Layer | null,
  t: Transform,
  rng: () => number,
  jitter: number,
): Layer {
  const { w, d } = grid;
  const layer = new Layer(w * d);
  const U = t.swap ? d : w;
  const V = t.swap ? w : d;
  const toXZ = (u: number, v: number): [number, number] => {
    const uu = t.flipU ? U - 1 - u : u;
    const vv = t.flipV ? V - 1 - v : v;
    return t.swap ? [vv, uu] : [uu, vv];
  };
  const cell = (x: number, z: number) => x + w * z;
  const preferX = y % 2 === 0; // katmanlar arası yön değişimi -> daha iyi kenetlenme

  for (let v = 0; v < V; v++) {
    for (let u = 0; u < U; u++) {
      const [ax, az] = toXZ(u, v);
      const code0 = grid.get(ax, y, az);
      if (code0 === EMPTY || layer.owner[cell(ax, az)] !== -1) continue;

      let best: { raw: RawBrick; score: number } | null = null;
      for (const [su, sv] of FOOTPRINTS) {
        if (u + su > U || v + sv > V) continue;
        let color = code0 === WILDCARD ? WILDCARD : code0;
        let ok = true;
        let minX = Infinity;
        let minZ = Infinity;
        let maxX = -Infinity;
        let maxZ = -Infinity;
        const belowIds = new Set<number>();
        let unsupportedCells = 0;
        for (let dv = 0; dv < sv && ok; dv++) {
          for (let du = 0; du < su; du++) {
            const [x, z] = toXZ(u + du, v + dv);
            const c = grid.get(x, y, z);
            if (c === EMPTY || layer.owner[cell(x, z)] !== -1) {
              ok = false;
              break;
            }
            if (c !== WILDCARD) {
              if (color === WILDCARD) color = c;
              else if (c !== color) {
                ok = false;
                break;
              }
            }
            if (below) {
              const b = below.owner[cell(x, z)];
              if (b >= 0) belowIds.add(b);
              else unsupportedCells++;
            }
            minX = Math.min(minX, x);
            minZ = Math.min(minZ, z);
            maxX = Math.max(maxX, x);
            maxZ = Math.max(maxZ, z);
          }
        }
        if (!ok) continue;
        const sx = maxX - minX + 1;
        const sz = maxZ - minZ + 1;
        const area = sx * sz;
        let score = area * 4;
        if (below) {
          if (belowIds.size === 0) score -= 6;
          score += Math.max(0, belowIds.size - 1) * 6; // alttaki birden fazla parçayı birbirine bağlar
          if (belowIds.size === 1) {
            const only = below.bricks[[...belowIds][0]];
            if (only.x === minX && only.z === minZ && only.sx === sx && only.sz === sz) score -= 10; // üst üste aynı parça: zayıf dikiş
          }
          score -= unsupportedCells * 0.5;
        }
        if (sx !== sz && sx > sz === preferX) score += 2;
        score += rng() * jitter;
        if (!best || score > best.score) best = { raw: { x: minX, z: minZ, sx, sz, code: color }, score };
      }
      if (!best) continue; // olamaz: 1x1 her zaman sığar
      const idx = layer.bricks.length;
      layer.bricks.push(best.raw);
      for (let z = best.raw.z; z < best.raw.z + best.raw.sz; z++)
        for (let x = best.raw.x; x < best.raw.x + best.raw.sx; x++) layer.owner[cell(x, z)] = idx;
    }
  }
  return layer;
}

// ---------- Bağlantı analizi ----------

interface Analysis {
  components: number;
  mainSize: number;
  looseLayers: Set<number>;
  weak: number; // tek bağlantılı parça sayısı
  total: number;
}

function analyze(layers: Layer[], w: number, d: number): Analysis {
  const offsets: number[] = [];
  let total = 0;
  for (const l of layers) {
    offsets.push(total);
    total += l.bricks.length;
  }
  const parent = new Int32Array(total).map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const degree = new Int32Array(total);
  for (let y = 0; y + 1 < layers.length; y++) {
    const a = layers[y];
    const b = layers[y + 1];
    const seen = new Set<number>();
    for (let c = 0; c < w * d; c++) {
      const i = a.owner[c];
      const j = b.owner[c];
      if (i < 0 || j < 0) continue;
      const key = i * 100000 + j;
      if (seen.has(key)) continue;
      seen.add(key);
      const gi = offsets[y] + i;
      const gj = offsets[y + 1] + j;
      degree[gi]++;
      degree[gj]++;
      const ri = find(gi);
      const rj = find(gj);
      if (ri !== rj) parent[ri] = rj;
    }
  }
  const sizes = new Map<number, number>();
  for (let i = 0; i < total; i++) {
    const r = find(i);
    sizes.set(r, (sizes.get(r) ?? 0) + 1);
  }
  let mainRoot = -1;
  let mainSize = 0;
  for (const [r, s] of sizes) if (s > mainSize) [mainRoot, mainSize] = [r, s];
  const looseLayers = new Set<number>();
  let weak = 0;
  layers.forEach((l, y) => {
    l.bricks.forEach((_, i) => {
      const g = offsets[y] + i;
      if (find(g) !== mainRoot) looseLayers.add(y);
      if (degree[g] <= 1) weak++;
    });
  });
  return { components: sizes.size, mainSize, looseLayers, weak, total };
}

function cost(a: Analysis): number {
  return (a.total - a.mainSize) * 1000 + a.components * 100 + a.total * 1 + a.weak * 0.5;
}

// ---------- Ana fonksiyon ----------

const TRANSFORMS: Transform[] = [];
for (const swap of [false, true])
  for (const flipU of [false, true]) for (const flipV of [false, true]) TRANSFORMS.push({ swap, flipU, flipV });

function packAll(grid: VoxelGrid, seed: number): Layer[] {
  const rng = mulberry32(seed);
  const base = TRANSFORMS[seed % TRANSFORMS.length];
  const layers: Layer[] = [];
  for (let y = 0; y < grid.h; y++) {
    const t = { ...base, swap: y % 2 === 0 ? base.swap : !base.swap };
    layers.push(packLayer(grid, y, y > 0 ? layers[y - 1] : null, t, rng, seed === 0 ? 0 : 1.5));
  }
  return layers;
}

/**
 * Voksel ızgarasını tuğlalara böler. Deterministiktir: aynı ızgara her zaman
 * aynı sonucu verir (istemci önizlemesi ile sunucu fiyatı tutarlı kalır).
 */
export function packBricks(grid: VoxelGrid, attempts = 24): PackResult {
  const { w, d } = grid;
  let bestLayers: Layer[] | null = null;
  let bestAnalysis: Analysis | null = null;
  for (let s = 0; s < attempts; s++) {
    const layers = packAll(grid, s);
    const a = analyze(layers, w, d);
    if (!bestAnalysis || cost(a) < cost(bestAnalysis)) {
      bestLayers = layers;
      bestAnalysis = a;
    }
  }
  let layers = bestLayers!;
  let analysis = bestAnalysis!;

  // Onarım: kopuk parça içeren katmanları farklı tohumlarla yeniden döşe
  const rng = mulberry32(12345);
  for (let iter = 0; iter < 200 && analysis.components > 1; iter++) {
    const candidates = new Set<number>();
    for (const y of analysis.looseLayers) {
      candidates.add(y);
      if (y > 0) candidates.add(y - 1);
      if (y + 1 < grid.h) candidates.add(y + 1);
    }
    const list = [...candidates];
    const y = list[Math.floor(rng() * list.length)];
    const t = TRANSFORMS[Math.floor(rng() * TRANSFORMS.length)];
    const trial = layers.slice();
    trial[y] = packLayer(grid, y, y > 0 ? trial[y - 1] : null, t, mulberry32(iter * 7919 + y), 4);
    const a = analyze(trial, w, d);
    if (cost(a) < cost(analysis)) {
      layers = trial;
      analysis = a;
    }
  }

  const bricks = toBricks(layers, w, d);
  return {
    bricks,
    components: analysis.components,
    looseBricks: analysis.total - analysis.mainSize,
  };
}

function toBricks(layers: Layer[], w: number, d: number): Brick[] {
  const out: Brick[] = [];
  const ids: number[][] = [];
  layers.forEach((l, y) => {
    ids.push([]);
    for (const b of l.bricks) {
      const part = partForFootprint(b.sx, b.sz);
      if (!part) throw new Error(`Desteklenmeyen ölçü ${b.sx}x${b.sz}`);
      ids[y].push(out.length);
      out.push({
        id: out.length,
        part: part.id,
        color: b.code === WILDCARD ? FILLER_ID : colorIdFromCode(b.code),
        x: b.x,
        y,
        z: b.z,
        sx: b.sx,
        sz: b.sz,
        step: -1,
        hanging: false,
      });
    }
  });

  const overlaps = (y: number, i: number, y2: number): number[] => {
    const b = layers[y].bricks[i];
    const l2 = layers[y2];
    if (!l2) return [];
    const res = new Set<number>();
    for (let z = b.z; z < b.z + b.sz; z++)
      for (let x = b.x; x < b.x + b.sx; x++) {
        const o = l2.owner[x + w * z];
        if (o >= 0) res.add(o);
      }
    return [...res];
  };

  // 1) Aşağıdan yukarı: altında takılmış parça olanlar o katmanda takılır
  layers.forEach((l, y) => {
    l.bricks.forEach((_, i) => {
      const br = out[ids[y][i]];
      if (y === 0) {
        br.step = 0;
        return;
      }
      const supported = overlaps(y, i, y - 1).some((j) => {
        const s = out[ids[y - 1][j]].step;
        return s >= 0 && s <= y - 1;
      });
      if (supported) br.step = y;
    });
  });
  // 2) Yukarıdan aşağı: desteksiz parçalar üstteki parçanın altına takılır
  for (let y = layers.length - 1; y >= 0; y--) {
    layers[y].bricks.forEach((_, i) => {
      const br = out[ids[y][i]];
      if (br.step >= 0) return;
      const above = overlaps(y, i, y + 1)
        .map((j) => out[ids[y + 1][j]].step)
        .filter((s) => s >= 0);
      if (above.length) {
        br.step = Math.min(...above);
        br.hanging = true;
      }
    });
  }
  // Kalanlar (kopuk) kendi katmanında gösterilir
  for (const b of out) if (b.step < 0) b.step = b.y;

  out.sort((a, b) => a.step - b.step || a.y - b.y || a.z - b.z || a.x - b.x);
  out.forEach((b, i) => (b.id = i));
  void d;
  return out;
}
