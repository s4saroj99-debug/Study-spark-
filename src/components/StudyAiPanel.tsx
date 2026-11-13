import React, { useEffect, useRef, useState } from 'react';
import {
  Sparkles,
  Send,
  ImagePlus,
  X,
  Trash2,
  Copy,
  Check,
  Loader2,
  BookOpen,
  Calculator,
  HelpCircle,
  ListChecks,
  FileText,
  AlertCircle,
} from 'lucide-react';
import {
  AiChatImage,
  AiChatMessage,
  AiStudyContext,
  AiStudyLanguage,
  AiStudyMode,
} from '../types';
import {
  askStudyAi,
  clearStoredAiHistory,
  fileToOptimizedAiImage,
  getStoredAiHistory,
  getStoredAiLanguage,
  saveStoredAiHistory,
  setStoredAiLanguage,
} from '../services/aiService';

interface StudyAiPanelProps {
  variant?: 'page' | 'drawer';
  context?: AiStudyContext;
  scopeKey?: string;
  onClose?: () => void;
}

const MODE_OPTIONS: Array<{
  id: AiStudyMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'doubt', label: 'Doubt Solver', icon: HelpCircle },
  { id: 'formula', label: 'Formula Sheet', icon: Calculator },
  { id: 'quiz', label: 'Practice MCQs', icon: ListChecks },
  { id: 'summary', label: 'Quick Revision', icon: FileText },
];

const LANG_OPTIONS: Array<{ id: AiStudyLanguage; label: string }> = [
  { id: 'hinglish', label: 'Hinglish' },
  { id: 'hindi', label: 'Hindi' },
  { id: 'english', label: 'English' },
];

function renderInlineFormatted(text: string): React.ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return tokens.map((tok, idx) => {
    if (tok.startsWith('**') && tok.endsWith('**') && tok.length > 4) {
      return (
        <strong key={idx} className="font-bold text-[var(--text-primary)]">
          {tok.slice(2, -2)}
        </strong>
      );
    }
    if (tok.startsWith('`') && tok.endsWith('`') && tok.length > 2) {
      return (
        <code
          key={idx}
          className="rounded bg-[var(--bg-tertiary)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--primary-color)]"
        >
          {tok.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={idx}>{tok}</React.Fragment>;
  });
}

function FormattedAiMessage({ text }: { text: string }) {
  const blocks = text.split(/```([\s\S]*?)```/g);

  return (
    <div className="space-y-2 text-xs sm:text-[13px] leading-relaxed text-[var(--text-primary)]">
      {blocks.map((block, bIdx) => {
        if (bIdx % 2 === 1) {
          const code = block.replace(/^[a-zA-Z]+\n/, '');
          return (
            <pre
              key={bIdx}
              className="overflow-x-auto rounded-xl border border-[var(--card-border)] bg-[var(--bg-primary)] p-3 font-mono text-[11px] text-emerald-300"
            >
              <code>{code.trim()}</code>
            </pre>
          );
        }

        const lines = block.split('\n');
        return (
          <div key={bIdx} className="space-y-1.5">
            {lines.map((rawLine, lIdx) => {
              const line = rawLine.trimEnd();
              if (!line.trim()) {
                return <div key={lIdx} className="h-1" />;
              }
              if (/^#{1,4}\s+/.test(line)) {
                const heading = line.replace(/^#{1,4}\s+/, '');
                return (
                  <h4
                    key={lIdx}
                    className="pt-1 font-['Sora'] text-xs sm:text-sm font-extrabold text-[var(--primary-color)]"
                  >
                    {renderInlineFormatted(heading)}
                  </h4>
                );
              }
              if (/^[-*•]\s+/.test(line.trim())) {
                const body = line.trim().replace(/^[-*•]\s+/, '');
                return (
                  <div key={lIdx} className="flex items-start gap-2 pl-1">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary-color)]" />
                    <div className="flex-1">{renderInlineFormatted(body)}</div>
                  </div>
                );
              }
              if (/^\d+[.)]\s+/.test(line.trim())) {
                const match = line.trim().match(/^(\d+[.)])\s+(.*)$/);
                if (match) {
                  return (
                    <div key={lIdx} className="flex items-start gap-2 pl-1">
                      <span className="shrink-0 font-mono text-[11px] font-bold text-[var(--primary-color)]">
                        {match[1]}
                      </span>
                      <div className="flex-1">{renderInlineFormatted(match[2])}</div>
                    </div>
                  );
                }
              }
              return <p key={lIdx}>{renderInlineFormatted(line)}</p>;
            })}
          </div>
        );
      })}
    </div>
  );
}

export const StudyAiPanel: React.FC<StudyAiPanelProps> = ({
  variant = 'page',
  context,
  scopeKey = 'global',
  onClose,
}) => {
  const [messages, setMessages] = useState<AiChatMessage[]>(() => getStoredAiHistory(scopeKey));
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<AiStudyMode>('doubt');
  const [language, setLanguage] = useState<AiStudyLanguage>(() => getStoredAiLanguage());
  const [pendingImage, setPendingImage] = useState<AiChatImage | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(getStoredAiHistory(scopeKey));
    setErrorMsg(null);
  }, [scopeKey]);

  useEffect(() => {
    saveStoredAiHistory(messages, scopeKey);
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, scopeKey]);

  const handleLanguageChange = (nextLang: AiStudyLanguage) => {
    setLanguage(nextLang);
    setStoredAiLanguage(nextLang);
  };

  const quickPrompts = (() => {
    const topicTarget =
      context?.lectureTitle ||
      context?.topicName ||
      context?.subjectName ||
      'Newton’s Laws / Electrochemistry';
    return [
      {
        label: 'Concept Samjhao',
        mode: 'doubt' as AiStudyMode,
        text: `${topicTarget} ka core concept simple Hinglish me step-by-step samjhao with 1 solved example.`,
      },
      {
        label: 'Formula Sheet',
        mode: 'formula' as AiStudyMode,
        text: `${topicTarget} ke sabhi important formulas, units aur exam shortcuts list karo.`,
      },
      {
        label: '5 Practice MCQs',
        mode: 'quiz' as AiStudyMode,
        text: `${topicTarget} par 5 JEE/NEET level MCQs do options aur detailed solutions ke saath.`,
      },
      {
        label: 'Quick Revision',
        mode: 'summary' as AiStudyMode,
        text: `${topicTarget} ke high-yield revision notes aur common exam mistakes batao.`,
      },
    ];
  })();

  const handlePickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErrorMsg(null);
    try {
      const img = await fileToOptimizedAiImage(file);
      setPendingImage(img);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not process image.');
    }
  };

  const handleSend = async (overrideText?: string, overrideMode?: AiStudyMode) => {
    const textToSend = (overrideText ?? input).trim();
    const activeMode = overrideMode ?? mode;
    if ((!textToSend && !pendingImage) || isSending) return;

    setErrorMsg(null);
    const userMsg: AiChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: textToSend || 'Is uploaded question ka step-by-step solution batao.',
      createdAt: Date.now(),
      image: pendingImage || undefined,
      mode: activeMode,
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    if (!overrideText) setInput('');
    setPendingImage(null);
    if (overrideMode) setMode(overrideMode);
    setIsSending(true);

    try {
      const reply = await askStudyAi({
        messages: nextHistory,
        context,
        mode: activeMode,
        language,
      });

      const aiMsg: AiChatMessage = {
        id: `m-${Date.now()}`,
        role: 'model',
        text: reply,
        createdAt: Date.now(),
        mode: activeMode,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Study AI se response nahi aa paya. Dobara try karein.');
    } finally {
      setIsSending(false);
    }
  };

  const handleClear = () => {
    setMessages([]);
    setErrorMsg(null);
    clearStoredAiHistory(scopeKey);
  };

  const handleCopy = (id: string, text: string) => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1800);
  };

  const hasContext = Boolean(
    context?.batchName || context?.subjectName || context?.topicName || context?.lectureTitle
  );

  return (
    <div
      className={
        variant === 'page'
          ? 'mx-auto flex h-[calc(100dvh-9rem)] sm:h-[calc(100dvh-6.5rem)] max-w-5xl flex-col overflow-hidden rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-sm'
          : 'flex h-full w-full flex-col overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)]'
      }
    >
      {/* Header Bar */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--card-border)] bg-[var(--bg-secondary)] px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 text-white shadow-md">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="font-['Sora'] text-sm sm:text-base font-extrabold text-[var(--text-primary)] truncate">
              Study AI Doubt Solver
            </h2>
            <p className="text-[11px] text-[var(--text-secondary)] truncate">
              {hasContext
                ? [context?.subjectName, context?.topicName, context?.lectureTitle]
                    .filter(Boolean)
                    .join(' · ') || context?.batchName
                : 'Physics, Chemistry, Maths, Bio & Exam Prep'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Language Switcher */}
          <div className="flex items-center rounded-xl border border-[var(--card-border)] bg-[var(--bg-tertiary)] p-0.5 text-[11px] font-bold">
            {LANG_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleLanguageChange(opt.id)}
                className={`rounded-lg px-2 py-1 transition ${
                  language === opt.id
                    ? 'bg-[var(--primary-color)] text-white shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--card-border)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-red-400 transition"
              title="Clear Chat"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--card-border)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:border-[var(--primary-color)] transition"
              title="Close Study AI"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Mode Selector + Context Strip */}
      <div className="shrink-0 border-b border-[var(--card-border)] bg-[var(--bg-primary)]/60 px-3 sm:px-4 py-2 space-y-2">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {MODE_OPTIONS.map((m) => {
            const Icon = m.icon;
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-bold transition ${
                  active
                    ? 'bg-[var(--primary-color)] text-white shadow-sm'
                    : 'border border-[var(--card-border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>

        {hasContext && context?.batchName && (
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] truncate">
            <BookOpen className="h-3.5 w-3.5 shrink-0 text-[var(--primary-color)]" />
            <span className="font-semibold text-[var(--text-primary)] truncate">
              {context.batchName}
            </span>
          </div>
        )}
      </div>

      {/* Chat Messages Area */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center py-6 px-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/15 text-[var(--primary-color)] mb-3">
              <Sparkles className="h-7 w-7" />
            </div>
            <h3 className="font-['Sora'] text-base sm:text-lg font-extrabold text-[var(--text-primary)]">
              Apna Doubt Poocho — Step-by-Step Solution
            </h3>
            <p className="mt-1 max-w-md text-xs text-[var(--text-secondary)] leading-relaxed">
              Koi bhi question type karo ya textbook/notebook ki photo upload karo. Concept
              explanation, formula sheet, aur JEE/NEET practice MCQs sab yahin milega.
            </p>

            {/* Quick Start Prompts */}
            <div className="mt-5 grid w-full max-w-xl grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
              {quickPrompts.map((qp) => (
                <button
                  key={qp.label}
                  type="button"
                  onClick={() => handleSend(qp.text, qp.mode)}
                  className="group rounded-2xl border border-[var(--card-border)] bg-[var(--bg-secondary)] p-3 transition hover:border-[var(--primary-color)] hover:bg-[var(--bg-tertiary)]"
                >
                  <div className="text-xs font-bold text-[var(--primary-color)]">{qp.label}</div>
                  <div className="mt-0.5 text-[11px] text-[var(--text-secondary)] line-clamp-2">
                    {qp.text}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[92%] sm:max-w-[82%] rounded-2xl px-3.5 py-2.5 ${
                    isUser
                      ? 'bg-[var(--primary-color)] text-white shadow-sm'
                      : 'border border-[var(--card-border)] bg-[var(--bg-secondary)] text-[var(--text-primary)]'
                  }`}
                >
                  {msg.image?.previewUrl && (
                    <img
                      src={msg.image.previewUrl}
                      alt="Uploaded question"
                      className="mb-2 max-h-48 rounded-xl border border-white/15 object-contain"
                    />
                  )}

                  {isUser ? (
                    <p className="text-xs sm:text-[13px] whitespace-pre-wrap leading-relaxed">
                      {msg.text}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <FormattedAiMessage text={msg.text} />
                      <div className="flex items-center justify-end border-t border-[var(--card-border)]/70 pt-1.5">
                        <button
                          type="button"
                          onClick={() => handleCopy(msg.id, msg.text)}
                          className="flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {isSending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl border border-[var(--card-border)] bg-[var(--bg-secondary)] px-4 py-2.5 text-xs text-[var(--text-secondary)]">
              <Loader2 className="h-4 w-4 animate-spin text-[var(--primary-color)]" />
              <span>Study AI soch raha hai...</span>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="flex items-start gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Composer */}
      <div className="shrink-0 border-t border-[var(--card-border)] bg-[var(--bg-secondary)] p-3">
        {pendingImage && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-[var(--card-border)] bg-[var(--bg-tertiary)] p-2">
            <img
              src={pendingImage.previewUrl}
              alt="Question preview"
              className="h-12 w-12 rounded-lg object-cover"
            />
            <span className="flex-1 text-xs font-semibold text-[var(--text-primary)] truncate">
              Question image attached
            </span>
            <button
              type="button"
              onClick={() => setPendingImage(null)}
              className="rounded-lg p-1 text-[var(--text-secondary)] hover:text-red-400"
              title="Remove image"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-end gap-2"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePickImage}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSending}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--card-border)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:border-[var(--primary-color)] hover:text-[var(--primary-color)] disabled:opacity-50 transition"
            title="Upload Question Photo"
          >
            <ImagePlus className="h-4 w-4" />
          </button>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={1}
            placeholder="Apna doubt likho (e.g. Derive Gauss Law ya ye numerical solve karo)..."
            className="max-h-28 min-h-[40px] flex-1 resize-none rounded-xl border border-[var(--card-border)] bg-[var(--bg-primary)] px-3.5 py-2.5 text-xs sm:text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:border-[var(--primary-color)] focus:outline-none"
          />

          <button
            type="submit"
            disabled={isSending || (!input.trim() && !pendingImage)}
            className="flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[var(--primary-color)] px-4 text-xs font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-50 transition active:scale-95"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Ask</span>
          </button>
        </form>
      </div>
    </div>
  );
};
