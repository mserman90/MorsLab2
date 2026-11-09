/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface QsoFrequency {
  id: string;
  frequencyKhz: number;
  displayMhz: string;
  band: string;
  description: string;
}

export const POPULAR_CW_FREQUENCIES: QsoFrequency[] = [
  { id: '7030', frequencyKhz: 7030, displayMhz: '7.030 MHz', band: '40m', description: '40m Uluslararası QRP CW Çağrı Frekansı' },
  { id: '14060', frequencyKhz: 14060, displayMhz: '14.060 MHz', band: '20m', description: '20m Uluslararası QRP CW Aktivite Frekansı' },
  { id: '3560', frequencyKhz: 3560, displayMhz: '3.560 MHz', band: '80m', description: '80m Gece CW QRP Buluşma Frekansı' },
  { id: '21060', frequencyKhz: 21060, displayMhz: '21.060 MHz', band: '15m', description: '15m DX CW Aktivite Frekansı' },
  { id: '28060', frequencyKhz: 28060, displayMhz: '28.060 MHz', band: '10m', description: '10m Güneş Döngüsü CW Frekansı' },
];

export interface QsoOperator {
  id: string;
  callsign: string;
  name: string;
  qth: string;
  joinedAt: number;
  lastActive: number;
  isTransmitting?: boolean;
}

export interface QsoTransmission {
  id: string;
  senderId: string;
  callsign: string;
  frequencyKhz: number;
  morse: string;
  text: string;
  wpm: number;
  frequencyHz: number;
  timestamp: number;
  rst?: string;
}

export type QsoMacroType = 'CQ' | 'REPLY' | 'REPORT' | 'QTH' | '73' | 'TU';

export function normalizeFrequency(freqInput: string | number): { khz: number; display: string } {
  const str = String(freqInput).trim().replace(',', '.');
  const num = parseFloat(str);
  if (isNaN(num) || num <= 0) {
    return { khz: 7030, display: '7.030 MHz' };
  }
  // If input is in MHz (e.g. 7.030)
  if (num < 100) {
    const khz = Math.round(num * 1000);
    return { khz, display: `${(khz / 1000).toFixed(3)} MHz` };
  }
  // If input is in kHz (e.g. 7030)
  const khz = Math.round(num);
  return { khz, display: `${(khz / 1000).toFixed(3)} MHz` };
}

export function generateQsoMacro(
  type: QsoMacroType,
  myCallsign: string,
  targetCallsign = 'DX',
  rst = '599',
  qth = 'ISTANBUL'
): string {
  const my = (myCallsign || 'N0CALL').trim().toUpperCase();
  const target = (targetCallsign || 'DX').trim().toUpperCase();

  switch (type) {
    case 'CQ':
      return `CQ CQ CQ DE ${my} ${my} K`;
    case 'REPLY':
      return `${target} DE ${my} ${my} K`;
    case 'REPORT':
      return `${target} DE ${my} GM UR RST ${rst} ${rst} 5NN QTH ${qth.toUpperCase()} BK`;
    case 'QTH':
      return `QTH ${qth.toUpperCase()} ES NAME OPERATOR K`;
    case '73':
      return `${target} DE ${my} TNX FER QSO 73 ES GL SK`;
    case 'TU':
      return `EE`;
    default:
      return `CQ DE ${my} K`;
  }
}

export function validateCallsign(callsign: string): string {
  const cleaned = callsign.trim().toUpperCase().replace(/[^A-Z0-9/]/g, '');
  return cleaned || 'TA1MORS';
}

export function calculateSignalStrength(): { sMeter: string; db: number } {
  // Simulated RF noise & signal level typical for HF CW
  const sLevels = ['S7', 'S8', 'S9', 'S9+10', 'S9+20'];
  const sMeter = sLevels[Math.floor(Math.random() * sLevels.length)] || 'S9';
  const db = sMeter === 'S9+20' ? 20 : sMeter === 'S9+10' ? 10 : 0;
  return { sMeter, db };
}
