import { useEffect, useState } from 'react';

interface InstallPrompt extends Event {
  prompt: () => Promise<{ outcome: 'accepted' | 'dismissed' }>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePwa() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(window.matchMedia('(display-mode: standalone)').matches);

  useEffect(() => {
    const beforeInstall = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    const onInstalled = () => { setInstalled(true); setPrompt(null); };
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener('beforeinstallprompt', beforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.register('./sw.js', { scope: './' })
        .then(() => navigator.serviceWorker.ready).then(() => setReady(true))
        .catch(() => setReady(false));
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const install = async () => {
    if (!prompt) return false;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    setPrompt(null);
    return choice.outcome === 'accepted';
  };

  return { install, canInstall: !!prompt, offline, ready, installed };
}