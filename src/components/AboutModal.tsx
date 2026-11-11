import React from 'react';
import { X, Send, Heart, ExternalLink, ShieldCheck, Sparkles, Smartphone } from 'lucide-react';

interface AboutModalProps {
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-sm rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 text-center shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-xl p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Brand Logo */}
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 shadow-xl shadow-indigo-600/30">
          <img
            src="/pwa-192x192.png"
            alt="StudyStark VidCloud Logo"
            className="h-10 w-10 object-contain"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        </div>

        <h3 className="font-['Sora'] text-xl font-extrabold text-[var(--text-primary)]">
          VidCloud & StudyStark
        </h3>
        <div className="mt-1 flex items-center justify-center gap-1.5 text-xs text-indigo-400 font-semibold">
          <Sparkles className="h-3 w-3" />
          <span>Progressive Web App Version 2.2</span>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-[var(--text-secondary)]">
          Simplified educational streaming platform engineered for effortless learning,
          distraction-free study sessions, and high-speed video playback.
        </p>

        <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-[var(--card-border)] bg-[var(--bg-secondary)] py-2 text-xs font-semibold text-[var(--text-primary)]">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span>Developer: </span>
          <span className="text-[var(--primary-color)]">Dev Aryan</span>
        </div>

        {/* Actions */}
        <div className="mt-5 space-y-2">
          <a
            href="https://telegram.me/fatal_domain"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 py-3 text-xs font-bold text-white shadow-lg shadow-indigo-600/25 transition hover:from-indigo-500 hover:to-purple-500 active:scale-95"
          >
            <Send className="h-4 w-4" />
            <span>Contact Admin (@fatal_domain)</span>
          </a>

          <a
            href="https://telegram.me/studystark"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 py-2.5 text-xs font-bold text-sky-400 hover:bg-sky-500/20 transition"
          >
            <ExternalLink className="h-4 w-4" />
            <span>Join StudyStark Telegram</span>
          </a>

          <a
            href="https://studystark.com/install/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl border border-[var(--card-border)] bg-[var(--bg-secondary)] py-2.5 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
          >
            <Smartphone className="h-4 w-4 text-emerald-400" />
            <span>Download Official Android APK</span>
          </a>
        </div>

        {/* Footer */}
        <div className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
          <span>Made with</span>
          <Heart className="h-3.5 w-3.5 fill-red-500 text-red-500 animate-pulse" />
          <span>for students worldwide</span>
        </div>
      </div>
    </div>
  );
};
