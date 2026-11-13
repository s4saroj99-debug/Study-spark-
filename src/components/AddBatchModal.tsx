import React, { useState } from 'react';
import { X, Plus, Loader2, CheckCircle2, AlertCircle, BookOpen } from 'lucide-react';
import { BatchItem } from '../types';
import { fetchBatchDetails } from '../services/batchService';

interface AddBatchModalProps {
  onClose: () => void;
  onAddBatch: (batch: BatchItem) => void;
}

export const AddBatchModal: React.FC<AddBatchModalProps> = ({ onClose, onAddBatch }) => {
  const [batchIdInput, setBatchIdInput] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [examTag, setExamTag] = useState('IIT-JEE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const extractBatchId = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    try {
      if (trimmed.startsWith('http')) {
        const u = new URL(trimmed);
        const qp = u.searchParams.get('batch_id') || u.searchParams.get('batchId');
        if (qp) return qp.trim();
        const seg = u.pathname.split('/').filter(Boolean).pop();
        if (seg && /^[a-f0-9]{24}$/i.test(seg)) return seg;
      }
    } catch {
      // fallback to raw match
    }
    const idMatch = trimmed.match(/[a-f0-9]{24}/i);
    return idMatch ? idMatch[0] : trimmed;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const parsedId = extractBatchId(batchIdInput);
    if (!parsedId) {
      setError('Please enter a valid Batch ID or link.');
      return;
    }

    setLoading(true);
    try {
      const details = await fetchBatchDetails(parsedId);
      const b = details.batch;
      const item: BatchItem = {
        batch_id: parsedId,
        name: customTitle.trim() || b?.name || `Batch ${parsedId.slice(-6)}`,
        byName: b?.byName || (details.subjects?.length ? `${details.subjects.length} Subjects Available` : 'Added to My Batches'),
        photo: b?.previewImage?.baseUrl && b?.previewImage?.key
          ? `${b.previewImage.baseUrl}${b.previewImage.key}`
          : '',
        language: b?.language || 'Hinglish',
        exam: b?.exam?.[0] || examTag,
        class: b?.class || 'All',
        amount: 0,
      };
      onAddBatch(item);
      setSuccessMsg(`"${item.name}" added to My Batches!`);
      setTimeout(() => onClose(), 800);
    } catch {
      setError('Could not load batch from that ID. Please verify the 24-character Batch ID.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-md rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-xl p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary-color)]/15 text-[var(--primary-color)]">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-['Sora'] text-base font-bold text-[var(--text-primary)]">
              Add Batch to My App
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Import any course directly by Batch ID or URL
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
              Batch ID or Course URL
            </label>
            <input
              type="text"
              value={batchIdInput}
              onChange={(e) => setBatchIdInput(e.target.value)}
              placeholder="e.g. 65d862392b1da90018ad8f3b"
              className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--bg-secondary)] px-3.5 py-2.5 text-xs sm:text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:border-[var(--primary-color)] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                Custom Label (Optional)
              </label>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="My Target Batch"
                className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--bg-secondary)] px-3.5 py-2.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:border-[var(--primary-color)] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                Category
              </label>
              <select
                value={examTag}
                onChange={(e) => setExamTag(e.target.value)}
                className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--bg-secondary)] px-3 py-2.5 text-xs font-semibold text-[var(--text-primary)] focus:border-[var(--primary-color)] focus:outline-none"
              >
                <option value="IIT-JEE">IIT-JEE</option>
                <option value="NEET">NEET</option>
                <option value="Boards">Boards</option>
                <option value="UPSC">UPSC</option>
                <option value="Foundation">Foundation</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-secondary)] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl bg-[var(--primary-color)] px-4 py-2 text-xs font-bold text-white shadow-md hover:opacity-90 disabled:opacity-60 transition"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              <span>{loading ? 'Verifying...' : 'Add Batch'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
