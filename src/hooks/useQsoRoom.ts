/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { QsoOperator, QsoTransmission } from '../lib/qso';

export interface UseQsoRoomOptions {
  initialFrequencyKhz?: number;
  callsign: string;
  name?: string;
  qth?: string;
  onIncomingTransmission?: (tx: QsoTransmission) => void;
  onLiveKey?: (down: boolean, callsign: string, frequencyHz: number) => void;
}

export type QsoConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export function useQsoRoom(options: UseQsoRoomOptions) {
  const {
    initialFrequencyKhz = 7030,
    callsign,
    name = 'Operatör',
    qth = 'İstanbul',
    onIncomingTransmission,
    onLiveKey,
  } = options;

  const [status, setStatus] = useState<QsoConnectionStatus>('disconnected');
  const [frequencyKhz, setFrequencyKhz] = useState<number>(initialFrequencyKhz);
  const [operators, setOperators] = useState<QsoOperator[]>([]);
  const [history, setHistory] = useState<QsoTransmission[]>([]);
  const [liveKeying, setLiveKeying] = useState<{ down: boolean; callsign: string } | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callsignRef = useRef(callsign);
  const nameRef = useRef(name);
  const qthRef = useRef(qth);
  const frequencyRef = useRef(frequencyKhz);

  const onIncomingTransmissionRef = useRef(onIncomingTransmission);
  const onLiveKeyRef = useRef(onLiveKey);

  useEffect(() => {
    callsignRef.current = callsign;
    nameRef.current = name;
    qthRef.current = qth;
    frequencyRef.current = frequencyKhz;
    onIncomingTransmissionRef.current = onIncomingTransmission;
    onLiveKeyRef.current = onLiveKey;
  });

  const connect = useCallback(() => {
    if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    setStatus('connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        ws.send(
          JSON.stringify({
            type: 'join',
            frequencyKhz: frequencyRef.current,
            callsign: callsignRef.current,
            name: nameRef.current,
            qth: qthRef.current,
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'init') {
            setFrequencyKhz(data.frequencyKhz);
            setOperators(data.operators || []);
            setHistory(data.history || []);
          } else if (data.type === 'operator:joined') {
            setOperators((prev) => {
              if (prev.some((op) => op.id === data.operator.id)) return prev;
              return [...prev, data.operator];
            });
          } else if (data.type === 'operator:left') {
            setOperators((prev) => prev.filter((op) => op.id !== data.operatorId));
          } else if (data.type === 'cw:transmission') {
            const tx: QsoTransmission = data.transmission;
            setHistory((prev) => {
              // Deduplicate
              if (prev.some((item) => item.id === tx.id)) return prev;
              return [...prev.slice(-49), tx];
            });
            onIncomingTransmissionRef.current?.(tx);
          } else if (data.type === 'cw:live_key') {
            const down = Boolean(data.down);
            const senderCall = data.callsign || 'Bilinmeyen İstasyon';
            const freqHz = data.frequencyHz || 600;
            setLiveKeying(down ? { down: true, callsign: senderCall } : null);
            onLiveKeyRef.current?.(down, senderCall, freqHz);
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      ws.onclose = () => {
        setStatus('disconnected');
        socketRef.current = null;
        // Auto reconnect after 3 seconds
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            connect();
          }, 3000);
        }
      };

      ws.onerror = (err) => {
        console.warn('QSO WebSocket error:', err);
        setStatus('error');
      };
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [connect]);

  const tuneFrequency = useCallback((newKhz: number) => {
    setFrequencyKhz(newKhz);
    frequencyRef.current = newKhz;
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'frequency:change',
          newFrequencyKhz: newKhz,
        })
      );
    }
  }, []);

  const sendTransmission = useCallback(
    (text: string, morse: string, wpm = 20, frequencyHz = 600, rst = '599') => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({
            type: 'cw:transmission',
            text,
            morse,
            wpm,
            frequencyHz,
            rst,
          })
        );
      }
    },
    []
  );

  const sendLiveKey = useCallback((down: boolean, frequencyHz = 600) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'cw:live_key',
          down,
          frequencyHz,
        })
      );
    }
  }, []);

  return {
    status,
    frequencyKhz,
    operators,
    history,
    liveKeying,
    tuneFrequency,
    sendTransmission,
    sendLiveKey,
    reconnect: connect,
  };
}
