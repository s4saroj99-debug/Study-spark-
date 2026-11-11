import { BatchItem, WatchHistoryItem, AppControls, ThemeId } from '../types';

const BATCHES_URL = 'https://studystark.github.io/batches/batches.json';
const CACHE_KEY = 'vidcloud_batches_cache';
const CACHE_TIME_KEY = 'vidcloud_batches_cache_time';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const FAVORITES_KEY = 'studystark_favorites';
const HISTORY_KEY = 'studystark_history';
const THEME_KEY = 'theme-mode';

export async function fetchAllBatches(): Promise<{
  batches: BatchItem[];
  vidyapeeth: BatchItem[];
}> {
  // Check memory / local storage cache
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
    if (cached && cachedTime && Date.now() - parseInt(cachedTime, 10) < CACHE_TTL_MS) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed.batches) && parsed.batches.length > 0) {
        // Return cached immediately, fetch fresh in background
        refreshBatchesInBackground();
        return parsed;
      }
    }
  } catch {
    // ignore cache read error
  }

  return fetchFreshBatches();
}

async function fetchFreshBatches(): Promise<{
  batches: BatchItem[];
  vidyapeeth: BatchItem[];
}> {
  try {
    const response = await fetch(BATCHES_URL, { cache: 'default' });
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    const json = await response.json();
    const batches: BatchItem[] = (json.data || []).map((b: any) => ({
      ...b,
      isVidyapeeth: false,
    }));
    const vidyapeeth: BatchItem[] = (json.vidyapeeth_batches || []).map((b: any) => ({
      ...b,
      isVidyapeeth: true,
    }));

    const result = { batches, vidyapeeth };

    // Save subset or cache to localStorage if possible without quota exceeded
    try {
      // Store lightweight cache (e.g. top 2500 batches or essential fields)
      const lightBatches = batches.slice(0, 3000).map((b) => ({
        batch_id: b.batch_id,
        name: b.name,
        byName: b.byName,
        language: b.language,
        exam: b.exam,
        photo: b.photo,
        class: b.class,
        amount: b.amount,
        isVidyapeeth: false,
      }));
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ batches: lightBatches, vidyapeeth: vidyapeeth.slice(0, 500) })
      );
      localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
    } catch {
      // Quota exceeded is normal for 18k items in localStorage, memory remains full
    }

    return result;
  } catch (err) {
    console.warn('Failed to fetch from github.io, trying fallback data:', err);
    // If offline or blocked, return cached or fallback sample
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
    return getFallbackBatches();
  }
}

function refreshBatchesInBackground() {
  fetchFreshBatches().catch(() => {});
}

export async function fetchAppControls(): Promise<AppControls> {
  try {
    const res = await fetch('https://vidcloud.eu.org/app-controls.php?_t=' + Date.now(), {
      headers: { 'X-Requested-With': 'SPA-Client' },
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && data.data) {
        return data.data;
      }
    }
  } catch {
    // fallback
  }

  return {
    maintenance_mode: false,
    community_tab: true,
    tests_tab: true,
    dpp_quiz_tab: true,
    action_buttons: [
      {
        id: 1,
        name: 'Add Batches',
        url: 'https://studystark.in/login/',
        active: true,
        sort_order: 1,
      },
      {
        id: 3,
        name: 'Join Telegram',
        url: 'https://telegram.me/studystark',
        active: true,
        sort_order: 3,
      },
      {
        id: 4,
        name: 'Join WhatsApp',
        url: 'https://www.whatsapp.com/channel/0029Vb7phJILikgEjnTVsx34',
        active: true,
        sort_order: 4,
      },
    ],
    download_button: {
      name: 'Download APK',
      url: 'https://studystark.com/install/',
      active: true,
    },
  };
}

// Favorites helper
export function getFavorites(): string[] {
  try {
    const data = localStorage.getItem(FAVORITES_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function toggleFavorite(batchId: string): boolean {
  const current = getFavorites();
  const exists = current.includes(batchId);
  let updated: string[];
  if (exists) {
    updated = current.filter((id) => id !== batchId);
  } else {
    updated = [batchId, ...current];
  }
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
  return !exists;
}

// Watch History helper
export function getWatchHistory(): WatchHistoryItem[] {
  try {
    const data = localStorage.getItem(HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveWatchHistory(item: Omit<WatchHistoryItem, 'watchedAt'>): void {
  try {
    const list = getWatchHistory();
    const filtered = list.filter((x) => x.id !== item.id && x.title !== item.title);
    const updated: WatchHistoryItem[] = [
      {
        ...item,
        watchedAt: Date.now(),
      },
      ...filtered.slice(0, 49), // retain up to 50 items
    ];
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

export function clearWatchHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// Theme helper
export function getStoredTheme(): ThemeId {
  try {
    const theme = localStorage.getItem(THEME_KEY);
    if (
      theme &&
      [
        'dark',
        'sandalwood',
        'forest-emerald',
        'ocean-deep',
        'sakura-blossom',
        'dracula-midnight',
        'lavender-mist',
        'cyberpunk-neon',
        'light',
      ].includes(theme)
    ) {
      return theme as ThemeId;
    }
  } catch {
    // ignore
  }
  return 'dark';
}

export function setStoredTheme(theme: ThemeId): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
    const body = document.body;
    const themeClasses = [
      'sandalwood',
      'forest-emerald',
      'ocean-deep',
      'sakura-blossom',
      'dracula-midnight',
      'lavender-mist',
      'cyberpunk-neon',
      'dark',
      'light',
      'dark-mode',
    ];
    themeClasses.forEach((cls) => body.classList.remove(cls));
    body.classList.add(theme);
    if (theme !== 'light') {
      body.classList.add('dark-mode');
    }
  } catch {
    // ignore
  }
}

function getFallbackBatches(): { batches: BatchItem[]; vidyapeeth: BatchItem[] } {
  return {
    batches: [
      {
        batch_id: '65d862392b1da90018ad8f3b',
        name: 'Lakshya JEE 2025',
        byName: 'For Class 12 JEE 2025 Aspirants',
        language: 'Hinglish',
        exam: 'IIT-JEE',
        photo: 'https://static.pw.live/5eb393ee95fab7468a79d189/ADMIN/1da7fd49-8e2c-44da-a186-5134e41d4d01.png',
        class: '12',
        amount: 5300,
        isVidyapeeth: false,
      },
      {
        batch_id: '65d862392b1da90018ad8f3c',
        name: 'Yakeen NEET 2025 (Dropper)',
        byName: 'India\'s Best NEET Dropper Batch',
        language: 'Hinglish',
        exam: 'NEET',
        photo: 'https://static.pw.live/5eb393ee95fab7468a79d189/ADMIN/1da7fd49-8e2c-44da-a186-5134e41d4d01.png',
        class: 'Dropper',
        amount: 5100,
        isVidyapeeth: false,
      },
      {
        batch_id: '65d862392b1da90018ad8f3d',
        name: 'Arjuna JEE 2026',
        byName: 'For Class 11 JEE 2026 Aspirants',
        language: 'Hinglish',
        exam: 'IIT-JEE',
        photo: 'https://static.pw.live/5eb393ee95fab7468a79d189/ADMIN/1da7fd49-8e2c-44da-a186-5134e41d4d01.png',
        class: '11',
        amount: 4800,
        isVidyapeeth: false,
      },
      {
        batch_id: '65d862392b1da90018ad8f3e',
        name: 'Udaan 2025 (Class 10)',
        byName: 'Board Exam & Foundation Batch',
        language: 'Hinglish',
        exam: 'Boards',
        photo: 'https://static.pw.live/5eb393ee95fab7468a79d189/ADMIN/1da7fd49-8e2c-44da-a186-5134e41d4d01.png',
        class: '10',
        amount: 2500,
        isVidyapeeth: false,
      },
    ],
    vidyapeeth: [],
  };
}
