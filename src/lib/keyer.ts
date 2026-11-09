/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type KeyerMode = 'straight' | 'iambic-a' | 'iambic-b';

export interface KeyerTiming {
  wpm: number;
  unitMs: number;
  ditMs: number;
  dahMs: number;
  elementGapMs: number;
  letterGapMs: number;
  wordGapMs: number;
}

export function calculateKeyerTiming(wpm: number): KeyerTiming {
  const safeWpm = Math.max(5, Math.min(60, Math.round(wpm || 20)));
  const unitMs = 1200 / safeWpm;
  return {
    wpm: safeWpm,
    unitMs,
    ditMs: unitMs,
    dahMs: unitMs * 3,
    elementGapMs: unitMs,
    letterGapMs: unitMs * 3,
    wordGapMs: unitMs * 7,
  };
}

export type MorseElement = '.' | '-';

export interface IambicEvaluationInput {
  currentElement: MorseElement | null;
  ditPressed: boolean;
  dahPressed: boolean;
  latchedOpposite: boolean;
  mode: 'iambic-a' | 'iambic-b';
}

export interface IambicEvaluationResult {
  nextElement: MorseElement | null;
  clearLatch: boolean;
}

/**
 * Pure evaluation function for Iambic Mode A & B keyer transitions.
 * When an element and its inter-element gap finish:
 * - If both paddles are squeezed, alternate to the opposite element.
 * - If only one paddle is held, send that paddle's element.
 * - If neither paddle is held:
 *   - In Mode B, if the opposite paddle was tapped/latched during the previous element, send that alternate element.
 *   - In Mode A, stops immediately.
 */
export function evaluateNextIambicElement(input: IambicEvaluationInput): IambicEvaluationResult {
  const { currentElement, ditPressed, dahPressed, latchedOpposite, mode } = input;

  if (ditPressed && dahPressed) {
    // Squeeze keying: alternate
    if (currentElement === '.') {
      return { nextElement: '-', clearLatch: true };
    }
    return { nextElement: '.', clearLatch: true };
  }

  if (ditPressed) {
    return { nextElement: '.', clearLatch: true };
  }

  if (dahPressed) {
    return { nextElement: '-', clearLatch: true };
  }

  // Neither paddle is currently held
  if (mode === 'iambic-b' && latchedOpposite && currentElement) {
    const alternate: MorseElement = currentElement === '.' ? '-' : '.';
    return { nextElement: alternate, clearLatch: true };
  }

  return { nextElement: null, clearLatch: true };
}

export interface KeyerCallbacks {
  onToneStart: (element: MorseElement, durationMs: number) => void;
  onToneEnd: () => void;
  onElement: (element: MorseElement) => void;
  onLetterBreak: () => void;
  onWordBreak: () => void;
}

/**
 * Controller engine for automated Iambic Mode A and Mode B keying.
 */
export class IambicKeyerEngine {
  private mode: 'iambic-a' | 'iambic-b' = 'iambic-b';
  private timing: KeyerTiming = calculateKeyerTiming(20);
  private reverse = false;

  private ditRawPressed = false;
  private dahRawPressed = false;

  private isRunning = false;
  private currentElement: MorseElement | null = null;
  private latchedOpposite = false;

  private elementTimer: ReturnType<typeof setTimeout> | null = null;
  private gapTimer: ReturnType<typeof setTimeout> | null = null;
  private letterTimer: ReturnType<typeof setTimeout> | null = null;
  private wordTimer: ReturnType<typeof setTimeout> | null = null;

  private callbacks: KeyerCallbacks;

  constructor(callbacks: KeyerCallbacks) {
    this.callbacks = callbacks;
  }

  public setMode(mode: 'iambic-a' | 'iambic-b') {
    this.mode = mode;
  }

  public getMode(): 'iambic-a' | 'iambic-b' {
    return this.mode;
  }

  public setWpm(wpm: number) {
    this.timing = calculateKeyerTiming(wpm);
  }

  public getTiming(): KeyerTiming {
    return this.timing;
  }

  public setReverse(reverse: boolean) {
    this.reverse = reverse;
  }

  public isReversed(): boolean {
    return this.reverse;
  }

  public getEffectivePaddles(): { dit: boolean; dah: boolean } {
    return this.reverse
      ? { dit: this.dahRawPressed, dah: this.ditRawPressed }
      : { dit: this.ditRawPressed, dah: this.dahRawPressed };
  }

  public setLeftPaddle(pressed: boolean) {
    this.ditRawPressed = pressed;
    this.onPaddleUpdate();
  }

  public setRightPaddle(pressed: boolean) {
    this.dahRawPressed = pressed;
    this.onPaddleUpdate();
  }

  public isLeftPressed(): boolean {
    return this.ditRawPressed;
  }

  public isRightPressed(): boolean {
    return this.dahRawPressed;
  }

  private onPaddleUpdate() {
    const { dit, dah } = this.getEffectivePaddles();

    // If currently playing an element, check for opposite latching (especially Mode B)
    if (this.isRunning && this.currentElement) {
      if (this.currentElement === '.' && dah) {
        this.latchedOpposite = true;
      } else if (this.currentElement === '-' && dit) {
        this.latchedOpposite = true;
      }
      return;
    }

    // If not running, start playing immediately if either paddle is pressed
    if (!this.isRunning && (dit || dah)) {
      this.clearBreaks();
      // If both pressed at start, start with Dit
      const firstElement: MorseElement = dit ? '.' : '-';
      this.startElement(firstElement);
    }
  }

  private clearBreaks() {
    if (this.letterTimer) {
      clearTimeout(this.letterTimer);
      this.letterTimer = null;
    }
    if (this.wordTimer) {
      clearTimeout(this.wordTimer);
      this.wordTimer = null;
    }
  }

  private startElement(element: MorseElement) {
    this.isRunning = true;
    this.currentElement = element;
    this.latchedOpposite = false;

    const duration = element === '.' ? this.timing.ditMs : this.timing.dahMs;

    this.callbacks.onToneStart(element, duration);
    this.callbacks.onElement(element);

    this.elementTimer = setTimeout(() => {
      this.elementTimer = null;
      this.callbacks.onToneEnd();

      // Inter-element gap (1 unit duration)
      this.gapTimer = setTimeout(() => {
        this.gapTimer = null;
        this.finishElementAndScheduleNext();
      }, this.timing.elementGapMs);
    }, duration);
  }

  private finishElementAndScheduleNext() {
    const { dit, dah } = this.getEffectivePaddles();
    const evaluation = evaluateNextIambicElement({
      currentElement: this.currentElement,
      ditPressed: dit,
      dahPressed: dah,
      latchedOpposite: this.latchedOpposite,
      mode: this.mode,
    });

    if (evaluation.clearLatch) {
      this.latchedOpposite = false;
    }

    if (evaluation.nextElement) {
      this.startElement(evaluation.nextElement);
    } else {
      // Stopped
      this.isRunning = false;
      this.currentElement = null;
      this.scheduleBreaks();
    }
  }

  private scheduleBreaks() {
    this.clearBreaks();

    // Letter break occurs after 3 units of silence.
    // We already waited 1 unit in elementGapMs, so remaining time is 2 * unitMs.
    const remainingLetterMs = Math.max(120, this.timing.unitMs * 2);
    // Word break occurs after 7 units of silence.
    // Remaining time after elementGapMs is 6 * unitMs.
    const remainingWordMs = Math.max(300, this.timing.unitMs * 6);

    this.letterTimer = setTimeout(() => {
      this.letterTimer = null;
      this.callbacks.onLetterBreak();
    }, remainingLetterMs);

    this.wordTimer = setTimeout(() => {
      this.wordTimer = null;
      this.callbacks.onWordBreak();
    }, remainingWordMs);
  }

  public stopAll() {
    if (this.elementTimer) {
      clearTimeout(this.elementTimer);
      this.elementTimer = null;
    }
    if (this.gapTimer) {
      clearTimeout(this.gapTimer);
      this.gapTimer = null;
    }
    this.clearBreaks();
    this.isRunning = false;
    this.currentElement = null;
    this.ditRawPressed = false;
    this.dahRawPressed = false;
    this.latchedOpposite = false;
    this.callbacks.onToneEnd();
  }
}
