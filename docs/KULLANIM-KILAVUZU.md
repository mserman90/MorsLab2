# MorsLab PWA — Teknik Açıklama ve Akademik Kullanım Kılavuzu

**Sürüm:** 2.2.0 (Web / Progressive Web Application)  
**Temel Alınan Özgün Proje:** [mserman90/MorsLab](https://github.com/mserman90/MorsLab) (Mustafa Mert Akceylan & Murat Erman, Apache-2.0 Lisansı)  
**Uyumlu Standartlar:** ITU-R M.1677-1 · PARIS / Farnsworth Zamanlama · ADIF 3.1.4 · W3C Web Audio & PWA · WCAG 2.1 AA

---

## İçindekiler

1. [Özet ve Bilimsel Kapsam](#1-özet-ve-bilimsel-kapsam)
2. [Çok Yönlü 4 Modaliteli Dönüşüm Mimarisi ($4 \times 3 = 12$ Yön)](#2-çok-yönlü-4-modaliteli-dönüşüm-mimarisi-4-times-3--12-yön)
3. [Kuramsal Temeller ve Bilgi Kuramı](#3-kuramsal-temeller-ve-bilgi-kuramı)
4. [Çok Dilli Alfabe Profilleri, Normalizasyon ve İşletme İşaretleri](#4-çok-dilli-alfabe-profilleri-normalizasyon-ve-işletme-işaretleri)
5. [Akustik Zamanlama Analitiği ve PCM/WAV Sentezi](#5-akustik-zamanlama-analitiği-ve-pcmwav-sentezi)
6. [Sayısal Sinyal İşleme (DSP): Goertzel Algoritması ve Adaptif Histerezis](#6-sayısal-sinyal-i̇şleme-dsp-goertzel-algoritması-ve-adaptif-histerezis)
7. [Modül Bazlı Kullanım Kılavuzu](#7-modül-bazlı-kullanım-kılavuzu)
   - [7.1 Mors Çevirici](#71-mors-çevirici)
   - [7.2 Ses Laboratuvarı (Konuşma ↔ Mors ve CW Çözümleme)](#72-ses-laboratuvarı-konuşma--mors-ve-cw-çözümleme)
   - [7.3 Alıştırmalar ve Etkileşimli Maniple](#73-alıştırmalar-ve-etkileşimli-maniple)
   - [7.4 Mors Alfabesi Sözlüğü](#74-mors-alfabesi-sözlüğü)
   - [7.5 Çeviri Geçmişi](#75-çeviri-geçmişi)
   - [7.6 İstasyon Defteri (ADIF 3.1.4)](#76-i̇stasyon-defteri-adif-314)
   - [7.7 Ayarlar ve Yerel Veri Yönetimi](#77-ayarlar-ve-yerel-veri-yönetimi)
8. [PWA Mimarisi, Çevrimdışı Çalışma ve Gizlilik Modeli](#8-pwa-mimarisi-çevrimdışı-çalışma-ve-gizlilik-modeli)
9. [Erişilebilirlik (WCAG 2.1 AA) ve Klavye Kısayolları](#9-erişilebilirlik-wcag-21-aa-ve-klavye-kısayolları)
10. [Bilinen Sınırlar, Masaüstü Sürümüyle Karşılaştırma ve Sorun Giderme](#10-bilinen-sınırlar-masaüstü-sürümüyle-karşılaştırma-ve-sorun-giderme)
11. [Lisans, Atıf ve Kaynaklar](#11-lisans-atıf-ve-kaynaklar)

---

## 1. Özet ve Bilimsel Kapsam

**MorsLab PWA**, sürekli dalga (**Continuous Wave — CW**) radyo-telgrafçılığı için tasarlanmış istemci taraflı, kurulum gerektirmeyen ve çevrimdışı çalışabilen bir Progressive Web Application (PWA) platformudur. Özgün `mserman90/MorsLab` projesindeki alfabe haritalamalarını, PARIS/Farnsworth zamanlama matematiğini, dar bantlı Goertzel demodülasyon yaklaşımını ve ADIF 3.1.4 amatör telsiz günlüğü modelini modern **React 19 + TypeScript + Web Audio API** mimarisine uyarlar.

Platformun temel tasarım ilkeleri üç eksende toplanır:

1. **Çok Yönlü Modalite Bütünlüğü:** Düz metin, Mors kodu simgeleri (`·` / `—`), konuşma sesi (ASR/TTS) ve CW ses dalgası arasında tek bir çalışma alanında kesintisiz dönüşüm.
2. **Yerel İşleme ve Gizlilik:** Metin çevirisi, PCM/WAV ses üretimi, Goertzel DSP çözümleme, maniple eğitimi, geçmiş ve istasyon defteri tamamen kullanıcının tarayıcısında işlenir; uzak bir uygulama sunucusuna mesaj veya kayıt gönderilmez.
3. **Çevrimdışı Dayanıklılık ve Erişilebilirlik:** Sürüm kontrollü Service Worker (`morslab-shell`) önbelleklemesi, cihaz içine gömülü değişken `Manrope` yazı tipi ve WCAG 2.1 AA kontrast/klavye/ekran okuyucu uyumluluğu ile masaüstü ve mobil cihazlarda yerel uygulama deneyimi sunar.

---

## 2. Çok Yönlü 4 Modaliteli Dönüşüm Mimarisi ($4 \times 3 = 12$ Yön)

MorsLab PWA dört temel iletişim modalitesi arasındaki tüm 12 yönlü geçişi destekler:

```
                    ┌──────────────────────────┐
                    │       1. Düz Metin       │
                    │  (TR, EN, DE, RU, AR)    │
                    └─────────────┬────────────┘
                           ▲   ▲  │  ▲
                ┌──────────┘   │  │  └──────────┐
                │  ┌───────────┘  │             │
                ▼  ▼              ▼             ▼
┌──────────────────────────┐             ┌──────────────────────────┐
│   2. Mors Metni (. -)    │◄───────────►│     3. Konuşma Sesi      │
│  (ITU-R / Kiril / Arap)  │             │   (Tarayıcı ASR / TTS)   │
└──────────────┬───────────┘             └─────────────┬────────────┘
               ▲                                       ▲
               │                 ▲                     │
               └───────────┐     │     ┌───────────────┘
                           ▼     ▼     ▼
                    ┌──────────────────────────┐
                    │     4. CW Mors Sesi      │
                    │ (PCM / WAV / Goertzel)   │
                    └──────────────────────────┘
```

| # | Kaynak Modalite | Hedef Modalite | Uygulama Yöntemi | Arayüz Konumu |
|---:|---|---|---|---|
| 1 | **Düz Metin** | **Mors Metni** | `encodeMorse()` — deterministik alfabe ve prosign eşleme | Mors Çevirici (`Metin → Mors`) |
| 2 | **Düz Metin** | **Konuşma Sesi** | `speakText()` — W3C `SpeechSynthesis` | Mors Çevirici (`Sesli oku`) |
| 3 | **Düz Metin** | **CW Mors Sesi** | `createSamples()` + `useMorseAudio` / `createWav()` | Mors Çevirici (`Morsu dinle` / `WAV indir`) |
| 4 | **Mors Metni** | **Düz Metin** | `decodeMorse()` — ters tablo çözümleme | Mors Çevirici / Ses Lab (`Morstan Konuşmaya`) |
| 5 | **Mors Metni** | **Konuşma Sesi** | `decodeMorse()` + `speakText()` | Mors Çevirici (`Sesli oku`) / Ses Lab (`Morstan Konuşmaya`) |
| 6 | **Mors Metni** | **CW Mors Sesi** | `createSamples()` + `useMorseAudio` / `createWav()` | Mors Çevirici / Ses Lab / Mors Alfabesi |
| 7 | **Konuşma Sesi** | **Düz Metin** | W3C `SpeechRecognition` (5 dil) | Ses Laboratuvarı (`Konuşmadan Morsa`) |
| 8 | **Konuşma Sesi** | **Mors Metni** | ASR çıktısı → `encodeMorse()` | Ses Laboratuvarı (`Konuşmadan Morsa`) |
| 9 | **Konuşma Sesi** | **CW Mors Sesi** | ASR çıktısı → `useMorseAudio` / `createWav()` | Ses Laboratuvarı (`Morsu dinle` / `WAV indir`) |
| 10 | **CW Mors Sesi** | **Mors Metni** | `decodeAudioSignal()` (Dosya) / Canlı Goertzel DSP | Ses Laboratuvarı (`Mors sesini çöz`) |
| 11 | **CW Mors Sesi** | **Düz Metin** | Goertzel DSP → `decodeMorse()` | Ses Laboratuvarı (`Mors sesini çöz`) |
| 12 | **CW Mors Sesi** | **Konuşma Sesi** | Goertzel DSP → `decodeMorse()` → `speakText()` | Ses Laboratuvarı (`Mors sesini çöz` → `Sesli oku`) |

Ek olarak **Alıştırmalar → Maniple ile gönder** aracı, fiziksel dokunma veya `Spacebar` basış sürelerini canlı CW tonu olarak çalar ve gerçek zamanlı olarak **CW Maniple → Mors Metni → Düz Metin → Konuşma / WAV** zincirini üretir.

---

## 3. Kuramsal Temeller ve Bilgi Kuramı

Uluslararası Mors kodu, Claude Shannon'ın 1948 tarihli kaynak kodlama teoreminden önce geliştirilmiş, değişken uzunluklu ve entropi kısıtlı bir kodlama sistemidir. Doğal dillerdeki harf sıklığı dağılımı göz önüne alınarak sık kullanılan karakterlere (`E → ·`, `T → —`) kısa süreli diziler, nadir karakterlere (`Q → — — · —`, `J → · — — —`) daha uzun diziler atanır. Bir alfabenin ortalama karakter iletim maliyeti şu beklenen uzunluk ifadesiyle modellenir:

$$\mathbb{E}[L] = \sum_{i=1}^{M} P(s_i) \cdot \ell(s_i)$$

Burada $P(s_i)$ karakterin göreli sıklığını, $\ell(s_i)$ ise iç boşluklar dahil birim zaman (*dit*) cinsinden toplam iletim süresini temsil eder. Mors kodu tek başına önek-serbest (prefix-free) bir ikili ağaç gibi çalışmaz; karakter sınırları harfler arasındaki $3\tau$ sessizlik süresiyle ayrıldığı için üçlü bir alfabe ($\{\cdot, -, \text{boşluk}\}$) üzerinde tek anlamlı çözümlenebilir (*uniquely decodable*) hale gelir.

---

## 4. Çok Dilli Alfabe Profilleri, Normalizasyon ve İşletme İşaretleri

MorsLab PWA üç ayrı alfabe profili arasında geçiş yapabilir (`src/lib/morse.ts`):

### 4.1 Alfabe Profilleri
1. **Uluslararası (ITU-R M.1677-1) (`latin`):**
   - `A–Z` (26 Latin harfi), `0–9` (10 rakam) ve 18 noktalama/özel karakter (`. , ? ' / ( ) : = + - " @ ! & ; _ $`).
   - **Normalizasyon:** Metin büyük harfe dönüştürülür; Türkçe `İ` (`U+0130`) karakteri doğrudan `I` olarak eşlenir, ardından Unicode `NFD` ayrıştırması ile aksan ve diyaktitik işaretler (`[\u0300-\u036f]`) temizlenir (`Ç → C`, `Ğ → G`, `Ö → O`, `Ş → S`, `Ü → U`, `Ä → A`). Almanca `ß` karakteri JavaScript `toUpperCase()` kuralı gereği `SS` dizisine dönüşür.
2. **Kiril / Rusça (`russian`):**
   - Rusça telgraf standardına uygun 32 Kiril harfi (`А–Я`) ile ortak rakam ve noktalama işaretleri birleştirilir. `Ё` harfi `Е` harfine normalize edilir.
3. **Arapça (`arabic`):**
   - 29 Arapça harf (`ا–ي` ve hemze `ء`) tanımlıdır.
   - Harekeler (`U+064B–U+065F`, `U+0670`) ve tatvil (`U+0640`) ayıklanır; elif varyantları (`أ إ آ ٱ → ا`), hemzeli vav/ye (`ؤ → و`, `ئ ى → ي`) ve ta marbuta (`ة → ه`) sadeleştirilir; Doğu Arapça rakamlar (`٠–٩`) Batı rakamlarına (`0–9`), Arapça virgül/noktalı virgül/soru işareti (`، ؛ ؟`) ASCII karşılıklarına dönüştürülür. Metin alanları `dir="rtl"` düzenine uyum sağlar.

### 4.2 Kelime Ayraçları ve İşletme İşaretleri (Prosigns)
- **Seçilebilir Kelime Ayraçları:** `/`, `|`, `#` ve `*`. Çözümleme (`cleanMorse`) aşamasında `·`/`•` noktaya, `–`/`—`/`_` çizgiye, yeni satırlar, alternatif ayraçlar ve üç veya daha fazla ardışık boşluk standart `/` ayracıyla normalize edilir.
- **Bitişik İşletme İşaretleri (Prosigns):** Kodlama sırasında boşluksuz tek bir işaret dizisi olarak üretilir:
  - `<AR>` → `.-.-.` (Mesaj sonu)
  - `<SK>` → `...-.-` (Görüşme sonu)
  - `<BT>` → `-...-` (Bölüm ayracı)
  - `<AS>` → `.-...` (Lütfen bekleyin)
  - `<KN>` → `-.--.` (Yalnız çağrılan istasyon)
  - `SOS` / `<SOS>` → `...---...` (Acil durum çağrısı)

---

## 5. Akustik Zamanlama Analitiği ve PCM/WAV Sentezi

### 5.1 PARIS Standardı
MorsLab PWA zamanlaması, `"PARIS "` kelimesinin (eleman ve boşluklarıyla) tam $50$ birim süreden oluştuğunu kabul eden **PARIS standardını** uygular. Seçilen $\text{WPM} \in [5, 50]$ hızına göre bir *dit* süresi $\tau$:

$$\tau = \frac{1.2}{\text{WPM}} \;\text{saniye} = \frac{1200}{\text{WPM}} \;\text{ms}$$

Standart zamanlama oranları:
- **Dit ($\cdot$):** $1\tau$
- **Dah ($-$):** $3\tau$
- **Harf içi elemanlar arası boşluk:** $1\tau$
- **Harfler arası boşluk:** $3\tau_{\text{boşluk}}$
- **Kelimeler arası boşluk:** $7\tau_{\text{boşluk}}$

Varsayılan yapılandırmada (`20 WPM`, `600 Hz`, `%70` ses seviyesi) $\tau = 60\text{ ms}$, dah süresi $180\text{ ms}$, harf arası boşluk $180\text{ ms}$ ve kelime arası boşluk $420\text{ ms}$'dir.

### 5.2 Farnsworth Zamanlaması
Öğrenme sürecinde karakterlerin ses örüntüsünü ("ritmini") bozmadan zihinsel çözümleme süresi kazandırmak için **Farnsworth** modu etkinleştirilebilir. Bu modda *dit*, *dah* ve eleman içi boşluklar seçilen karakter hızında ($\tau$) kalırken; harf arası ($3\tau_{\text{boşluk}}$) ve kelime arası ($7\tau_{\text{boşluk}}$) süreler efektif hız $\text{WPM}_{\text{eff}} = \max(5, \text{round}(0.6 \cdot \text{WPM}))$ üzerinden genişletilir:

$$\tau_{\text{boşluk}} = \max\!\left(\tau,\; \frac{60 - 37.2 \cdot \frac{\text{WPM}_{\text{eff}}}{\text{WPM}}}{19 \cdot \text{WPM}_{\text{eff}}}\right)$$

### 5.3 Sinüzoidal Sentez ve RIFF/WAV Biçimi
- **Zarf Şekillendirme:** Web Audio API oynatımında ve WAV üretiminde, ani faz/genlik sıçramalarından kaynaklanan geniş bantlı tıklama gürültüsünü (*key click*) engellemek için her aktif ton darbesinin başında ve sonunda $\min(4\text{ ms}, L/4)$ uzunluğunda lineer yükselme/düşme rampası uygulanır.
- **WAV Dosya Yapısı:** `createWav()` fonksiyonu doğrudan tarayıcı belleğinde 44 baytlık standart RIFF başlığına sahip, **22.050 Hz**, **1 kanal (mono)**, **16-bit işaretli doğrusal PCM** formatında `.wav` dosyası oluşturur (`audio/wav`). Bellek koruması amacıyla tek seferde üretilebilecek maksimum ses süresi **180 saniye (3 dakika)** ile sınırlandırılmıştır.

---

## 6. Sayısal Sinyal İşleme (DSP): Goertzel Algoritması ve Adaptif Histerezis

Ses laboratuvarındaki **Mors sesini çöz** modülü hem yüklenen ses dosyalarını (`.wav`, `.mp3`, `.ogg`) hem de canlı mikrofon akışını dar bantlı **Goertzel rezonatörü** ile çözümler (`src/lib/morse.ts`).

### 6.1 Neden Goertzel?
Tüm spektrumu hesaplayan $O(N \log N)$ karmaşıklığındaki FFT yerine yalnızca tek bir hedef CW taşıyıcı frekansını ($f_c$) izleyen ikinci dereceden özyineli Goertzel filtresi $O(N)$ zaman karmaşıklığında çalışır ve tarayıcı ana iş parçacığında düşük gecikmeli analiz sağlar.

Örnekleme frekansı $f_s$ ve pencere uzunluğu $N$ olmak üzere açısal frekans $\omega_0 = \frac{2\pi f_c}{f_s}$ ve geri besleme katsayısı $c = 2\cos(\omega_0)$ tanımlanır:

$$s[n] = x[n] + c\,s[n-1] - s[n-2], \quad n = 0, 1, \dots, N-1$$

Burada $s[-1] = s[-2] = 0$ sınır koşullarıyla döngü sonunda normalize taşıyıcı genliği elde edilir:

$$|X(f_c)| = \frac{2}{N}\sqrt{\max\!\left(0,\; s[N-1]^2 + s[N-2]^2 - c\,s[N-1]s[N-2]\right)}$$

### 6.2 Otomatik Frekans Kilitleme ve Çift Eşikli Histerezis
1. **Baskın Taşıyıcı Tespiti (`detectDominantCwFrequency`):** Dosya çözümlemede 25 ms'lik yüksek enerjili pencereler taranarak 300–1200 Hz aralığında (25 Hz adımlarla + kullanıcının seçtiği frekans) en yüksek Goertzel yanıtını veren taşıyıcı $f_c$ seçilir. Böylece kullanıcı ayarları 600 Hz iken 750 Hz tonlu bir kayıt yüklense dahi sinyal otomatik yakalanır.
2. **Çift Seviyeli Schmitt Tetikleyici Histerezisi:** 5 ms kayan adımlı 10 ms pencerelerden çıkarılan zarfın %10 taban gürültüsü ($E_{\text{floor}}$) ve %95 tepe değeri ($E_{\text{peak}}$) üzerinden iki eşik tanımlanır:
   $$\theta_{\text{high}} = E_{\text{floor}} + 0.42(E_{\text{peak}} - E_{\text{floor}}), \qquad \theta_{\text{low}} = E_{\text{floor}} + 0.25(E_{\text{peak}} - E_{\text{floor}})$$
   Durum $\theta_{\text{high}}$ üzerinde **ON**, $\theta_{\text{low}}$ altında **OFF** konumuna geçer; 12 ms altındaki mikro parazitler komşu bloklarla birleştirilir.
3. **Süre Kestirimi:** Aktif darbe sürelerinin 20. yüzdeliğinden referans *dit* birimi $\hat{\tau}$ çıkarılır ($> 2\hat{\tau}$ → `-`, aksi `.`; $> 2\hat{\tau}$ sessizlik → harf boşluğu, $> 5\hat{\tau}$ sessizlik → kelime ayracı `/`).
4. **Canlı Mikrofon CW:** `AnalyserNode` (`fftSize = 1024`) üzerinden 20 ms aralıklarla seçilen hedef frekans ($f_c$) izlenir; üstel hareketli ortalama gürültü tabanı ($\text{EMA}: \alpha = 0.08$) ve $3.0\times$ / $2.0\times$ histerezis eşikleriyle gerçek zamanlı sembol üretimi yapılır.

---

## 7. Modül Bazlı Kullanım Kılavuzu

### 7.1 Mors Çevirici
1. Üst sekmeden **Metin → Mors** veya **Mors → Metin** yönünü seçin; dilerseniz ortadaki yön değiştirme düğmesiyle mevcut çıktıyı girdiye aktarın.
2. Sağ üstten **Çeviri alfabesi** (`Uluslararası (ITU)`, `Kiril (Rusça)`, `Arapça`) ve **Kelime ayracı** (`/`, `|`, `#`, `*`) seçimini yapın.
3. Sol kutuya metninizi veya Mors kodunuzu yazın (`Örnek dene` menüsünden hazır ifadeler seçebilirsiniz). Sağ kutu anlık olarak güncellenir; desteklenmeyen karakterler alt bilgi çubuğunda raporlanır.
4. Oynatıcıda **Morsu dinle** (`Ctrl/Cmd + Enter`) ile CW sesini çalın, dalga formu üzerinden istediğiniz konuma atlayın, tekrar düğmesiyle döngüye alın.
5. **Sesli oku** düğmesi o anki metni (Mors → Metin yönünde ise çözülen metni) seçili konuşma dilinde seslendirir.
6. **WAV indir** düğmesi 16-bit PCM `.wav` dosyasını oluşturur. Otomatik indirme tarayıcı tarafından engellenirse açılan **Hazır WAV dosyası** kartındaki **Tekrar indir**, **Dosyayı aç** veya mobil cihazlarda **Paylaş / Kaydet** düğmesini kullanın.
7. Alt paneldeki **Ses ayarları** üzerinden `Çalma hızı (5–50 WPM)`, `Ton frekansı (300–1000 Hz)`, `Ses seviyesi (%0–100)` ve `Farnsworth zamanlaması` seçeneklerini düzenleyin.

### 7.2 Ses Laboratuvarı (Konuşma ↔ Mors ve CW Çözümleme)
Sağ üstteki dil seçicisinden (`Türkçe tr-TR`, `English en-US`, `Deutsch de-DE`, `Русский ru-RU`, `العربية ar-SA`) uygun dili belirleyin; seçilen dil hem konuşma tanıma/okuma dilini hem de alfabe profilini otomatik eşler:

- **Konuşmadan Morsa:** **Dinlemeyi başlat** düğmesiyle mikrofondan Türkçe veya seçtiğiniz dilde konuşun (tarayıcınızın SpeechRecognition desteği yoksa metin kutusuna doğrudan yazabilirsiniz). Üretilen Mors kodunu **Morsu dinle**, **Sesli oku**, **WAV indir** veya **Çeviricide aç** ile kullanın.
- **Morstan Konuşmaya:** Mors kodu girin (`.` ve `-`), anında sağ alanda çözülen metni görün ve **Sesli oku** ile dinleyin, **Morsu dinle** ile CW sinyaline dönüştürün veya **WAV indir** ile kaydedin.
- **Mors Sesini Çöz:**
  - **Dosya yükle:** WAV, MP3 veya OGG formatında (en fazla 30 MB / 3 dakika) tek tonlu bir CW kaydını sürükleyip bırakın ya da seçin. Goertzel DSP otomatik frekans kilidiyle Mors kodunu ve çözülen metni çıkarır.
  - **Canlı mikrofon CW:** **Canlı CW dinle** düğmesiyle hoparlörden veya yakın telsizden gelen tek tonlu CW sinyalini anlık sinyal seviyesi ölçeri eşliğinde çözün. En iyi sonuç için **Ayarlar / Ses ayarları** içindeki `Ton frekansı` ve `Çalma hızı` değerlerini kaynağa yakın tutun.

### 7.3 Alıştırmalar ve Etkileşimli Maniple
- **Dinle ve keşfet:** Seviyeyi (`Başlangıç · 6 harf`, `Tüm harfler · 26 harf`, `Rakamlar · 10 karakter`) seçin, küre simgesine basıp sinyali dinleyin, yanıtınızı yazıp kontrol edin. 10 soruluk tur puanınız ve toplam istatistiğiniz tarayıcıda saklanır.
- **Maniple ile gönder:** Alfabe profilini seçin. Ekrandaki **MORS TUŞU** düğmesine dokunarak/basılı tutarak ya da klavyede **`Space` (Boşluk)** tuşunu kullanarak kendi CW sinyalinizi gönderin. Kısa basış `·`, uzun basış `—` üretir; duraklamalarda harfler ve kelime ayracı `/` otomatik eklenir. Oluşan sinyali **Tekrar dinle**, **Sesli oku**, **WAV indir** veya **Çeviricide aç** ile değerlendirin.

### 7.4 Mors Alfabesi Sözlüğü
- **Harfler**, **Rakamlar** ve **Noktalama** sekmeleri arasında geçiş yapın; arama kutusunda harf (`a`, `ş`) veya kod (`.--`) ile arayın.
- Herhangi bir karakter kartına tıkladığınızda o karakterin gerçek CW ritmi seçili WPM ve frekansta çalınır.

### 7.5 Çeviri Geçmişi
- Çeviricide **Kaydet** simgesine tıkladığınız veya dinlediğiniz benzersiz çeviriler kronolojik sırada saklanır (en fazla **100 kayıt**).
- Arama yapabilir, **Çeviricide aç** ile kaydı geri yükleyebilir, tekil kayıt silebilir veya tüm geçmişi JSON olarak **Dışa aktar**abilirsiniz.

### 7.6 İstasyon Defteri (ADIF 3.1.4)
- Amatör telsiz QSO kayıtlarınızı çevrimdışı tutmak için **Yeni bağlantı** düğmesini kullanın.
- Form alanları otomatik doğrulanır: Çağrı işareti (3–16 alfanümerik/`/`), yerel tarih/saat (UTC olarak kaydedilir), Frekans (MHz — otomatik bant eşlemesi `160m`–`70cm`), Mod (`CW`, `SSB`, `FT8`, `FM`), RST raporları (`59`, `599` vb.) ve isteğe bağlı Maidenhead Grid (`KN41` veya `KN41ma`).
- **ADIF al** ve **ADIF indir** düğmeleri standart `<ADIF_VER:5>3.1.4` dosya değişimini destekler. *Not: Web sürümü fiziksel telsiz donanımını (CAT/PTT/DTR-RTS) sürmez.*

### 7.7 Ayarlar ve Yerel Veri Yönetimi
- **Görünüm:** `Açık`, `Koyu` veya `Sistem` teması.
- **Uygulamayı yükle:** Desteklenen tarayıcılarda tek tıkla kurulum penceresini açar veya Safari/mobil için manuel kurulum adımlarını gösterir.
- **Yerel verileri yedekle:** Tüm `morslab.*` tercihlerini, geçmişi, alıştırma istatistiklerini ve istasyon defterini tek bir JSON yedeği olarak indirir.
- **Tüm yerel verileri temizle:** Onay penceresi sonrasında tarayıcıdaki tüm MorsLab verilerini siler ve varsayılanlara döner.

---

## 8. PWA Mimarisi, Çevrimdışı Çalışma ve Gizlilik Modeli

- **Uygulama Kabuğu Önbelleği (`public/sw.js`):** Üretim derlemesinde (`npm run build`) Service Worker `./sw.js` kaydı yapılır. Gezinme (`navigate`) isteklerinde ağ öncelikli + çevrimdışı `index.html` yedeği, statik varlıklarda (`manrope-variable.ttf`, `manifest.webmanifest`, simgeler, lisanslar) önbellek öncelikli strateji uygulanır.
- **Yerel Depolama Anahtarları (`localStorage`):** `morslab.draft`, `morslab.direction`, `morslab.alphabet`, `morslab.separator`, `morslab.speechLang`, `morslab.audio`, `morslab.history`, `morslab.practice`, `morslab.contacts`, `morslab.theme`. Bozuk veya şema dışı veriler uygulama açılışında güvenli varsayılanlara (`DEFAULT_AUDIO`) döndürülür.
- **Dosya İndirme Yaşam Döngüsü:** `createFileDownload` oluşturulan `Blob` URL'sini Safari/iOS kullanıcı onayı gecikmelerine karşı hemen iptal etmez; **60 saniyelik** koruma süresi (`DOWNLOAD_GRACE_PERIOD`) uygular ve önizleme kısıtlamalarına karşı doğrudan bağlantı / yeni sekme seçeneği sunar.

---

## 9. Erişilebilirlik (WCAG 2.1 AA) ve Klavye Kısayolları

- **Renk ve Kontrast:** Hem açık hem koyu temada metin ve arayüz öğeleri WCAG 2.1 AA kontrast eşiklerini ($\ge 4.5:1$) karşılayacak şekilde ayarlanmıştır ve `@axe-core/playwright` ile tüm sayfalarda otomatik denetlenmektedir.
- **Odak ve Diyalog Yönetimi:** Açılan pencereler yerel `<dialog>` (`showModal()`) kullanır; `Escape` tuşuyla veya arka plana tıklayarak kapanır. Mobil çekmece açıkken arka plan `inert` ile kilitlenir.
- **Hareket Azaltma:** `prefers-reduced-motion: reduce` tercihi olan kullanıcılar için sayfa ve arayüz geçişleri otomatik sadeleştirilir.

| Kısayol | Kapsam | İşlev |
|---|---|---|
| `Ctrl + Enter` / `Cmd + Enter` | Mors Çevirici | Mevcut Mors kodunu oynatır veya duraklatır |
| `Space` (basılı tutma) | Alıştırmalar → Maniple | Nokta (kısa) / çizgi (uzun) sinyali üretir |
| `Escape` | Tüm pencereler ve menüler | Açık diyaloğu, örnek menüsünü veya mobil çekmeceyi kapatır |

---

## 10. Bilinen Sınırlar, Masaüstü Sürümüyle Karşılaştırma ve Sorun Giderme

### 10.1 Web PWA vs. Masaüstü (.NET 10 / C99) Sürümü

| Özellik | MorsLab PWA (Bu Web Uygulaması) | MorsLab Masaüstü (`apps/MorseCore.*`) |
|---|---|---|
| Metin ↔ Mors, Profiller, Ayraç, Prosign | Tam destek (tarayıcıda çevrimdışı) | Tam destek (C99 native core) |
| CW Oynatma & PCM/WAV Üretimi | Web Audio API, 22.050 Hz 16-bit PCM | Yerel ses API'si (WASAPI/CoreAudio/ALSA) |
| Konuşma Tanıma (ASR) | Tarayıcı `SpeechRecognition` (internet gerektirebilir) | Yerel işletim sistemi / Whisper köprüsü |
| Sesli Okuma (TTS) | Tarayıcı `SpeechSynthesis` (sistem sesleri) | Çevrimdışı Piper VITS & EMA Lightning modelleri |
| CW Ses Çözümleme | Goertzel DSP + Histerezis (dosya & canlı mikrofon) | C99 Goertzel DSP + Akış çözücü |
| Fiziksel Telsiz Anahtarlama | Desteklenmez (tarayıcı kısıtı) | USB-UART DTR/RTS Seri Port Keyer |
| ADIF 3.1.4 Defteri | Tarayıcı `localStorage` | Yerel veritabanı + jeodezik harita |

### 10.2 Sık Karşılaşılan Durumlar ve Çözümler
- **WAV dosyası inmiyor:** Gömülü önizleme çerçeveleri (`iframe sandbox`) otomatik indirmeyi engelleyebilir. Çıktının altında beliren **Tekrar indir** veya **Dosyayı aç** bağlantılarını kullanın ya da **Uygulamayı yeni sekmede açın** bağlantısıyla tam sekmede indirin. iOS Safari'de açılan sistem onayında *İndir* seçeneğini onaylayın; mümkünse **Paylaş / Kaydet** ile *Dosyalar* uygulamasına kaydedin.
- **Konuşma tanıma çalışmıyor:** Firefox ve bazı gizlilik odaklı tarayıcılar `SpeechRecognition` API'sini sunmaz. Chrome/Edge kullanın veya doğrudan metin giriş alanına yazın; çevrimdışı modda metin girişi kesintisiz çalışır.
- **Ses dosyası çözümlenemedi:** Kayıt aşırı gürültülü, çoklu istasyonlu, konuşma içeren veya çok düşük genlikli olabilir. Maksimum süre **3 dakika (30 MB)** ile sınırlıdır; temiz, tek taşıyıcı frekanslı (300–1200 Hz) bir CW kaydı deneyin.

---

## 11. Lisans, Atıf ve Kaynaklar

- **Özgün Proje:** MorsLab © 2026 Mustafa Mert Akceylan & Murat Erman — [Apache License 2.0](../public/licenses/MorsLab-LICENSE.txt) · [NOTICE](../public/licenses/MorsLab-NOTICE.txt).
- **Yazı Tipi:** Manrope (SIL Open Font License 1.1 — [Manrope-OFL.txt](../public/licenses/Manrope-OFL.txt)).
- **Uluslararası Standartlar:** ITU-R M.1677-1 (International Morse code), ADIF 3.1.4 Specification.

### Akademik Atıf (BibTeX)

```bibtex
@software{MorsLab2026,
  author       = {Akceylan, Mustafa Mert and Erman, Murat},
  title        = {{MorsLab: A Cross-Platform Digital Signal Processing and Neural Acoustic Framework for Radiotelegraphy and Bidirectional Morse-Speech Telecommunications}},
  year         = {2026},
  publisher    = {GitHub},
  url          = {https://github.com/mserman90/MorsLab},
  license      = {Apache-2.0}
}
```
