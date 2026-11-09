import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { ArrowDownToLine, ArrowRight, AudioLines, BookOpen, Check, ChevronRight, CircleHelp, FileText, Globe2, GraduationCap, History, Info, LaptopMinimal, Menu, MonitorDown, NotebookPen, PanelLeft, Radio, Settings2, ShieldCheck, Smartphone, WifiOff, X } from 'lucide-react';
import Converter from './components/Converter';
import AudioLab from './components/AudioLab';
import GuideWorkspace from './components/GuideWorkspace';
import { QsoWorkspace } from './components/QsoWorkspace';
import { AlphabetWorkspace, HelpContent, HistoryWorkspace, PracticeWorkspace, RadioWorkspace, SettingsWorkspace } from './components/Workspaces';
import { BrandMark, Modal } from './components/Shared';
import { useMorseAudio } from './hooks/useMorseAudio';
import { usePersistentState } from './hooks/usePersistentState';
import { usePwa } from './hooks/usePwa';
import { DEFAULT_AUDIO, type Alphabet, type AudioSettings, type HistoryEntry, type Separator } from './lib/morse';
import { alphabetForSpeechLang, type SpeechLang } from './lib/speech';

const PAGES = {
  converter: { label: 'Mors çevirici', eyebrow: 'BİR FİKRİ SİNYALE DÖNÜŞTÜRÜN', title: 'Kelimelerden sinyallere.', description: 'Yazın, dinleyin, bağlantı kurun. İletişimin en yalın halini keşfedin.', icon: ArrowLeftRightIcon },
  audio: { label: 'Ses laboratuvarı', eyebrow: 'SESİNİZİN YENİ BİR DİLİ VAR', title: 'Sesi keşfedin. Sinyali bulun.', description: 'Konuşmanızı Morsa dönüştürün veya bir CW kaydının ardındaki mesajı çözün.', icon: AudioLines },
  practice: { label: 'Alıştırmalar', eyebrow: 'HER GÜN KÜÇÜK BİR ADIM', title: 'Morsun ritmini yakalayın.', description: 'Sesleri tanıyın, kulaklarınıza güvenin. Yeni bir dil öğrenmenin keyfine varın.', icon: GraduationCap },
  qso: { label: 'Canlı QSO odası', eyebrow: 'SANAL AMATÖR TELSİZ FREKANSI', title: 'Gerçek zamanlı Mors QSO.', description: 'Aynı frekansa bağlanın (örn. 7.030 kHz), çağrı işaretinizi girin ve karşılıklı Mors kodu ile canlı görüşme yapın.', icon: Radio },
  alphabet: { label: 'Mors alfabesi', eyebrow: 'BİR NOKTA, BİR ÇİZGİ, BİR ANLAM', title: 'Sinyallerin küçük sözlüğü.', description: 'Her karakterin bir ritmi var. Bir harfe dokunun, sesini keşfedin.', icon: BookOpen },
  history: { label: 'Çeviri geçmişi', eyebrow: 'SİNYALİNİZ KAYBOLMASIN', title: 'Mesajlarınıza geri dönün.', description: 'Dinlediğiniz ve kaydettiğiniz çeviriler, yalnızca bu cihazda güvende.', icon: History },
  radio: { label: 'İstasyon defteri', eyebrow: 'DÜNYAYLA BAĞLANTI KURUN', title: 'Bağlantılarınızın hikayesi.', description: 'Her çağrı yeni bir tanışma. Telsiz bağlantılarınızı tek bir yerde saklayın.', icon: NotebookPen },
  guide: { label: 'Kullanım kılavuzu', eyebrow: 'TEKNİK AÇIKLAMA VE KILAVUZ', title: 'Kuramdan uygulamaya MorsLab.', description: '12 yönlü dönüşüm matrisi, PARIS/Farnsworth matematiği, Goertzel DSP ve adım adım rehber.', icon: FileText },
  settings: { label: 'Ayarlar', eyebrow: 'TAM SİZİN FREKANSINIZDA', title: 'Kendi ritminizi bulun.', description: 'MorsLab deneyimini kişiselleştirin. Her tercih, bu cihazda size ait.', icon: Settings2 },
};

function ArrowLeftRightIcon({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4" /></svg>;
}

function Github({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 6v-3.9a3.4 3.4 0 0 0-.9-2.6c3-.3 6.1-1.5 6.1-6.9a5.4 5.4 0 0 0-1.5-3.8 5 5 0 0 0-.1-3.8s-1.2-.4-4 1.5a13.4 13.4 0 0 0-7.2 0C4.6.6 3.4 1 3.4 1a5 5 0 0 0-.1 3.8 5.4 5.4 0 0 0-1.5 3.8c0 5.4 3.1 6.6 6.1 6.9a3.4 3.4 0 0 0-.9 2.6V22" /></svg>;
}

type Page = keyof typeof PAGES;
const pageFromHash = () => {
  const hash = window.location.hash.slice(1);
  return hash in PAGES ? hash as Page : 'converter';
};

export default function App() {
  const [page, setPage] = useState<Page>(pageFromHash);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.matchMedia('(max-width: 760px)').matches);
  const [helpOpen, setHelpOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; id: number } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [input, setInput] = usePersistentState('morslab.draft', 'Merhaba dünya');
  const [direction, setDirection] = usePersistentState<'encode' | 'decode'>('morslab.direction', 'encode');
  const [alphabet, setAlphabet] = usePersistentState<Alphabet>('morslab.alphabet', 'latin');
  const [separator, setSeparator] = usePersistentState<Separator>('morslab.separator', '/');
  const [speechLang, setSpeechLang] = usePersistentState<SpeechLang>('morslab.speechLang', 'tr-TR');
  const [settings, setSettings] = usePersistentState<AudioSettings>('morslab.audio', { ...DEFAULT_AUDIO });
  const [entries, setEntries] = usePersistentState<HistoryEntry[]>('morslab.history', []);
  const [theme, setTheme] = usePersistentState('morslab.theme', 'light');
  const audio = useMorseAudio(settings);
  const pwa = usePwa();
  const current = PAGES[page];

  const notify = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, id: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), 5500);
  }, []);

  const navigate = useCallback((next: Page) => {
    audio.stop();
    setPage(next);
    window.location.hash = next;
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [audio.stop]);

  useEffect(() => {
    const listener = () => { audio.stop(); setPage(pageFromHash()); setMobileOpen(false); };
    window.addEventListener('hashchange', listener);
    return () => window.removeEventListener('hashchange', listener);
  }, [audio.stop]);

  useEffect(() => { document.title = `${current.label} | MorsLab`; }, [current.label]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)');
    const update = () => { setIsMobile(media.matches); if (!media.matches) setMobileOpen(false); };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => { document.documentElement.dataset.theme = theme === 'system' ? media.matches ? 'dark' : 'light' : theme; };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [theme]);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobileOpen(false); };
    document.addEventListener('keydown', close);
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => document.querySelector<HTMLButtonElement>('.sidebar .nav-item.active')?.focus(), 100);
    return () => { document.removeEventListener('keydown', close); document.body.style.overflow = oldOverflow; window.clearTimeout(focusTimer); };
  }, [mobileOpen]);

  const saveEntry = useCallback((entry: Omit<HistoryEntry, 'id' | 'createdAt'>) => {
    setEntries((previous) => [{ ...entry, id: crypto.randomUUID(), createdAt: new Date().toISOString() }, ...previous.filter((item) => !(item.input === entry.input && item.direction === entry.direction && item.alphabet === entry.alphabet))].slice(0, 100));
  }, [setEntries]);

  const install = async () => {
    if (pwa.installed) { notify('MorsLab bu cihazda zaten yüklü.'); return; }
    if (pwa.canInstall) {
      try { if (await pwa.install()) notify('MorsLab cihazınıza yüklendi. İyi bağlantılar!'); }
      catch { setInstallOpen(true); }
    } else setInstallOpen(true);
  };

  const openConverter = (text: string, nextDirection: 'encode' | 'decode', nextAlphabet?: Alphabet) => {
    setInput(text);
    setDirection(nextDirection);
    setAlphabet(nextAlphabet ?? alphabetForSpeechLang(speechLang));
    navigate('converter');
  };

  const renderNav = (items: Page[]) => items.map((key) => {
    const Icon = PAGES[key].icon;
    return <button key={key} className={`nav-item ${page === key ? 'active' : ''}`} onClick={() => navigate(key)} aria-current={page === key ? 'page' : undefined}>
      {page === key && <motion.span className="nav-active-background" layoutId="active-nav" transition={{ type: 'spring', stiffness: 420, damping: 38 }} />}
      <span className="nav-item-content"><Icon size={18} /><span>{PAGES[key].label}</span>{key === 'history' && entries.length > 0 && <span className="nav-count">{entries.length}</span>}</span>
    </button>;
  });

  return <MotionConfig reducedMotion="user"><div className="app-shell">
    <a className="skip-link" href="#main-content">İçeriğe geç</a>
    {mobileOpen && <button className="sidebar-backdrop" aria-label="Gezinme menüsünü kapat" onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`} aria-label="Ana gezinme" inert={isMobile && !mobileOpen} aria-hidden={isMobile && !mobileOpen ? true : undefined}>
      <button className="brand" onClick={() => navigate('converter')} aria-label="MorsLab ana sayfa"><BrandMark /><span>MorsLab<span className="brand-period">.</span></span></button>
      <p className="brand-tagline">İletişimin en yalın hali.</p>
      <nav className="main-navigation"><p className="nav-caption">ÇALIŞMA ALANI</p>{renderNav(['converter', 'audio', 'practice', 'qso', 'alphabet'])}<div className="nav-separator" /><p className="nav-caption">SİZE AİT</p>{renderNav(['history', 'radio', 'guide'])}</nav>
      <div className="sidebar-bottom"><div className="settings-navigation">{renderNav(['settings'])}</div>
        <div className="install-prompt"><div className="install-prompt-icon"><LaptopMinimal size={23} /><Smartphone size={13} /></div><h3>{pwa.installed ? 'Sinyaliniz hep yanınızda.' : 'Bir sekmeden fazlası.'}</h3><p>{pwa.installed ? 'MorsLab cihazınıza yüklendi. Çevrimdışı da keşfetmeye devam edin.' : 'Yükleyin, çevrimdışı da kullanın. MorsLab hep yanınızda olsun.'}</p><button onClick={() => void install()}>{pwa.installed ? <Check size={14} /> : <ArrowDownToLine size={14} />}{pwa.installed ? 'Uygulama yüklü' : 'Uygulamayı yükle'}<ArrowRight size={13} /></button></div>
        <div className="sidebar-footer"><a href="https://github.com/mserman90/MorsLab" target="_blank" rel="noreferrer"><Github size={15} /><span>Açık kaynak, açık iletişim.</span></a><span className="app-version">v2.2.0 <i />PWA</span></div>
      </div>
    </aside>

    <div className="main-shell" inert={isMobile && mobileOpen}>
      <header className="topbar">
        <div className="breadcrumb">
          <button className="icon-button mobile-menu-button" aria-label="Gezinme menüsünü aç" aria-expanded={mobileOpen} onClick={() => setMobileOpen(!mobileOpen)}><Menu size={21} /></button>
          <button className="mobile-wordmark" onClick={() => navigate('converter')} aria-label="MorsLab ana sayfa"><BrandMark /><span>MorsLab.</span></button>
          <PanelLeft size={15} className="breadcrumb-icon" /><span>Çalışma alanı</span><ChevronRight size={12} /><strong>{current.label}</strong>
        </div>
        <div className="topbar-actions">
          <span className={`connection-status ${pwa.offline ? 'offline' : ''}`}>{pwa.offline ? <WifiOff size={13} /> : <i />}<span>{pwa.offline ? 'Çevrimdışı mod' : pwa.ready ? 'Çevrimdışı kullanıma hazır' : 'Cihazınızda güvenle çalışır'}</span></span>
          <span className="topbar-divider" /><button className="icon-button topbar-help" aria-label="MorsLab hakkında yardım" onClick={() => setHelpOpen(true)}><CircleHelp size={18} /></button>
          <span className="language-label" title="Arayüz dili: Türkçe"><Globe2 size={15} /><span>TR</span></span>
        </div>
      </header>

      <main id="main-content" className="main-content" tabIndex={-1}>
        <AnimatePresence mode="wait"><motion.div key={page} initial={{ opacity: 0, y: 9 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.23, ease: [0.22, 1, 0.36, 1] }}>
          <div className="page-heading"><div><p className="eyebrow">{current.eyebrow}</p><h1>{current.title}</h1><p className="page-description">{current.description}</p></div><button className="guide-button" onClick={() => setHelpOpen(true)}><CircleHelp size={15} />Nasıl çalışır?</button></div>
          {page === 'converter' && <Converter input={input} setInput={setInput} direction={direction} setDirection={setDirection} alphabet={alphabet} setAlphabet={setAlphabet} separator={separator} setSeparator={setSeparator} speechLang={speechLang} setSpeechLang={setSpeechLang} settings={settings} setSettings={setSettings} audio={audio} notify={notify} onSave={saveEntry} onPractice={() => navigate('practice')} onOpenAudioLab={() => navigate('audio')} />}
          {page === 'audio' && <AudioLab audio={audio} settings={settings} setSettings={setSettings} speechLang={speechLang} setSpeechLang={setSpeechLang} separator={separator} notify={notify} onOpen={openConverter} />}
          {page === 'alphabet' && <AlphabetWorkspace audio={audio} notify={notify} />}
          {page === 'practice' && <PracticeWorkspace audio={audio} settings={settings} onSettings={setSettings} notify={notify} onOpen={openConverter} />}
          {page === 'qso' && <QsoWorkspace audio={audio} settings={settings} notify={notify} onOpenLogbook={() => navigate('radio')} />}
          {page === 'history' && <HistoryWorkspace entries={entries} onDelete={(id) => setEntries((previous) => previous.filter((entry) => entry.id !== id))} onRestore={(entry) => { setInput(entry.input); setDirection(entry.direction); setAlphabet(entry.alphabet); navigate('converter'); }} onClear={() => { setEntries([]); notify('Çeviri geçmişi temizlendi.'); }} notify={notify} />}
          {page === 'radio' && <RadioWorkspace notify={notify} />}
          {page === 'guide' && <GuideWorkspace onOpenPage={(target) => navigate(target)} />}
          {page === 'settings' && <SettingsWorkspace settings={settings} onSettings={setSettings} theme={theme} onTheme={setTheme} onInstall={() => void install()} installed={pwa.installed} notify={notify} />}
        </motion.div></AnimatePresence>
        <footer className="workspace-footer"><span><span className="footer-signal" />Daha az gürültü. Daha çok bağlantı.</span><span>Sevgiyle geliştirildi, herkes için açık.<a href="https://github.com/mserman90/MorsLab" aria-label="GitHub kaynak deposu" target="_blank" rel="noreferrer"><Github size={13} /></a></span></footer>
      </main>
    </div>

    <AnimatePresence>{toast && <motion.div className="toast" role="status" aria-live="polite" key={toast.id} initial={{ opacity: 0, y: 18, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: 8, x: '-50%' }} transition={{ duration: 0.2 }}><Info size={17} /><span>{toast.message}</span><button className="icon-button small" onClick={() => setToast(null)} aria-label="Bildirimi kapat"><X size={15} /></button></motion.div>}</AnimatePresence>
    {helpOpen && <Modal title="MorsLab'a hoş geldiniz." onClose={() => setHelpOpen(false)}><HelpContent onOpenFullGuide={() => { setHelpOpen(false); navigate('guide'); }} /></Modal>}
    {installOpen && <Modal title="MorsLab, hep yanınızda." onClose={() => setInstallOpen(false)}><div className="install-modal-intro"><BrandMark /><p>Bir kez açın. Her yerde bağlantı kurun.<br /><span>Ücretsiz, hafif ve çevrimdışı kullanıma hazır.</span></p></div><div className="install-instructions"><div><MonitorDown size={23} /><h3>Bilgisayar ve Android</h3><p>Chrome veya Edge menüsünü açın. <strong>“MorsLab uygulamasını yükle”</strong> ya da <strong>“Ana ekrana ekle”</strong> seçeneğini seçin. Adres çubuğundaki yükleme simgesini de kullanabilirsiniz.</p></div><div><Smartphone size={23} /><h3>iPhone ve iPad</h3><p>Bu sayfayı Safari'de açın. <strong>Paylaş</strong> menüsüne dokunun, ardından <strong>“Ana Ekrana Ekle”</strong> seçeneğini seçin.</p></div></div><div className="install-ready-note"><ShieldCheck size={16} /><p>{pwa.ready ? 'Uygulama önbelleği hazır. Bağlantı kesildiğinde temel araçlar çalışmaya devam eder.' : 'Çevrimdışı kullanım için uygulamayı HTTPS üzerinden veya localhost üzerinde bir kez çevrimiçi açın.'}</p></div><button className="primary-button full-width-button" onClick={() => setInstallOpen(false)}>Keşfetmeye devam et<ArrowRight size={15} /></button></Modal>}
  </div></MotionConfig>;
}
