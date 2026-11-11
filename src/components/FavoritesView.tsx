import React from 'react';
import { Heart, BookOpen } from 'lucide-react';
import { BatchItem } from '../types';
import { BatchCard } from './BatchCard';

interface FavoritesViewProps {
  favoriteBatches: BatchItem[];
  onToggleFavorite: (batchId: string) => void;
  onSelectBatch: (batch: BatchItem) => void;
  onBrowseBatches: () => void;
}

export const FavoritesView: React.FC<FavoritesViewProps> = ({
  favoriteBatches,
  onToggleFavorite,
  onSelectBatch,
  onBrowseBatches,
}) => {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-500/10 text-pink-400">
            <Heart className="h-5 w-5 fill-pink-400" />
          </div>
          <div>
            <h2 className="font-['Sora'] text-base sm:text-lg font-bold text-[var(--text-primary)]">
              My Favorites
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              {favoriteBatches.length} Saved {favoriteBatches.length === 1 ? 'Batch' : 'Batches'}
            </p>
          </div>
        </div>
      </div>

      {/* Grid or Empty */}
      {favoriteBatches.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[var(--card-border)] bg-[var(--bg-secondary)]/50 p-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-pink-500/10 text-pink-400 mb-3">
            <Heart className="h-8 w-8" />
          </div>
          <h3 className="font-['Sora'] text-base font-bold text-[var(--text-primary)]">
            No Favorite Batches Added
          </h3>
          <p className="mt-1 max-w-xs text-xs text-[var(--text-secondary)]">
            Tap the heart icon on any batch card to save your favorite courses for instant access.
          </p>
          <button
            onClick={onBrowseBatches}
            className="mt-5 flex items-center gap-2 rounded-xl bg-[var(--primary-color)] px-5 py-2.5 text-xs font-bold text-white shadow-md hover:opacity-90 transition active:scale-95"
          >
            <BookOpen className="h-4 w-4" />
            <span>Discover Batches</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {favoriteBatches.map((batch) => (
            <BatchCard
              key={batch.batch_id}
              batch={batch}
              isFavorite={true}
              onToggleFavorite={onToggleFavorite}
              onSelect={onSelectBatch}
            />
          ))}
        </div>
      )}
    </div>
  );
};
