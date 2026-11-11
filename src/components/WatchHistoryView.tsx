import React, { useState } from 'react';
import { History, Trash2, Play, AlertCircle, Clock, BookOpen } from 'lucide-react';
import { WatchHistoryItem } from '../types';

interface WatchHistoryViewProps {
  history: WatchHistoryItem[];
  onPlayItem: (item: WatchHistoryItem) => void;
  onClearHistory: () => void;
  onBrowseBatches: () => void;
}

export const WatchHistoryView: React.FC<WatchHistoryViewProps> = ({
  history,
  onPlayItem,
  onClearHistory,
  onBrowseBatches,
}) => {
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  const formatWatchedDate = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / (60 * 1000));
    const hours = Math.floor(diff / (60 * 60 * 1000));
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const formatTime = (secs?: number) => {
    if (!secs) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
            <History className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-['Sora'] text-base sm:text-lg font-bold text-[var(--text-primary)]">
              Watch History
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Resume watching your previous study lectures
            </p>
          </div>
        </div>

        {history.length > 0 && (
          <button
            onClick={() => setShowConfirmClear(true)}
            className="flex items-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Clear All</span>
          </button>
        )}
      </div>

      {/* History List */}
      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[var(--card-border)] bg-[var(--bg-secondary)]/50 p-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 mb-3">
            <Clock className="h-8 w-8" />
          </div>
          <h3 className="font-['Sora'] text-base font-bold text-[var(--text-primary)]">
            No Watch History Yet
          </h3>
          <p className="mt-1 max-w-xs text-xs text-[var(--text-secondary)]">
            Lectures and videos you watch will be tracked here with your timestamp so you can pick
            up right where you left off.
          </p>
          <button
            onClick={onBrowseBatches}
            className="mt-5 rounded-xl bg-[var(--primary-color)] px-5 py-2.5 text-xs font-bold text-white shadow-md hover:opacity-90 transition active:scale-95"
          >
            Explore Batches
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {history.map((item) => (
            <div
              key={item.id}
              className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3.5 shadow-sm transition hover:border-[var(--primary-color)]/50"
            >
              <div className="flex items-start gap-3">
                <button
                  onClick={() => onPlayItem(item)}
                  className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-600/20 hover:scale-105 active:scale-95 transition"
                >
                  <Play className="h-4 w-4 fill-white ml-0.5" />
                </button>
                <div className="flex-1 min-w-0">
                  <h4 className="font-['Sora'] text-xs sm:text-sm font-bold text-[var(--text-primary)] truncate">
                    {item.title}
                  </h4>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                    {item.batchName && (
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3 w-3 text-indigo-400" />
                        <span className="truncate max-w-[150px]">{item.batchName}</span>
                      </span>
                    )}
                    <span>•</span>
                    <span>Watched {formatWatchedDate(item.watchedAt)}</span>
                    {item.progressSeconds !== undefined && (
                      <>
                        <span>•</span>
                        <span className="font-mono text-indigo-400">
                          {formatTime(item.progressSeconds)} / {formatTime(item.duration)}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Progress bar */}
                  {item.progressPercent !== undefined && item.progressPercent > 0 && (
                    <div className="mt-2 h-1.5 w-full max-w-xs rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                        style={{ width: `${Math.min(100, item.progressPercent)}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 sm:self-center">
                <button
                  onClick={() => onPlayItem(item)}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-[var(--primary-color)] px-4 py-2 text-xs font-bold text-white shadow-sm hover:opacity-90 transition active:scale-95"
                >
                  <Play className="h-3.5 w-3.5 fill-white" />
                  <span>Resume</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Clear Confirmation Modal */}
      {showConfirmClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-red-500 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h3 className="font-['Sora'] text-base font-bold text-[var(--text-primary)]">
                Clear Watch History?
              </h3>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Are you sure you want to clear your entire watch history? This action cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                onClick={() => setShowConfirmClear(false)}
                className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-secondary)] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onClearHistory();
                  setShowConfirmClear(false);
                }}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-red-700 transition"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
