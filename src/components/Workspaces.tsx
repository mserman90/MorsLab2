import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowDownToLine, ArrowLeftRight, ArrowRight, Award, Cable, Check, ChevronDown, CircleHelp, Copy, FileCode, FileUp, GraduationCap, History, Keyboard, Lightbulb, Monitor, Moon, NotebookPen, Play, Plus, Radio, RotateCcw, Search, ShieldCheck, Sparkles, Square, Sun, Trash2, Trophy, Volume2, X, Zap } from 'lucide-react';
import { ALPHABETS, DEFAULT_AUDIO, LATIN, cleanMorse, createWav, decodeMorse, downloadBlob, getAlphabet, type Alphabet, type AudioSettings, type HistoryEntry } from '../lib/morse';
import { speakText, speechLangForAlphabet, stopSpeaking } from '../lib/speech';
import { bandFromFrequency, exportAdif, importAdif, type Contact } from '../lib/radio';
import { calculateKeyerTiming, type KeyerMode, IambicKeyerEngine } from '../lib/keyer';
import { KOCH_SEQUENCE, MAX_KOCH_LEVEL, checkKochLevelPass, getKochLevelCharacters, getKochNewCharacter, pickKochQuestionTarget } from '../lib/koch';
import { getArduinoKeyerSketch, type SerialKeyerMode } from '../lib/serialKeyer';
import { useWebSerialKeyer } from '../hooks/useWebSerialKeyer';
import { usePersistentState } from '../hooks/usePersistentState';
import type { MorseAudio } from '../hooks/useMorseAudio';
import { DEFAULT_NOISE } from '../lib/hfNoise';
import { AudioSettingsPanel, EmptyState, Modal } from './Shared';

type Notify = (message: string) => void;

export function AlphabetWorkspace({ audio, notify }: { audio: MorseAudio; notify: Notify }) {
  const [alphabet, setAlphabet] = useState<Alphabet>('latin');
  const [category, setCategory] = useState('letters');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('');
  const entries = Object.entries(getAlphabet(alphabet)).filter(([letter, code]) => {
    const isDigit = /^\d$/.test(letter);
    const isLetter = /^[\p{L}]$/u.test(letter);
    return (category === 'letters' ? isLetter : category === 'numbers' ? isDigit : !isDigit && !isLetter)
      && (!query || letter.toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr')) || code.includes(query));
  });
  return <div className="tool-workspace">
    <div className="workspace-controls"><div className="filter-tabs" role="tablist" aria-label="Karakter türü">{[['letters', 'Harfler'], ['numbers', 'Rakamlar'], ['punctuation', 'Noktalama']].map(([value, label]) => <button key={value} role="tab" aria-selected={category === value} className={category === value ? 'active' : ''} onClick={() => setCategory(value)}>{label}</button>)}</div>
      <div className="filter-actions"><label className="search-field"><Search size={15} /><input aria-label="Alfabede ara" placeholder="Harf veya kod ara" value={query} onChange={(event) => setQuery(event.target.value)} /></label><label className="alphabet-select"><span className="sr-only">Gösterilecek alfabe</span><select aria-label="Gösterilecek alfabe" value={alphabet} onChange={(event) => setAlphabet(event.target.value as Alphabet)}>{ALPHABETS.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select><ChevronDown size={13} /></label></div>
    </div>
    <div className="alphabet-grid">{entries.map(([letter, code]) => <button className={`alphabet-key ${selected === letter ? 'selected' : ''}`} key={letter} aria-label={`${letter}, ${code}, dinle`} onClick={() => { setSelected(letter); void audio.play(code).catch((error: Error) => notify(error.message)); }}><span className="alphabet-letter">{letter}</span><span className="alphabet-code">{code}</span><Volume2 size={13} /></button>)}</div>
    {!entries.length && <EmptyState icon={<Search size={25} />} title="Bir eşleşme bulamadık" description="Başka bir harf veya Mors koduyla aramayı deneyin." />}
    <div className="alphabet-legend"><div><span className="dit-symbol" /><strong>Nokta</strong><span>1 birim</span></div><div><span className="dah-symbol" /><strong>Çizgi</strong><span>3 birim</span></div><div><span className="gap-symbol" /><strong>Harf aralığı</strong><span>3 birim</span></div><div><span className="gap-symbol wide" /><strong>Kelime aralığı</strong><span>7 birim</span></div></div>
    <div className="plain-note"><Lightbulb size={17} /><p>Bir karaktere dokunun, ritmini dinleyin. Türkçe harfler uluslararası karşılıklarına dönüştürülür: Ç → C, Ğ → G, İ → I, Ö → O, Ş → S, Ü → U. Kiril ve Arapça ayrı ulusal alfabe profilleridir.</p></div>
  </div>;
}

const PRACTICE_GROUPS: Record<string, string> = { beginner: 'ETANIM', letters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', numbers: '0123456789' };

export function PracticeWorkspace({
  audio,
  settings,
  onSettings,
  notify,
  onOpen,
}: {
  audio: MorseAudio;
  settings: AudioSettings;
  onSettings?: (s: AudioSettings) => void;
  notify: Notify;
  onOpen: (input: string, direction: 'encode' | 'decode', alphabet?: Alphabet) => void;
}) {
  const [practiceMode, setPracticeMode] = useState<'quiz' | 'koch' | 'keyer'>('koch');
  const [group, setGroup] = useState('beginner');
  const [target, setTarget] = useState('A');
  const [answer, setAnswer] = useState('');
  const [hint, setHint] = useState(false);
  const [checked, setChecked] = useState(false);
  const [heard, setHeard] = useState(false);
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [stats, setStats] = usePersistentState('morslab.practice', { attempts: 0, correct: 0 });
  const input = useRef<HTMLInputElement>(null);

  const [kochLevel, setKochLevel] = usePersistentState<number>('morslab.kochLevel', 1);
  const [unlockedKochLevel, setUnlockedKochLevel] = usePersistentState<number>('morslab.unlockedKochLevel', 1);
  const [kochTargetWpm, setKochTargetWpm] = usePersistentState<number>('morslab.kochTargetWpm', 20);
  const [kochFarnsworth, setKochFarnsworth] = usePersistentState<boolean>('morslab.kochFarnsworth', true);
  const [kochRound, setKochRound] = useState(1);
  const [kochScore, setKochScore] = useState(0);
  const [kochTarget, setKochTarget] = useState('K');
  const [kochAnswer, setKochAnswer] = useState('');
  const [kochHint, setKochHint] = useState(false);
  const [kochChecked, setKochChecked] = useState(false);
  const [kochHeard, setKochHeard] = useState(false);
  const kochInput = useRef<HTMLInputElement>(null);

  const [keyerAlphabet, setKeyerAlphabet] = useState<Alphabet>('latin');
  const [keyerType, setKeyerType] = usePersistentState<KeyerMode>('morslab.keyerType', 'iambic-b');
  const [paddleReversed, setPaddleReversed] = usePersistentState<boolean>('morslab.paddleReversed', false);
  const [straightKeyDown, setStraightKeyDown] = useState(false);
  const [leftPaddleDown, setLeftPaddleDown] = useState(false);
  const [rightPaddleDown, setRightPaddleDown] = useState(false);
  const [keyedBuffer, setKeyedBuffer] = useState('');
  const [keyedMorse, setKeyedMorse] = useState('');
  const [speakingKeyer, setSpeakingKeyer] = useState(false);

  const keyerCtx = useRef<AudioContext | null>(null);
  const keyerOsc = useRef<OscillatorNode | null>(null);
  const keyerGain = useRef<GainNode | null>(null);
  const downTimestamp = useRef<number>(0);
  const letterTimer = useRef<number | null>(null);
  const wordTimer = useRef<number | null>(null);
  const iambicEngine = useRef<IambicKeyerEngine | null>(null);

  const correct = answer.trim().toUpperCase() === target;
  const completed = checked && round === 10;
  const unitMs = 1200 / settings.wpm;

  const stopTone = useCallback(() => {
    if (keyerGain.current && keyerCtx.current) {
      const now = keyerCtx.current.currentTime;
      keyerGain.current.gain.cancelScheduledValues(now);
      keyerGain.current.gain.setTargetAtTime(0, now, 0.005);
    }
    const osc = keyerOsc.current;
    keyerOsc.current = null;
    if (osc) {
      window.setTimeout(() => { try { osc.stop(); osc.disconnect(); } catch { /* Already stopped */ } }, 30);
    }
  }, []);

  const startTone = useCallback(() => {
    try {
      if (!keyerCtx.current) {
        keyerCtx.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = keyerCtx.current;
      if (ctx.state === 'suspended') void ctx.resume();
      if (keyerOsc.current) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(settings.frequency, ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(Math.max(0.05, (settings.volume / 100) * 0.45), ctx.currentTime + 0.005);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      keyerOsc.current = osc;
      keyerGain.current = gain;
    } catch { /* Audio output optional if blocked */ }
  }, [settings.frequency, settings.volume]);

  const clearKeyerTimers = useCallback(() => {
    if (letterTimer.current) { window.clearTimeout(letterTimer.current); letterTimer.current = null; }
    if (wordTimer.current) { window.clearTimeout(wordTimer.current); wordTimer.current = null; }
  }, []);

  if (!iambicEngine.current) {
    iambicEngine.current = new IambicKeyerEngine({
      onToneStart: () => startTone(),
      onToneEnd: () => stopTone(),
      onElement: (element) => setKeyedBuffer((prev) => prev + element),
      onLetterBreak: () => {
        setKeyedBuffer((buffer) => {
          if (buffer) setKeyedMorse((morse) => (morse ? `${morse} ${buffer}` : buffer));
          return '';
        });
      },
      onWordBreak: () => {
        setKeyedMorse((morse) => {
          const clean = morse.trim();
          return clean && !clean.endsWith('/') ? `${clean} /` : morse;
        });
      },
    });
  }

  useEffect(() => {
    if (iambicEngine.current) {
      iambicEngine.current.setMode(keyerType === 'iambic-a' ? 'iambic-a' : 'iambic-b');
      iambicEngine.current.setWpm(settings.wpm);
      iambicEngine.current.setReverse(paddleReversed);
    }
  }, [keyerType, settings.wpm, paddleReversed]);

  const pressStraightKey = useCallback(() => {
    if (downTimestamp.current) return;
    downTimestamp.current = performance.now();
    setStraightKeyDown(true);
    clearKeyerTimers();
    startTone();
  }, [clearKeyerTimers, startTone]);

  const releaseStraightKey = useCallback(() => {
    if (!downTimestamp.current) return;
    const elapsed = performance.now() - downTimestamp.current;
    downTimestamp.current = 0;
    setStraightKeyDown(false);
    stopTone();

    const symbol = elapsed < Math.max(140, unitMs * 2) ? '.' : '-';
    setKeyedBuffer((previous) => previous + symbol);
    clearKeyerTimers();
    letterTimer.current = window.setTimeout(() => {
      setKeyedBuffer((buffer) => {
        if (buffer) setKeyedMorse((morse) => (morse ? `${morse} ${buffer}` : buffer));
        return '';
      });
    }, Math.max(340, unitMs * 3.5));
    wordTimer.current = window.setTimeout(() => {
      setKeyedMorse((morse) => {
        const clean = morse.trim();
        return clean && !clean.endsWith('/') ? `${clean} /` : morse;
      });
    }, Math.max(850, unitMs * 7.5));
  }, [clearKeyerTimers, stopTone, unitMs]);

  const [serialMode, setSerialMode] = usePersistentState<SerialKeyerMode>('morslab.serialMode', 'arduino');
  const [showSerialModal, setShowSerialModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeSerialTab, setActiveSerialTab] = useState<'arduino' | 'ftdi'>('arduino');

  const serialKeyer = useWebSerialKeyer({
    mode: serialMode,
    baudRate: 115200,
    onDit: (pressed) => {
      if (keyerType === 'straight') {
        if (pressed) pressStraightKey();
        else releaseStraightKey();
      } else {
        setLeftPaddleDown(pressed);
        iambicEngine.current?.setLeftPaddle(pressed);
      }
    },
    onDah: (pressed) => {
      if (keyerType === 'straight') {
        if (pressed) pressStraightKey();
        else releaseStraightKey();
      } else {
        setRightPaddleDown(pressed);
        iambicEngine.current?.setRightPaddle(pressed);
      }
    },
    onStraight: (pressed) => {
      if (pressed) pressStraightKey();
      else releaseStraightKey();
    },
    onMessage: (msg) => notify(msg),
  });

  useEffect(() => {
    if (practiceMode !== 'keyer') return;

    const onKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return;

      if (keyerType === 'straight') {
        if (event.code === 'Space' && !event.repeat) {
          event.preventDefault();
          pressStraightKey();
        }
      } else {
        if (event.code === 'KeyZ' || event.code === 'ArrowLeft') {
          event.preventDefault();
          setLeftPaddleDown(true);
          iambicEngine.current?.setLeftPaddle(true);
        } else if (event.code === 'KeyX' || event.code === 'ArrowRight') {
          event.preventDefault();
          setRightPaddleDown(true);
          iambicEngine.current?.setRightPaddle(true);
        }
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (keyerType === 'straight') {
        if (event.code === 'Space' && downTimestamp.current) {
          event.preventDefault();
          releaseStraightKey();
        }
      } else {
        if (event.code === 'KeyZ' || event.code === 'ArrowLeft') {
          event.preventDefault();
          setLeftPaddleDown(false);
          iambicEngine.current?.setLeftPaddle(false);
        } else if (event.code === 'KeyX' || event.code === 'ArrowRight') {
          event.preventDefault();
          setRightPaddleDown(false);
          iambicEngine.current?.setRightPaddle(false);
        }
      }
    };

    const onPointerUp = () => {
      if (keyerType === 'straight') {
        releaseStraightKey();
      } else {
        setLeftPaddleDown(false);
        setRightPaddleDown(false);
        iambicEngine.current?.setLeftPaddle(false);
        iambicEngine.current?.setRightPaddle(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('pointerup', onPointerUp);
      downTimestamp.current = 0;
      setStraightKeyDown(false);
      setLeftPaddleDown(false);
      setRightPaddleDown(false);
      iambicEngine.current?.stopAll();
      stopTone();
    };
  }, [practiceMode, keyerType, pressStraightKey, releaseStraightKey, stopTone]);

  useEffect(() => () => {
    clearKeyerTimers();
    iambicEngine.current?.stopAll();
    stopTone();
    stopSpeaking();
    void keyerCtx.current?.close();
  }, [clearKeyerTimers, stopTone]);

  const combinedKeyerMorse = cleanMorse([keyedMorse, keyedBuffer].filter(Boolean).join(' '));
  const keyedText = decodeMorse(combinedKeyerMorse, keyerAlphabet);

  const kochCharacters = getKochLevelCharacters(kochLevel);
  const kochNewChar = getKochNewCharacter(kochLevel);
  const kochCompleted = kochChecked && kochRound === 10;
  const kochPassed = checkKochLevelPass(kochScore, 10);
  const kochCorrect = kochAnswer.trim().toUpperCase() === kochTarget;

  const newQuestion = (newGroup = group) => {
    const letters = PRACTICE_GROUPS[newGroup].split('').filter((letter) => letter !== target);
    setTarget(letters[Math.floor(Math.random() * letters.length)]);
    setAnswer(''); setHint(false); setChecked(false); setHeard(false);
    audio.stop();
    window.setTimeout(() => input.current?.focus(), 0);
  };

  const check = (event: FormEvent) => {
    event.preventDefault();
    if (checked || !answer.trim()) return;
    setChecked(true);
    setStats((previous) => ({ attempts: previous.attempts + 1, correct: previous.correct + (correct ? 1 : 0) }));
    if (correct) setScore((previous) => previous + 1);
  };

  const newKochQuestion = useCallback((targetLvl = kochLevel) => {
    const chars = getKochLevelCharacters(targetLvl);
    const nextTarget = pickKochQuestionTarget(chars, kochTarget);
    setKochTarget(nextTarget);
    setKochAnswer('');
    setKochHint(false);
    setKochChecked(false);
    setKochHeard(false);
    audio.stop();
    window.setTimeout(() => kochInput.current?.focus(), 0);
  }, [audio, kochLevel, kochTarget]);

  const checkKoch = (event: FormEvent) => {
    event.preventDefault();
    if (kochChecked || !kochAnswer.trim()) return;
    kochInput.current?.blur();
    setKochChecked(true);
    const isCorrect = kochAnswer.trim().toUpperCase() === kochTarget;
    const finalScore = kochScore + (isCorrect ? 1 : 0);
    if (isCorrect) setKochScore(finalScore);

    // If completed 10th question and achieved >= 90% accuracy (9 or 10 correct)
    if (kochRound === 10 && finalScore >= 9) {
      if (kochLevel >= unlockedKochLevel && kochLevel < MAX_KOCH_LEVEL) {
        setUnlockedKochLevel(kochLevel + 1);
      }
    }
  };

  const playKochAudio = (charToPlay = kochTarget) => {
    setKochHeard(true);
    const morseCode = LATIN[charToPlay] || charToPlay;
    void audio.play(morseCode, 0, {
      ...settings,
      wpm: kochTargetWpm,
      farnsworth: kochFarnsworth,
    }).catch((error: Error) => notify(error.message));
  };

  return <div className="practice-workspace">
    <div className="workspace-controls">
      <div className="filter-tabs" role="tablist" aria-label="Alıştırma modu">
        <button role="tab" aria-selected={practiceMode === 'quiz'} className={practiceMode === 'quiz' ? 'active' : ''} onClick={() => { audio.stop(); setPracticeMode('quiz'); }}>Dinle ve keşfet</button>
        <button role="tab" aria-selected={practiceMode === 'koch'} className={practiceMode === 'koch' ? 'active' : ''} onClick={() => { audio.stop(); setPracticeMode('koch'); if (!kochCharacters.includes(kochTarget)) newKochQuestion(); }}>Koch Metodu (Aşamalı)</button>
        <button role="tab" aria-selected={practiceMode === 'keyer'} className={practiceMode === 'keyer' ? 'active' : ''} onClick={() => { audio.stop(); setPracticeMode('keyer'); }}>Maniple ile gönder</button>
      </div>
      {practiceMode === 'quiz' ? (
        <label className="alphabet-select"><span className="sr-only">Alıştırma seviyesi</span><select aria-label="Alıştırma seviyesi" value={group} onChange={(event) => { setGroup(event.target.value); setRound(1); setScore(0); newQuestion(event.target.value); }}><option value="beginner">Başlangıç · 6 harf</option><option value="letters">Tüm harfler · 26 harf</option><option value="numbers">Rakamlar · 10 karakter</option></select><ChevronDown size={13} /></label>
      ) : practiceMode === 'koch' ? (
        <label className="alphabet-select">
          <span className="sr-only">Koch Aşaması</span>
          <select
            aria-label="Koch Aşaması"
            value={kochLevel}
            onChange={(event) => {
              const lvl = Number(event.target.value);
              setKochLevel(lvl);
              setKochRound(1);
              setKochScore(0);
              newKochQuestion(lvl);
            }}
          >
            {Array.from({ length: Math.min(MAX_KOCH_LEVEL, unlockedKochLevel) }, (_, i) => i + 1).map((lvl) => {
              const chars = getKochLevelCharacters(lvl).join(' ');
              return (
                <option key={lvl} value={lvl}>
                  Aşama {lvl}: {chars} {lvl > 1 ? `(+${getKochNewCharacter(lvl)})` : ''}
                </option>
              );
            })}
          </select>
          <ChevronDown size={13} />
        </label>
      ) : (
        <label className="alphabet-select"><span className="sr-only">Maniple alfabesi</span><select aria-label="Maniple alfabesi" value={keyerAlphabet} onChange={(event) => setKeyerAlphabet(event.target.value as Alphabet)}>{ALPHABETS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><ChevronDown size={13} /></label>
      )}
    </div>

    {practiceMode === 'quiz' ? <>
      <section className="practice-panel">
        <div className="practice-progress">
          <span>{completed ? 'Tur tamamlandı' : `SORU ${round} / 10`}</span>
          <div className="practice-progress-right">
            {onSettings && (
              <button
                type="button"
                className={`practice-hf-badge ${settings.noise?.enabled ? 'active' : ''}`}
                onClick={() => {
                  const next = !settings.noise?.enabled;
                  onSettings({
                    ...settings,
                    noise: { ...(settings.noise ?? DEFAULT_NOISE), enabled: next },
                  });
                  notify(next ? 'HF Radyo Koşulları aktif (QRN/QSB simülatörü açık).' : 'HF Radyo Koşulları kapatıldı (Temiz sinyal).');
                }}
                title="Gerçek HF radyo paraziti (QRN/QRM/QSB) ile zorlu bant koşulları simülasyonu"
              >
                <Radio size={12} />
                <span>{settings.noise?.enabled ? 'HF Gürültü: Açık' : 'HF Gürültü: Kapalı'}</span>
              </button>
            )}
            <span><Trophy size={14} />{score} doğru</span>
          </div>
        </div>
        <div className="progress-track"><span style={{ width: `${(round - (checked ? 0 : 1)) * 10}%` }} /></div>
        {completed ? <div className="practice-completed"><Trophy size={49} /><h2>Her sinyalde biraz daha iyi.</h2><p>Bu turda 10 sorudan {score} tanesini doğru bildiniz.</p><button className="primary-button" onClick={() => { setRound(1); setScore(0); newQuestion(); }}>Yeni tura başla<ArrowRight size={15} /></button></div> : <>
          <div className="practice-question"><span className="field-caption">KULAKLARINIZA GÜVENİN</span><h2>Bu sinyal hangi karakter?</h2><p>Dinleyin, ritmi yakalayın ve cevabınızı yazın.</p>
            <button className={`listen-orb ${audio.playing ? 'is-playing' : ''}`} aria-label="Alıştırma sinyalini dinle" onClick={() => { setHeard(true); void audio.play(LATIN[target]).catch((error: Error) => notify(error.message)); }}><Volume2 size={34} /></button><span className="listen-caption">{heard ? 'Tekrar dinlemek için dokunun' : 'Dinlemek için dokunun'}</span>
            {hint && <div className="practice-hint" aria-label="Mors ipucu">{LATIN[target]}</div>}
          </div>
          <form className="answer-form" onSubmit={check}><label htmlFor="practice-answer" className="sr-only">Cevabınız</label><input ref={input} id="practice-answer" maxLength={1} autoComplete="off" placeholder="?" value={answer} disabled={checked} onChange={(event) => setAnswer(event.target.value.toUpperCase())} />
            {checked ? <button type="button" className="primary-button" onClick={() => { setRound((previous) => previous + 1); newQuestion(); }}>Sıradaki sinyal<ArrowRight size={15} /></button> : <button className="primary-button" disabled={!answer.trim()}>Kontrol et<Check size={16} /></button>}
          </form>
          {checked ? <p className={`answer-feedback ${correct ? 'correct' : 'incorrect'}`} role="status">{correct ? 'Doğru! Ritmi yakaladınız.' : `Bu sinyal ${target} harfiydi. Bir sonraki sinyalde tekrar deneyin.`}</p> : <button className="text-button hint-button" onClick={() => setHint(!hint)}><Lightbulb size={14} />{hint ? 'İpucunu gizle' : 'Küçük bir ipucu'}</button>}
        </>}
      </section>
      <div className="practice-summary"><Sparkles size={17} /><p>{stats.attempts ? `Şimdiye kadar ${stats.attempts} sinyal dinlediniz, ${stats.correct} doğru cevap verdiniz. Küçük adımlar, kalıcı beceriler.` : 'Her gün birkaç dakika yeter. Önce harfleri ezberlemeyin, seslerini tanıyın.'}</p></div>
    </> : practiceMode === 'koch' ? <>
      <section className="practice-panel" aria-label="Koch Yöntemi ile Hız Eğitimi">
        <div className="practice-progress">
          <span>{kochCompleted ? 'Tur tamamlandı' : `AŞAMA ${kochLevel} / ${MAX_KOCH_LEVEL} · SORU ${kochRound} / 10`}</span>
          <span className="koch-badge"><Trophy size={14} />{kochScore} / 10 doğru (%{kochScore * 10})</span>
        </div>
        <div className="progress-track"><span style={{ width: `${(kochRound - (kochChecked ? 0 : 1)) * 10}%` }} /></div>

        <div className="koch-settings-row">
          <label className="koch-select">
            <span>Hedef Hız:</span>
            <select aria-label="Koch Hedef Hız" value={kochTargetWpm} onChange={(e) => setKochTargetWpm(Number(e.target.value))}>
              <option value={15}>15 WPM (Yavaş)</option>
              <option value={18}>18 WPM (Orta)</option>
              <option value={20}>20 WPM (Standart)</option>
              <option value={25}>25 WPM (İleri)</option>
              <option value={30}>30 WPM (Usta)</option>
            </select>
          </label>
          <label className="koch-farnsworth-toggle" title="Karakterler tam hızda duyulur, aralarındaki boşluk genişletilir">
            <input type="checkbox" checked={kochFarnsworth} onChange={(e) => setKochFarnsworth(e.target.checked)} />
            <span>Farnsworth Geniş Boşluk</span>
          </label>
          {onSettings && (
            <button
              type="button"
              className={`practice-hf-badge ${settings.noise?.enabled ? 'active' : ''}`}
              onClick={() => {
                const next = !settings.noise?.enabled;
                onSettings({
                  ...settings,
                  noise: { ...(settings.noise ?? DEFAULT_NOISE), enabled: next },
                });
                notify(next ? 'HF Radyo Koşulları aktif (QRN/QSB simülatörü açık).' : 'HF Radyo Koşulları kapatıldı (Temiz sinyal).');
              }}
              title="Gerçek HF radyo paraziti (QRN/QRM/QSB) ile zorlu bant koşulları simülasyonu"
            >
              <Radio size={13} />
              <span>{settings.noise?.enabled ? `HF Koşulları: Açık (QRN %${settings.noise.qrnLevel})` : 'HF Koşulları: Kapalı'}</span>
            </button>
          )}
        </div>

        {kochCompleted ? (
          <div className="practice-completed">
            <Trophy size={49} />
            {kochPassed ? (
              <>
                <div className="koch-level-pass">
                  <Check size={16} style={{ display: 'inline', marginRight: 6 }} />
                  %90 Başarı Barajı Geçildi! ({kochScore}/10 doğru)
                </div>
                <h2>Tebrikler! Bir sonraki aşamaya hazırsınız.</h2>
                <p>Aşama {kochLevel} seslerini operasyonel hızda ({kochTargetWpm} WPM) zihninize kazıdınız.</p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {kochLevel < MAX_KOCH_LEVEL && (
                    <button
                      className="primary-button"
                      onClick={() => {
                        const nextLvl = kochLevel + 1;
                        setKochLevel(nextLvl);
                        if (nextLvl > unlockedKochLevel) setUnlockedKochLevel(nextLvl);
                        setKochRound(1);
                        setKochScore(0);
                        newKochQuestion(nextLvl);
                      }}
                    >
                      Aşama {kochLevel + 1}'e Geç (+{getKochNewCharacter(kochLevel + 1)})
                      <ArrowRight size={15} />
                    </button>
                  )}
                  <button className="secondary-button" onClick={() => { setKochRound(1); setKochScore(0); newKochQuestion(); }}>
                    <RotateCcw size={14} />
                    Bu Aşamayı Tekrarla
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="koch-level-pass fail">
                  10 sorudan {kochScore} doğru (%{kochScore * 10}). Baraj: %90 (en az 9 doğru).
                </div>
                <h2>Biraz daha pratik ile ritim oturacak.</h2>
                <p>Koch metodunda yeni bir harf eklemeden önce mevcut harflerin sesini tereddütsüz tanımanız hedeflenir.</p>
                <button className="primary-button" onClick={() => { setKochRound(1); setKochScore(0); newKochQuestion(); }}>
                  <RotateCcw size={14} />
                  Aşama {kochLevel}'i Tekrar Dene
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="practice-question">
              <span className="field-caption">AŞAMA {kochLevel} SESLERİ (DİNLEMEK İÇİN DOKUNUN)</span>
              <div className="koch-char-chips" aria-label="Bu aşamadaki karakterler">
                {kochCharacters.map((char) => (
                  <button
                    key={char}
                    type="button"
                    className={`koch-char-chip ${char === kochNewChar ? 'is-new' : ''}`}
                    title={`${char} sesini dinle (${LATIN[char]})`}
                    onClick={() => playKochAudio(char)}
                  >
                    {char}
                  </button>
                ))}
              </div>

              <h2>Bu sinyal hangi karakter?</h2>
              <p>Sinyali {kochTargetWpm} WPM operasyonel hızda dinleyin. Noktaları saymayın, melodiyi yakalayın.</p>

              <button
                className={`listen-orb ${audio.playing ? 'is-playing' : ''}`}
                aria-label="Koch sinyalini dinle"
                onClick={() => playKochAudio(kochTarget)}
              >
                <Volume2 size={34} />
              </button>
              <span className="listen-caption">{kochHeard ? 'Tekrar dinlemek için dokunun' : 'Dinlemek için dokunun'}</span>

              {kochHint && <div className="practice-hint" aria-label="Mors ipucu">{LATIN[kochTarget]}</div>}
            </div>

            <form className="answer-form" onSubmit={checkKoch}>
              <label htmlFor="koch-answer" className="sr-only">Cevabınız</label>
              <input
                ref={kochInput}
                id="koch-answer"
                maxLength={1}
                autoComplete="off"
                placeholder="?"
                value={kochAnswer}
                disabled={kochChecked}
                onChange={(event) => setKochAnswer(event.target.value.toUpperCase())}
              />
              {kochChecked ? (
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    setKochRound((prev) => prev + 1);
                    newKochQuestion();
                  }}
                >
                  Sıradaki sinyal
                  <ArrowRight size={15} />
                </button>
              ) : (
                <button className="primary-button" disabled={!kochAnswer.trim()}>
                  Kontrol et
                  <Check size={16} />
                </button>
              )}
            </form>

            {kochChecked ? (
              <p className={`answer-feedback ${kochCorrect ? 'correct' : 'incorrect'}`} role="status">
                {kochCorrect
                  ? 'Doğru! Ritmi harika yakaladınız.'
                  : `Bu sinyal ${kochTarget} (${LATIN[kochTarget]}) karakteriydi. Melodiyi aklınızda tutun.`}
              </p>
            ) : (
              <button className="text-button hint-button" onClick={() => setKochHint(!kochHint)}>
                <Lightbulb size={14} />
                {kochHint ? 'İpucunu gizle' : 'Küçük bir ipucu'}
              </button>
            )}
          </>
        )}
      </section>

      <div className="practice-summary">
        <GraduationCap size={18} />
        <p>
          <strong>Koch Yöntemi Prensibi:</strong> Karakterleri yavaş hızlarda nokta-çizgi sayarak değil, doğrudan operasyonel hedef hızda ({kochTargetWpm} WPM) müzikal bir bütün olarak öğretir. Her aşamada %90 başarıya ulaşıldığında yeni bir ses eklenir.
        </p>
      </div>
    </> : <>
      <section className="practice-panel keyer-panel" aria-label="Etkileşimli Mors maniplesi">
        <div className="practice-question keyer-intro">
          <span className="field-caption">
            {keyerType === 'straight'
              ? 'DOKUNUN VEYA BOŞLUK (SPACE) TUŞUNA BASIN'
              : 'DOKUNMATİK PADDLE VEYA Z / X (← / →) TUŞLARI'}
          </span>
          <h2>
            {keyerType === 'straight'
              ? 'Düz Maniple ile Kendi Ritminizi Gönderin'
              : keyerType === 'iambic-b'
              ? 'Elektronik Maniple (Iambic Mod B)'
              : 'Elektronik Maniple (Iambic Mod A)'}
          </h2>
          <p>
            {keyerType === 'straight'
              ? `Kısa basış nokta (·), uzun basış çizgi (—) üretir. Harfler duraklamada otomatik ayrılır (${settings.frequency} Hz · ${settings.wpm} WPM).`
              : `İki tuşlu otomatik keyer: Basılı tuttuğunuzda otomatik ritmik seriler üretir; iki tuşa birden basıldığında (Squeeze) dönüşümlü · — · — üretir (${settings.frequency} Hz · ${settings.wpm} WPM).`}
          </p>

          <div className="keyer-type-bar" role="tablist" aria-label="Maniple Türü">
            <button
              type="button"
              role="tab"
              aria-selected={keyerType === 'iambic-b'}
              className={`keyer-type-tab ${keyerType === 'iambic-b' ? 'active' : ''}`}
              onClick={() => { iambicEngine.current?.stopAll(); stopTone(); setKeyerType('iambic-b'); }}
            >
              Iambic Mod B (Önerilen)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={keyerType === 'iambic-a'}
              className={`keyer-type-tab ${keyerType === 'iambic-a' ? 'active' : ''}`}
              onClick={() => { iambicEngine.current?.stopAll(); stopTone(); setKeyerType('iambic-a'); }}
            >
              Iambic Mod A
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={keyerType === 'straight'}
              className={`keyer-type-tab ${keyerType === 'straight' ? 'active' : ''}`}
              onClick={() => { iambicEngine.current?.stopAll(); stopTone(); setKeyerType('straight'); }}
            >
              Düz Maniple (Straight Key)
            </button>
          </div>

          {keyerType === 'straight' ? (
            <button
              className={`keyer-button ${straightKeyDown ? 'is-pressed' : ''}`}
              aria-pressed={straightKeyDown}
              onPointerDown={(event) => { event.preventDefault(); pressStraightKey(); }}
              onPointerUp={releaseStraightKey}
              onPointerCancel={releaseStraightKey}
              onKeyDown={(event) => { if (event.code === 'Space' && !event.repeat) { event.preventDefault(); pressStraightKey(); } }}
              onKeyUp={(event) => { if (event.code === 'Space') { event.preventDefault(); releaseStraightKey(); } }}
            >
              <Keyboard size={22} />
              <span>MORS TUŞU (Basılı tutun / Boşluk tuşu)</span>
            </button>
          ) : (
            <div className="iambic-paddles-wrapper">
              <div className="iambic-paddles">
                <button
                  type="button"
                  className={`paddle-button ${leftPaddleDown ? 'is-pressed' : ''}`}
                  aria-pressed={leftPaddleDown}
                  aria-label={paddleReversed ? 'Sol Paddle: DAH Çizgi' : 'Sol Paddle: DIT Nokta'}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    setLeftPaddleDown(true);
                    iambicEngine.current?.setLeftPaddle(true);
                  }}
                  onPointerUp={() => {
                    setLeftPaddleDown(false);
                    iambicEngine.current?.setLeftPaddle(false);
                  }}
                  onPointerCancel={() => {
                    setLeftPaddleDown(false);
                    iambicEngine.current?.setLeftPaddle(false);
                  }}
                >
                  <span className="paddle-symbol">{paddleReversed ? '—' : '·'}</span>
                  <span className="paddle-title">{paddleReversed ? 'DAH (Çizgi)' : 'DIT (Nokta)'}</span>
                  <span className="paddle-hint">[ Z tuşu veya ← ]</span>
                </button>

                <button
                  type="button"
                  className={`paddle-button ${rightPaddleDown ? 'is-pressed' : ''}`}
                  aria-pressed={rightPaddleDown}
                  aria-label={paddleReversed ? 'Sağ Paddle: DIT Nokta' : 'Sağ Paddle: DAH Çizgi'}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    setRightPaddleDown(true);
                    iambicEngine.current?.setRightPaddle(true);
                  }}
                  onPointerUp={() => {
                    setRightPaddleDown(false);
                    iambicEngine.current?.setRightPaddle(false);
                  }}
                  onPointerCancel={() => {
                    setRightPaddleDown(false);
                    iambicEngine.current?.setRightPaddle(false);
                  }}
                >
                  <span className="paddle-symbol">{paddleReversed ? '·' : '—'}</span>
                  <span className="paddle-title">{paddleReversed ? 'DIT (Nokta)' : 'DAH (Çizgi)'}</span>
                  <span className="paddle-hint">[ X tuşu veya → ]</span>
                </button>
              </div>

              <div className="paddle-options-bar">
                <button
                  type="button"
                  className="paddle-swap-btn"
                  onClick={() => setPaddleReversed(!paddleReversed)}
                  title="Sol ve sağ kolların görevini değiştirir"
                >
                  <ArrowLeftRight size={13} />
                  <span>Kolları Değiştir: {paddleReversed ? 'Sol: DAH / Sağ: DIT' : 'Sol: DIT / Sağ: DAH'}</span>
                </button>
                <span className="squeeze-badge">
                  <Sparkles size={11} />
                  Sıkma (Squeeze): İki tuşa aynı anda basıldığında · — · — üretir
                </span>
              </div>
            </div>
          )}

          <div className="keyer-buffer" aria-live="polite">{keyedBuffer || '· —'}</div>

          {/* USB Donanım Maniplesi (Web Serial API) */}
          <div className="serial-card">
            <div className="serial-card-header">
              <div className="serial-card-title">
                <Cable size={16} />
                <span>Fiziksel USB Maniple Bağlantısı (Web Serial API)</span>
              </div>
              <div>
                {serialKeyer.status === 'connected' ? (
                  <span className="serial-status-pill connected">
                    <span className="serial-pulse-dot" />
                    Bağlandı ({serialMode === 'arduino' ? 'Arduino / ASCII' : 'FTDI / UART'})
                  </span>
                ) : serialKeyer.status === 'connecting' ? (
                  <span className="serial-status-pill connecting">Bağlanıyor...</span>
                ) : serialKeyer.status === 'unsupported' ? (
                  <span className="serial-status-pill unsupported" title="Chromium tabanlı tarayıcı (Chrome/Edge) gereklidir">
                    Tarayıcı Desteklemiyor
                  </span>
                ) : (
                  <span className="serial-status-pill disconnected">USB Bağlı Değil</span>
                )}
              </div>
            </div>

            <div className="serial-controls-row">
              <label className="serial-mode-select">
                <span>Protokol / Donanım:</span>
                <select
                  value={serialMode}
                  onChange={(e) => setSerialMode(e.target.value as SerialKeyerMode)}
                  disabled={serialKeyer.status === 'connected'}
                >
                  <option value="arduino">Arduino / RP2040 / ESP32 (115200 Baud)</option>
                  <option value="modem">FTDI / USB-TTL (CTS &amp; DSR Hatları)</option>
                </select>
              </label>

              <div className="serial-buttons-group">
                {serialKeyer.status === 'connected' ? (
                  <button
                    type="button"
                    className="serial-connect-btn is-connected"
                    onClick={() => void serialKeyer.disconnect()}
                  >
                    <X size={13} />
                    Bağlantıyı Kes
                  </button>
                ) : (
                  <button
                    type="button"
                    className="serial-connect-btn"
                    disabled={!serialKeyer.isSupported || serialKeyer.status === 'connecting'}
                    onClick={() => void serialKeyer.connect()}
                    title={
                      !serialKeyer.isSupported
                        ? 'Web Serial API yalnızca Chrome, Edge ve Chromium tarayıcılarda kullanılabilir.'
                        : 'Fiziksel maniple cihazınızı seçin'
                    }
                  >
                    <Cable size={13} />
                    USB Maniple Bağla
                  </button>
                )}

                <button
                  type="button"
                  className="serial-guide-btn"
                  onClick={() => setShowSerialModal(true)}
                >
                  <FileCode size={13} />
                  Şema &amp; Arduino Kodu
                </button>
              </div>
            </div>

            {serialKeyer.status === 'connected' && (
              <div className="serial-signals-meter">
                <span>Canlı Girişler:</span>
                <span className={`signal-lamp ${serialKeyer.signals.dit ? 'active' : ''}`}>
                  DIT (Sol) {serialKeyer.signals.dit ? '●' : '○'}
                </span>
                <span className={`signal-lamp ${serialKeyer.signals.dah ? 'active' : ''}`}>
                  DAH (Sağ) {serialKeyer.signals.dah ? '●' : '○'}
                </span>
                <span className={`signal-lamp ${serialKeyer.signals.straight ? 'active' : ''}`}>
                  DÜZ KEY {serialKeyer.signals.straight ? '●' : '○'}
                </span>
              </div>
            )}

            {serialKeyer.errorMsg && (
              <div className="serial-error-text">⚠️ {serialKeyer.errorMsg}</div>
            )}
          </div>
        </div>

        <div className="keyer-outputs">
          <div>
            <span className="field-caption">ÜRETİLEN MORS KODU</span>
            <p className="morse-text keyer-morse-output">{combinedKeyerMorse || 'Sinyalleriniz burada birikecek.'}</p>
          </div>
          <div>
            <span className="field-caption">ÇÖZÜMLENEN METİN</span>
            <p className="keyer-text-output" dir={keyerAlphabet === 'arabic' ? 'rtl' : 'ltr'}>{keyedText || 'Çözümlenen metin burada görünecek.'}</p>
          </div>
        </div>

        <div className="keyer-actions">
          <button className="primary-button" disabled={!combinedKeyerMorse} onClick={() => void audio.play(combinedKeyerMorse).catch((error: Error) => notify(error.message))}><Play size={14} />Tekrar dinle</button>
          <button className="secondary-button" disabled={!keyedText} onClick={() => {
            if (speakingKeyer) { stopSpeaking(); setSpeakingKeyer(false); return; }
            speakText(keyedText, speechLangForAlphabet(keyerAlphabet), {
              onStart: () => setSpeakingKeyer(true),
              onEnd: () => setSpeakingKeyer(false),
              onError: (msg) => { setSpeakingKeyer(false); notify(msg); },
            });
          }}>{speakingKeyer ? <Square size={14} /> : <Volume2 size={15} />}{speakingKeyer ? 'Durdur' : 'Sesli oku'}</button>
          <button className="secondary-button" disabled={!combinedKeyerMorse} onClick={() => {
            try { downloadBlob(createWav(combinedKeyerMorse, settings), 'morslab-maniple.wav'); notify('WAV dosyanız hazır.'); }
            catch (error) { notify(error instanceof Error ? error.message : 'WAV oluşturulamadı.'); }
          }}><ArrowDownToLine size={15} />WAV indir</button>
          <button className="secondary-button" disabled={!combinedKeyerMorse} onClick={() => onOpen(combinedKeyerMorse, 'decode', keyerAlphabet)}>Çeviricide aç<ArrowRight size={14} /></button>
          <button className="text-button" disabled={!combinedKeyerMorse && !keyedBuffer} onClick={() => { clearKeyerTimers(); iambicEngine.current?.stopAll(); stopTone(); setKeyedBuffer(''); setKeyedMorse(''); }}><RotateCcw size={13} />Sıfırla</button>
        </div>
      </section>
      <div className="practice-summary"><Sparkles size={17} /><p>1 çizgi = 3 nokta süresi. Iambic modunda basılı tuttuğunuzda otomatik dit/dah üretilir; duraklamada harfler ve kelimeler (/) ayrılır.</p></div>

      {showSerialModal && (
        <Modal
          title="Fiziksel Maniple Bağlantısı & Donanım Şeması"
          onClose={() => setShowSerialModal(false)}
        >
          <div className="serial-modal-body">
            <div className="serial-tabs-bar" role="tablist">
              <button
                type="button"
                className={`serial-tab-btn ${activeSerialTab === 'arduino' ? 'active' : ''}`}
                onClick={() => setActiveSerialTab('arduino')}
              >
                Arduino / RP2040 / ESP32 Kodu
              </button>
              <button
                type="button"
                className={`serial-tab-btn ${activeSerialTab === 'ftdi' ? 'active' : ''}`}
                onClick={() => setActiveSerialTab('ftdi')}
              >
                FTDI / USB-TTL Doğrudan Kablolama
              </button>
            </div>

            {activeSerialTab === 'arduino' ? (
              <div>
                <div className="schematic-box" style={{ marginBottom: 12 }}>
                  <h3>Arduino Pin Bağlantı Şeması</h3>
                  <p>Ekstra direnç gerekmez; dahili <code>INPUT_PULLUP</code> dirençleri kullanılır. Kontak kapandığında pini GND'ye çeker:</p>
                  <ul>
                    <li><strong>Pin 2:</strong> Dit (Sol Kol / Tip)</li>
                    <li><strong>Pin 3:</strong> Dah (Sağ Kol / Ring)</li>
                    <li><strong>Pin 4:</strong> Düz Maniple (Straight Key)</li>
                    <li><strong>GND:</strong> Ortak Şasi (Sleeve)</li>
                  </ul>
                </div>

                <div className="sketch-header-row">
                  <span className="field-caption">ARDUINO C++ FIRMWARE (115200 BAUD)</span>
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ minHeight: 28, padding: '4px 10px', fontSize: 11 }}
                    onClick={() => {
                      void navigator.clipboard.writeText(getArduinoKeyerSketch());
                      setCopiedCode(true);
                      notify('Arduino firmware kodu panoya kopyalandı.');
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                  >
                    {copiedCode ? <Check size={12} /> : <Copy size={12} />}
                    {copiedCode ? 'Kopyalandı' : 'Kodu Kopyala'}
                  </button>
                </div>

                <pre className="sketch-code-box">{getArduinoKeyerSketch()}</pre>
              </div>
            ) : (
              <div className="wiring-schematic-grid">
                <div className="schematic-box">
                  <h3>FTDI / CH340 / CP2102 USB-UART Adaptörü (Mikrodenetleyicisiz)</h3>
                  <p>Herhangi bir kod yüklemeden, standart bir USB-TTL seri adaptörünün modem hatlarını maniple kontaklarına bağlayabilirsiniz:</p>
                  <ul>
                    <li><strong>CTS (Clear To Send):</strong> Sol Paddle (Dit) kontağı</li>
                    <li><strong>DSR (Data Set Ready):</strong> Sağ Paddle (Dah) kontağı</li>
                    <li><strong>GND:</strong> 3.5mm jak ortak şasi kontağı</li>
                  </ul>
                  <p>Kontak kapandığında sinyal hattı GND'ye çekilir ve Web Serial API CTS/DSR lojik seviyesini anında tarayıcıya iletir (~250 Hz örnekleme hızı).</p>
                </div>
                <div className="schematic-box">
                  <h3>3.5 mm Stereo Jak Standart Pin Dağılımı</h3>
                  <ul>
                    <li><strong>Uç (Tip):</strong> Dit / Nokta (Sol kol)</li>
                    <li><strong>Halka (Ring):</strong> Dah / Çizgi (Sağ kol)</li>
                    <li><strong>Gövde (Sleeve):</strong> Ortak Toprak (GND)</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>}
  </div>;
}

export function HistoryWorkspace({ entries, onDelete, onRestore, onClear, notify }: { entries: HistoryEntry[]; onDelete: (id: string) => void; onRestore: (entry: HistoryEntry) => void; onClear: () => void; notify: Notify }) {
  const [query, setQuery] = useState('');
  const [confirm, setConfirm] = useState(false);
  const filtered = entries.filter((entry) => `${entry.input} ${entry.output}`.toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr')));
  return <div className="tool-workspace">
    <div className="workspace-controls"><label className="search-field history-search"><Search size={15} /><input aria-label="Geçmişte ara" placeholder="Mesajlarınızda arayın" value={query} onChange={(event) => setQuery(event.target.value)} /></label><div className="filter-actions"><span className="subtle">{entries.length} kayıt</span><button className="secondary-button" disabled={!entries.length} onClick={() => { downloadBlob(new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' }), 'morslab-gecmis.json'); notify('Geçmiş dışa aktarıldı.'); }}><ArrowDownToLine size={14} />Dışa aktar</button><button className="icon-button" disabled={!entries.length} aria-label="Tüm geçmişi temizle" onClick={() => setConfirm(true)}><Trash2 size={16} /></button></div></div>
    {!entries.length ? <EmptyState icon={<History size={29} />} title="İlk sinyalinizle başlar." description="Çeviricide dinlediğiniz veya kaydettiğiniz mesajları burada bulacaksınız. Hepsi yalnızca bu cihazda saklanır." /> : !filtered.length ? <EmptyState icon={<Search size={26} />} title="Mesaj bulunamadı" description="Farklı bir kelimeyle aramayı deneyin." /> : <div className="history-list">{filtered.map((entry) => <article className="history-entry" key={entry.id}><div className="history-entry-top"><span className="entry-type">{entry.direction === 'encode' ? 'Metin → Mors' : 'Mors → Metin'}</span><time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time></div><p className={entry.direction === 'decode' ? 'history-morse' : ''}>{entry.input}</p><p className={entry.direction === 'encode' ? 'history-morse secondary' : 'secondary'}>{entry.output}</p><div className="history-entry-actions"><button className="text-button" onClick={() => onRestore(entry)}>Çeviricide aç<ArrowRight size={13} /></button><button className="icon-button small" aria-label="Kaydı sil" onClick={() => onDelete(entry.id)}><Trash2 size={14} /></button></div></article>)}</div>}
    {confirm && <Modal title="Çeviri geçmişi temizlensin mi?" onClose={() => setConfirm(false)}><p className="modal-description">Bu cihazda kayıtlı {entries.length} çeviri silinecek. Bu işlem geri alınamaz. Önce dışa aktararak yedekleyebilirsiniz.</p><div className="modal-actions"><button className="secondary-button" onClick={() => setConfirm(false)}>Vazgeç</button><button className="danger-button" onClick={() => { onClear(); setConfirm(false); }}>Geçmişi temizle</button></div></Modal>}
  </div>;
}

export function RadioWorkspace({ notify }: { notify: Notify }) {
  const [contacts, setContacts] = usePersistentState<Contact[]>('morslab.contacts', []);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteId, setDeleteId] = useState('');
  const upload = useRef<HTMLInputElement>(null);
  const saveContact = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const date = new Date(String(values.get('date')));
    if (!Number.isFinite(date.getTime())) { notify('Geçerli bir tarih seçin.'); return; }
    const contact: Contact = { id: crypto.randomUUID(), callsign: String(values.get('callsign')).toUpperCase(), frequency: String(values.get('frequency')), mode: String(values.get('mode')), grid: String(values.get('grid')).toUpperCase(), sent: String(values.get('sent')), received: String(values.get('received')), date: date.toISOString() };
    setContacts((previous) => [contact, ...previous]); setFormOpen(false); notify('Yeni bağlantınız deftere kaydedildi.');
  };
  const localDate = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  return <div className="tool-workspace">
    <div className="workspace-controls"><div className="practice-mode-label"><Radio size={16} /><span>{contacts.length} bağlantı kaydı</span></div><div className="filter-actions"><button className="secondary-button" onClick={() => upload.current?.click()}><FileUp size={14} />ADIF al</button><button className="secondary-button" disabled={!contacts.length} onClick={() => downloadBlob(new Blob([exportAdif(contacts)], { type: 'text/plain' }), 'morslab-istasyon.adi')}><ArrowDownToLine size={14} />ADIF indir</button><button className="primary-button" onClick={() => setFormOpen(true)}><Plus size={16} />Yeni bağlantı</button></div>
      <input ref={upload} className="sr-only" type="file" accept=".adi,.adif,.txt" aria-label="ADIF dosyası içe aktar" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { const imported = importAdif(await file.text()); if (!imported.length) { notify('Dosyada geçerli bir ADIF bağlantısı bulunamadı.'); return; } setContacts((previous) => [...imported, ...previous]); notify(`${imported.length} bağlantı içe aktarıldı.`); } catch { notify('ADIF dosyası okunamadı.'); } finally { if (upload.current) upload.current.value = ''; } }} />
    </div>
    {!contacts.length ? <EmptyState icon={<NotebookPen size={29} />} title="Her bağlantının bir hikayesi var." description="İstasyon bağlantılarınızı kaydedin. Çağrı işaretleri, frekanslar ve sinyal raporları çevrimdışı da elinizin altında olsun."><button className="primary-button" onClick={() => setFormOpen(true)}><Plus size={16} />İlk bağlantıyı ekle</button></EmptyState> : <div className="table-scroll"><table className="contacts-table"><thead><tr><th>Çağrı işareti</th><th>Tarih / UTC</th><th>Frekans</th><th>Mod</th><th>RST</th><th>Konum</th><th><span className="sr-only">İşlemler</span></th></tr></thead><tbody>{contacts.map((contact) => <tr key={contact.id}><td><strong>{contact.callsign}</strong></td><td>{new Date(contact.date).toLocaleString('tr-TR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td><td>{contact.frequency} <small>MHz</small><span className="table-band">{bandFromFrequency(Number(contact.frequency))}</span></td><td>{contact.mode}</td><td>{contact.sent} / {contact.received}</td><td>{contact.grid || 'Belirtilmedi'}</td><td><button className="icon-button small" aria-label={`${contact.callsign} kaydını sil`} onClick={() => setDeleteId(contact.id)}><Trash2 size={14} /></button></td></tr>)}</tbody></table></div>}
    <div className="plain-note"><ShieldCheck size={16} /><p>Defteriniz yalnızca bu tarayıcıda saklanır. Verilerinizi korumak için düzenli olarak ADIF 3.1.4 biçiminde yedek alın. Bu sürüm fiziksel telsiz donanımını kontrol etmez.</p></div>
    {formOpen && <Modal title="Yeni istasyon bağlantısı" onClose={() => setFormOpen(false)}><form onSubmit={saveContact} className="contact-form"><div className="form-grid"><label>Çağrı işareti<input name="callsign" placeholder="TA1ABC" required pattern="[A-Za-z0-9/]{3,16}" title="3-16 harf, rakam veya /" autoFocus maxLength={16} /></label><label>Tarih ve saat (yerel)<input name="date" type="datetime-local" required defaultValue={localDate} /></label><label>Frekans (MHz)<input name="frequency" type="number" min="0.001" max="1000" step="0.001" defaultValue="14.060" required /></label><label>Mod<select name="mode"><option>CW</option><option>SSB</option><option>FT8</option><option>FM</option></select></label><label>Gönderilen RST<input name="sent" defaultValue="599" pattern="[1-5][1-9][1-9]?" required title="59 veya 599 gibi geçerli bir RST raporu" /></label><label>Alınan RST<input name="received" defaultValue="599" pattern="[1-5][1-9][1-9]?" required title="59 veya 599 gibi geçerli bir RST raporu" /></label><label className="full-width">Maidenhead konumu (isteğe bağlı)<input name="grid" placeholder="KN41" pattern="[A-Ra-r]{2}[0-9]{2}([A-Xa-x]{2})?" maxLength={6} title="KN41 veya KN41ma gibi bir konum" /></label></div><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setFormOpen(false)}>Vazgeç</button><button className="primary-button" type="submit"><Check size={15} />Bağlantıyı kaydet</button></div></form></Modal>}
    {deleteId && <Modal title="Bağlantı silinsin mi?" onClose={() => setDeleteId('')}><p className="modal-description">Bu bağlantı istasyon defterinizden kalıcı olarak silinecek.</p><div className="modal-actions"><button className="secondary-button" onClick={() => setDeleteId('')}>Vazgeç</button><button className="danger-button" onClick={() => { setContacts((previous) => previous.filter((item) => item.id !== deleteId)); setDeleteId(''); }}>Kaydı sil</button></div></Modal>}
  </div>;
}

export function SettingsWorkspace({ settings, onSettings, theme, onTheme, onInstall, installed, notify }: { settings: AudioSettings; onSettings: (settings: AudioSettings) => void; theme: string; onTheme: (theme: string) => void; onInstall: () => void; installed: boolean; notify: Notify }) {
  const [confirm, setConfirm] = useState(false);
  return <div className="settings-workspace"><section className="preference-section"><div className="preference-title"><h2>Size ait bir çalışma alanı.</h2><p>Tercihleriniz bu cihazda hatırlanır.</p></div><div className="preference-row"><div><h3>Görünüm</h3><p>Size en rahat gelen ortamı seçin.</p></div><div className="theme-options">{[{ value: 'light', label: 'Açık', icon: Sun }, { value: 'dark', label: 'Koyu', icon: Moon }, { value: 'system', label: 'Sistem', icon: Monitor }].map(({ value, label, icon: Icon }) => <button key={value} className={theme === value ? 'selected' : ''} aria-pressed={theme === value} onClick={() => onTheme(value)}><Icon size={16} />{label}</button>)}</div></div><div className="preference-row"><div><h3>MorsLab, her yerde.</h3><p>Kurun, uygulama gibi açın ve çevrimdışı kullanın.</p></div><button className="secondary-button" onClick={onInstall}>{installed ? <Check size={15} /> : <ArrowDownToLine size={15} />}{installed ? 'Yüklü' : 'Uygulamayı yükle'}</button></div></section>
    <AudioSettingsPanel settings={settings} onChange={onSettings} />
    <section className="preference-section"><div className="preference-title"><h2>Verileriniz sizin kontrolünüzde.</h2><p>Hesap yok, sunucuya gönderilen mesaj yok.</p></div><div className="preference-row"><div><h3>Yerel verileri yedekle</h3><p>Geçmiş, alıştırmalar, istasyon defteri ve tercihler.</p></div><button className="secondary-button" onClick={() => { const backup = Object.fromEntries(Object.keys(localStorage).filter((key) => key.startsWith('morslab.')).map((key) => [key, JSON.parse(localStorage.getItem(key) || 'null')])); downloadBlob(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }), 'morslab-yedek.json'); notify('Yerel verileriniz yedeklendi.'); }}><ArrowDownToLine size={15} />Yedek indir</button></div><div className="preference-row"><div><h3>Tüm yerel verileri temizle</h3><p>Bu cihazda saklanan tüm MorsLab verilerini siler.</p></div><button className="text-button danger-text" onClick={() => setConfirm(true)}><Trash2 size={15} />Verileri temizle</button></div></section>
    <div className="about-source"><span>MorsLab Web · v2.2.0</span><a href="https://github.com/mserman90/MorsLab" target="_blank" rel="noreferrer">Kaynak depo<ArrowRight size={13} /></a><a href="./licenses/MorsLab-LICENSE.txt" target="_blank" rel="noreferrer">Apache-2.0 lisansı</a></div>
    {confirm && <Modal title="Tüm yerel veriler silinsin mi?" onClose={() => setConfirm(false)}><p className="modal-description">Geçmişiniz, istasyon defteriniz, alıştırma sonuçlarınız ve tercihleriniz silinecek. Önce yedek indirmenizi öneririz. Bu işlem geri alınamaz.</p><div className="modal-actions"><button className="secondary-button" onClick={() => setConfirm(false)}>Vazgeç</button><button className="danger-button" onClick={() => { Object.keys(localStorage).filter((key) => key.startsWith('morslab.')).forEach((key) => localStorage.removeItem(key)); onSettings({ ...DEFAULT_AUDIO }); window.location.reload(); }}><X size={15} />Tüm verileri sil</button></div></Modal>}
  </div>;
}

export function HelpContent({ onOpenFullGuide }: { onOpenFullGuide?: () => void }) {
  return <div className="help-content">
    <div className="help-intro"><CircleHelp size={27} /><p>Bir metin, dört biçim, 12 yön.<br /><strong>Metin, Mors, Konuşma ve CW ses arasında özgürce dönüşüm yapın.</strong></p></div>
    <ol className="help-steps">
      <li><span>01</span><div><h3>Metin ↔ Mors ↔ Sesli Okuma</h3><p>Uluslararası (Türkçe/İngilizce/Almanca), Kiril veya Arapça profillerle çift yönlü çeviri yapın; ayraç (/, |, #, *) ve prosign (&lt;AR&gt;, &lt;SK&gt;, &lt;BT&gt;) kullanın. Tek tuşla CW dinleyin, WAV indirin veya sesli okuyun.</p></div></li>
      <li><span>02</span><div><h3>Konuşma ↔ Mors &amp; CW Ses Çözümleme</h3><p>Ses laboratuvarında canlı mikrofondan konuşmanızı Morsa, Mors kodunu konuşmaya veya ses dosyalarını/canlı CW tonlarını Goertzel DSP filtresiyle metne dönüştürün.</p></div></li>
      <li><span>03</span><div><h3>Maniple &amp; Alıştırmalar</h3><p>Alıştırmalar sekmesinde kulak eğitimi yapın veya Maniple ile dokunarak / Spacebar ile canlı CW sinyali üretip anında metne çözün.</p></div></li>
    </ol>
    <div className="help-offline"><ShieldCheck size={18} /><p>Çeviri, CW ses üretimi, Goertzel DSP dosya çözümleme, maniple ve alıştırmalar tamamen cihazınızda çevrimdışı çalışır. Konuşma tanıma tarayıcı desteği ve internet gerektirebilir. Masaüstü sürümündeki yerel AI modelleri ve seri port telsiz anahtarlama web sürümünde bulunmaz.</p></div>
    {onOpenFullGuide && <button className="primary-button full-width-button help-full-guide-btn" onClick={onOpenFullGuide}>Akademik açıklamayı ve kullanım kılavuzunu aç<ArrowRight size={15} /></button>}
    <p className="source-credit">MorsLab, Mustafa Mert Akceylan ve Murat Erman'ın açık kaynak projesi temel alınarak hazırlanmıştır. <a href="https://github.com/mserman90/MorsLab" target="_blank" rel="noreferrer">Kaynak projeyi inceleyin.</a></p>
  </div>;
}
