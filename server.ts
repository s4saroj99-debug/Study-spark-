import express from 'express';
import http from 'http';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

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

async function fetchVidcloudApi(apiPath: string): Promise<any> {
  let token = await getBearerToken(false);
  let res = await fetch(`${API_BASE}${apiPath}`, {
    headers: buildPwHeaders(token),
  });

  if (res.status === 401 || res.status === 403) {
    token = await getBearerToken(true);
    res = await fetch(`${API_BASE}${apiPath}`, {
      headers: buildPwHeaders(token),
    });
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`API ${apiPath} returned ${res.status}: ${errText.slice(0, 200)}`);
  }
  return res.json();
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
  app.use(express.json());

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

    try {
      const data = await fetchVidcloudApi(
        `/v2/batches/${encodeURIComponent(batchId)}/subject/${encodeURIComponent(subjectId)}/contents?tag=${encodeURIComponent(topicId)}&contentType=${encodeURIComponent(contentType)}&page=${encodeURIComponent(page)}`
      );
      return res.json({
        success: true,
        items: Array.isArray(data?.data) ? data.data : [],
        paginate: data?.paginate || null,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to fetch contents' });
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
