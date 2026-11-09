import type { Alphabet } from './morse';

export type SpeechLang = 'tr-TR' | 'en-US' | 'de-DE' | 'ru-RU' | 'ar-SA';

export const SPEECH_LANGUAGES: { value: SpeechLang; label: string; shortLabel: string; alphabet: Alphabet; rtl?: boolean }[] = [
  { value: 'tr-TR', label: 'Türkçe (tr-TR)', shortLabel: 'TR', alphabet: 'latin' },
  { value: 'en-US', label: 'English (en-US)', shortLabel: 'EN', alphabet: 'latin' },
  { value: 'de-DE', label: 'Deutsch (de-DE)', shortLabel: 'DE', alphabet: 'latin' },
  { value: 'ru-RU', label: 'Русский (ru-RU)', shortLabel: 'RU', alphabet: 'russian' },
  { value: 'ar-SA', label: 'العربية (ar-SA)', shortLabel: 'AR', alphabet: 'arabic', rtl: true },
];

export function alphabetForSpeechLang(lang: SpeechLang): Alphabet {
  return SPEECH_LANGUAGES.find((item) => item.value === lang)?.alphabet ?? 'latin';
}

export function speechLangForAlphabet(alphabet: Alphabet): SpeechLang {
  if (alphabet === 'russian') return 'ru-RU';
  if (alphabet === 'arabic') return 'ar-SA';
  return 'tr-TR';
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export function speakText(
  text: string,
  lang: SpeechLang,
  handlers?: { onStart?: () => void; onEnd?: () => void; onError?: (message: string) => void },
) {
  const clean = text.trim();
  if (!clean) {
    handlers?.onError?.('Seslendirilecek metin bulunamadı.');
    return false;
  }
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    handlers?.onError?.('Tarayıcınız sesli okumayı desteklemiyor.');
    return false;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.lang = lang;

  try {
    const voices = window.speechSynthesis.getVoices();
    const lower = lang.toLowerCase();
    const prefix = lower.slice(0, 2);
    const matched = voices.find((voice) => voice.lang.toLowerCase() === lower)
      || voices.find((voice) => voice.lang.toLowerCase().startsWith(prefix));
    if (matched) utterance.voice = matched;
  } catch { /* Voice enumeration can be unavailable in restricted contexts. */ }

  utterance.onstart = () => handlers?.onStart?.();
  utterance.onend = () => handlers?.onEnd?.();
  utterance.onerror = (event) => {
    if (event.error === 'interrupted' || event.error === 'canceled') {
      handlers?.onEnd?.();
      return;
    }
    handlers?.onError?.('Sesli okuma başlatılamadı. Cihazınızdaki ses paketlerini kontrol edin.');
  };

  window.speechSynthesis.speak(utterance);
  return true;
}
