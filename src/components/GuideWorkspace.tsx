import { useMemo, useState } from 'react';
import { ArrowRight, BookOpenText, Cpu, Keyboard, Layers, Radio, Search, ShieldCheck, SlidersHorizontal, Volume2 } from 'lucide-react';
import { EmptyState } from './Shared';

type GuideSectionId = 'all' | 'matrix' | 'theory' | 'dsp' | 'manual' | 'pwa' | 'limits';

const MATRIX_ROWS = [
  { id: '1', source: 'Düz Metin', target: 'Mors Metni', method: 'encodeMorse() · ITU-R M.1677-1 / Kiril / Arapça + Prosign', location: 'Mors Çevirici' },
  { id: '2', source: 'Düz Metin', target: 'Konuşma Sesi', method: 'speakText() · W3C SpeechSynthesis (5 dil)', location: 'Mors Çevirici (Sesli oku)' },
  { id: '3', source: 'Düz Metin', target: 'CW Mors Sesi', method: 'PARIS / Farnsworth PCM Sentez · 22.050 Hz WAV', location: 'Mors Çevirici (Morsu dinle / WAV)' },
  { id: '4', source: 'Mors Metni', target: 'Düz Metin', method: 'decodeMorse() · Ters tablo ve ayraç temizleme', location: 'Mors Çevirici / Ses Lab' },
  { id: '5', source: 'Mors Metni', target: 'Konuşma Sesi', method: 'Sembol çözümleme + SpeechSynthesis TTS', location: 'Mors Çevirici / Morstan Konuşmaya' },
  { id: '6', source: 'Mors Metni', target: 'CW Mors Sesi', method: 'AudioBufferSourceNode & 16-bit PCM WAV', location: 'Çevirici / Ses Lab / Alfabe' },
  { id: '7', source: 'Konuşma Sesi', target: 'Düz Metin', method: 'W3C SpeechRecognition (TR, EN, DE, RU, AR)', location: 'Ses Lab (Konuşmadan Morsa)' },
  { id: '8', source: 'Konuşma Sesi', target: 'Mors Metni', method: 'Gerçek zamanlı ASR → encodeMorse()', location: 'Ses Lab (Konuşmadan Morsa)' },
  { id: '9', source: 'Konuşma Sesi', target: 'CW Mors Sesi', method: 'ASR çıktısı → CW Oynatıcı & WAV dışa aktar', location: 'Ses Lab (Konuşmadan Morsa)' },
  { id: '10', source: 'CW Mors Sesi', target: 'Mors Metni', method: 'Goertzel Rezonatörü + Çift Eşikli Histerezis', location: 'Ses Lab (Dosya / Canlı Mikrofon)' },
  { id: '11', source: 'CW Mors Sesi', target: 'Düz Metin', method: 'Goertzel DSP → decodeMorse()', location: 'Ses Lab (Mors sesini çöz)' },
  { id: '12', source: 'CW Mors Sesi', target: 'Konuşma Sesi', method: 'Goertzel DSP → Metin → SpeechSynthesis TTS', location: 'Ses Lab (Çöz → Sesli oku)' },
];

const MANUAL_MODULES = [
  {
    name: '1. Mors Çevirici',
    summary: 'Anlık çift yönlü kodlama/çözümleme, ayraçlar (/ | # *), işletme işaretleri (<AR>, <SK>, <BT>, <AS>, <KN>, SOS), CW oynatıcı, sesli okuma ve 16-bit WAV indirme.',
    steps: [
      'Üst sekmeden Metin → Mors veya Mors → Metin yönünü seçin; ortadaki ok düğmesiyle çıktıyı girdiye aktarın.',
      'Alfabe menüsünden Uluslararası (ITU), Kiril veya Arapça profili seçin; kelime ayracını (/ | # *) belirleyin.',
      'Morsu dinle (Ctrl/Cmd + Enter) ile CW tonunu başlatın, dalga formundan istediğiniz noktaya sarın veya tekrar düğmesini açın.',
      'Sesli oku ile metni ya da çözümlenen Mors mesajını seslendirin; WAV indir ile 22.050 Hz mono PCM ses dosyasını kaydedin.',
    ],
  },
  {
    name: '2. Ses Laboratuvarı',
    summary: 'Konuşmadan Morsa (5 dil ASR), Morstan Konuşmaya (TTS) ve Mors Sesini Çöz (Dosya yükleme + Canlı Mikrofon CW DSP) alt araçlarını barındırır.',
    steps: [
      'Sağ üst dil menüsünden tr-TR, en-US, de-DE, ru-RU veya ar-SA seçin; alfabe profili ve seslendirme dili otomatik eşleşir.',
      'Konuşmadan Morsa sekmesinde mikrofondan konuşun (tarayıcı desteklemiyorsa metni elle yazın) ve anlık Mors / WAV üretin.',
      'Morstan Konuşmaya sekmesinde nokta/çizgi dizisi girip doğal insan sesiyle okutun veya CW tonu olarak dinleyin.',
      'Mors Sesini Çöz sekmesinde WAV/MP3/OGG dosyası yükleyin (en fazla 30 MB / 3 dk) ya da Canlı mikrofon CW ile hoparlörden gelen tek tonlu sinyali çözün.',
    ],
  },
  {
    name: '3. Alıştırmalar ve Etkileşimli Maniple',
    summary: 'Kulak eğitimi (Dinle ve keşfet) ile dokunmatik / Spacebar tabanlı CW gönderme pratiği (Maniple ile gönder).',
    steps: [
      'Dinle ve keşfet modunda seviyeyi (6 harf, 26 harf veya 10 rakam) seçip 10 soruluk turlarla karakter seslerini tanıyın.',
      'Maniple ile gönder sekmesinde MORS TUŞU düğmesine dokunarak veya klavyede Spacebar tuşuna basılı tutarak nokta (kısa) ve çizgi (uzun) gönderin.',
      'Duraklamalarda harf ayrımı ve kelime ayracı (/) otomatik eklenir; üretilen sinyali dinleyin, sesli okutun veya WAV indirin.',
    ],
  },
  {
    name: '4. Mors Alfabesi Sözlüğü & Çeviri Geçmişi',
    summary: 'Dinlenebilir karakter kartları, zamanlama ölçüleri (1–3–7 birim) ve yerel tarayıcı geçmişi (100 benzersiz kayıt).',
    steps: [
      'Mors Alfabesi sayfasında Harfler, Rakamlar veya Noktalama sekmelerini filtreleyin; bir karta dokunarak gerçek CW ritmini dinleyin.',
      'Çeviri Geçmişi sayfasında dinlediğiniz veya yer imine eklediğiniz kayıtları arayın, JSON olarak yedekleyin ya da tek tıkla çeviriciye geri yükleyin.',
    ],
  },
  {
    name: '5. İstasyon Defteri (ADIF 3.1.4) & Ayarlar',
    summary: 'Amatör telsiz QSO kayıtları, otomatik bant eşlemesi, Maidenhead konumu ve PWA kurulum/yedekleme yönetimi.',
    steps: [
      'Yeni bağlantı formuyla çağrı işareti, UTC tarih, frekans (otomatik 160m–70cm bant hesabı), mod, RST ve Maidenhead konumu ekleyin.',
      'ADIF al / ADIF indir düğmeleriyle ADIF 3.1.4 dosyalarını içe ve dışa aktarın.',
      'Ayarlar bölümünden Açık/Koyu/Sistem temasını seçin, uygulamayı cihazınıza kurun veya tüm morslab.* yerel verilerini JSON yedeği olarak indirin.',
    ],
  },
];

export default function GuideWorkspace({ onOpenPage }: { onOpenPage: (page: 'converter' | 'audio' | 'practice' | 'radio' | 'settings') => void }) {
  const [section, setSection] = useState<GuideSectionId>('all');
  const [query, setQuery] = useState('');

  const q = query.trim().toLocaleLowerCase('tr');
  const match = (...parts: string[]) => !q || parts.some((part) => part.toLocaleLowerCase('tr').includes(q));

  const showMatrix = (section === 'all' || section === 'matrix')
    && match('matris', '12 yön', 'modalite', ...MATRIX_ROWS.flatMap((row) => [row.source, row.target, row.method, row.location]));
  const showTheory = (section === 'all' || section === 'theory')
    && match('bilgi kuramı', 'entropi', 'shannon', 'paris', 'farnsworth', 'wpm', 'pcm', 'wav', 'normalizasyon', 'prosign', 'kiril', 'arapça', 'türkçe', 'itu');
  const showDsp = (section === 'all' || section === 'dsp')
    && match('goertzel', 'dsp', 'histerezis', 'schmitt', 'frekans', 'taşıyıcı', 'demodülasyon', 'filtre', 'mikrofon');
  const showManual = (section === 'all' || section === 'manual')
    && MANUAL_MODULES.some((mod) => match(mod.name, mod.summary, ...mod.steps));
  const showPwa = (section === 'all' || section === 'pwa')
    && match('pwa', 'çevrimdışı', 'service worker', 'önbellek', 'localstorage', 'gizlilik', 'kısayol', 'wcag', 'erişilebilirlik', 'ctrl', 'space');
  const showLimits = (section === 'all' || section === 'limits')
    && match('sınır', 'masaüstü', 'piper', 'seri port', 'sorun giderme', 'wav indir', 'safari', 'iframe', 'atıf', 'bibtex', 'lisans');

  const visibleModules = useMemo(
    () => MANUAL_MODULES.filter((mod) => match(mod.name, mod.summary, ...mod.steps)),
    [q],
  );

  const hasAny = showMatrix || showTheory || showDsp || showManual || showPwa || showLimits;

  const filters: [GuideSectionId, string][] = [
    ['all', 'Tümü'],
    ['matrix', '12 Yön Matrisi'],
    ['theory', 'Kuram & Zamanlama'],
    ['dsp', 'Goertzel DSP'],
    ['manual', 'Kullanım Adımları'],
    ['pwa', 'PWA & Kısayollar'],
    ['limits', 'Sınırlar & Atıf'],
  ];

  return <div className="tool-workspace guide-workspace">
    <div className="workspace-controls guide-controls">
      <div className="guide-filter-pills" role="tablist" aria-label="Kılavuz bölümleri">
        {filters.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={section === id}
            className={section === id ? 'active' : ''}
            onClick={() => setSection(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <label className="search-field guide-search">
        <Search size={15} />
        <input
          aria-label="Kılavuzda ara"
          placeholder="Konu, formül veya özellik ara"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
    </div>

    {!hasAny && (
      <EmptyState
        icon={<Search size={25} />}
        title="Kılavuzda eşleşme bulunamadı"
        description="Farklı bir anahtar kelime deneyin veya tüm bölümleri yeniden gösterin."
      >
        <button className="secondary-button" onClick={() => { setQuery(''); setSection('all'); }}>Tümünü göster</button>
      </EmptyState>
    )}

    <div className="guide-sections">
      {showMatrix && (
        <section className="guide-card" aria-labelledby="guide-matrix-heading">
          <div className="guide-card-header">
            <Layers size={18} />
            <div>
              <span className="field-caption">BÖLÜM 01 · MİMARİ</span>
              <h2 id="guide-matrix-heading">Çok Yönlü 4 Modalite × 12 Dönüşüm Matrisi</h2>
            </div>
          </div>
          <p className="guide-lead">
            MorsLab PWA; <strong>Düz Metin</strong>, <strong>Mors Metni (· / —)</strong>, <strong>Konuşma Sesi (ASR/TTS)</strong> ve <strong>CW Mors Sesi (PCM/WAV)</strong> modaliteleri arasındaki 12 yönlü geçişi tek tarayıcı çalışma alanında birleştirir.
          </p>
          <div className="table-scroll">
            <table className="contacts-table guide-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Kaynak Modalite</th>
                  <th>Hedef Modalite</th>
                  <th>Yöntem ve Standart</th>
                  <th>Çalışma Alanı</th>
                </tr>
              </thead>
              <tbody>
                {MATRIX_ROWS.map((row) => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td><strong>{row.source}</strong></td>
                    <td><strong>{row.target}</strong></td>
                    <td>{row.method}</td>
                    <td>{row.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {showTheory && (
        <section className="guide-card" aria-labelledby="guide-theory-heading">
          <div className="guide-card-header">
            <BookOpenText size={18} />
            <div>
              <span className="field-caption">BÖLÜM 02 · BİLGİ KURAMI VE ZAMANLAMA</span>
              <h2 id="guide-theory-heading">Entropi Kodlaması, Alfabe Profilleri ve PARIS / Farnsworth Analitiği</h2>
            </div>
          </div>
          <div className="guide-two-col">
            <article className="guide-subcard">
              <h3>Önek ve Entropi Kodlaması</h3>
              <p>
                Uluslararası Mors kodu (ITU-R M.1677-1), yüksek olasılıklı sembollere (<code>E → ·</code>, <code>T → —</code>) daha kısa iletim süresi atayarak beklenen sembol uzunluğunu en aza indirir. Harfler arası <code>3τ</code> ve kelimeler arası <code>7τ</code> sessizlik sınırları üçlü alfabe üzerinde tek anlamlı çözümleme sağlar.
              </p>
              <div className="guide-formula" aria-label="Beklenen sembol uzunluğu formülü">
                <code>𝔼[L] = ∑ P(sᵢ) · ℓ(sᵢ)</code>
                <span>Burada P(sᵢ) karakter olasılığını, ℓ(sᵢ) birim baud süresini gösterir.</span>
              </div>
            </article>

            <article className="guide-subcard">
              <h3>PARIS &amp; Farnsworth Zamanlaması</h3>
              <p>
                <code>&quot;PARIS &quot;</code> kelimesi tam 50 temel zaman birimi (<code>τ</code>) kabul edilir. Varsayılan hız 20 WPM&apos;de <code>τ = 60 ms</code>, dah <code>180 ms</code>, kelime aralığı <code>420 ms</code>&apos;dir. Farnsworth modunda karakter içi hız korunurken harf/kelime boşlukları efektif hız (<code>WPM_eff = max(5, round(0.6 · WPM))</code>) ile genişletilir.
              </p>
              <div className="guide-formula" aria-label="PARIS ve Farnsworth formülleri">
                <code>τ = 1200 / WPM (ms) · Dit = 1τ · Dah = 3τ · Harf = 3τ · Kelime = 7τ</code>
                <code>τ_boşluk = max(τ, (60 − 37.2 · (WPM_eff / WPM)) / (19 · WPM_eff))</code>
              </div>
            </article>
          </div>

          <div className="guide-two-col">
            <article className="guide-subcard">
              <h3>Çok Dilli Ortografik Normalizasyon</h3>
              <ul>
                <li><strong>Uluslararası (ITU):</strong> <code>A–Z</code>, <code>0–9</code> ve 18 noktalama işareti. Türkçe (<code>Ç→C, Ğ→G, İ→I, Ö→O, Ş→S, Ü→U</code>) ve Almanca (<code>Ä→A, Ö→O, Ü→U, ß→SS</code>) harfler otomatik uyarlanır.</li>
                <li><strong>Kiril (Rusça):</strong> 32 Kiril karakteri (<code>Ё→Е</code> normalizasyonu) + ortak rakam ve noktalama.</li>
                <li><strong>Arapça:</strong> 29 harf, hareke/tatvil temizliği, Doğu Arapça rakamların (<code>٠–٩ → 0–9</code>) ve noktalama işaretlerinin dönüştürülmesi, dinamik <code>dir=&quot;rtl&quot;</code> akışı.</li>
              </ul>
            </article>

            <article className="guide-subcard">
              <h3>Prosign&apos;lar ve PCM/WAV Sentezi</h3>
              <ul>
                <li><strong>İşletme İşaretleri:</strong> <code>&lt;AR&gt;</code> (<code>.-.-.</code>), <code>&lt;SK&gt;</code> (<code>...-.-</code>), <code>&lt;BT&gt;</code> (<code>-...-</code>), <code>&lt;AS&gt;</code> (<code>.-...</code>), <code>&lt;KN&gt;</code> (<code>-.--.</code>), <code>SOS</code> (<code>...---...</code>).</li>
                <li><strong>Anti-Click Zarfı:</strong> Her darbe başında ve sonunda <code>min(4 ms, L/4)</code> lineer yükselme/düşme rampası uygulanır.</li>
                <li><strong>WAV Çıktısı:</strong> 44 bayt RIFF/WAVE başlığıyla <strong>22.050 Hz, mono, 16-bit PCM</strong> (azami 180 sn / 3 dk).</li>
              </ul>
            </article>
          </div>
        </section>
      )}

      {showDsp && (
        <section className="guide-card" aria-labelledby="guide-dsp-heading">
          <div className="guide-card-header">
            <Cpu size={18} />
            <div>
              <span className="field-caption">BÖLÜM 03 · SAYISAL SİNYAL İŞLEME</span>
              <h2 id="guide-dsp-heading">Dar Bantlı Goertzel Rezonatörü ve Uyarlamalı Histerezis</h2>
            </div>
          </div>
          <p className="guide-lead">
            Tüm spektrumu hesaplayan FFT (<code>O(N log N)</code>) yerine hedef CW taşıyıcı frekansına (<code>f_c</code>) kilitlenen ikinci dereceden özyineli Goertzel filtresi (<code>O(N)</code>) kullanılır.
          </p>
          <div className="guide-pipeline" aria-label="Goertzel DSP işlem hattı">
            <div><strong>1. Frekans Kilidi</strong><span>25 ms pencerelerde 300–1200 Hz bandı (25 Hz adım) taranarak baskın taşıyıcı f_c belirlenir.</span></div>
            <ArrowRight size={14} className="pipeline-arrow" aria-hidden="true" />
            <div><strong>2. Goertzel Süzgeci</strong><span>10 ms pencereler / 5 ms adım ile hedef f_c enerjisi |X(f_c)| çıkarılır.</span></div>
            <ArrowRight size={14} className="pipeline-arrow" aria-hidden="true" />
            <div><strong>3. Schmitt Histerezisi</strong><span>θ_high = floor + 0.42·Δ ve θ_low = floor + 0.25·Δ ile ON/OFF ayrımı yapılır.</span></div>
            <ArrowRight size={14} className="pipeline-arrow" aria-hidden="true" />
            <div><strong>4. Süre Sınıflandırma</strong><span>20. yüzdelik dit kestirimiyle · / —, harf boşluğu ve / ayracı üretilir.</span></div>
          </div>
          <div className="guide-formula">
            <code>ω₀ = 2π·f_c / f_s · s[n] = x[n] + 2·cos(ω₀)·s[n−1] − s[n−2]</code>
            <code>|X(f_c)| = (2 / N) · √max(0, s[N−1]² + s[N−2]² − 2·cos(ω₀)·s[N−1]·s[N−2])</code>
          </div>
        </section>
      )}

      {showManual && (
        <section className="guide-card" aria-labelledby="guide-manual-heading">
          <div className="guide-card-header">
            <SlidersHorizontal size={18} />
            <div>
              <span className="field-caption">BÖLÜM 04 · ADIM ADIM KULLANIM KILAVUZU</span>
              <h2 id="guide-manual-heading">Çalışma Alanları ve İş Akışları</h2>
            </div>
          </div>
          <div className="guide-manual-list">
            {visibleModules.map((mod) => (
              <article className="guide-subcard" key={mod.name}>
                <h3>{mod.name}</h3>
                <p>{mod.summary}</p>
                <ol className="guide-step-list">
                  {mod.steps.map((step) => <li key={step}>{step}</li>)}
                </ol>
              </article>
            ))}
          </div>
          <div className="guide-quick-links">
            <button className="secondary-button" onClick={() => onOpenPage('converter')}>Mors çeviriciyi aç<ArrowRight size={14} /></button>
            <button className="secondary-button" onClick={() => onOpenPage('audio')}><Volume2 size={14} />Ses laboratuvarına git</button>
            <button className="secondary-button" onClick={() => onOpenPage('practice')}><Keyboard size={14} />Maniple &amp; alıştırmalar</button>
            <button className="secondary-button" onClick={() => onOpenPage('radio')}><Radio size={14} />İstasyon defteri</button>
          </div>
        </section>
      )}

      {showPwa && (
        <section className="guide-card" aria-labelledby="guide-pwa-heading">
          <div className="guide-card-header">
            <ShieldCheck size={18} />
            <div>
              <span className="field-caption">BÖLÜM 05 · PWA, GİZLİLİK VE ERİŞİLEBİLİRLİK</span>
              <h2 id="guide-pwa-heading">Çevrimdışı Mimari, Klavye Kısayolları ve Yerel Depolama</h2>
            </div>
          </div>
          <div className="guide-two-col">
            <article className="guide-subcard">
              <h3>Çevrimdışı Önbellek ve Veri Kalıcılığı</h3>
              <p>
                Üretim sürümünde Service Worker (<code>sw.js</code>) uygulama kabuğunu, yerel <code>Manrope</code> yazı tipini, ikonları ve lisans dosyalarını cihazda önbelleğe alır. Tüm veriler yalnızca <code>localStorage</code> üzerinde (<code>morslab.*</code> anahtarlarıyla, geçmişte son 100 benzersiz kayıt) tutulur; şema dışı bozuk değerler güvenli varsayılanlara döndürülür.
              </p>
            </article>
            <article className="guide-subcard">
              <h3>Klavye Kısayolları ve WCAG 2.1 AA</h3>
              <ul>
                <li><code>Ctrl / Cmd + Enter</code>: Mors Çevirici içinde mevcut CW sesini oynatır veya duraklatır.</li>
                <li><code>Space (Basılı Tutma)</code>: Maniple sekmesinde canlı nokta / çizgi sinyali üretir.</li>
                <li><code>Escape</code>: Açık pencereleri, örnek menüsünü veya mobil çekmeceyi kapatır.</li>
                <li><strong>Erişilebilirlik:</strong> Açık/koyu tema AA kontrast oranları, yerel <code>&lt;dialog&gt;</code> odak yönetimi ve <code>prefers-reduced-motion</code> desteği.</li>
              </ul>
            </article>
          </div>
        </section>
      )}

      {showLimits && (
        <section className="guide-card" aria-labelledby="guide-limits-heading">
          <div className="guide-card-header">
            <ShieldCheck size={18} />
            <div>
              <span className="field-caption">BÖLÜM 06 · SINIRLAR, SORUN GİDERME VE ATIF</span>
              <h2 id="guide-limits-heading">Mimari Sınırlar, Pratik Çözümler ve Akademik Referans</h2>
            </div>
          </div>
          <div className="guide-two-col">
            <article className="guide-subcard">
              <h3>Web PWA Sınırları (Masaüstü Sürümüyle Farklar)</h3>
              <ul>
                <li><strong>Yerel Nöral Modeller:</strong> Masaüstü (.NET 10) sürümündeki çevrimdışı Piper VITS / EMA Lightning ses paketleri web sürümünde bulunmaz; web arayüzü tarayıcının <code>SpeechSynthesis</code> motorunu ve çevrimiçi olabilen <code>SpeechRecognition</code> API&apos;sini kullanır.</li>
                <li><strong>Donanım Arayüzü:</strong> Tarayıcı güvenlik modeli USB-UART DTR/RTS seri port telsiz anahtarlamasını desteklemez; bu işlev masaüstü uygulamasına özgüdür.</li>
                <li><strong>CW Çözümleme Sınırları:</strong> En fazla 30 MB / 180 sn dosya kabul edilir; Goertzel algoritması temiz, tek tonlu CW kayıtları için optimize edilmiştir.</li>
              </ul>
            </article>
            <article className="guide-subcard">
              <h3>Sorun Giderme ve Hızlı Çözümler</h3>
              <ul>
                <li><strong>WAV İndirilemiyorsa:</strong> Oluşturulan dosyanın altında beliren <em>Tekrar indir</em> veya <em>Dosyayı aç</em> bağlantısını kullanın. Önizleme çerçevesi (iframe) indirmeyi kısıtlıyorsa <em>Uygulamayı yeni sekmede açın</em> bağlantısına tıklayın; mobil cihazlarda <em>Paylaş / Kaydet</em> menüsünü seçin.</li>
                <li><strong>Konuşma Tanıma Desteklenmiyorsa:</strong> Chrome veya Edge kullanın ya da aynı alandaki metin giriş kutusuna doğrudan yazarak çevrimdışı dönüşüm yapın.</li>
                <li><strong>Veri Yedekleme:</strong> Ayarlar sayfasından <em>Yedek indir</em> (JSON) ve İstasyon Defteri&apos;nden <em>ADIF indir</em> ile kayıtlarınızı dışa aktarın.</li>
              </ul>
            </article>
          </div>
          <div className="guide-citation">
            <strong>Akademik Atıf:</strong> Akceylan, M. M. &amp; Erman, M. (2026). <em>MorsLab: A Cross-Platform Digital Signal Processing and Neural Acoustic Framework for Radiotelegraphy and Bidirectional Morse-Speech Telecommunications.</em> GitHub, Apache-2.0.
            <button className="text-button" onClick={() => onOpenPage('settings')}>Ayarlar ve lisanslar<ArrowRight size={13} /></button>
          </div>
        </section>
      )}
    </div>
  </div>;
}
