'use client';
import { useEffect, useState } from 'react';

type Pwa = {
  install: string;
  install_hint: string;
  ios_hint: string;
  dismiss: string;
};

// Registers the service worker and offers an install prompt.
//  - Chromium/Android: captures `beforeinstallprompt` and shows an "Instalar
//    app" pill that calls the native prompt.
//  - iOS Safari (no such event): shows a one-line "how to" hint instead.
// Hidden once installed (display-mode: standalone) or dismissed for the session.
export function PwaProvider({ t }: { t: Pwa }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [closed, setClosed] = useState(true);

  useEffect(() => {
    // Register the SW (works in dev too; it deliberately ignores Next internals).
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // iOS
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    const dismissed = (() => {
      try {
        return sessionStorage.getItem('nhonga:install-dismissed') === '1';
      } catch {
        return false;
      }
    })();
    if (standalone || dismissed) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setClosed(false);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    // iOS never fires beforeinstallprompt — show the manual hint on iPhone.
    const ua = navigator.userAgent;
    const isIosSafari = /iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua);
    if (isIosSafari) {
      setIosHint(true);
      setClosed(false);
    }

    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  function close() {
    setClosed(true);
    try {
      sessionStorage.setItem('nhonga:install-dismissed', '1');
    } catch {
      /* ignore */
    }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => undefined);
    setDeferred(null);
    close();
  }

  if (closed || (!deferred && !iosHint)) return null;

  return (
    <div className="pwabar" role="dialog" aria-label={t.install}>
      <img className="pwabar__icon" src="/icons/icon-192.png" alt="" aria-hidden="true" />
      <div className="pwabar__text">
        <strong>{t.install}</strong>
        <span>{iosHint ? t.ios_hint : t.install_hint}</span>
      </div>
      {deferred ? (
        <button type="button" className="pwabar__cta" onClick={install}>
          {t.install}
        </button>
      ) : null}
      <button type="button" className="pwabar__close" onClick={close} aria-label={t.dismiss}>
        ✕
      </button>
    </div>
  );
}

// Minimal typing for the non-standard install prompt event.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
