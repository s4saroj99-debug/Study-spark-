import React, { useState } from 'react';
import { Heart, Play, BookOpen, GraduationCap } from 'lucide-react';
import { BatchItem } from '../types';

interface BatchCardProps {
  batch: BatchItem;
  isFavorite: boolean;
  onToggleFavorite: (batchId: string) => void;
  onSelect: (batch: BatchItem) => void;
  onQuickPlay?: (batch: BatchItem) => void;
}

export const BatchCard: React.FC<BatchCardProps> = ({
  batch,
  isFavorite,
  onToggleFavorite,
  onSelect,
  onQuickPlay,
}) => {
  const [imgError, setImgError] = useState(false);

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite(batch.batch_id);
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onQuickPlay) {
      onQuickPlay(batch);
    } else {
      onSelect(batch);
    }
  };

  return (
    <div
      onClick={() => onSelect(batch)}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--card-shadow)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--primary-color)]/60 hover:shadow-xl cursor-pointer"
    >
      {/* Banner / Thumbnail */}
      <div className="relative aspect-video w-full overflow-hidden bg-slate-900/60">
        {!imgError && batch.photo ? (
          <img
            src={batch.photo}
            alt={batch.name}
            loading="lazy"
            onError={() => setImgError(true)}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 p-4 text-center">
            <GraduationCap className="h-10 w-10 text-indigo-400 opacity-80 mb-1" />
            <span className="font-['Sora'] text-xs font-bold text-slate-300 line-clamp-1">
              {batch.name}
            </span>
          </div>
        )}

        {/* Favorite Heart Button */}
        <button
          onClick={handleFavoriteClick}
          className={`absolute top-2.5 right-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-md transition-all active:scale-90 ${
            isFavorite
              ? 'bg-pink-600 text-white shadow-md shadow-pink-600/40'
              : 'bg-black/50 text-white hover:bg-black/70 hover:text-pink-400'
          }`}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Heart className={`h-4 w-4 ${isFavorite ? 'fill-white' : ''}`} />
        </button>

        {/* Exam Tag */}
        {batch.exam && (
          <div className="absolute top-2.5 left-2.5 rounded-lg bg-black/60 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur-md border border-white/10">
            {batch.exam}
          </div>
        )}

        {/* Hover Quick Play Overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={handlePlayClick}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary-color)] text-white shadow-lg transition-transform group-hover:scale-110 active:scale-95"
            title="Start Lectures"
          >
            <Play className="h-5 w-5 fill-white ml-0.5" />
          </button>
        </div>

        {/* Language Badge */}
        {batch.language && (
          <div className="absolute bottom-2 left-2.5 rounded-md bg-indigo-600/90 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm">
            {batch.language}
          </div>
        )}

        {/* Class Badge */}
        {batch.class && (
          <div className="absolute bottom-2 right-2.5 rounded-md bg-slate-900/90 px-1.5 py-0.5 text-[10px] font-semibold text-slate-200 border border-white/10">
            Class {batch.class}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-['Sora'] text-sm font-bold text-[var(--text-primary)] line-clamp-2 leading-snug group-hover:text-[var(--primary-color)] transition-colors">
          {batch.name}
        </h3>

        {batch.byName && (
          <p className="mt-1 text-xs text-[var(--text-secondary)] line-clamp-1">
            {batch.byName}
          </p>
        )}

        <div className="mt-auto pt-3 flex items-center justify-between border-t border-[var(--card-border)] text-xs text-[var(--text-secondary)]">
          <div className="flex items-center gap-1">
            <BookOpen className="h-3.5 w-3.5 text-indigo-400" />
            <span>{batch.isVidyapeeth ? 'Vidyapeeth Center' : 'Live + Recorded'}</span>
          </div>
          {batch.amount !== undefined && (
            <span className="font-bold text-emerald-400">
              {batch.amount > 0 ? `₹${batch.amount}` : 'Free Access'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
