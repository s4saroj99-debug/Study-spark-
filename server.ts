import express from 'express';
import http from 'http';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Content, Part } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const API_BASE = 'https://vidcloud.eu.org/api';
const AES_KEY = Buffer.from('UjdAa1A0I3hMOSFtUTIkdg==', 'base64');
const AES_IV = Buffer.from('VDMhblc4JHFaNUBySzEjcA==', 'base64');

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// Server-side token cache
let cachedToken: string | null = null;
let tokenFetchedAt = 0;
const TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Server-side batches cache
let cachedBatchesPayload: any = null;
let batchesFetchedAt = 0;
const BATCHES_TTL_MS = 60 * 60 * 1000; // 1 hour

async function getBearerToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedToken && Date.now() - tokenFetchedAt < TOKEN_TTL_MS) {
    return cachedToken;
  }
  try {
    const res = await fetch(`https://vidcloud.eu.org/generate_token.php?_t=${Date.now()}`, {
      headers: {
        'User-Agent': USER_AGENT,
        Referer: 'https://vidcloud.eu.org/',
      },
    });
    if (!res.ok) {
      if (cachedToken) return cachedToken;
      throw new Error(`Token fetch failed with status ${res.status}`);
    }
    const json = (await res.json().catch(() => ({}))) as any;
    const token = json.access_token || json.token;
    if (!token) {
      // generate_token.php sometimes rate-limits rapid requests; keep existing valid token if available
      if (cachedToken) return cachedToken;
      throw new Error('Token missing from generate_token.php response');
    }
    cachedToken = token;
    tokenFetchedAt = Date.now();
    return token;
  } catch (err) {
    if (cachedToken) return cachedToken;
    throw err;
  }
}

function sortBatchesNewestFirst(list: any[]): any[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const deduped: any[] = [];
  for (const item of list) {
    const id = item?.batch_id || item?._id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    deduped.push(item);
  }
  return deduped.sort((a, b) => {
    const ta = a?.start_date ? Date.parse(a.start_date) : 0;
    const tb = b?.start_date ? Date.parse(b.start_date) : 0;
    const va = Number.isFinite(ta) ? ta : 0;
    const vb = Number.isFinite(tb) ? tb : 0;
    return vb - va;
  });
}

function buildPwHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
    'Client-Id': '5eb393ee95fab7468a79d189',
    'Client-Type': 'WEB',
    'Client-Version': '2.1.6',
    Origin: 'https://www.pw.live',
    Referer: 'https://www.pw.live/',
    Randomid: crypto.randomUUID(),
    Version: '0.0.1',
    'User-Agent': USER_AGENT,
  };
}

const UNLOCK_CONTENTS_BATCH_ID = '634bd315ed7a360018558283';
const scheduleCache = new Map<string, { data: any; savedAt: number }>();
const SCHEDULE_CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

async function fetchVidcloudApiRaw(
  apiPath: string
): Promise<{ ok: boolean; status: number; data: any; errorText: string }> {
  let token = await getBearerToken(false);
  let res = await fetch(`${API_BASE}${apiPath}`, {
    headers: buildPwHeaders(token),
  });

  // Refresh bearer token ONLY on 401 (expired/invalid token), NOT 403 (scope restriction),
  // to avoid hammering generate_token.php into a 429 cooldown.
  if (res.status === 401) {
    token = await getBearerToken(true);
    res = await fetch(`${API_BASE}${apiPath}`, {
      headers: buildPwHeaders(token),
    });
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return { ok: false, status: res.status, data: null, errorText: errText };
  }
  const data = await res.json().catch(() => null);
  return { ok: true, status: res.status, data, errorText: '' };
}

async function fetchVidcloudApi(apiPath: string): Promise<any> {
  const result = await fetchVidcloudApiRaw(apiPath);
  if (!result.ok) {
    throw new Error(`API ${apiPath} returned ${result.status}: ${result.errorText.slice(0, 200)}`);
  }
  return result.data;
}

function normalizeAttachment(att: any) {
  const rawBase = String(att?.baseUrl || '').replace(/^https?:\/\/cors\.testfile\.eu\.org\//i, 'https://');
  const key = String(att?.key || '').trim();
  const resolvedUrl = att?.url
    ? String(att.url).replace(/^https?:\/\/cors\.testfile\.eu\.org\//i, 'https://')
    : rawBase && key
    ? `${rawBase.endsWith('/') ? rawBase : `${rawBase}/`}${key.replace(/^\//, '')}`
    : '';
  return {
    ...att,
    baseUrl: rawBase,
    key,
    resolvedUrl,
  };
}

function normalizeNoteItems(items: any[]): any[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    ...item,
    homeworkIds: Array.isArray(item?.homeworkIds)
      ? item.homeworkIds.map((hw: any) => ({
          ...hw,
          attachmentIds: Array.isArray(hw?.attachmentIds)
            ? hw.attachmentIds.map(normalizeAttachment)
            : [],
        }))
      : [],
  }));
}

function getIstDateKey(isoStr?: string): string {
  if (!isoStr) return '';
  const ts = Date.parse(isoStr);
  if (!Number.isFinite(ts)) return '';
  const ist = new Date(ts + 330 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

function mergeScheduleById(primary: any[], secondary: any[]): any[] {
  const seen = new Set<string>();
  const merged: any[] = [];
  for (const item of [...primary, ...secondary]) {
    if (!item?._id) continue;
    const id = String(item._id);
    if (seen.has(id)) continue;
    seen.add(id);
    merged.push(item);
  }
  return merged.sort((a, b) => {
    const ta = Date.parse(a?.startTime || a?.date || '') || 0;
    const tb = Date.parse(b?.startTime || b?.date || '') || 0;
    return ta - tb;
  });
}

function buildTeacherAndSubjectMaps(details: any) {
  const teacherMap = new Map<string, string>();
  const subjectById = new Map<string, { name: string; slug: string }>();

  const subjects = Array.isArray(details?.subjects) ? details.subjects : [];
  for (const subj of subjects) {
    if (subj?._id) {
      subjectById.set(String(subj._id), {
        name: subj.subject || subj.name || 'Subject',
        slug: subj.slug || String(subj._id),
      });
    }
    const tList = Array.isArray(subj?.teacherIds) ? subj.teacherIds : [];
    for (const t of tList) {
      if (t?._id) {
        const fullName = [t.firstName, t.lastName].filter(Boolean).join(' ').trim();
        if (fullName) teacherMap.set(String(t._id), fullName);
      }
    }
  }
  return { teacherMap, subjectById };
}

function enrichScheduleItems(items: any[], details: any): any[] {
  const { teacherMap, subjectById } = buildTeacherAndSubjectMaps(details);
  const now = Date.now();

  return items.map((rawItem) => {
    const outerType = String(rawItem?.type || '').toUpperCase();
    const wrapper =
      rawItem?.bulkScheduleDetails ||
      rawItem?.scheduleDetails ||
      rawItem?.notesDetails ||
      (rawItem?.videoDetails && (rawItem.videoDetails.startTime || rawItem.videoDetails.date || rawItem.videoDetails.topic)
        ? rawItem.videoDetails
        : null);
    const item = wrapper ? { ...rawItem, ...wrapper, _id: rawItem._id || wrapper._id, type: rawItem.type || wrapper.type } : rawItem;

    const subjMeta =
      (item?.batchSubjectId && subjectById.get(String(item.batchSubjectId))) ||
      (item?.subjectId?._id && subjectById.get(String(item.subjectId._id))) ||
      null;
    const subjectName = item?.subjectId?.name || subjMeta?.name || 'General';
    const subjectSlug = item?.subjectId?.slug || subjMeta?.slug || String(item?.batchSubjectId || '');

    const rawTeachers = Array.isArray(item?.teachers) ? item.teachers : [];
    const teacherNames = rawTeachers
      .map((t: any) => {
        if (typeof t === 'string') return teacherMap.get(t) || '';
        const name = [t?.firstName, t?.lastName].filter(Boolean).join(' ').trim() || t?.name || '';
        return name;
      })
      .filter(Boolean);

    const startTs = Date.parse(item?.startTime || item?.date || '') || 0;
    const endTs = Date.parse(item?.endTime || '') || (startTs ? startTs + 2 * 60 * 60 * 1000 : 0);
    const rawStatus = String(item?.status || '').toUpperCase();
    let liveStatus: 'LIVE' | 'UPCOMING' | 'COMPLETED' = 'COMPLETED';
    if (startTs && endTs && now >= startTs && now <= endTs && rawStatus !== 'COMPLETED' && rawStatus !== 'CANCELED') {
      liveStatus = 'LIVE';
    } else if (startTs && now < startTs) {
      liveStatus = 'UPCOMING';
    } else if (rawStatus === 'PENDING' && startTs > now) {
      liveStatus = 'UPCOMING';
    } else if (rawStatus === 'LIVE') {
      liveStatus = 'LIVE';
    }

    const homeworkList = Array.isArray(item?.homeworkIds)
      ? item.homeworkIds.map((hw: any) => ({
          ...hw,
          attachmentIds: Array.isArray(hw?.attachmentIds)
            ? hw.attachmentIds.map(normalizeAttachment)
            : [],
        }))
      : [];

    const firstTag = Array.isArray(item?.tags) && item.tags.length > 0 ? item.tags[0] : null;
    const dateKey = getIstDateKey(item?.startTime || item?.date);
    const resolvedTopic =
      item?.topic ||
      item?.videoDetails?.name ||
      homeworkList[0]?.topic ||
      rawItem?.topic ||
      'Scheduled Session';

    return {
      ...item,
      type: outerType || item?.type,
      topic: resolvedTopic,
      dateKey,
      subjectName,
      subjectSlug,
      topicName: firstTag?.name || '',
      topicId: firstTag?._id || '',
      teacherNames,
      liveStatus,
      homeworkIds: homeworkList,
    };
  }).sort((a, b) => {
    const ta = Date.parse(a?.startTime || a?.date || '') || 0;
    const tb = Date.parse(b?.startTime || b?.date || '') || 0;
    return ta - tb;
  });
}

function enrichRoutineItems(items: any[], details: any): any[] {
  const { teacherMap } = buildTeacherAndSubjectMaps(details);
  return items
    .map((r) => ({
      ...r,
      teacherNames: (Array.isArray(r.teachers) ? r.teachers : [])
        .map((t: any) => (typeof t === 'string' ? teacherMap.get(t) || '' : t?.name || ''))
        .filter(Boolean),
    }))
    .sort((a, b) => a.weekday - b.weekday);
}

function decryptAesCbc(b64: string): string {
  if (!b64 || !b64.trim()) return '';
  const trimmed = b64.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  try {
    const decipher = crypto.createDecipheriv('aes-128-cbc', AES_KEY, AES_IV);
    let out = decipher.update(trimmed, 'base64', 'utf8');
    out += decipher.final('utf8');
    return out;
  } catch {
    return '';
  }
}

function extractHiddenInput(html: string, id: string): string {
  const re = new RegExp(`<input[^>]*id=["']${id}["'][^>]*value=["']([^"']*)["']`, 'i');
  const m = html.match(re);
  if (m) return decodeHtmlEntities(m[1]);
  const reAlt = new RegExp(`<input[^>]*value=["']([^"']*)["'][^>]*id=["']${id}["']`, 'i');
  const mAlt = html.match(reAlt);
  return mAlt ? decodeHtmlEntities(mAlt[1]) : '';
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'");
}

function b64UrlToHex(b64url: string): string {
  if (!b64url) return '';
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64').toString('hex');
}

function extractYoutubeEmbed(url: string): string | null {
  if (!url) return null;
  const regExp = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i;
  const match = url.match(regExp);
  if (match && match[1]) {
    return `https://www.youtube.com/embed/${match[1]}?autoplay=1&rel=0`;
  }
  return null;
}

function isAllowedProxyHost(targetUrl: string): boolean {
  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    const h = parsed.hostname.toLowerCase();
    // Block localhost/private metadata IPs
    if (
      h === 'localhost' ||
      h === '127.0.0.1' ||
      h === '0.0.0.0' ||
      h.startsWith('10.') ||
      h.startsWith('192.168.') ||
      h.startsWith('169.254.') ||
      h.endsWith('.local')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  app.use(express.json({ limit: '10mb' }));

  // 1. Batches catalog proxy & cache (full catalog, newest batches sorted first)
  app.get('/api/batches', async (_req, res) => {
    try {
      if (cachedBatchesPayload && Date.now() - batchesFetchedAt < BATCHES_TTL_MS) {
        return res.json(cachedBatchesPayload);
      }
      const r = await fetch(`https://studystark.github.io/batches/batches.json?_t=${Date.now()}`, {
        headers: { 'User-Agent': USER_AGENT },
      });
      if (!r.ok) {
        if (cachedBatchesPayload) return res.json(cachedBatchesPayload);
        return res.status(r.status).json({ success: false, message: 'Failed to load batches catalog' });
      }
      const json = (await r.json()) as any;
      const normalized = {
        ...json,
        data: sortBatchesNewestFirst(json?.data || []),
        vidyapeeth_batches: sortBatchesNewestFirst(json?.vidyapeeth_batches || []),
      };
      cachedBatchesPayload = normalized;
      batchesFetchedAt = Date.now();
      return res.json(normalized);
    } catch (err: any) {
      if (cachedBatchesPayload) return res.json(cachedBatchesPayload);
      return res.status(500).json({ success: false, message: err?.message || 'Batches load error' });
    }
  });

  // 2. Batch details + subjects + announcements + mahapack mapping
  app.get('/api/batch/:batchId', async (req, res) => {
    const { batchId } = req.params;
    try {
      const [detailsRes, announcementsRes] = await Promise.allSettled([
        fetchVidcloudApi(`/v3/batches/${encodeURIComponent(batchId)}/details?type=EXPLORE_LEAD`),
        fetchVidcloudApi(`/v1/batches/${encodeURIComponent(batchId)}/announcement?page=1`),
      ]);

      const details = detailsRes.status === 'fulfilled' ? detailsRes.value?.data || null : null;
      const announcements =
        announcementsRes.status === 'fulfilled' && Array.isArray(announcementsRes.value?.data)
          ? announcementsRes.value.data
          : [];

      let mahapackBatches: any[] = [];
      if (!details?.subjects?.length || details?.type === 'MAHAPACK') {
        try {
          const mp = await fetchVidcloudApi(
            `/v3/batch-service/mahapack-mapping?mahapackId=${encodeURIComponent(batchId)}&page=1`
          );
          if (Array.isArray(mp?.data)) {
            mahapackBatches = mp.data;
          }
        } catch {
          // ignore if not a mahapack
        }
      }

      return res.json({
        success: true,
        batch: details,
        subjects: details?.subjects || [],
        mahapackBatches,
        announcements,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to fetch batch details' });
    }
  });

  // 3. Subject chapters / topics
  app.get('/api/topics/:batchId/:subjectId', async (req, res) => {
    const { batchId, subjectId } = req.params;
    const page = req.query.page || '1';
    try {
      const data = await fetchVidcloudApi(
        `/v2/batches/${encodeURIComponent(batchId)}/subject/${encodeURIComponent(subjectId)}/topics?page=${encodeURIComponent(String(page))}`
      );
      return res.json({
        success: true,
        topics: Array.isArray(data?.data) ? data.data : [],
        paginate: data?.paginate || null,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to fetch topics' });
    }
  });

  // 4. Chapter contents (videos, notes, DppNotes, DppVideos)
  app.get('/api/contents/:batchId/:subjectId', async (req, res) => {
    const { batchId, subjectId } = req.params;
    const topicId = String(req.query.topicId || '');
    const contentType = String(req.query.contentType || 'videos');
    const page = String(req.query.page || '1');
    const isNotesType = contentType === 'notes' || contentType === 'DppNotes';

    try {
      let data: any = null;

      if (isNotesType) {
        // PW strips attachment `key` on unpaid batchIds, while querying the unlocked prefix returns real PDF keys
        const unlockedRes = await fetchVidcloudApiRaw(
          `/v2/batches/${UNLOCK_CONTENTS_BATCH_ID}/subject/${encodeURIComponent(subjectId)}/contents?tag=${encodeURIComponent(topicId)}&contentType=${encodeURIComponent(contentType)}&page=${encodeURIComponent(page)}`
        );
        if (unlockedRes.ok && Array.isArray(unlockedRes.data?.data) && unlockedRes.data.data.length > 0) {
          data = unlockedRes.data;
        }
      }

      if (!data) {
        data = await fetchVidcloudApi(
          `/v2/batches/${encodeURIComponent(batchId)}/subject/${encodeURIComponent(subjectId)}/contents?tag=${encodeURIComponent(topicId)}&contentType=${encodeURIComponent(contentType)}&page=${encodeURIComponent(page)}`
        );
      }

      const rawItems = Array.isArray(data?.data) ? data.data : [];
      const items = isNotesType ? normalizeNoteItems(rawItems) : rawItems;

      return res.json({
        success: true,
        items,
        paginate: data?.paginate || null,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to fetch contents' });
    }
  });

  // 4b. Today's Schedule (live PW todays-schedule + teacher/subject enrichment)
  app.get('/api/schedule/:batchId/today', async (req, res) => {
    const { batchId } = req.params;
    const cacheKey = `today:${batchId}`;
    const cached = scheduleCache.get(cacheKey);
    if (cached && Date.now() - cached.savedAt < SCHEDULE_CACHE_TTL_MS) {
      return res.json(cached.data);
    }

    try {
      const [detailsRes, v1Res] = await Promise.allSettled([
        fetchVidcloudApiRaw(`/v3/batches/${encodeURIComponent(batchId)}/details?type=EXPLORE_LEAD`),
        fetchVidcloudApiRaw(
          `/v1/batches/${encodeURIComponent(batchId)}/todays-schedule?batchId=${encodeURIComponent(batchId)}&isNewStudyMaterialFlow=true`
        ),
      ]);

      const details = detailsRes.status === 'fulfilled' && detailsRes.value.ok ? detailsRes.value.data?.data : null;
      let items: any[] =
        v1Res.status === 'fulfilled' && v1Res.value.ok && Array.isArray(v1Res.value.data?.data)
          ? v1Res.value.data.data
          : [];

      if (items.length === 0) {
        const v2Res = await fetchVidcloudApiRaw(`/v2/batches/${encodeURIComponent(batchId)}/todays-schedule`);
        if (v2Res.ok && Array.isArray(v2Res.data?.data)) {
          items = v2Res.data.data;
        }
      }

      const enriched = enrichScheduleItems(items, details);
      const payload = {
        success: true,
        source: 'live-todays-schedule',
        date: new Date().toISOString().slice(0, 10),
        classes: enriched,
      };
      scheduleCache.set(cacheKey, { data: payload, savedAt: Date.now() });
      return res.json(payload);
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to fetch today schedule' });
    }
  });

  // 4c. Weekly Schedule (tries PW weekly-schedules, falls back gracefully to real dated classes + todays-schedule)
  app.get('/api/schedule/:batchId/weekly', async (req, res) => {
    const { batchId } = req.params;
    const startDate = String(req.query.startDate || '').slice(0, 10);
    const endDate = String(req.query.endDate || '').slice(0, 10);
    const page = String(req.query.page || '1');

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'startDate and endDate (YYYY-MM-DD) are required' });
    }

    const cacheKey = `weekly:${batchId}:${startDate}:${endDate}:${page}`;
    const cached = scheduleCache.get(cacheKey);
    if (cached && Date.now() - cached.savedAt < SCHEDULE_CACHE_TTL_MS) {
      return res.json(cached.data);
    }

    try {
      const [detailsRes, todayRes, w2Res] = await Promise.allSettled([
        fetchVidcloudApiRaw(`/v3/batches/${encodeURIComponent(batchId)}/details?type=EXPLORE_LEAD`),
        fetchVidcloudApiRaw(
          `/v1/batches/${encodeURIComponent(batchId)}/todays-schedule?batchId=${encodeURIComponent(batchId)}&isNewStudyMaterialFlow=true`
        ),
        fetchVidcloudApiRaw(
          `/v2/batches/${encodeURIComponent(batchId)}/weekly-schedules?batchId=${encodeURIComponent(batchId)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&page=${encodeURIComponent(page)}`
        ),
      ]);

      const details = detailsRes.status === 'fulfilled' && detailsRes.value.ok ? detailsRes.value.data?.data : null;
      const todayRaw: any[] =
        todayRes.status === 'fulfilled' && todayRes.value.ok && Array.isArray(todayRes.value.data?.data)
          ? todayRes.value.data.data
          : [];

      if (w2Res.status === 'fulfilled' && w2Res.value.ok && Array.isArray(w2Res.value.data?.data)) {
        let weekItems = [...w2Res.value.data.data];
        // PW paginates weekly-schedules cleanly (~6-10 per page); fetch page 2 & 3 so full Mon-Sun appears
        if (page === '1' && weekItems.length >= 6) {
          for (const extraPage of [2, 3]) {
            const extraRes = await fetchVidcloudApiRaw(
              `/v2/batches/${encodeURIComponent(batchId)}/weekly-schedules?batchId=${encodeURIComponent(batchId)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&page=${extraPage}`
            );
            if (extraRes.ok && Array.isArray(extraRes.data?.data) && extraRes.data.data.length > 0) {
              weekItems.push(...extraRes.data.data);
            } else {
              break;
            }
          }
        }
        const merged = mergeScheduleById(todayRaw, weekItems);
        const payload = {
          success: true,
          source: 'weekly-schedules',
          classes: enrichScheduleItems(merged, details),
          weeklyRoutine: [],
        };
        scheduleCache.set(cacheKey, { data: payload, savedAt: Date.now() });
        return res.json(payload);
      }

      // Upstream weekly-schedules returned 403 Scope Access: derive real dated classes from batch subjects' latest lectures + today's live classes
      const academicSubjects = (details?.subjects || []).filter(
        (s: any) =>
          s?.slug &&
          !/notice|guidance|orientation|planner/i.test(String(s.subject || ''))
      );

      const collectedLectures: any[] = [];
      for (const subj of academicSubjects.slice(0, 6)) {
        try {
          const tRes = await fetchVidcloudApiRaw(
            `/v2/batches/${encodeURIComponent(batchId)}/subject/${encodeURIComponent(subj.slug)}/topics?page=1`
          );
          const topicsList: any[] = tRes.ok && Array.isArray(tRes.data?.data) ? tRes.data.data : [];
          // Pick most recent active topics that actually have videos
          const activeTopics = topicsList.filter((t) => (t?.videos || 0) > 0).slice(0, 2);
          for (const topic of activeTopics) {
            const cRes = await fetchVidcloudApiRaw(
              `/v2/batches/${encodeURIComponent(batchId)}/subject/${encodeURIComponent(subj.slug)}/contents?tag=${encodeURIComponent(topic._id)}&contentType=videos&page=1`
            );
            const vids: any[] = cRes.ok && Array.isArray(cRes.data?.data) ? cRes.data.data : [];
            for (const v of vids) {
              collectedLectures.push({
                ...v,
                batchSubjectId: subj._id,
                subjectId: { _id: subj._id, name: subj.subject, slug: subj.slug },
                tags: Array.isArray(v.tags) && v.tags.length > 0 ? v.tags : [{ _id: topic._id, name: topic.name }],
              });
            }
          }
        } catch {
          // continue cleanly across subjects
        }
      }

      // Filter dated classes within [startDate, endDate] (buffered +-1 day for IST timezone)
      const inRangeLectures = collectedLectures.filter((item) => {
        const dStr = getIstDateKey(item.startTime || item.date);
        return dStr && dStr >= startDate && dStr <= endDate;
      });

      // Build typical weekday timetable per subject from real uploaded lecture timestamps
      const routineMap = new Map<string, any>();
      for (const item of collectedLectures) {
        const refTime = item.startTime || item.date;
        if (!refTime) continue;
        const dt = new Date(refTime);
        if (Number.isNaN(dt.getTime())) continue;
        // Convert UTC to IST (UTC+5:30)
        const ist = new Date(dt.getTime() + 330 * 60 * 1000);
        const weekday = ist.getUTCDay(); // 0=Sun..6=Sat
        const subjName = item.subjectId?.name || 'Subject';
        const key = `${weekday}:${subjName}`;
        if (!routineMap.has(key)) {
          routineMap.set(key, {
            weekday,
            subjectName: subjName,
            subjectSlug: item.subjectId?.slug || '',
            batchSubjectId: item.batchSubjectId || '',
            startTime: item.startTime || item.date,
            endTime: item.endTime || '',
            sampleTopic: item.topic || '',
            teachers: item.teachers || [],
          });
        }
      }

      const merged = mergeScheduleById(todayRaw, inRangeLectures);
      const enriched = enrichScheduleItems(merged, details);
      const enrichedRoutine = enrichRoutineItems(Array.from(routineMap.values()), details);

      const payload = {
        success: true,
        source: 'subject-timetable-fallback',
        classes: enriched,
        weeklyRoutine: enrichedRoutine,
      };
      scheduleCache.set(cacheKey, { data: payload, savedAt: Date.now() });
      return res.json(payload);
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to fetch weekly schedule' });
    }
  });

  // 5. Resolve real video stream (passes token+cookie to play.php, retries transient failures, decrypts AES-128-CBC + attachments)
  app.get('/api/stream', async (req, res) => {
    const batchId = String(req.query.batch_id || '');
    const subjectId = String(req.query.subject_id || '');
    const topicId = String(req.query.topic_id || '');
    const videoId = String(req.query.video_id || '');
    const findKey = String(req.query.find_key || '');
    const videoDetailsId = String(req.query.video_details_id || '');
    const videoName = String(req.query.video_name || 'Lecture');
    const videoImg = String(req.query.video_img || '');
    const videoType = String(req.query.video_type || 'new');
    const playType = String(req.query.play_type || 'Lecture');
    const rawVideoUrl = String(req.query.video_url || '');
    const typeId = String(req.query.typeId || '');

    try {
      // Handle YouTube URLs directly (by videoType OR by URL pattern)
      const directYt = extractYoutubeEmbed(rawVideoUrl);
      if ((videoType === 'youtube' && rawVideoUrl) || directYt) {
        return res.json({
          success: true,
          isYoutube: true,
          youtubeEmbedUrl: directYt || rawVideoUrl,
          rawUrl: rawVideoUrl,
          attachments: [],
        });
      }

      const candidateIds = Array.from(
        new Set([videoId, findKey, videoDetailsId].filter((id) => Boolean(id && id.trim())))
      );

      let token = '';
      try {
        token = await getBearerToken(false);
      } catch {
        // play.php may still work with its server pool
      }

      let resolvedUrl = '';
      let keyIdB64 = '';
      let keyValB64 = '';
      let drmType = '';
      let attachmentsRaw = '';

      const tryPlayPhp = async (candidateVid: string, currentToken: string) => {
        const params = new URLSearchParams({
          batch_id: batchId,
          subject_id: subjectId,
          topic_id: topicId,
          video_id: candidateVid,
          video_name: videoName,
          video_img: videoImg,
          video_type: videoType,
          play_type: playType,
        });
        if (typeId) params.set('typeId', typeId);
        if (currentToken) params.set('token', currentToken);

        const playUrl = `https://vidcloud.eu.org/play.php?${params.toString()}`;
        const playRes = await fetch(playUrl, {
          headers: {
            'User-Agent': USER_AGENT,
            Referer: 'https://vidcloud.eu.org/',
            ...(currentToken ? { Cookie: `token=${currentToken}; access_token=${currentToken}` } : {}),
          },
        });
        if (!playRes.ok) {
          return { ok: false, status: playRes.status };
        }
        const html = await playRes.text();

        const encVideoUrl = extractHiddenInput(html, 'enc_video_url');
        const encStatusUrl = extractHiddenInput(html, 'enc_status_url');
        const encKeyId = extractHiddenInput(html, 'enc_key_id');
        const encKeyValue = extractHiddenInput(html, 'enc_key_value');
        const encDrmType = extractHiddenInput(html, 'enc_drm_type');
        const attRaw = extractHiddenInput(html, 'attachments_data');

        let urlOut = decryptAesCbc(encVideoUrl);
        const kId = decryptAesCbc(encKeyId);
        const kVal = decryptAesCbc(encKeyValue);
        const dType = decryptAesCbc(encDrmType);

        if (!urlOut && encStatusUrl) {
          const statusUrl = decryptAesCbc(encStatusUrl) || encStatusUrl;
          if (statusUrl.startsWith('http')) {
            for (let i = 0; i < 12; i++) {
              await new Promise((r) => setTimeout(r, 1100));
              const stRes = await fetch(statusUrl, {
                headers: {
                  'User-Agent': USER_AGENT,
                  Referer: 'https://vidcloud.eu.org/',
                  ...(currentToken ? { Cookie: `token=${currentToken}; access_token=${currentToken}` } : {}),
                },
              }).catch(() => null);
              if (stRes && stRes.ok) {
                const stJson = (await stRes.json().catch(() => null)) as any;
                const cand = stJson?.video_url || stJson?.url || '';
                if (stJson?.status === 'success' && cand) {
                  urlOut = decryptAesCbc(cand) || cand;
                  break;
                }
              }
            }
          }
        }

        return {
          ok: Boolean(urlOut),
          urlOut,
          kId,
          kVal,
          dType,
          attRaw,
          isExpiredPage: html.includes('token has expired') || html.includes('Video Not Available'),
        };
      };

      // Up to 5 attempts alternating cached token, upstream server pool (no token), and refreshed token
      // to avoid reusing a 429 rate-limited PenPencil token.
      const backoffMs = [0, 400, 800, 1200, 1600];
      for (let attempt = 0; attempt < backoffMs.length && !resolvedUrl; attempt++) {
        if (backoffMs[attempt] > 0) {
          await new Promise((r) => setTimeout(r, backoffMs[attempt]));
        }

        let attemptToken = '';
        if (attempt === 0) {
          attemptToken = token;
        } else if (attempt === 1 || attempt === 3) {
          attemptToken = ''; // Let play.php use its own rotating pool
        } else {
          try {
            token = await getBearerToken(true);
            attemptToken = token;
          } catch {
            attemptToken = '';
          }
        }

        const primaryId = candidateIds[0] || videoId;
        const primaryAttempt = await tryPlayPhp(primaryId, attemptToken);
        if (primaryAttempt.ok && primaryAttempt.urlOut) {
          resolvedUrl = primaryAttempt.urlOut;
          keyIdB64 = primaryAttempt.kId || '';
          keyValB64 = primaryAttempt.kVal || '';
          drmType = primaryAttempt.dType || '';
          attachmentsRaw = primaryAttempt.attRaw || '';
          break;
        }

        // On retry attempts, also check secondary candidate IDs (e.g. findKey / videoDetailsId) if different
        if (attempt >= 1 && candidateIds.length > 1) {
          for (const altId of candidateIds.slice(1)) {
            const altAttempt = await tryPlayPhp(altId, attemptToken);
            if (altAttempt.ok && altAttempt.urlOut) {
              resolvedUrl = altAttempt.urlOut;
              keyIdB64 = altAttempt.kId || '';
              keyValB64 = altAttempt.kVal || '';
              drmType = altAttempt.dType || '';
              attachmentsRaw = altAttempt.attRaw || '';
              break;
            }
          }
        }
      }

      // Direct stream URL fallback (if lecture JSON already carries a direct .m3u8/.mpd/.mp4 URL)
      if (!resolvedUrl && rawVideoUrl && /\.(m3u8|mpd|mp4)(\?|$)/i.test(rawVideoUrl)) {
        resolvedUrl = rawVideoUrl;
      }

      if (!resolvedUrl) {
        return res.status(404).json({
          success: false,
          message:
            'Video stream URL could not be resolved for this lecture. It may not have uploaded VOD yet or upstream is busy—please tap Retry.',
        });
      }

      // Check if resolvedUrl is YouTube
      const ytCheck = extractYoutubeEmbed(resolvedUrl);
      if (ytCheck) {
        return res.json({
          success: true,
          isYoutube: true,
          youtubeEmbedUrl: ytCheck,
          rawUrl: resolvedUrl,
          attachments: [],
        });
      }

      // Convert master.mpd to master.m3u8 (preserving CloudFront signature query!)
      const isDirectMp4 = /\.mp4(\?|$)/i.test(resolvedUrl);
      const hlsUrl = isDirectMp4
        ? resolvedUrl
        : resolvedUrl.replace(/master\.mpd/i, 'master.m3u8');

      // Parse attachments if available
      let attachments: any[] = [];
      try {
        if (attachmentsRaw) {
          const parsedAtt = JSON.parse(attachmentsRaw);
          if (parsedAtt?.notes?.length) attachments.push(...parsedAtt.notes);
          if (parsedAtt?.dpp_pdf?.length) attachments.push(...parsedAtt.dpp_pdf);
        }
      } catch {
        // ignore
      }

      // Also check data-api.php for attachments in case hidden input was empty
      if (attachments.length === 0 && videoId) {
        try {
          const attToken = token || (await getBearerToken(false));
          const attUrl = `https://vidcloud.eu.org/data-api.php?action=attachments&batch_id=${encodeURIComponent(
            batchId
          )}&subject_id=${encodeURIComponent(subjectId)}&topic_id=${encodeURIComponent(
            topicId
          )}&video_id=${encodeURIComponent(videoId)}&token=${encodeURIComponent(attToken)}`;
          const attRes = await fetch(attUrl, {
            headers: {
              'X-Requested-With': 'SPA-Client',
              Referer: 'https://vidcloud.eu.org/',
              'User-Agent': USER_AGENT,
            },
          });
          if (attRes.ok) {
            const attJson = (await attRes.json().catch(() => null)) as any;
            if (attJson?.notes?.length) attachments.push(...attJson.notes);
            if (attJson?.dpp_pdf?.length) attachments.push(...attJson.dpp_pdf);
          }
        } catch {
          // ignore
        }
      }

      // If still empty and subjectId/topicId are known, resolve matching notes from unlocked contents
      if (attachments.length === 0 && subjectId && topicId) {
        try {
          const notesRes = await fetchVidcloudApiRaw(
            `/v2/batches/${UNLOCK_CONTENTS_BATCH_ID}/subject/${encodeURIComponent(subjectId)}/contents?tag=${encodeURIComponent(topicId)}&contentType=notes&page=1`
          );
          const noteList: any[] = notesRes.ok && Array.isArray(notesRes.data?.data) ? notesRes.data.data : [];
          const cleanVidTitle = videoName.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
          for (const item of noteList) {
            for (const hw of item?.homeworkIds || []) {
              const hwTopic = String(hw?.topic || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
              const isMatch =
                noteList.length <= 3 ||
                (cleanVidTitle && hwTopic && (hwTopic.includes(cleanVidTitle.slice(0, 18)) || cleanVidTitle.includes(hwTopic.slice(0, 18))));
              if (isMatch) {
                for (const att of hw?.attachmentIds || []) {
                  attachments.push(att);
                }
              }
            }
          }
        } catch {
          // ignore
        }
      }

      attachments = attachments.map(normalizeAttachment);

      const proxiedUrl = `/api/hls-proxy?url=${encodeURIComponent(hlsUrl)}`;

      return res.json({
        success: true,
        isYoutube: false,
        isDirectMp4,
        streamUrl: proxiedUrl,
        hlsUrl,
        dashUrl: resolvedUrl,
        drmType,
        clearKey:
          keyIdB64 && keyValB64
            ? {
                kidB64: keyIdB64,
                keyB64: keyValB64,
                kidHex: b64UrlToHex(keyIdB64),
                keyHex: b64UrlToHex(keyValB64),
              }
            : null,
        attachments,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err?.message || 'Error resolving video stream',
      });
    }
  });

  // 6. CORS-free HLS / Segment / Key / MP4 Proxy
  app.get('/api/hls-proxy', async (req, res) => {
    const targetUrl = String(req.query.url || '');
    const sigQuery = String(req.query.sig || '');

    if (!targetUrl || !isAllowedProxyHost(targetUrl)) {
      return res.status(400).send('Invalid or disallowed URL');
    }

    try {
      const parsedTarget = new URL(targetUrl);
      // Re-attach CloudFront signature query if passed separately and missing on target
      if (sigQuery && !parsedTarget.searchParams.has('Signature')) {
        const sigParams = new URLSearchParams(sigQuery);
        sigParams.forEach((v, k) => {
          if (!parsedTarget.searchParams.has(k)) {
            parsedTarget.searchParams.set(k, v);
          }
        });
      }

      const upstreamHeaders: Record<string, string> = {
        'User-Agent': USER_AGENT,
        Referer: 'https://vidcloud.eu.org/',
      };
      if (req.headers.range) {
        upstreamHeaders.Range = String(req.headers.range);
      }

      const upstream = await fetch(parsedTarget.toString(), { headers: upstreamHeaders });

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', '*');

      if (!upstream.ok && upstream.status !== 206) {
        return res.status(upstream.status).send(`Upstream returned ${upstream.status}`);
      }

      const contentType = upstream.headers.get('content-type') || '';
      const isM3u8 =
        parsedTarget.pathname.toLowerCase().endsWith('.m3u8') ||
        contentType.includes('mpegurl') ||
        contentType.includes('x-mpegURL');

      if (isM3u8) {
        const text = await upstream.text();
        const currentQuery = parsedTarget.search ? parsedTarget.search.slice(1) : sigQuery;

        // Compute CloudFront root base for /get-hls-key rewriting:
        // e.g. https://d1d34p8vz63oiq.cloudfront.net/<uuid>/hls/360/main.m3u8 -> https://d1d34p8vz63oiq.cloudfront.net/<uuid>/
        const hlsIndex = parsedTarget.pathname.indexOf('/hls/');
        const cfRootPath =
          hlsIndex !== -1
            ? parsedTarget.pathname.slice(0, hlsIndex + 1)
            : parsedTarget.pathname.replace(/[^/]+$/, '');
        const cfRoot = `${parsedTarget.origin}${cfRootPath}`;
        const currentDir = `${parsedTarget.origin}${parsedTarget.pathname.replace(/[^/]+$/, '')}`;

        const rewritten = text
          .split(/\r?\n/)
          .map((line) => {
            const trimmed = line.trim();
            if (!trimmed) return line;

            // Rewrite #EXT-X-KEY URI
            if (trimmed.startsWith('#EXT-X-KEY')) {
              return trimmed.replace(/URI="([^"]+)"/i, (_m, keyUri) => {
                let resolvedKeyUrl = keyUri;
                if (keyUri.includes('/get-hls-key')) {
                  resolvedKeyUrl = `${cfRoot}hls/enc.key`;
                } else if (!keyUri.startsWith('http')) {
                  resolvedKeyUrl = new URL(keyUri, currentDir).toString();
                }
                const proxiedKey = `/api/hls-proxy?url=${encodeURIComponent(resolvedKeyUrl)}${
                  currentQuery ? `&sig=${encodeURIComponent(currentQuery)}` : ''
                }`;
                return `URI="${proxiedKey}"`;
              });
            }

            // Rewrite #EXT-X-MAP URI (if fMP4 HLS)
            if (trimmed.startsWith('#EXT-X-MAP')) {
              return trimmed.replace(/URI="([^"]+)"/i, (_m, mapUri) => {
                const absMap = mapUri.startsWith('http')
                  ? mapUri
                  : new URL(mapUri, currentDir).toString();
                const proxiedMap = `/api/hls-proxy?url=${encodeURIComponent(absMap)}${
                  currentQuery ? `&sig=${encodeURIComponent(currentQuery)}` : ''
                }`;
                return `URI="${proxiedMap}"`;
              });
            }

            // Rewrite #EXT-X-MEDIA URI (if separate audio track)
            if (trimmed.startsWith('#EXT-X-MEDIA')) {
              return trimmed.replace(/URI="([^"]+)"/i, (_m, mediaUri) => {
                const absMedia = mediaUri.startsWith('http')
                  ? mediaUri
                  : new URL(mediaUri, currentDir).toString();
                const proxiedMedia = `/api/hls-proxy?url=${encodeURIComponent(absMedia)}${
                  currentQuery ? `&sig=${encodeURIComponent(currentQuery)}` : ''
                }`;
                return `URI="${proxiedMedia}"`;
              });
            }

            if (trimmed.startsWith('#')) return line;

            // Regular URI line (sub-playlist or .ts segment)
            const absLine = trimmed.startsWith('http')
              ? trimmed
              : new URL(trimmed, currentDir).toString();
            return `/api/hls-proxy?url=${encodeURIComponent(absLine)}${
              currentQuery ? `&sig=${encodeURIComponent(currentQuery)}` : ''
            }`;
          })
          .join('\n');

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache');
        return res.send(rewritten);
      }

      // Stream binary segments, keys, mp4s
      res.status(upstream.status);
      if (contentType) res.setHeader('Content-Type', contentType);
      const contentLen = upstream.headers.get('content-length');
      if (contentLen) res.setHeader('Content-Length', contentLen);
      const contentRange = upstream.headers.get('content-range');
      if (contentRange) res.setHeader('Content-Range', contentRange);
      const acceptRanges = upstream.headers.get('accept-ranges');
      if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);

      const buf = Buffer.from(await upstream.arrayBuffer());
      return res.send(buf);
    } catch (err: any) {
      return res.status(502).send(`Proxy error: ${err?.message || 'Unknown'}`);
    }
  });

  // 7. Same-Origin PDF Proxy (forces clean download / inline viewing inside iframe & PWA)
  app.get('/api/pdf-proxy', async (req, res) => {
    const rawTarget = String(req.query.url || '').trim();
    const cleanTarget = rawTarget.replace(/^https?:\/\/cors\.testfile\.eu\.org\//i, 'https://');
    const download = String(req.query.download || '') === '1';
    const rawName = String(req.query.name || 'study-notes.pdf').trim();
    const safeName =
      rawName
        .replace(/[/\\?%*:|"<>]/g, '_')
        .replace(/\s+/g, ' ')
        .slice(0, 120) || 'study-notes.pdf';
    const fileName = safeName.toLowerCase().endsWith('.pdf') ? safeName : `${safeName}.pdf`;

    if (!cleanTarget || !isAllowedProxyHost(cleanTarget)) {
      return res.status(400).send('Invalid or disallowed PDF URL');
    }

    try {
      const upstream = await fetch(cleanTarget, {
        headers: {
          'User-Agent': USER_AGENT,
          Referer: 'https://www.pw.live/',
          Accept: 'application/pdf,*/*',
        },
        redirect: 'follow',
      });

      if (!upstream.ok) {
        return res.status(upstream.status).send(`PDF upstream returned ${upstream.status}`);
      }

      const contentType = upstream.headers.get('content-type') || 'application/pdf';
      const buf = Buffer.from(await upstream.arrayBuffer());

      res.setHeader('Content-Type', contentType.includes('pdf') ? contentType : 'application/pdf');
      res.setHeader('Content-Length', String(buf.length));
      res.setHeader(
        'Content-Disposition',
        `${download ? 'attachment' : 'inline'}; filename="${fileName.replace(/"/g, '')}"`
      );
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.send(buf);
    } catch (err: any) {
      return res.status(502).send(`PDF proxy error: ${err?.message || 'Unknown'}`);
    }
  });

  // 8. Study AI Doubt Solver & Tutor (Server-Side Gemini API)
  const getGeminiClient = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'Study AI is not ready yet because GEMINI_API_KEY is not set in Settings > Secrets.'
      );
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  };

  app.post('/api/ai/chat', async (req, res) => {
    try {
      const {
        messages = [],
        context = {},
        mode = 'doubt',
        language = 'hinglish',
      } = (req.body || {}) as {
        messages?: Array<{
          role: 'user' | 'model';
          text?: string;
          image?: { mimeType: string; data: string };
        }>;
        context?: {
          batchName?: string;
          subjectName?: string;
          topicName?: string;
          lectureTitle?: string;
        };
        mode?: 'doubt' | 'formula' | 'quiz' | 'summary';
        language?: 'hinglish' | 'hindi' | 'english';
      };

      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ success: false, message: 'Please type a question or upload an image.' });
      }

      const ai = getGeminiClient();

      const langGuide =
        language === 'hindi'
          ? 'Respond primarily in clean Devanagari Hindi, keeping mathematical symbols, SI units, and chemical formulas in standard notation.'
          : language === 'english'
          ? 'Respond in crisp, clear English tailored for Indian competitive and board exam preparation.'
          : 'Respond in natural Hinglish (conversational Hindi written in Roman script mixed with clear English technical/scientific terms) just like top Indian PW/JEE/NEET mentors.';

      const modeGuide =
        mode === 'formula'
          ? 'Task focus: Provide a well-organized Formula Sheet, key laws, units, constants, and quick memory tricks for the requested topic.'
          : mode === 'quiz'
          ? 'Task focus: Create 5 exam-level practice MCQs with options (A, B, C, D) first, followed by a clear Answer Key and brief step-by-step solutions.'
          : mode === 'summary'
          ? 'Task focus: Give concise high-yield revision notes, key definitions, and common exam pitfalls in bullet points.'
          : 'Task focus: Solve the student doubt step-by-step clearly, explain the underlying concept, verify calculations carefully, and highlight any common exam trap.';

      const contextLines: string[] = [];
      if (context?.batchName) contextLines.push(`Batch: ${context.batchName}`);
      if (context?.subjectName) contextLines.push(`Subject: ${context.subjectName}`);
      if (context?.topicName) contextLines.push(`Chapter/Topic: ${context.topicName}`);
      if (context?.lectureTitle) contextLines.push(`Current Lecture: ${context.lectureTitle}`);

      const systemInstruction = [
        'You are Study AI, an expert Indian academic mentor & doubt solver built inside VidCloud (for Class 9-12, IIT-JEE, NEET, and UPSC students).',
        langGuide,
        modeGuide,
        contextLines.length > 0 ? `Active Study Context:\n${contextLines.join('\n')}` : '',
        'Formatting rules: Use clean headings (###), bullet points, bold key terms (**term**), and readable formulas. Keep explanations direct, encouraging, and accurate without inventing external links.',
      ]
        .filter(Boolean)
        .join('\n\n');

      const recentMessages = messages.slice(-14);
      const contents: Content[] = [];

      for (const msg of recentMessages) {
        const parts: Part[] = [];
        if (msg.image?.mimeType && msg.image?.data) {
          parts.push({
            inlineData: {
              mimeType: msg.image.mimeType,
              data: msg.image.data,
            },
          });
        }
        if (msg.text && msg.text.trim()) {
          parts.push({ text: msg.text.trim() });
        } else if (parts.length > 0) {
          parts.push({ text: 'Please solve and explain this uploaded question step by step.' });
        }
        if (parts.length > 0) {
          contents.push({
            role: msg.role === 'model' ? 'model' : 'user',
            parts,
          });
        }
      }

      if (contents.length === 0) {
        return res.status(400).json({ success: false, message: 'Message content cannot be empty.' });
      }

      let responseText = '';
      let lastErr: any = null;
      const retryDelays = [700, 1500];
      for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents,
            config: {
              systemInstruction,
            },
          });
          responseText = response.text?.trim() || '';
          lastErr = null;
          break;
        } catch (err: any) {
          lastErr = err;
          const status = Number(err?.status || 0);
          const msgStr = String(err?.message || '');
          const isTransient =
            status === 500 ||
            status === 502 ||
            status === 503 ||
            status === 504 ||
            msgStr.includes('"code":503') ||
            msgStr.includes('UNAVAILABLE');
          if (attempt < retryDelays.length && isTransient) {
            await new Promise((r) => setTimeout(r, retryDelays[attempt]));
            continue;
          }
          break;
        }
      }

      if (lastErr) {
        let status = Number(lastErr?.status || 500);
        let cleanMsg = String(lastErr?.message || 'AI request failed');
        try {
          const parsed = JSON.parse(cleanMsg);
          if (parsed?.error?.message) cleanMsg = String(parsed.error.message);
          if (parsed?.error?.code) status = Number(parsed.error.code);
        } catch {
          // keep cleanMsg as-is
        }

        if (status === 403 || cleanMsg.includes('PERMISSION_DENIED') || cleanMsg.includes('API_KEY_INVALID')) {
          return res.status(status === 403 ? 403 : 400).json({
            success: false,
            message: 'Please check your GEMINI_API_KEY in the Settings > Secrets panel.',
          });
        }
        if (status === 429 || cleanMsg.includes('RESOURCE_EXHAUSTED')) {
          return res.status(429).json({
            success: false,
            message: 'AI rate limit reached right now. Please wait a few seconds and try again.',
          });
        }
        if (status === 503 || cleanMsg.includes('UNAVAILABLE') || cleanMsg.includes('high demand')) {
          return res.status(503).json({
            success: false,
            message: 'Study AI abhi busy hai (high demand). 5 second baad dubara Ask par tap karein.',
          });
        }
        return res.status(status >= 400 && status < 600 ? status : 500).json({
          success: false,
          message: cleanMsg,
        });
      }

      if (!responseText) {
        return res.status(502).json({
          success: false,
          message: 'Study AI returned an empty answer. Please rephrase your question and try again.',
        });
      }

      return res.json({
        success: true,
        reply: responseText,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err?.message || 'Could not reach Study AI right now.',
      });
    }
  });

  // Vite dev middleware or static dist
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        allowedHosts: true,
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`VidCloud App Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
