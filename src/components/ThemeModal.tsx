import React from 'react';
import { X, Check, Palette, Sparkles, Sun, Moon, Flame, Trees, Waves, Flower2, Skull, Zap } from 'lucide-react';
import { ThemeId } from '../types';

interface ThemeModalProps {
  currentTheme: ThemeId;
  onSelectTheme: (theme: ThemeId) => void;
  onClose: () => void;
}

interface ThemeOption {
  id: ThemeId;
  name: string;
  desc: string;
  icon: React.ElementType;
  previewBg: string;
  previewAccent: string;
}

export const ThemeModal: React.FC<ThemeModalProps> = ({
  currentTheme,
  onSelectTheme,
  onClose,
}) => {
  const themes: ThemeOption[] = [
    {
      id: 'dark',
      name: 'Dark Mode',
      desc: 'Sleek midnight look',
      icon: Moon,
      previewBg: '#09090f',
      previewAccent: '#6366f1',
    },
    {
      id: 'sandalwood',
      name: 'Sandalwood',
      desc: 'Warm & cozy wood tones',
      icon: Flame,
      previewBg: '#1d1712',
      previewAccent: '#c27803',
    },
    {
      id: 'forest-emerald',
      name: 'Forest Emerald',
      desc: 'Deep natural greens',
      icon: Trees,
      previewBg: '#061912',
      previewAccent: '#10b981',
    },
    {
      id: 'ocean-deep',
      name: 'Ocean Deep',
      desc: 'Abyssal deep blues',
      icon: Waves,
      previewBg: '#04121e',
      previewAccent: '#0284c7',
    },
    {
      id: 'sakura-blossom',
      name: 'Sakura Blossom',
      desc: 'Soft pink floral hues',
      icon: Flower2,
      previewBg: '#190914',
      previewAccent: '#ec4899',
    },
    {
      id: 'dracula-midnight',
      name: 'Dracula Midnight',
      desc: 'Vampiric gothic purple',
      icon: Skull,
      previewBg: '#1e1f29',
      previewAccent: '#bd93f9',
    },
    {
      id: 'lavender-mist',
      name: 'Lavender Mist',
      desc: 'Gentle pastel violet',
      icon: Sparkles,
      previewBg: '#120b1e',
      previewAccent: '#a855f7',
    },
    {
      id: 'cyberpunk-neon',
      name: 'Cyberpunk Neon',
      desc: 'High contrast neon synth',
      icon: Zap,
      previewBg: '#0a0b10',
      previewAccent: '#00f0ff',
    },
    {
      id: 'light',
      name: 'Light Mode',
      desc: 'Bright & clean daytime',
      icon: Sun,
      previewBg: '#f8fafc',
      previewAccent: '#4f46e5',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-4 backdrop-blur-md">
      <div className="relative my-auto flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--card-border)] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
              <Palette className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-['Sora'] text-base font-bold text-[var(--text-primary)]">
                Appearance & Theme
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">Choose your preferred visual atmosphere</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Themes Grid */}
        <div className="grid grid-cols-1 gap-2.5 overflow-y-auto p-4 sm:p-5">
          {themes.map((theme) => {
            const Icon = theme.icon;
            const isSelected = currentTheme === theme.id;
            return (
              <button
                key={theme.id}
                onClick={() => {
                  onSelectTheme(theme.id);
                }}
                className={`flex items-center justify-between rounded-2xl border p-3.5 transition-all text-left ${
                  isSelected
                    ? 'border-[var(--primary-color)] bg-[var(--bg-tertiary)] shadow-md ring-2 ring-[var(--primary-color)]/20'
                    : 'border-[var(--card-border)] bg-[var(--bg-secondary)] hover:border-[var(--primary-color)]/50'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl shadow-inner border border-white/10"
                    style={{ backgroundColor: theme.previewBg, color: theme.previewAccent }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-['Sora'] text-sm font-bold text-[var(--text-primary)]">
                      {theme.name}
                    </h4>
                    <p className="text-xs text-[var(--text-secondary)]">{theme.desc}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Color preview dot */}
                  <div className="flex items-center gap-1.5 rounded-full border border-[var(--card-border)] bg-[var(--bg-primary)] px-2.5 py-1">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: theme.previewAccent }}
                    />
                    <span
                      className="h-3 w-3 rounded-full border border-white/20"
                      style={{ backgroundColor: theme.previewBg }}
                    />
                  </div>

                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full transition ${
                      isSelected
                        ? 'bg-[var(--primary-color)] text-white shadow-sm'
                        : 'border border-[var(--card-border)] text-transparent'
                    }`}
                  >
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
