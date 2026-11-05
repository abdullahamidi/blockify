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

## Sunucuya kurulum (Contabo VPS ya da herhangi bir Ubuntu/Debian sunucu)

1. Alan adının DNS ayarlarına bir **A kaydı** ekleyin: `figur.ornek.com → sunucu IP`.
2. Sunucuya root olarak bağlanıp:

   ```bash
   git clone https://github.com/abdullahamidi/blockify.git /opt/blockify
   cd /opt/blockify
   DOMAIN=figur.ornek.com EMAIL=sen@ornek.com bash deploy/setup.sh
   ```

3. Betiğin sonunda yazan **yönetici anahtarını** saklayın (`/admin` girişi için; `.env` içinde de durur).

Betik Docker'ı kurar, uygulamayı derleyip yalnızca `127.0.0.1:8787` üzerinde başlatır, nginx'e bu alan adı için ayrı bir site
ekler (sunucudaki diğer sitelere dokunmaz), DNS sunucuyu gösteriyorsa Let's Encrypt SSL alır ve her gece veri yedeği için cron görevi kurar.
Tekrar çalıştırmak güvenlidir. DNS henüz yayılmadıysa SSL adımını atlar; DNS hazır olunca betiği yeniden çalıştırmak yeterli.

| İş | Komut |
| --- | --- |
| Güncelleme | `bash /opt/blockify/deploy/update.sh` |
| Kayıtlar | `cd /opt/blockify && docker compose logs -f` |
| Elle yedek | `bash /opt/blockify/deploy/backup.sh` (varsayılan `/root/blockify-backups`) |
| Ayar değişikliği | `.env` dosyasını düzenleyip `docker compose up -d` |

### Sunucuda başka bir Docker vekili varsa

80/443 portlarını başka bir Docker konteyneri (ör. başka bir sitenin vekili) tutuyorsa `setup.sh` nginx'e dokunmadan durur ve
vekilin adını ve ağını yazar. Önce blockify'ı o ağa bağlayın (`<ağ>` yerine betiğin yazdığı ağ adı):

```bash
cd /opt/blockify
echo "PROXY_NETWORK=<ağ>" >> .env
echo "COMPOSE_FILE=docker-compose.yml:deploy/compose.proxy.yml" >> .env
docker compose up -d
```

Sonra vekilin türüne göre alan adını `http://blockify:8787` adresine yönlendirin:

| Vekil | Yapılacak |
| --- | --- |
| nginx konteyneri | Vekilin ayar klasörüne `deploy/nginx-blockify.conf` benzeri bir `server` bloğu ekleyin, `proxy_pass http://blockify:8787;` olsun. Ardından `docker exec <vekil> nginx -t && docker exec <vekil> nginx -s reload` |
| nginx-proxy + acme-companion | `.env` dosyasına `VIRTUAL_HOST=<alan adı>`, `VIRTUAL_PORT=8787`, `LETSENCRYPT_HOST=<alan adı>` ekleyip `docker compose up -d` |
| Caddy | Caddyfile'a `<alan adı> { reverse_proxy blockify:8787 }` ekleyip `docker exec <vekil> caddy reload --config /etc/caddy/Caddyfile` |
| Traefik | `.env` dosyasına `DOMAIN=<alan adı>` ekleyin, `COMPOSE_FILE` satırının sonuna `:deploy/compose.traefik.yml` ekleyin (gerekirse `TRAEFIK_ENTRYPOINT`, `TRAEFIK_CERTRESOLVER`), `docker compose up -d` |
| Nginx Proxy Manager | Panelde (port 81) Proxy Hosts, Add: alan adı, `http`, host `blockify`, port `8787`; SSL sekmesinde yeni sertifika ve Force SSL |

Havale/EFT bilgileri (`BANK_*`) boş bırakılırsa müşteriye "ödeme bilgilerini sana ileteceğiz" mesajı gösterilir.

Docker olmadan: `npm ci && npm run build && NODE_ENV=production ADMIN_TOKEN=... node dist-server/index.js`

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
