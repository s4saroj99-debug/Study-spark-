import React, { useState, useEffect, useMemo, useTransition } from 'react';
import {
  Search,
  BookOpen,
  Filter,
  GraduationCap,
  Sparkles,
  WifiOff,
  Flame,
  ArrowRight,
  RefreshCw,
  Globe,
  SlidersHorizontal,
} from 'lucide-react';
import { BatchItem, WatchHistoryItem, ThemeId, NavTab, AppControls } from './types';
import {
  fetchAllBatches,
  fetchAppControls,
  getFavorites,
  toggleFavorite as toggleFavoriteService,
  getWatchHistory,
  clearWatchHistory as clearWatchHistoryService,
  getStoredTheme,
  setStoredTheme,
} from './services/batchService';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { PWAInstallBanner } from './components/PWAInstallBanner';
import { BatchCard } from './components/BatchCard';
import { BatchDetailsModal } from './components/BatchDetailsModal';
import { VideoPlayerView } from './components/VideoPlayerView';
import { CloudWebview } from './components/CloudWebview';
import { ThemeModal } from './components/ThemeModal';
import { AboutModal } from './components/AboutModal';
import { FavoritesView } from './components/FavoritesView';
import { WatchHistoryView } from './components/WatchHistoryView';
import { SettingsView } from './components/SettingsView';

export default function App() {
  const isOnline = useOnlineStatus();
  const [isPending, startTransition] = useTransition();

  // State
  const [allBatches, setAllBatches] = useState<BatchItem[]>([]);
  const [vidyapeethBatches, setVidyapeethBatches] = useState<BatchItem[]>([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState(true);
  const [batchError, setBatchError] = useState<string | null>(null);

  const [currentTab, setCurrentTab] = useState<NavTab>('batches');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [selectedClass, setSelectedClass] = useState<string>('all');

  // Favorites & History
  const [favorites, setFavorites] = useState<string[]>([]);
  const [watchHistory, setWatchHistory] = useState<WatchHistoryItem[]>([]);

  // Modals & Active Viewers
  const [selectedBatch, setSelectedBatch] = useState<BatchItem | null>(null);
  const [activeLecture, setActiveLecture] = useState<{
    title: string;
    videoUrl: string;
    batchId?: string;
    batchName?: string;
    duration?: number;
  } | null>(null);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<ThemeId>('dark');
  const [appControls, setAppControls] = useState<AppControls | null>(null);

  // Pagination for large 18k batch catalog
  const [displayCount, setDisplayCount] = useState(36);

  // Initialize theme, favorites, history, and controls
  useEffect(() => {
    const savedTheme = getStoredTheme();
    setCurrentTheme(savedTheme);
    setStoredTheme(savedTheme);

    setFavorites(getFavorites());
    setWatchHistory(getWatchHistory());

    fetchAppControls().then((ctrl) => {
      setAppControls(ctrl);
    });

    loadBatches();
  }, []);

  const loadBatches = async () => {
    setIsLoadingBatches(true);
    setBatchError(null);
    try {
      const data = await fetchAllBatches();
      setAllBatches(data.batches || []);
      setVidyapeethBatches(data.vidyapeeth || []);
    } catch (err: any) {
      setBatchError(err.message || 'Failed to load batches');
    } finally {
      setIsLoadingBatches(false);
    }
  };

  const handleSelectTheme = (theme: ThemeId) => {
    setCurrentTheme(theme);
    setStoredTheme(theme);
    setIsThemeModalOpen(false);
  };

  const handleToggleFavorite = (batchId: string) => {
    toggleFavoriteService(batchId);
    setFavorites(getFavorites());
  };

  const handleClearHistory = () => {
    clearWatchHistoryService();
    setWatchHistory([]);
  };

  const handleRefreshHistory = () => {
    setWatchHistory(getWatchHistory());
  };

  // Filter batches
  const filteredBatches = useMemo(() => {
    let source = activeCategory === 'vidyapeeth' ? vidyapeethBatches : allBatches;

    if (activeCategory !== 'all' && activeCategory !== 'vidyapeeth') {
      const catLower = activeCategory.toLowerCase();
      source = source.filter((b) => {
        const exam = (b.exam || '').toLowerCase();
        const name = (b.name || '').toLowerCase();
        const cls = (b.class || '').toLowerCase();

        if (catLower === 'jee') return exam.includes('jee') || name.includes('jee');
        if (catLower === 'neet') return exam.includes('neet') || name.includes('neet');
        if (catLower === 'class12') return cls === '12' || name.includes('12');
        if (catLower === 'class11') return cls === '11' || name.includes('11');
        if (catLower === 'class10') return cls === '10' || name.includes('10');
        if (catLower === 'class9') return cls === '9' || name.includes('9');
        if (catLower === 'dropper') return cls.includes('dropper') || name.includes('dropper');
        if (catLower === 'upsc') return exam.includes('upsc') || name.includes('upsc');
        return true;
      });
    }

    if (selectedLanguage !== 'all') {
      source = source.filter((b) => (b.language || '').toLowerCase() === selectedLanguage.toLowerCase());
    }

    if (selectedClass !== 'all') {
      source = source.filter((b) => (b.class || '').toLowerCase() === selectedClass.toLowerCase());
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      source = source.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          (b.exam && b.exam.toLowerCase().includes(q)) ||
          (b.byName && b.byName.toLowerCase().includes(q)) ||
          (b.class && b.class.toLowerCase().includes(q))
      );
    }

    return source;
  }, [allBatches, vidyapeethBatches, activeCategory, selectedLanguage, selectedClass, searchQuery]);

  const displayedBatches = useMemo(() => {
    return filteredBatches.slice(0, displayCount);
  }, [filteredBatches, displayCount]);

  const favoriteBatchItems = useMemo(() => {
    const favSet = new Set(favorites);
    const combined = [...allBatches, ...vidyapeethBatches];
    return combined.filter((b) => favSet.has(b.batch_id));
  }, [allBatches, vidyapeethBatches, favorites]);

  // Categories list
  const categories = [
    { id: 'all', label: 'All Batches', count: allBatches.length || '18K+' },
    { id: 'jee', label: 'IIT-JEE', icon: Flame },
    { id: 'neet', label: 'NEET', icon: Sparkles },
    { id: 'vidyapeeth', label: 'Vidyapeeth Centers', count: vidyapeethBatches.length || '2.2K+' },
    { id: 'class12', label: 'Class 12' },
    { id: 'class11', label: 'Class 11' },
    { id: 'class10', label: 'Class 10' },
    { id: 'class9', label: 'Class 9' },
    { id: 'dropper', label: 'Droppers' },
    { id: 'upsc', label: 'UPSC' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors">
      {/* App Header */}
      <Header
        currentTab={currentTab}
        onTabChange={(tab) => {
          setCurrentTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenThemes={() => setIsThemeModalOpen(true)}
        onOpenAbout={() => setIsAboutModalOpen(true)}
        onRefresh={loadBatches}
        isRefreshing={isLoadingBatches}
        favoritesCount={favorites.length}
      />

      {/* PWA Install Banner */}
      <PWAInstallBanner />

      {/* Offline Toast */}
      {!isOnline && (
        <div className="sticky top-16 z-30 flex items-center justify-center gap-2 bg-amber-500 py-1.5 px-4 text-xs font-bold text-white shadow-md">
          <WifiOff className="h-4 w-4" />
          <span>Offline Mode — Cached study batches and saved history are active.</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 pb-20 sm:pb-8">
        {/* VIEW 1: CLOUD WEBVIEW (Direct vidcloud.eu.org browser) */}
        {currentTab === 'webview' ? (
          <CloudWebview onSwitchToNative={() => setCurrentTab('batches')} />
        ) : currentTab === 'favorites' ? (
          /* VIEW 2: FAVORITES */
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
            <FavoritesView
              favoriteBatches={favoriteBatchItems}
              onToggleFavorite={handleToggleFavorite}
              onSelectBatch={(batch) => setSelectedBatch(batch)}
              onBrowseBatches={() => setCurrentTab('batches')}
            />
          </div>
        ) : currentTab === 'history' ? (
          /* VIEW 3: WATCH HISTORY */
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
            <WatchHistoryView
              history={watchHistory}
              onPlayItem={(item) => {
                setActiveLecture({
                  title: item.title,
                  videoUrl:
                    item.videoUrl ||
                    `https://vidcloud.eu.org/play.php?title=${encodeURIComponent(item.title)}`,
                  batchId: item.batchId,
                  batchName: item.batchName,
                  duration: item.duration,
                });
              }}
              onClearHistory={handleClearHistory}
              onBrowseBatches={() => setCurrentTab('batches')}
            />
          </div>
        ) : currentTab === 'settings' ? (
          /* VIEW 4: SETTINGS */
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
            <SettingsView
              currentTheme={currentTheme}
              onOpenThemes={() => setIsThemeModalOpen(true)}
              onOpenAbout={() => setIsAboutModalOpen(true)}
              appControls={appControls}
              onClearCache={() => {
                localStorage.removeItem('vidcloud_batches_cache');
                localStorage.removeItem('vidcloud_batches_cache_time');
                loadBatches();
                alert('Local cache reset successfully!');
              }}
            />
          </div>
        ) : (
          /* VIEW 5: BATCHES & SEARCH (Default Native App View) */
          <div className="mx-auto max-w-7xl px-3 sm:px-6 py-4 sm:py-6 space-y-6">
            {/* Hero / Quick Action Bar */}
            <div className="relative overflow-hidden rounded-3xl border border-indigo-500/20 bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-slate-900/40 p-4 sm:p-6 shadow-xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-xs font-bold text-indigo-400">
                      ⚡ Distraction-Free Study Platform
                    </span>
                    <span className="text-xs text-[var(--text-secondary)]">
                      {allBatches.length > 0 ? `${allBatches.length.toLocaleString()} Batches Online` : 'Loading Batches...'}
                    </span>
                  </div>
                  <h1 className="font-['Sora'] text-xl sm:text-2xl md:text-3xl font-extrabold text-[var(--text-primary)]">
                    Explore Courses & Video Lectures
                  </h1>
                  <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-xl">
                    Stream IIT-JEE, NEET, Foundation, and Boards lectures with high-res playback,
                    audio-only power saver mode, and teacher DPP notes.
                  </p>
                </div>

                {/* Quick Shortcuts */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setCurrentTab('webview')}
                    className="flex items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-600/10 px-3.5 py-2 text-xs font-bold text-indigo-300 hover:bg-indigo-600/20 transition"
                  >
                    <Globe className="h-4 w-4 text-indigo-400" />
                    <span>Open VidCloud Web</span>
                  </button>
                  <a
                    href="https://telegram.me/studystark"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-sky-600/20 hover:bg-sky-500 transition active:scale-95"
                  >
                    <span>Telegram Batches</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </div>

            {/* Search Input & Filters Box */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-secondary)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setDisplayCount(36);
                  }}
                  placeholder="Search 18,000+ batches by name, exam (JEE, NEET), teacher, or class..."
                  className="w-full rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] py-3 pl-10 pr-10 text-xs sm:text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] shadow-sm focus:border-[var(--primary-color)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Language Filter */}
              <div className="flex items-center gap-2">
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-3 text-xs font-semibold text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary-color)]"
                >
                  <option value="all">Language: All</option>
                  <option value="hinglish">Hinglish</option>
                  <option value="hindi">Hindi</option>
                  <option value="english">English</option>
                </select>

                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-3 text-xs font-semibold text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary-color)]"
                >
                  <option value="all">Class: All</option>
                  <option value="12">Class 12</option>
                  <option value="11">Class 11</option>
                  <option value="10">Class 10</option>
                  <option value="9">Class 9</option>
                  <option value="dropper">Dropper</option>
                </select>
              </div>
            </div>

            {/* Category Filter Pills (Horizontal Scroll) */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
              {categories.map((cat) => {
                const isActive = activeCategory === cat.id;
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setActiveCategory(cat.id);
                      setDisplayCount(36);
                    }}
                    className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-[var(--primary-color)] text-white shadow-md shadow-indigo-600/20 scale-[1.02]'
                        : 'border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-secondary)] hover:border-[var(--primary-color)]/40 hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {Icon && <Icon className="h-3.5 w-3.5" />}
                    <span>{cat.label}</span>
                    {cat.count && (
                      <span
                        className={`rounded-md px-1.5 py-0.2 text-[10px] ${
                          isActive ? 'bg-white/20 text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                        }`}
                      >
                        {cat.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Results Status */}
            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
              <span>
                Showing <strong className="text-[var(--text-primary)]">{displayedBatches.length}</strong> of{' '}
                <strong className="text-[var(--text-primary)]">{filteredBatches.length.toLocaleString()}</strong> batches
              </span>
              {searchQuery && (
                <span>
                  Filtered by query: <span className="text-[var(--primary-color)] font-semibold">"{searchQuery}"</span>
                </span>
              )}
            </div>

            {/* Batches Grid */}
            {isLoadingBatches ? (
              /* Skeletons */
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex flex-col overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] animate-pulse"
                  >
                    <div className="aspect-video w-full bg-[var(--bg-tertiary)]" />
                    <div className="p-4 space-y-2.5">
                      <div className="h-4 w-3/4 rounded bg-[var(--bg-tertiary)]" />
                      <div className="h-3 w-1/2 rounded bg-[var(--bg-tertiary)]" />
                      <div className="h-3 w-full rounded bg-[var(--bg-tertiary)]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredBatches.length === 0 ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[var(--card-border)] bg-[var(--bg-secondary)]/50 p-12 text-center">
                <GraduationCap className="h-12 w-12 text-slate-500 mb-3" />
                <h3 className="font-['Sora'] text-base font-bold text-[var(--text-primary)]">
                  No Batches Found
                </h3>
                <p className="mt-1 text-xs text-[var(--text-secondary)] max-w-sm">
                  We couldn't find any batches matching your filter. Try adjusting your keyword or
                  selecting "All Batches".
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setActiveCategory('all');
                    setSelectedLanguage('all');
                    setSelectedClass('all');
                  }}
                  className="mt-4 rounded-xl bg-[var(--primary-color)] px-4 py-2 text-xs font-bold text-white shadow-md hover:opacity-90"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              /* Real Batch Cards */
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {displayedBatches.map((batch) => (
                  <BatchCard
                    key={batch.batch_id}
                    batch={batch}
                    isFavorite={favorites.includes(batch.batch_id)}
                    onToggleFavorite={handleToggleFavorite}
                    onSelect={(b) => setSelectedBatch(b)}
                    onQuickPlay={(b) => {
                      setActiveLecture({
                        title: `${b.name} - Orientation & Lecture 01`,
                        videoUrl: `https://vidcloud.eu.org/play.php?batch_id=${b.batch_id}&title=${encodeURIComponent(
                          b.name
                        )}`,
                        batchId: b.batch_id,
                        batchName: b.name,
                        duration: 3600,
                      });
                    }}
                  />
                ))}
              </div>
            )}

            {/* Load More Button */}
            {displayedBatches.length < filteredBatches.length && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={() => setDisplayCount((prev) => prev + 36)}
                  className="flex items-center gap-2 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] px-6 py-3 text-xs font-bold text-[var(--text-primary)] shadow-sm hover:border-[var(--primary-color)] hover:bg-[var(--bg-tertiary)] transition active:scale-95"
                >
                  <RefreshCw className="h-4 w-4 text-[var(--primary-color)]" />
                  <span>
                    Load More Batches ({(filteredBatches.length - displayedBatches.length).toLocaleString()} remaining)
                  </span>
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Batch Details Modal */}
      {selectedBatch && (
        <BatchDetailsModal
          batch={selectedBatch}
          isFavorite={favorites.includes(selectedBatch.batch_id)}
          onToggleFavorite={handleToggleFavorite}
          onClose={() => setSelectedBatch(null)}
          onPlayLecture={(lec) => {
            setActiveLecture({
              title: lec.title,
              videoUrl: lec.videoUrl,
              batchId: selectedBatch.batch_id,
              batchName: selectedBatch.name,
              duration: lec.duration,
            });
            handleRefreshHistory();
          }}
          onOpenInCloudWebview={(batchId) => {
            setSelectedBatch(null);
            setCurrentTab('webview');
          }}
        />
      )}

      {/* Full Video Player Screen */}
      {activeLecture && (
        <VideoPlayerView
          lecture={activeLecture}
          onBack={() => {
            setActiveLecture(null);
            handleRefreshHistory();
          }}
          onOpenInCloudWebview={() => {
            setActiveLecture(null);
            setCurrentTab('webview');
          }}
        />
      )}

      {/* Theme Selector Modal */}
      {isThemeModalOpen && (
        <ThemeModal
          currentTheme={currentTheme}
          onSelectTheme={handleSelectTheme}
          onClose={() => setIsThemeModalOpen(false)}
        />
      )}

      {/* About Modal */}
      {isAboutModalOpen && <AboutModal onClose={() => setIsAboutModalOpen(false)} />}

      {/* Mobile Bottom Navigation */}
      <BottomNav
        currentTab={currentTab}
        onTabChange={(tab) => {
          setCurrentTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        favoritesCount={favorites.length}
      />
    </div>
  );
}
