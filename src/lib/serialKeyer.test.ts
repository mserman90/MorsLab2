/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseModemSignals,
  parseSerialAsciiSignal,
  getArduinoKeyerSketch,
} from './serialKeyer';

test('parseModemSignals maps CTS and DSR lines correctly', () => {
  // activeLow = true (default): line low (false) means pressed (true)
  const pressed = parseModemSignals({ clearToSend: false, dataSetReady: true }, true);
  assert.equal(pressed.dit, true);
  assert.equal(pressed.dah, false);

  // activeLow = false: line high means pressed
  const highActive = parseModemSignals({ clearToSend: true, dataSetReady: false }, false);
  assert.equal(highActive.dit, true);
  assert.equal(highActive.dah, false);
});

test('parseSerialAsciiSignal tracks dit/dah button states and emits events', () => {
  let state = { dit: false, dah: false, straight: false };

  // Press Dit ('D')
  const step1 = parseSerialAsciiSignal('D', state);
  assert.equal(step1.nextState.dit, true);
  assert.equal(step1.nextState.dah, false);
  assert.equal(step1.events.length, 1);
  assert.deepEqual(step1.events[0], { type: 'dit', pressed: true });
  state = step1.nextState;

  // Press Dah ('T') while Dit is held
  const step2 = parseSerialAsciiSignal('T', state);
  assert.equal(step2.nextState.dit, true);
  assert.equal(step2.nextState.dah, true);
  assert.deepEqual(step2.events[0], { type: 'dah', pressed: true });
  state = step2.nextState;

  // Release Dit ('d')
  const step3 = parseSerialAsciiSignal('d', state);
  assert.equal(step3.nextState.dit, false);
  assert.equal(step3.nextState.dah, true);
  assert.deepEqual(step3.events[0], { type: 'dit', pressed: false });
  state = step3.nextState;

  // Release Dah ('t')
  const step4 = parseSerialAsciiSignal('t', state);
  assert.equal(step4.nextState.dit, false);
  assert.equal(step4.nextState.dah, false);
  assert.deepEqual(step4.events[0], { type: 'dah', pressed: false });
});

test('getArduinoKeyerSketch returns non-empty C++ sketch', () => {
  const sketch = getArduinoKeyerSketch();
  assert.ok(sketch.includes('pinMode(PIN_DIT, INPUT_PULLUP)'));
  assert.ok(sketch.includes('Serial.begin(115200)'));
});
