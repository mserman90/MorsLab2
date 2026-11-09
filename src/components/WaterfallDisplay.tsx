/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { Activity, Gauge, Palette, Play, Pause, Radio, Target, Zap } from 'lucide-react';
import {
  buildPaletteLut,
  detectCarrierPeak,
  frequencyToX,
  renderWaterfallRow,
  WATERFALL_PALETTES,
  xToFrequency,
  type PeakDetectionResult,
  type WaterfallPaletteId,
} from '../lib/waterfall';

interface Props {
  analyserNode: AnalyserNode | null;
  targetFrequency?: number;
  onSelectFrequency?: (freq: number) => void;
  active?: boolean;
  minFreq?: number;
  maxFreq?: number;
  height?: number;
  title?: string;
  className?: string;
}

export function WaterfallDisplay({
  analyserNode,
  targetFrequency = 600,
  onSelectFrequency,
  active = true,
  minFreq = 150,
  maxFreq = 1850,
  height = 190,
  title = 'Gerçek Zamanlı Spektrum & Şelale Ekranı',
  className = '',
}: Props) {
  const spectrumCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const waterfallCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [paletteId, setPaletteId] = useState<WaterfallPaletteId>('classic_sdr');
  const [gain, setGain] = useState(1.3);
  const [speed, setSpeed] = useState<'fast' | 'normal' | 'slow'>('normal');
  const [paused, setPaused] = useState(false);
  const [peak, setPeak] = useState<PeakDetectionResult | null>(null);

  const lutRef = useRef<Uint8ClampedArray>(buildPaletteLut('classic_sdr'));
  const animFrameRef = useRef<number | null>(null);
  const tickCountRef = useRef(0);
  const freqDataRef = useRef<Uint8Array | null>(null);
  const scanlineImageDataRef = useRef<ImageData | null>(null);

  // Update LUT when palette changes
  useEffect(() => {
    lutRef.current = buildPaletteLut(paletteId);
  }, [paletteId]);

  // Click-to-tune handler
  const handleCanvasClick = (e: MouseEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickedFreq = xToFrequency(x, minFreq, maxFreq, rect.width);
    if (onSelectFrequency && clickedFreq >= minFreq && clickedFreq <= maxFreq) {
      onSelectFrequency(clickedFreq);
    }
  };

  const lockToPeak = useCallback(() => {
    if (peak && onSelectFrequency) {
      onSelectFrequency(peak.frequency);
    }
  }, [peak, onSelectFrequency]);

  useEffect(() => {
    if (!active || paused) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      return;
    }

    const spectrumCanvas = spectrumCanvasRef.current;
    const waterfallCanvas = waterfallCanvasRef.current;
    if (!spectrumCanvas || !waterfallCanvas) return;

    const specCtx = spectrumCanvas.getContext('2d', { alpha: false });
    const wfCtx = waterfallCanvas.getContext('2d', { alpha: false });
    if (!specCtx || !wfCtx) return;

    const render = () => {
      animFrameRef.current = requestAnimationFrame(render);

      const specW = spectrumCanvas.width;
      const specH = spectrumCanvas.height;
      const wfW = waterfallCanvas.width;
      const wfH = waterfallCanvas.height;

      // Rate throttle based on speed
      tickCountRef.current++;
      const stepModulo = speed === 'fast' ? 1 : speed === 'normal' ? 2 : 4;
      const shouldStepWaterfall = tickCountRef.current % stepModulo === 0;

      let currentData: Uint8Array;
      const sampleRate = analyserNode?.context?.sampleRate || 44100;
      const fftSize = analyserNode?.fftSize || 2048;

      if (analyserNode) {
        if (!freqDataRef.current || freqDataRef.current.length !== analyserNode.frequencyBinCount) {
          freqDataRef.current = new Uint8Array(analyserNode.frequencyBinCount);
        }
        analyserNode.getByteFrequencyData(freqDataRef.current);
        currentData = freqDataRef.current;
      } else {
        // Idle ambient floor when no active analyser
        if (!freqDataRef.current || freqDataRef.current.length !== 1024) {
          freqDataRef.current = new Uint8Array(1024);
        }
        for (let i = 0; i < freqDataRef.current.length; i++) {
          freqDataRef.current[i] = Math.max(0, Math.floor(Math.random() * 8));
        }
        currentData = freqDataRef.current;
      }

      // 1. Detect Peak Frequency
      const detectedPeak = detectCarrierPeak(currentData, sampleRate, fftSize, minFreq, maxFreq, 30);
      if (tickCountRef.current % 6 === 0) {
        setPeak(detectedPeak);
      }

      // 2. Render Spectrum Scope (Upper Canvas)
      specCtx.fillStyle = '#080c14';
      specCtx.fillRect(0, 0, specW, specH);

      // Grid lines & labels
      specCtx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
      specCtx.lineWidth = 1;
      const gridFreqs = [300, 500, 600, 700, 800, 1000, 1200, 1500, 1800];
      for (const f of gridFreqs) {
        if (f >= minFreq && f <= maxFreq) {
          const gx = frequencyToX(f, minFreq, maxFreq, specW);
          specCtx.beginPath();
          specCtx.moveTo(gx, 0);
          specCtx.lineTo(gx, specH);
          specCtx.stroke();
        }
      }

      // Shaded CW Filter Passband around targetFrequency (e.g. ±50 Hz)
      if (targetFrequency >= minFreq && targetFrequency <= maxFreq) {
        const pbMinX = frequencyToX(targetFrequency - 50, minFreq, maxFreq, specW);
        const pbMaxX = frequencyToX(targetFrequency + 50, minFreq, maxFreq, specW);
        specCtx.fillStyle = 'rgba(224, 98, 41, 0.15)';
        specCtx.fillRect(pbMinX, 0, pbMaxX - pbMinX, specH);

        // Center reticle
        const targetX = frequencyToX(targetFrequency, minFreq, maxFreq, specW);
        specCtx.strokeStyle = '#e06229';
        specCtx.setLineDash([3, 3]);
        specCtx.beginPath();
        specCtx.moveTo(targetX, 0);
        specCtx.lineTo(targetX, specH);
        specCtx.stroke();
        specCtx.setLineDash([]);
      }

      // Draw FFT Magnitude curve
      const binWidth = sampleRate / fftSize;
      const freqRange = maxFreq - minFreq;

      specCtx.beginPath();
      specCtx.strokeStyle = '#38bdf8';
      specCtx.lineWidth = 1.5;

      for (let x = 0; x < specW; x++) {
        const f = minFreq + (x / specW) * freqRange;
        const binFloat = f / binWidth;
        const bin0 = Math.floor(binFloat);
        const bin1 = Math.min(currentData.length - 1, bin0 + 1);
        const frac = binFloat - bin0;
        const val = currentData[bin0] * (1 - frac) + currentData[bin1] * frac;
        const normVal = Math.min(1, (val / 255) * gain);
        const y = specH - normVal * (specH - 4);

        if (x === 0) specCtx.moveTo(x, y);
        else specCtx.lineTo(x, y);
      }
      specCtx.stroke();

      // Highlight detected peak on spectrum
      if (detectedPeak) {
        const peakX = frequencyToX(detectedPeak.frequency, minFreq, maxFreq, specW);
        const peakNorm = Math.min(1, (detectedPeak.magnitude / 255) * gain);
        const peakY = specH - peakNorm * (specH - 4);

        specCtx.fillStyle = '#f59e0b';
        specCtx.beginPath();
        specCtx.arc(peakX, peakY, 3.5, 0, Math.PI * 2);
        specCtx.fill();
      }

      // 3. Render Waterfall (Lower Canvas)
      if (shouldStepWaterfall) {
        // Scroll existing waterfall content down by 1 pixel
        wfCtx.drawImage(waterfallCanvas, 0, 0, wfW, wfH - 1, 0, 1, wfW, wfH - 1);

        // Prepare scanline ImageData
        if (!scanlineImageDataRef.current || scanlineImageDataRef.current.width !== wfW) {
          scanlineImageDataRef.current = wfCtx.createImageData(wfW, 1);
        }
        const imgData = scanlineImageDataRef.current;

        renderWaterfallRow(
          currentData,
          sampleRate,
          fftSize,
          minFreq,
          maxFreq,
          wfW,
          lutRef.current,
          gain,
          imgData.data,
        );

        wfCtx.putImageData(imgData, 0, 0);

        // Draw subtle overlay target marker on waterfall top edge
        if (targetFrequency >= minFreq && targetFrequency <= maxFreq) {
          const markX = Math.round(frequencyToX(targetFrequency, minFreq, maxFreq, wfW));
          wfCtx.fillStyle = 'rgba(224, 98, 41, 0.4)';
          wfCtx.fillRect(markX - 1, 0, 2, 4);
        }
      }
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [active, paused, analyserNode, targetFrequency, minFreq, maxFreq, gain, speed]);

  return (
    <div className={`waterfall-container ${className}`}>
      <div className="waterfall-header">
        <div className="waterfall-title">
          <Activity size={15} />
          <strong>{title}</strong>
          {peak && (
            <span className="waterfall-peak-badge" title="Algılanan en güçlü CW taşıyıcı frekansı">
              <Zap size={11} />
              Tepe: {peak.frequency} Hz (SNR: +{peak.snrDb} dB)
            </span>
          )}
        </div>

        <div className="waterfall-quick-controls">
          {peak && Math.abs(peak.frequency - targetFrequency) > 5 && (
            <button
              type="button"
              className="waterfall-tune-btn"
              onClick={lockToPeak}
              title={`${peak.frequency} Hz frekansına kilitlen`}
            >
              <Target size={12} />
              <span>{peak.frequency} Hz'e Kilitlen</span>
            </button>
          )}

          <button
            type="button"
            className="icon-button small"
            onClick={() => setPaused(!paused)}
            title={paused ? 'Şelaleyi devam ettir' : 'Şelaleyi duraklat'}
            aria-label={paused ? 'Şelaleyi devam ettir' : 'Şelaleyi duraklat'}
          >
            {paused ? <Play size={13} /> : <Pause size={13} />}
          </button>
        </div>
      </div>

      <div className="waterfall-screen-box">
        {/* Upper: FFT Spectrum line scope */}
        <div className="waterfall-scope-wrap">
          <canvas
            ref={spectrumCanvasRef}
            width={640}
            height={56}
            className="waterfall-spectrum-canvas"
            onClick={handleCanvasClick}
            title="Hedef frekansı değiştirmek için bir noktaya dokunun"
          />
          <div className="waterfall-freq-ticks" aria-hidden="true">
            {[300, 500, 600, 700, 800, 1000, 1200, 1500].map((f) => {
              if (f < minFreq || f > maxFreq) return null;
              const leftPercent = ((f - minFreq) / (maxFreq - minFreq)) * 100;
              return (
                <span
                  key={f}
                  className={`freq-tick ${f === targetFrequency ? 'active' : ''}`}
                  style={{ left: `${leftPercent}%` }}
                >
                  {f}
                </span>
              );
            })}
          </div>
        </div>

        {/* Lower: Cascading Waterfall display */}
        <div className="waterfall-scroll-wrap" style={{ height }}>
          <canvas
            ref={waterfallCanvasRef}
            width={640}
            height={height}
            className="waterfall-canvas"
            onClick={handleCanvasClick}
            title="Frekansı ayarlamak için şelalede bir sinyal çizgisine dokunun"
          />
          {/* Receiver Reticle Marker */}
          {targetFrequency >= minFreq && targetFrequency <= maxFreq && (
            <div
              className="waterfall-target-line"
              style={{
                left: `${((targetFrequency - minFreq) / (maxFreq - minFreq)) * 100}%`,
              }}
              title={`Hedef alıcı filtre merkezi: ${targetFrequency} Hz`}
            >
              <span className="waterfall-reticle-tag">{targetFrequency} Hz</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer Controls Toolbar */}
      <div className="waterfall-footer-bar">
        <div className="waterfall-control-item">
          <Palette size={12} />
          <span className="wf-ctrl-label">Renk Paleti:</span>
          <select
            aria-label="Şelale Renk Paleti"
            value={paletteId}
            onChange={(e) => setPaletteId(e.target.value as WaterfallPaletteId)}
          >
            {WATERFALL_PALETTES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="waterfall-control-item">
          <Gauge size={12} />
          <span className="wf-ctrl-label">Kazanç:</span>
          <input
            type="range"
            min="0.5"
            max="2.5"
            step="0.1"
            value={gain}
            aria-label="Spektrum Kazancı"
            onChange={(e) => setGain(parseFloat(e.target.value))}
          />
          <span className="wf-ctrl-val">{gain.toFixed(1)}x</span>
        </div>

        <div className="waterfall-control-item">
          <span className="wf-ctrl-label">Hız:</span>
          <div className="waterfall-speed-pills">
            {(['slow', 'normal', 'fast'] as const).map((s) => (
              <button
                key={s}
                type="button"
                className={`wf-speed-pill ${speed === s ? 'active' : ''}`}
                onClick={() => setSpeed(s)}
              >
                {s === 'slow' ? 'Yavaş' : s === 'normal' ? 'Normal' : 'Hızlı'}
              </button>
            ))}
          </div>
        </div>

        <div className="waterfall-hint-text">
          <span>Tıkla-Ayarla: Şelale veya spektrum üzerindeki sinyale dokunarak frekansı anında kilitleyin.</span>
        </div>
      </div>
    </div>
  );
}
