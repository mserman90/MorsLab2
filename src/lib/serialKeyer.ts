/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type SerialKeyerMode = 'modem' | 'arduino';

export interface SerialKeyerSignalState {
  dit: boolean;
  dah: boolean;
  straight: boolean;
}

export type SerialKeyerStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'unsupported';

/**
 * Parses modem control lines (CTS, DSR, DCD) from USB-UART interfaces
 * (e.g. FTDI, CH340, CP2102).
 * Most physical keys pull the line to GND (active LOW when pulled down).
 */
export function parseModemSignals(
  signals: {
    clearToSend?: boolean;
    dataSetReady?: boolean;
    dataCarrierDetect?: boolean;
  },
  activeLow = true
): SerialKeyerSignalState {
  // If activeLow is true, physical switch grounded = signal true or inverted depending on driver
  // Default USB-UART CTS/DSR: button pressed connects line to ground or VCC.
  const cts = Boolean(signals.clearToSend);
  const dsr = Boolean(signals.dataSetReady);
  const dcd = Boolean(signals.dataCarrierDetect);

  const dit = activeLow ? !cts : cts;
  const dah = activeLow ? !dsr : dsr;
  const straight = activeLow ? !dcd : dcd;

  return { dit, dah, straight };
}

/**
 * Parses text stream from microcontrollers (Arduino, Raspberry Pi Pico, ESP32).
 * Standard protocol:
 *  'D' = Dit pressed, 'd' = Dit released
 *  'T' = Dah pressed, 't' = Dah released
 *  'S' = Straight key pressed, 's' = Straight key released
 * Also supports simple 1/0 or binary states.
 */
export function parseSerialAsciiSignal(
  chunk: string,
  currentState: SerialKeyerSignalState
): {
  nextState: SerialKeyerSignalState;
  events: Array<{ type: 'dit' | 'dah' | 'straight'; pressed: boolean }>;
} {
  const nextState: SerialKeyerSignalState = { ...currentState };
  const events: Array<{ type: 'dit' | 'dah' | 'straight'; pressed: boolean }> = [];

  for (const char of chunk) {
    if (char === 'D') {
      if (!nextState.dit) {
        nextState.dit = true;
        events.push({ type: 'dit', pressed: true });
      }
    } else if (char === 'd') {
      if (nextState.dit) {
        nextState.dit = false;
        events.push({ type: 'dit', pressed: false });
      }
    } else if (char === 'T') {
      if (!nextState.dah) {
        nextState.dah = true;
        events.push({ type: 'dah', pressed: true });
      }
    } else if (char === 't') {
      if (nextState.dah) {
        nextState.dah = false;
        events.push({ type: 'dah', pressed: false });
      }
    } else if (char === 'S') {
      if (!nextState.straight) {
        nextState.straight = true;
        events.push({ type: 'straight', pressed: true });
      }
    } else if (char === 's') {
      if (nextState.straight) {
        nextState.straight = false;
        events.push({ type: 'straight', pressed: false });
      }
    }
  }

  return { nextState, events };
}

/**
 * Returns a ready-to-flash Arduino C++ sketch for physical keyer paddles.
 */
export function getArduinoKeyerSketch(): string {
  return `// MorsLab Web Serial Keyer Firmware (Arduino / ESP32 / Pico)
// Sol Paddle: Pin 2 -> GND
// Sag Paddle: Pin 3 -> GND
// Duz Maniple: Pin 4 -> GND

const int PIN_DIT = 2;
const int PIN_DAH = 3;
const int PIN_KEY = 4;

bool lastDit = false;
bool lastDah = false;
bool lastKey = false;

void setup() {
  pinMode(PIN_DIT, INPUT_PULLUP);
  pinMode(PIN_DAH, INPUT_PULLUP);
  pinMode(PIN_KEY, INPUT_PULLUP);
  Serial.begin(115200);
}

void loop() {
  bool dit = (digitalRead(PIN_DIT) == LOW);
  bool dah = (digitalRead(PIN_DAH) == LOW);
  bool key = (digitalRead(PIN_KEY) == LOW);

  if (dit != lastDit) {
    Serial.print(dit ? 'D' : 'd');
    lastDit = dit;
  }
  if (dah != lastDah) {
    Serial.print(dah ? 'T' : 't');
    lastDah = dah;
  }
  if (key != lastKey) {
    Serial.print(key ? 'S' : 's');
    lastKey = key;
  }
  delay(2);
}`;
}
