# Figür motoru v2 ve stok yönetimi: tasarım

Tarih: 2026-11-06 · Durum: onay bekliyor

## 1. Amaç ve neden

Müşteri figüre baktığında kendini tanımalı. Bugünkü sürüm bunu yapmıyor:

- Herkes için aynı 8×8×8 tuğlalık kafa üretiliyor. Yüz iki nokta göz ve iki nokta ağızdan ibaret.
- Fotoğraftan yalnızca birkaç etiket alınıyor (saç türü, renkler, sakal var/yok). Yüzün kendi hatları figüre geçmiyor.
- Belirgin özellikler bile kaçabiliyor. Bir test fotoğrafında dolgun sakal algılanmadı.
- Yalnızca tuğla kullanıldığı için her "piksel" 8 mm genişliğinde ve 9,6 mm yüksekliğinde. Detay çok kaba kalıyor.

İkinci ihtiyaç tedarikle ilgili. Parçalar Çin'den toptan alınacak ve anlık tedarik yok. Bu yüzden sistemin üç şeyi yapması gerekiyor: elde olan parça tipleri ve renklerle tasarlamak, neyden ne kadar alınacağını önermek ve eksikleri sahibine bildirmek.

## 2. Hedefler

1. **Benzerlik:** Yüz hatları (kaş, göz, burun, bıyık, sakal hattı, dudak, kulak, yüz şekli) fotoğraftan ölçülür ve tuğla diline çevrilir.
2. **Detay:** Plakalar kullanılır, dikey çözünürlük 3 kat artar. Büyük boyutlarda 3B detay eklenir (öne çıkan burun ve sakal, göz beyazı).
3. **Boyut seçimi:** Müşteri Küçük, Orta ya da Büyük seçer. Fiyat çıkan parça listesine göre hesaplanır.
4. **Etkin katalog:** Yönetici hangi parça tiplerinin ve renklerin kullanılabilir olduğunu seçer. Algoritma yalnızca bunlarla tasarlar.
5. **Stok:** Eldeki miktarlar tutulur, siparişte parçalar ayrılır, eksik ve azalan kalemler için uyarı verilir, bir tedarik listesi çıkarılır.
6. **Alışveriş planı:** Hedef figür sayısına göre parça ve renk bazında alınacak miktarlar hesaplanır.

## 3. Hedef dışı (bu sürümde yok)

- Eğimli ve kavisli parçalar, yana bağlantı (SNOT), düz kaplama (tile), baskılı parçalar. Katalog ileride bunları eklemeye izin verecek şekilde kurulur ama motor şimdilik kullanmaz.
- Fotoğraf mozaiği yüz. Denendi: bu çözünürlükte bulanık ve lekeli çıkıyor, ışık ve gölge yüze karışıyor. Sahibi stilize yüzü seçti.
- Tedarikçiye otomatik sipariş ve e-posta ya da SMS bildirimi. Uyarılar yönetim panelinde gösterilir.
- Birden fazla kişi, evcil hayvan, poz ya da aksesuar seçimi.
- Müşteriye stok durumu göstermek.

## 4. Asla olmaması gerekenler

- Figürün yine "herkes aynı" görünmesi. Farklı yüzler gözle görülür biçimde farklı figürler üretmeli.
- Kurulamayan model: kopuk parça ya da desteksiz ada. Bugün tüm kombinasyonların tek parça olduğu testle doğrulanıyor. Bu garanti korunur.
- İstemcideki önizleme ile sunucudaki fiyatın ya da parça listesinin farklı çıkması.
- Küçük bir hattın ifadeyi bozması. Örnekler örnek görsellerde yaşandı: iç uçları kalkık kaşlar yüze "hüzünlü" bir ifade verdi, küçük boyutta kaşlar ortadan birleşti. Yanlış çizilen bir detay, hiç çizilmemesinden kötüdür.
- Parça çeşidinin stoku yönetilemez hale getirecek kadar artması.
- Stok yetersizliği yüzünden müşterinin siparişinin engellenmesi.
- Mevcut siparişlerin parça listesinin ya da kılavuzunun değişmesi.

## 5. Verilen kararlar

### Sahibinin kararları

- **Yön stilize yüz:** Kafa ve gövde stilize olacak, yüz hatları fotoğraftaki yer ve şekilleriyle aktarılacak. Sahibi örnek görsellerde Orta ve Büyük boyutu "daha doğru" buldu. Kaş düzeltmesinden sonra "daha isabetli ve güzel" dedi.
- **Boyut seçimi:** Müşteri parça sayısını değil, boyut ve detay seviyesini seçer. Fiyat buna göre artar. Bir üst sınır yok, "uygulanabilir" olması yeterli.
- **Tedarik:** Parçalar Çin'den toptan alınacak, eldeki stok önemli.
- **Stok yetmezse:** Sipariş yine alınır. Sistem sahibine bildirir, tedariki sahibi yapar.
- **Ne alınacağı:** Neyden ne kadar alınacağını sistem önerir.
- **İfade:** Figür fotoğraftaki ifadeyi taşır. Fotoğrafta gülümseyen biri gülümseyen bir figür alır.

### Benim önerdiğim ve sahibinin onayladığı kararlar

- Fotoğraf mozaiği kullanılmayacak.
- Tuğla ve plaka birlikte kullanılacak. Dikey birim plaka (3,2 mm) olacak.
- Oranlar bugünkü gibi kalacak: büyük kafa, küçük gövde. Benzerliğin çoğu yüzden geldiği için yüze yer açılıyor.
- Gövde ve kıyafet de fotoğraftan gelecek, bugünkünden daha ayrıntılı olacak.
- Üç boyut olacak. Kafa genişliği 8 / 12 / 16 stud, boy yaklaşık 17 / 26 / 34 cm, parça sayısı kabaca 200 / 600 / 1200. Parça sayısı prototipteki basit bir tahmin, gerçek döşemede değişir.
- Panelde iki ayar olacak: kullanılabilir parça ve renk kalemleri, ve her birinden eldeki miktar.
- Müşteriye stok durumu gösterilmeyecek.
- Parça numaraları genel tasarım numaraları olacak (örneğin 3024 = 1x1 plaka). Çinli üreticiler genelde aynı numaraları kullanıyor.

### Benim kararlarım (sahibine ayrıca gösterilmedi)

- Tasarım yalnızca etkin kataloğa bağlıdır, miktarlara bağlı değildir. Aynı katalogla aynı tasarım her zaman aynı modeli verir. Miktarlar yalnızca uyarı ve planlama için kullanılır.
- Renk paleti kodda kalır (BrickLink karşılıklarıyla birlikte). Yönetici renkleri yalnızca etkinleştirip kapatabilir. Yeni bir renk eklemek kod değişikliği gerektirir.
- "Renk fark etmez" iç dolgu, tasarımda ve parça listesinde bugünkü gibi ayrı bir satır olarak kalır. Hangi gerçek renkten karşılanacağına stok ayrılırken karar verilir.
- Uyarılar yalnızca panelde gösterilir (bkz. hedef dışı).
- `ENGINE_VERSION` 2 olur. Eski siparişler kayıtlı `bricks` ve `bom` alanlarıyla aynen kalır. Bu alanlar zaten siparişte saklanıyor.
- **Fiyat gösterimi:** Önizleme tarayıcıda üretilir. Fiyatlar her zaman sunucudan (`/quote`) gelir. Sunucu üç boyutun fiyatını birlikte döner ve müşteri düzenlemeyi bitirdikten kısa bir süre sonra istek atılır. Maliyet yapısı (`partCost`, `markup`) tarayıcıya gönderilmez. `/quote` istek sınırı buna göre ayarlanır. Bugün önizleme fiyatı repodaki varsayılan fiyatlarla hesaplanıyor ve `data/pricing.json` kullanıldığında sunucu fiyatından farklı çıkabiliyor. Bu açık da böylece kapanır.
- **Yüz ölçüleri ve kişisel veri:** Yüz parametreleri tarayıcıda kaba basamaklara yuvarlanır, her parametre birkaç seviyeden birini alır. Sunucuya ham ölçüm değil, "kaş: kalın, düz" gibi bir stil seçimi gider. Herkese açık sipariş görünümü (`toPublic`) yüz parametrelerini döndürmez. Bugün `OrderStatus` sayfası `design` alanını zaten kullanmıyor. Aydınlatma metnine, fotoğraftan çıkarılan stil bilgisinin siparişle birlikte saklandığı eklenir. Hukuki değerlendirme sahibine aittir.
- **Test fotoğrafları ve onay:** Sahibinin iki fotoğrafı yalnızca yerelde, git'e girmeyen bir klasörde tutulur (ör. `test-photos/`, `.gitignore`'a eklenir). Bir hata ayıklama sayfası bulunan yüz noktalarını ve üretilen kafayı yan yana gösterir. Benzerliğe sahibi karar verir. Aşama 2 ve 3'ün sonunda örnek görsellerle sahibinin onayı alınmadan canlıya çıkılmaz.
- **Farklı yüzlerle test:** Sahibinin iki fotoğrafı dışında farklı yüzler (gözlüklü, uzun saçlı, kadın, koyu tenli, çocuk) için açık lisanslı portreler kullanılır. Bunlar da yalnızca yerelde tutulur. Sahibi ileride izinli fotoğraflar getirirse onlar da eklenir.
- **Alışveriş planının başlangıç dağılımları:** Henüz v2 siparişi yok. Başlangıç dağılımları kodda tutulur ve benim tahminime dayanır. Türkiye'deki müşteri için: açık ve buğday ten ağırlıklı, saçta koyu kahve ve siyah ağırlıklı, kıyafette siyah, lacivert, beyaz, gri ve bej ağırlıklı. Siparişler biriktikçe gerçek siparişler kullanılır. İlk sürümde panelde bu dağılımları düzenleme ekranı yok.

## 6. Bugünkü yapı (kısa)

| Parça | Dosya | Bugün |
| --- | --- | --- |
| Figür şablonu | `src/engine/figure.ts` | 10×10×19 tuğlalık sabit şablon. `FigureDesign` birkaç seçimden oluşuyor. |
| Döşeme | `src/engine/packer.ts` | Yalnızca 8 tuğla tipi kullanıyor. Katmanlar arası yön değiştiriyor, bağlantı analizi yapıp onarıyor. Deterministik. |
| Parçalar ve renkler | `src/engine/parts.ts`, `palette.ts` | Sabit listeler. |
| Fiyat | `src/engine/pricing.ts`, `server/config.ts` | Parça tipine göre birim maliyet × çarpan + sabitler. `data/pricing.json` ile değiştirilebiliyor. |
| Fotoğraf analizi | `src/web/analysis/` | Tarayıcıda MediaPipe çoklu sınıf segmentasyonu. Bölgeler ten pikselleri kutusuna göre hesaplanıyor. |
| Sipariş ve panel | `server/app.ts`, `server/store.ts`, `src/web/pages/Admin.tsx` | Dosya tabanlı JSON. Sunucu tasarımı yeniden üretip fiyatlıyor ve `bricks`/`bom` alanlarını siparişe kaydediyor. |

## 7. Ayrıntılar

### 7.1 Birimler ve parça kataloğu

- Voksel ızgarasında x ve z yönünde 1 birim 1 stud (8 mm), y yönünde 1 birim 1 plaka (3,2 mm). Bir tuğla 3 plaka yüksekliğinde.
- Başlangıç kataloğu aşağıda. Bu benim önerim; builder ayarlayabilir ama liste küçük kalmalı.
  - Plakalar: 1x1 (3024), 1x2 (3023), 1x3 (3623), 1x4 (3710), 1x6 (3666), 2x2 (3022), 2x3 (3021), 2x4 (3020).
  - Tuğlalar: 1x1 (3005), 1x2 (3004), 1x3 (3622), 1x4 (3010), 1x6 (3009), 2x2 (3003), 2x3 (3002), 2x4 (3001).
  - Kaide: boyuta göre büyük plaka ya da plakalar. Çözüm builder'a bırakıldı, kaide tek parça gibi sağlam olmalı.
- Her katalog kalemi bir parça ile bir rengin birleşimi. Alanları: etkin mi, eldeki adet, uyarı eşiği, paket büyüklüğü, isteğe bağlı birim maliyet.
- Döşemenin her zaman bir çözüm bulabilmesi için 1x1 plaka her etkin renkte etkin olmalı. Panel bunu zorlar ya da açıkça uyarır.

### 7.2 Figür üretimi

**Tasarım verisi.** `FigureDesign` v2, sayısal ve seçimli parametrelerden oluşur. Sunucu bu parametreleri temizleyip sınırlar içine çeker. Motor deterministiktir. Tasarım şunları içerir:

- `size`: `S`, `M` ya da `L`.
- Renkler: bugünkü alanlar.
- `face`: normalize ölçüler. Kafa genişliği -1 ile 1 arasında, çene altı 0, kafa tepesi 1. Ölçülenler:
  - kaşlar: iç ve dış uç yüksekliği, kalınlık, iç boşluk
  - gözler: merkez yüksekliği, aralık, genişlik
  - burun: alt uç yüksekliği ve genişliği
  - ağız: yükseklik ve genişlik
  - yüz şekli: çenenin daralması, kafa tepesinin yuvarlaklığı
  - kulak yüksekliği
- `expression`: fotoğraftaki ifade, birkaç seviyeye yuvarlanmış olarak.
  - gülümseme: ağız köşelerinin kalkması, ağzın açık olup dişlerin görünmesi
  - kaşlar: her kaşın ayrı ayrı kalkması ya da çatılması
  - gözlerin kısılması
- Yüz kılı: tür (yok, bıyık, keçi sakal, kısa sakal, dolgun sakal), yanak çizgisinin yüksekliği ve renk.
- Saç: tür (bugünkü 6 tür, gerekirse daha fazla), saç çizgisinin yüksekliği ve renk.
- Gözlük.
- Kıyafet: gömlek, ceket (açık ya da kapalı), yaka, alt giyim türü, ayakkabı.

**Kafa.** Yuvarlatılmış bir kutu. Kubbe ve çene daralması yüz şekli parametrelerinden gelir.

**Yüz.** Ön yüzeydeki her hücrenin rengi, yüzdeki konumuna göre belirlenir (prototipteki gibi). Boyut büyüdükçe şunlar eklenir: göz beyazı ve iris, göz kapağı çizgisi, 1 stud öne çıkan burun ve sakal.

**İfade.** Fotoğraftaki ifade figüre taşınır. Gülümseme küçük boyutta ağız köşelerinin bir plaka kalkmasıyla, orta ve büyük boyutta gerekirse açık ağız ve beyaz dişlerle çizilir. Kaşın kalkması ya da çatılması yalnızca fotoğrafta gerçekten belirginse çizilir.

Ölçüt şu: figürdeki ifade fotoğraftaki ifadeyle aynı okunmalı. Prototipteki "hüzünlü kaş" hatası, fotoğrafta olmayan bir eğimin çizilmesinden kaynaklandı. Kaynağı fotoğrafta olmayan bir ifade hiçbir zaman çizilmez. Her boyut için çizim kuralları bu ölçüte göre test edilir.

**Küçük boyut kuralı.** Çözünürlüğün yetmediği detay atlanır ya da sadeleştirilir. Hiçbir detay ifadeyi bozacak şekilde basamaklanmaz. Kaşlar küçük boyutta, belirgin bir ifade yoksa düz çizilir. Kaşların arasında en az 1 stud boşluk kalır.

**Gövde.** Büyük kafa, küçük gövde oranı: gövde, kollar, eller, bacaklar, ayakkabı, kaide. Kıyafet açık ceket ve içinde gömlek ya da polo olabilir, yakası görünür. Büyük boyutta ceket yakası öne çıkar, etek ve kol ucu bantları eklenir.

**Saç.** Saç modelleri yeni çözünürlük için baştan tasarlanır ve kafa ölçeğine göre ölçeklenir.

**Prototip.** [`2026-11-06-figur-prototip.html`](2026-11-06-figur-prototip.html) dosyası tarayıcıda açılır (three.js'i CDN'den yükler). `?scene=sizes` üç boyutu, `?scene=faces` yüz karşılaştırmasını gösterir. Buradaki yüz sayıları elle ayarlandı. Gerçek sistemde bu değerler fotoğraftan gelecek. Kaş fonksiyonu sahibinin geri bildirimiyle düzeltilmiş halidir.

### 7.3 Döşeme

- Aynı renkte (ya da iç dolgu olan) ve 3 plaka yüksekliğinde dolu dikey bölgeler tuğla olabilir. Geri kalan her yer plakayla döşenir.
- Yalnızca etkin katalog kalemleri kullanılır.
- Kenetlenme ve bağlantı analizi bugünkü gibi yapılır, ama plaka ve tuğlanın karıştığı katmanlar için genelleştirilir. Kopuk parça sayısı 0 olmalıdır.
- Performans hedefi: en büyük boyut orta seviye bir telefonda yaklaşık 1 saniyede üretilmeli. Bu bir hedef; builder ölçüp ayarlayabilir, gerekirse web worker kullanabilir.

### 7.4 Fotoğraf analizi v2

- Aynı `@mediapipe/tasks-vision` paketindeki Face Landmarker ile yüz noktaları bulunur: kaş, göz, burun, dudak ve yüz ovali. Analiz yine tarayıcıda yapılır. Baş eğikse düzeltilir.
- Segmentasyon renkler ve bölgeler için kullanılmaya devam eder. Ama bölgeler artık yüz noktalarına göre tanımlanır:
  - sakal: alt yüzde (burnun altında, yüz ovalinin içinde ve çenenin altında) saç sınıfına giren pikseller
  - kel: alnın üstündeki bölgedeki saç oranı
- **Bilinen hata:** Bir test fotoğrafında sakal algılanmadı. Muhtemel sebep: sakal bandı ten piksellerinin kutusuna göre hesaplanıyor ve sakalın yan kenarları "uzun saç" sayılabiliyor. Yerel test fotoğraflarıyla denenmeli. Fotoğraflar repoya konmaz, repo herkese açık.
- İfade, Face Landmarker'ın ifade puanlarından (blendshape) okunur: gülümseme, ağız açıklığı, kaşın kalkması ya da çatılması, gözlerin kısılması. Bu puanlar birkaç seviyeye yuvarlanır. Kaş ve ağzın yüzdeki yeri ve şekli ise yüz noktalarından ölçülür.
- Kapalı ya da kısık gözler: göz yüksekliği bir alt sınıra çekilir. Kapalı göz çizilmez, çünkü fotoğrafta göz kırpmak genelde kazara olur. Kısık göz çizilebilir.
- Kalite uyarıları: yüz çok küçükse, çok yana dönükse ya da bir kısmı kapalıysa (telefon, el) müşteriye not gösterilir.
- Müşteri her otomatik sonucu düzeltebilir. Tasarım ekranında özellik kontrolleri olur (sakal türü, kaş kalınlığı ve eğimi, göz boyutu, gülümseme seviyesi gibi). Tam kontrol listesi builder'a bırakıldı.

### 7.5 Tasarım ekranı ve sipariş

- Boyut seçici: üç seçenek, her biri fiyatı ve yaklaşık boyuyla.
- Renk seçicilerde yalnızca etkin renkler görünür.
- Montaj kılavuzu plaka katmanlarıyla çok uzayacak. Adımlar gruplanabilir, örneğin her tuğla yüksekliği bir adım olabilir. Builder'a bırakıldı.

### 7.6 Kataloğun paylaşılması ve fiyat

- Etkin katalog sunucuda (`data/inventory.json`) durur ve `/api/catalog` ile istemciye gönderilir. İstemci önizlemeyi bu katalogla üretir. Sunucu teklif ve siparişi aynı katalogla üretir.
- Katalog önizleme ile sipariş arasında değişirse siparişte sunucunun sonucu geçerlidir. Bugün de böyle.
- `PricingConfig.partCost` yeni parça kimlikleriyle genişletilir.

### 7.7 Stok

- **Kalem alanları:** etkin, eldeki, ayrılmış, uyarı eşiği, paket büyüklüğü.
- **Ayırma:** Sipariş oluşturulunca parça listesi stoktan ayrılır. İptal edilirse geri döner. Kargolanınca eldeki miktardan düşer. Builder bu akışı sadeleştirebilir ama "eldeki eksi açık siparişler" hesabı her zaman doğru olmalı.
- **İç dolgu:** "Renk fark etmez" satırları ayırma sırasında stokta en bol olan renklerden karşılanır.
- **Eksik:** Açık siparişlerin ihtiyacı eldeki miktarı aşan kalemler. Sipariş listesinde "eksik parça var" işareti, ana panelde uyarı gösterilir.
- **Tedarik listesi sayfası:** Eksikler ve eşiğin altına inenler listelenir. Her satırda parça numarası, renk adı (BrickLink/LEGO adıyla) ve miktar olur. CSV olarak indirilebilir.
- **Stok girişi:** Gelen paketler toplu olarak eklenir. Giriş ve çıkış hareketleri kaydedilir.

### 7.8 Alışveriş planı

- **Girdi:** hedef figür sayısı, boyut dağılımı (Küçük/Orta/Büyük yüzdeleri), güvenlik payı yüzdesi.
- **Yöntem:** Motor gerçekçi rastgele tasarımlarla çalıştırılır. Başta varsayılan renk ve özellik dağılımları kullanılır, siparişler biriktikçe gerçek siparişler kullanılır. Parça ve renk başına figür başı ortalama ve dağılım çıkarılır. Bu hedef figür sayısına ölçeklenir, paket büyüklüğüne yukarı yuvarlanır ve eldeki stok düşülür.
- **Çıktı:** tablo ve CSV. Birim maliyet girilmişse toplam maliyet tahmini de gösterilir.

### 7.9 Depolama

`data/inventory.json` dosyası katalog, miktarlar ve hareketleri tutar. `server/store.ts`'deki atomik yazma deseni kullanılır. `deploy/backup.sh` zaten tüm `/data` klasörünü yedekliyor.

## 8. Kısıtlar

- Teknolojiler aynı kalır: TypeScript, React, three.js, Express, dosya tabanlı depolama, Docker ile VPS.
- Fotoğraf sunucuya yüklenmez. Analiz tarayıcıda yapılır. Sunucuya yalnızca müşterinin izin verdiği küçük kopya gider.
- Motor istemcide ve sunucuda birebir aynı sonucu vermelidir.
- Repo herkese açık. Kişisel fotoğraflar ve fotoğraftan türetilen görseller repoya konmaz.
- Telefonda kullanılabilir hızda çalışmalıdır. Hem üretim hem 3B önizleme için geçerli: 1200 parçalık bir modelin akıcı gösterilmesi gerekir.

## 9. Builder'a bırakılanlar

- Tam parça listesi (7.1'deki çerçevede) ve kaide çözümü.
- Döşeme algoritmasının iç yapısı ve performans teknikleri.
- Yüz parametrelerinin tam listesi ve tasarım ekranındaki düzeltme kontrolleri.
- Saç modellerinin yeni biçimleri.
- Montaj kılavuzunda adım gruplama.
- Panel arayüzünün düzeni.

## 10. Önerilen sıra

Her aşama kendi başına canlıya alınabilir.

1. Yeni birimler, katalog ve plaka/tuğla döşeme. Bugünkü figürle de çalışır. Testlerle doğrulanır.
2. Yeni figür üretici: yüz parametreleri, üç boyut, gövde, kıyafet, saç.
3. Fotoğraf analizi v2: yüz noktaları, sakal ve kel düzeltmesi, kalite uyarıları, düzeltme kontrolleri.
4. Stok: katalog paneli, miktarlar, ayırma, eksik listesi.
5. Alışveriş planı.
