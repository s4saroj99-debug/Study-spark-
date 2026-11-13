import React from 'react';
import {
  Download,
  Palette,
  RotateCw,
  Search,
  Info,
  Heart,
  History,
  Settings2,
  BookOpen,
  Sparkles,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { NavTab } from '../types';

interface HeaderProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onOpenThemes: () => void;
  onOpenAbout: () => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
  favoritesCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
  onOpenThemes,
  onOpenAbout,
  onRefresh,
  isRefreshing = false,
  favoritesCount,
}) => {
  const { isInstallable, isInstalled, install, isIOS } = usePWAInstall();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--card-border)] bg-[var(--bg-primary)]/85 backdrop-blur-md transition-colors">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-3 sm:px-6">
        {/* Brand & Logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenAbout}
            className="group relative flex items-center gap-2.5 rounded-xl p-1 text-left transition hover:opacity-90 focus:outline-none"
            title="About VidCloud"
          >
            <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 shadow-md shadow-indigo-500/20">
              <img
                src="/pwa-192x192.png"
                alt="VidCloud Logo"
                className="h-7 w-7 object-contain transition group-hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <span className="text-sm font-extrabold text-white">VC</span>
            </div>
            <div className="flex flex-col">
              <span className="font-['Sora'] text-base font-bold tracking-tight text-[var(--text-primary)] whitespace-nowrap">
                VidCloud
              </span>
            </div>
          </button>
        </div>

        {/* Spacing / Title Context */}
        <div className="hidden sm:block" />

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* In-App PWA Install Button */}
          {!isInstalled && (isInstallable || isIOS) && (
            <button
              onClick={install}
              className="group relative flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-3 py-1.5 text-xs font-bold text-white shadow-md shadow-indigo-600/20 transition hover:from-indigo-500 hover:to-purple-500 active:scale-95"
              title="Install VidCloud on Home Screen"
            >
              <Download className="h-3.5 w-3.5 animate-bounce" />
              <span className="hidden xs:inline">Install App</span>
              <span className="inline xs:hidden">Install</span>
            </button>
          )}

          {/* Batches shortcut (Desktop) */}
          <button
            onClick={() => onTabChange('batches')}
            className={`hidden sm:flex h-9 items-center gap-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--bg-secondary)] px-3 text-xs font-bold transition hover:border-[var(--primary-color)] hover:text-[var(--primary-color)] ${
              currentTab === 'batches'
                ? 'border-[var(--primary-color)] text-[var(--primary-color)]'
                : 'text-[var(--text-secondary)]'
            }`}
            title="Browse Batches"
          >
            <BookOpen className="h-4 w-4" />
            <span>Batches</span>
          </button>

          {/* Study AI shortcut */}
          <button
            onClick={() => onTabChange('ai')}
            className={`flex h-9 items-center gap-1.5 rounded-lg border px-2.5 sm:px-3 text-xs font-bold transition ${
              currentTab === 'ai'
                ? 'border-[var(--primary-color)] bg-[var(--primary-color)] text-white shadow-sm'
                : 'border-[var(--card-border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:border-[var(--primary-color)] hover:text-[var(--primary-color)]'
            }`}
            title="Open Study AI Doubt Solver"
          >
            <Sparkles className="h-4 w-4" />
            <span className="hidden xs:inline">Study AI</span>
          </button>

          {/* Quick Search */}
          <button
            onClick={() => onTabChange('search')}
            className={`flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] transition hover:border-[var(--primary-color)] hover:text-[var(--primary-color)] ${
              currentTab === 'search' ? 'border-[var(--primary-color)] text-[var(--primary-color)]' : ''
            }`}
            title="Search Batches"
          >
            <Search className="h-4 w-4" />
          </button>

          {/* Favorites shortcut */}
          <button
            onClick={() => onTabChange('favorites')}
            className={`relative hidden sm:flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] transition hover:border-pink-500 hover:text-pink-400 ${
              currentTab === 'favorites' ? 'border-pink-500 text-pink-400' : ''
            }`}
            title="My Favorite Batches"
          >
            <Heart className="h-4 w-4" />
            {favoritesCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-pink-500 text-[10px] font-bold text-white">
                {favoritesCount > 9 ? '9+' : favoritesCount}
              </span>
            )}
          </button>

          {/* Watch History shortcut */}
          <button
            onClick={() => onTabChange('history')}
            className={`hidden sm:flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] transition hover:border-[var(--primary-color)] hover:text-[var(--primary-color)] ${
              currentTab === 'history' ? 'border-[var(--primary-color)] text-[var(--primary-color)]' : ''
            }`}
            title="Watch History"
          >
            <History className="h-4 w-4" />
          </button>

          {/* Settings shortcut */}
          <button
            onClick={() => onTabChange('settings')}
            className={`hidden sm:flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] transition hover:border-[var(--primary-color)] hover:text-[var(--primary-color)] ${
              currentTab === 'settings' ? 'border-[var(--primary-color)] text-[var(--primary-color)]' : ''
            }`}
            title="Settings"
          >
            <Settings2 className="h-4 w-4" />
          </button>

          {/* Theme Switcher Button */}
          <button
            onClick={onOpenThemes}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] transition hover:border-[var(--primary-color)] hover:text-[var(--primary-color)]"
            title="Change App Theme"
          >
            <Palette className="h-4 w-4" />
          </button>

          {/* Refresh Page */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className={`flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] transition hover:border-[var(--primary-color)] hover:text-[var(--primary-color)] ${
              isRefreshing ? 'opacity-60' : ''
            }`}
            title="Refresh Batches"
          >
            <RotateCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
          </button>

          {/* Info Button */}
          <button
            onClick={onOpenAbout}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] transition hover:border-[var(--primary-color)] hover:text-[var(--primary-color)]"
            title="App Information"
          >
            <Info className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
