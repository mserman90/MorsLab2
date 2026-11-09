/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateKeyerTiming,
  evaluateNextIambicElement,
  IambicKeyerEngine,
} from './keyer';

test('calculateKeyerTiming calculates standard PARIS units correctly', () => {
  const timing20 = calculateKeyerTiming(20);
  assert.equal(timing20.wpm, 20);
  assert.equal(timing20.unitMs, 60); // 1200 / 20 = 60 ms
  assert.equal(timing20.ditMs, 60);
  assert.equal(timing20.dahMs, 180); // 3 * 60 = 180 ms
  assert.equal(timing20.elementGapMs, 60);
  assert.equal(timing20.letterGapMs, 180);
  assert.equal(timing20.wordGapMs, 420);

  const timing10 = calculateKeyerTiming(10);
  assert.equal(timing10.unitMs, 120);
  assert.equal(timing10.dahMs, 360);
});

test('evaluateNextIambicElement produces Dit when only Dit is pressed', () => {
  const res = evaluateNextIambicElement({
    currentElement: null,
    ditPressed: true,
    dahPressed: false,
    latchedOpposite: false,
    mode: 'iambic-b',
  });
  assert.equal(res.nextElement, '.');
});

test('evaluateNextIambicElement produces Dah when only Dah is pressed', () => {
  const res = evaluateNextIambicElement({
    currentElement: '.',
    ditPressed: false,
    dahPressed: true,
    latchedOpposite: false,
    mode: 'iambic-b',
  });
  assert.equal(res.nextElement, '-');
});

test('evaluateNextIambicElement squeeze alternates dits and dahs', () => {
  // If current was Dit and both are pressed, next must be Dah
  const step1 = evaluateNextIambicElement({
    currentElement: '.',
    ditPressed: true,
    dahPressed: true,
    latchedOpposite: false,
    mode: 'iambic-b',
  });
  assert.equal(step1.nextElement, '-');

  // If current was Dah and both are pressed, next must be Dit
  const step2 = evaluateNextIambicElement({
    currentElement: '-',
    ditPressed: true,
    dahPressed: true,
    latchedOpposite: false,
    mode: 'iambic-b',
  });
  assert.equal(step2.nextElement, '.');
});

test('evaluateNextIambicElement handles Mode A release with no extra element', () => {
  // In Mode A, if paddles are released, stops immediately even if latched
  const resA = evaluateNextIambicElement({
    currentElement: '.',
    ditPressed: false,
    dahPressed: false,
    latchedOpposite: true,
    mode: 'iambic-a',
  });
  assert.equal(resA.nextElement, null);
});

test('evaluateNextIambicElement handles Mode B paddle memory latching', () => {
  // In Mode B, if opposite paddle was tapped while Dit was sending and released, send trailing Dah
  const resB = evaluateNextIambicElement({
    currentElement: '.',
    ditPressed: false,
    dahPressed: false,
    latchedOpposite: true,
    mode: 'iambic-b',
  });
  assert.equal(resB.nextElement, '-');

  // Next round after trailing Dah: latch is cleared and no keys held, so it stops
  const resBStop = evaluateNextIambicElement({
    currentElement: '-',
    ditPressed: false,
    dahPressed: false,
    latchedOpposite: false,
    mode: 'iambic-b',
  });
  assert.equal(resBStop.nextElement, null);
});

test('IambicKeyerEngine handles paddle reversing correctly', () => {
  const engine = new IambicKeyerEngine({
    onToneStart: () => {},
    onToneEnd: () => {},
    onElement: () => {},
    onLetterBreak: () => {},
    onWordBreak: () => {},
  });

  // Normal: Left = Dit, Right = Dah
  engine.setLeftPaddle(true);
  let effective = engine.getEffectivePaddles();
  assert.equal(effective.dit, true);
  assert.equal(effective.dah, false);
  engine.setLeftPaddle(false);

  // Reversed: Left = Dah, Right = Dit
  engine.setReverse(true);
  engine.setLeftPaddle(true);
  effective = engine.getEffectivePaddles();
  assert.equal(effective.dit, false);
  assert.equal(effective.dah, true);

  engine.stopAll();
});
