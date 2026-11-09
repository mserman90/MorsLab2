/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BookMarked,
  Check,
  ChevronDown,
  CircleHelp,
  Copy,
  Keyboard,
  Play,
  Radio,
  RotateCcw,
  Send,
  Sparkles,
  Users,
  Volume2,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import {
  POPULAR_CW_FREQUENCIES,
  generateQsoMacro,
  normalizeFrequency,
  validateCallsign,
  type QsoMacroType,
  type QsoTransmission,
} from '../lib/qso';
import { encodeMorse, type AudioSettings } from '../lib/morse';
import { usePersistentState } from '../hooks/usePersistentState';
import { useQsoRoom } from '../hooks/useQsoRoom';
import type { MorseAudio } from '../hooks/useMorseAudio';

interface QsoWorkspaceProps {
  audio: MorseAudio;
  settings: AudioSettings;
  notify: (msg: string) => void;
  onOpenLogbook?: (contact: { callsign: string; band: string; mode: string; rstSent: string; rstRcvd: string; notes: string }) => void;
}

export function QsoWorkspace({ audio, settings, notify, onOpenLogbook }: QsoWorkspaceProps) {
  const [callsign, setCallsign] = usePersistentState('morslab.qsoCallsign', 'TA1MOR');
  const [opName, setOpName] = usePersistentState('morslab.qsoName', 'Operatör');
  const [opQth, setOpQth] = usePersistentState('morslab.qsoQth', 'İstanbul');
  const [targetCallsign, setTargetCallsign] = useState('');
  const [customFreq, setCustomFreq] = useState('');
  const [textInput, setTextInput] = useState('');
  const [isStraightKeyDown, setIsStraightKeyDown] = useState(false);
  const [soundEnabled, setSoundEnabled] = usePersistentState('morslab.qsoSound', true);

  // Audio tone context for real-time remote sidetone
  const toneCtx = useRef<AudioContext | null>(null);
  const toneOsc = useRef<OscillatorNode | null>(null);
  const toneGain = useRef<GainNode | null>(null);

  const startRemoteTone = useCallback((freqHz = 600) => {
    if (!soundEnabled) return;
    try {
      if (!toneCtx.current) {
        toneCtx.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = toneCtx.current;
      if (ctx.state === 'suspended') void ctx.resume();
      if (toneOsc.current) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freqHz, ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(Math.max(0.04, (settings.volume / 100) * 0.35), ctx.currentTime + 0.005);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      toneOsc.current = osc;
      toneGain.current = gain;
    } catch {
      // Audio optional
    }
  }, [settings.volume, soundEnabled]);

  const stopRemoteTone = useCallback(() => {
    if (toneGain.current && toneCtx.current) {
      const now = toneCtx.current.currentTime;
      toneGain.current.gain.cancelScheduledValues(now);
      toneGain.current.gain.setTargetAtTime(0, now, 0.005);
    }
    const osc = toneOsc.current;
    toneOsc.current = null;
    if (osc) {
      window.setTimeout(() => {
        try {
          osc.stop();
          osc.disconnect();
        } catch {
          // Already stopped
        }
      }, 30);
    }
  }, []);

  const handleIncomingTransmission = useCallback((tx: QsoTransmission) => {
    if (soundEnabled && tx.callsign !== callsign) {
      void audio.play(tx.morse, 0, { ...settings, wpm: tx.wpm, frequency: tx.frequencyHz }).catch(() => {});
    }
  }, [audio, callsign, settings, soundEnabled]);

  const handleLiveKey = useCallback((down: boolean, _senderCall: string, freqHz: number) => {
    if (down) {
      startRemoteTone(freqHz);
    } else {
      stopRemoteTone();
    }
  }, [startRemoteTone, stopRemoteTone]);

  const qso = useQsoRoom({
    initialFrequencyKhz: 7030,
    callsign: validateCallsign(callsign),
    name: opName,
    qth: opQth,
    onIncomingTransmission: handleIncomingTransmission,
    onLiveKey: handleLiveKey,
  });

  const currentPreset = POPULAR_CW_FREQUENCIES.find((f) => f.frequencyKhz === qso.frequencyKhz);
  const displayFreq = (qso.frequencyKhz / 1000).toFixed(3);

  const handleTransmitText = (textToSend: string) => {
    const cleanText = textToSend.trim().toUpperCase();
    if (!cleanText) return;
    const morse = encodeMorse(cleanText, 'latin', '/');
    qso.sendTransmission(cleanText, morse, settings.wpm, settings.frequency);
    if (soundEnabled) {
      void audio.play(morse).catch(() => {});
    }
    setTextInput('');
  };

  const handleSendMacro = (macroType: QsoMacroType) => {
    const text = generateQsoMacro(macroType, callsign, targetCallsign || 'DX', '599', opQth);
    handleTransmitText(text);
  };

  const handleStraightKeyDown = () => {
    if (isStraightKeyDown) return;
    setIsStraightKeyDown(true);
    startRemoteTone(settings.frequency);
    qso.sendLiveKey(true, settings.frequency);
  };

  const handleStraightKeyUp = () => {
    if (!isStraightKeyDown) return;
    setIsStraightKeyDown(false);
    stopRemoteTone();
    qso.sendLiveKey(false, settings.frequency);
  };

  const handleLogContact = (tx: QsoTransmission) => {
    if (!onOpenLogbook) {
      notify(`Bağlantı kaydedildi: ${tx.callsign}`);
      return;
    }
    const band = currentPreset?.band || '40m';
    onOpenLogbook({
      callsign: tx.callsign,
      band,
      mode: 'CW',
      rstSent: '599',
      rstRcvd: tx.rst || '599',
      notes: `MorsLab Canlı QSO Odası (${displayFreq} MHz). Mesaj: ${tx.text}`,
    });
    notify(`${tx.callsign} istasyon defterine aktarıldı.`);
  };

  return (
    <div className="tool-workspace qso-workspace">
      {/* Sanal Telsiz Transceiver Paneli */}
      <div className="transceiver-chassis">
        <div className="transceiver-display-row">
          <div className="vfo-dial-box">
            <span className="vfo-caption">CANLI VFO FREKANSI</span>
            <div className="vfo-frequency">
              <span className="freq-digits">{displayFreq}</span>
              <span className="freq-unit">MHz</span>
              <span className="band-badge">{currentPreset?.band || 'CW'}</span>
            </div>
            <div className="vfo-description">
              {currentPreset?.description || `${qso.frequencyKhz} kHz Özel Frekans`}
            </div>
          </div>

          <div className="transceiver-metrics">
            <div className="s-meter-card">
              <div className="s-meter-header">
                <span>S-METRE / RF SİNYAL</span>
                <span className={`signal-live-blip ${qso.liveKeying ? 'active' : ''}`}>
                  {qso.liveKeying ? `TX: ${qso.liveKeying.callsign}` : 'RX / BEKLEMEDE'}
                </span>
              </div>
              <div className="s-meter-bar">
                <div
                  className={`s-meter-level ${qso.liveKeying ? 'transmitting' : ''}`}
                  style={{ width: qso.liveKeying ? '88%' : '14%' }}
                />
              </div>
              <div className="s-meter-scale">
                <span>S1</span>
                <span>S3</span>
                <span>S5</span>
                <span>S7</span>
                <span>S9</span>
                <span>+20dB</span>
              </div>
            </div>

            <div className="qso-status-card">
              <div className="qso-status-row">
                <span className="status-label">Bağlantı:</span>
                <span className={`qso-status-badge ${qso.status}`}>
                  {qso.status === 'connected' ? (
                    <>
                      <Wifi size={12} /> Çevrimiçi (WebSockets)
                    </>
                  ) : qso.status === 'connecting' ? (
                    <>Bağlanıyor...</>
                  ) : (
                    <>
                      <WifiOff size={12} /> Bağlantı Yok
                    </>
                  )}
                </span>
              </div>
              <div className="qso-status-row">
                <span className="status-label">Frekans Operatörleri:</span>
                <span className="operators-count">
                  <Users size={12} /> {qso.operators.length} İstasyon
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Frekans Seçici ve Hızlı Presetler */}
        <div className="transceiver-controls-bar">
          <div className="frequency-presets">
            {POPULAR_CW_FREQUENCIES.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`freq-preset-btn ${qso.frequencyKhz === preset.frequencyKhz ? 'active' : ''}`}
                onClick={() => qso.tuneFrequency(preset.frequencyKhz)}
              >
                <strong>{preset.displayMhz}</strong>
                <span>{preset.band}</span>
              </button>
            ))}
          </div>

          <form
            className="custom-frequency-form"
            onSubmit={(e) => {
              e.preventDefault();
              const norm = normalizeFrequency(customFreq);
              qso.tuneFrequency(norm.khz);
              setCustomFreq('');
            }}
          >
            <input
              type="text"
              placeholder="Örn: 7.035"
              value={customFreq}
              onChange={(e) => setCustomFreq(e.target.value)}
              aria-label="Özel frekans girin"
            />
            <button type="submit" className="secondary-button" style={{ minHeight: 32, fontSize: 11 }}>
              Ayarla
            </button>
          </form>
        </div>
      </div>

      <div className="qso-grid">
        {/* Sol Kolon: Operatör Kimliği, Frekanstaki İstasyonlar, Maniple & TX */}
        <div className="qso-column-controls">
          {/* Çağrı İşareti & Profil */}
          <div className="qso-card">
            <div className="qso-card-title">
              <Radio size={15} />
              <span>İstasyon Kimliğiniz</span>
            </div>
            <div className="qso-profile-fields">
              <label>
                <span>Çağrı İşareti (Callsign):</span>
                <input
                  type="text"
                  maxLength={10}
                  value={callsign}
                  onChange={(e) => setCallsign(e.target.value.toUpperCase())}
                  placeholder="TA1MOR"
                />
              </label>
              <label>
                <span>Konum (QTH):</span>
                <input
                  type="text"
                  value={opQth}
                  onChange={(e) => setOpQth(e.target.value)}
                  placeholder="İstanbul"
                />
              </label>
              <label>
                <span>Karşı İstasyon:</span>
                <input
                  type="text"
                  value={targetCallsign}
                  onChange={(e) => setTargetCallsign(e.target.value.toUpperCase())}
                  placeholder="DX veya Çağrı İşareti"
                />
              </label>
            </div>
          </div>

          {/* Frekanstaki Aktif İstasyonlar */}
          <div className="qso-card">
            <div className="qso-card-title">
              <Users size={15} />
              <span>Frekans Dinleyen İstasyonlar ({qso.operators.length})</span>
            </div>
            <div className="active-operators-list">
              {qso.operators.length === 0 ? (
                <div className="subtle-empty">Bu frekansta henüz başka istasyon yok.</div>
              ) : (
                qso.operators.map((op) => (
                  <div key={op.id} className="operator-chip">
                    <span className="op-call">{op.callsign}</span>
                    <span className="op-qth">{op.qth || 'DX'}</span>
                    {op.callsign !== callsign && (
                      <button
                        type="button"
                        className="text-button"
                        style={{ fontSize: 10, padding: 0 }}
                        onClick={() => setTargetCallsign(op.callsign)}
                        title="Bu istasyona yanıt hazırla"
                      >
                        Seç
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Canlı CW Maniple Tuşu */}
          <div className="qso-card">
            <div className="qso-card-title">
              <Keyboard size={15} />
              <span>Canlı Mors Anahtarı (Gerçek Zamanlı RF Yayını)</span>
            </div>
            <p className="qso-hint">
              Tuşa basılı tuttuğunuzda frekanstaki tüm istasyonların telsizinden anlık ton sesi duyulur.
            </p>
            <button
              type="button"
              className={`qso-straight-key-btn ${isStraightKeyDown ? 'is-pressed' : ''}`}
              onPointerDown={(e) => {
                e.preventDefault();
                handleStraightKeyDown();
              }}
              onPointerUp={handleStraightKeyUp}
              onPointerCancel={handleStraightKeyUp}
            >
              <Radio size={20} />
              <span>{isStraightKeyDown ? 'YAYINDA (TX LIVE)...' : 'CANLI MORSA BASIN (Mors Tuşu)'}</span>
            </button>
          </div>
        </div>

        {/* Sağ Kolon: Mesaj ve Makro Gönderimi + Canlı Alıcı / QSO Waterfall */}
        <div className="qso-column-feed">
          {/* Hızlı QSO Makroları ve Metin Girişi */}
          <div className="qso-card">
            <div className="qso-card-title">
              <Zap size={15} />
              <span>Standart CW QSO Makroları &amp; Hızlı Mesaj</span>
            </div>
            <div className="qso-macros-row">
              <button type="button" className="macro-btn" onClick={() => handleSendMacro('CQ')}>
                <strong>CQ ARAMA</strong>
                <span>CQ CQ CQ DE {callsign} K</span>
              </button>
              <button type="button" className="macro-btn" onClick={() => handleSendMacro('REPLY')}>
                <strong>YANIT VER</strong>
                <span>{targetCallsign || 'DX'} DE {callsign} K</span>
              </button>
              <button type="button" className="macro-btn" onClick={() => handleSendMacro('REPORT')}>
                <strong>RAPOR (599)</strong>
                <span>UR RST 599 5NN QTH {opQth.toUpperCase()}</span>
              </button>
              <button type="button" className="macro-btn" onClick={() => handleSendMacro('73')}>
                <strong>73 VEDA</strong>
                <span>TNX FER QSO 73 ES GL SK</span>
              </button>
              <button type="button" className="macro-btn" onClick={() => handleSendMacro('TU')}>
                <strong>TU (İKİ NOKTA)</strong>
                <span>EE</span>
              </button>
            </div>

            <form
              className="qso-message-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleTransmitText(textInput);
              }}
            >
              <input
                type="text"
                placeholder="Özel Mors mesajı yazın (örn: GM DE TA1MOR ES 73)"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
              />
              <button
                type="submit"
                className="primary-button"
                disabled={!textInput.trim()}
              >
                <Send size={13} />
                Frekansa Gönder (TX)
              </button>
            </form>
          </div>

          {/* Frekans QSO Akışı (Waterfall & Günlük) */}
          <div className="qso-card qso-waterfall-card">
            <div className="qso-card-header">
              <div className="qso-card-title">
                <Activity size={15} />
                <span>{displayFreq} MHz Alınan Sinyaller &amp; QSO Akışı ({qso.history.length})</span>
              </div>
              <label className="sound-toggle-label">
                <input
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={(e) => setSoundEnabled(e.target.checked)}
                />
                <Volume2 size={13} />
                <span>Canlı Sidetone Sesi</span>
              </label>
            </div>

            <div className="qso-stream">
              {qso.history.length === 0 ? (
                <div className="subtle-empty-stream">
                  <Radio size={28} />
                  <p>Frekans temiz. Henüz bu odada bir sinyal duyulmadı.</p>
                  <span>Yukarıdaki CQ butonuna basarak çağrı yapabilir veya mesaj gönderebilirsiniz.</span>
                </div>
              ) : (
                qso.history.map((tx) => {
                  const isMine = tx.callsign === callsign;
                  return (
                    <article key={tx.id} className={`qso-message-item ${isMine ? 'outgoing' : 'incoming'}`}>
                      <div className="qso-msg-header">
                        <span className="msg-callsign">
                          {isMine ? 'SİZ' : tx.callsign}
                        </span>
                        <span className="msg-time">
                          {new Date(tx.timestamp).toLocaleTimeString('tr-TR', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                        <span className="msg-wpm">{tx.wpm} WPM</span>
                      </div>
                      <div className="qso-msg-morse">{tx.morse}</div>
                      <div className="qso-msg-text">{tx.text}</div>
                      <div className="qso-msg-actions">
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => void audio.play(tx.morse, 0, { ...settings, wpm: tx.wpm, frequency: tx.frequencyHz })}
                          title="Sinyali tekrar dinle"
                        >
                          <Play size={12} /> Dinle
                        </button>
                        {!isMine && (
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => handleLogContact(tx)}
                            title="İstasyon defterine aktar"
                          >
                            <BookMarked size={12} /> Logla
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
