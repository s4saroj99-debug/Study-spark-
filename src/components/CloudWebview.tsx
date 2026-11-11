import React, { useState, useRef } from 'react';
import {
  RotateCw,
  ArrowLeft,
  ArrowRight,
  Home,
  ExternalLink,
  Share2,
  Maximize2,
  Minimize2,
  AlertTriangle,
  Globe,
  Smartphone,
} from 'lucide-react';

interface CloudWebviewProps {
  initialUrl?: string;
  onSwitchToNative: () => void;
}

export const CloudWebview: React.FC<CloudWebviewProps> = ({
  initialUrl = 'https://vidcloud.eu.org/',
  onSwitchToNative,
}) => {
  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [key, setKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleReload = () => {
    setIsLoading(true);
    setHasError(false);
    setKey((prev) => prev + 1);
  };

  const handleHome = () => {
    setCurrentUrl('https://vidcloud.eu.org/');
    setIsLoading(true);
    setHasError(false);
    setKey((prev) => prev + 1);
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

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: 'VidCloud & StudyStark',
          url: currentUrl,
        })
        .catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(currentUrl);
      alert('Link copied to clipboard!');
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col flex-1 h-[calc(100vh-4rem-4rem)] sm:h-[calc(100vh-4rem)] w-full overflow-hidden bg-[var(--bg-primary)]"
    >
      {/* Webview In-App Control Bar */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--card-border)] bg-[var(--bg-secondary)] px-3 text-xs">
        {/* Navigation buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              if (iframeRef.current?.contentWindow) {
                iframeRef.current.contentWindow.history.back();
              }
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition"
            title="Go Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              if (iframeRef.current?.contentWindow) {
                iframeRef.current.contentWindow.history.forward();
              }
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition"
            title="Go Forward"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            onClick={handleReload}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition"
            title="Reload Page"
          >
            <RotateCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
          <button
            onClick={handleHome}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition"
            title="VidCloud Home"
          >
            <Home className="h-4 w-4" />
          </button>
        </div>

        {/* Address / Status Bar Indicator */}
        <div className="flex items-center gap-2 max-w-[200px] sm:max-w-md px-2 py-1 rounded-lg bg-[var(--bg-primary)] border border-[var(--card-border)]">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <Globe className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
          <span className="font-mono text-[11px] text-[var(--text-secondary)] truncate">
            {currentUrl}
          </span>
        </div>

        {/* Right Action Tools */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Switch to native app shortcut */}
          <button
            onClick={onSwitchToNative}
            className="hidden xs:flex items-center gap-1 rounded-lg bg-indigo-600/10 px-2.5 py-1 text-xs font-bold text-indigo-400 border border-indigo-500/20 hover:bg-indigo-600/20 transition"
          >
            <Smartphone className="h-3.5 w-3.5" />
            <span>Native Mode</span>
          </button>

          <button
            onClick={handleShare}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition"
            title="Share Page Link"
          >
            <Share2 className="h-4 w-4" />
          </button>

          <a
            href={currentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition"
            title="Open in External Browser"
          >
            <ExternalLink className="h-4 w-4" />
          </a>

          <button
            onClick={toggleFullscreen}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Progress Line */}
      {isLoading && (
        <div className="h-0.5 w-full bg-slate-800 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 animate-pulse w-3/4" />
        </div>
      )}

      {/* Iframe Viewport */}
      <div className="relative flex-1 w-full bg-black">
        {hasError ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <AlertTriangle className="h-12 w-12 text-amber-500 mb-3" />
            <h3 className="font-['Sora'] text-lg font-bold text-[var(--text-primary)]">
              Could not load cloud page
            </h3>
            <p className="mt-1 text-xs text-[var(--text-secondary)] max-w-sm">
              Please check your internet connection or use the built-in Native App mode.
            </p>
            <div className="mt-4 flex gap-3">
              <button
                onClick={handleReload}
                className="rounded-xl bg-[var(--primary-color)] px-4 py-2 text-xs font-bold text-white shadow-md hover:opacity-90"
              >
                Retry Loading
              </button>
              <button
                onClick={onSwitchToNative}
                className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-secondary)] px-4 py-2 text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
              >
                Go to Native App
              </button>
            </div>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            key={key}
            src={currentUrl}
            title="VidCloud StudyStark Web"
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="h-full w-full border-none"
          />
        )}
      </div>
    </div>
  );
};
