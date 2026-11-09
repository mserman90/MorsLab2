/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  parseModemSignals,
  parseSerialAsciiSignal,
  type SerialKeyerMode,
  type SerialKeyerSignalState,
  type SerialKeyerStatus,
} from '../lib/serialKeyer';

export interface UseWebSerialKeyerOptions {
  mode?: SerialKeyerMode;
  baudRate?: number;
  onDit?: (pressed: boolean) => void;
  onDah?: (pressed: boolean) => void;
  onStraight?: (pressed: boolean) => void;
  onMessage?: (msg: string) => void;
}

export function useWebSerialKeyer(options: UseWebSerialKeyerOptions = {}) {
  const {
    mode: initialMode = 'arduino',
    baudRate = 115200,
    onDit,
    onDah,
    onStraight,
    onMessage,
  } = options;

  const [mode, setMode] = useState<SerialKeyerMode>(initialMode);
  const [status, setStatus] = useState<SerialKeyerStatus>(() => {
    if (typeof navigator !== 'undefined' && 'serial' in navigator) {
      return 'disconnected';
    }
    return 'unsupported';
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [signals, setSignals] = useState<SerialKeyerSignalState>({
    dit: false,
    dah: false,
    straight: false,
  });

  // Reference for the Web Serial port
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const portRef = useRef<any>(null);
  const keepReadingRef = useRef(false);
  const signalStateRef = useRef<SerialKeyerSignalState>({
    dit: false,
    dah: false,
    straight: false,
  });

  const onDitRef = useRef(onDit);
  const onDahRef = useRef(onDah);
  const onStraightRef = useRef(onStraight);
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onDitRef.current = onDit;
    onDahRef.current = onDah;
    onStraightRef.current = onStraight;
    onMessageRef.current = onMessage;
  });

  const disconnect = useCallback(async () => {
    keepReadingRef.current = false;
    if (portRef.current) {
      try {
        await portRef.current.close();
      } catch {
        // Port might already be closing
      }
      portRef.current = null;
    }
    setStatus('disconnected');
    setSignals({ dit: false, dah: false, straight: false });
    signalStateRef.current = { dit: false, dah: false, straight: false };
    onDitRef.current?.(false);
    onDahRef.current?.(false);
    onStraightRef.current?.(false);
  }, []);

  const connect = useCallback(async () => {
    if (typeof navigator === 'undefined' || !('serial' in navigator)) {
      setStatus('unsupported');
      setErrorMsg('Web Serial API bu tarayıcıda desteklenmiyor. Chrome veya Edge kullanın.');
      return;
    }

    try {
      setErrorMsg(null);
      setStatus('connecting');

      // Request port from user
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate });
      portRef.current = port;
      setStatus('connected');
      keepReadingRef.current = true;
      onMessageRef.current?.('USB Donanım Maniplesi bağlandı.');

      if (mode === 'modem') {
        // Modem line polling loop (CTS/DSR/DCD)
        const pollModem = async () => {
          while (keepReadingRef.current && portRef.current) {
            try {
              const sigs = await port.getSignals();
              const next = parseModemSignals(sigs, true);

              if (next.dit !== signalStateRef.current.dit) {
                signalStateRef.current.dit = next.dit;
                onDitRef.current?.(next.dit);
              }
              if (next.dah !== signalStateRef.current.dah) {
                signalStateRef.current.dah = next.dah;
                onDahRef.current?.(next.dah);
              }
              if (next.straight !== signalStateRef.current.straight) {
                signalStateRef.current.straight = next.straight;
                onStraightRef.current?.(next.straight);
              }
              setSignals({ ...signalStateRef.current });
              // 4ms poll ~ 250Hz sample rate for responsive paddle timing
              await new Promise((resolve) => setTimeout(resolve, 4));
            } catch {
              break;
            }
          }
        };
        void pollModem();
      } else {
        // Arduino text/byte stream reader loop
        const readLoop = async () => {
          const textDecoder = new TextDecoderStream();
          const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
          const reader = textDecoder.readable.getReader();

          try {
            while (keepReadingRef.current) {
              const { value, done } = await reader.read();
              if (done) break;
              if (value) {
                const { nextState, events } = parseSerialAsciiSignal(
                  value,
                  signalStateRef.current
                );
                signalStateRef.current = nextState;
                setSignals({ ...nextState });

                for (const ev of events) {
                  if (ev.type === 'dit') onDitRef.current?.(ev.pressed);
                  if (ev.type === 'dah') onDahRef.current?.(ev.pressed);
                  if (ev.type === 'straight') onStraightRef.current?.(ev.pressed);
                }
              }
            }
          } catch (err) {
            console.warn('Serial read error:', err);
          } finally {
            reader.releaseLock();
            await readableStreamClosed.catch(() => {});
          }
        };
        void readLoop();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Bağlantı iptal edildi veya kurulamadı.';
      setErrorMsg(msg);
      setStatus('disconnected');
    }
  }, [baudRate, mode]);

  useEffect(() => {
    return () => {
      void disconnect();
    };
  }, [disconnect]);

  return {
    status,
    mode,
    setMode,
    signals,
    errorMsg,
    connect,
    disconnect,
    isSupported: typeof navigator !== 'undefined' && 'serial' in navigator,
  };
}
