# Figür motoru v2, Plan 1: motor, yeni figür ve boyutlar

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Figür motorunu plaka çözünürlüğüne taşımak. Parametrik stilize yüzle yeni figür üretmek. Müşteriye üç boyut seçeneği sunmak. Önizlemeyi etkin parça kataloğuyla, fiyatı sunucudan hesaplamak.

**Architecture:** Voksel ızgarasında dikey birim artık plaka (3,2 mm). Figür, tamsayı seviyelerden oluşan `FigureDesign` v2'den deterministik olarak üretilir. Döşeme (packer) yalnızca katalogda açık olan parça ve renk kalemlerini kullanır. Tuğla 3 plaka yüksekliğinde sayılır. Sunucu kataloğu `data/inventory.json`'dan okur ve `/api/catalog` ile dağıtır. Fiyat yalnızca `/quote`'tan gelir. Tarayıcı modeli bir Web Worker'da üretir.

**Tech Stack:** TypeScript, React 19, three.js, Express 5, Vitest. Mevcut repo.

**Spec:** `docs/superpowers/specs/2026-11-06-figur-motoru-ve-stok-design.md`. Spec'in 10. bölümündeki 1. ve 2. aşamaları ve 5. bölümdeki fiyat ve kişisel veri kararlarını kapsar. Fotoğraf analizi ve müşterinin yüz düzeltme kontrolleri Plan 2'de, stok ve alışveriş planı Plan 3'te. Bu plan bittiğinde yüz parametreleri varsayılan değerlerde kalır. Fotoğraftan doldurulmaları Plan 2'nin işi.

**Prototip:** `docs/superpowers/specs/2026-11-06-figur-prototip.html`. Kafa, yüz ve gövde formülleri buradan taşınır. Aşağıda yalnızca prototipten farklı olanlar yazılıdır.

## Global Constraints

- Teknolojiler aynı kalır: TypeScript, React, three.js, Express, dosya tabanlı JSON depolama, Docker ile VPS. Yeni çalışma zamanı bağımlılığı eklenmez.
- Motor istemcide ve sunucuda birebir aynı sonucu vermelidir. Aynı tasarım ve aynı katalog her zaman aynı parçaları üretir. `Math.random` kullanılmaz, yalnızca tohumlu RNG.
- Maliyet yapısı (`partCost`, `markup`) tarayıcıya gönderilmez. Tarayıcı fiyatı hiçbir zaman kendisi hesaplamaz.
- Repo herkese açık. Kişisel fotoğraflar ve sahibinin yüzünden türetilen görseller (render, ekran görüntüsü) repoya konmaz.
- Telefon performansı: en büyük boyut orta seviye bir telefonda yaklaşık 1 saniyede üretilmeli. 1200 parçalık model akıcı gösterilmeli.
- `ENGINE_VERSION = 2`. Eski siparişler kayıtlı `bricks`/`bom` ile aynen kalır ve kılavuzları çalışmaya devam eder (eski görüntüleme yolu korunur).
- Eski tuğla kimlikleri (`1x1`, `1x2`, `1x3`, `1x4`, `1x6`, `2x2`, `2x3`, `2x4`) aynı tuğlaları göstermeye devam eder.
- Yüz kuralları:
  - kapalı göz çizilmez
  - kaşlar hiçbir boyutta birleşmez
  - nötr ifadede kaşın iç ucunun üst kenarı, dış ucunun üst kenarından en fazla 1 plaka yüksekte olabilir
  - kaynağı tasarımda olmayan bir ifade çizilmez
- Arayüz metinleri Türkçe ve mevcut "sen" hitabıyla yazılır.
- Doğrulama komutları: `npm test`, `npm run typecheck`, `npm run build`.

## Review Focus

1. **Eski taslak ve eski siparişler.** Tarayıcıda v1 biçiminde kayıtlı bir taslak ya da sunucuda v1 sipariş olabilir. Taslak sessizce v2'ye çevrilmeli. Eski siparişin kılavuzu bozulmadan açılmalı. Testler: Görev 3 (`v1 tasarımı v2ye çevrilir`), Görev 8 (`eski (v1) sipariş kılavuzu bozulmadan döner`), Görev 9 (eski geometri testi).
2. **Katalogda kapatılmış renk ya da kaide.** Müşterinin taslağındaki renk sonradan kapatılmış olabilir. En yakın açık renge düşülmeli. Hiç kaide plakası açık değilse model kaidesiz üretilmeli, hata vermemeli. Testler: Görev 7 (`kaide plakası kapalıysa model kaidesiz üretilir`), Görev 8 (kapatılan kırmızı).
3. **Asimetrik ifade.** Bir kaş kalkık, diğeri çatık olabilir. Kaşlar yine birleşmemeli, model tek parça kalmalı. Test: Görev 4 (birleşmeme testi asimetrik ifadeyi de dener).
4. **En ağır kombinasyon.** Büyük boyut, kabarık saç, dolgun sakal, gözlük, etek, açık gülümseme birlikte. Model tek parça olmalı ve performans bütçesinde kalmalı. Test: Görev 7.
5. **Hızlı ardışık düzenleme.** Kaydırıcıyla hızlı değişikliklerde eski worker ya da teklif yanıtı yenisinin üstüne yazılmamalı. Test: Görev 10 (`latest` yardımcısı).

---

### Görev 1: Parça listesi ve katalog

**Files:**
- Modify: `src/engine/parts.ts`
- Create: `src/engine/catalog.ts`, `src/engine/catalog.test.ts`

**Interfaces:**
- Produces:
  - `parts.ts`:
    - `type PartKind = 'brick' | 'plate' | 'baseplate'`
    - `interface PartType { id: string; kind: PartKind; name: string; w: number; l: number; h: 1 | 3; ref: string }`
    - `BRICKS`, `PLATES`, `BASEPLATES`, `PARTS` (= tuğla + plaka, döşenebilir parçalar)
    - `getPart(id): PartType` (tüm listeler, bilinmeyen kimlikte hata verir)
    - `partForFootprint(sx, sz, kind: 'brick' | 'plate'): PartType | undefined`
    - `STUD_MM`, `BRICK_H_MM`, `PLATE_H_MM` değişmeden kalır. `BASE_PLATE` kaldırılır.
  - `catalog.ts`:
    - `interface Catalog { readonly enabled: ReadonlySet<string> }`
    - `catalogKey(partId, colorId): string`. Biçim: `` `${partId}|${colorId}` ``.
    - `createCatalog(keys: Iterable<string>): Catalog`. Bilinmeyen parça ya da renk içeren anahtarları atar.
    - `defaultCatalog(): Catalog`
    - `isEnabled(c, partId, colorId): boolean`
    - `enabledColors(c): string[]`. Palet sırasıyla, `p1x1` açık olan renkler.
    - `footprints(c, colorId, kind: 'brick' | 'plate'): PartType[]`. Alana göre büyükten küçüğe sıralı. `colorId === FILLER_ID` ise herhangi bir renkte açık olan parçalar.
    - `catalogProblems(c): string[]`
    - `nearestEnabledColor(c, colorId, group?: ColorGroup): string`

- [ ] **Adım 1: Bağımlılıkları kur, mevcut testlerin geçtiğini gör**

  Komut: `npm ci && npm test`
  Beklenen: tüm testler PASS.

- [ ] **Adım 2: Başarısız testleri yaz (`src/engine/catalog.test.ts`)**

```ts
it('varsayılan katalog sorunsuzdur ve temel renkleri içerir', () => {
  const c = defaultCatalog();
  expect(catalogProblems(c)).toEqual([]);
  expect(enabledColors(c)).toEqual(expect.arrayContaining(['lightNougat', 'darkBrown', 'darkBlue']));
  expect(isEnabled(c, 'plate16x16', 'darkGray')).toBe(true);
});
it('bilinmeyen anahtarlar atılır', () => {
  expect(createCatalog(['p1x1|red', 'zz|red', 'p1x1|neon']).enabled.size).toBe(1);
});
it('footprints yalnızca açık parçaları büyükten küçüğe döner', () => {
  const c = createCatalog(['p1x1|red', 'p2x4|red', 'p1x2|blue']);
  expect(footprints(c, 'red', 'plate').map((p) => p.id)).toEqual(['p2x4', 'p1x1']);
  expect(footprints(c, FILLER_ID, 'plate').map((p) => p.id)).toEqual(['p2x4', 'p1x2', 'p1x1']);
  expect(footprints(c, 'red', 'brick')).toEqual([]);
});
it('1x1 plakası olmayan renk sorun olarak bildirilir', () => {
  const p = catalogProblems(createCatalog(['p2x4|red']));
  expect(p).toHaveLength(1);
  expect(p[0]).toContain('Kırmızı');
});
it('kapalı renk en yakın açık renge düşer', () => {
  const c = createCatalog(['p1x1|black', 'p1x1|white']);
  expect(nearestEnabledColor(c, 'darkGray')).toBe('black');
  expect(nearestEnabledColor(c, 'white')).toBe('white');
});
```

- [ ] **Adım 3: Testin başarısız olduğunu gör**

  Komut: `npx vitest run src/engine/catalog.test.ts`
  Beklenen: FAIL (modül yok).

- [ ] **Adım 4: `parts.ts`'i yeniden yaz**

  - **Tuğlalar** (`h: 3`, ad `Tuğla AxB`). Kimlik ve parça numarası:
    - `1x1` 3005
    - `1x2` 3004
    - `1x3` 3622
    - `1x4` 3010
    - `1x6` 3009
    - `2x2` 3003
    - `2x3` 3002
    - `2x4` 3001
  - **Plakalar** (`h: 1`, ad `Plaka AxB`). Kimlik ve parça numarası:
    - `p1x1` 3024
    - `p1x2` 3023
    - `p1x3` 3623
    - `p1x4` 3710
    - `p1x6` 3666
    - `p2x2` 3022
    - `p2x3` 3021
    - `p2x4` 3020
  - **Kaide plakaları** (`h: 1`, ad `Plaka AxB (kaide)`). Kimlik, parça numarası ve boyut:
    - `plate8x8` 41539, 8×8
    - `plate8x16` 92438, 8×16
    - `plate16x16` 91405, 16×16
  - `w` her zaman kısa kenardır.

- [ ] **Adım 5: `catalog.ts`'i yaz**

  - **`defaultCatalog`:** Şeffaf hariç her palet rengi için tüm `PARTS`. `transClear` için yalnızca `p1x1` ve `1x1`. `colorsInGroup('base')` renklerinde tüm `BASEPLATES`.
  - **`catalogProblems`:** Bir rengin herhangi bir parçası açık ama `p1x1` kapalıysa `` `"${renkAdı}" için 1x1 plaka açık değil` `` mesajı döner.
  - **`nearestEnabledColor`:** Renk açıksa kendisini döner. Değilse `enabledColors` içinden Lab uzaklığı en küçük olanı döner. `group` verilmişse ve o gruptan açık renk varsa yalnızca o gruptan seçer. Lab uzaklığı için `palette.ts`'teki `rgbToLab`, `hexToRgb` ve `labDistance` kullanılır.

- [ ] **Adım 6: Testlerin geçtiğini gör**

  Komut: `npx vitest run src/engine/catalog.test.ts`
  Beklenen: PASS. `npm test`'teki eski motor testleri `BASE_PLATE` yüzünden derlenmeyebilir. Görev 7'de yeniden yazılacaklar, bu görevde dokunma.

- [ ] **Adım 7: Commit**

```bash
git add src/engine/parts.ts src/engine/catalog.ts src/engine/catalog.test.ts
git commit -m "Motor: plaka ve kaide parçaları, etkin parça kataloğu

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Görev 2: Plaka ve tuğla döşeme

**Files:**
- Rewrite: `src/engine/packer.ts`
- Create: `src/engine/packer.test.ts`

**Interfaces:**
- Consumes: `Catalog`, `footprints`, `isEnabled` (Görev 1); `VoxelGrid`, `WILDCARD`, `EMPTY`, `colorIdFromCode` (`voxels.ts`).
- Produces:
  - `interface Brick`: bugünkü alanlar, artı `h?: number`. Yükseklik plaka birimindedir: 1 plaka, 3 tuğla. v1 siparişlerinde bu alan yoktur. v2'de `y` parçanın en alt plaka katıdır. `plate?: true` yalnızca kaide plakası içindir.
  - `interface PackResult { bricks: Brick[]; components: number; looseBricks: number }`
  - `packBricks(grid: VoxelGrid, catalog: Catalog, attempts = 12): PackResult`. Izgaranın `y` birimi plakadır.

- [ ] **Adım 1: Başarısız testleri yaz (`src/engine/packer.test.ts`)**

  Testler, renk kimliklerinden `VoxelGrid` kuran küçük bir `gridFrom(w, h, d, fn)` yardımcısını kullanır. Kapsama kontrolü bugünkü `engine.test.ts`'teki gibidir: her dolu hücre tam bir kez kaplanır, renk tutar, `WILDCARD` hücreler `FILLER_ID` olur.

```ts
const restricted = createCatalog(PALETTE.flatMap((c) => ['p1x1', 'p1x2', 'p2x2', '1x2', '2x2'].map((p) => catalogKey(p, c.id))));
it('her hücreyi tam bir kez, doğru renkle ve yalnızca açık parçalarla kaplar', () => {
  for (const cat of [defaultCatalog(), restricted])
    for (const g of [solidBox('red', 6, 9, 5), stripedBox(['red', 'white'], 6, 9, 4), boxWithHiddenCore('blue', 6, 9, 6)]) {
      const r = packBricks(g, cat);
      expectExactCover(g, r.bricks);
      for (const b of r.bricks)
        if (b.color !== FILLER_ID) expect(isEnabled(cat, b.part, b.color)).toBe(true);
        else expect(footprints(cat, FILLER_ID, getPart(b.part).kind as 'brick' | 'plate').some((p) => p.id === b.part)).toBe(true);
    }
});
it('tuğlalar kurs başında ve 3 katı da uyumlu hücrelerde', () => {
  const g = stripedBox(['red', 'white'], 6, 9, 4);
  for (const b of packBricks(g, defaultCatalog()).bricks.filter((b) => b.h === 3)) {
    expect(b.y % 3).toBe(0);
    expectUniformColumn(g, b);
  }
});
it('düz kutu ve çıkıntılı T şekli tek parça', () => {
  for (const g of [solidBox('red', 6, 12, 4), tShape('red')]) {
    const r = packBricks(g, defaultCatalog());
    expect(r.looseBricks).toBe(0);
    expect(r.components).toBe(1);
  }
});
it('deterministiktir', () => {
  const g = tShape('red');
  expect(packBricks(g, defaultCatalog()).bricks).toEqual(packBricks(g, defaultCatalog()).bricks);
});
it('desteksiz parça üstündeki parçayla aynı adımda takılır', () => {
  // 0-3. katlar: x0-1, z0-1 sütun. 3. kat: ayrıca (3,0) tek hücre. 4. kat: x0-3, z0-1.
  const r = packBricks(overhangGrid(), defaultCatalog());
  const lone = r.bricks.find((b) => b.y === 3 && b.x === 3)!;
  const above = r.bricks.find((b) => b.y === 4 && b.x <= 3 && b.x + b.sx > 3)!;
  expect(lone.hanging).toBe(true);
  expect(lone.step).toBe(above.step);
});
it('katalogda karşılığı olmayan renkte hata verir', () => {
  expect(() => packBricks(solidBox('red', 2, 2, 2), createCatalog(['p1x1|blue']))).toThrow(/1x1 plaka/);
});
```

- [ ] **Adım 2: Testin başarısız olduğunu gör**

  Komut: `npx vitest run src/engine/packer.test.ts`
  Beklenen: FAIL.

- [ ] **Adım 3: `packBricks`'i yaz**

  Bugünkü döşeme yapısı korunur: tarama dönüşümleri (`Transform`), puanlama, `mulberry32`, birden fazla deneme ve onarım döngüsü. Değişenler:

  1. **Kurslar:** Katlar 3'erli kurslara bölünür (`y0 = 3c`). Her kursta önce tuğla geçişi, sonra kurstaki her kat için plaka geçişi yapılır.
  2. **Tuğla geçişi:** Yalnızca kursun 3 katı da ızgara içindeyse ve `useBricks` açıksa yapılır. Bir hücreye tuğla konabilmesi için 3 katta da dolu olması ve renklerin uyumlu olması gerekir (`WILDCARD` hariç hepsi aynı renk). Uygun hücreler `footprints(c, renk, 'brick')` ile, `packLayer`'daki puanlamayla doldurulur. Puanlamada "alttaki" kat `y0 - 1`'dir.
  3. **Plaka geçişi:** Tuğlaların almadığı hücreler `footprints(c, renk, 'plate')` ile doldurulur. "Alttaki" kat `y - 1`'dir.
  4. **Sahiplik haritaları:** Her katın `Int32Array` sahiplik haritası global parça indeksini tutar. Bir tuğla 3 katta aynı indeksle görünür.
  5. **Bağlantı:** Ardışık iki katta aynı hücrede farklı iki parça varsa bu iki parça birleşmiş sayılır (union-find). Maliyet fonksiyonu bugünküyle aynıdır.
  6. **Denemeler:** `attempts` kadar tohum denenir. `seed % 3 === 2` olan denemeler `useBricks = false` ile çalışır. Onarım döngüsü (en fazla 200 tur) kopuk parça içeren kursları ve komşularını rastgele dönüşümle, %50 olasılıkla `useBricks = false` olarak yeniden döşer. Maliyet düşerse yeni hal kabul edilir.
  7. **Hata:** Bir hücre için hiç plaka yoksa `` `Katalogda ${colorId} için 1x1 plaka yok` `` hatası verilir.
  8. **Adımlar:**
     - Aşağıdan yukarıya: `y === 0` olan ya da hemen altındaki (üst katı `y - 1` olan) örtüşen bir parçası desteklenmiş olan parça desteklenmiştir. Desteklenen parçanın adımı `Math.floor(y / 3)`.
     - Yukarıdan aşağıya: desteklenmeyen parça, hemen üstündeki (alt katı `y + h` olan) örtüşen parçaların en küçük adımını alır ve `hanging = true` olur.
     - Kalanların adımı `Math.floor(y / 3)`.
     - Sonuç adım, `y`, `z`, `x` sırasına dizilir, `id`'ler baştan verilir.

- [ ] **Adım 4: Testlerin geçtiğini gör**

  Komut: `npx vitest run src/engine/packer.test.ts`
  Beklenen: PASS.

- [ ] **Adım 5: Commit**

```bash
git add src/engine/packer.ts src/engine/packer.test.ts
git commit -m "Motor: plaka ve tuğla karışık, kataloğa bağlı döşeme

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Görev 3: Tasarım verisi v2

**Files:**
- Create: `src/engine/figure/design.ts`, `src/engine/figure/design.test.ts`

Not: `src/engine/figure.ts` Görev 6'ya kadar yerinde kalır. Yeni klasörü yalnızca testler doğrudan dosya yoluyla (`./figure/design`) içe aktarır.

**Interfaces:**
- Consumes: `Catalog`, `nearestEnabledColor`, `isEnabled` (Görev 1); `isColorId`, `ColorGroup` (`palette.ts`).
- Produces:
  - Boyut sabitleri:
    - `SIZES = ['S', 'M', 'L'] as const`, `type FigureSize`
    - `SIZE_LABELS = { S: 'Küçük', M: 'Orta', L: 'Büyük' }`
    - `HEAD_WIDTH = { S: 8, M: 12, L: 16 }`
    - `BASEPLATE_FOR_SIZE = { S: 'plate8x8', M: 'plate8x16', L: 'plate16x16' }`
  - Seçenek listeleri:
    - `HAIR_STYLES` ve `BOTTOM_STYLES`: bugünkü değerler ve etiketler.
    - `FACIAL_HAIR = ['none', 'mustache', 'goatee', 'shortBeard', 'fullBeard'] as const`. Etiketler: `Yok`, `Bıyık`, `Keçi sakal`, `Kısa sakal`, `Dolgun sakal`.
  - Yüz ölçekleri:
    - `FACE_SCALE: Record<keyof FaceParams, { values: readonly number[]; def: number }>`. Tablo aşağıda.
    - `interface FaceParams`: tablodaki her anahtar, değeri bir seviye (indeks).
  - İfade:
    - `interface ExpressionParams { smile: number; browRaiseL: number; browRaiseR: number; eyeOpen: number }`
    - Aralıklar: `smile` 0–3 (varsayılan 0), `browRaise*` −1–2 (varsayılan 0), `eyeOpen` 0–2 (varsayılan 1). `eyeOpen` 0 kısık göz demektir, kapalı göz yoktur.
  - `interface FigureDesign`: v1 alanlarının hepsi, artı şunlar:
    - `size: FigureSize`
    - `hairline: number` (0–2, varsayılan 1)
    - `beardLine: number` (0–2, varsayılan 1)
    - `face: FaceParams`
    - `expression: ExpressionParams`
    - `collar: boolean` (varsayılan `false`)
    - `jacketOpen: boolean` (varsayılan `true`)
    - `facialHair` artık yeni `FacialHair` tipinde.
  - `DEFAULT_DESIGN`: v1 varsayılanları, `size: 'M'`, tüm yüz seviyeleri `def`.
  - `sanitizeDesign(input: unknown, catalog?: Catalog): FigureDesign`
  - `faceValue(design, key): number`. Seviyenin karşılığı olan normalize değeri döner.

  **FACE_SCALE.** Değerler normalize birimdedir: `u` kafa genişliğinde −1 ile 1 arası, `v` çene altında 0, kafa tepesinde 1. Varsayılanlar prototipteki değerlerdir.

| Anahtar | values | def | Anlamı |
| --- | --- | --- | --- |
| `browHeight` | 0.715, 0.73, 0.745, 0.76, 0.775 | 2 | Kaşın iç ucunun `v` değeri |
| `browTilt` | −0.03, −0.015, 0, 0.015, 0.03 | 2 | Dış uç eksi iç uç (`v`). Negatif: dış uç aşağıda |
| `browThickness` | 0.02, 0.026, 0.034 | 1 | İç uçta yarım kalınlık (`v`) |
| `browGap` | 0.12, 0.16, 0.22 | 1 | İç ucun `|u|` değeri |
| `eyeHeight` | 0.55, 0.575, 0.6, 0.625, 0.65 | 2 | Göz merkezinin `v` değeri |
| `eyeSpacing` | 0.34, 0.40, 0.46 | 1 | Göz merkezinin `|u|` değeri |
| `eyeWidth` | 0.15, 0.185, 0.22 | 2 | Gözün yarı genişliği (`u`) |
| `noseBottom` | 0.42, 0.445, 0.47, 0.495 | 1 | Burun alt ucunun `v` değeri |
| `noseWidth` | 0.16, 0.22, 0.28 | 1 | Burnun `|u|` değeri |
| `mouthHeight` | 0.29, 0.32, 0.345, 0.37 | 2 | Dudak çizgisinin `v` değeri |
| `mouthWidth` | 0.22, 0.28, 0.34 | 1 | Ağzın `|u|` değeri |
| `chinTaper` | 0.3, 0.5, 0.7 | 1 | Çene daralması |
| `crownRound` | 0.82, 0.78, 0.74 | 1 | Kubbenin başladığı `v` |
| `earHeight` | 0.38, 0.42, 0.46 | 1 | Kulak merkezinin `v` değeri |

- [ ] **Adım 1: Başarısız testleri yaz**

```ts
it('v1 tasarımı v2ye çevrilir', () => {
  const d = sanitizeDesign({ facialHair: 'beard', hairStyle: 'bald', shirtColor: 'blue' });
  expect(d.facialHair).toBe('fullBeard');
  expect(d.size).toBe('M');
  expect(d.face).toEqual(DEFAULT_DESIGN.face);
  expect(d.shirtColor).toBe('blue');
});
it('seviyeler sınırlanır ve tamsayıya yuvarlanır', () => {
  const d = sanitizeDesign({ face: { browTilt: 99, eyeWidth: -3, noseWidth: 1.6 } });
  expect([d.face.browTilt, d.face.eyeWidth, d.face.noseWidth]).toEqual([4, 0, 2]);
});
it('ifade aralıkları uygulanır', () => {
  const d = sanitizeDesign({ expression: { smile: 7, browRaiseL: -5, eyeOpen: 0 } });
  expect(d.expression).toEqual({ smile: 3, browRaiseL: -1, browRaiseR: 0, eyeOpen: 0 });
});
it('geçersiz boyut varsayılana döner', () => {
  expect(sanitizeDesign({ size: 'XL' }).size).toBe('M');
});
it('katalogda kapalı renk aynı gruptaki en yakın açık renge düşer', () => {
  const keys = ['black', 'white', 'lightNougat', 'darkBrown', 'darkBlue'].map((c) => catalogKey('p1x1', c));
  const d = sanitizeDesign({ skin: 'nougat', shirtColor: 'blue' }, createCatalog(keys));
  expect(d.skin).toBe('lightNougat');
  expect(d.shirtColor).toBe('darkBlue');
});
```

- [ ] **Adım 2: Testin başarısız olduğunu gör**

  Komut: `npx vitest run src/engine/figure/design.test.ts`
  Beklenen: FAIL.

- [ ] **Adım 3: `design.ts`'i yaz**

  Renk alanları ve grupları:
  - `skin` → `skin`
  - `hairColor` → `hair`
  - `glassesColor` → `detail`
  - `shirtColor`, `jacketColor`, `bottomColor`, `shoeColor` → `clothes`
  - `baseColor` → `base`

  Kaide kuralı: `catalog` verilmişse ve boyutun kaide plakası `baseColor` renginde kapalıysa, o plakanın açık olduğu ilk palet rengi seçilir. Hiçbir renkte açık değilse `base = false` yapılır.

- [ ] **Adım 4: Testlerin geçtiğini gör**

  Komut: `npx vitest run src/engine/figure/design.test.ts`
  Beklenen: PASS.

- [ ] **Adım 5: Commit**

```bash
git add src/engine/figure/design.ts src/engine/figure/design.test.ts
git commit -m "Motor: seviyeli tasarım verisi v2 (boyut, yüz, ifade)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Görev 4: Kafa, yüz, ifade ve yüz kılı

**Files:**
- Create: `src/engine/figure/head.ts`, `src/engine/figure/head.test.ts`
- Modify: `src/engine/voxels.ts`. `frontView` eklenir.

**Interfaces:**
- Consumes: `FigureDesign`, `FACE_SCALE`, `faceValue`, `HEAD_WIDTH` (Görev 3); `VoxelGrid`, `colorCode`.
- Produces:
  - `voxels.ts`: `frontView(g: VoxelGrid): Int16Array`. Boyutu `w * h`. Her `(x, y)` için en öndeki dolu hücrenin kodunu, boşsa `EMPTY` döner.
  - `head.ts`:
    - `interface HeadDims { W: number; D: number; H: number }`
    - `headDims(size): HeadDims`. Formül: `W = HEAD_WIDTH`, `D = W - 2`, `H = Math.round(W * 3.125)`.
    - `HEAD_ORIGIN = { x: 1, z: 1 }`. Kafa ızgarada `x ∈ [1, W]`, `y ∈ [0, H-1]`, `z ∈ [1, D]` aralığında durur.
    - `buildHead(design): VoxelGrid`. Izgara boyutu: `w = W + 2`, `h = H + Math.ceil(H * 0.15)`, `d = D + 2`. Kulaklar `x = 0` ve `x = W + 1`'de. Öne çıkan burun ve sakal `z = D + 1`'de. Üstteki boşluk saç içindir.
    - `skinShade(skin): string`. Eşleme: `lightNougat→nougat`, `nougat→mediumNougat`, `tan→nougat`, `mediumNougat→reddishBrown`, `reddishBrown→darkBrown`, `darkBrown→black`.

- [ ] **Adım 1: Başarısız testleri yaz**

  Test yardımcıları `head.test.ts` içinde yazılır. Hepsi `face(d) = frontView(buildHead(d))` ve satır `v = (y + 0.5) / H` üzerinden çalışır. Sütunlar kafa sütunlarıdır (`x ∈ [1, W]`).
  - `centerColumnsHairAbove(d, v0)`: iki orta sütunda, `v >= v0` olan satırlardan herhangi birinde `hairColor` var mı.
  - `browInnerTop(d, side)` / `browOuterTop(d, side)`: o tarafta kaş rengi içeren en içteki / en dıştaki sütunda, kaş hücresi olan en üst satırın `y` değeri. Kaş hücreleri `v > eyeHeight + 0.05` olan `hairColor` hücreleridir.
  - `countSide(face, d, color, side)`: o yarıdaki (`L` = sol yarı) renk sayısı.
  - `mouthCornerTop(d)`: dudak çizgisi renginin, `|u| > 0.6 * mouthWidth` olan sütunlardaki en üst satırı.
  - `whiteInMouth(d)`: `v ∈ [mouthHeight − 0.06, mouthHeight + 0.03]` ve `|u| <= mouthWidth` bölgesinde beyaz var mı.
  - `hairCellsBelow(d, v0)`: ön yüzde `v < v0` olan `hairColor` sayısı.
  - `hairOnlyBetween(d, 'mouth', 'nose')`: `v < eyeHeight` olan bütün `hairColor` ön hücreleri `[mouthHeight, noseBottom)` aralığında mı.
  - `hasCellAtZ(g, z, color)`: o `z` değerinde bu renkte bir hücre var mı.

```ts
it('boyutlara göre kafa ölçüleri', () => {
  expect(headDims('S')).toEqual({ W: 8, D: 6, H: 25 });
  expect(headDims('M')).toEqual({ W: 12, D: 10, H: 38 });
  expect(headDims('L')).toEqual({ W: 16, D: 14, H: 50 });
});
it('kaşlar hiçbir boyutta ve ayarda birleşmez (asimetrik ifade dahil)', () => {
  for (const size of SIZES)
    for (const browGap of [0, 1, 2])
      for (const browThickness of [0, 1, 2])
        for (const [browRaiseL, browRaiseR] of [[0, 0], [2, -1], [-1, 2]]) {
          const d = sanitizeDesign({ size, hairStyle: 'bald', facialHair: 'none', face: { browGap, browThickness }, expression: { browRaiseL, browRaiseR } });
          // iki orta sütun, v >= 0.6 satırlarında hiçbir zaman kaş (saç rengi) değildir
          expect(centerColumnsHairAbove(d, 0.6)).toBe(false);
        }
});
it('nötr ifadede kaşın iç ucu dış ucundan en fazla 1 plaka yüksektir', () => {
  for (const size of SIZES)
    for (const browTilt of [2, 3, 4]) {
      const d = sanitizeDesign({ size, hairStyle: 'bald', face: { browTilt } });
      for (const side of ['L', 'R'] as const) expect(browInnerTop(d, side) - browOuterTop(d, side)).toBeLessThanOrEqual(1);
    }
});
it('gözler her boyutta ve açıklıkta görünür', () => {
  for (const size of SIZES)
    for (const eyeOpen of [0, 1, 2]) {
      const d = sanitizeDesign({ size, expression: { eyeOpen } });
      expect(countSide(face(d), d, 'black', 'L')).toBeGreaterThan(0);
      expect(countSide(face(d), d, 'black', 'R')).toBeGreaterThan(0);
    }
});
it('farklı yüz ayarları farklı yüz üretir', () => {
  const base = face(sanitizeDesign({}));
  for (const f of [{ eyeSpacing: 0 }, { mouthWidth: 2 }, { browHeight: 4 }, { noseBottom: 3 }])
    expect(face(sanitizeDesign({ face: f }))).not.toEqual(base);
});
it('gülümseme ağız köşelerini kaldırır', () => {
  const corner = (smile: number) => mouthCornerTop(sanitizeDesign({ size: 'M', expression: { smile } }));
  expect(corner(2)).toBeGreaterThan(corner(0));
});
it('açık gülümsemede dişler yalnızca orta ve büyük boyutta görünür', () => {
  expect(whiteInMouth(sanitizeDesign({ size: 'M', expression: { smile: 3 } }))).toBe(true);
  expect(whiteInMouth(sanitizeDesign({ size: 'S', expression: { smile: 3 } }))).toBe(false);
});
it('yüz kılı türleri', () => {
  const m = (facialHair: string) => sanitizeDesign({ size: 'M', hairStyle: 'bald', facialHair });
  expect(hairCellsBelow(m('none'), 0.55)).toBe(0);
  expect(hairOnlyBetween(m('mustache'), 'mouth', 'nose')).toBe(true);
  expect(hairCellsBelow(m('fullBeard'), 0.2)).toBeGreaterThan(0);
  expect(hasCellAtZ(buildHead(m('fullBeard')), headDims('M').D + 1, m('fullBeard').hairColor)).toBe(true);
});
```

- [ ] **Adım 2: Testin başarısız olduğunu gör**

  Komut: `npx vitest run src/engine/figure/head.test.ts`
  Beklenen: FAIL.

- [ ] **Adım 3: `buildHead`'i yaz**

  Prototipteki `buildHead`, `faceFeature`, `beardTop` ve kulak kodu taşınır. Prototipteki sabit sayıların yerini `FACE_SCALE` değerleri alır.

  Prototipten farklı olanlar:
  - **Kafa şekli:** Kubbe `crownRound`'ta başlar. Çene daralması `hw = 1 - chinTaper * t²` formülüyle hesaplanır.
  - **Kaş:** Her taraf ayrı çizilir. Taraf `L`, `u < 0` olan taraftır.
    - `t = (a - inner) / (0.80 - inner)`
    - `vc = browHeight + 0.018 * sin(π * min(1, 1.25t)) + browTilt * t + raise(t)`
    - `th = browThickness - 0.006t`
    - `raise(t)`: `−1 → −0.02(1−t)`, `0 → 0`, `1 → 0.02 + 0.01(1−t)`, `2 → 0.035 + 0.02(1−t)`
  - **Kaş boşluğu:** Bir hücrenin kaş olabilmesi için `a >= max(inner, 1.5 / W)` olmalı. Bu, iki orta sütunun hiçbir zaman kaş olmamasını garanti eder.
  - **Küçük boyutta kaş:** `W < 12` ve o tarafın `browRaise` değeri 0 ise kavis ve eğim uygulanmaz, `vc = browHeight` olur.
  - **Göz:** Merkez `eyeSpacing`, yarı genişlik `eyeWidth`. Yarı yükseklik `eyeOpen`'a göre `[0.018, 0.028, 0.04]`. Bant hiçbir satırın merkezine denk gelmiyorsa en yakın satır göz yapılır.
    - `W < 12`: `|a - eyeSpacing| <= 0.6 * eyeWidth` olan hücreler siyah.
    - `W >= 12`: iris siyah (`<= 0.45 * eyeWidth`), kalanı beyaz. Üst kapakta bir satır `skinShade` olur.
  - **Burun:** Alt yüzey `v ∈ [noseBottom, noseBottom + 0.055)`, `a <= noseWidth`, renk `skinShade`. `W >= 12` ise burun öne çıkar: `a <= max(1/W, noseWidth − 0.02)` ve `v ∈ [noseBottom, noseBottom + 0.14)`.
  - **Ağız:**
    - Alt dudak: `v ∈ [mouthHeight − 0.045, mouthHeight)`, renk `skinShade`.
    - Dudak çizgisi: `[mouthHeight, mouthHeight + 0.028)`. Renk `reddishBrown`; ten `reddishBrown` ya da `darkBrown` ise `black`.
    - Ağız en son çizilir, sakal ağzı kapatmaz.
  - **Gülümseme:**
    - `smile 1`: `a > 0.6 * mouthWidth` olan köşe sütunlarında çizgi 1 satır yukarı kalkar.
    - `smile 2`: köşeler `W >= 12` ise 2 satır, `S`'de 1 satır kalkar. Ağız 0.04 genişler.
    - `smile 3`: `W >= 12` ise `v ∈ [mouthHeight − 0.03, mouthHeight)` ve `a <= 0.8 * mouthWidth` beyaz (dişler). `S` boyutunda `smile 2` gibi çizilir.
  - **Yüz kılı:** Rengi `hairColor`.
    - Bıyık bandı: `v ∈ [mouthHeight + 0.028, noseBottom)`, `a <= mouthWidth + 0.15`.
    - `mustache`: yalnızca bıyık bandı.
    - `goatee`: bıyık bandı, artı `v < mouthHeight − 0.045` ve `a <= mouthWidth + 0.05` olan ön hücreler.
    - `shortBeard`: prototipteki `beardTop`. Eşiklere `beardLine` ile `[−0.05, 0, +0.05]` eklenir.
    - `fullBeard`: `shortBeard`, artı `W >= 12` ise `v < mouthHeight − 0.01` ve `a <= 0.8` olan ön sakal hücrelerinin önüne bir hücre daha eklenir.
  - **Kulak:** Satırlar `v ∈ earHeight ± 0.12`. İçte `v ∈ earHeight ± 0.07` olan hücreler `W >= 12` ise `skinShade`.

- [ ] **Adım 4: Testlerin geçtiğini gör**

  Komut: `npx vitest run src/engine/figure/head.test.ts`
  Beklenen: PASS.

- [ ] **Adım 5: Commit**

```bash
git add src/engine/voxels.ts src/engine/figure/head.ts src/engine/figure/head.test.ts
git commit -m "Motor: parametrik kafa, yüz, ifade ve yüz kılı

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Görev 5: Saç ve gözlük

**Files:**
- Create: `src/engine/figure/hair.ts`, `src/engine/figure/hair.test.ts`

**Interfaces:**
- Consumes: `buildHead`, `headDims`, `HEAD_ORIGIN` (Görev 4).
- Produces:
  - `applyHair(head: VoxelGrid, design: FigureDesign): void`. Izgarayı yerinde değiştirir.
  - `applyGlasses(head: VoxelGrid, design: FigureDesign): void`. Izgarayı yerinde değiştirir.
  - Görev 6, kafayı `applyHair` ve ardından `applyGlasses` ile birlikte kullanır.

- [ ] **Adım 1: Başarısız testleri yaz**

```ts
const head = (o: object) => { const d = sanitizeDesign(o); const g = buildHead(d); applyHair(g, d); applyGlasses(g, d); return { d, g }; };
it('kel ve sakalsız kafaya saç eklenmez (yalnızca kaşlar kalır)', () => {
  const { d, g } = head({ hairStyle: 'bald', facialHair: 'none' });
  expect(count(g, d.hairColor)).toBe(count(buildHead(d), d.hairColor));
});
it('kısa saç: kafa tepesi saç, gözlerin altı saç değil', () => {
  const { d, g } = head({ hairStyle: 'short', facialHair: 'none' });
  expect(topLayerAll(g, d.hairColor)).toBe(true);
  expect(frontHairBelow(g, d, 0.6)).toBe(0);
});
it('saç çizgisi alçaldıkça önde daha çok saç görünür', () => {
  const n = (hairline: number) => frontHairCount(head({ hairStyle: 'short', hairline }));
  expect(n(0)).toBeGreaterThan(n(2));
});
it('topuz kafanın üstüne çıkar', () => {
  const { d, g } = head({ hairStyle: 'bun' });
  expect(maxYOf(g, d.hairColor)).toBeGreaterThanOrEqual(headDims(d.size).H);
});
it('gözlük çerçevesi gözleri kapatmaz', () => {
  const a = head({ glasses: false });
  const b = head({ glasses: true, glassesColor: 'red' });
  expect(count(b.g, 'black')).toBe(count(a.g, 'black'));
  expect(count(b.g, 'red')).toBeGreaterThan(0);
});
```

- [ ] **Adım 2: Testin başarısız olduğunu gör**

  Komut: `npx vitest run src/engine/figure/hair.test.ts`
  Beklenen: FAIL.

- [ ] **Adım 3: `applyHair` ve `applyGlasses`'ı yaz**

  `vh = [0.80, 0.84, 0.88][hairline]` ön saç çizgisinin yüksekliğidir. Açı ve normalize koordinatlar Görev 4'tekiyle aynıdır.
  - **`short`:** Saç olan yüzey hücreleri:
    - önde (`a < 60°`) `v >= vh`
    - yanlarda (`60°–120°`) `v >= 0.62`
    - arkada (`> 120°`) `v >= 0.30`
  - **`medium`:** `short`, artı `a > 75°` olan yan ve arka yüzeyde `v >= 0.05`.
  - **`long`:** kafada `medium` ile aynı. Sırttaki saç paneli Görev 6'da eklenir.
  - **`bun`:** `short`, artı kafa tepesinin üstünde bir topuz. Genişliği `round(0.35W)`, derinliği `round(0.35D)`, yüksekliği `ceil(0.08H)`. Merkezi `z` ekseninde orta ile arka arasında.
  - **`volume`:** `short`, artı saç hücrelerinin dışındaki ve `v >= 0.45` olan boş komşulara bir kat daha saç.
  - **`bald`:** saç eklenmez.
  - **Gözlük:** Kendi renginde. Her gözün etrafında bir hücre kalınlığında çerçeve, ortada köprü, iki yanda göz satırında kulağa kadar uzanan sap. Şeffaf cam kullanılmaz. Göz hücrelerinin üzerine çizilmez. Saç ve gözlük, kaş hücrelerini değiştirmez.

- [ ] **Adım 4: Testlerin geçtiğini gör**

  Komut: `npx vitest run src/engine/figure/hair.test.ts`
  Beklenen: PASS.

- [ ] **Adım 5: Commit**

```bash
git add src/engine/figure/hair.ts src/engine/figure/hair.test.ts
git commit -m "Motor: yeni çözünürlükte saç modelleri ve gözlük

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Görev 6: Gövde ve figürün birleştirilmesi

**Files:**
- Create: `src/engine/figure/body.ts`, `src/engine/figure/index.ts`, `src/engine/figure/figure.test.ts`
- Delete: `src/engine/figure.ts`
- Modify: `src/engine/voxels.ts`. `paste` eklenir.
- Modify: `src/web/analysis/features.ts`. Yalnızca derlenmesi için: `'beard'` yerine `'fullBeard'` yazılır, `FacialHair` tipi güncellenir.

**Interfaces:**
- Consumes: Görev 3–5.
- Produces:
  - `voxels.ts`: `VoxelGrid.paste(src: VoxelGrid, dx, dy, dz): void`. Kaynaktaki dolu hücreleri kopyalar.
  - `body.ts`:
    - `interface BodyDims { TW; TD; TH; LH; NH; AW; AD }`
    - `bodyDims(size): BodyDims`. Prototipteki `buildFigure` formülleri kullanılır.
  - `figure/index.ts`:
    - `buildFigureVoxels(design): VoxelGrid`. Kaide hariç tüm figür.
    - `design.ts`, `head.ts` ve `body.ts`'in tüm dışa aktarımlarını yeniden dışa aktarır. Bugün `../engine/figure`'dan içe aktaran dosyalar değişmeden derlenir.

- [ ] **Adım 1: Başarısız testleri yaz**

```ts
it('figür yüksekliği (plaka) boyuta göre', () => {
  const h = (size: string) => contentHeight(buildFigureVoxels(sanitizeDesign({ size, hairStyle: 'bald' })));
  expect([h('S'), h('M'), h('L')]).toEqual([52, 79, 104]);
});
it('simetrik tasarım x ekseninde aynadır (hizalama doğru)', () => {
  for (const size of SIZES) {
    const g = buildFigureVoxels(sanitizeDesign({ size, glasses: false, jacket: true, jacketOpen: true }));
    expect(isMirrorX(g)).toBe(true);
  }
});
it('uzun saç sırtta panel oluşturur', () => {
  const d = sanitizeDesign({ hairStyle: 'long' });
  expect(hairBelowHead(buildFigureVoxels(d), d)).toBeGreaterThan(0);
});
it('etek bacaklardan geniştir', () => {
  const d = sanitizeDesign({ bottomStyle: 'skirt', bottomColor: 'red' });
  expect(widthOf(buildFigureVoxels(d), 'red')).toBeGreaterThan(bodyDims(d.size).TW);
});
```

- [ ] **Adım 2: Testin başarısız olduğunu gör**

  Komut: `npx vitest run src/engine/figure/figure.test.ts`
  Beklenen: FAIL.

- [ ] **Adım 3: `body.ts` ve `index.ts`'i yaz, eski `figure.ts`'i sil**

  Prototipteki `buildFigure` taşınır. Farklı olanlar:
  - **Izgara:** Genişlik `W + 2`, derinlik `D + 2`. Gövdenin `z` merkezi kafanın `z` merkezine hizalanır: `z0 = 1 + (D − TD) / 2`.
  - **Katlar:** Alttan yukarı sırasıyla bacaklar, gövde, boyun, kafa (`buildHead` + `applyHair` + `applyGlasses`, `paste` ile).
  - **Alt giyim:**
    - `pants`: bacaklar `bottomColor`.
    - `shorts`: bacakların alt %40'ı ten rengi.
    - `skirt`: bacakların üst %50'si x ekseninde ±1, z ekseninde ±1 genişler.
  - **Üst giyim:**
    - `jacket && jacketOpen`: prototipteki açık ceket.
    - `jacket && !jacketOpen`: gövdenin tamamı ceket rengi, yalnızca boyun V'si açık.
    - `!jacket`: gövdenin tamamı gömlek rengi.
  - **Yaka:** `collar` açıksa en üstte `vt > 0.85` ve `|ut| ∈ [0.12, 0.30]` gömlek rengi olur. `W >= 12` ise bir hücre öne çıkar.
  - **Kollar:** Kol rengi ceket varsa ceket rengi, yoksa gömlek rengi. En alttaki 3 plaka el (ten rengi).
  - **Saç paneli:** `long` için gövdenin arka yüzünde, `x ∈ [x0+1, x0+TW−2]` aralığında, gövdenin üstünden %40 aşağıya kadar saç rengi. `medium` için %15.
  - **Prototipten çıkarılanlar:** etek ve kol ucu bantları. Ek renk getirdikleri için yok.

- [ ] **Adım 4: Testlerin geçtiğini ve derlemenin temiz olduğunu gör**

  Komut: `npx vitest run src/engine/figure && npm run typecheck`
  Beklenen: PASS. Typecheck yalnızca `src/engine/index.ts`, `engine.test.ts` ve web sayfalarındaki `generateModel` ile `model.price` kullanımlarında hata verebilir. Bunlar Görev 7 ve 10'da düzelir.

- [ ] **Adım 5: Commit**

```bash
git add -A src/engine src/web/analysis/features.ts
git commit -m "Motor: chibi gövde, kıyafet ve figür birleştirme; eski şablon kaldırıldı

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Görev 7: Model üretimi v2 ve fiyat

**Files:**
- Modify: `src/engine/index.ts`, `src/engine/bom.ts`, `src/engine/pricing.ts`
- Rewrite: `src/engine/engine.test.ts`

**Interfaces:**
- Consumes: `packBricks` (Görev 2); `buildFigureVoxels`, `sanitizeDesign`, `BASEPLATE_FOR_SIZE` (Görev 3 ve 6).
- Produces:
  - `ENGINE_VERSION = 2`
  - `interface FigureModel { design; dims: { w; h; d }; offset: { x; y; z }; bricks; bom; stats: ModelStats }`. `price` alanı kaldırıldı. `offset`, figür ızgarasının parça koordinatlarındaki başlangıcıdır.
  - `generateModel(input: unknown, catalog: Catalog): FigureModel`
  - `priceFor(bom, cfg)` değişmez.
  - `index.ts` ayrıca `./catalog`'u dışa aktarır.

- [ ] **Adım 1: `engine.test.ts`'i yeniden yaz (başarısız)**

```ts
const cat = defaultCatalog();
const sample = () => SIZES.flatMap((size) => HAIR_STYLES.flatMap((hairStyle, i) => FACIAL_HAIR.map((facialHair, j) => ({
  size, hairStyle, facialHair, glasses: (i + j) % 2 === 0, jacket: j % 2 === 1, bottomStyle: BOTTOM_STYLES[(i + j) % 3], expression: { smile: j % 4 } }))));
it('örnek tasarımlarda model her boyutta tek parça', () => {
  for (const input of sample()) {
    const m = generateModel(input, cat);
    expect(m.stats.looseBricks, JSON.stringify(input)).toBe(0);
    expect(m.stats.components).toBe(1);
  }
}, 180_000);
it('kısıtlı katalogla da tek parça ve yalnızca açık parçalar', () => {
  const keys = PALETTE.flatMap((c) => ['p1x1', 'p1x2', 'p2x2', '1x2', '2x2'].map((p) => catalogKey(p, c.id)))
    .concat(BASEPLATES.map((b) => catalogKey(b.id, 'darkGray')));
  const m = generateModel({ size: 'M', facialHair: 'fullBeard' }, createCatalog(keys));
  expect(m.stats.components).toBe(1);
  for (const b of m.bricks) if (b.color !== FILLER_ID) expect(keys).toContain(catalogKey(b.part, b.color));
});
it('en ağır kombinasyon tek parça ve bütçe içinde', () => {
  const t = performance.now();
  const m = generateModel({ size: 'L', hairStyle: 'volume', facialHair: 'fullBeard', glasses: true, bottomStyle: 'skirt', expression: { smile: 3 } }, cat);
  expect(performance.now() - t).toBeLessThan(2000);
  expect(m.stats.components).toBe(1);
});
it('deterministiktir', () => {
  expect(generateModel({ size: 'L' }, cat).bricks).toEqual(generateModel({ size: 'L' }, cat).bricks);
});
it('iç dolgu parçaları dışarıdan görünmez', () => {
  const m = generateModel({ size: 'S', base: false }, cat);
  const g = buildFigureVoxels(m.design).markHiddenAsWildcard();
  for (const b of m.bricks.filter((x) => x.color === FILLER_ID)) expectAllWildcard(g, b, m.offset);
});
it('kaide boyuta göre seçilir', () => {
  for (const [size, part] of [['S', 'plate8x8'], ['M', 'plate8x16'], ['L', 'plate16x16']])
    expect(generateModel({ size }, cat).bom.find((l) => l.part === part)?.qty).toBe(1);
  expect(generateModel({ base: false }, cat).bom.some((l) => getPart(l.part).kind === 'baseplate')).toBe(false);
});
it('kaide plakası kapalıysa model kaidesiz üretilir', () => {
  const m = generateModel({ size: 'M' }, createCatalog([...defaultCatalog().enabled].filter((k) => !k.startsWith('plate'))));
  expect(m.design.base).toBe(false);
});
it('ayaklar kaidenin içinde, koordinatlar negatif değil', () => {
  for (const size of SIZES) expectFeetOnBase(generateModel({ size }, cat));
});
it('boylar ve parça sayıları makul', () => {
  const s = (size: string) => generateModel({ size }, cat).stats;
  expect(s('S').heightMm).toBeGreaterThanOrEqual(160); expect(s('S').heightMm).toBeLessThanOrEqual(185);
  expect(s('M').heightMm).toBeGreaterThanOrEqual(245); expect(s('M').heightMm).toBeLessThanOrEqual(275);
  expect(s('L').heightMm).toBeGreaterThanOrEqual(325); expect(s('L').heightMm).toBeLessThanOrEqual(355);
  expect(s('S').brickCount).toBeLessThan(s('M').brickCount);
  expect(s('M').brickCount).toBeLessThan(s('L').brickCount);
  expect(s('L').brickCount).toBeLessThan(2500);
});
it('parça listesi toplamı parça sayısına eşit, fiyat 9 ile biter', () => {
  const m = generateModel({ size: 'M' }, cat);
  expect(m.bom.reduce((a, l) => a + l.qty, 0)).toBe(m.bricks.length);
  const p = priceFor(m.bom);
  expect(p.total % 10).toBe(9);
  expect(p.parts + p.designFee + p.packaging + p.shipping).toBe(p.total);
});
```

- [ ] **Adım 2: Testin başarısız olduğunu gör**

  Komut: `npx vitest run src/engine/engine.test.ts`
  Beklenen: FAIL.

- [ ] **Adım 3: `generateModel`'i yaz**

  1. `sanitizeDesign(input, catalog)` ile tasarımı temizle.
  2. `buildFigureVoxels(design).markHiddenAsWildcard()` ile ızgarayı üret.
  3. `packBricks(grid, catalog)` ile döşe.
  4. `base` açıksa:
     - Kaide plakasını `y = 0`, `h = 1`, `plate: true`, `step = 0` olarak ekle. Uzun kenarı x ekseninde. Plaka figür ızgarasına göre değil, gövdenin taban izine göre ortalanır. Orta boyutta 8 stud derinliğindeki kaide 12 stud derin ızgaradan dardır, bu yüzden ızgaraya göre ortalamak ayakları dışarıda bırakabilir.
     - Figür parçalarını `y + 1` ve `step + 1` kaydır.
  5. Tüm parçaları en küçük `x` ve `z` 0 olacak şekilde kaydır. Kaydırma miktarı `offset`'e yazılır.
  6. `stats` alanlarını hesapla:
     - `heightMm = round(maxTop * 3.2 + 1.7)`. `maxTop`, en büyük `y + h` değeri.
     - `widthMm` ve `depthMm` bugünkü gibi.
  7. Diğer değişiklikler:
     - `bom.ts`: `partOrder` şu sırayla genişler: kaideler büyükten küçüğe, tuğlalar, plakalar.
     - `pricing.ts`: `partCost`'a plakalar ve kaideler eklenir. Değerler yer tutucudur: `p1x1` 0.5, `p1x2` 0.6, `p1x3` 0.8, `p1x4` 0.9, `p1x6` 1.2, `p2x2` 0.9, `p2x3` 1.1, `p2x4` 1.3, `plate8x8` 12, `plate8x16` 20, `plate16x16` 35.

- [ ] **Adım 4: Testlerin geçtiğini gör**

  Komut: `npx vitest run src/engine`
  Beklenen: PASS. Performans testi yavaş bir makinede başarısız olursa döşeme deneme sayısını azaltmadan önce darboğazı ölç.

- [ ] **Adım 5: Commit**

```bash
git add src/engine
git commit -m "Motor v2: boyuta göre kaide, kataloğa bağlı model üretimi, fiyat ayrıldı

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Görev 8: Sunucu: katalog, üç boyutlu teklif, yüz verisinin gizlenmesi

**Files:**
- Create: `server/catalogStore.ts`
- Modify: `server/app.ts`, `server/index.ts`, `server/app.test.ts`, `src/shared/orders.ts`, `src/web/api.ts`

**Interfaces:**
- Consumes: `generateModel`, `priceFor`, `createCatalog`, `defaultCatalog`, `SIZES` (Görev 7).
- Produces:
  - `CatalogStore`:
    - `new CatalogStore(dataDir)`
    - `init(): Promise<void>`
    - `get(): Catalog`
    - `version(): string`. Sıralı anahtarların SHA-1'inin ilk 12 hex karakteri.
  - `data/inventory.json` (bu plandaki biçim): `{ "items": [{ "part": string, "color": string, "enabled": boolean }] }`. Dosya varsa katalog yalnızca `enabled: true` olan kalemlerden oluşur. Dosya yoksa `defaultCatalog()` kullanılır ve dosya yazılmaz. Plan 3 bu biçimi miktar alanlarıyla genişletecek.
  - `createApp(store, catalogs: CatalogStore, config, staticDir?)`
  - `shared/orders.ts`:
    - `type PublicDesign = Omit<FigureDesign, 'face' | 'expression'>`
    - `publicDesign(d): PublicDesign`
    - `PublicOrder.design: PublicDesign`
    - `interface PublicCatalog { version: string; enabled: string[] }`
    - `interface QuoteResponse { design: FigureDesign; price: PriceBreakdown; stats: ModelStats; sizes: Record<FigureSize, { total: number; heightMm: number; brickCount: number }> }`
  - `api.ts`:
    - `api.catalog(): Promise<PublicCatalog>`
    - `api.quote(design): Promise<QuoteResponse>`

- [ ] **Adım 1: Başarısız testleri ekle (`server/app.test.ts`)**

  `beforeAll` `CatalogStore` ile kurulur. Testlerde üç uygulama örneği olur:
  - `base`: bugünkü kurulum.
  - `base2`: içinde `inventory.json` bulunan ayrı bir geçici klasörle kurulur.
  - `base3`: `orders.json`'ına v1 biçiminde tek bir sipariş (`V1_ORDER`) yazılmış bir geçici klasörle kurulur.

  `post` yardımcısı dördüncü parametre olarak hangi örneğe gideceğini alır (varsayılan `base`).

```ts
it('kataloğu döner', async () => {
  const j = await json(await fetch(base + '/catalog'));
  expect(j.enabled).toContain('p1x1|red');
  expect(j.version).toMatch(/^[0-9a-f]{12}$/);
});
it('teklif üç boyutun fiyatını döner ve iç maliyeti gizler', async () => {
  const j = await json(await post('/quote', { design: { size: 'S' } }));
  expect(j.sizes.L.total).toBeGreaterThan(j.sizes.M.total);
  expect(j.sizes.M.total).toBeGreaterThan(j.sizes.S.total);
  expect(j.price.total).toBe(j.sizes.S.total);
  expect(j.price.partsCost).toBe(0);
});
it('herkese açık siparişte ve kılavuzda yüz ölçüleri yok, yöneticide var', async () => {
  const r = await post('/orders', { design: { face: { browTilt: 4 } }, customer, consent: { kvkk: true } });
  const { number, accessKey } = await json(r);
  const pub = await json(await fetch(`${base}/orders/${number}?k=${accessKey}`));
  const build = await json(await fetch(`${base}/orders/${number}/build?k=${accessKey}`));
  expect(pub.design.face).toBeUndefined(); expect(pub.design.expression).toBeUndefined();
  expect(build.design.face).toBeUndefined();
  const adm = await json(await fetch(`${base}/admin/orders/${number}`, { headers: { authorization: 'Bearer test-token' } }));
  expect(adm.design.face.browTilt).toBe(4);
});
it('inventory.json ile kapatılan renk teklifte kullanılmaz', async () => {
  // ikinci örnek: yalnızca black, white, lightNougat, darkBrown, darkBlue, darkGray renklerinde
  // p1x1, p1x2, p2x2, 1x2, 2x2 ve darkGray kaideler açık
  const j = await json(await post('/quote', { design: { shirtColor: 'red' } }, {}, base2));
  expect(['black', 'white', 'lightNougat', 'darkBrown', 'darkBlue', 'darkGray']).toContain(j.design.shirtColor);
});
it('eski (v1) sipariş kılavuzu bozulmadan döner', async () => {
  // orders.json'a v1 biçiminde bir sipariş yazılmış klasörle kurulan örnek:
  // engineVersion 1, bricks'te h alanı yok, part '2x4'
  const build = await json(await fetch(`${base3}/orders/BLK-OLD001/build?k=oldkey`));
  expect(build.bricks).toEqual(V1_ORDER.bricks);
});
```

  Mevcut testler korunur. Siparişin oluşturulduğu testte `pub.design.shirtColor === 'blue'` kontrolü geçerli kalır.

- [ ] **Adım 2: Testin başarısız olduğunu gör**

  Komut: `npx vitest run server`
  Beklenen: FAIL.

- [ ] **Adım 3: Sunucuyu güncelle**

  - **`/api/catalog`:** `catalogs.get()` ve `version()` döner.
  - **`/quote`:**
    - Önce tasarım temizlenir.
    - Her boyut için `generateModel({ ...design, size }, catalog)` çalıştırılır.
    - `price` seçili boyutun fiyatıdır. Fiyat `{ ...price, partsCost: 0 }` olarak döner.
    - İstek sınırı dakikada 300.
  - **`/orders`:** `generateModel(body.design, catalogs.get())` ile model, `priceFor(model.bom, config.pricing)` ile fiyat üretilir.
  - **`toPublic` ve `/build`:** `publicDesign(o.design)` döner.
  - **`server/index.ts`:** `CatalogStore`'u `init` edip `createApp`'e verir.

- [ ] **Adım 4: Testlerin geçtiğini gör**

  Komut: `npx vitest run server`
  Beklenen: PASS.

- [ ] **Adım 5: Commit**

```bash
git add server src/shared/orders.ts src/web/api.ts
git commit -m "Sunucu: katalog uç noktası, üç boyutlu teklif, yüz verisi herkese açık yanıtlardan çıkarıldı

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Görev 9: Görüntüleyici ve kılavuz (plaka birimi)

**Files:**
- Create: `src/web/viewer/geometry.ts`, `src/web/viewer/geometry.test.ts`, `src/web/components/steps.ts`, `src/web/components/steps.test.ts`
- Modify: `src/web/viewer/BrickViewer.ts`, `src/web/components/Instructions.tsx`, `src/web/components/LayerMap.tsx`, `src/web/pages/BuildGuide.tsx` (yalnızca açıklama metni)

**Interfaces:**
- Consumes: `Brick` (Görev 2), `getPart` (Görev 1).
- Produces:
  - `geometry.ts`:
    - `brickBox(b: Brick, hasBase: boolean): { bottomMm: number; heightMm: number }`
    - `occupies(b: Brick, layer: number): boolean`
  - `steps.ts`:
    - `interface StepInfo { step: number; main: Brick[]; hanging: Brick[]; mainLayers: number[] }`
    - `groupSteps(bricks: Brick[]): StepInfo[]`
    - `Instructions.tsx`'teki `useSteps`, `useMemo(() => groupSteps(bricks))` olur.

- [ ] **Adım 1: Başarısız testleri yaz**

```ts
it('v2 parçası plaka biriminde', () => {
  expect(brickBox({ y: 4, h: 3 } as Brick, true)).toEqual({ bottomMm: 12.8, heightMm: 9.6 });
  expect(brickBox({ y: 0, h: 1, plate: true } as Brick, true)).toEqual({ bottomMm: 0, heightMm: 3.2 });
});
it('v1 parçası eski formülle', () => {
  expect(brickBox({ y: 0, plate: true } as Brick, true)).toEqual({ bottomMm: 0, heightMm: 3.2 });
  expect(brickBox({ y: 2 } as Brick, true)).toEqual({ bottomMm: 12.8, heightMm: 9.6 });
  expect(brickBox({ y: 2 } as Brick, false)).toEqual({ bottomMm: 19.2, heightMm: 9.6 });
});
it('occupies tuğlanın 3 katını da kapsar', () => {
  expect([3, 4, 5, 6].map((l) => occupies({ y: 3, h: 3 } as Brick, l))).toEqual([true, true, true, false]);
});
it('v2 adımı katlarını sıralı döner, asılı parçaları ayırır', () => {
  const s = groupSteps(fixtureStep())[1];
  expect(s.mainLayers).toEqual([3, 4, 5]);
  expect(s.hanging.every((b) => b.hanging)).toBe(true);
});
```

- [ ] **Adım 2: Testin başarısız olduğunu gör**

  Komut: `npx vitest run src/web`
  Beklenen: FAIL.

- [ ] **Adım 3: Uygula**

  - **`BrickViewer.setModel`:**
    - Yükseklik `brickBox` ile hesaplanır.
    - Stud gizleme: `h` olan parçalarda, parçanın kapladığı tüm katlar dolu sayılır. Studun gizlenip gizlenmediğine parçanın en üst katının bir üstüne bakılarak karar verilir.
    - Performans: `(sx, sz, h, renk, vurgu)` başına bir `InstancedMesh` kurulur. Tüm kenarlar tek bir birleşik `LineSegments` geometrisinde toplanır. Parça başına `Mesh` kurulmaz.
  - **`LayerMap`:**
    - Referans katman `occupies` ile bulunur.
    - Studlar `getPart(b.part).kind !== 'baseplate'` olan parçalarda çizilir.
  - **`StepBody`:**
    - `mainLayers` içindeki her kat için alttan yukarı bir `LayerMap` çizilir, referans katmanı `y - 1`.
    - Altyazı: tek kat varsa `Bu sırayı yerleştir`, birden fazla kat varsa `` `${i + 1}. kat` ``.
  - **`BuildGuide` açıklama metni:** "Her adımda bir sıra tuğla yerleştir." cümlesinin yerine "Her adımda gösterilen katları alttan üste doğru yerleştir." yazılır.

- [ ] **Adım 4: Testlerin geçtiğini gör**

  Komut: `npx vitest run src/web && npm run typecheck`
  Beklenen: PASS. Typecheck'te yalnızca Görev 10'un dosyalarında hata kalabilir.

- [ ] **Adım 5: Commit**

```bash
git add src/web/viewer src/web/components src/web/pages/BuildGuide.tsx
git commit -m "Görüntüleyici ve kılavuz plaka birimine geçti, eski siparişler korunuyor

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Görev 10: Web sayfaları: katalog, worker, boyut seçici, sunucu fiyatı

**Files:**
- Create:
  - `src/web/catalog.ts`
  - `src/web/latest.ts`, `src/web/latest.test.ts`
  - `src/web/engineWorker.ts`
  - `src/web/useModel.ts`
  - `src/web/useQuote.ts`
- Modify: `src/web/pages/Designer.tsx`, `src/web/pages/Checkout.tsx`, `src/web/pages/BuildGuide.tsx`, `src/web/pages/Home.tsx`, `src/web/pages/Privacy.tsx`

**Interfaces:**
- Consumes: `api.catalog`, `api.quote`, `QuoteResponse` (Görev 8); `generateModel`, `createCatalog`, `defaultCatalog`, `enabledColors`, `SIZES`, `SIZE_LABELS`, `FACIAL_HAIR` (Görev 7).
- Produces:
  - `latest.ts`: `createLatest(): { next(): number; isCurrent(id: number): boolean }`
  - `catalog.ts`: `useCatalog(): Catalog | null`. Modül düzeyinde tek bir istek atar. Hata olursa `defaultCatalog()` döner ve konsola yazar.
  - `engineWorker.ts`: mesaj `{ id, design, enabled: string[] }`, yanıt `{ id, model: FigureModel }` ya da `{ id, error }`.
  - `useModel(design, catalog): { model: FigureModel | null; busy: boolean }`. Worker `new Worker(new URL('./engineWorker.ts', import.meta.url), { type: 'module' })` ile kurulur. Eski yanıtlar `createLatest` ile atılır.
  - `useQuote(design): { quote: QuoteResponse | null; loading: boolean; error: string | null }`. Son düzenlemeden 400 ms sonra istek atar. Eski yanıtları atar.

- [ ] **Adım 1: Başarısız testi yaz (`src/web/latest.test.ts`)**

```ts
it('yalnızca son istek güncel sayılır', () => {
  const l = createLatest();
  const a = l.next(); const b = l.next();
  expect(l.isCurrent(a)).toBe(false);
  expect(l.isCurrent(b)).toBe(true);
});
```

- [ ] **Adım 2: Testin başarısız olduğunu gör**

  Komut: `npx vitest run src/web/latest.test.ts`
  Beklenen: FAIL.

- [ ] **Adım 3: Yardımcıları ve sayfaları uygula**

  - **Designer:**
    - Kontrollerin en üstüne bir boyut seçici (`Segmented`) eklenir. Her seçeneğin etiketi: `` `${SIZE_LABELS[s]} · ~${Math.round(q.sizes[s].heightMm / 10)} cm · ${formatPrice(q.sizes[s].total)}` ``. Teklif yüklenirken `` `${SIZE_LABELS[s]} · …` `` gösterilir.
    - Sakal seçenekleri yeni `FACIAL_HAIR` listesinden gelir.
    - Renk seçicilerde yalnızca `enabledColors(catalog)` içindeki renkler görünür.
    - Önizleme ve istatistikler `useModel`'den gelir. `busy` iken önizlemenin üstünde küçük bir "Güncelleniyor…" yazısı çıkar.
    - Fiyat yalnızca `quote.price.total`'dan gelir.
    - Teklif alınamazsa fiyatın yerinde "Fiyat alınamadı, tekrar dene" bağlantısı çıkar ve "Siparişe geç" düğmesi devre dışı kalır.
  - **Checkout:** `model.price` yedeği kaldırılır. Fiyat yüklenene kadar "Hesaplanıyor…" yazar ve gönder düğmesi devre dışı kalır.
  - **BuildGuide (önizleme):** `useModel(loadDesign(), catalog)` kullanılır.
  - **Home:** `HERO_DESIGN`'a `size: 'S'` eklenir. `generateModel(HERO_DESIGN, defaultCatalog())` kullanılır.
  - **Privacy:** "Analiz sonucunda yalnızca … kaydedilir." cümlesinin yerine şu metin konur:

    > Analiz sonucunda yalnızca figürün renk ve stil seçimleri kaydedilir: örneğin “saç: kısa, koyu kahve”, “kaş: kalın, düz”, “gülümseme: hafif”. Bu seçimler kaba basamaklardan oluşur, yüzünün ölçüsü değildir. Figürünü üretebilmek için siparişinle birlikte saklanır ve sipariş takip sayfasında gösterilmez.

- [ ] **Adım 4: Test, derleme ve tarayıcıda kontrol**

  Komut: `npm test && npm run typecheck && npm run build`
  Beklenen: hepsi PASS.

  Ardından `npm run dev` çalıştırılır ve `http://localhost:5173/tasarla` açılır. Kontrol edilecekler:
  - üç boyut seçeneğinde fiyat ve boy görünüyor
  - boyut değişince önizleme güncelleniyor
  - kaydırıcıyla hızlı değişikliklerde eski önizleme yeninin üstüne yazılmıyor
  - konsolda hata yok
  - `/siparis` sayfasında fiyat sunucudan geliyor

- [ ] **Adım 5: Commit**

```bash
git add src/web
git commit -m "Tasarım ekranı: boyut seçici, sunucudan fiyat, motor Web Worker'da

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Görev 11: Geliştirici figür sayfası ve sahip onayı

**Files:**
- Create: `src/web/pages/DevFigure.tsx`
- Modify: `src/web/main.tsx`

**Interfaces:**
- Consumes: `useModel`, `useCatalog` (Görev 10); `FACE_SCALE`, `SIZES` (Görev 3).
- Produces: `/gelistirici/figur` rotası. Yalnızca `import.meta.env.DEV` iken eklenir.
  - `?d=<base64url JSON tasarım>`: gösterilecek tasarım.
  - `&shot=1`: formu gizler.
  - Sayfa S, M ve L boyutlarını yan yana `Viewer3D` (azimuth 0.35) ile gösterir.
  - Altta `FACE_SCALE` ve ifade alanları için birer `range` girdisi olan bir form var. Form değişince URL güncellenir.

- [ ] **Adım 1: Sayfayı yaz ve rotayı ekle**

- [ ] **Adım 2: Derleme**

  Komut: `npm run typecheck && npm run build`
  Beklenen: PASS. Üretim derlemesinde rota yok: `dist` içinde `gelistirici` aranınca sonuç çıkmamalı.

- [ ] **Adım 3: Onay görseli üret**

  Tasarım, sahibinin yerel test fotoğraflarından elle çıkarılır. Bu değerler kişisel veri sayılır: repoya yazılmaz, yalnızca scratchpad'de tutulur.

  `npm run dev` çalışırken headless Chrome ile ekran görüntüsü alınır. Bu makinedeki yol: `C:/Program Files/Google/Chrome/Application/chrome.exe`.

```bash
"$CHROME" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --hide-scrollbars \
  --window-size=1600,1000 --virtual-time-budget=20000 --screenshot="$SCRATCH/sahip-onay.png" \
  "http://localhost:5173/gelistirici/figur?shot=1&d=<base64url>"
```

  Görsel yalnızca scratchpad'e kaydedilir, repoya konmaz. Karşılaştırma için bir de `hairStyle: 'short'`, `facialHair: 'none'`, `expression.smile: 2` olan ikinci bir görsel alınır.

- [ ] **Adım 4: Sahibine gönder ve onay için dur**

  İki görsel `SendUserFile` ile gönderilir. Sahibinin onayı gelmeden bu plan bitmiş sayılmaz ve canlıya alınmaz. Geri bildirim gelirse ilgili görev (genellikle Görev 4) düzeltilir, testlerle birlikte yeniden commit edilir.

- [ ] **Adım 5: Commit**

```bash
git add src/web/pages/DevFigure.tsx src/web/main.tsx
git commit -m "Geliştirici figür sayfası (yalnızca geliştirme ortamında)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
