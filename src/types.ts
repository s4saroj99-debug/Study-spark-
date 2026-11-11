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

export interface WatchHistoryItem {
  id: string;
  batchId?: string;
  batchName?: string;
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

export type NavTab = 'batches' | 'search' | 'favorites' | 'history' | 'webview' | 'settings';
