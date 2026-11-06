import { EMPTY, VoxelGrid, colorCode } from '../voxels';
import { FigureDesign } from './design';
import { eyeCellsOf, eyeCenterRow, headDims } from './head';

/** Ön saç çizgisinin yüksekliği (v), hairline 0..2. */
const HAIRLINE_V = [0.8, 0.84, 0.88];

const NEIGHBORS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

function isSurface(g: VoxelGrid, x: number, y: number, z: number): boolean {
  if (g.get(x, y, z) === EMPTY) return false;
  return NEIGHBORS.some(([dx, dy, dz]) => g.get(x + dx, y + dy, z + dz) === EMPTY);
}

/**
 * Kafaya saç ekler (yerinde). Yalnızca ten renkli yüzey hücrelerini boyar; kaş, göz, ağız, yüz kılı, gölge tonlu
 * hücreler (burun, kapak, dudak, kulak içi) ve öne çıkan burun değişmez. Boş yere yeni hücre yalnızca topuz ve hacimde eklenir.
 * `long` kafada `medium` ile aynıdır; sırttaki saç paneli gövde tarafında eklenir.
 */
export function applyHair(head: VoxelGrid, design: FigureDesign): void {
  const style = design.hairStyle;
  if (style === 'bald') return;
  const { W, D, H } = headDims(design.size);
  const cx = (W + 1) / 2;
  const cz = (D + 1) / 2;
  const skin = colorCode(design.skin);
  const hair = colorCode(design.hairColor);
  const vh = HAIRLINE_V[design.hairline];
  const long = style === 'medium' || style === 'long';
  const angle = (x: number, z: number) => (Math.abs(Math.atan2(x - cx, ((z - cz) * W) / D)) * 180) / Math.PI;

  // Boyanacak hücreler önce toplanır, sonra yazılır (komşuluk testi boyanmamış ızgaraya göre).
  const paint: [number, number, number][] = [];
  for (let y = 0; y < H; y++) {
    const v = (y + 0.5) / H;
    for (let z = 1; z <= D; z++)
      for (let x = 1; x <= W; x++) {
        if (head.get(x, y, z) !== skin || !isSurface(head, x, y, z)) continue;
        const a = angle(x, z);
        const base = a < 60 ? v >= vh : a <= 120 ? v >= 0.62 : v >= 0.3;
        if (base || (long && a > 75 && v >= 0.05)) paint.push([x, y, z]);
      }
  }
  for (const [x, y, z] of paint) head.set(x, y, z, hair);

  if (style === 'bun') addBun(head, W, D, H, hair);
  if (style === 'volume') {
    const add: [number, number, number][] = [];
    const seen = new Set<number>();
    for (const [x, y, z] of paint)
      for (const [dx, dy, dz] of NEIGHBORS) {
        const nx = x + dx;
        const ny = y + dy;
        const nz = z + dz;
        if (head.get(nx, ny, nz) !== EMPTY || (ny + 0.5) / H < 0.45 || !head.inBounds(nx, ny, nz)) continue;
        const key = head.idx(nx, ny, nz);
        if (!seen.has(key)) {
          seen.add(key);
          add.push([nx, ny, nz]);
        }
      }
    for (const [x, y, z] of add) head.set(x, y, z, hair);
  }
}

/** Topuz: genişliği W ile aynı paritede (simetri için) en yakın değer. */
function addBun(head: VoxelGrid, W: number, D: number, H: number, hair: number): void {
  const target = 0.35 * W;
  let bw = Math.round(target);
  if ((bw - W) % 2 !== 0) bw = Math.abs(bw - 1 - target) <= Math.abs(bw + 1 - target) ? bw - 1 : bw + 1;
  bw = Math.max(bw, W % 2 === 0 ? 2 : 1);
  const bd = Math.max(1, Math.round(0.35 * D));
  const bh = Math.ceil(0.08 * H);
  const cx = (W + 1) / 2;
  const zc = (D + 1) / 2 - D / 4; // orta ile arka arası
  const x0 = Math.round(cx - (bw - 1) / 2);
  const z0 = Math.round(zc - (bd - 1) / 2);
  const columnTop = (x: number, z: number) => {
    for (let y = head.h - 1; y >= 0; y--) if (head.get(x, y, z) !== EMPTY) return y;
    return -1;
  };
  let base = -1;
  for (let z = z0; z < z0 + bd; z++) for (let x = x0; x < x0 + bw; x++) base = Math.max(base, columnTop(x, z));
  if (base < 0) return;
  for (let z = z0; z < z0 + bd; z++)
    for (let x = x0; x < x0 + bw; x++) {
      const top = columnTop(x, z);
      if (top < 0) continue;
      for (let y = top + 1; y <= base + bh; y++) head.set(x, y, z, hair);
    }
}

/**
 * Gözlük (yerinde): her gözün çevresinde bir hücre çerçeve, gözler arasında köprü, iki yanda göz satırında
 * kulağın ön kenarına uzanan sap. Göz hücrelerine ve kaş/yüz kılı gibi saç renkli ön hücrelere yazmaz.
 */
export function applyGlasses(head: VoxelGrid, design: FigureDesign): void {
  if (!design.glasses) return;
  const { W, D } = headDims(design.size);
  const cx = (W + 1) / 2;
  const cz = (D + 1) / 2;
  const color = colorCode(design.glassesColor);
  const hair = colorCode(design.hairColor);
  const eyes = eyeCellsOf(design);
  const isEye = (x: number, y: number) => eyes.has(`${x},${y}`);
  if (eyes.size === 0) return;

  const frontZ = (x: number, y: number) => {
    for (let z = head.d - 1; z >= 0; z--) if (head.get(x, y, z) !== EMPTY) return z;
    return -1;
  };
  const put = (x: number, y: number, z: number, frontOnly: boolean) => {
    if (z < 0 || isEye(x, y) && frontOnly) return;
    const c = head.get(x, y, z);
    if (c === EMPTY || c === hair && frontOnly) return;
    head.set(x, y, z, color);
  };

  // Çerçeve: ön düzlemde göz hücrelerinin 8 komşusu.
  const frame = new Set<string>();
  for (const key of eyes) {
    const [ex, ey] = key.split(',').map(Number);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const x = ex + dx;
        const y = ey + dy;
        if (x >= 1 && x <= W && y >= 0 && !isEye(x, y)) frame.add(`${x},${y}`);
      }
  }
  // Köprü: göz satırında iki göz arasındaki sütunlar.
  const row = eyeCenterRow(design);
  let leftMax = -1;
  let rightMin = Infinity;
  for (const key of eyes) {
    const [ex] = key.split(',').map(Number);
    if (ex < cx) leftMax = Math.max(leftMax, ex);
    else rightMin = Math.min(rightMin, ex);
  }
  for (let x = leftMax + 1; x < rightMin; x++) frame.add(`${x},${row}`);
  for (const key of frame) {
    const [x, y] = key.split(',').map(Number);
    put(x, y, frontZ(x, y), true);
  }

  // Saplar: göz satırında, çerçevenin dış kenarından kulağın ön kenarına kadar yüzey hücreleri.
  const earFront = Math.round(cz + D * 0.05);
  for (const side of [-1, 1]) {
    let outer = side < 0 ? Infinity : -1;
    for (const key of eyes) {
      const [ex] = key.split(',').map(Number);
      if (side < 0 ? ex < cx : ex > cx) outer = side < 0 ? Math.min(outer, ex) : Math.max(outer, ex);
    }
    for (let z = earFront; z <= D; z++)
      for (let x = 1; x <= W; x++) {
        if (side < 0 ? x >= outer : x <= outer) continue; // çerçevenin dış kenarının dışı
        if (!isSurface(head, x, row, z)) continue;
        const a = (Math.abs(Math.atan2(x - cx, ((z - cz) * W) / D)) * 180) / Math.PI;
        put(x, row, z, a < 60);
      }
  }
}
