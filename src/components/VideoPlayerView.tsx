import React, { useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';
import {
  ArrowLeft,
  Headphones,
  Maximize2,
  Minimize2,
  Moon,
  RotateCcw,
  RotateCw,
  Gauge,
  FileText,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Loader2,
  AlertTriangle,
  SlidersHorizontal,
  PictureInPicture2,
  Download,
  X,
  CheckCircle2,
} from 'lucide-react';
import { ResolvedStream } from '../types';
import { resolveVideoStream, saveWatchHistory } from '../services/batchService';
import {
  isLectureCompleted,
  markLectureCompleted,
  recordStudyActivity,
  toggleLectureCompleted,
} from '../services/adventureService';

export interface ActiveLectureInput {
  batchId: string;
  batchName?: string;
  subjectId: string;
  subjectName?: string;
  topicId: string;
  topicName?: string;
  videoId: string;
  findKey?: string;
  videoDetailsId?: string;
  typeId?: string;
  title: string;
  videoImg?: string;
  videoType?: string;
  playType?: string;
  rawVideoUrl?: string;
  resumeSeconds?: number;
}

interface VideoPlayerViewProps {
  lecture: ActiveLectureInput;
  onBack: () => void;
  onAdventureUpdate?: () => void;
}

export const VideoPlayerView: React.FC<VideoPlayerViewProps> = ({
  lecture,
  onBack,
  onAdventureUpdate,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Stream resolution state
  const [resolving, setResolving] = useState(true);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [streamData, setStreamData] = useState<ResolvedStream | null>(null);

  // Video playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isAudioOnly, setIsAudioOnly] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Quality levels
  const [qualityLevels, setQualityLevels] = useState<Array<{ index: number; label: string }>>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1); // -1 = Auto

  // Popups
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showSleepMenu, setShowSleepMenu] = useState(false);
  const [showNotesDrawer, setShowNotesDrawer] = useState(false);
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);
  const [completed, setCompleted] = useState<boolean>(() =>
    isLectureCompleted(lecture.batchId, lecture.videoId)
  );

  const speedOptions = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];

  // 1. Resolve real stream on mount & record daily streak activity
  const loadStream = async () => {
    setResolving(true);
    setResolveError(null);
    try {
      const data = await resolveVideoStream({
        batchId: lecture.batchId,
        subjectId: lecture.subjectId,
        topicId: lecture.topicId,
        videoId: lecture.videoId,
        findKey: lecture.findKey,
        videoDetailsId: lecture.videoDetailsId,
        typeId: lecture.typeId,
        videoName: lecture.title,
        videoImg: lecture.videoImg,
        videoType: lecture.videoType || 'new',
        playType: lecture.playType || 'Lecture',
        videoUrl: lecture.rawVideoUrl,
      });
      setStreamData(data);
    } catch (err: any) {
      setResolveError(err?.message || 'Unable to load video stream.');
    } finally {
      setResolving(false);
    }
  };

  useEffect(() => {
    recordStudyActivity();
    setCompleted(isLectureCompleted(lecture.batchId, lecture.videoId));
    onAdventureUpdate?.();
    loadStream();
  }, [lecture.batchId, lecture.subjectId, lecture.topicId, lecture.videoId]);

  // 2. Attach HLS.js or native <video> source
  useEffect(() => {
    if (!streamData || streamData.isYoutube || !streamData.streamUrl) return;
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const src = streamData.streamUrl;

    if (streamData.isDirectMp4) {
      videoEl.src = src;
      videoEl.play().catch(() => {});
      return;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 60,
      });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(videoEl);

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        const levels = (data.levels || []).map((lvl, idx) => ({
          index: idx,
          label: lvl.height ? `${lvl.height}p` : `Level ${idx + 1}`,
        }));
        setQualityLevels(levels);
        setCurrentLevel(-1);
        if (lecture.resumeSeconds && lecture.resumeSeconds > 5) {
          videoEl.currentTime = lecture.resumeSeconds;
        }
        videoEl.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            setResolveError('Stream playback encountered an error. Tap Retry.');
          }
        }
      });
    } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari / iOS native HLS
      videoEl.src = src;
      videoEl.addEventListener('loadedmetadata', () => {
        if (lecture.resumeSeconds && lecture.resumeSeconds > 5) {
          videoEl.currentTime = lecture.resumeSeconds;
        }
        videoEl.play().catch(() => {});
      });
    } else {
      setResolveError('HLS video playback is not supported in this browser.');
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamData]);

  // 3. Persist watch history periodically
  useEffect(() => {
    const historyId = `${lecture.batchId}-${lecture.videoId}`;
    const saveNow = () => {
      const vid = videoRef.current;
      const cur = vid ? Math.floor(vid.currentTime) : Math.floor(currentTime);
      const dur = vid && vid.duration ? Math.floor(vid.duration) : Math.floor(duration) || 3600;
      saveWatchHistory({
        id: historyId,
        batchId: lecture.batchId,
        batchName: lecture.batchName,
        subjectId: lecture.subjectId,
        topicId: lecture.topicId,
        videoId: lecture.videoId,
        videoType: lecture.videoType,
        playType: lecture.playType,
        title: lecture.title,
        videoUrl: lecture.rawVideoUrl,
        duration: dur,
        progressSeconds: cur,
        progressPercent: dur > 0 ? Math.round((cur / dur) * 100) : 0,
      });
    };

    saveNow();
    const timer = setInterval(saveNow, 5000);
    return () => {
      clearInterval(timer);
      saveNow();
    };
  }, [lecture, duration]);

  // 4. Sleep timer
  useEffect(() => {
    if (sleepTimerMinutes === null) return;
    const timer = setTimeout(() => {
      videoRef.current?.pause();
      setSleepTimerMinutes(null);
    }, sleepTimerMinutes * 60 * 1000);
    return () => clearTimeout(timer);
  }, [sleepTimerMinutes]);

  // Sync speed & mute
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  const togglePlayPause = () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) {
      vid.play().catch(() => {});
    } else {
      vid.pause();
    }
  };

  const seekBy = (delta: number) => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.currentTime = Math.max(0, Math.min(vid.duration || 0, vid.currentTime + delta));
  };

  const handleQualityChange = (lvlIndex: number) => {
    setCurrentLevel(lvlIndex);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = lvlIndex;
    }
    setShowQualityMenu(false);
  };

  const togglePiP = async () => {
    const vid = videoRef.current;
    if (!vid) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await vid.requestPictureInPicture();
      }
    } catch {
      // ignore if unsupported
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const formatTime = (secs: number) => {
    if (!secs || !isFinite(secs)) return '0:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const attachments = streamData?.attachments || [];

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col bg-[#050508] text-white overflow-hidden"
    >
      {/* Top Bar */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-black/85 px-3 sm:px-6 backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 active:scale-95 transition"
            title="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex flex-col min-w-0">
            <h2 className="font-['Sora'] text-xs sm:text-sm font-bold text-white truncate">
              {lecture.title}
            </h2>
            <span className="text-[10px] text-slate-400 truncate">
              {lecture.batchName || 'VidCloud HD Stream'}
              {lecture.subjectName ? ` • ${lecture.subjectName}` : ''}
            </span>
          </div>
        </div>

        {/* Top Right Tools */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={() => {
              const nextState = toggleLectureCompleted({
                batchId: lecture.batchId,
                subjectId: lecture.subjectId,
                topicId: lecture.topicId,
                videoId: lecture.videoId,
                title: lecture.title,
              });
              setCompleted(isLectureCompleted(lecture.batchId, lecture.videoId, nextState));
              onAdventureUpdate?.();
            }}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition whitespace-nowrap ${
              completed
                ? 'bg-emerald-600 text-white'
                : 'bg-white/10 text-slate-300 hover:bg-white/20'
            }`}
            title={completed ? 'Stage Completed (+50 XP)' : 'Mark Lecture Complete (+50 XP)'}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{completed ? 'Cleared (+50 XP)' : 'Mark Complete'}</span>
          </button>

          {!streamData?.isYoutube && (
            <button
              onClick={() => setIsAudioOnly(!isAudioOnly)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                isAudioOnly
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'bg-white/10 text-slate-300 hover:bg-white/20'
              }`}
              title="Audio-Only Mode (Saves Battery & Data)"
            >
              <Headphones className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Audio Mode</span>
            </button>
          )}

          {/* Sleep Timer */}
          <div className="relative">
            <button
              onClick={() => setShowSleepMenu(!showSleepMenu)}
              className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
                sleepTimerMinutes
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/10 text-slate-300 hover:bg-white/20'
              }`}
              title="Sleep Timer"
            >
              <Moon className="h-4 w-4" />
            </button>
            {showSleepMenu && (
              <div className="absolute right-0 top-11 z-50 w-40 rounded-xl border border-white/15 bg-slate-900/95 p-2 shadow-2xl backdrop-blur-lg text-xs">
                <div className="px-2 py-1 font-bold text-slate-400">Sleep Timer</div>
                {[15, 30, 45, 60].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => {
                      setSleepTimerMinutes(mins);
                      setShowSleepMenu(false);
                    }}
                    className={`w-full rounded-lg px-2.5 py-1.5 text-left font-medium transition ${
                      sleepTimerMinutes === mins
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    {mins} minutes
                  </button>
                ))}
                {sleepTimerMinutes !== null && (
                  <button
                    onClick={() => {
                      setSleepTimerMinutes(null);
                      setShowSleepMenu(false);
                    }}
                    className="mt-1 w-full rounded-lg px-2.5 py-1.5 text-left text-red-400 hover:bg-red-500/10"
                  >
                    Turn off timer
                  </button>
                )}
              </div>
            )}
          </div>

          {!streamData?.isYoutube && (
            <button
              onClick={togglePiP}
              className="hidden sm:flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-slate-300 hover:bg-white/20 transition"
              title="Picture in Picture"
            >
              <PictureInPicture2 className="h-4 w-4" />
            </button>
          )}

          <button
            onClick={toggleFullscreen}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-slate-300 hover:bg-white/20 transition"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="relative flex flex-1 items-center justify-center bg-black overflow-hidden">
        {resolving ? (
          <div className="flex flex-col items-center gap-3 text-center p-6">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
            <p className="font-['Sora'] text-sm font-bold text-white">
              Loading secure lecture stream...
            </p>
            <p className="text-xs text-slate-400">
              Decrypting HD video & preparing adaptive playback
            </p>
          </div>
        ) : resolveError ? (
          <div className="flex flex-col items-center gap-3 text-center p-6 max-w-md">
            <AlertTriangle className="h-11 w-11 text-amber-500" />
            <h3 className="font-['Sora'] text-base font-bold text-white">
              Could Not Play Video
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">{resolveError}</p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={loadStream}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 transition"
              >
                Retry Stream
              </button>
              <button
                onClick={onBack}
                className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20 transition"
              >
                Go Back
              </button>
            </div>
          </div>
        ) : streamData?.isYoutube ? (
          <iframe
            src={streamData.youtubeEmbedUrl}
            title={lecture.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="h-full w-full border-none"
          />
        ) : (
          <>
            {/* Real HTML5 Video Element */}
            <video
              ref={videoRef}
              playsInline
              onClick={togglePlayPause}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onWaiting={() => setIsBuffering(true)}
              onPlaying={() => setIsBuffering(false)}
              onCanPlay={() => setIsBuffering(false)}
              onTimeUpdate={(e) => {
                const cur = e.currentTarget.currentTime;
                const dur = e.currentTarget.duration || 0;
                setCurrentTime(cur);
                if (dur > 0 && cur / dur >= 0.8 && !completed) {
                  markLectureCompleted({
                    batchId: lecture.batchId,
                    subjectId: lecture.subjectId,
                    topicId: lecture.topicId,
                    videoId: lecture.videoId,
                    title: lecture.title,
                  });
                  setCompleted(true);
                  onAdventureUpdate?.();
                }
              }}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
              className={`h-full w-full object-contain cursor-pointer ${
                isAudioOnly ? 'opacity-0 pointer-events-none absolute inset-0' : ''
              }`}
            />

            {/* Buffering Spinner */}
            {isBuffering && !isAudioOnly && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30">
                <Loader2 className="h-10 w-10 animate-spin text-indigo-400" />
              </div>
            )}

            {/* Audio-Only Overlay */}
            {isAudioOnly && (
              <div className="flex flex-col items-center justify-center p-6 text-center z-10">
                <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-tr from-emerald-600 to-indigo-600 shadow-2xl shadow-emerald-500/20">
                  <Headphones className="h-12 w-12 text-white animate-pulse" />
                </div>
                <h3 className="mt-6 font-['Sora'] text-base sm:text-lg font-bold text-white max-w-md">
                  {lecture.title}
                </h3>
                <p className="mt-1 text-xs text-emerald-400 font-semibold">
                  Audio-Only Mode Active • Video Stream Paused Visually
                </p>
                <button
                  onClick={() => setIsAudioOnly(false)}
                  className="mt-5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 transition"
                >
                  Turn Video Back On
                </button>
              </div>
            )}
          </>
        )}

        {/* Attachments / Notes Drawer */}
        {showNotesDrawer && (
          <div className="absolute right-0 top-0 bottom-0 z-30 w-full max-w-sm border-l border-white/15 bg-slate-950/95 p-4 backdrop-blur-xl flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-pink-400" />
                <h4 className="font-['Sora'] text-sm font-bold text-white">
                  Lecture Notes & Attachments
                </h4>
              </div>
              <button
                onClick={() => setShowNotesDrawer(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 flex-1 overflow-y-auto space-y-2">
              {attachments.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">
                  No PDF attachments linked directly to this lecture. Check the Chapter Notes tab!
                </p>
              ) : (
                attachments.map((att, i) => {
                  const cleanBase = (att.baseUrl || '').replace('https://cors.testfile.eu.org/', 'https://');
                  const href =
                    att.url || (cleanBase && att.key ? `${cleanBase}${att.key}` : '');
                  if (!href) {
                    return (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 text-xs opacity-70"
                      >
                        <span className="font-semibold text-white truncate pr-2">
                          {att.name || `Attachment ${i + 1}`}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">Protected</span>
                      </div>
                    );
                  }
                  return (
                    <a
                      key={i}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 text-xs hover:border-indigo-500/50 transition"
                    >
                      <span className="font-semibold text-white truncate pr-2">
                        {att.name || `Attachment ${i + 1}`}
                      </span>
                      <Download className="h-4 w-4 shrink-0 text-indigo-400" />
                    </a>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls Deck (Hidden for YouTube embed since YouTube has native controls) */}
      {!streamData?.isYoutube && !resolving && !resolveError && (
        <div className="shrink-0 border-t border-white/10 bg-black/95 p-3 sm:px-6">
          {/* Seek Bar */}
          <div className="flex items-center gap-3 mb-2">
            <span className="font-mono text-xs text-slate-300">{formatTime(currentTime)}</span>
            <div
              onClick={(e) => {
                const vid = videoRef.current;
                if (!vid || !duration) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                vid.currentTime = ratio * duration;
              }}
              className="group relative flex-1 h-2 cursor-pointer rounded-full bg-white/20 transition-all hover:h-3"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 -ml-1.5 rounded-full bg-white opacity-0 shadow-md transition group-hover:opacity-100"
                style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>
            <span className="font-mono text-xs text-slate-400">{formatTime(duration)}</span>
          </div>

          {/* Control Buttons Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={togglePlayPause}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30 hover:bg-indigo-500 transition active:scale-95"
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
              </button>

              <button
                onClick={() => seekBy(-10)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 active:scale-95 transition"
                title="Rewind 10s"
              >
                <RotateCcw className="h-4 w-4" />
              </button>

              <button
                onClick={() => seekBy(10)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 active:scale-95 transition"
                title="Forward 10s"
              >
                <RotateCw className="h-4 w-4" />
              </button>

              <button
                onClick={() => setIsMuted(!isMuted)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 transition"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* Quality Picker */}
              {qualityLevels.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowQualityMenu(!showQualityMenu);
                      setShowSpeedMenu(false);
                    }}
                    className="flex items-center gap-1 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20 transition"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5 text-emerald-400" />
                    <span>
                      {currentLevel === -1
                        ? 'Auto'
                        : qualityLevels.find((q) => q.index === currentLevel)?.label || 'Auto'}
                    </span>
                  </button>
                  {showQualityMenu && (
                    <div className="absolute right-0 bottom-11 z-50 w-32 rounded-xl border border-white/15 bg-slate-900/95 p-1.5 shadow-2xl backdrop-blur-lg">
                      <button
                        onClick={() => handleQualityChange(-1)}
                        className={`w-full rounded-lg px-3 py-1.5 text-left text-xs font-semibold transition ${
                          currentLevel === -1
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-200 hover:bg-white/10'
                        }`}
                      >
                        Auto
                      </button>
                      {qualityLevels.map((lvl) => (
                        <button
                          key={lvl.index}
                          onClick={() => handleQualityChange(lvl.index)}
                          className={`w-full rounded-lg px-3 py-1.5 text-left text-xs font-semibold transition ${
                            currentLevel === lvl.index
                              ? 'bg-indigo-600 text-white'
                              : 'text-slate-200 hover:bg-white/10'
                          }`}
                        >
                          {lvl.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Speed Picker */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowSpeedMenu(!showSpeedMenu);
                    setShowQualityMenu(false);
                  }}
                  className="flex items-center gap-1 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20 transition"
                >
                  <Gauge className="h-3.5 w-3.5 text-indigo-400" />
                  <span>{playbackSpeed}x</span>
                </button>
                {showSpeedMenu && (
                  <div className="absolute right-0 bottom-11 z-50 w-28 rounded-xl border border-white/15 bg-slate-900/95 p-1.5 shadow-2xl backdrop-blur-lg max-h-48 overflow-y-auto">
                    {speedOptions.map((spd) => (
                      <button
                        key={spd}
                        onClick={() => {
                          setPlaybackSpeed(spd);
                          setShowSpeedMenu(false);
                        }}
                        className={`w-full rounded-lg px-3 py-1.5 text-left text-xs font-semibold transition ${
                          playbackSpeed === spd
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-200 hover:bg-white/10'
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes Button */}
              <button
                onClick={() => setShowNotesDrawer(!showNotesDrawer)}
                className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-indigo-300 hover:bg-white/20 transition"
              >
                <FileText className="h-3.5 w-3.5" />
                <span className="hidden xs:inline">Notes ({attachments.length})</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
