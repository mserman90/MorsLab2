/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type WaterfallPaletteId = 'classic_sdr' | 'amber_crt' | 'night_matrix' | 'fire_plasma';

export interface WaterfallPalette {
  id: WaterfallPaletteId;
  name: string;
  description: string;
  stops: Array<{ pos: number; r: number; g: number; b: number }>;
}

export const WATERFALL_PALETTES: WaterfallPalette[] = [
  {
    id: 'classic_sdr',
    name: 'Klasik Telsiz (SDR)',
    description: 'WebSDR ve GQRX telsiz alıcıları standardı (Lacivert → Camgöbeği → Sarı → Beyaz).',
    stops: [
      { pos: 0.0, r: 10, g: 14, b: 26 },
      { pos: 0.2, r: 16, g: 44, b: 110 },
      { pos: 0.45, r: 24, g: 154, b: 180 },
      { pos: 0.7, r: 80, g: 210, b: 90 },
      { pos: 0.88, r: 250, g: 220, b: 40 },
      { pos: 0.96, r: 245, g: 100, b: 30 },
      { pos: 1.0, r: 255, g: 255, b: 255 },
    ],
  },
  {
    id: 'amber_phosphor',
    name: 'Amber Fosfor (CRT)',
    description: 'Eski monokrom katot tüplü (CRT) radyo ekranı fosfor tonları.',
    stops: [
      { pos: 0.0, r: 12, g: 8, b: 3 },
      { pos: 0.3, r: 80, g: 40, b: 5 },
      { pos: 0.65, r: 200, g: 110, b: 15 },
      { pos: 0.85, r: 255, g: 175, b: 40 },
      { pos: 1.0, r: 255, g: 245, b: 200 },
    ],
  },
  {
    id: 'night_matrix',
    name: 'Gece Mavisi (Matrix)',
    description: 'Düşük ışıklı ortamlarda göz yormayan derin mavi ve akuamarin tonları.',
    stops: [
      { pos: 0.0, r: 5, g: 12, b: 20 },
      { pos: 0.4, r: 10, g: 50, b: 90 },
      { pos: 0.75, r: 20, g: 160, b: 180 },
      { pos: 0.95, r: 80, g: 235, b: 240 },
      { pos: 1.0, r: 240, g: 255, b: 255 },
    ],
  },
  {
    id: 'fire_plasma',
    name: 'Ateş Plazma',
    description: 'Yüksek kontrastlı termal plazma renk haritası.',
    stops: [
      { pos: 0.0, r: 0, g: 0, b: 0 },
      { pos: 0.25, r: 80, g: 10, b: 110 },
      { pos: 0.55, r: 210, g: 45, b: 45 },
      { pos: 0.8, r: 255, g: 165, b: 20 },
      { pos: 0.95, r: 255, g: 240, b: 120 },
      { pos: 1.0, r: 255, g: 255, b: 255 },
    ],
  },
];

/**
 * Builds a 256-entry Uint32Array color lookup table (ABGR format for direct 32-bit canvas pixel manipulation)
 * or RGB array for fast canvas scanlines.
 */
export function buildPaletteLut(paletteId: WaterfallPaletteId): Uint8ClampedArray {
  const palette = WATERFALL_PALETTES.find((p) => p.id === paletteId) || WATERFALL_PALETTES[0];
  const stops = palette.stops;
  const lut = new Uint8ClampedArray(256 * 4); // [r, g, b, a] for 0..255

  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let stopIdx = 0;
    while (stopIdx < stops.length - 1 && stops[stopIdx + 1].pos < t) {
      stopIdx++;
    }
    const s0 = stops[stopIdx];
    const s1 = stops[Math.min(stops.length - 1, stopIdx + 1)];
    const range = Math.max(0.0001, s1.pos - s0.pos);
    const fraction = Math.min(1, Math.max(0, (t - s0.pos) / range));

    const r = Math.round(s0.r + fraction * (s1.r - s0.r));
    const g = Math.round(s0.g + fraction * (s1.g - s0.g));
    const b = Math.round(s0.b + fraction * (s1.b - s0.b));

    const base = i * 4;
    lut[base] = r;
    lut[base + 1] = g;
    lut[base + 2] = b;
    lut[base + 3] = 255; // Fully opaque
  }

  return lut;
}

export interface PeakDetectionResult {
  frequency: number; // in Hz
  magnitude: number; // 0..255 byte value or normalized
  snrDb: number; // Signal-to-noise ratio in dB
  binIndex: number;
}

/**
 * Finds the dominant CW tone frequency peak in the frequency data within minFreq and maxFreq.
 * Uses parabolic/quadratic peak interpolation for sub-bin precision.
 */
export function detectCarrierPeak(
  freqData: Uint8Array | Float32Array,
  sampleRate: number,
  fftSize: number,
  minFreq = 200,
  maxFreq = 1600,
  minThreshold = 25,
): PeakDetectionResult | null {
  const binWidth = sampleRate / fftSize;
  const minBin = Math.max(1, Math.floor(minFreq / binWidth));
  const maxBin = Math.min(Math.floor(freqData.length - 2), Math.ceil(maxFreq / binWidth));

  if (minBin >= maxBin) return null;

  let maxVal = -Infinity;
  let maxIdx = -1;
  let sumVal = 0;
  let count = 0;

  for (let i = minBin; i <= maxBin; i++) {
    const val = freqData[i];
    sumVal += val;
    count++;
    if (val > maxVal) {
      maxVal = val;
      maxIdx = i;
    }
  }

  if (maxIdx <= 0 || maxVal < minThreshold) {
    return null;
  }

  const avgVal = count > 0 ? sumVal / count : 1;

  // Parabolic interpolation around peak
  const alpha = freqData[maxIdx - 1];
  const beta = freqData[maxIdx];
  const gamma = freqData[maxIdx + 1];

  let delta = 0;
  const denom = alpha - 2 * beta + gamma;
  if (denom !== 0) {
    delta = 0.5 * (alpha - gamma) / denom;
    delta = Math.max(-0.5, Math.min(0.5, delta));
  }

  const peakBin = maxIdx + delta;
  const exactFreq = Math.round(peakBin * binWidth);

  // Approximate SNR in dB
  const snr = avgVal > 0 ? 20 * Math.log10(Math.max(1.05, maxVal / Math.max(1, avgVal))) : 0;

  return {
    frequency: exactFreq,
    magnitude: maxVal,
    snrDb: Math.round(snr * 10) / 10,
    binIndex: maxIdx,
  };
}

/**
 * Maps a frequency in Hz to horizontal canvas coordinate X [0..width].
 */
export function frequencyToX(freq: number, minFreq: number, maxFreq: number, width: number): number {
  if (maxFreq <= minFreq) return 0;
  const clamped = Math.max(minFreq, Math.min(maxFreq, freq));
  return ((clamped - minFreq) / (maxFreq - minFreq)) * width;
}

/**
 * Maps horizontal canvas coordinate X [0..width] to frequency in Hz.
 */
export function xToFrequency(x: number, minFreq: number, maxFreq: number, width: number): number {
  if (width <= 0) return minFreq;
  const clampedX = Math.max(0, Math.min(width, x));
  return Math.round(minFreq + (clampedX / width) * (maxFreq - minFreq));
}

/**
 * Renders a single waterfall row into an ImageData or canvas row using the precomputed LUT and gain.
 */
export function renderWaterfallRow(
  freqData: Uint8Array,
  sampleRate: number,
  fftSize: number,
  minFreq: number,
  maxFreq: number,
  width: number,
  lut: Uint8ClampedArray,
  gainMultiplier = 1.0,
  rowBuffer: Uint8ClampedArray,
): void {
  const binWidth = sampleRate / fftSize;
  const freqRange = maxFreq - minFreq;

  for (let x = 0; x < width; x++) {
    const targetFreq = minFreq + (x / width) * freqRange;
    const binFloat = targetFreq / binWidth;
    const bin0 = Math.floor(binFloat);
    const bin1 = Math.min(freqData.length - 1, bin0 + 1);
    const frac = binFloat - bin0;

    const val0 = freqData[Math.min(freqData.length - 1, Math.max(0, bin0))] || 0;
    const val1 = freqData[Math.min(freqData.length - 1, Math.max(0, bin1))] || 0;
    const interpolatedVal = val0 + frac * (val1 - val0);

    // Apply gain & contrast
    const scaled = Math.min(255, Math.max(0, Math.round(interpolatedVal * gainMultiplier)));
    const lutIdx = scaled * 4;
    const outIdx = x * 4;

    rowBuffer[outIdx] = lut[lutIdx];
    rowBuffer[outIdx + 1] = lut[lutIdx + 1];
    rowBuffer[outIdx + 2] = lut[lutIdx + 2];
    rowBuffer[outIdx + 3] = 255;
  }
}
