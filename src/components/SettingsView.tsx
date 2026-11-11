import React from 'react';
import {
  Palette,
  Download,
  Send,
  MessageSquare,
  ExternalLink,
  ShieldCheck,
  RotateCw,
  Smartphone,
  Trash2,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { ThemeId, AppControls } from '../types';

interface SettingsViewProps {
  currentTheme: ThemeId;
  onOpenThemes: () => void;
  onOpenAbout: () => void;
  appControls: AppControls | null;
  onClearCache: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentTheme,
  onOpenThemes,
  onOpenAbout,
  appControls,
  onClearCache,
}) => {
  const { isInstallable, isInstalled, install, isIOS } = usePWAInstall();

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-8">
      {/* Title */}
      <div>
        <h2 className="font-['Sora'] text-lg sm:text-xl font-bold text-[var(--text-primary)]">
          App Settings & Controls
        </h2>
        <p className="text-xs text-[var(--text-secondary)]">
          Configure preferences, app installation, and official study channels
        </p>
      </div>

      {/* PWA App Installation Card */}
      <div className="rounded-3xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-slate-900/40 p-5 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30">
              <Smartphone className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-['Sora'] text-sm font-bold text-white">
                VidCloud Web App
              </h3>
              <p className="text-xs text-slate-300">
                {isInstalled
                  ? 'Application is installed & running in standalone mode'
                  : 'Install to your device home screen for fullscreen & offline access'}
              </p>
            </div>
          </div>

          {isInstalled ? (
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              <span>Installed</span>
            </div>
          ) : (
            (isInstallable || isIOS) && (
              <button
                onClick={install}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:from-indigo-600 hover:to-purple-700 transition active:scale-95"
              >
                <Download className="h-4 w-4" />
                <span>Install</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Theme Card */}
      <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
              <Palette className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-['Sora'] text-sm font-bold text-[var(--text-primary)]">
                Appearance & Theme
              </h4>
              <p className="text-xs text-[var(--text-secondary)]">
                Active Theme: <span className="capitalize font-semibold text-[var(--primary-color)]">{currentTheme.replace('-', ' ')}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onOpenThemes}
            className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-secondary)] px-3.5 py-1.5 text-xs font-bold text-[var(--text-primary)] hover:border-[var(--primary-color)] transition"
          >
            Change
          </button>
        </div>
      </div>

      {/* Official Community Channels */}
      <div className="space-y-2.5">
        <h4 className="px-1 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
          Official Community & Links
        </h4>

        {/* Telegram */}
        <a
          href="https://telegram.me/studystark"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 transition hover:border-sky-500/50 hover:bg-sky-500/5"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <h5 className="font-['Sora'] text-sm font-bold text-[var(--text-primary)]">
                Join StudyStark Telegram
              </h5>
              <p className="text-xs text-[var(--text-secondary)]">
                Get daily batch updates, study materials, and schedules
              </p>
            </div>
          </div>
          <ExternalLink className="h-4 w-4 text-[var(--text-secondary)]" />
        </a>

        {/* WhatsApp */}
        <a
          href="https://www.whatsapp.com/channel/0029Vb7phJILikgEjnTVsx34"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 transition hover:border-emerald-500/50 hover:bg-emerald-500/5"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h5 className="font-['Sora'] text-sm font-bold text-[var(--text-primary)]">
                WhatsApp Channel
              </h5>
              <p className="text-xs text-[var(--text-secondary)]">
                Direct updates and notifications
              </p>
            </div>
          </div>
          <ExternalLink className="h-4 w-4 text-[var(--text-secondary)]" />
        </a>

        {/* Add Batches Portal */}
        <a
          href="https://studystark.in/login/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 transition hover:border-[var(--primary-color)]/50"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
              <RotateCw className="h-5 w-5" />
            </div>
            <div>
              <h5 className="font-['Sora'] text-sm font-bold text-[var(--text-primary)]">
                Add Batches / Portal Login
              </h5>
              <p className="text-xs text-[var(--text-secondary)]">
                Link new courses to your StudyStark account
              </p>
            </div>
          </div>
          <ExternalLink className="h-4 w-4 text-[var(--text-secondary)]" />
        </a>

        {/* Download APK */}
        <a
          href="https://studystark.com/install/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 transition hover:border-emerald-500/50"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <h5 className="font-['Sora'] text-sm font-bold text-[var(--text-primary)]">
                Download Android APK
              </h5>
              <p className="text-xs text-[var(--text-secondary)]">
                Download raw .apk installation package
              </p>
            </div>
          </div>
          <ExternalLink className="h-4 w-4 text-[var(--text-secondary)]" />
        </a>
      </div>

      {/* Cache & Maintenance */}
      <div className="space-y-2.5">
        <h4 className="px-1 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
          Data & Cache
        </h4>

        <div className="flex items-center justify-between rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h5 className="font-['Sora'] text-sm font-bold text-[var(--text-primary)]">
                Reset Offline Cache
              </h5>
              <p className="text-xs text-[var(--text-secondary)]">
                Clear cached batches and fetch fresh data from server
              </p>
            </div>
          </div>
          <button
            onClick={onClearCache}
            className="rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/20 transition"
          >
            Clear Cache
          </button>
        </div>
      </div>

      {/* About Box */}
      <div className="flex items-center justify-between rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
            <Info className="h-5 w-5" />
          </div>
          <div>
            <h5 className="font-['Sora'] text-sm font-bold text-[var(--text-primary)]">
              VidCloud & StudyStark App
            </h5>
            <p className="text-xs text-[var(--text-secondary)]">Version 2.2 • Developed by Dev Aryan</p>
          </div>
        </div>
        <button
          onClick={onOpenAbout}
          className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-secondary)] px-3.5 py-1.5 text-xs font-bold text-[var(--text-primary)] hover:border-[var(--primary-color)] transition"
        >
          Details
        </button>
      </div>
    </div>
  );
};
