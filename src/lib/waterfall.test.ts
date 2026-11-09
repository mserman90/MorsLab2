/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPaletteLut,
  detectCarrierPeak,
  frequencyToX,
  renderWaterfallRow,
  WATERFALL_PALETTES,
  xToFrequency,
} from './waterfall';

test('buildPaletteLut creates a valid 256-entry RGBA lookup table', () => {
  for (const p of WATERFALL_PALETTES) {
    const lut = buildPaletteLut(p.id);
    assert.equal(lut.length, 256 * 4, 'LUT must be 256 * 4 bytes');
    // First pixel (t=0) alpha must be 255
    assert.equal(lut[3], 255);
    // Last pixel (t=255) alpha must be 255
    assert.equal(lut[255 * 4 + 3], 255);
    // Values must be within 0..255
    for (let i = 0; i < lut.length; i++) {
      assert.ok(lut[i] >= 0 && lut[i] <= 255, `Value at ${i} should be 0..255`);
    }
  }
});

test('detectCarrierPeak accurately detects CW carrier frequency with interpolation', () => {
  const sampleRate = 44100;
  const fftSize = 2048;
  const binWidth = sampleRate / fftSize; // ~21.53 Hz
  const targetToneHz = 650;
  const targetBin = Math.round(targetToneHz / binWidth); // ~30

  const freqData = new Uint8Array(1024);
  // Add background noise floor
  for (let i = 0; i < freqData.length; i++) {
    freqData[i] = 15;
  }
  // Inject sharp CW carrier tone at targetBin
  freqData[targetBin - 1] = 160;
  freqData[targetBin] = 230;
  freqData[targetBin + 1] = 140;

  const peak = detectCarrierPeak(freqData, sampleRate, fftSize, 200, 1500, 30);
  assert.ok(peak !== null, 'Peak should be found');
  assert.ok(
    Math.abs(peak.frequency - targetToneHz) <= binWidth,
    `Detected peak ${peak.frequency} Hz should be close to ${targetToneHz} Hz (within 1 bin: ${binWidth} Hz)`,
  );
  assert.ok(peak.snrDb > 10, 'Estimated SNR should be positive and > 10 dB');
  assert.equal(peak.binIndex, targetBin);
});

test('detectCarrierPeak returns null when signal is below threshold', () => {
  const sampleRate = 44100;
  const fftSize = 2048;
  const freqData = new Uint8Array(1024);
  // Very low background noise, no peak
  for (let i = 0; i < freqData.length; i++) {
    freqData[i] = 8;
  }

  const peak = detectCarrierPeak(freqData, sampleRate, fftSize, 200, 1500, 40);
  assert.equal(peak, null);
});

test('frequencyToX and xToFrequency are consistent inverses', () => {
  const minFreq = 200;
  const maxFreq = 1800;
  const width = 800;

  // Test min frequency
  assert.equal(frequencyToX(minFreq, minFreq, maxFreq, width), 0);
  assert.equal(xToFrequency(0, minFreq, maxFreq, width), minFreq);

  // Test max frequency
  assert.equal(frequencyToX(maxFreq, minFreq, maxFreq, width), width);
  assert.equal(xToFrequency(width, minFreq, maxFreq, width), maxFreq);

  // Test mid frequency (1000 Hz)
  const midX = frequencyToX(1000, minFreq, maxFreq, width);
  assert.equal(Math.round(midX), 400);
  const roundtripFreq = xToFrequency(midX, minFreq, maxFreq, width);
  assert.equal(roundtripFreq, 1000);
});

test('renderWaterfallRow populates rowBuffer within bounds with palette colors', () => {
  const width = 100;
  const rowBuffer = new Uint8ClampedArray(width * 4);
  const lut = buildPaletteLut('classic_sdr');
  const freqData = new Uint8Array(512);

  // Put a signal in the middle
  freqData[50] = 200;

  renderWaterfallRow(freqData, 44100, 1024, 200, 1800, width, lut, 1.2, rowBuffer);

  // All alphas must be 255
  for (let x = 0; x < width; x++) {
    assert.equal(rowBuffer[x * 4 + 3], 255, 'Alpha must be 255');
  }
});
