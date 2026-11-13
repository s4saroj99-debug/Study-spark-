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

export interface BatchAttachmentItem {
  _id?: string;
  baseUrl?: string;
  key?: string;
  name?: string;
  url?: string;
  resolvedUrl?: string;
}

export interface BatchNoteHomework {
  _id: string;
  topic?: string;
  note?: string;
  attachmentIds?: BatchAttachmentItem[];
}

export interface BatchNoteItem {
  _id: string;
  topic?: string;
  date?: string;
  homeworkIds?: BatchNoteHomework[];
}

export interface ScheduledClassItem {
  _id: string;
  topic: string;
  date?: string;
  dateKey?: string;
  startTime?: string;
  endTime?: string;
  urlType?: string;
  url?: string;
  type?: string;
  typeId?: string;
  status?: string;
  liveStatus?: 'LIVE' | 'UPCOMING' | 'COMPLETED';
  subjectName?: string;
  subjectSlug?: string;
  batchSubjectId?: string;
  topicName?: string;
  topicId?: string;
  teacherNames?: string[];
  isDPPVideos?: boolean;
  isDPPNotes?: boolean;
  videoDetails?: {
    _id?: string;
    id?: string;
    findKey?: string;
    name?: string;
    image?: string;
    videoUrl?: string;
    embedCode?: string;
    duration?: string;
  };
  homeworkIds?: BatchNoteHomework[];
  tags?: Array<{ _id: string; name: string }>;
}

export interface WeeklyRoutineSlot {
  weekday: number; // 0 = Sun ... 6 = Sat (IST)
  subjectName: string;
  subjectSlug?: string;
  batchSubjectId?: string;
  startTime?: string;
  endTime?: string;
  sampleTopic?: string;
  teacherNames?: string[];
}

export interface TodayScheduleResponse {
  success: boolean;
  source?: string;
  date: string;
  classes: ScheduledClassItem[];
}

export interface WeeklyScheduleResponse {
  success: boolean;
  source?: string;
  classes: ScheduledClassItem[];
  weeklyRoutine?: WeeklyRoutineSlot[];
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
  attachments?: BatchAttachmentItem[];
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

export type NavTab = 'batches' | 'search' | 'ai' | 'favorites' | 'history' | 'settings';

export type AiStudyLanguage = 'hinglish' | 'hindi' | 'english';
export type AiStudyMode = 'doubt' | 'formula' | 'quiz' | 'summary';

export interface AiStudyContext {
  batchName?: string;
  subjectName?: string;
  topicName?: string;
  lectureTitle?: string;
}

export interface AiChatImage {
  mimeType: string;
  data: string; // raw base64 without data URL prefix
  previewUrl?: string;
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  createdAt: number;
  image?: AiChatImage;
  mode?: AiStudyMode;
}

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
