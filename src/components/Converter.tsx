import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowLeftRight, ArrowRight, AudioLines, Bookmark, Check, ChevronDown, Copy, CornerDownLeft, ExternalLink, FileAudio2, GraduationCap, Info, Mic, Pause, Play, Repeat2, Share2, ShieldCheck, Sparkles, Square, Trash2, Type, Volume2, X } from 'lucide-react';
import { ALPHABETS, SEPARATORS, cleanMorse, createWav, decodeMorse, encodeMorse, formatTime, getDuration, unsupportedCharacters, type Alphabet, type AudioSettings, type HistoryEntry, type Separator } from '../lib/morse';
import { createFileDownload, type FileDownload } from '../lib/download';
import { SPEECH_LANGUAGES, speakText, stopSpeaking, type SpeechLang } from '../lib/speech';
import type { MorseAudio } from '../hooks/useMorseAudio';
import { AudioSettingsPanel, Waveform } from './Shared';

type Props = {
  input: string; setInput: (input: string) => void;
  direction: 'encode' | 'decode'; setDirection: (direction: 'encode' | 'decode') => void;
  alphabet: Alphabet; setAlphabet: (alphabet: Alphabet) => void;
  separator: Separator; setSeparator: (separator: Separator) => void;
  speechLang: SpeechLang; setSpeechLang: (lang: SpeechLang) => void;
  settings: AudioSettings; setSettings: (settings: AudioSettings) => void;
  audio: MorseAudio; notify: (message: string) => void;
  onSave: (entry: Omit<HistoryEntry, 'id' | 'createdAt'>) => void;
  onPractice: () => void;
  onOpenAudioLab: () => void;
};

export default function Converter({
  input, setInput,
  direction, setDirection,
  alphabet, setAlphabet,
  separator, setSeparator,
  speechLang, setSpeechLang,
  settings, setSettings,
  audio, notify, onSave, onPractice, onOpenAudioLab,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [wavFile, setWavFile] = useState<{ file: File; download: FileDownload } | null>(null);
  const wavDownload = useRef<FileDownload | null>(null);
  const examples = useRef<HTMLDivElement>(null);
  const decoding = direction === 'decode';
  const output = decoding ? decodeMorse(input, alphabet) : encodeMorse(input, alphabet, separator);
  const morse = decoding ? cleanMorse(input) : output;
  const plainText = decoding ? output : input;
  const duration = getDuration(morse, settings);
  const isCurrent = audio.code === morse;
  const progress = isCurrent ? audio.progress : 0;
  const playing = isCurrent && audio.playing;
  const unsupported = !decoding ? unsupportedCharacters(input, alphabet) : [];
  const invalidMorse = decoding && /[^.\-\s/|#*\u00b7\u2022\u2013\u2014_]/.test(input);
  const embedded = window.self !== window.top;
  let canShareWav = false;
  try { canShareWav = !!wavFile && !!navigator.share && !!navigator.canShare?.({ files: [wavFile.file] }); } catch { /* An iframe may disallow native file sharing. */ }

  const save = useCallback(() => {
    if (!input.trim() || !output.trim()) return;
    onSave({ input, output, direction, alphabet });
  }, [input, output, direction, alphabet, onSave]);

  const toggleAudio = useCallback(async () => {
    try {
      await audio.toggle(morse);
      if (!playing) save();
    } catch (error) { notify(error instanceof Error ? error.message : 'Ses başlatılamadı.'); }
  }, [audio, morse, playing, save, notify]);

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

  useEffect(() => {
    audio.stop();
    stopSpeaking();
    setSpeaking(false);
  }, [input, direction, alphabet, separator, audio.stop]);

  useEffect(() => () => {
    wavDownload.current?.dispose();
    stopSpeaking();
  }, []);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); if (morse.trim()) void toggleAudio(); }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [morse, toggleAudio]);

  useEffect(() => {
    const dismiss = (event: MouseEvent) => { if (!examples.current?.contains(event.target as Node)) setExamplesOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setExamplesOpen(false); };
    document.addEventListener('mousedown', dismiss);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', dismiss); document.removeEventListener('keydown', escape); };
  }, []);

  const switchDirection = (next: 'encode' | 'decode') => {
    if (next !== direction) { setInput(output); setDirection(next); }
  };

  const handleAlphabetChange = (next: Alphabet) => {
    setAlphabet(next);
    if (next === 'russian') setSpeechLang('ru-RU');
    else if (next === 'arabic') setSpeechLang('ar-SA');
    else if (speechLang === 'ru-RU' || speechLang === 'ar-SA') setSpeechLang('tr-TR');
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      notify('Çeviri panoya kopyalandı.');
      window.setTimeout(() => setCopied(false), 2000);
    } catch { notify('Panoya erişilemiyor. Çıktıyı seçerek kopyalayabilirsiniz.'); }
  };

  const exportWav = () => {
    try {
      const file = new File([createWav(morse, settings)], 'morslab-sinyal.wav', { type: 'audio/wav' });
      const download = createFileDownload(file, file.name);
      wavDownload.current?.dispose();
      wavDownload.current = download;
      setWavFile({ file, download });
      try {
        download.download();
        notify('WAV dosyası hazır. İndirme başlamazsa dosyanın altındaki bağlantıları kullanın.');
      } catch {
        notify('Tarayıcı otomatik indirmeyi engelledi. Hazır dosyanın indirme bağlantısını kullanın.');
      }
    } catch (error) { notify(error instanceof Error ? error.message : 'Ses dosyası oluşturulamadı.'); }
  };

  const closeWavFile = () => {
    wavDownload.current?.dispose();
    wavDownload.current = null;
    setWavFile(null);
  };

  const shareWav = async () => {
    if (!wavFile || !navigator.share) return;
    try { await navigator.share({ files: [wavFile.file], title: 'MorsLab CW sinyali' }); }
    catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) notify('Dosya paylaşımı açılamadı. Dosyayı açıp tarayıcınızın kaydet seçeneğini kullanın.');
    }
  };

  const selectExample = (text: string) => {
    setAlphabet('latin');
    if (speechLang === 'ru-RU' || speechLang === 'ar-SA') setSpeechLang('tr-TR');
    setInput(decoding ? encodeMorse(text, 'latin', separator) : text);
    setExamplesOpen(false);
  };

  return <div className="converter-workspace">
    <section className="converter-panel" aria-label="Mors çevirici">
      <div className="converter-toolbar">
        <div className="direction-tabs" role="tablist" aria-label="Çeviri yönü">
          <button role="tab" aria-selected={!decoding} className={!decoding ? 'active' : ''} onClick={() => switchDirection('encode')}><Type size={16} /><span>Metin</span><ArrowRight size={13} /><span>Mors</span></button>
          <button role="tab" aria-selected={decoding} className={decoding ? 'active' : ''} onClick={() => switchDirection('decode')}><AudioLines size={16} /><span>Mors</span><ArrowRight size={13} /><span>Metin</span></button>
        </div>
        <div className="toolbar-selects">
          <label className="alphabet-select">
            <span className="sr-only">Çeviri alfabesi</span>
            <select aria-label="Çeviri alfabesi" value={alphabet} onChange={(event) => handleAlphabetChange(event.target.value as Alphabet)}>
              {ALPHABETS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <ChevronDown size={13} />
          </label>
          <label className="alphabet-select separator-select">
            <span className="sr-only">Kelime ayracı</span>
            <select aria-label="Kelime ayracı" value={separator} onChange={(event) => setSeparator(event.target.value as Separator)}>
              {SEPARATORS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <ChevronDown size={13} />
          </label>
        </div>
      </div>

      <div className="editor-grid">
        <div className="editor-pane input-pane">
          <div className="editor-label"><label htmlFor="message-input">{decoding ? 'MORS KODU' : 'METNİNİZ'}</label>
            <div className="examples-menu" ref={examples}><button className="text-button example-trigger" aria-expanded={examplesOpen} onClick={() => setExamplesOpen(!examplesOpen)}><Sparkles size={12} />Örnek dene<ChevronDown size={11} /></button>
              {examplesOpen && <div className="dropdown-menu example-dropdown">{[['Merhaba dünya', 'İlk bağlantı'], ['SOS', 'Acil durum çağrısı'], ['CQ CQ DE MORSLAB', 'Genel çağrı'], ['TEST <AR>', 'Mesaj sonu işareti'], ['73', 'En iyi dilekler']].map(([text, hint]) => <button key={text} onClick={() => selectExample(text)}><strong>{text}</strong><span>{hint}</span></button>)}</div>}
            </div>
          </div>
          <textarea id="message-input" aria-label={decoding ? 'Mors kodu girişi' : 'Metin girişi'} value={input} maxLength={1000} spellCheck={false}
            className={decoding ? 'morse-text' : ''} dir={alphabet === 'arabic' && !decoding ? 'rtl' : 'ltr'}
            placeholder={decoding ? '... --- ... / .--.' : 'Mesajınızı buraya yazın...'} onChange={(event) => setInput(event.target.value)} />
          <div className="editor-bottom"><span>{input.length} <span className="subtle">/ 1.000 karakter</span></span><button className="text-button clear-button" disabled={!input} onClick={() => setInput('')}><Trash2 size={12} />Temizle</button></div>
        </div>

        <button className="swap-button" onClick={() => switchDirection(decoding ? 'encode' : 'decode')} aria-label="Çeviri yönünü değiştir" title="Çeviri yönünü değiştir"><ArrowLeftRight size={16} /></button>

        <div className="editor-pane output-pane">
          <div className="editor-label"><label htmlFor="message-output">{decoding ? 'METİN ÇIKTISI' : 'MORS KODU'}</label><div className="output-actions">
            <button className="icon-button small" disabled={!output} onClick={() => { save(); notify('Çeviri geçmişinize kaydedildi.'); }} aria-label="Çeviriyi kaydet" title="Çeviriyi kaydet"><Bookmark size={15} /></button>
            <button className="icon-button small" disabled={!output} onClick={() => void copy()} aria-label="Çıktıyı kopyala" title="Çıktıyı kopyala">{copied ? <Check size={15} /> : <Copy size={15} />}</button>
          </div></div>
          <textarea id="message-output" aria-label={decoding ? 'Metin çıktısı' : 'Mors kodu çıktısı'} value={output} readOnly className={!decoding ? 'morse-text' : ''}
            placeholder={decoding ? 'Çözümlenen mesajınız burada görünecek.' : 'Sinyaliniz burada şekillenecek.'} dir={alphabet === 'arabic' && decoding ? 'rtl' : 'ltr'} />
          <div className="editor-bottom"><span>{decoding ? `${output.length} karakter` : `${output.replace(/[^.\-]/g, '').length} sinyal`}</span><span className="live-label"><i />Anlık çeviri</span></div>
        </div>
      </div>

      <div className={`editor-note ${unsupported.length || invalidMorse || output.includes('\ufffd') ? 'has-warning' : ''}`}>
        <Info size={12} /><span>{unsupported.length ? `Desteklenmeyen karakterler atlandı: ${unsupported.join(' ')}` : invalidMorse || output.includes('\ufffd') ? 'Tanınmayan Mors kodu var. Harfler için boşluk, kelimeler için /, |, # veya * kullanın.' : decoding ? 'Harfleri boşlukla; kelimeleri /, |, # veya * işaretiyle ayırın.' : alphabet === 'russian' ? 'Kiril karakterler Rusça Mors profiline göre dönüştürülür.' : alphabet === 'arabic' ? 'Arapça karakterler ulusal Mors profiline göre dönüştürülür.' : 'Türkçe karakterler uluslararası Mors alfabesine uyarlanır. <AR>, <SK>, <BT> desteklenir.'}</span>
        <span className="keyboard-hint"><kbd>Ctrl</kbd><span>+</span><kbd><CornerDownLeft size={10} /></kbd></span>
      </div>

      <div className="audio-player">
        <button className={`primary-button play-button ${playing ? 'playing' : ''}`} disabled={!morse.trim()} onClick={() => void toggleAudio()}>{playing ? <Pause size={16} fill="currentColor" /> : <Play size={15} fill="currentColor" />}<span>{playing ? 'Duraklat' : progress > 0 ? 'Devam et' : 'Morsu dinle'}</span></button>
        <div className="waveform-wrap"><Waveform code={morse} settings={settings} progress={progress} playing={playing} onSeek={(fraction) => { void (isCurrent ? audio.seek(fraction) : audio.play(morse, fraction * duration)).catch((error: Error) => notify(error.message || 'Ses konumu değiştirilemedi.')); }} />
          <div className="player-timeline"><span>{formatTime(progress * duration)}</span><span>{formatTime(duration)}</span></div>
        </div>
        <button className={`icon-button repeat-button ${audio.loop ? 'is-active' : ''}`} aria-label="Tekrarlı oynatma" aria-pressed={audio.loop} title="Tekrarlı oynatma" onClick={() => audio.setLoop(!audio.loop)}><Repeat2 size={18} /></button>
        <span className="player-divider" />
        <div className="player-export-actions">
          <button className="download-button" disabled={!plainText.trim()} onClick={toggleSpeak} title={`Metni ${SPEECH_LANGUAGES.find((item) => item.value === speechLang)?.label || speechLang} olarak seslendir`}>
            {speaking ? <Square size={14} /> : <Volume2 size={16} />}
            <span>{speaking ? 'Durdur' : 'Sesli oku'}</span>
          </button>
          <button className="download-button" disabled={!morse.trim()} onClick={exportWav}><ArrowDownToLine size={16} /><span>WAV indir</span></button>
        </div>
      </div>

      {wavFile && <section className="wav-export" aria-label="Hazır WAV dosyası">
        <div className="wav-export-heading"><div><FileAudio2 size={18} /><span><strong>{wavFile.file.name}</strong><span>{new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(wavFile.file.size / 1024)} KB · WAV / PCM</span></span></div><button className="icon-button small" aria-label="WAV dosyası seçeneklerini kapat" onClick={closeWavFile}><X size={15} /></button></div>
        <p role="status">Son oluşturulan dosyanız hazır. İndirme başlamadıysa tekrar indirin veya dosyayı açıp tarayıcınızın kaydet/paylaş seçeneğini kullanın.</p>
        <div className="wav-export-actions">
          <a className="secondary-button" href={wavFile.download.url} download={wavFile.file.name} target="_blank" rel="noopener"><ArrowDownToLine size={14} />Tekrar indir</a>
          <a className="secondary-button" href={wavFile.download.url} target="_blank" rel="noopener"><ExternalLink size={14} />Dosyayı aç</a>
          {canShareWav && <button className="secondary-button" onClick={() => void shareWav()}><Share2 size={14} />Paylaş / Kaydet</button>}
        </div>
        {embedded && <p className="wav-preview-note">Önizleme indirmeleri kısıtlayabilir. <a href={window.location.href} target="_blank" rel="noopener">Uygulamayı yeni sekmede açın<ExternalLink size={11} /></a> ve oradan indirin.</p>}
      </section>}
    </section>

    <AudioSettingsPanel settings={settings} onChange={setSettings} />

    <div className="privacy-note">
      <span><ShieldCheck size={14} />Mesajlarınız cihazınızda kalır. Her zaman.</span>
      <div className="privacy-actions">
        <button className="text-button audio-shortcut" onClick={onOpenAudioLab}><Mic size={13} />Konuşma ve ses çözümleme<ArrowRight size={12} /></button>
        <span>{alphabet === 'latin' ? 'ITU-R M.1677-1 standardı' : 'Ulusal Mors alfabesi profili'}<Check size={12} /></span>
      </div>
    </div>

    <button className="learning-link" onClick={onPractice}>
      <span className="learning-mark" aria-hidden="true"><span /><i /><span /><i /><i /></span>
      <span className="learning-copy"><strong>Her şey bir noktayla başlar.</strong><span>Morsun ritmini keşfedin, yeni bir beceri kazanın.</span></span>
      <span className="learning-cta"><GraduationCap size={16} />Alıştırmaya başla<ArrowRight size={15} /></span>
    </button>
  </div>;
}
