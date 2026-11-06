import { EMPTY, VoxelGrid, colorCode } from '../voxels';
import { FaceKey, FigureDesign, FigureSize, HEAD_WIDTH, faceValue } from './design';

export interface HeadDims {
  W: number;
  D: number;
  H: number;
}

/** Kafanın ızgaradaki yeri: x ∈ [1, W], y ∈ [0, H-1], z ∈ [1, D]. Ön yüz en büyük z'dir. */
export const HEAD_ORIGIN = { x: 1, z: 1 } as const;

export function headDims(size: FigureSize): HeadDims {
  const W = HEAD_WIDTH[size];
  return { W, D: W - 2, H: Math.round(W * 3.125) };
}

const SKIN_SHADE: Record<string, string> = {
  lightNougat: 'nougat',
  nougat: 'mediumNougat',
  tan: 'nougat',
  mediumNougat: 'reddishBrown',
  reddishBrown: 'darkBrown',
  darkBrown: 'black',
};

/** Tenin bir ton koyusu (alt dudak, burun altı, göz kapağı, kulak içi). Eşlemede olmayan ten kendisi kalır. */
export function skinShade(skin: string): string {
  return SKIN_SHADE[skin] ?? skin;
}

const EYE_HALF_HEIGHT = [0.018, 0.028, 0.04];
const BEARD_LINE_OFFSET = [-0.05, 0, 0.05];
/** Yalnızca kafa kurulurken kullanılan "sakal" işareti; hairColor'a çevrilir ve sakal maskesine yazılır. */
const BEARD = -2;

interface Codes {
  skin: number;
  shade: number;
  hair: number;
  black: number;
  white: number;
  lip: number;
}

/** Sakalın üst sınırı (v). a: önden açı (derece). Prototipteki eğrinin eşiklerine `off` eklenir; 140°'nin arkasında sakal yok. */
function beardTop(a: number, off: number): number {
  if (a <= 22) return 0.37 + off;
  if (a <= 60) return 0.37 + ((a - 22) / 38) * 0.08 + off;
  if (a <= 82) return 0.45 + ((a - 60) / 22) * 0.13 + off;
  if (a <= 100) return 0.58 - ((a - 82) / 18) * 0.3 + off;
  if (a <= 140) return 0.28 - ((a - 100) / 40) * 0.28 + off;
  return 0;
}

/** Kaşın kalkma (+) ya da çatılma (−) payı (v). t: iç uçta 0, dış uçta 1. */
function browRaise(level: number, t: number): number {
  if (level === -1) return -0.02 * (1 - t);
  if (level === 1) return 0.02 + 0.01 * (1 - t);
  if (level === 2) return 0.035 + 0.02 * (1 - t);
  return 0;
}

/**
 * Ön yüze bakan bir hücrenin rengini veren fonksiyonu kurar. Öncelik: ağız (en son çizilir, sakal kapatmaz),
 * göz (kapalı göz çizilmez), kaş, göz kapağı, burun altı, yüz kılı (BEARD), taban rengi.
 * isFace(x, y): o (x, y)'deki en öndeki hücre öne bakıyor mu (yüz çizilen hücre).
 */
function facePainter(design: FigureDesign, W: number, H: number, k: Codes, isFace: (x: number, y: number) => boolean) {
  const f = (key: FaceKey) => faceValue(design, key);
  const [browHeight, browTilt, browThickness, browGap] = [f('browHeight'), f('browTilt'), f('browThickness'), f('browGap')];
  const [eyeHeight, eyeSpacing, eyeWidth] = [f('eyeHeight'), f('eyeSpacing'), f('eyeWidth')];
  const [noseBottom, noseWidth, mouthHeight, mouthWidth] = [f('noseBottom'), f('noseWidth'), f('mouthHeight'), f('mouthWidth')];
  const { smile, browRaiseL, browRaiseR, eyeOpen } = design.expression;
  const big = W >= 12;
  const cx = (W + 1) / 2;
  // En yakın örnek kuralı: tasarımdaki bir hat, bandına hiçbir satır/sütun merkezi düşmediği için kaybolmaz.
  // Bant simetrik olduğundan "bant ∪ en yakın satır/sütun" bu kuralla aynıdır.
  const nearestRow = (v: number) => Math.round(v * H - 0.5);
  const colU = (col: number) => (col - 0.5) / (W / 2); // col: merkezden 1, 2, … (W/2) numaralı sütun
  const bandRows = (inBand: (v: number) => boolean, near: number): [number, number] => {
    let lo = -1;
    let hi = -1;
    for (let y = 0; y < H; y++)
      if (inBand((y + 0.5) / H)) {
        if (lo < 0) lo = y;
        hi = y;
      }
    return lo < 0 ? [nearestRow(near), nearestRow(near)] : [lo, hi];
  };

  const hh = EYE_HALF_HEIGHT[eyeOpen];
  const [eyeLo, eyeHi] = bandRows((v) => Math.abs(v - eyeHeight) <= hh, eyeHeight);
  const irisCol = Math.min(W / 2, Math.max(1, Math.round((eyeSpacing * W + 1) / 2)));
  const [lineLo, lineHi] = bandRows((v) => v >= mouthHeight && v < mouthHeight + 0.028, mouthHeight);
  const mustacheBottom = mouthHeight + 0.028;
  const [mustLo, mustHi] = bandRows((v) => v >= mustacheBottom && v < noseBottom, (mustacheBottom + noseBottom) / 2);

  // Gülümseme: küçük boyutta smile 3, smile 2 gibi çizilir.
  const shape = smile === 3 && !big ? 2 : smile;
  const teeth = smile === 3 && big;
  const mouthHalf = mouthWidth + (shape >= 2 ? 0.04 : 0);
  const cornerLift = shape === 0 ? 0 : shape === 1 || !big ? 1 : 2;
  // Hiçbir ağız sütunu köşe koşulunu sağlamıyorsa (küçük boyut) gülümsemede her yana bir köşe sütunu eklenir.
  let mouthCols = 0;
  let hasCorner = false;
  for (let col = 1; col <= W / 2 && colU(col) <= mouthHalf; col++) {
    mouthCols = col;
    if (colU(col) > 0.6 * mouthWidth) hasCorner = true;
  }
  const extraCorner = smile >= 1 && !hasCorner ? mouthCols + 1 : 0;

  function mouth(au: number, col: number, y: number): number {
    const isLine = (yy: number) => yy >= lineLo && yy <= lineHi;
    if (col === extraCorner) return isLine(y - 1) ? k.lip : EMPTY;
    if (au > mouthHalf) return EMPTY;
    // Köşe sütunlarında ağzın tamamı (alt dudak + çizgi + diş) cornerLift satır yukarı kayar.
    const yy = y - (au > 0.6 * mouthWidth ? cornerLift : 0);
    if (isLine(yy)) return k.lip;
    const v = (yy + 0.5) / H;
    if (teeth && v >= mouthHeight - 0.03 && v < mouthHeight && au <= 0.8 * mouthWidth) return k.white;
    if (v >= mouthHeight - 0.045 && v < mouthHeight) return k.shade;
    return EMPTY;
  }

  const raiseOf = [browRaiseL, browRaiseR]; // taraf 0 = L (u < 0), 1 = R
  const tiltScale = [1, 1];

  function isBrow(u: number, y: number): boolean {
    const au = Math.abs(u);
    // max(inner, 1.5/W): iki orta sütun hiçbir zaman kaş olmaz, kaşlar birleşmez.
    if (au < Math.max(browGap, 1.5 / W) || au > 0.8) return false;
    const t = (au - browGap) / (0.8 - browGap);
    const side = u < 0 ? 0 : 1;
    const raise = raiseOf[side];
    const vc =
      !big && raise === 0
        ? browHeight
        : browHeight +
          0.018 * Math.sin(Math.PI * Math.min(1, 1.25 * t)) +
          browTilt * tiltScale[side] * t +
          browRaise(raise, t);
    return Math.abs((y + 0.5) / H - vc) <= browThickness - 0.006 * t || y === nearestRow(vc);
  }

  /** Görünen kaşta (v > eyeHeight + 0.05) en içteki sütunun üst satırı eksi en dıştaki sütunun üst satırı. */
  function browInnerMinusOuter(side: number): number {
    const sign = side ? 1 : -1;
    let innerTop = -1;
    let outerTop = -1;
    for (let col = 1; col <= W / 2; col++) {
      const x = cx + sign * (col - 0.5);
      const u = sign * colU(col);
      let top = -1;
      for (let y = 0; y < H; y++) if ((y + 0.5) / H > eyeHeight + 0.05 && isFace(x, y) && isBrow(u, y)) top = y;
      if (top < 0) continue;
      if (innerTop < 0) innerTop = top;
      outerTop = top;
    }
    return innerTop < 0 ? 0 : innerTop - outerTop;
  }

  // Nötr kaş kuralı (genel kısıt, FACE_SCALE'den önce gelir): iç uç dış uçtan en fazla 1 satır yüksek.
  // Aşılırsa o tarafın eğim terimi yarıya indirilir; 4 yarılamadan sonra eğim 0 olur.
  for (const side of [0, 1]) {
    if (raiseOf[side] !== 0) continue;
    for (let halvings = 0; browInnerMinusOuter(side) > 1 && tiltScale[side] !== 0; halvings++)
      tiltScale[side] = halvings < 4 ? tiltScale[side] / 2 : 0;
  }

  function isFacialHair(au: number, y: number, v: number): boolean {
    if (design.facialHair === 'none') return false;
    if (y >= mustLo && y <= mustHi && au <= mouthWidth + 0.15) return true; // bıyık bandı
    return design.facialHair === 'goatee' && v < mouthHeight - 0.045 && au <= mouthWidth + 0.05;
  }

  return (x: number, y: number, base: number): number => {
    const u = (x - cx) / (W / 2);
    const au = Math.abs(u);
    const col = Math.abs(x - cx) + 0.5;
    const v = (y + 0.5) / H;
    const m = mouth(au, col, y);
    if (m !== EMPTY) return m;
    const de = Math.abs(au - eyeSpacing);
    if (y >= eyeLo && y <= eyeHi && de <= eyeWidth) {
      if (big) return de <= 0.45 * eyeWidth || col === irisCol ? k.black : k.white;
      if (de <= 0.6 * eyeWidth) return k.black;
    }
    if (isBrow(u, y)) return k.hair;
    if (big && y === eyeHi + 1 && de <= eyeWidth) return k.shade;
    if (v >= noseBottom && v < noseBottom + 0.055 && au <= noseWidth) return k.shade;
    if (isFacialHair(au, y, v)) return BEARD;
    return base;
  };
}

/** Parametrik kafa: şekil, yüz, ifade, yüz kılı, kulaklar; büyük boyutta öne çıkan burun ve dolgun sakal. Saç yok. */
export function buildHead(design: FigureDesign): VoxelGrid {
  const { W, D, H } = headDims(design.size);
  const g = new VoxelGrid(W + 2, H + Math.ceil(H * 0.15), D + 2);
  const cx = (W + 1) / 2;
  const cz = (D + 1) / 2;
  const k: Codes = {
    skin: colorCode(design.skin),
    shade: colorCode(skinShade(design.skin)),
    hair: colorCode(design.hairColor),
    black: colorCode('black'),
    white: colorCode('white'),
    lip: colorCode(design.skin === 'reddishBrown' || design.skin === 'darkBrown' ? 'black' : 'reddishBrown'),
  };
  const crown = faceValue(design, 'crownRound');
  const chin = faceValue(design, 'chinTaper');

  // 1) Şekil: köşeleri yuvarlatılmış kutu, crownRound'tan yukarısı kubbe, 0.26'nın altı daralan çene.
  for (let y = 0; y < H; y++) {
    const v = (y + 0.5) / H;
    let hw = 1;
    let hd = 1;
    let czz = cz;
    if (v > crown) {
      const t = (v - crown) / (1 - crown);
      hw = hd = Math.sqrt(Math.max(0, 1 - t * t));
    }
    if (v < 0.26) {
      const t = (0.26 - v) / 0.26;
      hw = 1 - chin * t * t;
      hd = 1 - 0.3 * t;
      czz = cz + (D / 2) * (1 - hd);
    }
    for (let z = 1; z <= D; z++)
      for (let x = 1; x <= W; x++) {
        const xn = Math.abs((x - cx) / ((W / 2) * hw));
        const zn = Math.abs((z - czz) / ((D / 2) * hd));
        if (xn * xn * xn + zn * zn * zn <= 1) g.set(x, y, z, k.skin);
      }
  }

  // 2) Renk: sakal tabanı, ardından öne bakan (önü boş ve a < 55°) hücrelerde yüz.
  //    Şekil z'de dışbükey olduğundan önü boş hücre o (x, y)'deki en öndeki hücredir.
  const angle = (x: number, z: number) => (Math.abs(Math.atan2(x - cx, ((z - cz) * W) / D)) * 180) / Math.PI;
  const frontZ = (x: number, y: number) => {
    let z = D;
    while (z >= 1 && g.get(x, y, z) === EMPTY) z--;
    return z;
  };
  const faceFront = new Uint8Array(g.w * g.h);
  for (let y = 0; y < H; y++)
    for (let x = 1; x <= W; x++) {
      const fz = frontZ(x, y);
      if (fz >= 1 && angle(x, fz) < 55) faceFront[x + g.w * y] = 1;
    }
  const paint = facePainter(design, W, H, k, (x, y) => faceFront[x + g.w * y] === 1);
  const beard = design.facialHair === 'shortBeard' || design.facialHair === 'fullBeard';
  const off = BEARD_LINE_OFFSET[design.beardLine];
  const beardFront = new Uint8Array(g.w * g.h); // en öndeki hücresi sakal olan (x, y)
  for (let y = 0; y < H; y++)
    for (let z = 1; z <= D; z++)
      for (let x = 1; x <= W; x++) {
        if (g.get(x, y, z) === EMPTY) continue;
        const v = (y + 0.5) / H;
        const front = g.get(x, y, z + 1) === EMPTY;
        let c = beard && v < beardTop(angle(x, z), off) ? BEARD : k.skin;
        if (front && faceFront[x + g.w * y]) c = paint(x, y, c);
        if (c === BEARD) {
          c = k.hair;
          if (front) beardFront[x + g.w * y] = 1;
        }
        g.set(x, y, z, c);
      }

  // 3) Kulaklar: x = 0 ve x = W + 1; büyük boyutta iç kısım koyu ton.
  const earHeight = faceValue(design, 'earHeight');
  const z0 = Math.round(cz - D * 0.15);
  const z1 = Math.round(cz + D * 0.05);
  for (let y = 0; y < H; y++) {
    const dv = Math.abs((y + 0.5) / H - earHeight);
    if (dv > 0.12) continue;
    for (let z = z0; z <= z1; z++) {
      let xmin = 0;
      let xmax = 0;
      for (let x = 1; x <= W; x++)
        if (g.get(x, y, z) !== EMPTY) {
          if (!xmin) xmin = x;
          xmax = x;
        }
      if (!xmin) continue;
      const c = W >= 12 && dv < 0.07 && z > z0 && z < z1 ? k.shade : k.skin;
      g.set(xmin - 1, y, z, c);
      g.set(xmax + 1, y, z, c);
    }
  }

  // 4) Büyük boyutta hacim: öne çıkan burun; dolgun sakalda ön sakal hücrelerinin (renge göre değil,
  //    sakal maskesine göre) önüne bir hücre. Ağız hücreleri sakal sayılmadığından ağız kapanmaz.
  if (W >= 12) {
    const noseBottom = faceValue(design, 'noseBottom');
    const noseHalf = Math.max(1 / W, faceValue(design, 'noseWidth') - 0.02);
    const mouthHeight = faceValue(design, 'mouthHeight');
    const full = design.facialHair === 'fullBeard';
    for (let y = 0; y < H; y++)
      for (let x = 1; x <= W; x++) {
        const fz = frontZ(x, y);
        if (fz < 1) continue;
        const au = Math.abs((x - cx) / (W / 2));
        const v = (y + 0.5) / H;
        if (au <= noseHalf && v >= noseBottom && v < noseBottom + 0.14)
          g.set(x, y, fz + 1, v < noseBottom + 0.055 ? k.shade : k.skin);
        else if (full && v < mouthHeight - 0.01 && au <= 0.8 && beardFront[x + g.w * y]) g.set(x, y, fz + 1, k.hair);
      }
  }
  return g;
}
