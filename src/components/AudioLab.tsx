import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowRight, AudioLines, Check, ChevronDown, Copy, ExternalLink, FileAudio2, Info, LoaderCircle, Mic, MicOff, Pause, Play, Radio, Share2, Square, Upload, Volume2, X } from 'lucide-react';
import { cleanMorse, createWav, decodeAudioSignal, decodeMorse, encodeMorse, goertzelMagnitude, type Alphabet, type AudioSettings, type Separator } from '../lib/morse';
import { createFileDownload, type FileDownload } from '../lib/download';
import { SPEECH_LANGUAGES, alphabetForSpeechLang, speakText, stopSpeaking, type SpeechLang } from '../lib/speech';
import type { MorseAudio } from '../hooks/useMorseAudio';
import { WaterfallDisplay } from './WaterfallDisplay';

interface BrowserRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type Props = {
  audio: MorseAudio;
  settings: AudioSettings;
  setSettings?: (settings: AudioSettings) => void;
  speechLang: SpeechLang;
  setSpeechLang: (lang: SpeechLang) => void;
  separator: Separator;
  notify: (message: string) => void;
  onOpen: (input: string, direction: 'encode' | 'decode', alphabet?: Alphabet) => void;
};

type Mode = 'speech' | 'morseToSpeech' | 'file';

export default function AudioLab({ audio, settings, setSettings, speechLang, setSpeechLang, separator, notify, onOpen }: Props) {
  const [mode, setMode] = useState<Mode>('speech');
  const [cwInputMode, setCwInputMode] = useState<'upload' | 'live'>('upload');
  const [transcript, setTranscript] = useState('');
  const [morseInput, setMorseInput] = useState('... --- ...');
  const [morse, setMorse] = useState('');
  const [filename, setFilename] = useState('');
  const [listening, setListening] = useState(false);
  const [liveCwActive, setLiveCwActive] = useState(false);
  const [signalLevel, setSignalLevel] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState('Mikrofonu açın veya mesajınızı yazarak başlayın.');
  const [wavFile, setWavFile] = useState<{ file: File; download: FileDownload } | null>(null);

  const recognition = useRef<BrowserRecognition | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const wavDownload = useRef<FileDownload | null>(null);
  const liveStream = useRef<MediaStream | null>(null);
  const liveAudioCtx = useRef<AudioContext | null>(null);
  const liveTimer = useRef<number | null>(null);
  const liveLetterTimer = useRef<number | null>(null);
  const liveWordTimer = useRef<number | null>(null);

  const activeAlphabet = alphabetForSpeechLang(speechLang);
  const isRtl = speechLang === 'ar-SA';
  const speechCode = encodeMorse(transcript, activeAlphabet, separator);
  const morseFromUser = cleanMorse(morseInput);

  const resultMorse = mode === 'speech' ? speechCode : mode === 'morseToSpeech' ? morseFromUser : morse;
  const plainText = mode === 'speech'
    ? transcript
    : mode === 'morseToSpeech'
      ? decodeMorse(morseFromUser, activeAlphabet)
      : decodeMorse(morse, activeAlphabet);
  const playingResult = audio.playing && audio.code === resultMorse;
  let canShareWav = false;
  try { canShareWav = !!wavFile && !!navigator.share && !!navigator.canShare?.({ files: [wavFile.file] }); } catch { /* Frame sandbox can disable share. */ }

  const stopLiveCw = () => {
    setLiveCwActive(false);
    setSignalLevel(0);
    if (liveTimer.current) { window.clearInterval(liveTimer.current); liveTimer.current = null; }
    if (liveLetterTimer.current) { window.clearTimeout(liveLetterTimer.current); liveLetterTimer.current = null; }
    if (liveWordTimer.current) { window.clearTimeout(liveWordTimer.current); liveWordTimer.current = null; }
    if (liveStream.current) {
      liveStream.current.getTracks().forEach((track) => track.stop());
      liveStream.current = null;
    }
    if (liveAudioCtx.current) {
      void liveAudioCtx.current.close();
      liveAudioCtx.current = null;
    }
  };

  useEffect(() => () => {
    if (recognition.current) {
      recognition.current.onend = null;
      recognition.current.onerror = null;
      recognition.current.onresult = null;
      recognition.current.abort();
    }
    stopLiveCw();
    stopSpeaking();
    wavDownload.current?.dispose();
  }, []);

  const toggleMic = () => {
    if (listening) { recognition.current?.stop(); return; }
    const browser = window as unknown as { SpeechRecognition?: new () => BrowserRecognition; webkitSpeechRecognition?: new () => BrowserRecognition };
    const Recognition = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    if (!Recognition) {
      setStatus('Bu tarayıcı konuşma tanımayı desteklemiyor. Chrome veya Edge kullanın ya da metninizi yazın.');
      return;
    }
    if (!navigator.onLine) { setStatus('Tarayıcınızın konuşma tanıma hizmeti internet bağlantısı gerektirebilir. Metin girişi çevrimdışı kullanılabilir.'); return; }
    const instance = new Recognition();
    instance.lang = speechLang;
    instance.continuous = true;
    instance.interimResults = true;
    instance.onresult = (event) => setTranscript(Array.from(event.results).map((part) => part[0].transcript).join(' '));
    instance.onend = () => { setListening(false); setStatus('Dinleme tamamlandı. Mesajınızı düzenleyebilir veya Mors olarak dinleyebilirsiniz.'); };
    instance.onerror = (event) => {
      setListening(false);
      const message = event.error === 'not-allowed' ? 'Mikrofon izni verilmedi. Tarayıcı ayarlarından izin verebilirsiniz.' : event.error === 'no-speech' ? 'Konuşma algılanmadı. Tekrar deneyin.' : 'Konuşma hizmetine ulaşılamadı. Bağlantınızı kontrol edin veya metninizi yazın.';
      setStatus(message);
      instance.onend = null;
    };
    recognition.current = instance;
    try {
      instance.start();
      setListening(true);
      const langLabel = SPEECH_LANGUAGES.find((item) => item.value === speechLang)?.label || speechLang;
      setStatus(`Dinleniyor (${langLabel})... Konuşmanız anında Morsa dönüştürülür.`);
    } catch {
      setStatus('Mikrofon başlatılamadı. Tarayıcı izinlerini kontrol edin.');
    }
  };

  const toggleLiveCw = async () => {
    if (liveCwActive) {
      stopLiveCw();
      setStatus('Canlı CW mikrofon dinlemesi durduruldu.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('Tarayıcınız canlı mikrofon erişimini desteklemiyor.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const ctx = new AudioContext();
      await ctx.resume();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);

      liveStream.current = stream;
      liveAudioCtx.current = ctx;
      setLiveCwActive(true);
      setMorse('');
      setFilename('');
      setStatus(`Canlı Goertzel DSP dinleniyor (${settings.frequency} Hz · ${settings.wpm} WPM)...`);

      const pcm = new Float32Array(analyser.fftSize);
      const unitMs = 1200 / settings.wpm;
      let isOn = false;
      let stateStart = performance.now();
      let noiseFloor = 0.01;

      liveTimer.current = window.setInterval(() => {
        analyser.getFloatTimeDomainData(pcm);
        const mag = goertzelMagnitude(pcm, 0, pcm.length, ctx.sampleRate, settings.frequency);
        const normalized = Math.min(100, Math.round(mag * 320));
        setSignalLevel(normalized);

        if (!isOn) noiseFloor = noiseFloor * 0.92 + mag * 0.08;
        const thresholdHigh = Math.max(0.025, noiseFloor * 3.0);
        const thresholdLow = Math.max(0.015, noiseFloor * 2.0);
        const detected = isOn ? mag >= thresholdLow : mag >= thresholdHigh;
        const now = performance.now();

        if (detected !== isOn) {
          const duration = now - stateStart;
          if (duration > 22) {
            if (isOn) {
              const symbol = duration < Math.max(120, unitMs * 2) ? '.' : '-';
              setMorse((previous) => previous + symbol);
              if (liveLetterTimer.current) window.clearTimeout(liveLetterTimer.current);
              if (liveWordTimer.current) window.clearTimeout(liveWordTimer.current);
              liveLetterTimer.current = window.setTimeout(() => {
                setMorse((previous) => (previous && !previous.endsWith(' ') && !previous.endsWith('/') ? `${previous} ` : previous));
              }, Math.max(260, unitMs * 3));
              liveWordTimer.current = window.setTimeout(() => {
                setMorse((previous) => {
                  const trimmed = previous.trim();
                  return trimmed && !trimmed.endsWith('/') ? `${trimmed} / ` : previous;
                });
              }, Math.max(700, unitMs * 6.8));
            } else {
              if (liveLetterTimer.current) { window.clearTimeout(liveLetterTimer.current); liveLetterTimer.current = null; }
              if (liveWordTimer.current) { window.clearTimeout(liveWordTimer.current); liveWordTimer.current = null; }
            }
            isOn = detected;
            stateStart = now;
          }
        }
      }, 20);
    } catch {
      stopLiveCw();
      setStatus('Mikrofon izni verilmedi veya mikrofon bulunamadı.');
    }
  };

  const analyze = async (file: File) => {
    if (file.size > 30 * 1024 * 1024) { notify('Lütfen 30 MB veya daha küçük bir ses dosyası seçin.'); return; }
    stopLiveCw();
    setBusy(true);
    setFilename(file.name);
    setMorse('');
    let context: AudioContext | null = null;
    try {
      context = new AudioContext();
      const buffer = await context.decodeAudioData(await file.arrayBuffer());
      if (buffer.duration > 180) throw new Error('En fazla 3 dakikalık bir kayıt yükleyin.');
      const decoded = decodeAudioSignal(buffer.getChannelData(0), buffer.sampleRate, settings.wpm, settings.frequency);
      if (!decoded.morse) throw new Error('Mors sinyali algılanamadı. Daha temiz veya daha yüksek sesli bir kayıt deneyin.');
      setMorse(decoded.morse);
      setStatus(`${file.name} çözümlendi (${buffer.duration.toFixed(1)} sn · Goertzel DSP ~${decoded.detectedFreq} Hz).`);
      notify('Ses çözümlemesi tamamlandı.');
    } catch (error) { setStatus(error instanceof Error && error.name !== 'EncodingError' ? error.message : 'Dosya okunamadı. Geçerli bir WAV, MP3 veya OGG dosyası seçin.'); }
    finally { await context?.close(); setBusy(false); if (fileInput.current) fileInput.current.value = ''; }
  };

  const toggleSpeak = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    audio.stop();
    speakText(plainText, speechLang, {
      onStart: () => setSpeaking(true),
      onEnd: () => setSpeaking(false),
      onError: (message) => { setSpeaking(false); notify(message); },
    });
  };

  const exportWav = () => {
    try {
      const file = new File([createWav(resultMorse, settings)], 'morslab-ses-lab.wav', { type: 'audio/wav' });
      const download = createFileDownload(file, file.name);
      wavDownload.current?.dispose();
      wavDownload.current = download;
      setWavFile({ file, download });
      try {
        download.download();
        notify('WAV dosyası hazır.');
      } catch {
        notify('Tarayıcı otomatik indirmeyi engelledi. Hazır dosyanın bağlantısını kullanın.');
      }
    } catch (error) { notify(error instanceof Error ? error.message : 'Ses dosyası oluşturulamadı.'); }
  };

  const copyResult = async () => {
    const content = mode === 'morseToSpeech' ? plainText : resultMorse;
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      notify('Panoya kopyalandı.');
      window.setTimeout(() => setCopied(false), 2000);
    } catch { notify('Panoya erişilemiyor.'); }
  };

  const shareWav = async () => {
    if (!wavFile || !navigator.share) return;
    try { await navigator.share({ files: [wavFile.file], title: 'MorsLab CW sinyali' }); }
    catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) notify('Dosya paylaşımı açılamadı.');
    }
  };

  const changeMode = (next: Mode) => {
    recognition.current?.stop();
    stopLiveCw();
    stopSpeaking();
    setSpeaking(false);
    audio.stop();
    setMode(next);
    setStatus(
      next === 'speech'
        ? 'Mikrofonu açın veya mesajınızı yazarak başlayın.'
        : next === 'morseToSpeech'
          ? 'Mors kodu girin; anında metne çözülüp doğal sesle okunsun.'
          : 'En iyi sonuç için temiz, tek frekanslı bir CW kaydı yükleyin veya canlı dinleyin.',
    );
  };

  const openTargetInput = mode === 'speech' ? transcript : mode === 'morseToSpeech' ? morseInput : morse;
  const openDirection = mode === 'speech' ? 'encode' : 'decode';

  return <div className="tool-workspace">
    <section className="tool-panel">
      <div className="tool-header-bar">
        <div className="tool-tabs" role="tablist" aria-label="Ses kaynağı">
          <button role="tab" aria-selected={mode === 'speech'} className={mode === 'speech' ? 'active' : ''} onClick={() => changeMode('speech')}><Mic size={16} />Konuşmadan Morsa</button>
          <button role="tab" aria-selected={mode === 'morseToSpeech'} className={mode === 'morseToSpeech' ? 'active' : ''} onClick={() => changeMode('morseToSpeech')}><Volume2 size={16} />Morstan Konuşmaya</button>
          <button role="tab" aria-selected={mode === 'file'} className={mode === 'file' ? 'active' : ''} onClick={() => changeMode('file')}><FileAudio2 size={16} />Mors sesini çöz</button>
        </div>
        <label className="alphabet-select lab-lang-select">
          <span className="sr-only">Ses ve alfabe dili</span>
          <select aria-label="Ses ve alfabe dili" value={speechLang} onChange={(event) => setSpeechLang(event.target.value as SpeechLang)}>
            {SPEECH_LANGUAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <ChevronDown size={13} />
        </label>
      </div>

      <div className="lab-grid">
        <div className="lab-source">
          {mode === 'speech' && <>
            <div className="field-caption">KONUŞMANIZ</div>
            <button className={`microphone-button ${listening ? 'listening' : ''}`} onClick={toggleMic} aria-label={listening ? 'Dinlemeyi durdur' : 'Dinlemeyi başlat'}>{listening ? <MicOff size={30} /> : <Mic size={30} />}</button>
            <p className="mic-label">{listening ? 'Sizi dinliyoruz...' : 'Sesinize bir sinyal verin.'}</p>
            <button className={listening ? 'secondary-button' : 'primary-button'} onClick={toggleMic}>{listening ? 'Dinlemeyi durdur' : 'Dinlemeyi başlat'}</button>
            <textarea className="transcript-input" aria-label="Konuşma metni" dir={isRtl ? 'rtl' : 'ltr'} value={transcript} onChange={(event) => setTranscript(event.target.value.slice(0, 1000))} placeholder="Veya mesajınızı buraya yazın..." />
          </>}

          {mode === 'morseToSpeech' && <>
            <div className="field-caption">MORS KODU GİRİŞİ</div>
            <textarea className="transcript-input morse-text morse-entry-box" aria-label="Morstan konuşmaya Mors girişi" value={morseInput} onChange={(event) => setMorseInput(event.target.value.slice(0, 1500))} placeholder="... --- ... / -- . .-. .... .- -... .-" />
            <div className="m2s-quick-actions">
              <button className="secondary-button" onClick={() => setMorseInput('... --- ...')}>Örnek: SOS</button>
              <button className="secondary-button" onClick={() => setMorseInput(encodeMorse('Merhaba dünya', activeAlphabet, separator))}>Örnek: Merhaba</button>
              <button className="text-button" disabled={!morseInput} onClick={() => setMorseInput('')}>Temizle</button>
            </div>
          </>}

          {mode === 'file' && <>
            <div className="cw-source-header">
              <span className="field-caption">CW SES KAYNAĞI</span>
              <div className="filter-tabs" role="tablist" aria-label="CW ses giriş yöntemi">
                <button role="tab" aria-selected={cwInputMode === 'upload'} className={cwInputMode === 'upload' ? 'active' : ''} onClick={() => { stopLiveCw(); setCwInputMode('upload'); }}>Dosya yükle</button>
                <button role="tab" aria-selected={cwInputMode === 'live'} className={cwInputMode === 'live' ? 'active' : ''} onClick={() => setCwInputMode('live')}>Canlı mikrofon CW</button>
              </div>
            </div>
            {cwInputMode === 'upload' ? (
              <div className={`upload-zone ${dragging ? 'is-dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (file && !busy) void analyze(file); }}>
                {busy ? <LoaderCircle size={35} className="spin" /> : <Upload size={35} />}<h3>{busy ? 'Goertzel DSP çözümlüyor' : 'Ses dosyanızı buraya bırakın'}</h3><p>WAV, MP3 veya OGG · En fazla 30 MB / 3 dakika</p><button className="secondary-button" disabled={busy} onClick={() => fileInput.current?.click()}>Dosya seç</button><span className="uploaded-filename">{filename}</span>
                <input ref={fileInput} type="file" accept="audio/*,.wav,.mp3,.ogg" className="sr-only" aria-label="Mors ses dosyası yükle" onChange={(event) => { const file = event.target.files?.[0]; if (file) void analyze(file); }} />
              </div>
            ) : (
              <div className="live-cw-box">
                <button className={`microphone-button ${liveCwActive ? 'listening' : ''}`} onClick={() => void toggleLiveCw()} aria-label={liveCwActive ? 'Canlı CW dinlemeyi durdur' : 'Canlı CW dinlemeyi başlat'}>
                  <Radio size={30} />
                </button>
                <p className="mic-label">{liveCwActive ? `Goertzel DSP · ${settings.frequency} Hz dinleniyor` : 'Hoparlör veya telsizden gelen CW tonunu çözün.'}</p>
                <button className={liveCwActive ? 'secondary-button' : 'primary-button'} onClick={() => void toggleLiveCw()}>
                  {liveCwActive ? 'Dinlemeyi durdur' : 'Canlı CW dinle'}
                </button>
                <div className="cw-meter-wrap" aria-label="Sinyal seviyesi">
                  <div className="cw-meter-track"><span style={{ width: `${signalLevel}%` }} /></div>
                  <small>Hedef taşıyıcı: {settings.frequency} Hz · Hız: {settings.wpm} WPM</small>
                </div>
              </div>
            )}
          </>}
        </div>

        <div className="lab-result">
          {mode === 'morseToSpeech' ? <>
            <div className="field-caption">ÇÖZÜMLENEN KONUŞMA METNİ <Volume2 size={15} /></div>
            <textarea readOnly aria-label="Çözümlenen konuşma metni" dir={isRtl ? 'rtl' : 'ltr'} className="decoded-text-area" value={plainText} placeholder="Çözümlenen mesaj burada görünecek ve seslendirilecek." />
          </> : <>
            <div className="field-caption">MORS KODU <AudioLines size={15} /></div>
            <textarea readOnly aria-label="Ses laboratuvarı Mors çıktısı" className="morse-text" value={resultMorse} placeholder="Sesiniz noktalara ve çizgilere dönüşecek." />
            {mode === 'file' && <div className="decoded-transcript"><span className="field-caption">ÇÖZÜMLENEN METİN</span><p dir={isRtl ? 'rtl' : 'ltr'}>{plainText || 'Çözümlenen mesaj burada görünecek.'}</p></div>}
          </>}

          <div className="lab-result-actions">
            <button className="primary-button" disabled={!resultMorse} onClick={() => void audio.toggle(resultMorse).catch((error: Error) => notify(error.message))}>
              {playingResult ? <Pause size={14} /> : <Play size={14} />}{playingResult ? 'Duraklat' : 'Morsu dinle'}
            </button>
            <button className="secondary-button" disabled={!plainText} onClick={toggleSpeak}>
              {speaking ? <Square size={14} /> : <Volume2 size={16} />}{speaking ? 'Durdur' : 'Sesli oku'}
            </button>
            <button className="secondary-button" disabled={!resultMorse} onClick={exportWav}>
              <ArrowDownToLine size={15} />WAV indir
            </button>
            <button className="icon-button" disabled={!resultMorse && !plainText} onClick={() => void copyResult()} aria-label="Sonucu kopyala" title="Sonucu kopyala">
              {copied ? <Check size={15} /> : <Copy size={15} />}
            </button>
          </div>

          {wavFile && <div className="lab-wav-bar" role="status">
            <span>{wavFile.file.name} hazır</span>
            <div>
              <a href={wavFile.download.url} download={wavFile.file.name} target="_blank" rel="noopener"><ArrowDownToLine size={13} />Tekrar indir</a>
              <a href={wavFile.download.url} target="_blank" rel="noopener"><ExternalLink size={13} />Aç</a>
              {canShareWav && <button className="text-button" onClick={() => void shareWav()}><Share2 size={13} />Paylaş</button>}
              <button className="icon-button small" aria-label="WAV bildirimini kapat" onClick={() => { wavDownload.current?.dispose(); wavDownload.current = null; setWavFile(null); }}><X size={13} /></button>
            </div>
          </div>}

          <button className="text-button open-converter" disabled={!resultMorse} onClick={() => onOpen(openTargetInput, openDirection, activeAlphabet)}>
            Çeviricide aç<ArrowRight size={15} />
          </button>
        </div>
      </div>

      <div className="tool-status" role="status"><Info size={14} /><p>{status}</p></div>
    </section>
    <div className="plain-note"><Info size={16} /><p>Ses dosyaları ve canlı CW tonları cihazınızda Goertzel DSP filtresiyle çözümlenir. Konuşma tanıma tarayıcınızın hizmetini kullanır ve internet bağlantısı gerektirebilir. Mikrofon yalnızca siz izin verdiğinizde açılır.</p></div>
  </div>;
}
