# Blockify

Müşterinin fotoğrafından kişiye özel bir tuğla figür tasarlayan, parça listesini çıkaran ve siparişini alan site.

Akış: **fotoğraf yükle → özellikler otomatik çıkarılır → 3D önizlemede özelleştir → sipariş ver → parçalar ve montaj kılavuzu kutuda gönderilir.**

## Nasıl çalışıyor?

| Parça | Ne yapıyor | Kod |
| --- | --- | --- |
| Fotoğraf analizi | MediaPipe çoklu sınıf segmentasyonu (saç, yüz, ten, kıyafet, aksesuar) tarayıcıda çalışır. Fotoğraf sunucuya yüklenmez. Ten, saç rengi/uzunluğu, sakal, gözlük, gömlek/ceket ve alt giyim renkleri çıkarılıp en yakın tuğla rengine eşlenir. | `src/web/analysis/` |
| Figür şablonu | Özelliklerden 10×10×19'luk bir voksel figür üretir (8×8×8 kafa, gövde, kollar, bacaklar, kaide). | `src/engine/figure.ts` |
| Tuğlalara bölme | Her katmanı yalnızca standart tuğlalarla (1x1, 1x2, 1x3, 1x4, 1x6, 2x2, 2x3, 2x4) döşer, katmanlar arası yön değiştirerek kenetlenmeyi artırır, bağlantı analizi yapıp kopuk parça kalmayana kadar onarır. Görünmeyen iç hücreler "renk fark etmez" dolgu olur. Deterministiktir: istemcideki önizleme ile sunucudaki fiyat aynıdır. | `src/engine/packer.ts` |
| Parça listesi ve fiyat | Parça/renk bazında liste (tedarik için BrickLink parça ve renk numaralarıyla), fiyat sunucuda yeniden hesaplanır. | `src/engine/bom.ts`, `src/engine/pricing.ts` |
| Montaj kılavuzu | Katman katman adımlar; desteksiz parçalar ("alttan tak") bir üst katmanla birlikte gösterilir. 3D adım görüntüleyici + yazdırılabilir plan. | `src/web/components/Instructions.tsx` |
| Sipariş API'si | Teklif, sipariş, müşteri takip sayfası, yönetim paneli (durum, kargo no, toplama listesi, kılavuz, kargo etiketi). | `server/` |

Tüm tasarım kombinasyonlarının (576 adet) tek parça ve tam kaplı olduğu testlerle doğrulanır.

## Geliştirme

```bash
npm install
npm run dev        # web: http://localhost:5173, API: http://localhost:8787
npm test           # motor ve API testleri
npm run typecheck
```

Geliştirmede yönetim paneli anahtarı `dev-admin` (adres: `/admin`).

## Üretim

```bash
npm ci
npm run build
cp .env.example .env   # değerleri doldurun
NODE_ENV=production ADMIN_TOKEN=... node dist-server/index.js
```

Tek bir Node süreci hem siteyi hem API'yi servis eder (varsayılan port 8787). Önüne nginx/Caddy konup domain bağlanabilir.
Siparişler `DATA_DIR/orders.json` dosyasında, izinli fotoğraflar `DATA_DIR/photos/` altında tutulur; bu klasör kalıcı ve yedekli olmalı.

Docker ile:

```bash
docker build -t blockify .
docker run -d -p 8787:8787 -v blockify-data:/data --env-file .env blockify
```

### Notlar

- Segmentasyon modeli (~16 MB) varsayılan olarak Google'ın CDN'inden yüklenir. Kendi sunucunuzdan vermek için dosyayı `public/models/` altına koyup `VITE_SEGMENTER_MODEL_URL=/models/selfie_multiclass_256x256.tflite` ile derleyin. MediaPipe wasm dosyaları derlemede `dist/mediapipe/` altına kopyalanır.
- Fiyatlar yer tutucudur: `PRICING_JSON` ya da `DATA_DIR/pricing.json` ile parça maliyetleri, çarpan, tasarım ücreti, paketleme ve kargo ayarlanır.
- KVKK metni (`/gizlilik`) taslaktır, yayın öncesi hukuki kontrolden geçmeli.
- Marka: sitede herhangi bir tescilli oyuncak markası adı ya da görseli kullanılmaz.

## Yol haritası

- Online ödeme (iyzico / PayTR)
- Sipariş e-postaları (SMTP)
- Daha fazla saç modeli, şapka, aksesuar; isim plakası
- Plaka/tile ile yüz detayları (daha yüksek çözünürlük)
