import { AdventureState, BatchItem, CompletedLectureRecord } from '../types';

const ADVENTURE_KEY = 'vidcloud_adventure_state_v1';

function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getPrevDateString(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  const py = dt.getFullYear();
  const pm = String(dt.getMonth() + 1).padStart(2, '0');
  const pd = String(dt.getDate()).padStart(2, '0');
  return `${py}-${pm}-${pd}`;
}

function getDefaultState(): AdventureState {
  return {
    completedLectures: {},
    studyDates: [],
    enrolledBatchIds: [],
    customBatches: [],
  };
}

export function getAdventureState(): AdventureState {
  try {
    const raw = localStorage.getItem(ADVENTURE_KEY);
    if (!raw) return getDefaultState();
    const parsed = JSON.parse(raw);
    return {
      completedLectures: parsed.completedLectures || {},
      studyDates: Array.isArray(parsed.studyDates) ? parsed.studyDates : [],
      enrolledBatchIds: Array.isArray(parsed.enrolledBatchIds) ? parsed.enrolledBatchIds : [],
      customBatches: Array.isArray(parsed.customBatches) ? parsed.customBatches : [],
    };
  } catch {
    return getDefaultState();
  }
}

function saveAdventureState(state: AdventureState): void {
  try {
    localStorage.setItem(ADVENTURE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage quota errors
  }
}

export function recordStudyActivity(): AdventureState {
  const state = getAdventureState();
  const today = getTodayDateString();
  if (!state.studyDates.includes(today)) {
    state.studyDates = [...state.studyDates, today].sort();
    saveAdventureState(state);
  }
  return state;
}

export function markLectureCompleted(params: {
  batchId: string;
  subjectId: string;
  topicId: string;
  videoId: string;
  title: string;
}): AdventureState {
  const state = getAdventureState();
  const key = `${params.batchId}:${params.videoId}`;
  const today = getTodayDateString();
  if (!state.studyDates.includes(today)) {
    state.studyDates = [...state.studyDates, today].sort();
  }
  if (!state.completedLectures[key]) {
    const record: CompletedLectureRecord = {
      key,
      batchId: params.batchId,
      subjectId: params.subjectId,
      topicId: params.topicId,
      videoId: params.videoId,
      title: params.title,
      completedAt: Date.now(),
    };
    state.completedLectures[key] = record;
  }
  if (!state.enrolledBatchIds.includes(params.batchId)) {
    state.enrolledBatchIds = [params.batchId, ...state.enrolledBatchIds];
  }
  saveAdventureState(state);
  return state;
}

export function toggleLectureCompleted(params: {
  batchId: string;
  subjectId: string;
  topicId: string;
  videoId: string;
  title: string;
}): AdventureState {
  const state = getAdventureState();
  const key = `${params.batchId}:${params.videoId}`;
  if (state.completedLectures[key]) {
    delete state.completedLectures[key];
    saveAdventureState(state);
    return state;
  }
  return markLectureCompleted(params);
}

export function isLectureCompleted(batchId: string, videoId: string, state?: AdventureState): boolean {
  const s = state || getAdventureState();
  return Boolean(s.completedLectures[`${batchId}:${videoId}`]);
}

export function toggleEnrolledBatch(batchId: string): AdventureState {
  const state = getAdventureState();
  if (state.enrolledBatchIds.includes(batchId)) {
    state.enrolledBatchIds = state.enrolledBatchIds.filter((id) => id !== batchId);
  } else {
    state.enrolledBatchIds = [batchId, ...state.enrolledBatchIds];
  }
  saveAdventureState(state);
  return state;
}

export function addCustomBatch(batch: BatchItem): AdventureState {
  const state = getAdventureState();
  const filteredCustom = state.customBatches.filter((b) => b.batch_id !== batch.batch_id);
  state.customBatches = [batch, ...filteredCustom];
  if (!state.enrolledBatchIds.includes(batch.batch_id)) {
    state.enrolledBatchIds = [batch.batch_id, ...state.enrolledBatchIds];
  }
  saveAdventureState(state);
  return state;
}

export function removeCustomBatch(batchId: string): AdventureState {
  const state = getAdventureState();
  state.customBatches = state.customBatches.filter((b) => b.batch_id !== batchId);
  state.enrolledBatchIds = state.enrolledBatchIds.filter((id) => id !== batchId);
  saveAdventureState(state);
  return state;
}

export function resetAdventureProgress(): AdventureState {
  const fresh = getDefaultState();
  saveAdventureState(fresh);
  return fresh;
}

export function computeStreak(studyDates: string[]): { current: number; longest: number } {
  if (!studyDates.length) return { current: 0, longest: 0 };
  const dateSet = new Set(studyDates);
  const sorted = Array.from(dateSet).sort();

  const today = getTodayDateString();
  const yesterday = getPrevDateString(today);

  let current = 0;
  let cursor = dateSet.has(today) ? today : dateSet.has(yesterday) ? yesterday : '';
  while (cursor && dateSet.has(cursor)) {
    current++;
    cursor = getPrevDateString(cursor);
  }

  let longest = 0;
  let run = 0;
  let prev = '';
  for (const d of sorted) {
    if (!prev || getPrevDateString(d) === prev) {
      run++;
    } else {
      run = 1;
    }
    if (run > longest) longest = run;
    prev = d;
  }

  return { current, longest };
}

export function getAdventureMetrics(state: AdventureState, batchId?: string) {
  const allCompleted = Object.values(state.completedLectures);
  const completedList = batchId
    ? allCompleted.filter((item) => item.batchId === batchId)
    : allCompleted;

  const completedCount = completedList.length;
  const activeDays = state.studyDates.length;
  const { current: currentStreak, longest: longestStreak } = computeStreak(state.studyDates);

  const xp = completedCount * 50 + (batchId ? 0 : activeDays * 20);
  const level = Math.floor(xp / 200) + 1;
  const xpIntoLevel = xp % 200;
  const levelProgressPercent = Math.round((xpIntoLevel / 200) * 100);

  const ranks = [
    'Beginner Explorer',
    'Concept Seeker',
    'Topic Pathfinder',
    'Chapter Knight',
    'Syllabus Ranger',
    'Batch Champion',
    'Grand Scholar',
  ];
  const rank = ranks[Math.min(ranks.length - 1, level - 1)];

  const completedTopicCounts: Record<string, number> = {};
  for (const item of completedList) {
    completedTopicCounts[item.topicId] = (completedTopicCounts[item.topicId] || 0) + 1;
  }

  return {
    completedCount,
    activeDays,
    currentStreak,
    longestStreak,
    xp,
    level,
    xpIntoLevel,
    xpForNextLevel: 200,
    levelProgressPercent,
    rank,
    completedTopicCounts,
  };
}
