import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Share } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallBanner: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [isDismissed, setIsDismissed] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  useEffect(() => {
    const dismissedTime = localStorage.getItem('vidcloud_install_dismissed');
    if (dismissedTime && Date.now() - parseInt(dismissedTime, 10) < 24 * 60 * 60 * 1000) {
      setIsDismissed(true);
    }
  }, []);

  if (isInstalled || isDismissed) {
    return null;
  }

  if (!isInstallable && !isIOS) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('vidcloud_install_dismissed', Date.now().toString());
  };

  const handleInstallClick = () => {
    if (isIOS) {
      setShowIOSModal(true);
    } else {
      install();
    }
  };

  return (
    <>
      <div className="relative border-b border-indigo-500/20 bg-gradient-to-r from-indigo-950/80 via-purple-950/70 to-slate-950/80 px-4 py-2.5 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 text-xs sm:text-sm">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm shadow-indigo-500/30">
              <Smartphone className="h-4 w-4" />
            </div>
            <div>
              <span className="font-bold text-white">Install VidCloud App:</span>{' '}
              <span className="text-slate-300">
                Get full-screen video, offline batches, and fast native launcher.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleInstallClick}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 px-3 py-1.5 font-bold text-white shadow-sm transition hover:from-indigo-600 hover:to-purple-700 active:scale-95"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Install App</span>
            </button>
            <button
              onClick={handleDismiss}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
              title="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* iOS Safari Guide Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
                  <Share className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-['Sora'] text-base font-bold text-[var(--text-primary)]">
                    Install on iPhone / iPad
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">Apple Safari Instructions</p>
                </div>
              </div>
              <button
                onClick={() => setShowIOSModal(false)}
                className="rounded-lg p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <ol className="space-y-3 text-xs text-[var(--text-secondary)] leading-relaxed">
              <li className="flex items-start gap-2.5 rounded-xl border border-[var(--card-border)] bg-[var(--bg-secondary)] p-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 font-bold text-indigo-400">
                  1
                </span>
                <span>
                  Tap the <strong className="text-[var(--text-primary)]">Share button</strong> (the
                  square with an arrow pointing up) at the bottom of Safari.
                </span>
              </li>
              <li className="flex items-start gap-2.5 rounded-xl border border-[var(--card-border)] bg-[var(--bg-secondary)] p-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 font-bold text-indigo-400">
                  2
                </span>
                <span>
                  Scroll down the share sheet and tap{' '}
                  <strong className="text-[var(--text-primary)]">Add to Home Screen</strong>.
                </span>
              </li>
              <li className="flex items-start gap-2.5 rounded-xl border border-[var(--card-border)] bg-[var(--bg-secondary)] p-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 font-bold text-indigo-400">
                  3
                </span>
                <span>
                  Tap <strong className="text-[var(--text-primary)]">Add</strong> in the top-right
                  corner to install the app icon.
                </span>
              </li>
            </ol>

            <button
              onClick={() => setShowIOSModal(false)}
              className="mt-5 w-full rounded-xl bg-[var(--primary-color)] py-2.5 text-center text-sm font-bold text-white transition hover:opacity-90"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};
