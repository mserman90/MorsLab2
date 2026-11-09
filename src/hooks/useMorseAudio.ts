import { useCallback, useEffect, useRef, useState } from 'react';
import { createSamples, type AudioSettings } from '../lib/morse';

export function useMorseAudio(settings: AudioSettings) {
  const context = useRef<AudioContext | null>(null);
  const source = useRef<AudioBufferSourceNode | null>(null);
  const gain = useRef<GainNode | null>(null);
  const offset = useRef(0);
  const startedAt = useRef(0);
  const frame = useRef(0);
  const currentCode = useRef('');
  const bufferCache = useRef<{ key: string; buffer: AudioBuffer } | null>(null);
  const loopRef = useRef(false);
  const operation = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loop, setLoop] = useState(false);
  const [code, setCode] = useState('');

  const analyser = useRef<AnalyserNode | null>(null);

  const stopSource = useCallback(() => {
    operation.current += 1;
    cancelAnimationFrame(frame.current);
    if (source.current) {
      source.current.onended = null;
      try { source.current.stop(); } catch { /* The node may already have finished. */ }
      source.current.disconnect();
      source.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    stopSource();
    offset.current = 0;
    setPlaying(false);
    setProgress(0);
  }, [stopSource]);

  const play = useCallback(async (nextCode: string, at = 0, customSettings?: AudioSettings) => {
    stopSource();
    const pendingOperation = operation.current;
    if (!context.current) {
      context.current = new AudioContext();
      gain.current = context.current.createGain();
      analyser.current = context.current.createAnalyser();
      analyser.current.fftSize = 2048;
      analyser.current.smoothingTimeConstant = 0.5;
      gain.current.connect(analyser.current);
      analyser.current.connect(context.current.destination);
    }
    const ctx = context.current;
    await ctx.resume();
    if (pendingOperation !== operation.current) return;
    const activeSettings = customSettings || settings;
    const n = activeSettings.noise;
    const key = `${nextCode}:${activeSettings.wpm}:${activeSettings.frequency}:${activeSettings.farnsworth}:${activeSettings.volume}:${n?.enabled}:${n?.qrnLevel}:${n?.qrmLevel}:${n?.qsbLevel}`;
    if (bufferCache.current?.key !== key) {
      const samples = createSamples(nextCode, activeSettings);
      const buffer = ctx.createBuffer(1, samples.length, 22050);
      buffer.getChannelData(0).set(samples);
      bufferCache.current = { key, buffer };
    }
    const buffer = bufferCache.current.buffer;
    const node = ctx.createBufferSource();
    node.buffer = buffer;
    node.loop = loopRef.current;
    node.connect(gain.current!);
    gain.current!.gain.value = activeSettings.volume / 100;
    offset.current = Math.max(0, Math.min(at, buffer.duration - 0.001));
    startedAt.current = ctx.currentTime - offset.current;
    currentCode.current = nextCode;
    source.current = node;
    setCode(nextCode);
    setDuration(buffer.duration);
    setPlaying(true);
    node.onended = () => {
      source.current = null;
      offset.current = 0;
      cancelAnimationFrame(frame.current);
      setPlaying(false);
      setProgress(0);
    };
    node.start(0, offset.current);
    const tick = () => {
      if (!source.current) return;
      const elapsed = ctx.currentTime - startedAt.current;
      offset.current = elapsed % buffer.duration;
      setProgress(Math.min(1, offset.current / buffer.duration));
      frame.current = requestAnimationFrame(tick);
    };
    tick();
  }, [settings, stopSource]);

  const toggle = useCallback(async (nextCode: string) => {
    if (source.current && currentCode.current === nextCode) {
      stopSource();
      setPlaying(false);
    } else {
      await play(nextCode, currentCode.current === nextCode ? offset.current : 0);
    }
  }, [play, stopSource]);

  const seek = useCallback(async (fraction: number) => {
    const position = fraction * (bufferCache.current?.buffer.duration || 0);
    if (source.current) await play(currentCode.current, position);
    else { offset.current = position; setProgress(fraction); }
  }, [play]);

  useEffect(() => {
    loopRef.current = loop;
    if (source.current) source.current.loop = loop;
  }, [loop]);

  useEffect(() => {
    if (gain.current && context.current) gain.current.gain.setTargetAtTime(settings.volume / 100, context.current.currentTime, 0.02);
  }, [settings.volume]);

  useEffect(() => {
    stop();
    bufferCache.current = null;
    currentCode.current = '';
    setCode('');
    setDuration(0);
  }, [settings.wpm, settings.frequency, settings.farnsworth, stop]);
  useEffect(() => () => {
    stopSource();
    void context.current?.close();
  }, [stopSource]);

  return { play, toggle, stop, seek, playing, progress, duration, loop, setLoop, code, analyserNode: analyser.current };
}

export type MorseAudio = ReturnType<typeof useMorseAudio>;