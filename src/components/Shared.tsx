import { useEffect, useId, useMemo, useRef, type ReactNode } from 'react';
import { Activity, AudioLines, Radio, RotateCcw, SlidersHorizontal, Volume2, X, Zap } from 'lucide-react';
import { DEFAULT_AUDIO, getDuration, getTimeline, HF_NOISE_PRESETS, DEFAULT_NOISE, type AudioSettings } from '../lib/morse';

export function BrandMark({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden="true">
    <rect width="40" height="40" rx="11" fill="currentColor" />
    <circle cx="11" cy="14" r="2.5" fill="var(--logo-ink, #fff)" />
    <rect x="17" y="11.5" width="12" height="5" rx="2.5" fill="var(--logo-ink, #fff)" />
    <rect x="11" y="23.5" width="12" height="5" rx="2.5" fill="var(--logo-ink, #fff)" />
    <circle cx="29" cy="26" r="2.5" fill="var(--logo-ink, #fff)" />
  </svg>;
}

export function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    dialog.current?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; };
  }, []);
  return <dialog ref={dialog} className={`modal ${wide ? 'modal-wide' : ''}`} aria-labelledby={id}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="modal-content">
      <header className="modal-heading"><h2 id={id}>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Pencereyi kapat"><X size={20} /></button></header>
      {children}
    </div>
  </dialog>;
}

export function AudioSettingsPanel({ settings, onChange, compact = false }: {
  settings: AudioSettings; onChange: (settings: AudioSettings) => void; compact?: boolean;
}) {
  const id = useId();
  const controls = [
    { key: 'wpm' as const, label: 'Çalma hızı', icon: Zap, min: 5, max: 50, step: 1, unit: 'WPM', hint: 'Dakikadaki kelime sayısı' },
    { key: 'frequency' as const, label: 'Ton frekansı', icon: AudioLines, min: 300, max: 1000, step: 10, unit: 'Hz', hint: 'Sinyalin inceliği veya kalınlığı' },
    { key: 'volume' as const, label: 'Ses seviyesi', icon: Volume2, min: 0, max: 100, step: 1, unit: '%', hint: 'Rahat bir dinleme seviyesi seçin' },
  ];
  const noise = settings.noise ?? DEFAULT_NOISE;

  return <section className={`audio-settings ${compact ? 'compact' : ''}`} aria-labelledby={`${id}-title`}>
    <header className="section-heading"><div><SlidersHorizontal size={17} /><h2 id={`${id}-title`}>Ses ayarları</h2></div>
      <button className="text-button reset-button" onClick={() => onChange({ ...DEFAULT_AUDIO })}><RotateCcw size={13} /> Sıfırla</button>
    </header>
    <div className="slider-grid">
      {controls.map(({ key, label, icon: Icon, min, max, step, unit, hint }) => <div className="slider-control" key={key}>
        <div className="slider-label"><label htmlFor={`${id}-${key}`}><Icon size={14} />{label}</label><output htmlFor={`${id}-${key}`}>{settings[key]} <span>{unit}</span></output></div>
        <input id={`${id}-${key}`} type="range" min={min} max={max} step={step} value={settings[key]}
          style={{ '--range-progress': `${(settings[key] - min) / (max - min) * 100}%` } as React.CSSProperties}
          onChange={(event) => onChange({ ...settings, [key]: Number(event.target.value) })} />
        <div className="slider-ends"><span>{min}{unit === '%' ? '%' : ` ${unit}`}</span><span>{max}{unit === '%' ? '%' : ` ${unit}`}</span></div>
        <p className="slider-hint">{hint}</p>
      </div>)}
    </div>
    <div className="farnsworth-row"><div><span>Farnsworth zamanlaması</span><p>Harfler arasında daha fazla boşluk. Öğrenmek için ideal.</p></div>
      <button className={`switch ${settings.farnsworth ? 'is-on' : ''}`} role="switch" aria-label="Farnsworth zamanlaması" aria-checked={settings.farnsworth}
        onClick={() => onChange({ ...settings, farnsworth: !settings.farnsworth })}><span /></button>
    </div>

    {/* HF Radyo Koşulları & Gürültü Simülatörü (QRN / QRM / QSB) */}
    <div className="hf-noise-section">
      <div className="farnsworth-row">
        <div>
          <span className="hf-title-label">
            <Radio size={14} />
            <span>HF Radyo Koşulları Simülatörü (QRN / QRM / QSB)</span>
          </span>
          <p>Gerçek HF telsiz bandı gürültüsü, komşu istasyon paraziti ve iyonosferik sönümlenme.</p>
        </div>
        <button
          className={`switch ${noise.enabled ? 'is-on' : ''}`}
          role="switch"
          aria-label="HF Radyo Koşulları Simülatörü"
          aria-checked={noise.enabled}
          onClick={() =>
            onChange({
              ...settings,
              noise: {
                ...noise,
                enabled: !noise.enabled,
              },
            })
          }
        >
          <span />
        </button>
      </div>

      {noise.enabled && (
        <div className="hf-noise-controls">
          <div className="hf-presets-bar">
            <span className="field-caption">HAZIR KOŞULLAR:</span>
            {HF_NOISE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="hf-preset-chip"
                onClick={() =>
                  onChange({
                    ...settings,
                    noise: { ...preset.settings },
                  })
                }
                title={preset.description}
              >
                {preset.name}
              </button>
            ))}
          </div>

          <div className="slider-grid hf-slider-grid">
            <div className="slider-control">
              <div className="slider-label">
                <label htmlFor={`${id}-qrn`}>
                  <Radio size={14} /> QRN (Atmosferik Statik)
                </label>
                <output htmlFor={`${id}-qrn`}>%{noise.qrnLevel}</output>
              </div>
              <input
                id={`${id}-qrn`}
                type="range"
                min={0}
                max={100}
                step={5}
                value={noise.qrnLevel}
                style={{ '--range-progress': `${noise.qrnLevel}%` } as React.CSSProperties}
                onChange={(e) =>
                  onChange({
                    ...settings,
                    noise: { ...noise, qrnLevel: Number(e.target.value) },
                  })
                }
              />
              <div className="slider-ends"><span>Temiz</span><span>Şimşekli Çatırtı</span></div>
              <p className="slider-hint">Doğal atmosferik gürültü ve statik darbe çatırtıları.</p>
            </div>

            <div className="slider-control">
              <div className="slider-label">
                <label htmlFor={`${id}-qrm`}>
                  <Activity size={14} /> QRM (Bitişik İstasyon Paraziti)
                </label>
                <output htmlFor={`${id}-qrm`}>%{noise.qrmLevel}</output>
              </div>
              <input
                id={`${id}-qrm`}
                type="range"
                min={0}
                max={100}
                step={5}
                value={noise.qrmLevel}
                style={{ '--range-progress': `${noise.qrmLevel}%` } as React.CSSProperties}
                onChange={(e) =>
                  onChange({
                    ...settings,
                    noise: { ...noise, qrmLevel: Number(e.target.value) },
                  })
                }
              />
              <div className="slider-ends"><span>Sıfır</span><span>Yoğun Yarışma</span></div>
              <p className="slider-hint">Komşu frekanstan sızan yarışma CW sinyali ve heterodin ıslığı.</p>
            </div>

            <div className="slider-control">
              <div className="slider-label">
                <label htmlFor={`${id}-qsb`}>
                  <Zap size={14} /> QSB (İyonosferik Sönümlenme)
                </label>
                <output htmlFor={`${id}-qsb`}>%{noise.qsbLevel}</output>
              </div>
              <input
                id={`${id}-qsb`}
                type="range"
                min={0}
                max={100}
                step={5}
                value={noise.qsbLevel}
                style={{ '--range-progress': `${noise.qsbLevel}%` } as React.CSSProperties}
                onChange={(e) =>
                  onChange({
                    ...settings,
                    noise: { ...noise, qsbLevel: Number(e.target.value) },
                  })
                }
              />
              <div className="slider-ends"><span>Sabit</span><span>Derin Fading</span></div>
              <p className="slider-hint">İyonosfer tabakası yayılım dalgalanmasıyla periyodik genlik düşüşü.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  </section>;
}

export function Waveform({ code, settings, progress, onSeek, playing }: {
  code: string; settings: AudioSettings; progress: number; onSeek: (fraction: number) => void; playing: boolean;
}) {
  const bars = useMemo(() => {
    const timeline = getTimeline(code, settings);
    const duration = getDuration(code, settings);
    return Array.from({ length: 128 }, (_, i) => {
      const time = i / 128 * duration;
      const on = timeline.some((segment) => segment.on && time >= segment.start && time < segment.start + segment.duration);
      return on ? 13 + Math.abs(Math.sin(i * 1.71) * Math.cos(i * 0.27)) * 29 : 3;
    });
  }, [code, settings]);
  return <div className={`waveform ${playing ? 'is-playing' : ''}`}>
    <svg viewBox="0 0 640 48" preserveAspectRatio="none" aria-hidden="true">
      {bars.map((height, i) => <rect key={i} x={i * 5} y={(48 - height) / 2} width="2.6" height={height} rx="1.3"
        className={i / bars.length <= progress && progress > 0 ? 'wave-played' : 'wave-unplayed'} />)}
    </svg>
    <input type="range" min="0" max="1" step="0.001" value={progress} disabled={!code.trim()}
      onChange={(event) => onSeek(Number(event.target.value))} aria-label="Ses oynatma konumu" />
  </div>;
}

export function EmptyState({ icon, title, description, children }: { icon: ReactNode; title: string; description: string; children?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><h2>{title}</h2><p>{description}</p>{children}</div>;
}