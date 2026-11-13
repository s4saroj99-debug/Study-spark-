export interface BatchItem {
  batch_id: string;
  name: string;
  byName?: string;
  language?: string;
  exam?: string;
  photo?: string;
  class?: string;
  start_date?: string;
  end_date?: string;
  amount?: number;
  isVidyapeeth?: boolean;
}

export interface BatchSubject {
  _id: string;
  subject: string;
  slug: string;
  imageId?: {
    baseUrl?: string;
    key?: string;
  };
  teacherIds?: Array<{
    _id: string;
    firstName?: string;
    lastName?: string;
    imageId?: { baseUrl?: string; key?: string };
  }>;
  lectureCount?: number;
  tagCount?: number;
}

export interface BatchTopic {
  _id: string;
  name: string;
  slug: string;
  type?: string;
  typeId?: string;
  videos?: number;
  notes?: number;
  exercises?: number;
  dppVideos?: number;
}

export interface BatchVideoItem {
  _id: string;
  topic: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  url?: string;
  urlType?: string;
  typeId?: string;
  isDPPVideos?: boolean;
  videoDetails?: {
    _id?: string;
    id?: string;
    findKey?: string;
    name?: string;
    image?: string;
    videoUrl?: string;
    embedCode?: string;
    duration?: string;
    types?: string[];
  };
  teachers?: string[];
}

export interface BatchNoteItem {
  _id: string;
  topic?: string;
  date?: string;
  homeworkIds?: Array<{
    _id: string;
    topic?: string;
    note?: string;
    attachmentIds?: Array<{
      _id: string;
      baseUrl?: string;
      key?: string;
      name?: string;
    }>;
  }>;
}

export interface ResolvedStream {
  success: boolean;
  isYoutube?: boolean;
  youtubeEmbedUrl?: string;
  isDirectMp4?: boolean;
  streamUrl?: string;
  hlsUrl?: string;
  dashUrl?: string;
  rawUrl?: string;
  drmType?: string;
  clearKey?: {
    kidB64: string;
    keyB64: string;
    kidHex: string;
    keyHex: string;
  } | null;
  attachments?: Array<{
    name?: string;
    url?: string;
    baseUrl?: string;
    key?: string;
  }>;
  message?: string;
}

export interface WatchHistoryItem {
  id: string;
  batchId?: string;
  batchName?: string;
  subjectId?: string;
  topicId?: string;
  videoId?: string;
  videoType?: string;
  playType?: string;
  title: string;
  videoUrl?: string;
  duration?: number;
  progressSeconds?: number;
  progressPercent?: number;
  watchedAt: number;
}

export interface AppControls {
  maintenance_mode: boolean;
  community_tab: boolean;
  tests_tab: boolean;
  dpp_quiz_tab: boolean;
  action_buttons: Array<{
    id: number;
    name: string;
    url: string;
    icon_svg?: string;
    active: boolean;
    sort_order?: number;
  }>;
  download_button?: {
    name: string;
    url: string;
    icon_svg?: string;
    active: boolean;
  };
}

export type ThemeId =
  | 'dark'
  | 'sandalwood'
  | 'forest-emerald'
  | 'ocean-deep'
  | 'sakura-blossom'
  | 'dracula-midnight'
  | 'lavender-mist'
  | 'cyberpunk-neon'
  | 'light';

export type NavTab = 'batches' | 'search' | 'favorites' | 'history' | 'settings';

export interface CompletedLectureRecord {
  key: string; // `${batchId}:${videoId}`
  batchId: string;
  subjectId: string;
  topicId: string;
  videoId: string;
  title: string;
  completedAt: number;
}

export interface AdventureState {
  completedLectures: Record<string, CompletedLectureRecord>;
  studyDates: string[]; // YYYY-MM-DD
  enrolledBatchIds: string[];
  customBatches: BatchItem[];
}
