/**
 * YouTube Education Player Engine & Dynamic Parameter Management
 * Compatible with Google Spreadsheet GViz Engine & Educational Stream
 * Reference implementation: ajgpw/siatube (Siatube Education Player)
 */

export interface SpreadsheetEduConfig {
  parameterText: string;
  widgetApiSource: string;
}

export interface EducationStreamResponse {
  url: string;
  videoId?: string;
  param?: string;
}

const EDUCATION_HOST = 'https://www.youtubeeducation.com';
const SPREADSHEET_ID = '1dily2wiik92TAyK3zyIsu8TDuyYNoF20IM1iMk_X-pg';
const SHEET_NAME = 'Youtube-education-parameter';
const CACHE_KEY = 'kaito_edu_spreadsheet_cache_v2';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const WIDGET_SCRIPT_ID = 'youtube-education-widget-api';
export const USER_GESTURE_KEY = 'yt_user_gesture_v1';

// Verified fallback parameters from Kahoot / SiaTube education embed
export const DEFAULT_EDU_PARAMETER =
  '?autoplay=1&mute=0&controls=1&start=0&origin=https%3A%2F%2Fcreate.kahoot.it&playsinline=0&showinfo=0&rel=0&iv_load_policy=3&modestbranding=1&fs=1&cc_load_policy=0&embed_config=%7B%22enc%22%3A%22AXH1ezlIo9yTZoatl0F62iZ6Ls3G_5pHNSBqr8c_NANOhDdqf6xXY6FI5Qe7Q9JeLi3FDmyhfBH9XHZ_DXPnzx0r8GbpbPuehIOngg7EazWDhKW1GCnKt3Ss_rpZndygViNnTCUAfSuxyrBJjJbX-VBnrPPY5VMn9Q%3D%3D%22%2C%22hideTitle%22%3Atrue%7D&enablejsapi=1&widgetid=1&forigin=https%3A%2F%2Fcreate.kahoot.it%2Flearner%2Fcb8cb5ae-d835-4c4a-bc2d-9cc78519d646%2Fcourse%2F6fba06e3-1f76-47a8-9a4a-53c53eb86286%2F0&aoriginsup=1&vf=6';

let inMemoryConfig: SpreadsheetEduConfig | null = null;
let inMemoryConfigTimestamp = 0;
let widgetApiPromise: Promise<any> | null = null;

export interface EducationParameterOptions {
  autoplay?: boolean;
  start?: number;
  origin?: string;
  forigin?: string;
}

export function createYoutubeEducationParameters(
  parameterText?: string,
  options: EducationParameterOptions = {}
): URLSearchParams {
  const normalizedParameterText = String(parameterText || DEFAULT_EDU_PARAMETER)
    .trim()
    .replace(/&amp;/gi, '&')
    .replace(/&#0*38;/gi, '&')
    .replace(/&#x0*26;/gi, '&')
    .replace(/^\?/, '');

  const params = new URLSearchParams(normalizedParameterText);
  params.set('enablejsapi', '1');
  params.set('controls', '1');
  params.set('playsinline', '1');
  params.set('autoplay', options.autoplay === false ? '0' : '1');
  if (typeof options.start === 'number' && options.start > 0) {
    params.set('start', String(Math.floor(options.start)));
  }
  if (!params.has('widgetid')) {
    params.set('widgetid', '1');
  }

  const detectedOrigin =
    options.origin ||
    (typeof window !== 'undefined' &&
    (window.location.protocol === 'http:' || window.location.protocol === 'https:')
      ? window.location.origin
      : '');
  if (detectedOrigin) {
    params.set('origin', detectedOrigin);
  }

  const detectedForigin =
    options.forigin ||
    (typeof window !== 'undefined' &&
    (window.location.protocol === 'http:' || window.location.protocol === 'https:')
      ? window.location.href
      : '');
  if (detectedForigin) {
    params.set('forigin', detectedForigin);
  }

  return params;
}

export function normalizeEduParameter(
  rawParam?: string,
  options: EducationParameterOptions = {}
): string {
  const params = createYoutubeEducationParameters(rawParam, options);
  return `?${params.toString()}`;
}

export function createYoutubeEducationEmbedUrl(
  videoId: string,
  parameterText?: string,
  options: EducationParameterOptions = {}
): string {
  const cleanId = encodeURIComponent(String(videoId || '').trim());
  const params = createYoutubeEducationParameters(parameterText, options);
  return `${EDUCATION_HOST}/embed/${cleanId}?${params.toString()}`;
}

export function configureYoutubeEducationEmbedUrl(
  url: string,
  options: EducationParameterOptions = {}
): string {
  try {
    const parsed = new URL(url);
    parsed.search = createYoutubeEducationParameters(parsed.search, options).toString();
    return parsed.href;
  } catch {
    return url;
  }
}

/**
 * 1. Fetch YouTube Education Embed URL from Backend API or generate directly
 */
export async function fetchEducationStreamUrl(videoId: string): Promise<string> {
  const cleanId = String(videoId || '').trim();
  if (!cleanId || cleanId.length !== 11) {
    throw new Error('videoId must be an 11-character YouTube video ID');
  }

  // Try backend endpoint first
  try {
    const res = await fetch(`/api/stream/youtubeeducation/${encodeURIComponent(cleanId)}?origin=kaitotube`, {
      cache: 'no-store'
    });
    if (res.ok) {
      const data = await res.json();
      const streamUrl = typeof data === 'string' ? data : data?.url;
      if (typeof streamUrl === 'string' && streamUrl.trim()) {
        return configureYoutubeEducationEmbedUrl(streamUrl);
      }
    }
  } catch (err) {
    // Expected on static host without local backend
  }

  // Fallback: build embed URL using dynamic spreadsheet parameter or verified default
  try {
    const config = await fetchSpreadsheetEducationConfig();
    return createYoutubeEducationEmbedUrl(cleanId, config.parameterText);
  } catch {
    return createYoutubeEducationEmbedUrl(cleanId, DEFAULT_EDU_PARAMETER);
  }
}

/**
 * Parse Google Spreadsheet gviz JSON response
 */
function parseGvizResponse(text: string): any {
  const prefix = 'google.visualization.Query.setResponse(';
  const startIndex = text.indexOf(prefix);
  const endIndex = text.lastIndexOf(');');
  if (startIndex < 0 || endIndex < startIndex) {
    throw new Error('スプレッドシートのレスポンス形式が不正です');
  }
  const jsonString = text.slice(startIndex + prefix.length, endIndex);
  return JSON.parse(jsonString);
}

/**
 * 2. Fetch dynamic parameters and Player API code from Google Spreadsheet (gviz range A1:A2)
 * Falls back safely to verified Kahoot parameters if spreadsheet is inaccessible
 */
export async function fetchSpreadsheetEducationConfig(forceRefresh = false): Promise<SpreadsheetEduConfig> {
  const now = Date.now();

  // Check in-memory cache
  if (!forceRefresh && inMemoryConfig && now - inMemoryConfigTimestamp < CACHE_TTL) {
    return inMemoryConfig;
  }

  // Check localStorage cache
  if (!forceRefresh) {
    try {
      const cachedStr = localStorage.getItem(CACHE_KEY);
      if (cachedStr) {
        const parsed = JSON.parse(cachedStr);
        if (parsed && parsed.timestamp && now - parsed.timestamp < CACHE_TTL && parsed.config) {
          inMemoryConfig = parsed.config;
          inMemoryConfigTimestamp = parsed.timestamp;
          return inMemoryConfig!;
        }
      }
    } catch {}
  }

  // Fetch directly from Google Spreadsheet Visualization API
  try {
    const params = new URLSearchParams({
      tqx: 'out:json',
      sheet: SHEET_NAME,
      range: 'A1:A2',
      headers: '0'
    });
    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?${params.toString()}`;
    const res = await fetch(url);
    if (res.ok) {
      const rawText = await res.text();
      const gviz = parseGvizResponse(rawText);

      const row0Value = gviz?.table?.rows?.[0]?.c?.[0]?.v;
      const row1Value = gviz?.table?.rows?.[1]?.c?.[0]?.v;

      const paramText = typeof row0Value === 'string' && row0Value.trim() ? row0Value.trim() : DEFAULT_EDU_PARAMETER;
      const widgetApi = typeof row1Value === 'string' ? row1Value.trim() : '';

      const result: SpreadsheetEduConfig = {
        parameterText: paramText,
        widgetApiSource: widgetApi
      };

      inMemoryConfig = result;
      inMemoryConfigTimestamp = now;

      try {
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({
            config: result,
            timestamp: now
          })
        );
      } catch {}

      return result;
    }
  } catch (err: any) {
    console.warn('[EducationEngine] Spreadsheet fetch warning:', err.message);
  }

  // Try backend proxy fallback
  try {
    const res = await fetch('/api/education-param');
    if (res.ok) {
      const data = await res.json();
      if (data.param) {
        const fallbackConfig: SpreadsheetEduConfig = {
          parameterText: data.param,
          widgetApiSource: data.widgetApiSource || ''
        };
        return fallbackConfig;
      }
    }
  } catch {}

  // Built-in verified fallback
  const finalFallback: SpreadsheetEduConfig = {
    parameterText: DEFAULT_EDU_PARAMETER,
    widgetApiSource: inMemoryConfig?.widgetApiSource || ''
  };
  return finalFallback;
}

/**
 * 3. Dynamic injection of YouTube IFrame Player API (widgetApiSource) into <head>
 * Reference: ensureYoutubeEducationPlayerApi in ajgpw/siatube
 */
export function injectEducationPlayerApi(widgetApiSource?: string): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Window not available'));

  const win = window as any;

  if (win.YT && typeof win.YT.Player === 'function') {
    return Promise.resolve(win.YT);
  }

  if (widgetApiPromise) {
    return widgetApiPromise;
  }

  widgetApiPromise = new Promise((resolve, reject) => {
    let settled = false;
    let pollInterval: number | null = null;
    let timeoutTimer: number | null = null;

    const cleanup = () => {
      if (pollInterval !== null) {
        window.clearInterval(pollInterval);
        pollInterval = null;
      }
      if (timeoutTimer !== null) {
        window.clearTimeout(timeoutTimer);
        timeoutTimer = null;
      }
    };

    const finish = () => {
      if (settled || !win.YT || typeof win.YT.Player !== 'function') {
        return false;
      }
      settled = true;
      cleanup();
      resolve(win.YT);
      return true;
    };

    const previousReadyCallback = win.onYouTubeIframeAPIReady;
    win.onYouTubeIframeAPIReady = (...args: any[]) => {
      if (typeof previousReadyCallback === 'function') {
        try {
          previousReadyCallback(...args);
        } catch {}
      }
      finish();
    };

    pollInterval = window.setInterval(finish, 50);

    timeoutTimer = window.setTimeout(() => {
      if (finish()) return;
      settled = true;
      cleanup();
      document.getElementById(WIDGET_SCRIPT_ID)?.remove();
      reject(new Error('IFrame Player APIの初期化がタイムアウトしました'));
    }, 5000);

    let scriptTag = document.getElementById(WIDGET_SCRIPT_ID) as HTMLScriptElement | null;
    if (!scriptTag) {
      scriptTag = document.createElement('script');
      scriptTag.id = WIDGET_SCRIPT_ID;
      if (typeof widgetApiSource === 'string' && widgetApiSource.trim()) {
        scriptTag.textContent = widgetApiSource;
      } else {
        scriptTag.src = 'https://www.youtube.com/iframe_api';
      }
      document.head.appendChild(scriptTag);
    }

    finish();
  }).catch((error) => {
    widgetApiPromise = null;
    throw error;
  });

  return widgetApiPromise;
}

/**
 * 4. Bind window.YT.Player to the rendered iframe element
 */
export interface PlayerBindOptions {
  onReady?: (player: any) => void;
  onPlaying?: () => void;
  onEnded?: () => void;
  onError?: (errCode: number) => void;
  onStateChange?: (state: number) => void;
}

export function bindEducationPlayer(
  iframeElement: HTMLIFrameElement,
  options: PlayerBindOptions = {}
): any {
  const win = window as any;
  if (!win.YT || typeof win.YT.Player !== 'function') {
    console.warn('[EducationEngine] window.YT.Player is not initialized yet');
    return null;
  }

  try {
    const player = new win.YT.Player(iframeElement, {
      events: {
        onReady: (event: any) => {
          options.onReady?.(event.target);
        },
        onStateChange: (event: any) => {
          options.onStateChange?.(event.data);
          // State: 1 = PLAYING, 5 = CUED, 0 = ENDED
          if (event.data === 1) {
            options.onPlaying?.();
          } else if (event.data === 0) {
            options.onEnded?.();
          }
        },
        onError: (event: any) => {
          console.warn('YouTube Education Player API error:', event.data);
          options.onError?.(event.data);
        }
      }
    });
    return player;
  } catch (err) {
    console.warn('[EducationEngine] Failed to bind YT.Player:', err);
    return null;
  }
}
