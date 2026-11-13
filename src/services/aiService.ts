import {
  AiChatImage,
  AiChatMessage,
  AiStudyContext,
  AiStudyLanguage,
  AiStudyMode,
} from '../types';

const AI_HISTORY_KEY = 'vidcloud_study_ai_history_v1';
const AI_LANG_KEY = 'vidcloud_study_ai_lang_v1';

export function getStoredAiLanguage(): AiStudyLanguage {
  try {
    const val = localStorage.getItem(AI_LANG_KEY);
    if (val === 'hindi' || val === 'english' || val === 'hinglish') return val;
    return 'hinglish';
  } catch {
    return 'hinglish';
  }
}

export function setStoredAiLanguage(lang: AiStudyLanguage): void {
  try {
    localStorage.setItem(AI_LANG_KEY, lang);
  } catch {
    // ignore storage errors
  }
}

export function getStoredAiHistory(scopeKey = 'global'): AiChatMessage[] {
  try {
    const raw = localStorage.getItem(`${AI_HISTORY_KEY}:${scopeKey}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoredAiHistory(messages: AiChatMessage[], scopeKey = 'global'): void {
  try {
    // Persist recent 24 messages without heavy raw base64 payloads so localStorage stays lean
    const lean = messages.slice(-24).map((m) => ({
      id: m.id,
      role: m.role,
      text: m.text,
      createdAt: m.createdAt,
      mode: m.mode,
    }));
    localStorage.setItem(`${AI_HISTORY_KEY}:${scopeKey}`, JSON.stringify(lean));
  } catch {
    // ignore quota errors
  }
}

export function clearStoredAiHistory(scopeKey = 'global'): void {
  try {
    localStorage.removeItem(`${AI_HISTORY_KEY}:${scopeKey}`);
  } catch {
    // ignore
  }
}

export async function fileToOptimizedAiImage(file: File): Promise<AiChatImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please upload an image file (JPG, PNG, or WebP).');
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error('Image is too large. Please pick an image under 15 MB.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.onload = () => {
        const maxDim = 1400;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          const base64 = dataUrl.split(',')[1] || '';
          resolve({ mimeType: file.type || 'image/jpeg', data: base64, previewUrl: dataUrl });
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const outMime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const outUrl = canvas.toDataURL(outMime, 0.85);
        const base64 = outUrl.split(',')[1] || '';
        resolve({
          mimeType: outMime,
          data: base64,
          previewUrl: outUrl,
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export async function askStudyAi(params: {
  messages: AiChatMessage[];
  context?: AiStudyContext;
  mode?: AiStudyMode;
  language?: AiStudyLanguage;
}): Promise<string> {
  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: params.messages.map((m) => ({
        role: m.role,
        text: m.text,
        ...(m.image?.mimeType && m.image?.data
          ? { image: { mimeType: m.image.mimeType, data: m.image.data } }
          : {}),
      })),
      context: params.context || {},
      mode: params.mode || 'doubt',
      language: params.language || 'hinglish',
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success || !data?.reply) {
    throw new Error(data?.message || `Study AI returned error (${res.status}).`);
  }
  return String(data.reply);
}
