import React, { useState, useEffect, useMemo, useTransition } from 'react';
import {
  Search,
  BookOpen,
  GraduationCap,
  Sparkles,
  WifiOff,
  Flame,
  RefreshCw,
  Compass,
  Trophy,
  Plus,
} from 'lucide-react';
import { AdventureState, BatchItem, WatchHistoryItem, ThemeId, NavTab, AppControls } from './types';
import {
  clearBatchCatalogCache,
  fetchAllBatches,
  fetchAppControls,
  getFavorites,
  toggleFavorite as toggleFavoriteService,
  getWatchHistory,
  clearWatchHistory as clearWatchHistoryService,
  getStoredTheme,
  setStoredTheme,
} from './services/batchService';
import {
  addCustomBatch,
  getAdventureMetrics,
  getAdventureState,
  resetAdventureProgress,
  toggleEnrolledBatch,
  toggleLectureCompleted,
} from './services/adventureService';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { PWAInstallBanner } from './components/PWAInstallBanner';
import { BatchCard } from './components/BatchCard';
import { BatchDetailsModal } from './components/BatchDetailsModal';
import { VideoPlayerView, ActiveLectureInput } from './components/VideoPlayerView';
import { ThemeModal } from './components/ThemeModal';
import { AboutModal } from './components/AboutModal';
import { AddBatchModal } from './components/AddBatchModal';
import { FavoritesView } from './components/FavoritesView';
import { WatchHistoryView } from './components/WatchHistoryView';
import { SettingsView } from './components/SettingsView';
import { StudyAiPanel } from './components/StudyAiPanel';

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

  // Favorites, History & Batch Adventure
  const [favorites, setFavorites] = useState<string[]>([]);
  const [watchHistory, setWatchHistory] = useState<WatchHistoryItem[]>([]);
  const [adventureState, setAdventureState] = useState<AdventureState>(() => getAdventureState());

  // Modals & Active Viewers
  const [selectedBatch, setSelectedBatch] = useState<BatchItem | null>(null);
  const [activeLecture, setActiveLecture] = useState<ActiveLectureInput | null>(null);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [isAddBatchModalOpen, setIsAddBatchModalOpen] = useState(false);
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

  const adventureMetrics = useMemo(() => getAdventureMetrics(adventureState), [adventureState]);

  const myBatches = useMemo(() => {
    const enrolledSet = new Set(adventureState.enrolledBatchIds);
    const customMap = new Map(adventureState.customBatches.map((b) => [b.batch_id, b]));
    const combined = [...allBatches, ...vidyapeethBatches];
    const seen = new Set<string>();
    const out: BatchItem[] = [];

    for (const cb of adventureState.customBatches) {
      if (!seen.has(cb.batch_id)) {
        seen.add(cb.batch_id);
        out.push(cb);
      }
    }
    for (const b of combined) {
      if (enrolledSet.has(b.batch_id) && !seen.has(b.batch_id)) {
        seen.add(b.batch_id);
        out.push(customMap.get(b.batch_id) || b);
      }
    }
    return out;
  }, [allBatches, vidyapeethBatches, adventureState.enrolledBatchIds, adventureState.customBatches]);

  // Filter batches
  const filteredBatches = useMemo(() => {
    let source =
      activeCategory === 'mybatches'
        ? myBatches
        : activeCategory === 'vidyapeeth'
        ? vidyapeethBatches
        : [...adventureState.customBatches, ...allBatches.filter((b) => !adventureState.customBatches.some((c) => c.batch_id === b.batch_id))];

    if (activeCategory !== 'all' && activeCategory !== 'vidyapeeth' && activeCategory !== 'mybatches') {
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
      const terms = q.split(/\s+/).filter(Boolean);
      source = source
        .filter((b) => {
          const hay = `${b.name || ''} ${b.exam || ''} ${b.byName || ''} ${b.class || ''}`.toLowerCase();
          return terms.every((t) => hay.includes(t));
        })
        .sort((a, b) => {
          const aName = (a.name || '').toLowerCase();
          const bName = (b.name || '').toLowerCase();
          const aExact = aName.includes(q) ? 1 : 0;
          const bExact = bName.includes(q) ? 1 : 0;
          if (aExact !== bExact) return bExact - aExact;
          const ta = a.start_date ? Date.parse(a.start_date) : 0;
          const tb = b.start_date ? Date.parse(b.start_date) : 0;
          return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
        });
    }

    return source;
  }, [allBatches, vidyapeethBatches, myBatches, adventureState.customBatches, activeCategory, selectedLanguage, selectedClass, searchQuery]);

  const displayedBatches = useMemo(() => {
    return filteredBatches.slice(0, displayCount);
  }, [filteredBatches, displayCount]);

  const favoriteBatchItems = useMemo(() => {
    const favSet = new Set(favorites);
    const combined = [...adventureState.customBatches, ...allBatches, ...vidyapeethBatches];
    const seen = new Set<string>();
    return combined.filter((b) => {
      if (!favSet.has(b.batch_id) || seen.has(b.batch_id)) return false;
      seen.add(b.batch_id);
      return true;
    });
  }, [allBatches, vidyapeethBatches, adventureState.customBatches, favorites]);

  // Categories list
  const categories = [
    { id: 'all', label: 'All Batches', count: allBatches.length || '18K+' },
    { id: 'mybatches', label: 'My Batches', icon: Compass, count: myBatches.length },
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
        onRefresh={async () => {
          await clearBatchCatalogCache();
          await loadBatches();
        }}
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
        {/* VIEW 1: STUDY AI */}
        {currentTab === 'ai' ? (
          <div className="mx-auto max-w-7xl px-3 sm:px-6 py-4">
            <StudyAiPanel variant="page" scopeKey="global" />
          </div>
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
                if (item.batchId && item.subjectId && item.topicId && item.videoId) {
                  setActiveLecture({
                    batchId: item.batchId,
                    batchName: item.batchName,
                    subjectId: item.subjectId,
                    topicId: item.topicId,
                    videoId: item.videoId,
                    videoType: item.videoType || 'new',
                    playType: item.playType || 'Lecture',
                    title: item.title,
                    rawVideoUrl: item.videoUrl,
                    resumeSeconds: item.progressSeconds,
                  });
                } else {
                  const found = [...allBatches, ...vidyapeethBatches].find(
                    (b) => b.batch_id === item.batchId
                  );
                  if (found) setSelectedBatch(found);
                }
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
              onOpenAddBatch={() => setIsAddBatchModalOpen(true)}
              onResetAdventure={() => setAdventureState(resetAdventureProgress())}
              adventureStats={{
                xp: adventureMetrics.xp,
                level: adventureMetrics.level,
                rank: adventureMetrics.rank,
                currentStreak: adventureMetrics.currentStreak,
                completedCount: adventureMetrics.completedCount,
                enrolledCount: myBatches.length,
              }}
              appControls={appControls}
              onClearCache={async () => {
                await clearBatchCatalogCache();
                await loadBatches();
              }}
            />
          </div>
        ) : (
          /* VIEW 5: BATCHES & SEARCH (Full-Width Native App View) */
          <div className="w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6">
            {/* Batch Adventure & Streak Hub */}
            <div className="relative overflow-hidden rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 sm:p-7 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-[var(--text-secondary)]">
                    <span className="font-bold text-[var(--primary-color)]">
                      Batch Adventure · Lv.{adventureMetrics.level} {adventureMetrics.rank}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {allBatches.length > 0 ? `${allBatches.length.toLocaleString()} Batches` : 'Loading Batches...'}
                    </span>
                  </div>
                  <h1 className="font-['Sora'] text-2xl sm:text-3xl md:text-4xl font-extrabold text-[var(--text-primary)]">
                    My Batches & Learning Adventure
                  </h1>
                  <p className="text-sm sm:text-base text-[var(--text-secondary)] max-w-2xl">
                    Track your daily study streak, clear chapter stages to earn XP, and stream
                    lectures with notes directly inside your app.
                  </p>
                </div>

                {/* Live Adventure Stats + Add Batch Controls */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
                  <div className="grid grid-cols-3 gap-4 rounded-2xl border border-[var(--card-border)] bg-[var(--bg-secondary)] px-5 py-3.5 text-center">
                    <div>
                      <div className="flex items-center justify-center gap-1 font-mono tabular-nums text-lg font-extrabold text-amber-400">
                        <Flame className="h-5 w-5" />
                        <span>{adventureMetrics.currentStreak}d</span>
                      </div>
                      <div className="text-xs text-[var(--text-secondary)]">Streak</div>
                    </div>
                    <div>
                      <div className="flex items-center justify-center gap-1 font-mono tabular-nums text-lg font-extrabold text-emerald-400">
                        <Trophy className="h-5 w-5" />
                        <span>{adventureMetrics.xp}</span>
                      </div>
                      <div className="text-xs text-[var(--text-secondary)]">Total XP</div>
                    </div>
                    <div>
                      <div className="font-mono tabular-nums text-lg font-extrabold text-[var(--text-primary)]">
                        {adventureMetrics.completedCount}
                      </div>
                      <div className="text-xs text-[var(--text-secondary)]">Cleared</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => {
                        setActiveCategory('mybatches');
                        setDisplayCount(36);
                      }}
                      className="flex flex-1 sm:flex-initial items-center justify-center gap-2 rounded-2xl border border-[var(--card-border)] bg-[var(--bg-secondary)] px-4 py-3 text-xs sm:text-sm font-bold text-[var(--text-primary)] hover:border-[var(--primary-color)] transition whitespace-nowrap"
                    >
                      <Compass className="h-4 w-4 text-[var(--primary-color)]" />
                      <span>My Batches ({myBatches.length})</span>
                    </button>
                    <button
                      onClick={() => setIsAddBatchModalOpen(true)}
                      className="flex flex-1 sm:flex-initial items-center justify-center gap-2 rounded-2xl bg-[var(--primary-color)] px-5 py-3 text-xs sm:text-sm font-bold text-white shadow-md hover:opacity-90 transition active:scale-95 whitespace-nowrap"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add Batch</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Search Input & Filters Box */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--text-secondary)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setDisplayCount(36);
                  }}
                  placeholder="Search 18,000+ batches by name, exam (JEE, NEET), teacher, or class..."
                  className="w-full rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] py-3.5 pl-12 pr-14 text-sm sm:text-base text-[var(--text-primary)] placeholder-[var(--text-secondary)] shadow-sm focus:border-[var(--primary-color)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-xs sm:text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Language Filter */}
              <div className="flex items-center gap-2.5">
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-3.5 text-xs sm:text-sm font-semibold text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary-color)]"
                >
                  <option value="all">Language: All</option>
                  <option value="hinglish">Hinglish</option>
                  <option value="hindi">Hindi</option>
                  <option value="english">English</option>
                </select>

                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-3.5 text-xs sm:text-sm font-semibold text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary-color)]"
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

            {/* Category Filter Tabs (Horizontal Scroll) */}
            <div className="flex items-center gap-2.5 overflow-x-auto pb-2 no-scrollbar">
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
                    className={`flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all ${
                      isActive
                        ? 'bg-[var(--primary-color)] text-white shadow-md shadow-indigo-600/20 scale-[1.02]'
                        : 'border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-secondary)] hover:border-[var(--primary-color)]/40 hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {Icon && <Icon className="h-4 w-4" />}
                    <span>{cat.label}</span>
                    {cat.count && (
                      <span
                        className={`rounded-lg px-2 py-0.5 text-xs ${
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
            <div className="flex items-center justify-between text-xs sm:text-sm text-[var(--text-secondary)]">
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
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex flex-col overflow-hidden rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] animate-pulse"
                  >
                    <div className="aspect-video w-full bg-[var(--bg-tertiary)]" />
                    <div className="p-5 space-y-3">
                      <div className="h-5 w-3/4 rounded bg-[var(--bg-tertiary)]" />
                      <div className="h-4 w-1/2 rounded bg-[var(--bg-tertiary)]" />
                      <div className="h-4 w-full rounded bg-[var(--bg-tertiary)]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredBatches.length === 0 ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[var(--card-border)] bg-[var(--bg-secondary)]/50 p-12 text-center">
                <GraduationCap className="h-14 w-14 text-slate-500 mb-3" />
                <h3 className="font-['Sora'] text-lg font-bold text-[var(--text-primary)]">
                  No Batches Found
                </h3>
                <p className="mt-1.5 text-sm text-[var(--text-secondary)] max-w-sm">
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
                  className="mt-5 rounded-2xl bg-[var(--primary-color)] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:opacity-90"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              /* Real Batch Cards (Spacious Full-Width Grid) */
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {displayedBatches.map((batch) => (
                  <BatchCard
                    key={batch.batch_id}
                    batch={batch}
                    isFavorite={favorites.includes(batch.batch_id)}
                    onToggleFavorite={handleToggleFavorite}
                    onSelect={(b) => setSelectedBatch(b)}
                    onQuickPlay={(b) => setSelectedBatch(b)}
                  />
                ))}
              </div>
            )}

            {/* Load More Button */}
            {displayedBatches.length < filteredBatches.length && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={() => setDisplayCount((prev) => prev + 36)}
                  className="flex items-center gap-2 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] px-7 py-3.5 text-sm font-bold text-[var(--text-primary)] shadow-sm hover:border-[var(--primary-color)] hover:bg-[var(--bg-tertiary)] transition active:scale-95"
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
          adventureState={adventureState}
          isEnrolled={
            adventureState.enrolledBatchIds.includes(selectedBatch.batch_id) ||
            adventureState.customBatches.some((b) => b.batch_id === selectedBatch.batch_id)
          }
          onToggleEnroll={(batchId) => setAdventureState(toggleEnrolledBatch(batchId))}
          onToggleLectureComplete={(params) => setAdventureState(toggleLectureCompleted(params))}
          onClose={() => setSelectedBatch(null)}
          onPlayLecture={(lec) => {
            setActiveLecture({
              batchId: lec.batchId,
              batchName: lec.batchName,
              subjectId: lec.subjectId,
              subjectName: lec.subjectName,
              topicId: lec.topicId,
              topicName: lec.topicName,
              videoId: lec.videoId,
              findKey: lec.findKey,
              videoDetailsId: lec.videoDetailsId,
              typeId: lec.typeId,
              title: lec.title,
              videoImg: lec.videoImg,
              videoType: lec.videoType,
              playType: lec.playType,
              rawVideoUrl: lec.rawVideoUrl,
            });
            handleRefreshHistory();
          }}
          onSelectSubBatch={(subBatch) => setSelectedBatch(subBatch)}
        />
      )}

      {/* Full Video Player Screen */}
      {activeLecture && (
        <VideoPlayerView
          lecture={activeLecture}
          onAdventureUpdate={() => setAdventureState(getAdventureState())}
          onBack={() => {
            setActiveLecture(null);
            setAdventureState(getAdventureState());
            handleRefreshHistory();
          }}
        />
      )}

      {/* Add Batch Modal */}
      {isAddBatchModalOpen && (
        <AddBatchModal
          onClose={() => setIsAddBatchModalOpen(false)}
          onAddBatch={(batch) => {
            setAdventureState(addCustomBatch(batch));
            setActiveCategory('mybatches');
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
