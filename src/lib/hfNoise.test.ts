/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyQsbFading,
  generateQrnNoise,
  generateQrmInterference,
  applyHfRadioEffects,
  DEFAULT_NOISE,
  HF_NOISE_PRESETS,
} from './hfNoise';

test('HF_NOISE_PRESETS contains standard amateur radio presets', () => {
  assert.ok(HF_NOISE_PRESETS.length >= 4);
  const evening = HF_NOISE_PRESETS.find((p) => p.id === 'evening_40m');
  assert.ok(evening);
  assert.equal(evening?.settings.enabled, true);
  assert.ok(evening?.settings.qrnLevel > 0);
  assert.ok(evening?.settings.qsbLevel > 0);
});

test('applyQsbFading attenuates signal amplitude dynamically without modifying input', () => {
  const sampleRate = 22050;
  const count = sampleRate; // 1 second
  const input = new Float32Array(count).fill(1.0);

  // Disabled (level 0) should return original array
  const unchanged = applyQsbFading(input, sampleRate, 0);
  assert.equal(unchanged[0], 1.0);

  // Enabled QSB (level 80)
  const faded = applyQsbFading(input, sampleRate, 80, 0.3);
  assert.notEqual(faded, input, 'Should return a new buffer');
  assert.equal(faded.length, count);

  // Values should be <= 1.0 and vary with time
  let hasVariation = false;
  let minVal = 1.0;
  for (let i = 0; i < count; i++) {
    assert.ok(faded[i] <= 1.0 && faded[i] >= 0.05, `Value ${faded[i]} within reasonable range`);
    if (faded[i] < minVal) minVal = faded[i];
    if (Math.abs(faded[i] - faded[0]) > 0.1) hasVariation = true;
  }
  assert.ok(hasVariation, 'Signal amplitude should oscillate due to fading wave');
  assert.ok(minVal < 0.6, 'Signal should drop significantly during fading dip');
});

test('generateQrnNoise produces non-zero atmospheric static within safe limits', () => {
  const sampleRate = 22050;
  const count = 4410; // 0.2s
  const noise = generateQrnNoise(count, sampleRate, 50, 999);

  assert.equal(noise.length, count);
  let sumSq = 0;
  let maxAbs = 0;
  for (let i = 0; i < count; i++) {
    const val = noise[i];
    sumSq += val * val;
    if (Math.abs(val) > maxAbs) maxAbs = Math.abs(val);
  }
  const rms = Math.sqrt(sumSq / count);
  assert.ok(rms > 0.005, 'Should have audible noise power');
  assert.ok(maxAbs < 1.0, 'Noise should not clip');
});

test('generateQrmInterference generates adjacent station CW tones', () => {
  const sampleRate = 22050;
  const count = 4410;
  const qrm = generateQrmInterference(count, sampleRate, 600, 50);

  assert.equal(qrm.length, count);
  let hasNonZero = false;
  for (let i = 0; i < count; i++) {
    if (Math.abs(qrm[i]) > 0.01) hasNonZero = true;
    assert.ok(Math.abs(qrm[i]) <= 0.5, 'QRM amplitude bounded');
  }
  assert.ok(hasNonZero, 'QRM interference should be present');
});

test('applyHfRadioEffects returns clean samples when disabled, and applies effects when enabled', () => {
  const sampleRate = 22050;
  const count = 2205; // 0.1s
  const clean = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    clean[i] = Math.sin(2 * Math.PI * 600 * (i / sampleRate)) * 0.7;
  }

  // When disabled
  const disabledOutput = applyHfRadioEffects(clean, sampleRate, 600, {
    enabled: false,
    qrnLevel: 50,
    qrmLevel: 50,
    qsbLevel: 50,
  });
  assert.equal(disabledOutput, clean, 'Should return reference when disabled');

  // When enabled
  const enabledOutput = applyHfRadioEffects(clean, sampleRate, 600, {
    enabled: true,
    qrnLevel: 40,
    qrmLevel: 30,
    qsbLevel: 60,
  });
  assert.notEqual(enabledOutput, clean);
  assert.equal(enabledOutput.length, count);

  // All values must be bounded within [-1, 1] due to soft clipping
  for (let i = 0; i < count; i++) {
    assert.ok(enabledOutput[i] >= -1.0 && enabledOutput[i] <= 1.0);
  }
});
