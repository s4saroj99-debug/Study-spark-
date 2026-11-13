import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  Share2,
  Calendar,
  CalendarDays,
  BookOpen,
  GraduationCap,
  Heart,
  FileText,
  Clock,
  CheckCircle2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Layers,
  Video,
  Download,
  Bell,
  Compass,
  Flame,
  Trophy,
  Plus,
  Check,
  Radio,
  Eye,
  Sparkles,
} from 'lucide-react';
import {
  AdventureState,
  BatchItem,
  BatchSubject,
  BatchTopic,
  BatchVideoItem,
  BatchNoteItem,
  ScheduledClassItem,
  WeeklyRoutineSlot,
} from '../types';
import {
  buildPdfProxyUrl,
  downloadPdfFile,
  fetchBatchDetails,
  fetchSubjectTopics,
  fetchTodaySchedule,
  fetchTopicContents,
  fetchWeeklySchedule,
  resolveAttachmentUrl,
} from '../services/batchService';
import { getAdventureMetrics, isLectureCompleted } from '../services/adventureService';
import { StudyAiPanel } from './StudyAiPanel';

export interface PlayLecturePayload {
  batchId: string;
  batchName: string;
  subjectId: string;
  subjectName: string;
  topicId: string;
  topicName: string;
  videoId: string;
  findKey?: string;
  videoDetailsId?: string;
  typeId?: string;
  title: string;
  videoImg?: string;
  videoType: string;
  playType: string;
  rawVideoUrl?: string;
  durationText?: string;
}

interface BatchDetailsModalProps {
  batch: BatchItem | null;
  onClose: () => void;
  isFavorite: boolean;
  onToggleFavorite: (batchId: string) => void;
  adventureState: AdventureState;
  isEnrolled: boolean;
  onToggleEnroll: (batchId: string) => void;
  onToggleLectureComplete: (params: {
    batchId: string;
    subjectId: string;
    topicId: string;
    videoId: string;
    title: string;
  }) => void;
  onPlayLecture: (lecture: PlayLecturePayload) => void;
  onSelectSubBatch?: (batch: BatchItem) => void;
}

function getIstTodayStr(): string {
  const nowIst = new Date(Date.now() + 330 * 60 * 1000);
  return nowIst.toISOString().slice(0, 10);
}

function getWeekBoundsMonToSun(anchorDateStr: string): {
  startDate: string;
  endDate: string;
  days: Array<{ dateStr: string; dayShort: string; dayNum: string; weekday: number }>;
} {
  const [y, m, d] = anchorDateStr.split('-').map(Number);
  const utcDate = new Date(Date.UTC(y, m - 1, d));
  const dow = utcDate.getUTCDay(); // 0=Sun..6=Sat
  const diffToMon = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(utcDate.getTime() + diffToMon * 86400000);

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const days: Array<{ dateStr: string; dayShort: string; dayNum: string; weekday: number }> = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(mon.getTime() + i * 86400000);
    const dateStr = cur.toISOString().slice(0, 10);
    const wd = cur.getUTCDay();
    days.push({
      dateStr,
      dayShort: dayNames[wd],
      dayNum: String(cur.getUTCDate()),
      weekday: wd,
    });
  }
  return {
    startDate: days[0].dateStr,
    endDate: days[6].dateStr,
    days,
  };
}

function formatTimeRangeIst(startIso?: string, endIso?: string): string {
  if (!startIso) return 'Scheduled';
  const fmt = (iso: string) => {
    const ts = Date.parse(iso);
    if (!Number.isFinite(ts)) return '';
    return new Date(ts).toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };
  const s = fmt(startIso);
  const e = endIso ? fmt(endIso) : '';
  return e ? `${s} - ${e}` : s;
}

export const BatchDetailsModal: React.FC<BatchDetailsModalProps> = ({
  batch,
  onClose,
  isFavorite,
  onToggleFavorite,
  adventureState,
  isEnrolled,
  onToggleEnroll,
  onToggleLectureComplete,
  onPlayLecture,
  onSelectSubBatch,
}) => {
  const [activeTopTab, setActiveTopTab] = useState<'subjects' | 'schedule' | 'announcements'>('subjects');

  // Step 1: Batch details & Subjects
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<BatchSubject[]>([]);
  const [mahapackBatches, setMahapackBatches] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);

  // Today's classes & Weekly Schedule state
  const todayStr = getIstTodayStr();
  const [todayClasses, setTodayClasses] = useState<ScheduledClassItem[]>([]);
  const [loadingToday, setLoadingToday] = useState(false);
  const [selectedScheduleDate, setSelectedScheduleDate] = useState<string>(todayStr);
  const [weeklyClasses, setWeeklyClasses] = useState<ScheduledClassItem[]>([]);
  const [weeklyRoutine, setWeeklyRoutine] = useState<WeeklyRoutineSlot[]>([]);
  const [loadingWeekly, setLoadingWeekly] = useState(false);
  const [weeklyError, setWeeklyError] = useState<string | null>(null);
  const [scheduleSubjectFilter, setScheduleSubjectFilter] = useState<string>('all');
  const [scheduleNoticeMsg, setScheduleNoticeMsg] = useState<string | null>(null);

  // Step 2: Selected Subject -> Topics
  const [selectedSubject, setSelectedSubject] = useState<BatchSubject | null>(null);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [topics, setTopics] = useState<BatchTopic[]>([]);
  const [topicsPage, setTopicsPage] = useState(1);
  const [hasMoreTopics, setHasMoreTopics] = useState(false);

  // Step 3: Selected Topic -> Contents (videos, notes, DppNotes, DppVideos)
  const [selectedTopic, setSelectedTopic] = useState<BatchTopic | null>(null);
  const [contentTab, setContentTab] = useState<'videos' | 'notes' | 'DppNotes' | 'DppVideos'>('videos');
  const [loadingContents, setLoadingContents] = useState(false);
  const [videos, setVideos] = useState<BatchVideoItem[]>([]);
  const [notes, setNotes] = useState<BatchNoteItem[]>([]);
  const [dppNotes, setDppNotes] = useState<BatchNoteItem[]>([]);
  const [dppVideos, setDppVideos] = useState<BatchVideoItem[]>([]);
  const [contentsError, setContentsError] = useState<string | null>(null);

  // PDF Download indicator state
  const [downloadingPdfKey, setDownloadingPdfKey] = useState<string | null>(null);
  const [downloadedPdfKey, setDownloadedPdfKey] = useState<string | null>(null);
  const [pdfDownloadError, setPdfDownloadError] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);
  const [showAiDrawer, setShowAiDrawer] = useState(false);

  // Lock background page scroll while full-screen batch view is open
  useEffect(() => {
    if (!batch) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showAiDrawer) {
          setShowAiDrawer(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [batch, onClose, showAiDrawer]);

  // Load batch details & Today's Schedule when batch changes
  useEffect(() => {
    if (!batch) return;
    setSelectedSubject(null);
    setSelectedTopic(null);
    setTopics([]);
    setVideos([]);
    setNotes([]);
    setDppNotes([]);
    setDppVideos([]);
    setActiveTopTab('subjects');
    setSelectedScheduleDate(getIstTodayStr());
    setScheduleSubjectFilter('all');
    setWeeklyClasses([]);
    setWeeklyRoutine([]);
    setScheduleNoticeMsg(null);
    setPdfDownloadError(null);
    setShowAiDrawer(false);

    setLoadingDetails(true);
    setDetailsError(null);
    fetchBatchDetails(batch.batch_id)
      .then((res) => {
        setSubjects(res.subjects || []);
        setMahapackBatches(res.mahapackBatches || []);
        setAnnouncements(res.announcements || []);
      })
      .catch((err) => {
        setDetailsError(err.message || 'Could not load batch subjects.');
      })
      .finally(() => {
        setLoadingDetails(false);
      });

    setLoadingToday(true);
    fetchTodaySchedule(batch.batch_id)
      .then((res) => {
        setTodayClasses(res.classes || []);
      })
      .catch(() => {
        setTodayClasses([]);
      })
      .finally(() => {
        setLoadingToday(false);
      });
  }, [batch]);

  // Load weekly schedule whenever schedule tab is active or week bounds change
  const weekBounds = getWeekBoundsMonToSun(selectedScheduleDate);
  useEffect(() => {
    if (!batch || activeTopTab !== 'schedule') return;
    let cancelled = false;
    setLoadingWeekly(true);
    setWeeklyError(null);
    fetchWeeklySchedule(batch.batch_id, weekBounds.startDate, weekBounds.endDate, 1)
      .then((res) => {
        if (cancelled) return;
        setWeeklyClasses(res.classes || []);
        setWeeklyRoutine(res.weeklyRoutine || []);
      })
      .catch((err) => {
        if (cancelled) return;
        setWeeklyError(err?.message || 'Could not load weekly schedule.');
      })
      .finally(() => {
        if (!cancelled) setLoadingWeekly(false);
      });
    return () => {
      cancelled = true;
    };
  }, [batch, activeTopTab, weekBounds.startDate, weekBounds.endDate]);

  // Load topics when subject selected
  const handleSelectSubject = async (subj: BatchSubject) => {
    if (!batch) return;
    setSelectedSubject(subj);
    setSelectedTopic(null);
    setTopics([]);
    setTopicsPage(1);
    setLoadingTopics(true);
    try {
      const slugOrId = subj.slug || subj._id;
      const res = await fetchSubjectTopics(batch.batch_id, slugOrId, 1);
      setTopics(res.topics || []);
      setHasMoreTopics((res.topics || []).length >= 20);
    } catch (err: any) {
      setDetailsError(err.message || 'Failed to load chapters');
    } finally {
      setLoadingTopics(false);
    }
  };

  const handleLoadMoreTopics = async () => {
    if (!batch || !selectedSubject) return;
    const nextPage = topicsPage + 1;
    setLoadingTopics(true);
    try {
      const slugOrId = selectedSubject.slug || selectedSubject._id;
      const res = await fetchSubjectTopics(batch.batch_id, slugOrId, nextPage);
      const nextList = res.topics || [];
      setTopics((prev) => [...prev, ...nextList]);
      setTopicsPage(nextPage);
      setHasMoreTopics(nextList.length >= 20);
    } catch {
      setHasMoreTopics(false);
    } finally {
      setLoadingTopics(false);
    }
  };

  // Load contents when topic or contentTab changes
  const loadTopicTab = async (
    topic: BatchTopic,
    tab: 'videos' | 'notes' | 'DppNotes' | 'DppVideos'
  ) => {
    if (!batch || !selectedSubject) return;
    setLoadingContents(true);
    setContentsError(null);
    try {
      const slugOrId = selectedSubject.slug || selectedSubject._id;
      const res = await fetchTopicContents(batch.batch_id, slugOrId, topic._id, tab, 1);
      const items = res.items || [];
      if (tab === 'videos') setVideos(items as BatchVideoItem[]);
      if (tab === 'notes') setNotes(items as BatchNoteItem[]);
      if (tab === 'DppNotes') setDppNotes(items as BatchNoteItem[]);
      if (tab === 'DppVideos') setDppVideos(items as BatchVideoItem[]);
    } catch (err: any) {
      setContentsError(err.message || 'Could not load chapter materials.');
    } finally {
      setLoadingContents(false);
    }
  };

  const handleSelectTopic = (topic: BatchTopic) => {
    setSelectedTopic(topic);
    const defaultTab: 'videos' | 'notes' =
      (topic.videos || 0) > 0 || (topic.notes || 0) === 0 ? 'videos' : 'notes';
    setContentTab(defaultTab);
    setVideos([]);
    setNotes([]);
    setDppNotes([]);
    setDppVideos([]);
    loadTopicTab(topic, defaultTab);
  };

  const handleSwitchContentTab = (tab: 'videos' | 'notes' | 'DppNotes' | 'DppVideos') => {
    setContentTab(tab);
    if (!selectedTopic) return;
    if (tab === 'videos' && videos.length === 0) loadTopicTab(selectedTopic, 'videos');
    if (tab === 'notes' && notes.length === 0) loadTopicTab(selectedTopic, 'notes');
    if (tab === 'DppNotes' && dppNotes.length === 0) loadTopicTab(selectedTopic, 'DppNotes');
    if (tab === 'DppVideos' && dppVideos.length === 0) loadTopicTab(selectedTopic, 'DppVideos');
  };

  if (!batch) return null;

  const batchMetrics = getAdventureMetrics(adventureState, batch.batch_id);

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/?batch_id=${batch.batch_id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const triggerPlayVideo = (vid: BatchVideoItem, isDpp = false) => {
    if (!selectedSubject || !selectedTopic) return;
    const urlType = (vid.urlType || '').toLowerCase();
    const isYt = urlType === 'youtube';
    const rawUrl = vid.videoDetails?.embedCode || vid.videoDetails?.videoUrl || vid.url || '';
    const title = vid.topic || vid.videoDetails?.name || 'Lecture Video';
    const img = vid.videoDetails?.image || '';

    onPlayLecture({
      batchId: batch.batch_id,
      batchName: batch.name,
      subjectId: selectedSubject.slug || selectedSubject._id,
      subjectName: selectedSubject.subject,
      topicId: selectedTopic._id,
      topicName: selectedTopic.name,
      videoId: vid._id,
      findKey: vid.videoDetails?.findKey,
      videoDetailsId: vid.videoDetails?.id || vid.videoDetails?._id,
      typeId: vid.typeId,
      title,
      videoImg: img,
      videoType: isYt ? 'youtube' : 'new',
      playType: isDpp ? 'solutions' : 'Lecture',
      rawVideoUrl: rawUrl,
      durationText: vid.videoDetails?.duration,
    });
  };

  const handlePdfDownload = async (itemKey: string, rawUrl: string, fileName: string) => {
    setPdfDownloadError(null);
    setDownloadingPdfKey(itemKey);
    try {
      await downloadPdfFile(rawUrl, fileName);
      setDownloadedPdfKey(itemKey);
      setTimeout(() => setDownloadedPdfKey((prev) => (prev === itemKey ? null : prev)), 2500);
    } catch {
      try {
        window.location.assign(buildPdfProxyUrl(rawUrl, fileName, true));
      } catch {
        setPdfDownloadError('Could not download this PDF right now. Try "View PDF".');
      }
    } finally {
      setDownloadingPdfKey(null);
    }
  };

  const handlePlayScheduledClass = (cls: ScheduledClassItem) => {
    if (cls.liveStatus === 'UPCOMING') {
      setScheduleNoticeMsg(
        `${cls.topic} (${cls.subjectName || 'Class'}) starts at ${formatTimeRangeIst(cls.startTime, cls.endTime)} IST.`
      );
      return;
    }
    setScheduleNoticeMsg(null);
    const urlType = (cls.urlType || '').toLowerCase();
    const isYt = urlType === 'youtube';
    const rawUrl = cls.videoDetails?.embedCode || cls.videoDetails?.videoUrl || cls.url || '';
    const subjSlug = cls.subjectSlug || cls.batchSubjectId || 'subject';
    const topicId = cls.topicId || cls.tags?.[0]?._id || cls._id;
    onPlayLecture({
      batchId: batch.batch_id,
      batchName: batch.name,
      subjectId: subjSlug,
      subjectName: cls.subjectName || 'Class',
      topicId,
      topicName: cls.topicName || cls.tags?.[0]?.name || 'Scheduled Class',
      videoId: cls._id,
      findKey: cls.videoDetails?.findKey,
      videoDetailsId: cls.videoDetails?.id || cls.videoDetails?._id,
      typeId: cls.typeId,
      title: cls.topic || cls.videoDetails?.name || 'Scheduled Lecture',
      videoImg: cls.videoDetails?.image || '',
      videoType: isYt ? 'youtube' : 'new',
      playType: cls.isDPPVideos ? 'solutions' : 'Lecture',
      rawVideoUrl: rawUrl,
      durationText: cls.videoDetails?.duration,
    });
  };

  const renderPdfList = (list: BatchNoteItem[], emptyMsg: string) => {
    if (loadingContents) {
      return (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-xs text-[var(--text-secondary)]">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--primary-color)]" />
          <span>Loading PDF materials...</span>
        </div>
      );
    }
    if (list.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-[var(--card-border)] p-8 text-center text-xs text-[var(--text-secondary)]">
          {emptyMsg}
        </div>
      );
    }
    return (
      <div className="space-y-3">
        {pdfDownloadError && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs sm:text-sm text-amber-300">
            {pdfDownloadError}
          </div>
        )}
        {list.map((noteItem) =>
          (noteItem.homeworkIds || []).map((hw) =>
            (hw.attachmentIds || []).map((att) => {
              const itemKey = `${hw._id}-${att._id}`;
              const directUrl = resolveAttachmentUrl(att);
              const fileName = att.name || hw.topic || noteItem.topic || 'Study Notes.pdf';
              const viewUrl = directUrl ? buildPdfProxyUrl(directUrl, fileName, false) : '';
              const isDownloading = downloadingPdfKey === itemKey;
              const isDone = downloadedPdfKey === itemKey;

              return (
                <div
                  key={itemKey}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 rounded-2xl border border-[var(--card-border)] bg-[var(--bg-secondary)] p-4 sm:p-5"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-pink-500/10 text-pink-400">
                      <FileText className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <h5 className="font-['Sora'] text-sm sm:text-base font-bold text-[var(--text-primary)] truncate">
                        {fileName}
                      </h5>
                      <p className="text-xs sm:text-sm text-[var(--text-secondary)] truncate">
                        {hw.topic || 'PDF Attachment'}
                      </p>
                    </div>
                  </div>
                  {directUrl ? (
                    <div className="flex items-center gap-2.5 shrink-0">
                      <a
                        href={viewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-xl border border-[var(--card-border)] bg-[var(--bg-tertiary)] px-4 py-2.5 text-xs sm:text-sm font-bold text-[var(--text-primary)] hover:border-[var(--primary-color)] transition"
                      >
                        <Eye className="h-4 w-4 text-indigo-400" />
                        <span>View PDF</span>
                      </a>
                      <button
                        type="button"
                        disabled={isDownloading}
                        onClick={() => handlePdfDownload(itemKey, directUrl, fileName)}
                        className="flex items-center gap-1.5 rounded-xl bg-[var(--primary-color)] px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-60 transition"
                      >
                        {isDownloading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isDone ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                        <span>{isDownloading ? 'Saving...' : isDone ? 'Downloaded' : 'Download'}</span>
                      </button>
                    </div>
                  ) : (
                    <span className="shrink-0 rounded-xl border border-[var(--card-border)] bg-[var(--bg-tertiary)] px-3.5 py-2 text-xs font-semibold text-[var(--text-secondary)]">
                      PDF Unavailable
                    </span>
                  )}
                </div>
              );
            })
          )
        )}
      </div>
    );
  };

  const renderVideoList = (list: BatchVideoItem[], isDpp = false) => {
    if (loadingContents) {
      return (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-sm text-[var(--text-secondary)]">
          <Loader2 className="h-7 w-7 animate-spin text-[var(--primary-color)]" />
          <span>Loading video lectures...</span>
        </div>
      );
    }
    if (contentsError) {
      return (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-center text-sm text-red-400">
          {contentsError}
        </div>
      );
    }
    if (list.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-[var(--card-border)] p-10 text-center text-sm text-[var(--text-secondary)]">
          No videos found in this section. Check the Notes PDF tab for study materials!
        </div>
      );
    }
    return (
      <div className="space-y-3.5">
        {list.map((vid) => {
          const thumb = vid.videoDetails?.image;
          const dur = vid.videoDetails?.duration;
          const dateStr = vid.date ? new Date(vid.date).toLocaleDateString() : '';
          const title = vid.topic || vid.videoDetails?.name || 'Recorded Lecture';
          const isCleared = isLectureCompleted(batch.batch_id, vid._id, adventureState);
          return (
            <div
              key={vid._id}
              onClick={() => triggerPlayVideo(vid, isDpp)}
              className="group flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-[var(--card-border)] bg-[var(--bg-secondary)] p-4 sm:p-5 cursor-pointer transition hover:border-[var(--primary-color)]/60 hover:bg-[var(--bg-tertiary)]"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 min-w-0 flex-1">
                <div className="relative aspect-video w-full sm:h-24 sm:w-44 md:h-28 md:w-48 shrink-0 overflow-hidden rounded-2xl bg-slate-900">
                  {thumb ? (
                    <img src={thumb} alt={vid.topic} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-indigo-950">
                      <Video className="h-8 w-8 text-indigo-400" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/20 transition">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--primary-color)] text-white shadow-lg">
                      <Play className="h-5 w-5 fill-white ml-0.5" />
                    </div>
                  </div>
                  {dur && (
                    <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/85 px-2 py-0.5 font-mono text-xs font-bold text-white">
                      {dur}
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h4 className="font-['Sora'] text-sm sm:text-base lg:text-lg font-extrabold text-[var(--text-primary)] line-clamp-2 group-hover:text-[var(--primary-color)] transition">
                    {title}
                  </h4>
                  <div className="mt-2 flex flex-wrap items-center gap-2.5 text-xs sm:text-sm text-[var(--text-secondary)]">
                    {dateStr && (
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {dateStr}
                      </span>
                    )}
                    {dur && (
                      <span className="flex items-center gap-1.5 font-mono tabular-nums">
                        <Clock className="h-3.5 w-3.5 text-indigo-400" />
                        {dur}
                      </span>
                    )}
                    <span aria-hidden="true">·</span>
                    <span>{vid.urlType === 'youtube' ? 'YouTube' : 'HD Stream'}</span>
                    {isCleared && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-bold text-emerald-400">Cleared (+50 XP)</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!selectedSubject || !selectedTopic) return;
                    onToggleLectureComplete({
                      batchId: batch.batch_id,
                      subjectId: selectedSubject.slug || selectedSubject._id,
                      topicId: selectedTopic._id,
                      videoId: vid._id,
                      title,
                    });
                  }}
                  className={`flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition whitespace-nowrap ${
                    isCleared
                      ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                      : 'border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                  title={isCleared ? 'Stage cleared' : 'Mark lecture complete (+50 XP)'}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{isCleared ? 'Cleared' : 'Complete'}</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerPlayVideo(vid, isDpp);
                  }}
                  className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--primary-color)] px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md hover:opacity-90 active:scale-95 transition"
                >
                  <Play className="h-4 w-4 fill-white" />
                  <span>Play</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex h-[100dvh] w-full flex-col overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Compact Sticky Top Navigation Header */}
      <div className="flex h-14 sm:h-16 shrink-0 items-center justify-between gap-2 border-b border-[var(--card-border)] bg-[var(--bg-secondary)] px-3 sm:px-6">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={() => {
              if (selectedTopic) {
                setSelectedTopic(null);
              } else if (selectedSubject) {
                setSelectedSubject(null);
              } else {
                onClose();
              }
            }}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-[var(--card-border)] bg-[var(--bg-tertiary)] px-3.5 text-xs sm:text-sm font-bold text-[var(--text-primary)] hover:border-[var(--primary-color)] transition"
            title="Back"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs sm:text-sm">
            <button
              onClick={() => {
                setSelectedSubject(null);
                setSelectedTopic(null);
                setActiveTopTab('subjects');
              }}
              className={`font-bold whitespace-nowrap transition ${
                !selectedSubject && activeTopTab === 'subjects'
                  ? 'text-[var(--primary-color)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Subjects
            </button>

            {selectedSubject && (
              <>
                <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
                <button
                  onClick={() => setSelectedTopic(null)}
                  className={`font-bold whitespace-nowrap transition ${
                    !selectedTopic
                      ? 'text-[var(--primary-color)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {selectedSubject.subject}
                </button>
              </>
            )}

            {selectedTopic && (
              <>
                <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
                <span className="font-bold text-[var(--primary-color)] truncate max-w-[180px] sm:max-w-[300px]">
                  {selectedTopic.name}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!selectedSubject && (
            <>
              <button
                onClick={() =>
                  setActiveTopTab(activeTopTab === 'schedule' ? 'subjects' : 'schedule')
                }
                className={`flex h-10 items-center gap-1.5 rounded-xl px-3 sm:px-3.5 text-xs sm:text-sm font-bold transition ${
                  activeTopTab === 'schedule'
                    ? 'bg-[var(--primary-color)] text-white'
                    : 'border border-[var(--card-border)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <CalendarDays className="h-4 w-4" />
                <span className="hidden sm:inline">Weekly Schedule</span>
                {todayClasses.length > 0 && (
                  <span
                    className={`rounded px-1.5 py-0.2 font-mono text-[11px] ${
                      activeTopTab === 'schedule' ? 'bg-white/20 text-white' : 'bg-indigo-500/20 text-indigo-400'
                    }`}
                  >
                    {todayClasses.length}
                  </span>
                )}
              </button>
              <button
                onClick={() =>
                  setActiveTopTab(activeTopTab === 'announcements' ? 'subjects' : 'announcements')
                }
                className={`flex h-10 items-center gap-1.5 rounded-xl px-3 sm:px-3.5 text-xs sm:text-sm font-bold transition ${
                  activeTopTab === 'announcements'
                    ? 'bg-[var(--primary-color)] text-white'
                    : 'border border-[var(--card-border)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Bell className="h-4 w-4" />
                <span className="hidden md:inline">Notices ({announcements.length})</span>
              </button>
            </>
          )}

          <button
            onClick={() => setShowAiDrawer(true)}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-3 sm:px-4 text-xs sm:text-sm font-bold text-white shadow-sm hover:opacity-90 transition"
            title="Ask Study AI about this batch, subject, or chapter"
          >
            <Sparkles className="h-4 w-4" />
            <span>Ask AI</span>
          </button>

          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--card-border)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:border-red-500/50 hover:text-red-400 transition"
            title="Close Batch"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {copied && (
        <div className="fixed top-16 right-4 z-30 flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-lg">
          <CheckCircle2 className="h-4 w-4" />
          <span>Batch link copied!</span>
        </div>
      )}

      {/* Full-Screen Scrollable Study Workspace */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="w-full space-y-5">
          {/* Batch Banner + Actions Card */}
          <div className="relative overflow-hidden rounded-3xl border border-[var(--card-border)] bg-slate-900 shadow-lg">
            <div className="relative h-36 sm:h-48 lg:h-56 w-full overflow-hidden">
              {batch.photo ? (
                <img src={batch.photo} alt={batch.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-r from-indigo-900 via-purple-900 to-slate-900">
                  <GraduationCap className="h-16 w-16 text-indigo-400 opacity-60" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-black/50" />

              {/* Top Banner Pills & Actions */}
              <div className="absolute top-3.5 left-4 right-4 flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-full bg-black/65 px-3.5 py-1.5 text-xs sm:text-sm font-bold text-white backdrop-blur-md border border-white/15">
                  {batch.exam || 'All Exams'} · Class {batch.class || 'All'}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onToggleEnroll(batch.batch_id)}
                    className={`flex h-10 items-center gap-1.5 rounded-full px-4 text-xs sm:text-sm font-bold backdrop-blur-md transition whitespace-nowrap ${
                      isEnrolled
                        ? 'bg-emerald-600 text-white'
                        : 'bg-black/65 text-white hover:bg-black/80 border border-white/15'
                    }`}
                  >
                    {isEnrolled ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    <span>{isEnrolled ? 'In My Batches' : 'Add to My Batch'}</span>
                  </button>
                  <button
                    onClick={() => onToggleFavorite(batch.batch_id)}
                    className={`flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-md transition ${
                      isFavorite ? 'bg-pink-600 text-white' : 'bg-black/65 text-white hover:text-pink-400'
                    }`}
                    title={isFavorite ? 'Remove Favorite' : 'Add to Favorites'}
                  >
                    <Heart className={`h-4 w-4 ${isFavorite ? 'fill-white' : ''}`} />
                  </button>
                  <button
                    onClick={handleShare}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur-md hover:bg-black/80 transition"
                    title="Share Batch Link"
                  >
                    <Share2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Batch Name */}
              <div className="absolute bottom-4 left-4 right-4">
                <h2 className="font-['Sora'] text-xl sm:text-2xl lg:text-3xl font-extrabold text-white drop-shadow-md line-clamp-2">
                  {batch.name}
                </h2>
                {batch.byName && (
                  <p className="mt-1 text-xs sm:text-sm text-slate-200 drop-shadow line-clamp-1">
                    {batch.byName}
                  </p>
                )}
              </div>
            </div>

            {/* Batch Adventure Progress Bar */}
            <div className="border-t border-[var(--card-border)] bg-[var(--bg-secondary)] px-4 sm:px-6 py-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
                <div className="flex items-center gap-2">
                  <Compass className="h-5 w-5 text-[var(--primary-color)] shrink-0" />
                  <span className="font-['Sora'] font-bold text-[var(--text-primary)]">
                    Batch Adventure
                  </span>
                  <span aria-hidden="true" className="text-[var(--text-secondary)]">·</span>
                  <span className="text-[var(--text-secondary)] font-semibold">
                    Lv.{batchMetrics.level} {batchMetrics.rank}
                  </span>
                </div>
                <div className="flex items-center gap-3.5 font-mono tabular-nums text-xs sm:text-sm text-[var(--text-secondary)]">
                  <span className="flex items-center gap-1 text-emerald-400 font-bold">
                    <Trophy className="h-4 w-4" />
                    {batchMetrics.xp} XP
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{batchMetrics.completedCount} Cleared</span>
                  <span aria-hidden="true">·</span>
                  <span className="flex items-center gap-1 text-amber-400 font-bold">
                    <Flame className="h-4 w-4" />
                    {batchMetrics.currentStreak}d Streak
                  </span>
                </div>
              </div>
              <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
                <div
                  className="h-full rounded-full bg-[var(--primary-color)] transition-all duration-300"
                  style={{ width: `${batchMetrics.levelProgressPercent}%` }}
                />
              </div>
            </div>
          </div>

          {loadingDetails ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-sm text-[var(--text-secondary)]">
              <Loader2 className="h-10 w-10 animate-spin text-[var(--primary-color)]" />
              <span>Loading batch subjects & syllabus...</span>
            </div>
          ) : detailsError && subjects.length === 0 && mahapackBatches.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-center">
              <AlertCircle className="h-8 w-8 text-red-400 mb-2" />
              <p className="text-xs text-red-300 max-w-md">{detailsError}</p>
            </div>
          ) : activeTopTab === 'schedule' && !selectedSubject ? (
            /* Weekly Schedule View (Today + Weekly Strip + Routine) */
            <div className="space-y-5">
              {/* Week Navigation Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--card-border)] bg-[var(--bg-secondary)] p-4 sm:p-5">
                <div>
                  <h3 className="font-['Sora'] text-base sm:text-lg font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-[var(--primary-color)]" />
                    <span>
                      {selectedScheduleDate === todayStr
                        ? "Today's Classes"
                        : new Date(`${selectedScheduleDate}T00:00:00Z`).toLocaleDateString('en-IN', {
                            timeZone: 'UTC',
                            weekday: 'long',
                            day: 'numeric',
                            month: 'short',
                          })}
                    </span>
                  </h3>
                  <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5">
                    Week: {weekBounds.startDate} to {weekBounds.endDate} (IST)
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const d = new Date(`${selectedScheduleDate}T00:00:00Z`);
                      d.setUTCDate(d.getUTCDate() - 7);
                      setSelectedScheduleDate(d.toISOString().slice(0, 10));
                    }}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--card-border)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:border-[var(--primary-color)] transition"
                    title="Previous Week"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setSelectedScheduleDate(todayStr)}
                    className={`rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition ${
                      selectedScheduleDate === todayStr
                        ? 'bg-[var(--primary-color)] text-white'
                        : 'border border-[var(--card-border)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:border-[var(--primary-color)]'
                    }`}
                  >
                    Today
                  </button>
                  <button
                    onClick={() => {
                      const d = new Date(`${selectedScheduleDate}T00:00:00Z`);
                      d.setUTCDate(d.getUTCDate() + 7);
                      setSelectedScheduleDate(d.toISOString().slice(0, 10));
                    }}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--card-border)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:border-[var(--primary-color)] transition"
                    title="Next Week"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* 7-Day Interactive Strip */}
              <div className="grid grid-cols-7 gap-2 sm:gap-3">
                {weekBounds.days.map((day) => {
                  const isSelected = selectedScheduleDate === day.dateStr;
                  const isToday = day.dateStr === todayStr;
                  const dayCount = weeklyClasses.filter(
                    (c) =>
                      (c.dateKey || (c.date ? c.date.slice(0, 10) : '')) === day.dateStr ||
                      (isToday && todayClasses.some((tc) => tc._id === c._id))
                  ).length;

                  return (
                    <button
                      key={day.dateStr}
                      onClick={() => {
                        setSelectedScheduleDate(day.dateStr);
                        setScheduleNoticeMsg(null);
                      }}
                      className={`flex flex-col items-center justify-center rounded-2xl border py-3.5 px-1 transition ${
                        isSelected
                          ? 'border-[var(--primary-color)] bg-[var(--primary-color)] text-white shadow-md'
                          : isToday
                          ? 'border-[var(--primary-color)]/50 bg-[var(--bg-secondary)] text-[var(--text-primary)]'
                          : 'border-[var(--card-border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <span className="text-xs font-bold uppercase">{day.dayShort}</span>
                      <span className="mt-1 font-mono text-base sm:text-lg font-extrabold tabular-nums">
                        {day.dayNum}
                      </span>
                      <span
                        className={`mt-1.5 h-2 w-2 rounded-full ${
                          dayCount > 0
                            ? isSelected
                              ? 'bg-white'
                              : 'bg-emerald-400'
                            : 'bg-transparent'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>

              {/* Subject Filter Bar */}
              {(() => {
                const combinedForWeek =
                  selectedScheduleDate === todayStr
                    ? [...todayClasses, ...weeklyClasses.filter((w) => !todayClasses.some((t) => t._id === w._id))]
                    : weeklyClasses;
                const subjectOptions = Array.from(
                  new Set(combinedForWeek.map((c) => c.subjectName || 'General').filter(Boolean))
                );
                if (subjectOptions.length <= 1) return null;
                return (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                    <button
                      onClick={() => setScheduleSubjectFilter('all')}
                      className={`shrink-0 rounded-2xl px-4 py-2 text-xs sm:text-sm font-bold transition ${
                        scheduleSubjectFilter === 'all'
                          ? 'bg-[var(--primary-color)] text-white'
                          : 'border border-[var(--card-border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                      }`}
                    >
                      All Subjects
                    </button>
                    {subjectOptions.map((sName) => (
                      <button
                        key={sName}
                        onClick={() => setScheduleSubjectFilter(sName)}
                        className={`shrink-0 rounded-2xl px-4 py-2 text-xs sm:text-sm font-bold transition ${
                          scheduleSubjectFilter === sName
                            ? 'bg-[var(--primary-color)] text-white'
                            : 'border border-[var(--card-border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                        }`}
                      >
                        {sName}
                      </button>
                    ))}
                  </div>
                );
              })()}

              {scheduleNoticeMsg && (
                <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-xs sm:text-sm text-sky-300">
                  {scheduleNoticeMsg}
                </div>
              )}

              {/* Day's Scheduled Classes */}
              {loadingWeekly ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-sm text-[var(--text-secondary)]">
                  <Loader2 className="h-8 w-8 animate-spin text-[var(--primary-color)]" />
                  <span>Loading weekly schedule...</span>
                </div>
              ) : weeklyError ? (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-center text-sm text-red-400">
                  {weeklyError}
                </div>
              ) : (
                (() => {
                  const combinedSource =
                    selectedScheduleDate === todayStr
                      ? [
                          ...todayClasses,
                          ...weeklyClasses.filter((w) => !todayClasses.some((t) => t._id === w._id)),
                        ]
                      : weeklyClasses;

                  const dayClasses = combinedSource.filter((cls) => {
                    const key = cls.dateKey || (cls.date ? cls.date.slice(0, 10) : '');
                    const matchesDay =
                      key === selectedScheduleDate ||
                      (selectedScheduleDate === todayStr &&
                        todayClasses.some((t) => t._id === cls._id));
                    const matchesSubj =
                      scheduleSubjectFilter === 'all' ||
                      (cls.subjectName || 'General') === scheduleSubjectFilter;
                    return matchesDay && matchesSubj;
                  });

                  const selectedDow = new Date(`${selectedScheduleDate}T00:00:00Z`).getUTCDay();
                  const dayRoutine = weeklyRoutine.filter((r) => {
                    const matchesDow = r.weekday === selectedDow;
                    const matchesSubj =
                      scheduleSubjectFilter === 'all' || r.subjectName === scheduleSubjectFilter;
                    return matchesDow && matchesSubj;
                  });

                  return (
                    <div className="space-y-4">
                      {dayClasses.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-[var(--card-border)] p-10 text-center text-sm text-[var(--text-secondary)]">
                          No live or uploaded class found on {selectedScheduleDate}.
                          {dayRoutine.length > 0 && ' Check typical subject slots for this weekday below.'}
                        </div>
                      ) : (
                        <div className="space-y-3.5">
                          {dayClasses.map((cls) => {
                            const status = cls.liveStatus || 'COMPLETED';
                            const statusClass =
                              status === 'LIVE'
                                ? 'bg-red-500/15 text-red-400 border-red-500/30'
                                : status === 'UPCOMING'
                                ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                                : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';

                            const firstAtt = cls.homeworkIds?.flatMap((h) => h.attachmentIds || [])[0];
                            const firstAttUrl = firstAtt ? resolveAttachmentUrl(firstAtt) : '';

                            return (
                              <div
                                key={cls._id}
                                onClick={() => handlePlayScheduledClass(cls)}
                                className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-[var(--card-border)] bg-[var(--bg-secondary)] p-4 sm:p-5 cursor-pointer transition hover:border-[var(--primary-color)]/60 hover:bg-[var(--bg-tertiary)]"
                              >
                                <div className="space-y-2 min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2.5 text-xs sm:text-sm">
                                    <span
                                      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-0.5 font-bold ${statusClass}`}
                                    >
                                      {status === 'LIVE' && <Radio className="h-3.5 w-3.5 animate-pulse" />}
                                      {status === 'LIVE'
                                        ? 'LIVE'
                                        : status === 'UPCOMING'
                                        ? 'Upcoming'
                                        : 'Completed'}
                                    </span>
                                    <span className="font-bold text-[var(--primary-color)]">
                                      {cls.subjectName || 'General'}
                                    </span>
                                    <span aria-hidden="true" className="text-[var(--text-secondary)]">
                                      ·
                                    </span>
                                    <span className="flex items-center gap-1.5 font-mono text-[var(--text-secondary)] tabular-nums">
                                      <Clock className="h-3.5 w-3.5" />
                                      {formatTimeRangeIst(cls.startTime, cls.endTime)}
                                    </span>
                                  </div>

                                  <h4 className="font-['Sora'] text-sm sm:text-base lg:text-lg font-extrabold text-[var(--text-primary)] line-clamp-2 group-hover:text-[var(--primary-color)] transition">
                                    {cls.topic}
                                  </h4>

                                  <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-[var(--text-secondary)]">
                                    {cls.teacherNames && cls.teacherNames.length > 0 && (
                                      <span>By {cls.teacherNames.join(', ')}</span>
                                    )}
                                    {cls.topicName && (
                                      <>
                                        {cls.teacherNames && cls.teacherNames.length > 0 && (
                                          <span aria-hidden="true">·</span>
                                        )}
                                        <span>Chapter: {cls.topicName}</span>
                                      </>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2.5 shrink-0">
                                  {firstAttUrl && firstAtt && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handlePdfDownload(
                                          `ws-${cls._id}`,
                                          firstAttUrl,
                                          firstAtt.name || `${cls.topic}.pdf`
                                        );
                                      }}
                                      className="flex items-center gap-1.5 rounded-xl border border-[var(--card-border)] bg-[var(--bg-tertiary)] px-4 py-2.5 text-xs sm:text-sm font-bold text-[var(--text-primary)] hover:border-[var(--primary-color)] transition"
                                    >
                                      <Download className="h-4 w-4 text-pink-400" />
                                      <span>Notes</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handlePlayScheduledClass(cls);
                                    }}
                                    className="flex items-center gap-2 rounded-xl bg-[var(--primary-color)] px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md hover:opacity-90 transition"
                                  >
                                    <Play className="h-4 w-4 fill-white" />
                                    <span>{status === 'UPCOMING' ? 'Timing' : 'Watch'}</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {dayClasses.length === 0 && dayRoutine.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-[var(--text-secondary)]">
                            Regular Timetable Pattern for {weekBounds.days.find((d) => d.dateStr === selectedScheduleDate)?.dayShort}
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {dayRoutine.map((slot, idx) => (
                              <button
                                key={`${slot.weekday}-${slot.subjectName}-${idx}`}
                                onClick={() => {
                                  const matchedSubj = subjects.find(
                                    (s) =>
                                      s.slug === slot.subjectSlug ||
                                      s._id === slot.batchSubjectId ||
                                      s.subject === slot.subjectName
                                  );
                                  if (matchedSubj) {
                                    setActiveTopTab('subjects');
                                    handleSelectSubject(matchedSubj);
                                  }
                                }}
                                className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--card-border)] bg-[var(--bg-secondary)] p-4 sm:p-5 text-left hover:border-[var(--primary-color)] transition"
                              >
                                <div className="min-w-0">
                                  <div className="text-sm sm:text-base font-bold text-[var(--primary-color)] truncate">
                                    {slot.subjectName}
                                  </div>
                                  <div className="text-xs sm:text-sm text-[var(--text-secondary)] truncate mt-1">
                                    {formatTimeRangeIst(slot.startTime, slot.endTime)}
                                    {slot.teacherNames?.length ? ` · ${slot.teacherNames.join(', ')}` : ''}
                                  </div>
                                </div>
                                <ChevronRight className="h-5 w-5 shrink-0 text-[var(--text-secondary)]" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()
              )}
            </div>
          ) : activeTopTab === 'announcements' && !selectedSubject ? (
            /* Announcements View */
            <div className="space-y-3.5">
              {announcements.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--card-border)] p-12 text-center text-sm text-[var(--text-secondary)]">
                  No announcements posted for this batch yet.
                </div>
              ) : (
                announcements.map((ann, idx) => (
                  <div
                    key={ann._id || idx}
                    className="rounded-2xl border border-[var(--card-border)] bg-[var(--bg-secondary)] p-5 sm:p-6 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs sm:text-sm text-[var(--text-secondary)]">
                      <span className="font-bold text-indigo-400">Batch Notice</span>
                      {ann.createdAt && <span>{new Date(ann.createdAt).toLocaleDateString()}</span>}
                    </div>
                    <p className="text-sm sm:text-base text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
                      {ann.announcement || ann.title || 'Notice update'}
                    </p>
                  </div>
                ))
              )}
            </div>
          ) : selectedTopic ? (
            /* Topic Contents (Videos / Notes / DPP) */
            <div className="space-y-4">
              {/* Sub-tabs */}
              <div className="flex items-center gap-2.5 overflow-x-auto pb-1 no-scrollbar">
                {[
                  { id: 'videos' as const, label: 'Lectures', count: selectedTopic.videos },
                  { id: 'notes' as const, label: 'Class Notes PDF', count: selectedTopic.notes },
                  { id: 'DppNotes' as const, label: 'DPP PDFs' },
                  { id: 'DppVideos' as const, label: 'DPP Videos', count: selectedTopic.dppVideos },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => handleSwitchContentTab(tab.id)}
                    className={`flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-bold transition ${
                      contentTab === tab.id
                        ? 'bg-[var(--primary-color)] text-white shadow-sm'
                        : 'border border-[var(--card-border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <span>{tab.label}</span>
                    {tab.count !== undefined && (
                      <span className="rounded-lg bg-black/20 px-2 py-0.5 text-xs">
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {contentTab === 'videos' && renderVideoList(videos, false)}
              {contentTab === 'DppVideos' && renderVideoList(dppVideos, true)}
              {contentTab === 'notes' &&
                renderPdfList(notes, 'No class notes PDFs available for this chapter.')}
              {contentTab === 'DppNotes' &&
                renderPdfList(dppNotes, 'No DPP PDFs available for this chapter.')}
            </div>
          ) : selectedSubject ? (
            /* STEP 2: Subject Chapters / Topics */
            <div className="space-y-4">
              {loadingTopics && topics.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-sm text-[var(--text-secondary)]">
                  <Loader2 className="h-8 w-8 animate-spin text-[var(--primary-color)]" />
                  <span>Loading chapters for {selectedSubject.subject}...</span>
                </div>
              ) : topics.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--card-border)] p-10 text-center text-sm text-[var(--text-secondary)]">
                  No chapters uploaded under {selectedSubject.subject} yet.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {topics.map((topic, idx) => {
                      const clearedCount = batchMetrics.completedTopicCounts[topic._id] || 0;
                      const totalVids = topic.videos || 0;
                      const pct = totalVids > 0 ? Math.min(100, Math.round((clearedCount / totalVids) * 100)) : 0;
                      const stageDone = totalVids > 0 && clearedCount >= totalVids;
                      return (
                        <button
                          key={topic._id}
                          onClick={() => handleSelectTopic(topic)}
                          className="group flex flex-col gap-3 rounded-2xl border border-[var(--card-border)] bg-[var(--bg-secondary)] p-5 text-left transition hover:border-[var(--primary-color)]/60 hover:bg-[var(--bg-tertiary)]"
                        >
                          <div className="flex items-center justify-between gap-3 w-full">
                            <div className="flex items-start gap-3.5 min-w-0">
                              <span
                                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-mono tabular-nums text-sm font-extrabold ${
                                  stageDone
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : 'bg-indigo-500/15 text-indigo-400'
                                }`}
                              >
                                {stageDone ? <CheckCircle2 className="h-5 w-5" /> : String(idx + 1).padStart(2, '0')}
                              </span>
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-[var(--text-secondary)] font-mono tabular-nums">
                                  Stage {String(idx + 1).padStart(2, '0')}
                                  {clearedCount > 0 ? ` · ${clearedCount}/${totalVids || clearedCount} cleared` : ''}
                                </div>
                                <h4 className="font-['Sora'] text-sm sm:text-base font-extrabold text-[var(--text-primary)] line-clamp-2 group-hover:text-[var(--primary-color)] transition">
                                  {topic.name}
                                </h4>
                                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)] font-mono tabular-nums">
                                  <span>{totalVids} Videos</span>
                                  <span aria-hidden="true">·</span>
                                  <span>{topic.notes || 0} Notes</span>
                                </div>
                              </div>
                            </div>
                            <ChevronRight className="h-5 w-5 shrink-0 text-[var(--text-secondary)] group-hover:translate-x-0.5 group-hover:text-[var(--primary-color)] transition" />
                          </div>
                          {totalVids > 0 && (
                            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  stageDone ? 'bg-emerald-500' : 'bg-[var(--primary-color)]'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {hasMoreTopics && (
                    <div className="flex justify-center pt-2">
                      <button
                        onClick={handleLoadMoreTopics}
                        disabled={loadingTopics}
                        className="flex items-center gap-2 rounded-2xl border border-[var(--card-border)] bg-[var(--bg-secondary)] px-5 py-3 text-sm font-bold text-[var(--text-primary)] hover:border-[var(--primary-color)]"
                      >
                        {loadingTopics && <Loader2 className="h-4 w-4 animate-spin" />}
                        <span>Load More Chapters</span>
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            /* STEP 1: Today's Schedule Preview + Subjects Grid (or Mahapack Batches) */
            <div className="space-y-6">
              {/* Today's Classes Quick Strip */}
              <div className="rounded-3xl border border-[var(--card-border)] bg-[var(--bg-secondary)] p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2 mb-3.5">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-[var(--primary-color)]" />
                    <h3 className="font-['Sora'] text-sm sm:text-base font-extrabold text-[var(--text-primary)]">
                      Today&apos;s Classes ({todayClasses.length})
                    </h3>
                  </div>
                  <button
                    onClick={() => setActiveTopTab('schedule')}
                    className="flex items-center gap-1 text-xs sm:text-sm font-bold text-[var(--primary-color)] hover:underline"
                  >
                    <span>Full Weekly Schedule</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {loadingToday ? (
                  <div className="flex items-center gap-2 py-3 text-xs sm:text-sm text-[var(--text-secondary)]">
                    <Loader2 className="h-5 w-5 animate-spin text-[var(--primary-color)]" />
                    <span>Checking today&apos;s live timetable...</span>
                  </div>
                ) : todayClasses.length === 0 ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-dashed border-[var(--card-border)] px-4 py-3 text-xs sm:text-sm text-[var(--text-secondary)]">
                    <span>No live class listed for today yet — browse the weekly calendar.</span>
                    <button
                      onClick={() => setActiveTopTab('schedule')}
                      className="font-bold text-[var(--primary-color)] hover:underline"
                    >
                      Open Weekly Calendar
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {todayClasses.slice(0, 6).map((cls) => {
                      const status = cls.liveStatus || 'COMPLETED';
                      const statusColor =
                        status === 'LIVE'
                          ? 'text-red-400'
                          : status === 'UPCOMING'
                          ? 'text-sky-400'
                          : 'text-emerald-400';
                      return (
                        <button
                          key={cls._id}
                          onClick={() => handlePlayScheduledClass(cls)}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 text-left hover:border-[var(--primary-color)] transition"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-xs font-bold">
                              <span className={statusColor}>
                                {status === 'LIVE' ? '● LIVE' : status === 'UPCOMING' ? 'UPCOMING' : 'DONE'}
                              </span>
                              <span className="text-[var(--primary-color)] truncate">
                                {cls.subjectName || 'Class'}
                              </span>
                              <span className="font-mono text-[var(--text-secondary)]">
                                {formatTimeRangeIst(cls.startTime, cls.endTime)}
                              </span>
                            </div>
                            <div className="font-['Sora'] text-sm sm:text-base font-bold text-[var(--text-primary)] truncate mt-1">
                              {cls.topic}
                            </div>
                            {cls.teacherNames && cls.teacherNames.length > 0 && (
                              <div className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
                                {cls.teacherNames.join(', ')}
                              </div>
                            )}
                          </div>
                          <Play className="h-5 w-5 shrink-0 text-[var(--primary-color)]" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {subjects.length > 0 && (
                <div>
                  <h3 className="mb-3.5 text-xs sm:text-sm font-extrabold uppercase tracking-wider text-[var(--text-secondary)]">
                    Select Subject ({subjects.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {subjects.map((subj) => {
                      const imgUrl =
                        subj.imageId?.baseUrl && subj.imageId?.key
                          ? `${subj.imageId.baseUrl}${subj.imageId.key}`
                          : null;
                      return (
                        <button
                          key={subj._id}
                          onClick={() => handleSelectSubject(subj)}
                          className="group flex items-center gap-4 rounded-3xl border border-[var(--card-border)] bg-[var(--bg-secondary)] p-5 sm:p-6 text-left transition hover:-translate-y-0.5 hover:border-[var(--primary-color)]/60 hover:shadow-lg"
                        >
                          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-indigo-500/10 text-indigo-400">
                            {imgUrl ? (
                              <img
                                src={imgUrl}
                                alt={subj.subject}
                                className="h-full w-full object-contain p-1.5"
                              />
                            ) : (
                              <BookOpen className="h-8 w-8" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-['Sora'] text-base sm:text-lg font-extrabold text-[var(--text-primary)] truncate group-hover:text-[var(--primary-color)] transition">
                              {subj.subject}
                            </h4>
                            <p className="mt-1 text-xs sm:text-sm text-[var(--text-secondary)]">
                              {subj.tagCount
                                ? `${subj.tagCount} Chapters`
                                : subj.lectureCount
                                ? `${subj.lectureCount} Lectures`
                                : 'Tap to browse chapters'}
                            </p>
                          </div>
                          <ChevronRight className="h-5 w-5 text-[var(--text-secondary)] group-hover:text-[var(--primary-color)] transition" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {mahapackBatches.length > 0 && (
                <div>
                  <h3 className="mb-3.5 flex items-center gap-2 text-xs sm:text-sm font-extrabold uppercase tracking-wider text-[var(--text-secondary)]">
                    <Layers className="h-4 w-4 text-purple-400" />
                    <span>Included Mahapack Batches ({mahapackBatches.length})</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {mahapackBatches.map((mb: any) => (
                      <button
                        key={mb._id || mb.batchId}
                        onClick={() => {
                          if (onSelectSubBatch) {
                            onSelectSubBatch({
                              batch_id: mb._id || mb.batchId,
                              name: mb.name,
                              byName: mb.byName,
                              photo: mb.previewImage?.baseUrl
                                ? `${mb.previewImage.baseUrl}${mb.previewImage.key}`
                                : batch.photo,
                              language: mb.language,
                              exam: mb.exam?.[0] || batch.exam,
                            });
                          }
                        }}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--card-border)] bg-[var(--bg-secondary)] p-5 text-left hover:border-[var(--primary-color)] transition"
                      >
                        <div className="min-w-0">
                          <h4 className="font-['Sora'] text-sm sm:text-base font-bold text-[var(--text-primary)] truncate">
                            {mb.name}
                          </h4>
                          <p className="mt-0.5 text-xs sm:text-sm text-[var(--text-secondary)] truncate">
                            Tap to open batch subjects
                          </p>
                        </div>
                        <ExternalLink className="h-5 w-5 shrink-0 text-indigo-400" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {subjects.length === 0 && mahapackBatches.length === 0 && (
                <div className="rounded-2xl border border-dashed border-[var(--card-border)] p-12 text-center text-sm text-[var(--text-secondary)]">
                  No subjects found for this batch yet.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Context-Aware Study AI Slide-Over Drawer */}
      {showAiDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
          <div className="h-full w-full max-w-lg border-l border-[var(--card-border)] shadow-2xl">
            <StudyAiPanel
              variant="drawer"
              scopeKey={`batch:${batch.batch_id}`}
              context={{
                batchName: batch.name,
                subjectName: selectedSubject?.subject,
                topicName: selectedTopic?.name,
              }}
              onClose={() => setShowAiDrawer(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
