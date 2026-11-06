import { type Catalog, footprints, isEnabled } from './catalog';
import { partForFootprint } from './parts';
import { EMPTY, VoxelGrid, WILDCARD, colorIdFromCode } from './voxels';

export interface Brick {
  id: number;
  part: string; // "2x4", "p1x2" gibi
  color: string; // palet renk kimliği ya da "filler"
  x: number; // en küçük köşe
  y: number; // v2: parçanın en alt plaka katı (v1: tuğla katmanı)
  z: number;
  sx: number; // x yönündeki uzunluk (stud)
  sz: number; // z yönündeki uzunluk (stud)
  /** Yükseklik (plaka): tuğla 3, plaka 1. v1 siparişlerinde yoktur. */
  h?: number;
  /** Montaj adımı: parçanın takıldığı tuğla kursu. Asılı parçalar üstteki parçayla birlikte takılır. */
  step: number;
  /** Altında destek yok; üstteki parçanın altına takılır. */
  hanging: boolean;
  /** Yalnızca kaide plakası */
  plate?: true;
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

type Kind = 'brick' | 'plate';

/** Bir tuğla 3 plaka yüksekliğindedir; katlar 3'erli kurslara bölünür. */
const COURSE = 3;

interface RawPart {
  x: number;
  y: number; // en alt kat
  z: number;
  sx: number;
  sz: number;
  h: 1 | 3;
  code: number; // renk kodu ya da WILDCARD
}

/** Kafes simetrileri: (u,v) tarama uzayından (x,z) ızgara uzayına. */
interface Transform {
  swap: boolean;
  flipU: boolean;
  flipV: boolean;
}

/** (u,v) tarama uzayında yönlendirilmiş parça izi */
interface Footprint {
  su: number;
  sv: number;
  id: string;
}

/** Bir kursun (3 kat) parçaları. owner[k]: hücre -> kurs içi parça indeksi (-1 boş). Tuğla 3 katta aynı indeksle görünür. */
class Course {
  parts: RawPart[] = [];
  owner: Int32Array[];
  constructor(layers: number, size: number) {
    this.owner = Array.from({ length: layers }, () => new Int32Array(size).fill(-1));
  }
}

/** Puanlamada kullanılan alttaki kat */
interface LayerView {
  owner: Int32Array;
  parts: RawPart[];
}

interface Ctx {
  grid: VoxelGrid;
  catalog: Catalog;
  /** Bu renk koduyla başlayan bir parça için denenecek izler (iki yön), büyükten küçüğe. */
  options: (kind: Kind, code: number) => Footprint[];
}

function makeCtx(grid: VoxelGrid, catalog: Catalog): Ctx {
  const cache = new Map<string, Footprint[]>();
  const options = (kind: Kind, code: number): Footprint[] => {
    const key = `${kind}${code}`;
    let list = cache.get(key);
    if (!list) {
      list = [];
      for (const p of footprints(catalog, colorIdFromCode(code), kind)) {
        list.push({ su: p.w, sv: p.l, id: p.id });
        if (p.w !== p.l) list.push({ su: p.l, sv: p.w, id: p.id });
      }
      cache.set(key, list);
    }
    return list;
  };
  return { grid, catalog, options };
}

/**
 * Bir kat (plaka) ya da kurs (tuğla) için `codes` içindeki hücreleri açgözlü doldurur.
 * Parça `layers` ile verilen kurs katlarının hepsinde sahip olarak işaretlenir.
 */
function fillPass(
  ctx: Ctx,
  course: Course,
  kind: Kind,
  codes: Int16Array,
  layers: number[],
  y: number,
  below: LayerView | null,
  t: Transform,
  rng: () => number,
  jitter: number,
): void {
  const { w, d } = ctx.grid;
  const owner = course.owner[layers[0]];
  const h = kind === 'brick' ? 3 : 1;
  const U = t.swap ? d : w;
  const V = t.swap ? w : d;
  const cellAt = (u: number, v: number): number => {
    const uu = t.flipU ? U - 1 - u : u;
    const vv = t.flipV ? V - 1 - v : v;
    return t.swap ? vv + w * uu : uu + w * vv;
  };
  const preferX = y % 2 === 0; // katlar arası yön değişimi -> daha iyi kenetlenme

  for (let v = 0; v < V; v++) {
    for (let u = 0; u < U; u++) {
      const anchor = cellAt(u, v);
      const code0 = codes[anchor];
      if (code0 === EMPTY || owner[anchor] !== -1) continue;

      let best: { raw: RawPart; score: number } | null = null;
      for (const f of ctx.options(kind, code0)) {
        if (u + f.su > U || v + f.sv > V) continue;
        let color = code0;
        let ok = true;
        let minX = Infinity;
        let minZ = Infinity;
        let maxX = -Infinity;
        let maxZ = -Infinity;
        const belowIds = new Set<number>();
        let unsupportedCells = 0;
        for (let dv = 0; dv < f.sv && ok; dv++) {
          for (let du = 0; du < f.su; du++) {
            const c = cellAt(u + du, v + dv);
            const code = codes[c];
            if (code === EMPTY || owner[c] !== -1) {
              ok = false;
              break;
            }
            if (code !== WILDCARD) {
              if (color === WILDCARD) color = code;
              else if (code !== color) {
                ok = false;
                break;
              }
            }
            if (below) {
              const b = below.owner[c];
              if (b >= 0) belowIds.add(b);
              else unsupportedCells++;
            }
            const x = c % w;
            const z = (c - x) / w;
            minX = Math.min(minX, x);
            minZ = Math.min(minZ, z);
            maxX = Math.max(maxX, x);
            maxZ = Math.max(maxZ, z);
          }
        }
        if (!ok) continue;
        // İç dolgu hücresiyle başlayan parça renk aldıysa o renkte de açık olmalı.
        if (code0 === WILDCARD && color !== WILDCARD && !isEnabled(ctx.catalog, f.id, colorIdFromCode(color))) continue;
        const sx = maxX - minX + 1;
        const sz = maxZ - minZ + 1;
        let score = sx * sz * 4;
        if (below) {
          if (belowIds.size === 0) score -= 6;
          score += Math.max(0, belowIds.size - 1) * 6; // alttaki birden fazla parçayı birbirine bağlar
          if (belowIds.size === 1) {
            const only = below.parts[[...belowIds][0]];
            if (only.x === minX && only.z === minZ && only.sx === sx && only.sz === sz) score -= 10; // üst üste aynı iz: zayıf dikiş
          }
          score -= unsupportedCells * 0.5;
        }
        if (sx !== sz && sx > sz === preferX) score += 2;
        score += rng() * jitter;
        if (!best || score > best.score) best = { raw: { x: minX, y, z: minZ, sx, sz, h, code: color }, score };
      }
      if (!best) {
        if (kind === 'plate') throw new Error(`Katalogda ${colorIdFromCode(code0)} için 1x1 plaka yok`);
        continue; // tuğla sığmadı: hücre plaka geçişine kalır
      }
      const idx = course.parts.length;
      course.parts.push(best.raw);
      for (let z = best.raw.z; z < best.raw.z + best.raw.sz; z++)
        for (let x = best.raw.x; x < best.raw.x + best.raw.sx; x++)
          for (const k of layers) course.owner[k][x + w * z] = idx;
    }
  }
}

/** Kursun 3 katı da dolu ve renkleri uyumluysa (WILDCARD hariç tek renk) sütunun rengi, değilse EMPTY. */
function columnCodes(grid: VoxelGrid, y0: number): Int16Array {
  const { w, d } = grid;
  const out = new Int16Array(w * d);
  for (let z = 0; z < d; z++)
    for (let x = 0; x < w; x++) {
      let color = WILDCARD;
      for (let k = 0; k < COURSE; k++) {
        const c = grid.get(x, y0 + k, z);
        if (c === EMPTY || (c !== WILDCARD && color !== WILDCARD && c !== color)) {
          color = EMPTY;
          break;
        }
        if (c !== WILDCARD) color = c;
      }
      out[x + w * z] = color;
    }
  return out;
}

function packCourse(
  ctx: Ctx,
  c: number,
  prev: Course | null,
  base: Transform,
  rng: () => number,
  jitter: number,
  useBricks: boolean,
): Course {
  const { grid } = ctx;
  const { w, d } = grid;
  const y0 = c * COURSE;
  const n = Math.min(COURSE, grid.h - y0);
  const course = new Course(n, w * d);
  const transformAt = (y: number): Transform => ({ ...base, swap: y % 2 === 0 ? base.swap : !base.swap });
  const belowOf = (k: number): LayerView | null => {
    if (k > 0) return { owner: course.owner[k - 1], parts: course.parts };
    return prev ? { owner: prev.owner[prev.owner.length - 1], parts: prev.parts } : null;
  };

  if (useBricks && n === COURSE) {
    fillPass(ctx, course, 'brick', columnCodes(grid, y0), [0, 1, 2], y0, belowOf(0), transformAt(y0), rng, jitter);
  }
  for (let k = 0; k < n; k++) {
    const codes = new Int16Array(w * d);
    const taken = course.owner[k];
    for (let z = 0; z < d; z++)
      for (let x = 0; x < w; x++) if (taken[x + w * z] === -1) codes[x + w * z] = grid.get(x, y0 + k, z);
    fillPass(ctx, course, 'plate', codes, [k], y0 + k, belowOf(k), transformAt(y0 + k), rng, jitter);
  }
  return course;
}

// ---------- Bağlantı analizi ----------

interface Analysis {
  components: number;
  mainSize: number;
  looseCourses: Set<number>;
  weak: number; // tek bağlantılı parça sayısı
  total: number;
}

function analyze(courses: Course[], size: number): Analysis {
  const offsets: number[] = [];
  const layers: Array<{ owner: Int32Array; off: number }> = [];
  let total = 0;
  for (const c of courses) {
    offsets.push(total);
    for (const owner of c.owner) layers.push({ owner, off: total });
    total += c.parts.length;
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
  // Ardışık iki katta aynı hücrede iki farklı parça varsa birleşiktir.
  for (let l = 0; l + 1 < layers.length; l++) {
    const a = layers[l];
    const b = layers[l + 1];
    const seen = new Set<number>();
    for (let c = 0; c < size; c++) {
      const i = a.owner[c];
      const j = b.owner[c];
      if (i < 0 || j < 0) continue;
      const gi = a.off + i;
      const gj = b.off + j;
      if (gi === gj) continue; // aynı tuğla
      const key = gi * total + gj;
      if (seen.has(key)) continue;
      seen.add(key);
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
  const looseCourses = new Set<number>();
  let weak = 0;
  courses.forEach((course, ci) => {
    for (let i = 0; i < course.parts.length; i++) {
      const g = offsets[ci] + i;
      if (find(g) !== mainRoot) looseCourses.add(ci);
      if (degree[g] <= 1) weak++;
    }
  });
  return { components: sizes.size, mainSize, looseCourses, weak, total };
}

function cost(a: Analysis): number {
  return (a.total - a.mainSize) * 1000 + a.components * 100 + a.total * 1 + a.weak * 0.5;
}

// ---------- Ana fonksiyon ----------

const TRANSFORMS: Transform[] = [];
for (const swap of [false, true])
  for (const flipU of [false, true]) for (const flipV of [false, true]) TRANSFORMS.push({ swap, flipU, flipV });

const REPAIR_JITTER = [4, 8, 12, 16];

function packAll(ctx: Ctx, seed: number, useBricks: boolean): Course[] {
  const rng = mulberry32(seed);
  const base = TRANSFORMS[seed % TRANSFORMS.length];
  const courses: Course[] = [];
  for (let c = 0; c * COURSE < ctx.grid.h; c++) {
    courses.push(packCourse(ctx, c, c > 0 ? courses[c - 1] : null, base, rng, seed === 0 ? 0 : 1.5, useBricks));
  }
  return courses;
}

/**
 * Voksel ızgarasını (y birimi plaka) katalogda açık tuğla ve plakalara böler.
 * Deterministiktir: aynı ızgara ve katalog her zaman aynı sonucu verir
 * (istemci önizlemesi ile sunucu fiyatı tutarlı kalır).
 */
export function packBricks(grid: VoxelGrid, catalog: Catalog, attempts = 12): PackResult {
  const ctx = makeCtx(grid, catalog);
  const size = grid.w * grid.d;
  let courses: Course[] | null = null;
  let analysis: Analysis | null = null;
  for (let s = 0; s < attempts; s++) {
    const trial = packAll(ctx, s, s % 3 !== 2);
    const a = analyze(trial, size);
    if (!analysis || cost(a) < cost(analysis)) {
      courses = trial;
      analysis = a;
    }
  }
  if (!courses || !analysis) throw new Error('En az bir deneme gerekir');

  // Onarım: kopuk parça içeren kursları ve komşularını farklı tohumlarla yeniden döşe.
  // Puan gürültüsü turdan tura REPAIR_JITTER içinde döner: küçük gürültü döşemeyi korur, büyük gürültü açgözlü
  // seçimin dışına çıkar (ör. desteğin hepsini tek başına kaplayıp çıkıntıyı kopuk bırakan plaka).
  const rng = mulberry32(12345);
  for (let iter = 0; iter < 200 && analysis.components > 1; iter++) {
    const candidates = new Set<number>();
    for (const c of analysis.looseCourses) {
      candidates.add(c);
      if (c > 0) candidates.add(c - 1);
      if (c + 1 < courses.length) candidates.add(c + 1);
    }
    const list = [...candidates];
    const c = list[Math.floor(rng() * list.length)];
    const t = TRANSFORMS[Math.floor(rng() * TRANSFORMS.length)];
    const useBricks = rng() >= 0.5;
    const trial = courses.slice();
    const jitter = REPAIR_JITTER[iter % REPAIR_JITTER.length];
    trial[c] = packCourse(ctx, c, c > 0 ? trial[c - 1] : null, t, mulberry32(iter * 7919 + c), jitter, useBricks);
    const a = analyze(trial, size);
    if (cost(a) < cost(analysis)) {
      courses = trial;
      analysis = a;
    }
  }

  return {
    bricks: toBricks(courses, grid.w),
    components: analysis.components,
    looseBricks: analysis.total - analysis.mainSize,
  };
}

function toBricks(courses: Course[], w: number): Brick[] {
  const out: Brick[] = [];
  const ids: number[][] = []; // kurs -> kurs içi indeks -> out indeksi
  for (const course of courses) {
    ids.push(
      course.parts.map((p) => {
        const kind: Kind = p.h === 3 ? 'brick' : 'plate';
        const part = partForFootprint(p.sx, p.sz, kind);
        if (!part) throw new Error(`Desteklenmeyen ölçü ${p.sx}x${p.sz}`);
        out.push({
          id: out.length,
          part: part.id,
          color: colorIdFromCode(p.code),
          x: p.x,
          y: p.y,
          z: p.z,
          sx: p.sx,
          sz: p.sz,
          h: p.h,
          step: -1,
          hanging: false,
        });
        return out.length - 1;
      }),
    );
  }

  /** `p`nin izinde `y` katını kaplayan parçalar (out indeksleri). */
  const overlaps = (p: RawPart, y: number): number[] => {
    const ci = Math.floor(y / COURSE);
    const owner = y >= 0 ? courses[ci]?.owner[y - ci * COURSE] : undefined;
    if (!owner) return [];
    const res = new Set<number>();
    for (let z = p.z; z < p.z + p.sz; z++)
      for (let x = p.x; x < p.x + p.sx; x++) {
        const o = owner[x + w * z];
        if (o >= 0) res.add(ids[ci][o]);
      }
    return [...res];
  };

  // Parçalar kurs ve geçiş sırasıyla üretildi: bu sıra y'ye göre artandır.
  const order = courses.flatMap((course, ci) => course.parts.map((p, i) => ({ p, i: ids[ci][i] })));
  const supported = new Uint8Array(out.length);
  // 1) Aşağıdan yukarı: zeminde ya da hemen altındaki desteklenmiş bir parçaya takılı olan desteklenmiştir
  for (const { p, i } of order) {
    if (p.y === 0 || overlaps(p, p.y - 1).some((j) => supported[j])) {
      supported[i] = 1;
      out[i].step = Math.floor(p.y / COURSE);
    }
  }
  // 2) Yukarıdan aşağı: desteksiz parça hemen üstündeki parçaların en erken adımında, onların altına takılır
  for (let k = order.length - 1; k >= 0; k--) {
    const { p, i } = order[k];
    if (supported[i]) continue;
    const above = overlaps(p, p.y + p.h)
      .map((j) => out[j].step)
      .filter((s) => s >= 0);
    if (above.length) {
      out[i].step = Math.min(...above);
      out[i].hanging = true;
    }
  }
  // Kalanlar (kopuk) kendi kursunda gösterilir
  for (const b of out) if (b.step < 0) b.step = Math.floor(b.y / COURSE);

  out.sort((a, b) => a.step - b.step || a.y - b.y || a.z - b.z || a.x - b.x);
  out.forEach((b, i) => (b.id = i));
  return out;
}
