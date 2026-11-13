import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Sparkles,
  Smartphone,
  Expand,
} from 'lucide-react';
import { ResolvedStream } from '../types';
import {
  buildPdfProxyUrl,
  downloadPdfFile,
  resolveAttachmentUrl,
  resolveVideoStream,
  saveWatchHistory,
} from '../services/batchService';
import {
  isLectureCompleted,
  markLectureCompleted,
  recordStudyActivity,
  toggleLectureCompleted,
} from '../services/adventureService';
import { StudyAiPanel } from './StudyAiPanel';

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
  const hideTimerRef = useRef<number | null>(null);

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

  // Fullscreen, Landscape & Scaling state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [forceCssLandscape, setForceCssLandscape] = useState(false);
  const [isPortraitViewport, setIsPortraitViewport] = useState(() =>
    typeof window !== 'undefined' ? window.innerHeight > window.innerWidth : false
  );
  const [fillMode, setFillMode] = useState<'contain' | 'cover'>('contain');
  const [controlsVisible, setControlsVisible] = useState(true);

  // Quality levels
  const [qualityLevels, setQualityLevels] = useState<Array<{ index: number; label: string }>>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1); // -1 = Auto

  // Popups & Drawers
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showSleepMenu, setShowSleepMenu] = useState(false);
  const [showNotesDrawer, setShowNotesDrawer] = useState(false);
  const [showAiDrawer, setShowAiDrawer] = useState(false);
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);
  const [downloadingAttIdx, setDownloadingAttIdx] = useState<number | null>(null);
  const [downloadedAttIdx, setDownloadedAttIdx] = useState<number | null>(null);
  const [completed, setCompleted] = useState<boolean>(() =>
    isLectureCompleted(lecture.batchId, lecture.videoId)
  );

  const speedOptions = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];

  // Auto-detect viewport portrait/landscape so CSS rotate never double-rotates
  useEffect(() => {
    const updateOrientation = () => {
      setIsPortraitViewport(window.innerHeight > window.innerWidth);
    };
    const onFsChange = () => {
      const nativeFs = Boolean(
        document.fullscreenElement || (document as any).webkitFullscreenElement
      );
      if (!nativeFs) {
        // Keep fullscreen only if forced CSS landscape is manually active
        setIsFullscreen((prev) => (forceCssLandscape ? prev : false));
        try {
          (screen.orientation as any)?.unlock?.();
        } catch {
          // ignore
        }
      } else {
        setIsFullscreen(true);
      }
      updateOrientation();
    };
    window.addEventListener('resize', updateOrientation);
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      window.removeEventListener('resize', updateOrientation);
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, [forceCssLandscape]);

  // Clean up orientation lock on unmount
  useEffect(() => {
    return () => {
      try {
        (screen.orientation as any)?.unlock?.();
      } catch {
        // ignore
      }
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    };
  }, []);

  const isCssRotatedLandscape = (isFullscreen || forceCssLandscape) && isPortraitViewport;
  const isImmersiveFullscreen = isFullscreen || forceCssLandscape;

  // Auto-hide controls smoothly in immersive fullscreen while playing
  const scheduleAutoHide = useCallback(() => {
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (!isImmersiveFullscreen || !isPlaying || showSpeedMenu || showQualityMenu || showSleepMenu || showNotesDrawer || showAiDrawer) {
      setControlsVisible(true);
      return;
    }
    hideTimerRef.current = window.setTimeout(() => {
      setControlsVisible(false);
    }, 3200);
  }, [isImmersiveFullscreen, isPlaying, showSpeedMenu, showQualityMenu, showSleepMenu, showNotesDrawer, showAiDrawer]);

  useEffect(() => {
    scheduleAutoHide();
    return () => {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, [scheduleAutoHide]);

  const revealControls = () => {
    setControlsVisible(true);
    scheduleAutoHide();
  };

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
    revealControls();
  };

  const seekBy = (delta: number) => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.currentTime = Math.max(0, Math.min(vid.duration || 0, vid.currentTime + delta));
    revealControls();
  };

  const handleQualityChange = (lvlIndex: number) => {
    setCurrentLevel(lvlIndex);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = lvlIndex;
    }
    setShowQualityMenu(false);
    revealControls();
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

  const enterLandscapeFullscreen = async () => {
    setIsFullscreen(true);
    setForceCssLandscape(true);
    setControlsVisible(true);
    const el: any = containerRef.current;
    try {
      if (el?.requestFullscreen) {
        await el.requestFullscreen();
      } else if (el?.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
      }
    } catch {
      // Native fullscreen can be blocked inside some webviews/iOS — CSS landscape fallback still works!
    }
    try {
      await (screen.orientation as any)?.lock?.('landscape');
    } catch {
      // If orientation.lock is unsupported, CSS rotate handles portrait viewports automatically
    }
  };

  const exitLandscapeFullscreen = async () => {
    setIsFullscreen(false);
    setForceCssLandscape(false);
    setFillMode('contain');
    setControlsVisible(true);
    try {
      (screen.orientation as any)?.unlock?.();
    } catch {
      // ignore
    }
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if ((document as any).webkitFullscreenElement) {
        await (document as any).webkitExitFullscreen?.();
      }
    } catch {
      // ignore
    }
  };

  const toggleFullscreen = () => {
    if (isImmersiveFullscreen) {
      exitLandscapeFullscreen();
    } else {
      enterLandscapeFullscreen();
    }
  };

  const toggleLandscapeRotate = async () => {
    if (forceCssLandscape) {
      setForceCssLandscape(false);
      setIsFullscreen(Boolean(document.fullscreenElement));
      try {
        (screen.orientation as any)?.unlock?.();
      } catch {
        // ignore
      }
    } else {
      await enterLandscapeFullscreen();
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
      onMouseMove={revealControls}
      style={
        isCssRotatedLandscape
          ? {
              width: '100dvh',
              height: '100dvw',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%) rotate(90deg)',
            }
          : undefined
      }
      className={`fixed z-50 flex flex-col bg-[#050508] text-white overflow-hidden select-none ${
        isCssRotatedLandscape ? 'origin-center' : 'inset-0 h-[100dvh] w-full'
      }`}
    >
      {/* Top Bar (Floating overlay in Fullscreen, solid top bar in normal mode) */}
      <div
        className={`${
          isImmersiveFullscreen
            ? `absolute top-0 left-0 right-0 z-20 transition-all duration-300 bg-gradient-to-b from-black/85 via-black/45 to-transparent ${
                controlsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'
              }`
            : 'relative shrink-0 border-b border-white/10 bg-black/90'
        } flex h-14 sm:h-16 items-center justify-between px-3 sm:px-6 backdrop-blur-sm`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => {
              if (isImmersiveFullscreen) {
                exitLandscapeFullscreen();
              } else {
                onBack();
              }
            }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white hover:bg-white/25 active:scale-95 transition"
            title={isImmersiveFullscreen ? 'Exit Fullscreen' : 'Back'}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex flex-col min-w-0">
            <h2 className="font-['Sora'] text-sm sm:text-base font-bold text-white truncate">
              {lecture.title}
            </h2>
            <span className="text-[11px] sm:text-xs text-slate-300 truncate">
              {lecture.batchName || 'VidCloud HD Stream'}
              {lecture.subjectName ? ` • ${lecture.subjectName}` : ''}
            </span>
          </div>
        </div>

        {/* Top Right Tools */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={() => {
              setShowAiDrawer((prev) => !prev);
              setShowNotesDrawer(false);
              revealControls();
            }}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold transition whitespace-nowrap ${
              showAiDrawer
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                : 'bg-white/15 text-indigo-200 hover:bg-white/25'
            }`}
            title="Ask Study AI about this lecture"
          >
            <Sparkles className="h-4 w-4" />
            <span className="hidden xs:inline">Ask AI</span>
          </button>

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
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition whitespace-nowrap ${
              completed
                ? 'bg-emerald-600 text-white'
                : 'bg-white/15 text-slate-200 hover:bg-white/25'
            }`}
            title={completed ? 'Stage Completed (+50 XP)' : 'Mark Lecture Complete (+50 XP)'}
          >
            <CheckCircle2 className="h-4 w-4" />
            <span className="hidden md:inline">{completed ? 'Cleared (+50 XP)' : 'Complete'}</span>
          </button>

          {!streamData?.isYoutube && (
            <button
              onClick={() => setIsAudioOnly(!isAudioOnly)}
              className={`hidden sm:flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition ${
                isAudioOnly
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'bg-white/15 text-slate-200 hover:bg-white/25'
              }`}
              title="Audio-Only Mode (Saves Battery & Data)"
            >
              <Headphones className="h-4 w-4" />
              <span className="hidden lg:inline">Audio</span>
            </button>
          )}

          {/* Sleep Timer */}
          <div className="relative hidden sm:block">
            <button
              onClick={() => setShowSleepMenu(!showSleepMenu)}
              className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
                sleepTimerMinutes
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/15 text-slate-200 hover:bg-white/25'
              }`}
              title="Sleep Timer"
            >
              <Moon className="h-4 w-4" />
            </button>
            {showSleepMenu && (
              <div className="absolute right-0 top-12 z-50 w-44 rounded-xl border border-white/15 bg-slate-900/95 p-2 shadow-2xl backdrop-blur-lg text-xs">
                <div className="px-2 py-1 font-bold text-slate-400">Sleep Timer</div>
                {[15, 30, 45, 60].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => {
                      setSleepTimerMinutes(mins);
                      setShowSleepMenu(false);
                    }}
                    className={`w-full rounded-lg px-2.5 py-2 text-left font-medium transition ${
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
                    className="mt-1 w-full rounded-lg px-2.5 py-2 text-left text-red-400 hover:bg-red-500/10"
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
              className="hidden md:flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-slate-200 hover:bg-white/25 transition"
              title="Picture in Picture"
            >
              <PictureInPicture2 className="h-4 w-4" />
            </button>
          )}

          {/* Rotate / Landscape Toggle */}
          <button
            onClick={toggleLandscapeRotate}
            className={`flex h-10 items-center gap-1.5 rounded-xl px-2.5 sm:px-3 text-xs font-bold transition ${
              forceCssLandscape
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white/15 text-white hover:bg-white/25'
            }`}
            title="Rotate Video to Landscape Fullscreen"
          >
            <Smartphone className="h-4 w-4 -rotate-90" />
            <span className="hidden lg:inline">{forceCssLandscape ? 'Landscape' : 'Rotate'}</span>
          </button>

          {/* True Edge-to-Edge Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
              isImmersiveFullscreen
                ? 'bg-indigo-600 text-white'
                : 'bg-white/15 text-white hover:bg-white/25'
            }`}
            title={isImmersiveFullscreen ? 'Exit Fullscreen' : 'Fullscreen Landscape'}
          >
            {isImmersiveFullscreen ? (
              <Minimize2 className="h-5 w-5" />
            ) : (
              <Maximize2 className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Main Viewport */}
      <div
        onClick={() => {
          if (isImmersiveFullscreen) {
            setControlsVisible((prev) => {
              const next = !prev;
              if (next) scheduleAutoHide();
              return next;
            });
          } else {
            togglePlayPause();
          }
        }}
        className="relative flex flex-1 items-center justify-center bg-black overflow-hidden"
      >
        {resolving ? (
          <div className="flex flex-col items-center gap-3 text-center p-6">
            <Loader2 className="h-12 w-12 animate-spin text-indigo-500" />
            <p className="font-['Sora'] text-base font-bold text-white">
              Loading secure lecture stream...
            </p>
            <p className="text-xs sm:text-sm text-slate-400">
              Decrypting HD video & preparing adaptive playback
            </p>
          </div>
        ) : resolveError ? (
          <div className="flex flex-col items-center gap-3 text-center p-6 max-w-md">
            <AlertTriangle className="h-12 w-12 text-amber-500" />
            <h3 className="font-['Sora'] text-lg font-bold text-white">
              Could Not Play Video
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{resolveError}</p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  loadStream();
                }}
                className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 transition"
              >
                Retry Stream
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onBack();
                }}
                className="rounded-xl border border-white/15 bg-white/10 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/20 transition"
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
              className={`h-full w-full cursor-pointer ${
                fillMode === 'cover' ? 'object-cover' : 'object-contain'
              } ${isAudioOnly ? 'opacity-0 pointer-events-none absolute inset-0' : ''}`}
            />

            {/* Big Center Quick Controls in Fullscreen when HUD visible */}
            {isImmersiveFullscreen && controlsVisible && !isAudioOnly && !isBuffering && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="pointer-events-auto absolute z-10 flex items-center gap-6 sm:gap-10"
              >
                <button
                  onClick={() => seekBy(-10)}
                  className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-md border border-white/15 hover:bg-black/75 active:scale-90 transition"
                  title="Rewind 10s"
                >
                  <RotateCcw className="h-6 w-6" />
                </button>
                <button
                  onClick={togglePlayPause}
                  className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-indigo-600/95 text-white shadow-2xl shadow-indigo-600/40 hover:bg-indigo-500 active:scale-95 transition"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <Pause className="h-8 w-8 sm:h-9 sm:w-9" />
                  ) : (
                    <Play className="h-8 w-8 sm:h-9 sm:w-9 ml-1" />
                  )}
                </button>
                <button
                  onClick={() => seekBy(10)}
                  className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-md border border-white/15 hover:bg-black/75 active:scale-90 transition"
                  title="Forward 10s"
                >
                  <RotateCw className="h-6 w-6" />
                </button>
              </div>
            )}

            {/* Buffering Spinner */}
            {isBuffering && !isAudioOnly && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30">
                <Loader2 className="h-12 w-12 animate-spin text-indigo-400" />
              </div>
            )}

            {/* Audio-Only Overlay */}
            {isAudioOnly && (
              <div className="flex flex-col items-center justify-center p-6 text-center z-10">
                <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-tr from-emerald-600 to-indigo-600 shadow-2xl shadow-emerald-500/20">
                  <Headphones className="h-12 w-12 text-white animate-pulse" />
                </div>
                <h3 className="mt-6 font-['Sora'] text-lg sm:text-xl font-bold text-white max-w-md">
                  {lecture.title}
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-emerald-400 font-semibold">
                  Audio-Only Mode Active • Video Stream Paused Visually
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsAudioOnly(false);
                  }}
                  className="mt-5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 transition"
                >
                  Turn Video Back On
                </button>
              </div>
            )}
          </>
        )}

        {/* Attachments / Notes Drawer */}
        {showNotesDrawer && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-0 bottom-0 z-30 w-full max-w-md border-l border-white/15 bg-slate-950/95 p-4 backdrop-blur-xl flex flex-col"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-pink-400" />
                <h4 className="font-['Sora'] text-sm sm:text-base font-bold text-white">
                  Lecture Notes & Attachments
                </h4>
              </div>
              <button
                onClick={() => setShowNotesDrawer(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-3 flex-1 overflow-y-auto space-y-2.5">
              {attachments.length === 0 ? (
                <p className="text-xs sm:text-sm text-slate-400 py-6 text-center">
                  No PDF attachments linked directly to this lecture. Check the Chapter Notes tab!
                </p>
              ) : (
                attachments.map((att, i) => {
                  const rawHref = resolveAttachmentUrl(att);
                  const fileName = att.name || `Attachment ${i + 1}.pdf`;
                  if (!rawHref) {
                    return (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3.5 text-xs sm:text-sm opacity-70"
                      >
                        <span className="font-semibold text-white truncate pr-2">
                          {fileName}
                        </span>
                        <span className="text-xs text-slate-400 shrink-0">Unavailable</span>
                      </div>
                    );
                  }
                  const viewUrl = buildPdfProxyUrl(rawHref, fileName, false);
                  const isDownloading = downloadingAttIdx === i;
                  const isDone = downloadedAttIdx === i;
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 p-3.5 text-xs sm:text-sm hover:border-indigo-500/50 transition"
                    >
                      <span className="font-semibold text-white truncate pr-2 flex-1">
                        {fileName}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <a
                          href={viewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/20 transition"
                        >
                          View
                        </a>
                        <button
                          type="button"
                          disabled={isDownloading}
                          onClick={async () => {
                            setDownloadingAttIdx(i);
                            try {
                              await downloadPdfFile(rawHref, fileName);
                              setDownloadedAttIdx(i);
                              setTimeout(() => setDownloadedAttIdx(null), 2500);
                            } catch {
                              window.location.assign(buildPdfProxyUrl(rawHref, fileName, true));
                            } finally {
                              setDownloadingAttIdx(null);
                            }
                          }}
                          className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-60 transition"
                        >
                          {isDownloading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : isDone ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                          ) : (
                            <Download className="h-3.5 w-3.5" />
                          )}
                          <span>{isDone ? 'Saved' : 'PDF'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* In-Player Study AI Doubt Drawer */}
        {showAiDrawer && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-0 bottom-0 z-30 w-full max-w-md border-l border-white/15 shadow-2xl"
          >
            <StudyAiPanel
              variant="drawer"
              scopeKey={`lecture:${lecture.batchId}:${lecture.videoId}`}
              context={{
                batchName: lecture.batchName,
                subjectName: lecture.subjectName,
                topicName: lecture.topicName,
                lectureTitle: lecture.title,
              }}
              onClose={() => setShowAiDrawer(false)}
            />
          </div>
        )}
      </div>

      {/* Bottom Controls Deck (Overlay in Fullscreen, pinned footer in normal view) */}
      {!streamData?.isYoutube && !resolving && !resolveError && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`${
            isImmersiveFullscreen
              ? `absolute bottom-0 left-0 right-0 z-20 transition-all duration-300 bg-gradient-to-t from-black/90 via-black/60 to-transparent ${
                  controlsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full pointer-events-none'
                }`
              : 'relative shrink-0 border-t border-white/10 bg-black/95'
          } p-3 sm:px-6`}
        >
          {/* Seek Bar */}
          <div className="flex items-center gap-3 mb-2.5">
            <span className="font-mono text-xs sm:text-sm text-slate-200">{formatTime(currentTime)}</span>
            <div
              onClick={(e) => {
                const vid = videoRef.current;
                if (!vid || !duration) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                vid.currentTime = ratio * duration;
                revealControls();
              }}
              className="group relative flex-1 h-2.5 cursor-pointer rounded-full bg-white/25 transition-all hover:h-3.5"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 h-4 w-4 -ml-2 rounded-full bg-white shadow-md transition group-hover:scale-110"
                style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>
            <span className="font-mono text-xs sm:text-sm text-slate-300">{formatTime(duration)}</span>
          </div>

          {/* Control Buttons Row */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={togglePlayPause}
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30 hover:bg-indigo-500 transition active:scale-95"
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
              </button>

              <button
                onClick={() => seekBy(-10)}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-white hover:bg-white/25 active:scale-95 transition"
                title="Rewind 10s"
              >
                <RotateCcw className="h-4 w-4" />
              </button>

              <button
                onClick={() => seekBy(10)}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-white hover:bg-white/25 active:scale-95 transition"
                title="Forward 10s"
              >
                <RotateCw className="h-4 w-4" />
              </button>

              <button
                onClick={() => setIsMuted(!isMuted)}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-white hover:bg-white/25 transition"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* Fit vs Fill (Zoom edge-to-edge) */}
              <button
                onClick={() => {
                  setFillMode((prev) => (prev === 'contain' ? 'cover' : 'contain'));
                  revealControls();
                }}
                className={`flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold transition ${
                  fillMode === 'cover'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white/15 text-white hover:bg-white/25'
                }`}
                title="Toggle Fit / Fill Screen"
              >
                <Expand className="h-3.5 w-3.5" />
                <span className="hidden xs:inline">{fillMode === 'cover' ? 'Fill' : 'Fit'}</span>
              </button>

              {/* Quality Picker */}
              {qualityLevels.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowQualityMenu(!showQualityMenu);
                      setShowSpeedMenu(false);
                      revealControls();
                    }}
                    className="flex items-center gap-1 rounded-xl bg-white/15 px-3 py-2 text-xs font-bold text-white hover:bg-white/25 transition"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5 text-emerald-400" />
                    <span>
                      {currentLevel === -1
                        ? 'Auto'
                        : qualityLevels.find((q) => q.index === currentLevel)?.label || 'Auto'}
                    </span>
                  </button>
                  {showQualityMenu && (
                    <div className="absolute right-0 bottom-12 z-50 w-32 rounded-xl border border-white/15 bg-slate-900/95 p-1.5 shadow-2xl backdrop-blur-lg">
                      <button
                        onClick={() => handleQualityChange(-1)}
                        className={`w-full rounded-lg px-3 py-2 text-left text-xs font-semibold transition ${
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
                          className={`w-full rounded-lg px-3 py-2 text-left text-xs font-semibold transition ${
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
                    revealControls();
                  }}
                  className="flex items-center gap-1 rounded-xl bg-white/15 px-3 py-2 text-xs font-bold text-white hover:bg-white/25 transition"
                >
                  <Gauge className="h-3.5 w-3.5 text-indigo-400" />
                  <span>{playbackSpeed}x</span>
                </button>
                {showSpeedMenu && (
                  <div className="absolute right-0 bottom-12 z-50 w-28 rounded-xl border border-white/15 bg-slate-900/95 p-1.5 shadow-2xl backdrop-blur-lg max-h-52 overflow-y-auto">
                    {speedOptions.map((spd) => (
                      <button
                        key={spd}
                        onClick={() => {
                          setPlaybackSpeed(spd);
                          setShowSpeedMenu(false);
                          revealControls();
                        }}
                        className={`w-full rounded-lg px-3 py-2 text-left text-xs font-semibold transition ${
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
                onClick={() => {
                  setShowNotesDrawer(!showNotesDrawer);
                  setShowAiDrawer(false);
                  revealControls();
                }}
                className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/15 px-3 py-2 text-xs font-bold text-indigo-200 hover:bg-white/25 transition"
              >
                <FileText className="h-3.5 w-3.5" />
                <span className="hidden xs:inline">Notes ({attachments.length})</span>
              </button>

              {/* Fullscreen Quick Toggle */}
              <button
                onClick={toggleFullscreen}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 transition"
                title={isImmersiveFullscreen ? 'Exit Fullscreen' : 'Landscape Fullscreen'}
              >
                {isImmersiveFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
