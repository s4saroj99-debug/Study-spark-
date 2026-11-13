import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  Share2,
  Calendar,
  BookOpen,
  GraduationCap,
  Heart,
  FileText,
  Clock,
  CheckCircle2,
  ExternalLink,
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
} from 'lucide-react';
import {
  AdventureState,
  BatchItem,
  BatchSubject,
  BatchTopic,
  BatchVideoItem,
  BatchNoteItem,
} from '../types';
import {
  fetchBatchDetails,
  fetchSubjectTopics,
  fetchTopicContents,
} from '../services/batchService';
import { getAdventureMetrics, isLectureCompleted } from '../services/adventureService';

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
  const [activeTopTab, setActiveTopTab] = useState<'subjects' | 'announcements'>('subjects');

  // Step 1: Batch details & Subjects
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<BatchSubject[]>([]);
  const [mahapackBatches, setMahapackBatches] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);

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

  const [copied, setCopied] = useState(false);

  // Load batch details when batch changes
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
  }, [batch]);

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
      <div className="space-y-2.5">
        {list.map((noteItem) =>
          (noteItem.homeworkIds || []).map((hw) =>
            (hw.attachmentIds || []).map((att) => {
              const cleanBase = (att.baseUrl || '').replace('https://cors.testfile.eu.org/', 'https://');
              const directUrl = att.key && cleanBase ? `${cleanBase}${att.key}` : '';
              return (
                <div
                  key={`${hw._id}-${att._id}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--card-border)] bg-[var(--bg-secondary)] p-3.5"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pink-500/10 text-pink-400">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h5 className="font-['Sora'] text-xs sm:text-sm font-bold text-[var(--text-primary)] truncate">
                        {att.name || hw.topic || noteItem.topic || 'Study Notes PDF'}
                      </h5>
                      <p className="text-[11px] text-[var(--text-secondary)] truncate">
                        {hw.topic || 'PDF Attachment'}
                      </p>
                    </div>
                  </div>
                  {directUrl ? (
                    <a
                      href={directUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex shrink-0 items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-500 transition"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Open PDF</span>
                    </a>
                  ) : (
                    <span className="shrink-0 rounded-xl border border-[var(--card-border)] bg-[var(--bg-tertiary)] px-3 py-2 text-[11px] font-semibold text-[var(--text-secondary)]">
                      Key Protected
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
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-xs text-[var(--text-secondary)]">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--primary-color)]" />
          <span>Loading video lectures...</span>
        </div>
      );
    }
    if (contentsError) {
      return (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-center text-xs text-red-400">
          {contentsError}
        </div>
      );
    }
    if (list.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-[var(--card-border)] p-8 text-center text-xs text-[var(--text-secondary)]">
          No videos found in this section. Check the Notes PDF tab for study materials!
        </div>
      );
    }
    return (
      <div className="space-y-2.5">
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
              className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-[var(--card-border)] bg-[var(--bg-secondary)] p-3 cursor-pointer transition hover:border-[var(--primary-color)]/60 hover:bg-[var(--bg-tertiary)]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-xl bg-slate-900">
                  {thumb ? (
                    <img src={thumb} alt={vid.topic} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-indigo-950">
                      <Video className="h-6 w-6 text-indigo-400" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/20 transition">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary-color)] text-white shadow-md">
                      <Play className="h-3.5 w-3.5 fill-white ml-0.5" />
                    </div>
                  </div>
                  {dur && (
                    <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                      {dur}
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h4 className="font-['Sora'] text-xs sm:text-sm font-bold text-[var(--text-primary)] line-clamp-2 group-hover:text-[var(--primary-color)] transition">
                    {title}
                  </h4>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                    {dateStr && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {dateStr}
                      </span>
                    )}
                    {dur && (
                      <span className="flex items-center gap-1 font-mono tabular-nums">
                        <Clock className="h-3 w-3 text-indigo-400" />
                        {dur}
                      </span>
                    )}
                    <span aria-hidden="true">·</span>
                    <span>{vid.urlType === 'youtube' ? 'YouTube' : 'HD Stream'}</span>
                    {isCleared && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold text-emerald-400">Cleared (+50 XP)</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
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
                  className={`flex items-center justify-center gap-1 rounded-xl px-3 py-2 text-xs font-bold transition whitespace-nowrap ${
                    isCleared
                      ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                      : 'border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                  title={isCleared ? 'Stage cleared' : 'Mark lecture complete (+50 XP)'}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{isCleared ? 'Cleared' : 'Complete'}</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerPlayVideo(vid, isDpp);
                  }}
                  className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[var(--primary-color)] px-4 py-2 text-xs font-bold text-white shadow-sm hover:opacity-90 active:scale-95 transition"
                >
                  <Play className="h-3.5 w-3.5 fill-white" />
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-4 backdrop-blur-md overflow-y-auto">
      <div className="relative my-auto flex h-[92vh] max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-2xl">
        {/* Header Image & Backdrop */}
        <div className="relative h-32 sm:h-40 shrink-0 w-full overflow-hidden bg-slate-900">
          {batch.photo ? (
            <img src={batch.photo} alt={batch.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-r from-indigo-900 via-purple-900 to-slate-900">
              <GraduationCap className="h-14 w-14 text-indigo-400 opacity-60" />
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-[var(--card-bg)] via-[var(--card-bg)]/50 to-black/60" />

          {/* Top Controls */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
            <span className="rounded-lg bg-black/60 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-md border border-white/10 truncate">
              {batch.exam || 'All Exams'} · Class {batch.class || 'All'}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => onToggleEnroll(batch.batch_id)}
                className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold backdrop-blur-md transition whitespace-nowrap ${
                  isEnrolled
                    ? 'bg-emerald-600 text-white'
                    : 'bg-black/55 text-white hover:bg-black/75'
                }`}
                title={isEnrolled ? 'Remove from My Batches' : 'Add to My Batches'}
              >
                {isEnrolled ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                <span>{isEnrolled ? 'In My Batches' : 'Add to My Batch'}</span>
              </button>
              <button
                onClick={() => onToggleFavorite(batch.batch_id)}
                className={`flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-md transition ${
                  isFavorite ? 'bg-pink-600 text-white' : 'bg-black/50 text-white hover:text-pink-400'
                }`}
                title={isFavorite ? 'Remove Favorite' : 'Add to Favorites'}
              >
                <Heart className={`h-4 w-4 ${isFavorite ? 'fill-white' : ''}`} />
              </button>
              <button
                onClick={handleShare}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md hover:bg-black/70 transition"
                title="Share Batch Link"
              >
                <Share2 className="h-4 w-4" />
              </button>
              <button
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md hover:bg-black/70 transition"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="absolute bottom-3 left-4 right-4">
            <h2 className="font-['Sora'] text-base sm:text-xl font-extrabold text-white drop-shadow-md line-clamp-1">
              {batch.name}
            </h2>
            {batch.byName && (
              <p className="text-xs text-slate-200 drop-shadow line-clamp-1">{batch.byName}</p>
            )}
          </div>
        </div>

        {copied && (
          <div className="absolute top-14 right-4 z-20 flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-lg">
            <CheckCircle2 className="h-4 w-4" />
            <span>Batch link copied!</span>
          </div>
        )}

        {/* Breadcrumb / Navigation Bar */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--card-border)] bg-[var(--bg-secondary)] px-4 py-2.5 text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => {
                setSelectedSubject(null);
                setSelectedTopic(null);
                setActiveTopTab('subjects');
              }}
              className={`font-bold whitespace-nowrap transition ${
                !selectedSubject
                  ? 'text-[var(--primary-color)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Subjects
            </button>

            {selectedSubject && (
              <>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--text-secondary)]" />
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
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--text-secondary)]" />
                <span className="font-bold text-[var(--primary-color)] truncate max-w-[200px]">
                  {selectedTopic.name}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {(selectedSubject || selectedTopic) && (
              <button
                onClick={() => {
                  if (selectedTopic) {
                    setSelectedTopic(null);
                  } else if (selectedSubject) {
                    setSelectedSubject(null);
                  }
                }}
                className="flex items-center gap-1 rounded-lg border border-[var(--card-border)] bg-[var(--bg-tertiary)] px-2.5 py-1 font-bold text-[var(--text-primary)] hover:border-[var(--primary-color)] transition"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back</span>
              </button>
            )}

            {!selectedSubject && (
              <button
                onClick={() =>
                  setActiveTopTab(activeTopTab === 'subjects' ? 'announcements' : 'subjects')
                }
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 font-bold transition ${
                  activeTopTab === 'announcements'
                    ? 'bg-[var(--primary-color)] text-white'
                    : 'border border-[var(--card-border)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Bell className="h-3.5 w-3.5" />
                <span>Notices ({announcements.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Batch Adventure Tracker Bar (Inside Batch) */}
        <div className="shrink-0 border-b border-[var(--card-border)] bg-[var(--bg-primary)] px-4 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <Compass className="h-4 w-4 text-[var(--primary-color)] shrink-0" />
              <span className="font-['Sora'] font-bold text-[var(--text-primary)]">
                Batch Adventure
              </span>
              <span aria-hidden="true" className="text-[var(--text-secondary)]">·</span>
              <span className="text-[var(--text-secondary)] font-semibold">
                Lv.{batchMetrics.level} {batchMetrics.rank}
              </span>
            </div>
            <div className="flex items-center gap-3 font-mono tabular-nums text-[11px] text-[var(--text-secondary)]">
              <span className="flex items-center gap-1 text-emerald-400 font-bold">
                <Trophy className="h-3.5 w-3.5" />
                {batchMetrics.xp} XP
              </span>
              <span aria-hidden="true">·</span>
              <span>{batchMetrics.completedCount} Cleared</span>
              <span aria-hidden="true">·</span>
              <span className="flex items-center gap-1 text-amber-400 font-bold">
                <Flame className="h-3.5 w-3.5" />
                {batchMetrics.currentStreak}d Streak
              </span>
            </div>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
            <div
              className="h-full rounded-full bg-[var(--primary-color)] transition-all duration-300"
              style={{ width: `${batchMetrics.levelProgressPercent}%` }}
            />
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {loadingDetails ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-xs text-[var(--text-secondary)]">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--primary-color)]" />
              <span>Loading batch subjects & syllabus...</span>
            </div>
          ) : detailsError && subjects.length === 0 && mahapackBatches.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-center">
              <AlertCircle className="h-8 w-8 text-red-400 mb-2" />
              <p className="text-xs text-red-300 max-w-md">{detailsError}</p>
            </div>
          ) : activeTopTab === 'announcements' && !selectedSubject ? (
            /* Announcements View */
            <div className="space-y-3">
              {announcements.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--card-border)] p-10 text-center text-xs text-[var(--text-secondary)]">
                  No announcements posted for this batch yet.
                </div>
              ) : (
                announcements.map((ann, idx) => (
                  <div
                    key={ann._id || idx}
                    className="rounded-2xl border border-[var(--card-border)] bg-[var(--bg-secondary)] p-4 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                      <span className="font-bold text-indigo-400">Batch Notice</span>
                      {ann.createdAt && <span>{new Date(ann.createdAt).toLocaleDateString()}</span>}
                    </div>
                    <p className="text-xs sm:text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
                      {ann.announcement || ann.title || 'Notice update'}
                    </p>
                  </div>
                ))
              )}
            </div>
          ) : selectedTopic ? (
            /* STEP 3: Chapter Contents (Lectures, Notes, DPPs) */
            <div className="space-y-4">
              {/* Sub-tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                {[
                  { id: 'videos' as const, label: 'Lectures', count: selectedTopic.videos },
                  { id: 'notes' as const, label: 'Class Notes PDF', count: selectedTopic.notes },
                  { id: 'DppNotes' as const, label: 'DPP PDFs' },
                  { id: 'DppVideos' as const, label: 'DPP Videos', count: selectedTopic.dppVideos },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => handleSwitchContentTab(tab.id)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                      contentTab === tab.id
                        ? 'bg-[var(--primary-color)] text-white shadow-sm'
                        : 'border border-[var(--card-border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <span>{tab.label}</span>
                    {tab.count !== undefined && (
                      <span className="rounded bg-black/20 px-1.5 py-0.2 text-[10px]">
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
            <div className="space-y-3">
              {loadingTopics && topics.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-xs text-[var(--text-secondary)]">
                  <Loader2 className="h-7 w-7 animate-spin text-[var(--primary-color)]" />
                  <span>Loading chapters for {selectedSubject.subject}...</span>
                </div>
              ) : topics.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--card-border)] p-10 text-center text-xs text-[var(--text-secondary)]">
                  No chapters uploaded under {selectedSubject.subject} yet.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {topics.map((topic, idx) => {
                      const clearedCount = batchMetrics.completedTopicCounts[topic._id] || 0;
                      const totalVids = topic.videos || 0;
                      const pct = totalVids > 0 ? Math.min(100, Math.round((clearedCount / totalVids) * 100)) : 0;
                      const stageDone = totalVids > 0 && clearedCount >= totalVids;
                      return (
                        <button
                          key={topic._id}
                          onClick={() => handleSelectTopic(topic)}
                          className="group flex flex-col gap-2.5 rounded-2xl border border-[var(--card-border)] bg-[var(--bg-secondary)] p-4 text-left transition hover:border-[var(--primary-color)]/60 hover:bg-[var(--bg-tertiary)]"
                        >
                          <div className="flex items-center justify-between gap-3 w-full">
                            <div className="flex items-start gap-3 min-w-0">
                              <span
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-mono tabular-nums text-xs font-bold ${
                                  stageDone
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : 'bg-indigo-500/15 text-indigo-400'
                                }`}
                              >
                                {stageDone ? <CheckCircle2 className="h-4 w-4" /> : String(idx + 1).padStart(2, '0')}
                              </span>
                              <div className="min-w-0">
                                <div className="text-[11px] font-semibold text-[var(--text-secondary)] font-mono tabular-nums">
                                  Stage {String(idx + 1).padStart(2, '0')}
                                  {clearedCount > 0 ? ` · ${clearedCount}/${totalVids || clearedCount} cleared` : ''}
                                </div>
                                <h4 className="font-['Sora'] text-xs sm:text-sm font-bold text-[var(--text-primary)] line-clamp-2 group-hover:text-[var(--primary-color)] transition">
                                  {topic.name}
                                </h4>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-secondary)] font-mono tabular-nums">
                                  <span>{totalVids} Videos</span>
                                  <span aria-hidden="true">·</span>
                                  <span>{topic.notes || 0} Notes</span>
                                </div>
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-secondary)] group-hover:translate-x-0.5 group-hover:text-[var(--primary-color)] transition" />
                          </div>
                          {totalVids > 0 && (
                            <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
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
                        className="flex items-center gap-2 rounded-xl border border-[var(--card-border)] bg-[var(--bg-secondary)] px-4 py-2 text-xs font-bold text-[var(--text-primary)] hover:border-[var(--primary-color)]"
                      >
                        {loadingTopics && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        <span>Load More Chapters</span>
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            /* STEP 1: Subjects Grid (or Mahapack Batches) */
            <div className="space-y-5">
              {subjects.length > 0 && (
                <div>
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                    Select Subject ({subjects.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {subjects.map((subj) => {
                      const imgUrl =
                        subj.imageId?.baseUrl && subj.imageId?.key
                          ? `${subj.imageId.baseUrl}${subj.imageId.key}`
                          : null;
                      return (
                        <button
                          key={subj._id}
                          onClick={() => handleSelectSubject(subj)}
                          className="group flex items-center gap-3.5 rounded-2xl border border-[var(--card-border)] bg-[var(--bg-secondary)] p-4 text-left transition hover:-translate-y-0.5 hover:border-[var(--primary-color)]/60 hover:shadow-lg"
                        >
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-indigo-500/10 text-indigo-400">
                            {imgUrl ? (
                              <img
                                src={imgUrl}
                                alt={subj.subject}
                                className="h-full w-full object-contain p-1"
                              />
                            ) : (
                              <BookOpen className="h-6 w-6" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-['Sora'] text-sm font-bold text-[var(--text-primary)] truncate group-hover:text-[var(--primary-color)] transition">
                              {subj.subject}
                            </h4>
                            <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                              {subj.tagCount
                                ? `${subj.tagCount} Chapters`
                                : subj.lectureCount
                                ? `${subj.lectureCount} Lectures`
                                : 'Tap to browse chapters'}
                            </p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-[var(--text-secondary)] group-hover:text-[var(--primary-color)] transition" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {mahapackBatches.length > 0 && (
                <div>
                  <h3 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                    <Layers className="h-4 w-4 text-purple-400" />
                    <span>Included Mahapack Batches ({mahapackBatches.length})</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                        className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--card-border)] bg-[var(--bg-secondary)] p-3.5 text-left hover:border-[var(--primary-color)] transition"
                      >
                        <div className="min-w-0">
                          <h4 className="font-['Sora'] text-xs sm:text-sm font-bold text-[var(--text-primary)] truncate">
                            {mb.name}
                          </h4>
                          <p className="text-[11px] text-[var(--text-secondary)] truncate">
                            Tap to open batch subjects
                          </p>
                        </div>
                        <ExternalLink className="h-4 w-4 shrink-0 text-indigo-400" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {subjects.length === 0 && mahapackBatches.length === 0 && (
                <div className="rounded-2xl border border-dashed border-[var(--card-border)] p-10 text-center text-xs text-[var(--text-secondary)]">
                  No subjects found for this batch yet.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
