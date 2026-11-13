import {
  BatchAttachmentItem,
  BatchItem,
  BatchSubject,
  BatchTopic,
  BatchVideoItem,
  BatchNoteItem,
  TodayScheduleResponse,
  WeeklyScheduleResponse,
  ResolvedStream,
  WatchHistoryItem,
  AppControls,
  ThemeId,
} from '../types';

const LEGACY_CACHE_KEY = 'vidcloud_batches_cache';
const LEGACY_CACHE_TIME_KEY = 'vidcloud_batches_cache_time';
const IDB_NAME = 'vidcloud_catalog_db';
const IDB_STORE = 'catalog';
const IDB_RECORD_KEY = 'batches_v2';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

const FAVORITES_KEY = 'studystark_favorites';
const HISTORY_KEY = 'studystark_history';
const THEME_KEY = 'theme-mode';

type BatchCatalogResult = {
  batches: BatchItem[];
  vidyapeeth: BatchItem[];
};

let memoryCatalog: { data: BatchCatalogResult; savedAt: number } | null = null;

function sortBatchesNewestFirst(list: BatchItem[]): BatchItem[] {
  const seen = new Set<string>();
  const deduped: BatchItem[] = [];
  for (const item of list) {
    if (!item?.batch_id || seen.has(item.batch_id)) continue;
    seen.add(item.batch_id);
    deduped.push(item);
  }
  return deduped.sort((a, b) => {
    const ta = a.start_date ? Date.parse(a.start_date) : 0;
    const tb = b.start_date ? Date.parse(b.start_date) : 0;
    const va = Number.isFinite(ta) ? ta : 0;
    const vb = Number.isFinite(tb) ? tb : 0;
    return vb - va;
  });
}

function openCatalogDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open catalog DB'));
  });
}

async function readIdbCatalog(): Promise<{ data: BatchCatalogResult; savedAt: number } | null> {
  try {
    const db = await openCatalogDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const getReq = store.get(IDB_RECORD_KEY);
      getReq.onsuccess = () => resolve(getReq.result || null);
      getReq.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function writeIdbCatalog(data: BatchCatalogResult): Promise<void> {
  try {
    const db = await openCatalogDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put({ data, savedAt: Date.now() }, IDB_RECORD_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore storage failures
  }
}

export async function clearBatchCatalogCache(): Promise<void> {
  memoryCatalog = null;
  try {
    localStorage.removeItem(LEGACY_CACHE_KEY);
    localStorage.removeItem(LEGACY_CACHE_TIME_KEY);
  } catch {
    // ignore
  }
  try {
    const db = await openCatalogDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(IDB_RECORD_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
}

function purgeLegacyTruncatedCache(): void {
  try {
    localStorage.removeItem(LEGACY_CACHE_KEY);
    localStorage.removeItem(LEGACY_CACHE_TIME_KEY);
  } catch {
    // ignore
  }
}

export async function fetchAllBatches(): Promise<BatchCatalogResult> {
  purgeLegacyTruncatedCache();

  if (memoryCatalog && memoryCatalog.data.batches.length > 5000) {
    if (Date.now() - memoryCatalog.savedAt > CACHE_TTL_MS) {
      refreshBatchesInBackground();
    }
    return memoryCatalog.data;
  }

  const cached = await readIdbCatalog();
  if (
    cached &&
    Array.isArray(cached.data?.batches) &&
    cached.data.batches.length > 5000 &&
    Date.now() - cached.savedAt < CACHE_TTL_MS
  ) {
    memoryCatalog = cached;
    refreshBatchesInBackground();
    return cached.data;
  }

  return fetchFreshBatches();
}

async function fetchFreshBatches(): Promise<BatchCatalogResult> {
  try {
    let response = await fetch('/api/batches');
    if (!response.ok) {
      response = await fetch('https://studystark.github.io/batches/batches.json');
    }
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    const json = await response.json();
    const batches: BatchItem[] = sortBatchesNewestFirst(
      (json.data || []).map((b: any) => ({
        batch_id: b.batch_id,
        name: b.name,
        byName: b.byName,
        language: b.language,
        exam: b.exam,
        photo: b.photo,
        class: b.class,
        start_date: b.start_date,
        end_date: b.end_date,
        amount: b.amount,
        isVidyapeeth: false,
      }))
    );
    const vidyapeeth: BatchItem[] = sortBatchesNewestFirst(
      (json.vidyapeeth_batches || []).map((b: any) => ({
        batch_id: b.batch_id,
        name: b.name,
        byName: b.byName,
        language: b.language,
        exam: b.exam,
        photo: b.photo,
        class: b.class,
        start_date: b.start_date,
        end_date: b.end_date,
        amount: b.amount,
        isVidyapeeth: true,
      }))
    );

    const result: BatchCatalogResult = { batches, vidyapeeth };
    memoryCatalog = { data: result, savedAt: Date.now() };
    void writeIdbCatalog(result);
    return result;
  } catch (err) {
    console.warn('Failed to fetch batches, trying cached catalog:', err);
    const cached = await readIdbCatalog();
    if (cached?.data?.batches?.length) {
      return cached.data;
    }
    return getFallbackBatches();
  }
}

function refreshBatchesInBackground() {
  fetchFreshBatches().catch(() => {});
}

export async function fetchBatchDetails(batchId: string): Promise<{
  batch: any;
  subjects: BatchSubject[];
  mahapackBatches: any[];
  announcements: any[];
}> {
  const res = await fetch(`/api/batch/${encodeURIComponent(batchId)}`);
  if (!res.ok) {
    throw new Error(`Failed to load batch details (${res.status})`);
  }
  return res.json();
}

export async function fetchSubjectTopics(
  batchId: string,
  subjectSlug: string,
  page = 1
): Promise<{ topics: BatchTopic[]; paginate: any }> {
  const res = await fetch(
    `/api/topics/${encodeURIComponent(batchId)}/${encodeURIComponent(subjectSlug)}?page=${page}`
  );
  if (!res.ok) {
    throw new Error(`Failed to load chapters (${res.status})`);
  }
  return res.json();
}

export async function fetchTopicContents(
  batchId: string,
  subjectSlug: string,
  topicId: string,
  contentType: 'videos' | 'notes' | 'DppNotes' | 'DppVideos' = 'videos',
  page = 1
): Promise<{ items: Array<BatchVideoItem | BatchNoteItem>; paginate: any }> {
  const params = new URLSearchParams({
    topicId,
    contentType,
    page: String(page),
  });
  const res = await fetch(
    `/api/contents/${encodeURIComponent(batchId)}/${encodeURIComponent(subjectSlug)}?${params.toString()}`
  );
  if (!res.ok) {
    throw new Error(`Failed to load contents (${res.status})`);
  }
  return res.json();
}

export async function fetchTodaySchedule(batchId: string): Promise<TodayScheduleResponse> {
  const res = await fetch(`/api/schedule/${encodeURIComponent(batchId)}/today`);
  if (!res.ok) {
    throw new Error(`Failed to load today schedule (${res.status})`);
  }
  return res.json();
}

export async function fetchWeeklySchedule(
  batchId: string,
  startDate: string,
  endDate: string,
  page = 1
): Promise<WeeklyScheduleResponse> {
  const qs = new URLSearchParams({
    startDate,
    endDate,
    page: String(page),
  });
  const res = await fetch(`/api/schedule/${encodeURIComponent(batchId)}/weekly?${qs.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to load weekly schedule (${res.status})`);
  }
  return res.json();
}

export function resolveAttachmentUrl(att: BatchAttachmentItem): string {
  if (!att) return '';
  if (att.resolvedUrl) {
    return att.resolvedUrl.replace(/^https?:\/\/cors\.testfile\.eu\.org\//i, 'https://');
  }
  if (att.url) {
    return att.url.replace(/^https?:\/\/cors\.testfile\.eu\.org\//i, 'https://');
  }
  const cleanBase = (att.baseUrl || '').replace(/^https?:\/\/cors\.testfile\.eu\.org\//i, 'https://');
  const key = (att.key || '').trim();
  if (!cleanBase || !key) return '';
  return `${cleanBase.endsWith('/') ? cleanBase : `${cleanBase}/`}${key.replace(/^\//, '')}`;
}

export function buildPdfProxyUrl(rawUrl: string, fileName?: string, download = false): string {
  const qs = new URLSearchParams({
    url: rawUrl,
    name: fileName || 'study-notes.pdf',
  });
  if (download) qs.set('download', '1');
  return `/api/pdf-proxy?${qs.toString()}`;
}

export async function downloadPdfFile(rawUrl: string, fileName?: string): Promise<void> {
  const safeName = (fileName || 'study-notes.pdf').trim();
  const finalName = safeName.toLowerCase().endsWith('.pdf') ? safeName : `${safeName}.pdf`;
  const proxyUrl = buildPdfProxyUrl(rawUrl, finalName, true);

  const res = await fetch(proxyUrl);
  if (!res.ok) {
    throw new Error(`PDF download failed (${res.status})`);
  }
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = finalName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
}

export async function resolveVideoStream(params: {
  batchId: string;
  subjectId: string;
  topicId: string;
  videoId: string;
  findKey?: string;
  videoDetailsId?: string;
  videoName: string;
  videoImg?: string;
  videoType?: string;
  playType?: string;
  videoUrl?: string;
  typeId?: string;
}): Promise<ResolvedStream> {
  const qs = new URLSearchParams({
    batch_id: params.batchId,
    subject_id: params.subjectId,
    topic_id: params.topicId,
    video_id: params.videoId,
    video_name: params.videoName,
    video_img: params.videoImg || '',
    video_type: params.videoType || 'new',
    play_type: params.playType || 'Lecture',
  });
  if (params.findKey) qs.set('find_key', params.findKey);
  if (params.videoDetailsId) qs.set('video_details_id', params.videoDetailsId);
  if (params.videoUrl) qs.set('video_url', params.videoUrl);
  if (params.typeId) qs.set('typeId', params.typeId);

  const res = await fetch(`/api/stream?${qs.toString()}`);
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || `Stream resolution failed (${res.status})`);
  }
  return json;
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
  const updated = exists ? current.filter((id) => id !== batchId) : [batchId, ...current];
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
      ...filtered.slice(0, 49),
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
    ],
    vidyapeeth: [],
  };
}
