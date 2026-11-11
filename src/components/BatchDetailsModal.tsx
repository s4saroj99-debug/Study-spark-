import React, { useState } from 'react';
import {
  X,
  Play,
  Share2,
  Calendar,
  BookOpen,
  GraduationCap,
  Heart,
  Globe,
  FileText,
  Clock,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { BatchItem } from '../types';

interface BatchDetailsModalProps {
  batch: BatchItem | null;
  onClose: () => void;
  isFavorite: boolean;
  onToggleFavorite: (batchId: string) => void;
  onPlayLecture: (lecture: { title: string; videoUrl: string; duration?: number }) => void;
  onOpenInCloudWebview: (batchId: string) => void;
}

export const BatchDetailsModal: React.FC<BatchDetailsModalProps> = ({
  batch,
  onClose,
  isFavorite,
  onToggleFavorite,
  onPlayLecture,
  onOpenInCloudWebview,
}) => {
  const [activeTab, setActiveTab] = useState<'lectures' | 'notes' | 'announcements'>('lectures');
  const [copied, setCopied] = useState(false);

  if (!batch) return null;

  // Generate sample lectures for this batch
  const sampleLectures = [
    {
      id: 'lec-1',
      title: 'Chapter 01 : Fundamental Concepts & Introduction (Lec-01)',
      subject: 'Physics',
      duration: 3600, // 1 hr
      durationText: '1h 00m',
      teacher: 'Master Faculty',
      videoUrl: `https://vidcloud.eu.org/play.php?batch_id=${batch.batch_id}&title=${encodeURIComponent(
        batch.name
      )}`,
      hasNotes: true,
      hasDpp: true,
    },
    {
      id: 'lec-2',
      title: 'Chapter 01 : Advanced Numerical Problem Solving (Lec-02)',
      subject: 'Physics',
      duration: 4200,
      durationText: '1h 10m',
      teacher: 'Master Faculty',
      videoUrl: `https://vidcloud.eu.org/play.php?batch_id=${batch.batch_id}&title=${encodeURIComponent(
        batch.name
      )}`,
      hasNotes: true,
      hasDpp: true,
    },
    {
      id: 'lec-3',
      title: 'Chapter 02 : Core Principles & Theory Deep-Dive (Lec-03)',
      subject: 'Chemistry',
      duration: 3900,
      durationText: '1h 05m',
      teacher: 'Senior Expert',
      videoUrl: `https://vidcloud.eu.org/play.php?batch_id=${batch.batch_id}&title=${encodeURIComponent(
        batch.name
      )}`,
      hasNotes: true,
      hasDpp: false,
    },
    {
      id: 'lec-4',
      title: 'Chapter 03 : Shortcut Tricks & Formulas Session (Lec-04)',
      subject: 'Mathematics',
      duration: 3100,
      durationText: '51m 40s',
      teacher: 'Senior Expert',
      videoUrl: `https://vidcloud.eu.org/play.php?batch_id=${batch.batch_id}&title=${encodeURIComponent(
        batch.name
      )}`,
      hasNotes: true,
      hasDpp: true,
    },
  ];

  const handleShare = () => {
    const shareUrl = `https://vidcloud.eu.org/?page=batch_details&batch_id=${batch.batch_id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-4 backdrop-blur-md overflow-y-auto">
      <div className="relative my-auto flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-2xl">
        {/* Header Image & Backdrop */}
        <div className="relative aspect-[21/9] w-full overflow-hidden bg-slate-900 sm:aspect-[24/9]">
          {batch.photo ? (
            <img src={batch.photo} alt={batch.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-r from-indigo-900 via-purple-900 to-slate-900">
              <GraduationCap className="h-16 w-16 text-indigo-400 opacity-60" />
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-[var(--card-bg)] via-[var(--card-bg)]/40 to-black/60" />

          {/* Top Actions */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
            <span className="rounded-lg bg-black/60 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-md border border-white/10">
              {batch.exam || 'All Exams'} • Class {batch.class || 'All'}
            </span>
            <div className="flex items-center gap-2">
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

          {/* Title on banner */}
          <div className="absolute bottom-3 left-4 right-4">
            <h2 className="font-['Sora'] text-lg sm:text-2xl font-extrabold text-white drop-shadow-md">
              {batch.name}
            </h2>
            {batch.byName && (
              <p className="text-xs sm:text-sm text-slate-200 drop-shadow line-clamp-1">
                {batch.byName}
              </p>
            )}
          </div>
        </div>

        {/* Copy confirmation toast */}
        {copied && (
          <div className="absolute top-16 right-4 z-20 flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-lg">
            <CheckCircle2 className="h-4 w-4" />
            <span>Link copied to clipboard!</span>
          </div>
        )}

        {/* Details Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--card-border)] bg-[var(--bg-secondary)] px-4 py-3 text-xs text-[var(--text-secondary)]">
          <div className="flex flex-wrap items-center gap-4">
            {batch.language && (
              <div className="flex items-center gap-1">
                <Globe className="h-3.5 w-3.5 text-indigo-400" />
                <span className="font-semibold text-[var(--text-primary)]">{batch.language}</span>
              </div>
            )}
            {batch.start_date && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-purple-400" />
                <span>Starts {new Date(batch.start_date).toLocaleDateString()}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5 text-pink-400" />
              <span>Full Syllabus Covered</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenInCloudWebview(batch.batch_id)}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--bg-tertiary)] px-3 py-1.5 font-semibold text-[var(--text-primary)] hover:border-[var(--primary-color)] transition"
              title="Open full page in live VidCloud webview"
            >
              <ExternalLink className="h-3.5 w-3.5 text-indigo-400" />
              <span>Open on VidCloud</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--card-border)] px-4 pt-2">
          <button
            onClick={() => setActiveTab('lectures')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
              activeTab === 'lectures'
                ? 'border-[var(--primary-color)] text-[var(--primary-color)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Play className="h-3.5 w-3.5" />
            <span>Lectures & Videos</span>
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
              activeTab === 'notes'
                ? 'border-[var(--primary-color)] text-[var(--primary-color)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Notes & DPPs</span>
          </button>
          <button
            onClick={() => setActiveTab('announcements')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
              activeTab === 'announcements'
                ? 'border-[var(--primary-color)] text-[var(--primary-color)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Schedule & Notices</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {activeTab === 'lectures' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Available Recorded & Live Lectures
                </span>
                <span className="text-xs text-[var(--text-secondary)]">
                  {sampleLectures.length} Chapters Available
                </span>
              </div>

              {sampleLectures.map((lec) => (
                <div
                  key={lec.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-[var(--card-border)] bg-[var(--bg-secondary)] p-3.5 transition hover:border-[var(--primary-color)]/50"
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => onPlayLecture(lec)}
                      className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-600/20 hover:scale-105 active:scale-95 transition"
                    >
                      <Play className="h-4 w-4 fill-white ml-0.5" />
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-400">
                          {lec.subject}
                        </span>
                        <div className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)]">
                          <Clock className="h-3 w-3" />
                          <span>{lec.durationText}</span>
                        </div>
                      </div>
                      <h4 className="mt-1 font-['Sora'] text-xs sm:text-sm font-semibold text-[var(--text-primary)]">
                        {lec.title}
                      </h4>
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        By {lec.teacher} • VidCloud High-Res Stream
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:self-center">
                    <button
                      onClick={() => onPlayLecture(lec)}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 rounded-xl bg-[var(--primary-color)] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:opacity-90 active:scale-95"
                    >
                      <Play className="h-3.5 w-3.5 fill-white" />
                      <span>Stream</span>
                    </button>
                    <button
                      onClick={() => onOpenInCloudWebview(batch.batch_id)}
                      className="flex items-center justify-center rounded-xl border border-[var(--card-border)] bg-[var(--bg-tertiary)] p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
                      title="Open in VidCloud Web Player"
                    >
                      <Globe className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-3">
              <p className="text-xs text-[var(--text-secondary)]">
                Download verified teacher handwritten notes, class DPPs (Daily Practice Problems),
                and solution booklets.
              </p>
              {sampleLectures.map((lec) => (
                <div
                  key={`notes-${lec.id}`}
                  className="flex items-center justify-between rounded-xl border border-[var(--card-border)] bg-[var(--bg-secondary)] p-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-500/10 text-pink-400">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="font-bold text-[var(--text-primary)]">{lec.subject} Lecture Notes</span>
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        Official PDF • Classroom Slides & Solved DPP
                      </p>
                    </div>
                  </div>
                  <a
                    href={`https://vidcloud.eu.org/?page=batch_details&batch_id=${batch.batch_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 rounded-lg bg-[var(--bg-tertiary)] px-3 py-1.5 font-bold text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition"
                  >
                    <span>View PDF</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'announcements' && (
            <div className="space-y-3">
              <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4">
                <span className="text-xs font-bold text-indigo-400">Class Schedule Update</span>
                <p className="mt-1 text-xs text-[var(--text-primary)]">
                  Live classes are streamed Monday through Saturday from 4:00 PM to 8:30 PM. Recorded
                  sessions are processed and uploaded within 15 minutes of completion.
                </p>
              </div>
              <div className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-secondary)] p-4">
                <span className="text-xs font-bold text-emerald-400">Telegram Doubts Group</span>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  Join the official Telegram channel for daily DPP discussions, doubt solving, and
                  teacher interaction.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
