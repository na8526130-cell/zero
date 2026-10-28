/**
 * adminAuditLogger.ts
 * Comprehensive client environment, network, and user activity audit logger.
 * Includes:
 * 1. Deep Device Fingerprinting (Canvas hash, Audio hash, Font enumeration, Refresh rate Hz)
 * 2. Instant Sub-Second Real-time Presence (Online indicator, active/background duration)
 * 3. VPN / Proxy / Tor / Datacenter heuristic evasion detection
 * 4. Access Control (IP and Fingerprint BAN / Blacklist management)
 * 5. Automatic Notification Alerts (Target email: r1907058@fkc.ritsumei.ac.jp & Discord Webhook)
 */

import { GoogleUser } from './googleAuth';

export interface UserActivityLog {
  id: string;
  timestamp: string;
  action: 'login' | 'watch' | 'search' | 'sync' | 'logout' | 'active' | 'visit' | 'blocked';
  description: string;
  detail?: any;
}

export interface IpGeoDetails {
  ip: string;
  type?: string; // IPv4 or IPv6
  country?: string;
  countryCode?: string;
  flagEmoji?: string;
  region?: string;
  city?: string;
  postal?: string;
  latitude?: number;
  longitude?: number;
  isp?: string;
  org?: string;
  asn?: string | number;
  domain?: string;
  timezone?: string;
  timezoneUtc?: string;
}

export interface ParsedUserAgent {
  browser: string;
  os: string;
  device: string;
  raw: string;
}

export interface FingerprintDetails {
  compositeId: string; // e.g. "FP-7E2A-94B1"
  canvasHash: string; // 12-char deterministic canvas render hash
  audioHash: string; // 12-char AudioContext DSP hash
  installedFonts: string[]; // detected local installed fonts
  refreshRateHz: number; // e.g. 60, 120
  refreshRateLabel: string; // e.g. "120Hz (ProMotion / 高リフレッシュ)"
  isKnownDevice?: boolean;
}

export interface VpnDetectionDetails {
  isSuspicious: boolean;
  reasons: string[];
  confidence: 'high' | 'medium' | 'none';
}

export interface LivePresenceDetails {
  isOnline: boolean;
  lastHeartbeat: string;
  currentAction?: string;
  activeDurationSec: number;
  backgroundDurationSec: number;
}

export interface BlockedEntity {
  id: string;
  type: 'ip' | 'fingerprint' | 'email';
  value: string;
  reason?: string;
  blockedAt: string;
}

export interface DeviceHardwareDetails {
  platform: string;
  cpuCores?: number;
  deviceMemory?: string;
  gpuVendor: string;
  gpuRenderer: string;
  screenResolution: string;
  screenAvailable: string;
  colorDepth: string;
  pixelRatio: string;
  touchPoints: number;
  orientation: string;
  pdfViewerEnabled?: boolean;
  cookiesEnabled: boolean;
  languages: string;
  timezone: string;
  timezoneOffset: string;
  doNotTrack?: string;
}

export interface NetworkConnectionDetails {
  effectiveType?: string;
  downlink?: string;
  rtt?: string;
  saveData?: boolean;
  isOnline: boolean;
}

export interface BatteryStatusDetails {
  level?: string;
  charging?: boolean;
  chargingTime?: string;
  dischargingTime?: string;
}

export interface SessionDetails {
  referrer: string;
  url: string;
  visitCount: number;
  firstSeenAt: string;
  lastActiveAt: string;
  activeSeconds: number;
  backgroundSeconds: number;
}

export interface GoogleUserAuditRecord {
  id: string;
  userType: 'google' | 'guest';
  email: string;
  name: string;
  picture: string;
  firstLoginAt: string;
  lastActiveAt: string;
  visitCount: number;
  ip: string;
  ipDetails?: IpGeoDetails;
  userAgent: string;
  parsedUserAgent: ParsedUserAgent;
  fingerprint?: FingerprintDetails;
  vpn?: VpnDetectionDetails;
  presence?: LivePresenceDetails;
  hardware?: DeviceHardwareDetails;
  network?: NetworkConnectionDetails;
  battery?: BatteryStatusDetails;
  session?: SessionDetails;
  activityLogs: UserActivityLog[];
}

export type UserAuditRecord = GoogleUserAuditRecord;

// Storage Keys
const AUDIT_STORAGE_KEY = 'zero_admin_audit_users_v2';
const LEGACY_STORAGE_KEY = 'zero_admin_audit_users_v1';
const VISITOR_ID_KEY = 'zero_visitor_persistent_id_v2';
const VISIT_COUNT_KEY = 'zero_visitor_visit_count_v2';
const ADMIN_AUTH_KEY = 'zero_admin_session_auth_v1';
const BLOCKED_ENTITIES_KEY = 'zero_admin_blocked_entities_v1';
const NOTIFY_CONFIG_KEY = 'zero_admin_notify_settings_v1';

// SHA-256 digest of administrator access passphrase (@zerogob0726)
const AUTH_DIGEST = '120d2a4b06a3bd5651e9199b135b13d7dd97851b5e7dcc2848824bdbd9d47d09';

// Default Target Notification Email requested by user
export const DEFAULT_NOTIFY_EMAIL = 'r1907058@fkc.ritsumei.ac.jp';

/**
 * Fast synchronous SHA-256 implementation ensuring no plain text credentials in JS bundles
 */
export function computeSha256(ascii: string): string {
  function rightRotate(value: number, amount: number): number {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = 'length';
  let i: number, j: number;
  let result = '';
  const words: number[] = [];
  const asciiBitLength = ascii[lengthProperty] * 8;
  let hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;
  const isComposite: Record<number, number> = {};

  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isComposite[i] = candidate;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  ascii += '\x80';
  while ((ascii[lengthProperty] % 64) - 56) ascii += '\x00';

  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i);
    if (j >> 8) return '';
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
  words[words[lengthProperty]] = asciiBitLength | 0;

  for (j = 0; j < words[lengthProperty]; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash;
    hash = hash.slice(0, 8);
    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const temp1 =
        hash[7] +
        (rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25)) +
        ch +
        k[i] +
        (w[i] = i < 16 ? w[i] : (w[i - 16] + s0 + w[i - 7] + s1) | 0);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const temp2 = (rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22)) + maj;
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
      hash.length = 8;
    }
    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (let b = 3; b >= 0; b--) {
      const byte = (hash[i] >> (b * 8)) & 255;
      result += (byte < 16 ? '0' : '') + byte.toString(16);
    }
  }
  return result;
}

/**
 * Verify administrator password using SHA-256 hash comparison
 */
export function verifyAdminPassword(password: string): boolean {
  if (!password) return false;
  return computeSha256(password.trim()) === AUTH_DIGEST;
}

export function isAdminAuthenticated(): boolean {
  try {
    const sessionAuth = sessionStorage.getItem(ADMIN_AUTH_KEY);
    const localAuth = localStorage.getItem(ADMIN_AUTH_KEY);
    return sessionAuth === 'granted' || localAuth === 'granted';
  } catch {
    return false;
  }
}

export function setAdminAuthenticated(persistInLocal = false): void {
  try {
    sessionStorage.setItem(ADMIN_AUTH_KEY, 'granted');
    if (persistInLocal) {
      localStorage.setItem(ADMIN_AUTH_KEY, 'granted');
    }
    window.dispatchEvent(new CustomEvent('zero_admin_auth_changed', { detail: true }));
  } catch {}
}

export function clearAdminAuthentication(): void {
  try {
    sessionStorage.removeItem(ADMIN_AUTH_KEY);
    localStorage.removeItem(ADMIN_AUTH_KEY);
    window.dispatchEvent(new CustomEvent('zero_admin_auth_changed', { detail: false }));
  } catch {}
}

/**
 * ========================================================
 * 1. Deep Device Fingerprinting (Canvas, Audio, Fonts, Hz)
 * ========================================================
 */

/**
 * Deterministic Canvas 2D render fingerprint
 */
export function generateCanvasFingerprint(): string {
  if (typeof document === 'undefined') return 'CANVAS_OFFLINE';
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 60;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'CANVAS_NO_2D';

    ctx.textBaseline = 'top';
    ctx.font = '14px "Arial", "sans-serif"';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);

    ctx.fillStyle = '#069';
    ctx.fillText('zero-tube 🎯 %<#!', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('zero-tube 🎯 %<#!', 4, 17);

    // Geometry + winding test
    ctx.beginPath();
    ctx.arc(50, 45, 18, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.fill();

    return computeSha256(canvas.toDataURL()).slice(0, 16);
  } catch {
    return 'CANVAS_ERR';
  }
}

/**
 * AudioContext DSP fingerprint
 */
export async function generateAudioFingerprint(): Promise<string> {
  if (typeof window === 'undefined') return 'AUDIO_OFFLINE';
  try {
    const AudioCtx = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
    if (!AudioCtx) return 'AUDIO_UNSUPPORTED';

    const context = new AudioCtx(1, 44100, 44100);
    const oscillator = context.createOscillator();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(10000, context.currentTime);

    const compressor = context.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-50, context.currentTime);
    compressor.knee.setValueAtTime(40, context.currentTime);
    compressor.ratio.setValueAtTime(12, context.currentTime);
    compressor.attack.setValueAtTime(0, context.currentTime);
    compressor.release.setValueAtTime(0.25, context.currentTime);

    oscillator.connect(compressor);
    compressor.connect(context.destination);
    oscillator.start(0);

    const renderedBuffer = await context.startRendering();
    const channelData = renderedBuffer.getChannelData(0);

    let sum = 0;
    for (let i = 4500; i < 5000; i++) {
      sum += Math.abs(channelData[i]);
    }
    return computeSha256(sum.toString()).slice(0, 16);
  } catch {
    return 'AUDIO_UNAVAILABLE';
  }
}

/**
 * Detect installed system & localized Japanese fonts
 */
export function detectInstalledFonts(): string[] {
  if (typeof document === 'undefined') return [];
  try {
    const baseFonts = ['monospace', 'sans-serif', 'serif'];
    const testString = 'mmmmmmmmmmlli!W@09';
    const testSize = '72px';
    const h = document.getElementsByTagName('body')[0];
    if (!h) return [];

    const candidateFonts = [
      'Yu Gothic',
      'Yu Mincho',
      'Meiryo',
      'Hiragino Kaku Gothic ProN',
      'Hiragino Sans',
      'MS Gothic',
      'MS PGothic',
      'Noto Sans JP',
      'Apple Color Emoji',
      'SF Pro Display',
      'Segoe UI',
      'Helvetica Neue',
      'Arial',
      'Times New Roman',
      'Courier New',
      'Consolas'
    ];

    const span = document.createElement('span');
    span.style.fontSize = testSize;
    span.innerHTML = testString;
    span.style.position = 'absolute';
    span.style.left = '-9999px';
    span.style.top = '-9999px';

    const baseWidths: Record<string, number> = {};
    for (const base of baseFonts) {
      span.style.fontFamily = base;
      h.appendChild(span);
      baseWidths[base] = span.offsetWidth;
      h.removeChild(span);
    }

    const installed: string[] = [];
    for (const font of candidateFonts) {
      let isPresent = false;
      for (const base of baseFonts) {
        span.style.fontFamily = `'${font}', ${base}`;
        h.appendChild(span);
        const match = span.offsetWidth !== baseWidths[base];
        h.removeChild(span);
        if (match) {
          isPresent = true;
          break;
        }
      }
      if (isPresent) {
        installed.push(font);
      }
    }
    return installed;
  } catch {
    return [];
  }
}

/**
 * Measure display refresh rate (Hz) via requestAnimationFrame
 */
export function measureRefreshRate(): Promise<{ hz: number; label: string }> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.requestAnimationFrame) {
      return resolve({ hz: 60, label: '60Hz (標準)' });
    }

    let frames = 0;
    let startTime = performance.now();
    const frameDeltas: number[] = [];
    let lastTime = startTime;

    function step(now: number) {
      frames++;
      frameDeltas.push(now - lastTime);
      lastTime = now;

      if (frames < 24) {
        requestAnimationFrame(step);
      } else {
        frameDeltas.sort((a, b) => a - b);
        const medianDelta = frameDeltas[Math.floor(frameDeltas.length / 2)];
        let hz = Math.round(1000 / medianDelta);

        // Normalize to common hardware refresh tiers
        if (hz >= 55 && hz <= 65) hz = 60;
        else if (hz >= 70 && hz <= 80) hz = 75;
        else if (hz >= 85 && hz <= 95) hz = 90;
        else if (hz >= 115 && hz <= 125) hz = 120;
        else if (hz >= 135 && hz <= 150) hz = 144;
        else if (hz >= 160 && hz <= 170) hz = 165;
        else if (hz >= 230 && hz <= 250) hz = 240;

        let label = `${hz}Hz`;
        if (hz >= 120) label = `${hz}Hz (ProMotion / 高リフレッシュ)`;
        else if (hz === 60) label = `${hz}Hz (標準ディスプレイ)`;

        resolve({ hz, label });
      }
    }

    requestAnimationFrame(step);
  });
}

/**
 * Generate composite fingerprint for persistent identification across incognito & cleared storage
 */
export async function generateCompositeFingerprint(): Promise<FingerprintDetails> {
  const canvasHash = generateCanvasFingerprint();
  const audioHash = await generateAudioFingerprint();
  const installedFonts = detectInstalledFonts();
  const refreshRate = await measureRefreshRate();

  const hw = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 4) : 4;
  const mem = typeof navigator !== 'undefined' ? ((navigator as any).deviceMemory || 4) : 4;
  const scr = typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}` : 'scr';

  const seed = `${canvasHash}_${audioHash}_${hw}_${mem}_${scr}_${installedFonts.slice(0, 5).join('-')}`;
  const rawHash = computeSha256(seed);
  const compositeId = `FP-${rawHash.slice(0, 4).toUpperCase()}-${rawHash.slice(4, 8).toUpperCase()}`;

  // Check if known from history
  const all = getAllAuditUsers();
  const isKnownDevice = all.some((u) => u.fingerprint?.compositeId === compositeId);

  return {
    compositeId,
    canvasHash,
    audioHash,
    installedFonts,
    refreshRateHz: refreshRate.hz,
    refreshRateLabel: refreshRate.label,
    isKnownDevice
  };
}

/**
 * ========================================================
 * 2. VPN / Proxy / Tor / Datacenter Evasion Detection
 * ========================================================
 */
export function detectVpnOrProxy(geo?: IpGeoDetails, hardware?: DeviceHardwareDetails): VpnDetectionDetails {
  if (!geo) {
    return { isSuspicious: false, reasons: [], confidence: 'none' };
  }

  const reasons: string[] = [];
  const text = `${geo.isp || ''} ${geo.org || ''} ${geo.domain || ''}`.toLowerCase();

  const vpnKeywords = [
    'vpn', 'proxy', 'tor', 'exit', 'm247', 'nord', 'expressvpn', 'surfshark', 'cyberghost',
    'private internet', 'datacenter', 'hosting', 'server', 'digitalocean', 'linode',
    'ovh', 'amazon', 'aws', 'google cloud', 'gcp', 'cloudflare', 'sakura', 'conoha',
    'vultr', 'hetzner', 'leaseweb', 'choopa', 'zenlayer'
  ];

  for (const kw of vpnKeywords) {
    if (text.includes(kw)) {
      reasons.push(`ホスティング/VPN事業者回線の検出 (${kw})`);
      break;
    }
  }

  // Timezone mismatch heuristic (e.g. GeoIP in US but browser timezone is Asia/Tokyo)
  if (geo.countryCode && geo.countryCode !== 'JP' && hardware?.timezone === 'Asia/Tokyo') {
    reasons.push(`日本時間端末からの海外IPアクセス (IP: ${geo.country} / 端末: ${hardware.timezone})`);
  }

  const isSuspicious = reasons.length > 0;
  const confidence = reasons.length >= 2 ? 'high' : isSuspicious ? 'medium' : 'none';

  return {
    isSuspicious,
    reasons,
    confidence
  };
}

/**
 * ========================================================
 * 3. Access Control (Blacklist / BAN Management)
 * ========================================================
 */
export function getBlockedEntities(): BlockedEntity[] {
  try {
    const raw = localStorage.getItem(BLOCKED_ENTITIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveBlockedEntities(list: BlockedEntity[]): void {
  try {
    localStorage.setItem(BLOCKED_ENTITIES_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('zero_admin_blocked_changed', { detail: list }));
  } catch {}
}

export function isVisitorBlocked(ip?: string, fingerprintId?: string, email?: string): boolean {
  const list = getBlockedEntities();
  if (list.length === 0) return false;

  for (const item of list) {
    if (item.type === 'ip' && ip && ip.trim() === item.value.trim()) return true;
    if (item.type === 'fingerprint' && fingerprintId && fingerprintId.trim() === item.value.trim()) return true;
    if (item.type === 'email' && email && email.toLowerCase() === item.value.toLowerCase()) return true;
  }
  return false;
}

export function blockVisitor(type: 'ip' | 'fingerprint' | 'email', value: string, reason?: string): void {
  if (!value) return;
  const list = getBlockedEntities();
  if (!list.some((b) => b.type === type && b.value.toLowerCase() === value.toLowerCase())) {
    list.unshift({
      id: `ban_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type,
      value,
      reason: reason || '管理者による手動ブロック',
      blockedAt: new Date().toISOString()
    });
    saveBlockedEntities(list);

    // Sync to backend blocklist
    fetch('/api/admin/block', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, value, reason })
    }).catch(() => {});
  }
}

export function unblockVisitor(idOrValue: string): void {
  const list = getBlockedEntities().filter(
    (b) => b.id !== idOrValue && b.value.toLowerCase() !== idOrValue.toLowerCase()
  );
  saveBlockedEntities(list);

  fetch('/api/admin/unblock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: idOrValue })
  }).catch(() => {});
}

/**
 * ========================================================
 * 4. Session Time Tracker & Live Presence
 * ========================================================
 */
let sessionActiveSeconds = 0;
let sessionBackgroundSeconds = 0;
let timeTrackerInitialized = false;

export function initSessionTimeTracker(): void {
  if (timeTrackerInitialized || typeof window === 'undefined') return;
  timeTrackerInitialized = true;

  setInterval(() => {
    if (document.visibilityState === 'visible') {
      sessionActiveSeconds += 1;
    } else {
      sessionBackgroundSeconds += 1;
    }
  }, 1000);
}

export function getSessionTimeStats(): { activeSec: number; backgroundSec: number; totalSec: number; formatted: string } {
  const total = sessionActiveSeconds + sessionBackgroundSeconds;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return {
    activeSec: sessionActiveSeconds,
    backgroundSec: sessionBackgroundSeconds,
    totalSec: total,
    formatted: `${m > 0 ? `${m}分` : ''}${s}秒 (アクティブ: ${sessionActiveSeconds}秒)`
  };
}

/**
 * Send periodic heartbeat ping to declare live presence
 */
export function sendHeartbeat(visitorId: string, currentAction?: string): void {
  const now = new Date().toISOString();
  try {
    const users = getAllAuditUsers();
    const target = users.find((u) => u.id === visitorId || u.email === visitorId);
    if (target) {
      target.presence = {
        isOnline: true,
        lastHeartbeat: now,
        currentAction: currentAction || target.presence?.currentAction || 'サイト閲覧中',
        activeDurationSec: sessionActiveSeconds,
        backgroundDurationSec: sessionBackgroundSeconds
      };
      target.lastActiveAt = now;
      saveAuditUsers(users);
    }
    fetch('/api/admin/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorId,
        action: currentAction,
        activeSec: sessionActiveSeconds,
        timestamp: now
      })
    }).catch(() => {});
  } catch {}
}

/**
 * ========================================================
 * 5. External Alert Dispatcher (Target Email & Discord)
 * ========================================================
 */
export interface NotifySettings {
  email: string;
  emailEnabled: boolean;
  discordWebhookUrl?: string;
  discordEnabled: boolean;
}

export function getNotifySettings(): NotifySettings {
  try {
    const raw = localStorage.getItem(NOTIFY_CONFIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    email: DEFAULT_NOTIFY_EMAIL,
    emailEnabled: true,
    discordWebhookUrl: '',
    discordEnabled: false
  };
}

export function saveNotifySettings(settings: NotifySettings): void {
  try {
    localStorage.setItem(NOTIFY_CONFIG_KEY, JSON.stringify(settings));
  } catch {}
}

export async function dispatchAccessAlert(record: GoogleUserAuditRecord, alertAction: string): Promise<boolean> {
  const settings = getNotifySettings();
  const payload = {
    targetEmail: settings.email || DEFAULT_NOTIFY_EMAIL,
    emailEnabled: settings.emailEnabled,
    discordWebhookUrl: settings.discordWebhookUrl,
    discordEnabled: settings.discordEnabled && Boolean(settings.discordWebhookUrl),
    alertAction,
    timestamp: new Date().toISOString(),
    user: {
      id: record.id,
      name: record.name,
      email: record.email,
      userType: record.userType
    },
    ip: record.ip,
    geo: {
      country: record.ipDetails?.country || '日本',
      region: record.ipDetails?.region,
      city: record.ipDetails?.city,
      isp: record.ipDetails?.isp,
      org: record.ipDetails?.org
    },
    device: {
      os: record.parsedUserAgent?.os,
      browser: record.parsedUserAgent?.browser,
      device: record.parsedUserAgent?.device,
      gpu: record.hardware?.gpuRenderer,
      fingerprint: record.fingerprint?.compositeId,
      refreshRate: record.fingerprint?.refreshRateLabel
    },
    vpnSuspicious: record.vpn?.isSuspicious,
    vpnReasons: record.vpn?.reasons
  };

  try {
    // 1. Post to backend dispatcher which sends email to r1907058@fkc.ritsumei.ac.jp
    const res = await fetch('/api/admin/notify-alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * ========================================================
 * 6. Core Audit Record & IP Retrieval
 * ========================================================
 */

export function parseUserAgentString(uaString?: string): ParsedUserAgent {
  const ua = uaString || (typeof navigator !== 'undefined' ? navigator.userAgent : '');

  let browser = '不明ブラウザ';
  if (/edg\//i.test(ua)) browser = 'Microsoft Edge';
  else if (/opr\/|opera/i.test(ua)) browser = 'Opera';
  else if (/chrome|crios/i.test(ua)) browser = 'Google Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Mozilla Firefox';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Apple Safari';
  else if (/trident|msie/i.test(ua)) browser = 'Internet Explorer';

  let os = '不明OS';
  if (/windows phone/i.test(ua)) os = 'Windows Phone';
  else if (/windows nt 10\.0/i.test(ua)) os = 'Windows 10/11';
  else if (/windows nt 6\.3/i.test(ua)) os = 'Windows 8.1';
  else if (/windows nt 6\.1/i.test(ua)) os = 'Windows 7';
  else if (/windows/i.test(ua)) os = 'Windows';
  else if (/iphone/i.test(ua)) os = 'iOS (iPhone)';
  else if (/ipad/i.test(ua)) os = 'iPadOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/cros/i.test(ua)) os = 'ChromeOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  let device = 'PC / デスクトップ';
  if (/mobile|iphone|android.*mobile/i.test(ua)) device = 'スマートフォン';
  else if (/ipad|tablet|android(?!.*mobile)/i.test(ua)) device = 'タブレット';

  return { browser, os, device, raw: ua };
}

export function detectGpuInfo(): { vendor: string; renderer: string } {
  if (typeof document === 'undefined') return { vendor: 'N/A', renderer: 'N/A' };
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return { vendor: 'WebGL非対応', renderer: 'WebGL非対応' };
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) {
      return {
        vendor: gl.getParameter(gl.VENDOR) || '標準WebGLベンダー',
        renderer: gl.getParameter(gl.RENDERER) || '標準WebGLレンダラー'
      };
    }
    const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '不明';
    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '不明';
    return { vendor: String(vendor), renderer: String(renderer) };
  } catch {
    return { vendor: '取得失敗', renderer: '取得失敗' };
  }
}

export function detectHardwareDetails(): DeviceHardwareDetails {
  const isClient = typeof window !== 'undefined';
  const gpu = detectGpuInfo();

  let timezone = 'Asia/Tokyo';
  let timezoneOffset = '+09:00';
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const offsetMin = -new Date().getTimezoneOffset();
    const sign = offsetMin >= 0 ? '+' : '-';
    const h = String(Math.floor(Math.abs(offsetMin) / 60)).padStart(2, '0');
    const m = String(Math.abs(offsetMin) % 60).padStart(2, '0');
    timezoneOffset = `UTC${sign}${h}:${m}`;
  } catch {}

  const nav = isClient ? (navigator as any) : {};
  const scr = isClient ? window.screen : ({} as any);

  let orientationStr = '不明';
  try {
    if (scr.orientation?.type) {
      orientationStr = scr.orientation.type.includes('portrait') ? '縦向き (Portrait)' : '横向き (Landscape)';
    } else if (isClient) {
      orientationStr = window.innerHeight >= window.innerWidth ? '縦向き (Portrait)' : '横向き (Landscape)';
    }
  } catch {}

  return {
    platform: nav.platform || '不明',
    cpuCores: nav.hardwareConcurrency || undefined,
    deviceMemory: nav.deviceMemory ? `${nav.deviceMemory} GB` : undefined,
    gpuVendor: gpu.vendor,
    gpuRenderer: gpu.renderer,
    screenResolution: scr.width ? `${scr.width} × ${scr.height}` : '不明',
    screenAvailable: scr.availWidth ? `${scr.availWidth} × ${scr.availHeight}` : '不明',
    colorDepth: scr.colorDepth ? `${scr.colorDepth}-bit` : '不明',
    pixelRatio: isClient ? `${window.devicePixelRatio || 1}x` : '1x',
    touchPoints: nav.maxTouchPoints || 0,
    orientation: orientationStr,
    pdfViewerEnabled: typeof nav.pdfViewerEnabled === 'boolean' ? nav.pdfViewerEnabled : undefined,
    cookiesEnabled: nav.cookieEnabled ?? true,
    languages: nav.languages ? nav.languages.join(', ') : (nav.language || 'ja-JP'),
    timezone,
    timezoneOffset,
    doNotTrack: nav.doNotTrack || undefined
  };
}

export function detectNetworkDetails(): NetworkConnectionDetails {
  const isClient = typeof window !== 'undefined';
  const nav = isClient ? (navigator as any) : {};
  const conn = nav.connection || nav.mozConnection || nav.webkitConnection;

  return {
    effectiveType: conn?.effectiveType ? String(conn.effectiveType).toUpperCase() : undefined,
    downlink: conn?.downlink ? `${conn.downlink} Mbps` : undefined,
    rtt: conn?.rtt ? `${conn.rtt} ms` : undefined,
    saveData: conn?.saveData,
    isOnline: nav.onLine ?? true
  };
}

export async function detectBatteryDetails(): Promise<BatteryStatusDetails | undefined> {
  if (typeof navigator === 'undefined' || !(navigator as any).getBattery) return undefined;
  try {
    const b = await (navigator as any).getBattery();
    return {
      level: `${Math.round(b.level * 100)}%`,
      charging: b.charging,
      chargingTime: b.chargingTime && b.chargingTime !== Infinity ? `${Math.round(b.chargingTime / 60)}分` : undefined,
      dischargingTime: b.dischargingTime && b.dischargingTime !== Infinity ? `${Math.round(b.dischargingTime / 60)}分` : undefined
    };
  } catch {
    return undefined;
  }
}

export async function fetchClientIpAndGeo(): Promise<IpGeoDetails> {
  const timeoutMs = 4500;

  // 1. Primary: ipwho.is
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch('https://ipwho.is/', { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const d = await res.json();
      if (d && (d.success || d.ip)) {
        return {
          ip: d.ip,
          type: d.type,
          country: d.country,
          countryCode: d.country_code,
          flagEmoji: d.flag?.emoji || '🌐',
          region: d.region,
          city: d.city,
          postal: d.postal,
          latitude: d.latitude,
          longitude: d.longitude,
          isp: d.connection?.isp,
          org: d.connection?.org,
          asn: d.connection?.asn,
          domain: d.connection?.domain,
          timezone: d.timezone?.id,
          timezoneUtc: d.timezone?.utc
        };
      }
    }
  } catch {}

  // 2. Secondary: ipapi.co
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const d = await res.json();
      if (d && d.ip) {
        return {
          ip: d.ip,
          country: d.country_name || d.country || '',
          countryCode: d.country_code || '',
          region: d.region || '',
          city: d.city || '',
          postal: d.postal || '',
          latitude: d.latitude,
          longitude: d.longitude,
          isp: d.org || d.asn || '',
          org: d.org || '',
          asn: d.asn || '',
          timezone: d.timezone || ''
        };
      }
    }
  } catch {}

  // 3. Server fallback
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch('/api/admin/client-ip', { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (data.ip && data.ip !== '127.0.0.1' && data.ip !== '::1') {
        return {
          ip: data.ip,
          country: data.country || '日本',
          region: data.region,
          city: data.city,
          isp: data.isp,
          org: data.org,
          timezone: data.timezone
        };
      }
    }
  } catch {}

  // 4. Fallback to api64.ipify.org
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch('https://api64.ipify.org?format=json', { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const d = await res.json();
      if (d?.ip) {
        return { ip: d.ip };
      }
    }
  } catch {}

  return { ip: '未取得 (またはオフライン)' };
}

export function getOrInitVisitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_ID_KEY);
    if (!id) {
      id = `guest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem(VISITOR_ID_KEY, id);
    }
    return id;
  } catch {
    return `guest_${Date.now()}`;
  }
}

export function incrementVisitCount(): number {
  try {
    const current = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || '0', 10);
    const updated = current + 1;
    localStorage.setItem(VISIT_COUNT_KEY, String(updated));
    return updated;
  } catch {
    return 1;
  }
}

export function getAllAuditUsers(): GoogleUserAuditRecord[] {
  try {
    let raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    if (!raw) {
      raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw) localStorage.setItem(AUDIT_STORAGE_KEY, raw);
    }
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveAuditUsers(users: GoogleUserAuditRecord[]): void {
  try {
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(users));
    window.dispatchEvent(new CustomEvent('zero_admin_audit_updated', { detail: users }));
  } catch (e) {
    console.error('Failed to save audit records:', e);
  }
}

/**
 * Record or update audit record for ANY user (Google signed-in user OR anonymous guest)
 */
export async function recordVisitorAudit(
  user?: GoogleUser | null,
  action: UserActivityLog['action'] = 'visit',
  description = 'サイト訪問・閲覧開始',
  detail?: any
): Promise<GoogleUserAuditRecord> {
  initSessionTimeTracker();

  const now = new Date().toISOString();
  const currentUa = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const parsedUa = parseUserAgentString(currentUa);
  const hardware = detectHardwareDetails();
  const network = detectNetworkDetails();
  const visitCount = incrementVisitCount();

  const referrer = typeof document !== 'undefined' ? document.referrer || '直接アクセス' : '直接アクセス';
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

  const existingUsers = getAllAuditUsers();
  const visitorId = getOrInitVisitorId();

  const isGoogleUser = Boolean(user && user.email);
  const recordKey = isGoogleUser ? user!.email.trim().toLowerCase() : visitorId;

  let record = existingUsers.find(
    (u) => (isGoogleUser && u.email?.trim().toLowerCase() === recordKey) || (!isGoogleUser && u.id === visitorId)
  );

  const newLogEntry: UserActivityLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: now,
    action,
    description,
    detail
  };

  const defaultGuestName = `ゲスト #${visitorId.slice(-4).toUpperCase()}`;

  if (!record) {
    record = {
      id: isGoogleUser ? (user!.id || `usr_${Date.now()}`) : visitorId,
      userType: isGoogleUser ? 'google' : 'guest',
      email: isGoogleUser ? user!.email : `guest_${visitorId.slice(-6)}@visitor.local`,
      name: isGoogleUser ? (user!.name || user!.email.split('@')[0]) : defaultGuestName,
      picture: isGoogleUser ? (user!.picture || '') : '',
      firstLoginAt: now,
      lastActiveAt: now,
      visitCount,
      ip: '取得中...',
      userAgent: currentUa,
      parsedUserAgent: parsedUa,
      hardware,
      network,
      session: {
        referrer,
        url: currentUrl,
        visitCount,
        firstSeenAt: now,
        lastActiveAt: now,
        activeSeconds: sessionActiveSeconds,
        backgroundSeconds: sessionBackgroundSeconds
      },
      presence: {
        isOnline: true,
        lastHeartbeat: now,
        currentAction: description,
        activeDurationSec: sessionActiveSeconds,
        backgroundDurationSec: sessionBackgroundSeconds
      },
      activityLogs: [newLogEntry]
    };
    existingUsers.unshift(record);
  } else {
    if (isGoogleUser) {
      record.userType = 'google';
      record.email = user!.email;
      record.name = user!.name || record.name;
      record.picture = user!.picture || record.picture;
    }
    record.lastActiveAt = now;
    record.visitCount = (record.visitCount || 0) + 1;
    record.userAgent = currentUa;
    record.parsedUserAgent = parsedUa;
    record.hardware = hardware;
    record.network = network;
    if (record.session) {
      record.session.lastActiveAt = now;
      record.session.visitCount = record.visitCount;
      record.session.activeSeconds = sessionActiveSeconds;
      record.session.backgroundSeconds = sessionBackgroundSeconds;
      if (!record.session.referrer && referrer) record.session.referrer = referrer;
    }
    record.presence = {
      isOnline: true,
      lastHeartbeat: now,
      currentAction: description,
      activeDurationSec: sessionActiveSeconds,
      backgroundDurationSec: sessionBackgroundSeconds
    };
    record.activityLogs = [newLogEntry, ...(record.activityLogs || [])].slice(0, 150);
  }

  saveAuditUsers(existingUsers);

  // Background deep extraction (Fingerprint, Battery, Rich GeoIP, VPN detection, Alert Dispatch)
  (async () => {
    try {
      const [battery, geoInfo, fingerprint] = await Promise.all([
        detectBatteryDetails(),
        fetchClientIpAndGeo(),
        generateCompositeFingerprint()
      ]);

      const vpn = detectVpnOrProxy(geoInfo, hardware);

      const freshList = getAllAuditUsers();
      const target = freshList.find(
        (u) => (isGoogleUser && u.email?.trim().toLowerCase() === recordKey) || (!isGoogleUser && u.id === visitorId)
      );

      if (target) {
        if (battery) target.battery = battery;
        if (fingerprint) target.fingerprint = fingerprint;
        if (vpn) target.vpn = vpn;

        if (geoInfo?.ip) {
          target.ip = geoInfo.ip;
          target.ipDetails = geoInfo;

          if (target.userType === 'guest' && geoInfo.city) {
            target.name = `ゲスト #${visitorId.slice(-4).toUpperCase()} (${geoInfo.city} / ${parsedUa.device})`;
          }
        }
        saveAuditUsers(freshList);

        // Check if visitor is blocked
        if (isVisitorBlocked(target.ip, target.fingerprint?.compositeId, target.email)) {
          window.dispatchEvent(new CustomEvent('zero_visitor_is_banned', { detail: target }));
        }

        // Send Real-Time Access Alert to r1907058@fkc.ritsumei.ac.jp on new visit / login / watch
        if (action === 'visit' || action === 'login' || action === 'watch') {
          dispatchAccessAlert(target, description);
        }

        // Sync to backend audit store
        try {
          fetch('/api/admin/audit-log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user: {
                id: target.id,
                userType: target.userType,
                email: target.email,
                name: target.name,
                picture: target.picture
              },
              ip: target.ip,
              ipDetails: target.ipDetails,
              userAgent: currentUa,
              fingerprint: target.fingerprint,
              vpn: target.vpn,
              hardware: target.hardware,
              network: target.network,
              battery: target.battery,
              action,
              description,
              timestamp: now
            })
          }).catch(() => {});
        } catch {}
      }
    } catch {}
  })();

  return record;
}

export async function recordGoogleUserAudit(
  user: GoogleUser,
  action: UserActivityLog['action'] = 'login',
  description = 'Googleアカウントでログイン',
  detail?: any
): Promise<GoogleUserAuditRecord | null> {
  return recordVisitorAudit(user, action, description, detail);
}

export async function refreshUserIpInfo(userIdOrEmail: string): Promise<IpGeoDetails> {
  const [geoInfo, battery, fingerprint] = await Promise.all([
    fetchClientIpAndGeo(),
    detectBatteryDetails(),
    generateCompositeFingerprint()
  ]);
  const hardware = detectHardwareDetails();
  const network = detectNetworkDetails();
  const vpn = detectVpnOrProxy(geoInfo, hardware);

  const users = getAllAuditUsers();
  const target = users.find(
    (u) =>
      u.email.trim().toLowerCase() === userIdOrEmail.trim().toLowerCase() ||
      u.id === userIdOrEmail
  );

  if (target) {
    if (geoInfo?.ip) {
      target.ip = geoInfo.ip;
      target.ipDetails = geoInfo;
    }
    if (battery) target.battery = battery;
    if (fingerprint) target.fingerprint = fingerprint;
    if (vpn) target.vpn = vpn;
    target.hardware = hardware;
    target.network = network;

    const refreshLog: UserActivityLog = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'active',
      description: `端末・IP・フィンガープリント再検査: ${geoInfo?.ip || target.ip}`
    };
    target.activityLogs = [refreshLog, ...(target.activityLogs || [])].slice(0, 150);
    saveAuditUsers(users);
  }
  return geoInfo;
}

export function deleteUserAuditRecord(userIdOrEmail: string): void {
  const users = getAllAuditUsers().filter(
    (u) =>
      u.email.trim().toLowerCase() !== userIdOrEmail.trim().toLowerCase() &&
      u.id !== userIdOrEmail
  );
  saveAuditUsers(users);
}

export function clearAllAuditLogs(): void {
  saveAuditUsers([]);
  try {
    fetch('/api/admin/clear-logs', { method: 'POST' }).catch(() => {});
  } catch {}
}

export function exportAuditLogsJson(): void {
  const data = getAllAuditUsers();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `zero-tube_all_users_audit_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportAuditLogsCsv(): void {
  const users = getAllAuditUsers();
  const headers = [
    '種別',
    '名前',
    'メールアドレス',
    'IPアドレス',
    '国',
    '都道府県/地域',
    '市区町村',
    '郵便番号',
    '緯度',
    '経度',
    'ISPプロバイダ',
    '組織(Org)',
    'ASN',
    'VPN/回線偽装判定',
    '複合フィンガープリントID',
    'Canvasハッシュ',
    'Audioハッシュ',
    'リフレッシュレート',
    'インストールフォント数',
    'OS',
    'ブラウザ',
    '端末種別',
    'GPUレンダラー',
    'GPUベンダー',
    'CPUコア数',
    'メモリ(RAM)',
    '画面解像度',
    'Retina比率',
    'タッチ点数',
    '回線種別',
    '下り速度',
    '遅延(RTT)',
    'バッテリー残量',
    '優先言語',
    'タイムゾーン',
    '流入元(リファラ)',
    '訪問回数',
    '初回アクセス',
    '最終アクティブ',
    'ログ総件数',
    'User-Agent'
  ];

  const rows = users.map((u) => [
    `"${u.userType === 'google' ? 'Google' : 'ゲスト'}"`,
    `"${(u.name || '').replace(/"/g, '""')}"`,
    `"${(u.email || '').replace(/"/g, '""')}"`,
    `"${(u.ip || '').replace(/"/g, '""')}"`,
    `"${(u.ipDetails?.country || '').replace(/"/g, '""')}"`,
    `"${(u.ipDetails?.region || '').replace(/"/g, '""')}"`,
    `"${(u.ipDetails?.city || '').replace(/"/g, '""')}"`,
    `"${(u.ipDetails?.postal || '').replace(/"/g, '""')}"`,
    u.ipDetails?.latitude || '',
    u.ipDetails?.longitude || '',
    `"${(u.ipDetails?.isp || '').replace(/"/g, '""')}"`,
    `"${(u.ipDetails?.org || '').replace(/"/g, '""')}"`,
    `"${(u.ipDetails?.asn || '').toString().replace(/"/g, '""')}"`,
    `"${u.vpn?.isSuspicious ? 'VPN/偽装疑い (' + (u.vpn?.reasons?.join('; ') || '') + ')' : '正常回線'}"`,
    `"${u.fingerprint?.compositeId || ''}"`,
    `"${u.fingerprint?.canvasHash || ''}"`,
    `"${u.fingerprint?.audioHash || ''}"`,
    `"${u.fingerprint?.refreshRateLabel || ''}"`,
    u.fingerprint?.installedFonts?.length || 0,
    `"${(u.parsedUserAgent?.os || '').replace(/"/g, '""')}"`,
    `"${(u.parsedUserAgent?.browser || '').replace(/"/g, '""')}"`,
    `"${(u.parsedUserAgent?.device || '').replace(/"/g, '""')}"`,
    `"${(u.hardware?.gpuRenderer || '').replace(/"/g, '""')}"`,
    `"${(u.hardware?.gpuVendor || '').replace(/"/g, '""')}"`,
    u.hardware?.cpuCores || '',
    `"${(u.hardware?.deviceMemory || '').replace(/"/g, '""')}"`,
    `"${(u.hardware?.screenResolution || '').replace(/"/g, '""')}"`,
    `"${(u.hardware?.pixelRatio || '').replace(/"/g, '""')}"`,
    u.hardware?.touchPoints ?? '',
    `"${(u.network?.effectiveType || '').replace(/"/g, '""')}"`,
    `"${(u.network?.downlink || '').replace(/"/g, '""')}"`,
    `"${(u.network?.rtt || '').replace(/"/g, '""')}"`,
    `"${(u.battery?.level || '').replace(/"/g, '""')}"`,
    `"${(u.hardware?.languages || '').replace(/"/g, '""')}"`,
    `"${(u.hardware?.timezone || '').replace(/"/g, '""')}"`,
    `"${(u.session?.referrer || '').replace(/"/g, '""')}"`,
    u.visitCount || u.session?.visitCount || 1,
    `"${(u.firstLoginAt || '').replace(/"/g, '""')}"`,
    `"${(u.lastActiveAt || '').replace(/"/g, '""')}"`,
    u.activityLogs?.length || 0,
    `"${(u.userAgent || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `zero-tube_all_users_audit_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
