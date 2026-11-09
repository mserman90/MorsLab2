// Alphabet, profiles, PARIS/Farnsworth timing, and Goertzel CW demodulation adapted from mserman90/MorsLab (Apache-2.0).
export type Alphabet = 'latin' | 'russian' | 'arabic';
export type Separator = '/' | '|' | '#' | '*';

export const SEPARATORS: { value: Separator; label: string }[] = [
  { value: '/', label: 'Ayraç: /' },
  { value: '|', label: 'Ayraç: |' },
  { value: '#', label: 'Ayraç: #' },
  { value: '*', label: 'Ayraç: *' },
];

export const PROSIGNS: { token: string; code: string; desc: string }[] = [
  { token: '<AR>', code: '.-.-.', desc: 'Mesaj sonu' },
  { token: '<SK>', code: '...-.-', desc: 'Görüşme sonu' },
  { token: '<BT>', code: '-...-', desc: 'Bölüm ayracı' },
  { token: '<AS>', code: '.-...', desc: 'Bekleyin' },
  { token: '<KN>', code: '-.--.', desc: 'Yalnız çağrılan istasyon' },
  { token: 'SOS', code: '...---...', desc: 'Acil durum çağrısı' },
];

const PROSIGN_CODES: Record<string, string> = {
  '<AR>': '.-.-.',
  '<SK>': '...-.-',
  '<BT>': '-...-',
  '<AS>': '.-...',
  '<KN>': '-.--.',
  '<SOS>': '...---...',
};

export const LATIN: Record<string, string> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.',
  G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..',
  M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.',
  S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
  Y: '-.--', Z: '--..',
  '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
  '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '/': '-..-.',
  '(': '-.--.', ')': '-.--.-', ':': '---...', '=': '-...-', '+': '.-.-.',
  '-': '-....-', '"': '.-..-.', '@': '.--.-.', '!': '-.-.--', '&': '.-...',
  ';': '-.-.-.', _: '..--.-', $: '...-..-',
};

const RUSSIAN: Record<string, string> = {
  '\u0410': '.-', '\u0411': '-...', '\u0412': '.--', '\u0413': '--.', '\u0414': '-..',
  '\u0415': '.', '\u0416': '...-', '\u0417': '--..', '\u0418': '..', '\u0419': '.---',
  '\u041a': '-.-', '\u041b': '.-..', '\u041c': '--', '\u041d': '-.', '\u041e': '---',
  '\u041f': '.--.', '\u0420': '.-.', '\u0421': '...', '\u0422': '-', '\u0423': '..-',
  '\u0424': '..-.', '\u0425': '....', '\u0426': '-.-.', '\u0427': '---.', '\u0428': '----',
  '\u0429': '--.-', '\u042a': '--.--', '\u042b': '-.--', '\u042c': '-..-',
  '\u042d': '..-..', '\u042e': '..--', '\u042f': '.-.-',
};

const ARABIC: Record<string, string> = {
  '\u0627': '.-', '\u0628': '-...', '\u062a': '-', '\u062b': '-.-.', '\u062c': '.---',
  '\u062d': '....', '\u062e': '---', '\u062f': '-..', '\u0630': '--..', '\u0631': '.-.',
  '\u0632': '---.', '\u0633': '...', '\u0634': '----', '\u0635': '-..-', '\u0636': '...-',
  '\u0637': '..-', '\u0638': '-.--', '\u0639': '.-.-', '\u063a': '--.', '\u0641': '..-.',
  '\u0642': '--.-', '\u0643': '-.-', '\u0644': '.-..', '\u0645': '--', '\u0646': '-.',
  '\u0647': '..-..', '\u0648': '.--', '\u064a': '..', '\u0621': '.',
};

export const ALPHABETS: { value: Alphabet; label: string; locale: string }[] = [
  { value: 'latin', label: 'Uluslararası (ITU)', locale: 'tr-TR' },
  { value: 'russian', label: 'Kiril (Rusça)', locale: 'ru-RU' },
  { value: 'arabic', label: 'Arapça', locale: 'ar-SA' },
];

export function getAlphabet(alphabet: Alphabet = 'latin'): Record<string, string> {
  if (alphabet === 'latin') return LATIN;
  const common = Object.fromEntries(Object.entries(LATIN).filter(([letter]) => !/^[A-Z]$/.test(letter)));
  return { ...(alphabet === 'russian' ? RUSSIAN : ARABIC), ...common };
}

export function normalizeText(text: string, alphabet: Alphabet = 'latin') {
  let normalized = text.toUpperCase();
  if (alphabet === 'latin') {
    normalized = normalized.replace(/\u0130/g, 'I').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  if (alphabet === 'russian') normalized = normalized.replace(/\u0401/g, '\u0415');
  if (alphabet === 'arabic') {
    normalized = normalized.replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627')
      .replace(/\u0624/g, '\u0648').replace(/[\u0626\u0649]/g, '\u064a')
      .replace(/\u0629/g, '\u0647').replace(/[\u0640\u064b-\u065f\u0670]/g, '')
      .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x660))
      .replace(/\u060c/g, ',').replace(/\u061b/g, ';').replace(/\u061f/g, '?');
  }
  return normalized;
}

const PROSIGN_REGEX = /<(?:AR|SK|BT|AS|KN|SOS)>/g;

export function encodeMorse(text: string, alphabet: Alphabet = 'latin', separator: Separator = '/') {
  const table = getAlphabet(alphabet);
  return normalizeText(text, alphabet).trim().split(/\s+/)
    .map((word) => {
      const tokens: string[] = [];
      let cursor = 0;
      PROSIGN_REGEX.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = PROSIGN_REGEX.exec(word))) {
        for (const letter of word.slice(cursor, match.index)) {
          if (table[letter]) tokens.push(table[letter]);
        }
        tokens.push(PROSIGN_CODES[match[0]]);
        cursor = match.index + match[0].length;
      }
      for (const letter of word.slice(cursor)) {
        if (table[letter]) tokens.push(table[letter]);
      }
      return tokens.join(' ');
    })
    .filter(Boolean).join(` ${separator} `);
}

export function cleanMorse(code: string) {
  return code
    .replace(/[\u00b7\u2022]/g, '.')
    .replace(/[\u2013\u2014_]/g, '-')
    .replace(/ {3,}/g, ' / ')
    .replace(/[|#*\n/]+/g, ' / ')
    .replace(/\s+/g, ' ')
    .replace(/(?:\s*\/\s*){2,}/g, ' / ')
    .trim();
}

export function decodeMorse(code: string, alphabet: Alphabet = 'latin') {
  if (!code.trim()) return '';
  const reverse = Object.fromEntries(Object.entries(getAlphabet(alphabet)).map(([letter, value]) => [value, letter]));
  reverse['...---...'] = 'SOS';
  reverse['...-.-'] = '<SK>';
  return cleanMorse(code).split(/\s*\/\s*|\s{3,}/)
    .map((word) => word.trim().split(/\s+/).filter(Boolean).map((symbol) => reverse[symbol] || '\ufffd').join(''))
    .filter(Boolean).join(' ');
}

export function unsupportedCharacters(text: string, alphabet: Alphabet) {
  const table = getAlphabet(alphabet);
  const withoutProsigns = normalizeText(text, alphabet).replace(PROSIGN_REGEX, '');
  return [...new Set([...withoutProsigns].filter((letter) => !/\s/.test(letter) && !table[letter]))];
}

import { applyHfRadioEffects, type RadioNoiseSettings, DEFAULT_NOISE, HF_NOISE_PRESETS } from './hfNoise';
export { type RadioNoiseSettings, DEFAULT_NOISE, HF_NOISE_PRESETS } from './hfNoise';

export type AudioSettings = {
  wpm: number;
  frequency: number;
  volume: number;
  farnsworth: boolean;
  noise?: RadioNoiseSettings;
};

export const DEFAULT_AUDIO: AudioSettings = {
  wpm: 20,
  frequency: 600,
  volume: 70,
  farnsworth: false,
  noise: DEFAULT_NOISE,
};
export type SignalSegment = { on: boolean; start: number; duration: number };

export function getTimeline(code: string, settings: AudioSettings): SignalSegment[] {
  const unit = 1.2 / settings.wpm;
  const effective = Math.max(5, Math.round(settings.wpm * 0.6));
  const gap = settings.farnsworth ? Math.max(unit, (60 - 37.2 * effective / settings.wpm) / (19 * effective)) : unit;
  const segments: SignalSegment[] = [];
  let cursor = 0.04;
  const add = (on: boolean, duration: number) => {
    segments.push({ on, start: cursor, duration });
    cursor += duration;
  };
  const words = cleanMorse(code).replace(/[^.\- /]/g, '').split(/\s*\/\s*/).filter(Boolean);
  words.forEach((word, wi) => {
    const letters = word.trim().split(/\s+/).filter(Boolean);
    letters.forEach((letter, li) => {
      [...letter].forEach((symbol, si) => {
        add(true, symbol === '-' ? unit * 3 : unit);
        if (si < letter.length - 1) add(false, unit);
      });
      if (li < letters.length - 1) add(false, gap * 3);
    });
    if (wi < words.length - 1) add(false, gap * 7);
  });
  return segments;
}

export function getDuration(code: string, settings: AudioSettings) {
  const timeline = getTimeline(code, settings);
  const last = timeline[timeline.length - 1];
  return last ? last.start + last.duration + 0.06 : 0;
}

export function createSamples(code: string, settings: AudioSettings, sampleRate = 22050) {
  const duration = getDuration(code, settings);
  if (!duration) throw new Error('Önce bir metin veya Mors kodu girin.');
  if (duration > 180) throw new Error('Ses 3 dakikayı aşıyor. Metni kısaltın veya hızı artırın.');
  const samples = new Float32Array(Math.ceil(duration * sampleRate));
  for (const segment of getTimeline(code, settings)) {
    if (!segment.on) continue;
    const start = Math.round(segment.start * sampleRate);
    const length = Math.round(segment.duration * sampleRate);
    const ramp = Math.min(Math.round(0.004 * sampleRate), length / 4);
    for (let i = 0; i < length && start + i < samples.length; i++) {
      const envelope = Math.min(1, i / ramp, (length - i - 1) / ramp);
      samples[start + i] = Math.sin(2 * Math.PI * settings.frequency * i / sampleRate) * 0.65 * envelope;
    }
  }

  // Apply QRN / QRM / QSB HF radio conditions if enabled
  if (settings.noise?.enabled) {
    return applyHfRadioEffects(samples, sampleRate, settings.frequency, settings.noise);
  }

  return samples;
}

export function createWav(code: string, settings: AudioSettings) {
  const sampleRate = 22050;
  const samples = createSamples(code, settings, sampleRate);
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const write = (offset: number, text: string) => [...text].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
  write(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true);
  write(8, 'WAVE'); write(12, 'fmt '); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  write(36, 'data'); view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, i) => view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, sample * settings.volume / 100)) * 32767, true));
  return new Blob([buffer], { type: 'audio/wav' });
}

export { downloadBlob } from './download';

// Second-order recursive Goertzel magnitude resonator for narrowband CW carrier detection.
export function goertzelMagnitude(samples: Float32Array, start: number, length: number, sampleRate: number, frequency: number) {
  const end = Math.min(samples.length, start + length);
  const count = end - start;
  if (count <= 0 || frequency <= 0 || frequency >= sampleRate / 2) return 0;
  const omega = (2 * Math.PI * frequency) / sampleRate;
  const coeff = 2 * Math.cos(omega);
  let s1 = 0;
  let s2 = 0;
  for (let i = start; i < end; i++) {
    const s0 = samples[i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  const power = Math.max(0, s1 * s1 + s2 * s2 - coeff * s1 * s2);
  return (2 * Math.sqrt(power)) / count;
}

export function detectDominantCwFrequency(pcm: Float32Array, sampleRate: number, preferredFreq = 600) {
  const probeWindow = Math.max(64, Math.floor(sampleRate * 0.025));
  const step = probeWindow;
  const activeStarts: number[] = [];
  const energies: { start: number; rms: number }[] = [];
  for (let start = 0; start + probeWindow <= pcm.length; start += step) {
    let sum = 0;
    for (let i = start; i < start + probeWindow; i++) sum += pcm[i] * pcm[i];
    energies.push({ start, rms: Math.sqrt(sum / probeWindow) });
  }
  if (!energies.length) return preferredFreq;
  energies.sort((a, b) => b.rms - a.rms);
  const maxRms = energies[0].rms;
  if (maxRms < 0.004) return preferredFreq;
  for (const item of energies.slice(0, 48)) {
    if (item.rms >= maxRms * 0.35) activeStarts.push(item.start);
  }
  const candidates: number[] = [preferredFreq];
  for (let f = 300; f <= 1200; f += 25) {
    if (Math.abs(f - preferredFreq) >= 10) candidates.push(f);
  }
  let bestFreq = preferredFreq;
  let bestScore = -1;
  for (const freq of candidates) {
    let score = 0;
    for (const start of activeStarts) {
      score += goertzelMagnitude(pcm, start, probeWindow, sampleRate, freq);
    }
    if (score > bestScore) {
      bestScore = score;
      bestFreq = freq;
    }
  }
  return bestFreq;
}

export function decodeAudioSignal(pcm: Float32Array, sampleRate: number, wpm: number, preferredFreq = 600) {
  const step = Math.max(1, Math.floor(sampleRate * 0.005));
  const windowSize = Math.max(step, Math.floor(sampleRate * 0.01));
  const detectedFreq = detectDominantCwFrequency(pcm, sampleRate, preferredFreq);

  const goertzelSeries: number[] = [];
  const rmsSeries: number[] = [];
  for (let start = 0; start + step <= pcm.length; start += step) {
    const winStart = Math.max(0, Math.min(pcm.length - windowSize, start - Math.floor((windowSize - step) / 2)));
    const len = Math.min(windowSize, pcm.length - winStart);
    goertzelSeries.push(goertzelMagnitude(pcm, winStart, len, sampleRate, detectedFreq));
    let sum = 0;
    for (let i = start; i < start + step; i++) sum += pcm[i] * pcm[i];
    rmsSeries.push(Math.sqrt(sum / step));
  }

  if (goertzelSeries.length < 4) return { morse: '', detectedFreq };

  const gPeak = [...goertzelSeries].sort((a, b) => a - b)[Math.floor(goertzelSeries.length * 0.95)] || 0;
  const rPeak = [...rmsSeries].sort((a, b) => a - b)[Math.floor(rmsSeries.length * 0.95)] || 0;
  const useGoertzel = gPeak >= 0.004 && gPeak >= rPeak * 0.15;
  const energies = useGoertzel ? goertzelSeries : rmsSeries;

  const sorted = [...energies].sort((a, b) => a - b);
  const peak = sorted[Math.floor(sorted.length * 0.95)] || 0;
  if (peak < 0.004) return { morse: '', detectedFreq };
  const floor = sorted[Math.floor(sorted.length * 0.1)] || 0;
  if (peak - floor < 0.003) return { morse: '', detectedFreq };

  const thetaHigh = floor + (peak - floor) * 0.42;
  const thetaLow = floor + (peak - floor) * 0.25;

  const runs: { on: boolean; duration: number }[] = [];
  let state = false;
  const frameDuration = step / sampleRate;
  for (const energy of energies) {
    if (!state && energy >= thetaHigh) state = true;
    else if (state && energy < thetaLow) state = false;
    const previous = runs[runs.length - 1];
    if (previous?.on === state) previous.duration += frameDuration;
    else runs.push({ on: state, duration: frameDuration });
  }

  // Merge micro-glitches (< 12ms) into surrounding runs to survive slight fading.
  const merged: { on: boolean; duration: number }[] = [];
  for (const run of runs) {
    if (run.duration < 0.012 && merged.length > 0) {
      merged[merged.length - 1].duration += run.duration;
    } else {
      merged.push({ ...run });
    }
  }
  const consolidated: { on: boolean; duration: number }[] = [];
  for (const run of merged) {
    const previous = consolidated[consolidated.length - 1];
    if (previous?.on === run.on) previous.duration += run.duration;
    else consolidated.push({ ...run });
  }

  while (consolidated.length && !consolidated[0].on) consolidated.shift();
  while (consolidated.length && !consolidated[consolidated.length - 1].on) consolidated.pop();

  const lengths = consolidated.filter((run) => run.on && run.duration > 0.015).map((run) => run.duration).sort((a, b) => a - b);
  if (!lengths.length) return { morse: '', detectedFreq };
  let unit = lengths[Math.floor(lengths.length * 0.2)];
  if (unit > (1.2 / wpm) * 2) unit /= 3;
  const morse = consolidated.filter((run) => run.duration > 0.01).map((run) => {
    if (run.on) return run.duration > unit * 2 ? '-' : '.';
    if (run.duration > unit * 5) return ' / ';
    if (run.duration > unit * 2) return ' ';
    return '';
  }).join('').trim();
  return { morse, detectedFreq };
}

export function decodeAudioSamples(pcm: Float32Array, sampleRate: number, wpm: number, preferredFreq = 600) {
  return decodeAudioSignal(pcm, sampleRate, wpm, preferredFreq).morse;
}

export function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
}

export type HistoryEntry = {
  id: string;
  input: string;
  output: string;
  direction: 'encode' | 'decode';
  alphabet: Alphabet;
  createdAt: string;
};
