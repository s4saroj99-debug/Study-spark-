import React from 'react';
import { X, Compass, Flame, Trophy, PlayCircle } from 'lucide-react';

interface AboutModalProps {
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-sm rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 text-center shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-xl p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 shadow-xl shadow-indigo-600/30">
          <img
            src="/pwa-192x192.png"
            alt="VidCloud Logo"
            className="h-10 w-10 object-contain"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        </div>

        <h3 className="font-['Sora'] text-xl font-extrabold text-[var(--text-primary)]">
          VidCloud Learning App
        </h3>
        <p className="mt-1 text-xs font-medium text-[var(--text-secondary)]">
          Personal Batch & Adventure Companion
        </p>

        <p className="mt-3 text-xs leading-relaxed text-[var(--text-secondary)]">
          Distraction-free lecture player with built-in adaptive streaming, offline-ready PWA
          support, and a batch-level Learning Adventure & Daily Streak tracker.
        </p>

        <div className="mt-5 space-y-2 text-left text-xs">
          <div className="flex items-center gap-3 rounded-xl border border-[var(--card-border)] bg-[var(--bg-secondary)] p-3">
            <PlayCircle className="h-4 w-4 shrink-0 text-indigo-400" />
            <span className="text-[var(--text-primary)] font-medium">
              Direct HD lecture & audio-only playback
            </span>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-[var(--card-border)] bg-[var(--bg-secondary)] p-3">
            <Compass className="h-4 w-4 shrink-0 text-emerald-400" />
            <span className="text-[var(--text-primary)] font-medium">
              Stage-by-stage Batch Adventure paths
            </span>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-[var(--card-border)] bg-[var(--bg-secondary)] p-3">
            <Flame className="h-4 w-4 shrink-0 text-amber-400" />
            <span className="text-[var(--text-primary)] font-medium">
              Daily study streak & XP rank progression
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary-color)] py-2.5 text-xs font-bold text-white shadow-md hover:opacity-90 transition"
        >
          <Trophy className="h-4 w-4" />
          <span>Continue Studying</span>
        </button>
      </div>
    </div>
  );
};
