/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  KOCH_SEQUENCE,
  getKochLevelCharacters,
  getKochNewCharacter,
  checkKochLevelPass,
  pickKochQuestionTarget,
  calculateFarnsworthTiming,
} from './koch';

test('KOCH_SEQUENCE starts with standard K and M and contains 40 characters', () => {
  assert.equal(KOCH_SEQUENCE[0], 'K');
  assert.equal(KOCH_SEQUENCE[1], 'M');
  assert.equal(KOCH_SEQUENCE[2], 'R');
  assert.equal(KOCH_SEQUENCE[3], 'S');
  assert.equal(KOCH_SEQUENCE.length, 40);
});

test('getKochLevelCharacters returns progressive character sets', () => {
  const level1 = getKochLevelCharacters(1);
  assert.deepEqual(level1, ['K', 'M']);

  const level2 = getKochLevelCharacters(2);
  assert.deepEqual(level2, ['K', 'M', 'R']);

  const level3 = getKochLevelCharacters(3);
  assert.deepEqual(level3, ['K', 'M', 'R', 'S']);

  assert.equal(getKochNewCharacter(1), 'M');
  assert.equal(getKochNewCharacter(2), 'R');
  assert.equal(getKochNewCharacter(3), 'S');
});

test('checkKochLevelPass enforces 90% accuracy threshold', () => {
  assert.equal(checkKochLevelPass(9, 10), true); // 90% -> PASS
  assert.equal(checkKochLevelPass(10, 10), true); // 100% -> PASS
  assert.equal(checkKochLevelPass(8, 10), false); // 80% -> FAIL
  assert.equal(checkKochLevelPass(0, 10), false);
  assert.equal(checkKochLevelPass(18, 20), true); // 90% -> PASS
  assert.equal(checkKochLevelPass(17, 20), false); // 85% -> FAIL
});

test('pickKochQuestionTarget selects valid characters from the pool', () => {
  const chars = ['K', 'M', 'R'];
  for (let i = 0; i < 20; i++) {
    const target = pickKochQuestionTarget(chars);
    assert.ok(chars.includes(target));
  }
});

test('calculateFarnsworthTiming calculates crisp character speed with extended spacing', () => {
  const timing = calculateFarnsworthTiming(20, 10);
  assert.equal(timing.characterWpm, 20);
  assert.equal(timing.effectiveWpm, 10);
  assert.equal(timing.ditDurationMs, 60); // 1200 / 20 = 60ms
  assert.equal(timing.dahDurationMs, 180); // 3 * 60 = 180ms
  // Effective gap at 10 WPM: 1200 / 10 = 120ms unit -> 3 * 120 = 360ms
  assert.equal(timing.farnsworthInterCharGapMs, 360);
});
