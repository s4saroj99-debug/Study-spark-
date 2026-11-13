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
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--card-shadow)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--primary-color)]/60 hover:shadow-xl cursor-pointer"
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
          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 p-5 text-center">
            <GraduationCap className="h-14 w-14 text-indigo-400 opacity-80 mb-2" />
            <span className="font-['Sora'] text-sm sm:text-base font-bold text-slate-200 line-clamp-2">
              {batch.name}
            </span>
          </div>
        )}

        {/* Favorite Heart Button */}
        <button
          onClick={handleFavoriteClick}
          className={`absolute top-3 right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-md transition-all active:scale-90 ${
            isFavorite
              ? 'bg-pink-600 text-white shadow-md shadow-pink-600/40'
              : 'bg-black/55 text-white hover:bg-black/75 hover:text-pink-400'
          }`}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Heart className={`h-5 w-5 ${isFavorite ? 'fill-white' : ''}`} />
        </button>

        {/* Exam Tag */}
        {batch.exam && (
          <div className="absolute top-3 left-3 rounded-xl bg-black/65 px-3 py-1 text-xs font-bold text-white backdrop-blur-md border border-white/10">
            {batch.exam}
          </div>
        )}

        {/* Hover Quick Play Overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={handlePlayClick}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--primary-color)] text-white shadow-xl transition-transform group-hover:scale-110 active:scale-95"
            title="Start Lectures"
          >
            <Play className="h-7 w-7 fill-white ml-0.5" />
          </button>
        </div>

        {/* Language Badge */}
        {batch.language && (
          <div className="absolute bottom-2.5 left-3 rounded-lg bg-indigo-600/90 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
            {batch.language}
          </div>
        )}

        {/* Class Badge */}
        {batch.class && (
          <div className="absolute bottom-2.5 right-3 rounded-lg bg-slate-900/90 px-2.5 py-1 text-xs font-bold text-slate-200 border border-white/10">
            Class {batch.class}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h3 className="font-['Sora'] text-base sm:text-lg font-extrabold text-[var(--text-primary)] line-clamp-2 leading-snug group-hover:text-[var(--primary-color)] transition-colors">
          {batch.name}
        </h3>

        {batch.byName && (
          <p className="mt-1.5 text-xs sm:text-sm text-[var(--text-secondary)] line-clamp-1">
            {batch.byName}
          </p>
        )}

        <div className="mt-auto pt-3.5 flex items-center justify-between border-t border-[var(--card-border)] text-xs sm:text-sm text-[var(--text-secondary)]">
          <div className="flex items-center gap-1.5">
            <BookOpen className="h-4 w-4 text-indigo-400" />
            <span className="font-medium">{batch.isVidyapeeth ? 'Vidyapeeth Center' : 'Live + Recorded'}</span>
          </div>
          {batch.amount !== undefined && (
            <span className="font-extrabold text-emerald-400">
              {batch.amount > 0 ? `₹${batch.amount}` : 'Free Access'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
