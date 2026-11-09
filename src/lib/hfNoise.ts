/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface RadioNoiseSettings {
  enabled: boolean;
  qrnLevel: number; // 0 - 100 (Atmosferik statik & çatırtılar)
  qrmLevel: number; // 0 - 100 (Bitişik kanal CW paraziti & heterodin ötüşmesi)
  qsbLevel: number; // 0 - 100 (Sinyal sönümlenmesi / fading derinliği)
  qsbSpeed?: number; // 0.1 - 1.0 Hz (Fading hızı, varsayılan 0.3 Hz)
}

export const DEFAULT_NOISE: RadioNoiseSettings = {
  enabled: false,
  qrnLevel: 35,
  qrmLevel: 25,
  qsbLevel: 45,
  qsbSpeed: 0.3,
};

export interface HfNoisePreset {
  id: string;
  name: string;
  description: string;
  settings: RadioNoiseSettings;
}

export const HF_NOISE_PRESETS: HfNoisePreset[] = [
  {
    id: 'evening_40m',
    name: '40m Akşam Koşulları',
    description: 'Tipik akşam HF yayılımı; hafif atmosferik statik ve doğal sinyal dalgalanması.',
    settings: { enabled: true, qrnLevel: 35, qrmLevel: 15, qsbLevel: 45, qsbSpeed: 0.3 },
  },
  {
    id: 'contest_qrm',
    name: 'Zorlu Yarışma (Contest QRM)',
    description: 'Bitişik frekansta yarışan komşu istasyon ötüşmeleri ve yoğun kanal paraziti.',
    settings: { enabled: true, qrnLevel: 20, qrmLevel: 65, qsbLevel: 30, qsbSpeed: 0.4 },
  },
  {
    id: 'summer_storm',
    name: 'Yaz Fırtınası (Yoğun QRN)',
    description: 'Yıldırım deşarjları kaynaklı statik çatırtılar ve yüksek atmosferik dip gürültüsü.',
    settings: { enabled: true, qrnLevel: 75, qrmLevel: 20, qsbLevel: 50, qsbSpeed: 0.25 },
  },
  {
    id: 'deep_fading',
    name: 'Derin Sönümlenme (Derin QSB)',
    description: 'Sinyalin periyodik olarak gürültü tabanına gömüldüğü derin iyonosferik fading.',
    settings: { enabled: true, qrnLevel: 25, qrmLevel: 15, qsbLevel: 85, qsbSpeed: 0.2 },
  },
];

/**
 * Applies periodic ionospheric signal fading (QSB) to the signal amplitude.
 */
export function applyQsbFading(
  samples: Float32Array,
  sampleRate: number,
  qsbLevel: number,
  qsbSpeed = 0.3
): Float32Array {
  if (qsbLevel <= 0) return samples;
  const depth = Math.min(1, Math.max(0, qsbLevel / 100)) * 0.85;
  const speed = Math.min(2, Math.max(0.05, qsbSpeed));
  const result = new Float32Array(samples.length);

  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate;
    // Multi-frequency wave for natural, non-monotonous ionospheric fading
    const wave = 0.65 * Math.sin(2 * Math.PI * speed * t) + 0.35 * Math.sin(2 * Math.PI * (speed * 0.43) * t + 1.2);
    // Envelope ranges between (1 - depth) and 1.0
    const factor = Math.max(0.08, 1 - depth * (0.5 + 0.5 * wave));
    result[i] = samples[i] * factor;
  }
  return result;
}

/**
 * Generates atmospheric background noise (QRN) including base hiss and crackle bursts.
 */
export function generateQrnNoise(
  sampleCount: number,
  sampleRate: number,
  qrnLevel: number,
  seed = 42
): Float32Array {
  const noise = new Float32Array(sampleCount);
  if (qrnLevel <= 0) return noise;

  const amp = (Math.min(100, Math.max(0, qrnLevel)) / 100) * 0.18;
  let s = seed;
  const rand = () => {
    s = (s * 16807 + 11) % 2147483647;
    return s / 2147483647;
  };

  // 1-pole low-pass filter state for colored pink/atmospheric hiss
  let lp = 0;
  // Atmospheric crackle burst state
  let burstSamplesRemaining = 0;
  let burstAmp = 0;

  for (let i = 0; i < sampleCount; i++) {
    // Base Gaussian-like white noise
    const white = (rand() + rand() - 1.0);
    // Low-pass filtered to give warm HF receiver audio characteristic
    lp = lp * 0.6 + white * 0.4;

    // Random lightning / static crash crackles (roughly 3-8 bursts per second)
    if (burstSamplesRemaining <= 0) {
      if (rand() < 0.00045 * (qrnLevel / 50)) {
        burstSamplesRemaining = Math.floor(sampleRate * (0.01 + 0.03 * rand()));
        burstAmp = (0.3 + 0.7 * rand()) * amp * 3.5;
      }
    }

    let crackle = 0;
    if (burstSamplesRemaining > 0) {
      crackle = (rand() * 2 - 1) * burstAmp;
      burstSamplesRemaining--;
    }

    noise[i] = lp * amp + crackle;
  }

  return noise;
}

/**
 * Generates an adjacent station CW interference signal (QRM) and heterodyne whistle.
 */
export function generateQrmInterference(
  sampleCount: number,
  sampleRate: number,
  baseFrequency: number,
  qrmLevel: number
): Float32Array {
  const qrm = new Float32Array(sampleCount);
  if (qrmLevel <= 0) return qrm;

  const amp = (Math.min(100, Math.max(0, qrmLevel)) / 100) * 0.22;
  // Adjacent channel frequency offset (e.g. +140 Hz or -160 Hz)
  const qrmFreq = baseFrequency > 600 ? baseFrequency - 150 : baseFrequency + 140;
  // A secondary weak carrier heterodyne whistle
  const whistleFreq = baseFrequency + 280;

  // Simulate an asynchronous competing CW Morse stream
  const unitSamples = Math.floor(sampleRate * 0.07); // ~17 WPM
  const pattern = [1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0];

  for (let i = 0; i < sampleCount; i++) {
    const t = i / sampleRate;
    const patternIdx = Math.floor(i / unitSamples) % pattern.length;
    const isKeyOn = pattern[patternIdx] === 1;

    const tone = isKeyOn ? Math.sin(2 * Math.PI * qrmFreq * t) * 0.8 : 0;
    const heterodyne = Math.sin(2 * Math.PI * whistleFreq * t) * 0.12;

    qrm[i] = (tone + heterodyne) * amp;
  }

  return qrm;
}

/**
 * Master DSP function: Combines base Morse signal with QSB, QRN, and QRM effects.
 */
export function applyHfRadioEffects(
  cleanSamples: Float32Array,
  sampleRate: number,
  baseFrequency: number,
  noiseSettings?: RadioNoiseSettings
): Float32Array {
  if (!noiseSettings || !noiseSettings.enabled) {
    return cleanSamples;
  }

  const length = cleanSamples.length;
  // Step 1: Apply QSB (fading) to clean CW signal
  const fadedSignal = applyQsbFading(cleanSamples, sampleRate, noiseSettings.qsbLevel, noiseSettings.qsbSpeed ?? 0.3);

  // Step 2: Generate QRN (atmospheric static noise & crackles)
  const qrn = generateQrnNoise(length, sampleRate, noiseSettings.qrnLevel);

  // Step 3: Generate QRM (adjacent channel CW interference & whistle)
  const qrm = generateQrmInterference(length, sampleRate, baseFrequency, noiseSettings.qrmLevel);

  // Step 4: Mix all components together with soft clipping
  const output = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const mixed = fadedSignal[i] + qrn[i] + qrm[i];
    // Soft limiter using tanh to prevent harsh digital clipping
    output[i] = Math.tanh(mixed);
  }

  return output;
}
