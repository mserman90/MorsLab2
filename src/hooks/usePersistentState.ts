import { useEffect, useState } from 'react';

export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return initial;
      const parsed: unknown = JSON.parse(stored);
      if (parsed === null || typeof parsed !== typeof initial) return initial;
      if (Array.isArray(initial)) return Array.isArray(parsed) ? parsed as T : initial;
      if (typeof initial === 'object') {
        if (Array.isArray(parsed)) return initial;
        const object = parsed as Record<string, unknown>;
        for (const [field, fallback] of Object.entries(initial as object)) {
          if (typeof object[field] !== typeof fallback) return initial;
          if (typeof object[field] === 'number' && !Number.isFinite(object[field])) return initial;
        }
      }
      return parsed as T;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Private mode can disable storage. */ }
  }, [key, value]);

  return [value, setValue] as const;
}