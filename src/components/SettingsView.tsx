import React, { useState } from 'react';
import {
  Palette,
  Download,
  Plus,
  Smartphone,
  Trash2,
  Info,
  CheckCircle2,
  Compass,
  RotateCcw,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { ThemeId, AppControls } from '../types';

interface SettingsViewProps {
  currentTheme: ThemeId;
  onOpenThemes: () => void;
  onOpenAbout: () => void;
  onOpenAddBatch: () => void;
  onResetAdventure: () => void;
  adventureStats: {
    xp: number;
    level: number;
    rank: string;
    currentStreak: number;
    completedCount: number;
    enrolledCount: number;
  };
  appControls?: AppControls | null;
  onClearCache: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentTheme,
  onOpenThemes,
  onOpenAbout,
  onOpenAddBatch,
  onResetAdventure,
  adventureStats,
  onClearCache,
}) => {
  const { isInstallable, isInstalled, install, isIOS } = usePWAInstall();
  const [cacheCleared, setCacheCleared] = useState(false);
  const [confirmResetAdv, setConfirmResetAdv] = useState(false);

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-8">
      <div>
        <h2 className="font-['Sora'] text-lg sm:text-xl font-bold text-[var(--text-primary)]">
          App Settings & Controls
        </h2>
        <p className="text-xs text-[var(--text-secondary)]">
          Manage your batches, Adventure progress, appearance, and offline cache
        </p>
      </div>

      {/* PWA App Installation Card */}
      <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--primary-color)]/15 text-[var(--primary-color)]">
              <Smartphone className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-['Sora'] text-sm font-bold text-[var(--text-primary)]">
                VidCloud Web App
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                {isInstalled
                  ? 'Application is installed and running in standalone mode'
                  : 'Install to your device home screen for fullscreen & offline access'}
              </p>
            </div>
          </div>

          {isInstalled ? (
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              <span>Installed</span>
            </div>
          ) : (
            (isInstallable || isIOS) && (
              <button
                onClick={install}
                className="flex items-center gap-1.5 rounded-xl bg-[var(--primary-color)] px-4 py-2 text-xs font-bold text-white shadow-md hover:opacity-90 transition active:scale-95"
              >
                <Download className="h-4 w-4" />
                <span>Install</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Batch Adventure & Enrollment Card */}
      <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-['Sora'] text-sm font-bold text-[var(--text-primary)]">
                Batch Adventure & Streak
              </h4>
              <p className="text-xs text-[var(--text-secondary)] font-mono tabular-nums">
                Lv.{adventureStats.level} · {adventureStats.rank} · {adventureStats.xp} XP · {adventureStats.currentStreak}d Streak
              </p>
            </div>
          </div>
          <button
            onClick={onOpenAddBatch}
            className="flex items-center gap-1.5 rounded-xl bg-[var(--primary-color)] px-3.5 py-2 text-xs font-bold text-white hover:opacity-90 transition whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Batch</span>
          </button>
        </div>

        <div className="flex items-center justify-between border-t border-[var(--card-border)] pt-3 text-xs">
          <span className="text-[var(--text-secondary)] font-mono tabular-nums">
            {adventureStats.enrolledCount} My Batches · {adventureStats.completedCount} Lectures Cleared
          </span>
          {!confirmResetAdv ? (
            <button
              onClick={() => setConfirmResetAdv(true)}
              className="flex items-center gap-1 text-red-400 hover:underline font-semibold"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Progress</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  onResetAdventure();
                  setConfirmResetAdv(false);
                }}
                className="rounded-lg bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white"
              >
                Confirm Reset
              </button>
              <button
                onClick={() => setConfirmResetAdv(false)}
                className="rounded-lg border border-[var(--card-border)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)]"
              >
                Cancel
              </button>
            </div>
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

      {/* Cache & Maintenance */}
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
              {cacheCleared
                ? 'Local batch catalog cache refreshed!'
                : 'Clear cached batches and fetch fresh catalog data'}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            onClearCache();
            setCacheCleared(true);
            setTimeout(() => setCacheCleared(false), 3000);
          }}
          className="rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/20 transition whitespace-nowrap shrink-0"
        >
          {cacheCleared ? 'Cleared' : 'Clear Cache'}
        </button>
      </div>

      {/* About Box */}
      <div className="flex items-center justify-between rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
            <Info className="h-5 w-5" />
          </div>
          <div>
            <h5 className="font-['Sora'] text-sm font-bold text-[var(--text-primary)]">
              VidCloud Learning App
            </h5>
            <p className="text-xs text-[var(--text-secondary)]">
              Built-in Native Player, Batches & Adventure Progress
            </p>
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
