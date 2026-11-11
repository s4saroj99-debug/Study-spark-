import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Headphones,
  Maximize2,
  Minimize2,
  Moon,
  RotateCcw,
  RotateCw,
  Gauge,
  SlidersHorizontal,
  FileText,
  Volume2,
  VolumeX,
  Play,
  Pause,
  ExternalLink,
} from 'lucide-react';
import { saveWatchHistory } from '../services/batchService';

interface VideoPlayerViewProps {
  lecture: {
    title: string;
    videoUrl: string;
    batchId?: string;
    batchName?: string;
    duration?: number;
  };
  onBack: () => void;
  onOpenInCloudWebview: () => void;
}

export const VideoPlayerView: React.FC<VideoPlayerViewProps> = ({
  lecture,
  onBack,
  onOpenInCloudWebview,
}) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isAudioOnly, setIsAudioOnly] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(lecture.duration || 3600);
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);
  const [showSleepMenu, setShowSleepMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const speedOptions = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];

  // Save to watch history on mount
  useEffect(() => {
    saveWatchHistory({
      id: `${lecture.batchId || 'b'}-${encodeURIComponent(lecture.title)}`,
      batchId: lecture.batchId,
      batchName: lecture.batchName,
      title: lecture.title,
      videoUrl: lecture.videoUrl,
      duration: duration,
      progressSeconds: progress,
      progressPercent: Math.round((progress / duration) * 100),
    });
  }, [lecture, duration, progress]);

  // Handle timer simulation
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + playbackSpeed;
        return next >= duration ? duration : next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, duration]);

  // Handle sleep timer
  useEffect(() => {
    if (sleepTimerMinutes === null) return;
    const timer = setTimeout(() => {
      setIsPlaying(false);
      setSleepTimerMinutes(null);
    }, sleepTimerMinutes * 60 * 1000);
    return () => clearTimeout(timer);
  }, [sleepTimerMinutes]);

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
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col bg-[#050508] text-white overflow-hidden"
    >
      {/* Player Header Bar */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-black/80 px-3 sm:px-6 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 active:scale-95 transition"
            title="Back to Batches"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex flex-col max-w-[220px] sm:max-w-md">
            <h2 className="font-['Sora'] text-xs sm:text-sm font-bold text-white truncate">
              {lecture.title}
            </h2>
            <span className="text-[10px] text-slate-400 truncate">
              {lecture.batchName || 'VidCloud Stream'}
            </span>
          </div>
        </div>

        {/* Player Top Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Audio-only toggle */}
          <button
            onClick={() => setIsAudioOnly(!isAudioOnly)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
              isAudioOnly
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'bg-white/10 text-slate-300 hover:bg-white/20'
            }`}
            title="Audio-Only Mode (Saves 90% Battery & Data)"
          >
            <Headphones className="h-3.5 w-3.5" />
            <span className="hidden xs:inline">Audio Mode</span>
          </button>

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

          {/* Open in Cloud View */}
          <button
            onClick={onOpenInCloudWebview}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-slate-300 hover:bg-white/20 transition"
            title="Open in VidCloud Live Player"
          >
            <ExternalLink className="h-4 w-4" />
          </button>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-slate-300 hover:bg-white/20 transition"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Main Video View / Audio View */}
      <div className="relative flex flex-1 items-center justify-center bg-black overflow-hidden">
        {isAudioOnly ? (
          /* Audio-only background */
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-tr from-emerald-600 to-indigo-600 shadow-2xl shadow-emerald-500/20">
              <Headphones className="h-12 w-12 text-white animate-pulse" />
            </div>
            <h3 className="mt-6 font-['Sora'] text-lg font-bold text-white max-w-md">
              {lecture.title}
            </h3>
            <p className="mt-1 text-xs text-emerald-400 font-semibold">
              Audio-Only Battery Saver Mode Active
            </p>
            {/* Animated Soundwaves */}
            <div className="mt-6 flex items-center gap-1.5 h-12">
              {[40, 70, 95, 60, 85, 45, 90, 75, 55, 100, 65, 80, 50].map((h, i) => (
                <div
                  key={i}
                  className="w-1.5 rounded-full bg-gradient-to-t from-emerald-500 to-indigo-400 transition-all duration-300"
                  style={{
                    height: isPlaying ? `${h}%` : '15%',
                    animationDuration: `${0.4 + (i % 5) * 0.15}s`,
                  }}
                />
              ))}
            </div>
          </div>
        ) : (
          /* Live Stream Iframe / Video Player */
          <div className="relative h-full w-full">
            <iframe
              src={lecture.videoUrl}
              title={lecture.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="h-full w-full border-none"
            />
          </div>
        )}
      </div>

      {/* Player Bottom Control Deck */}
      <div className="shrink-0 border-t border-white/10 bg-black/90 p-3 sm:px-6">
        {/* Timeline Progress Bar */}
        <div className="flex items-center gap-3 mb-2">
          <span className="font-mono text-xs text-slate-300">{formatTime(progress)}</span>
          <div
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const ratio = clickX / rect.width;
              setProgress(Math.floor(ratio * duration));
            }}
            className="group relative flex-1 h-2 cursor-pointer rounded-full bg-white/20 transition-all hover:h-3"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
              style={{ width: `${(progress / duration) * 100}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 -ml-1.5 rounded-full bg-white opacity-0 shadow-md transition group-hover:opacity-100"
              style={{ left: `${(progress / duration) * 100}%` }}
            />
          </div>
          <span className="font-mono text-xs text-slate-400">{formatTime(duration)}</span>
        </div>

        {/* Buttons Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Play/Pause */}
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30 hover:bg-indigo-500 transition active:scale-95"
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
            </button>

            {/* Rewind 10s */}
            <button
              onClick={() => setProgress((p) => Math.max(0, p - 10))}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 active:scale-95 transition"
              title="Seek back 10 seconds"
            >
              <RotateCcw className="h-4 w-4" />
            </button>

            {/* Forward 10s */}
            <button
              onClick={() => setProgress((p) => Math.min(duration, p + 10))}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 active:scale-95 transition"
              title="Seek forward 10 seconds"
            >
              <RotateCw className="h-4 w-4" />
            </button>

            {/* Mute toggle */}
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 transition"
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Speed Multiplier Menu */}
            <div className="relative">
              <button
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                className="flex items-center gap-1 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20 transition"
              >
                <Gauge className="h-3.5 w-3.5 text-indigo-400" />
                <span>{playbackSpeed}x</span>
              </button>
              {showSpeedMenu && (
                <div className="absolute right-0 bottom-11 z-50 w-32 rounded-xl border border-white/15 bg-slate-900/95 p-1.5 shadow-2xl backdrop-blur-lg max-h-48 overflow-y-auto">
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
            <a
              href={`https://vidcloud.eu.org/?page=batch_details&batch_id=${lecture.batchId || ''}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-indigo-300 hover:bg-white/20 transition"
            >
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden xs:inline">Notes</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
