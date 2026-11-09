/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeFrequency,
  generateQsoMacro,
  validateCallsign,
  POPULAR_CW_FREQUENCIES,
} from './qso';

test('POPULAR_CW_FREQUENCIES includes 7.030 MHz 40m QRP CW', () => {
  const f40m = POPULAR_CW_FREQUENCIES.find((f) => f.frequencyKhz === 7030);
  assert.ok(f40m, '7030 kHz should be present in presets');
  assert.equal(f40m?.band, '40m');
  assert.equal(f40m?.displayMhz, '7.030 MHz');
});

test('normalizeFrequency correctly parses MHz and kHz inputs', () => {
  const fromMhz = normalizeFrequency('7.030');
  assert.equal(fromMhz.khz, 7030);
  assert.equal(fromMhz.display, '7.030 MHz');

  const fromKhz = normalizeFrequency('14060');
  assert.equal(fromKhz.khz, 14060);
  assert.equal(fromKhz.display, '14.060 MHz');

  const withComma = normalizeFrequency('3,560');
  assert.equal(withComma.khz, 3560);
  assert.equal(withComma.display, '3.560 MHz');

  const fallback = normalizeFrequency('invalid');
  assert.equal(fallback.khz, 7030);
});

test('validateCallsign cleans and formats callsigns', () => {
  assert.equal(validateCallsign('ta1mor'), 'TA1MOR');
  assert.equal(validateCallsign('  dl/w1aw  '), 'DL/W1AW');
  assert.equal(validateCallsign(''), 'TA1MORS');
});

test('generateQsoMacro produces correct amateur radio CW formats', () => {
  const cq = generateQsoMacro('CQ', 'TA1MOR');
  assert.equal(cq, 'CQ CQ CQ DE TA1MOR TA1MOR K');

  const reply = generateQsoMacro('REPLY', 'TA1MOR', 'DL1CW');
  assert.equal(reply, 'DL1CW DE TA1MOR TA1MOR K');

  const report = generateQsoMacro('REPORT', 'TA1MOR', 'DL1CW', '599', 'ISTANBUL');
  assert.ok(report.includes('DL1CW DE TA1MOR'));
  assert.ok(report.includes('UR RST 599 599 5NN'));
  assert.ok(report.includes('QTH ISTANBUL'));

  const final73 = generateQsoMacro('73', 'TA1MOR', 'DL1CW');
  assert.equal(final73, 'DL1CW DE TA1MOR TNX FER QSO 73 ES GL SK');
});
