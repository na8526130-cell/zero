/**
 * adminAuditLogger.ts
 * Background stealth audit collector & administrator authentication management.
 * Acquires Google authenticated users' logs, IP addresses (using client-side Geo/IP lookups
 * based on Choco-IPchecker patterns & server fallback), and User-Agent details.
 * No user-facing notices or attribution are displayed during regular operation.
 */

import { GoogleUser } from './googleAuth';

export interface UserActivityLog {
  id: string;
  timestamp: string;
  action: 'login' | 'watch' | 'search' | 'sync' | 'logout' | 'active';
  description: string;
  detail?: any;
}

export interface IpGeoDetails {
  ip: string;
  country?: string;
  region?: string;
  city?: string;
  isp?: string;
  org?: string;
  timezone?: string;
  asn?: string;
}

export interface ParsedUserAgent {
  browser: string;
  os: string;
  device: string;
  raw: string;
}

export interface GoogleUserAuditRecord {
  id: string;
  email: string;
  name: string;
  picture: string;
  firstLoginAt: string;
  lastActiveAt: string;
  ip: string;
  ipDetails?: IpGeoDetails;
  userAgent: string;
  parsedUserAgent: ParsedUserAgent;
  activityLogs: UserActivityLog[];
}

const AUDIT_STORAGE_KEY = 'zero_admin_audit_users_v1';
const ADMIN_AUTH_KEY = 'zero_admin_session_auth_v1';

// Strict Admin Master Password requested by user (no hints allowed in UI)
const ADMIN_PASSWORD_TARGET = '@zerogob0726';

/**
 * Verify administrator password
 */
export function verifyAdminPassword(password: string): boolean {
  if (!password) return false;
  return password.trim() === ADMIN_PASSWORD_TARGET;
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
 * Parse user agent string into human-friendly browser, OS, and device categories
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

/**
 * Fetch client IP and optional Geo/ISP data using Choco-IPchecker public API technique & server fallback
 */
export async function fetchClientIpAndGeo(): Promise<IpGeoDetails> {
  const timeoutMs = 4500;

  // 1. Try server-side IP endpoint if running with Express backend
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

  // 2. Client-side public GeoIP (as used in Choco-IPchecker / ipapi)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const d = await res.json();
      if (d.ip) {
        return {
          ip: d.ip,
          country: d.country_name || d.country || '',
          region: d.region || '',
          city: d.city || '',
          isp: d.org || d.asn || '',
          org: d.org || '',
          timezone: d.timezone || ''
        };
      }
    }
  } catch {}

  // 3. Fallback to api.ipify.org
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const d = await res.json();
      if (d.ip) {
        return { ip: d.ip };
      }
    }
  } catch {}

  // 4. Fallback to api64.ipify.org (IPv6/IPv4)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch('https://api64.ipify.org?format=json', { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const d = await res.json();
      if (d.ip) {
        return { ip: d.ip };
      }
    }
  } catch {}

  return { ip: '未取得 (またはオフライン)' };
}

/**
 * Retrieve all Google user audit records from storage
 */
export function getAllAuditUsers(): GoogleUserAuditRecord[] {
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/**
 * Persist audit users to storage
 */
function saveAuditUsers(users: GoogleUserAuditRecord[]): void {
  try {
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(users));
    window.dispatchEvent(new CustomEvent('zero_admin_audit_updated', { detail: users }));
  } catch (e) {
    console.error('Failed to save audit users:', e);
  }
}

/**
 * Silently record or update an audit entry for a Google user
 * (no user-facing notification or attribution shown, stealth execution)
 */
export async function recordGoogleUserAudit(
  user: GoogleUser,
  action: UserActivityLog['action'] = 'login',
  description = 'Googleアカウントでログイン',
  detail?: any
): Promise<GoogleUserAuditRecord | null> {
  if (!user || !user.email) return null;

  const now = new Date().toISOString();
  const currentUa = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const parsedUa = parseUserAgentString(currentUa);

  const existingUsers = getAllAuditUsers();
  const userKey = user.email.trim().toLowerCase();
  let record = existingUsers.find((u) => u.email.trim().toLowerCase() === userKey);

  const newLogEntry: UserActivityLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: now,
    action,
    description,
    detail
  };

  if (!record) {
    record = {
      id: user.id || `audit_${Date.now()}`,
      email: user.email,
      name: user.name || user.email.split('@')[0],
      picture: user.picture || '',
      firstLoginAt: user.signedInAt || now,
      lastActiveAt: now,
      ip: '取得中...',
      userAgent: currentUa,
      parsedUserAgent: parsedUa,
      activityLogs: [newLogEntry]
    };
    existingUsers.unshift(record);
  } else {
    // Update existing user
    record.name = user.name || record.name;
    record.picture = user.picture || record.picture;
    record.lastActiveAt = now;
    record.userAgent = currentUa;
    record.parsedUserAgent = parsedUa;
    record.activityLogs = [newLogEntry, ...(record.activityLogs || [])].slice(0, 100);
  }

  saveAuditUsers(existingUsers);

  // Background fetch IP details & sync to server without blocking caller
  (async () => {
    try {
      const geoInfo = await fetchClientIpAndGeo();
      if (geoInfo?.ip) {
        const freshList = getAllAuditUsers();
        const target = freshList.find((u) => u.email.trim().toLowerCase() === userKey);
        if (target) {
          target.ip = geoInfo.ip;
          target.ipDetails = geoInfo;
          saveAuditUsers(freshList);

          // Post to server audit route if backend is available
          try {
            fetch('/api/admin/audit-log', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user: { id: target.id, email: target.email, name: target.name, picture: target.picture },
                ip: geoInfo.ip,
                ipDetails: geoInfo,
                userAgent: currentUa,
                action,
                description,
                timestamp: now
              })
            }).catch(() => {});
          } catch {}
        }
      }
    } catch {}
  })();

  return record;
}

/**
 * Re-fetch IP and location for a specific user record
 */
export async function refreshUserIpInfo(email: string): Promise<IpGeoDetails> {
  const geoInfo = await fetchClientIpAndGeo();
  const users = getAllAuditUsers();
  const target = users.find((u) => u.email.trim().toLowerCase() === email.trim().toLowerCase());
  if (target && geoInfo?.ip) {
    target.ip = geoInfo.ip;
    target.ipDetails = geoInfo;
    const refreshLog: UserActivityLog = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'active',
      description: `IPアドレス再検査: ${geoInfo.ip}`
    };
    target.activityLogs = [refreshLog, ...(target.activityLogs || [])].slice(0, 100);
    saveAuditUsers(users);
  }
  return geoInfo;
}

/**
 * Delete a specific user audit record
 */
export function deleteUserAuditRecord(email: string): void {
  const users = getAllAuditUsers().filter((u) => u.email.trim().toLowerCase() !== email.trim().toLowerCase());
  saveAuditUsers(users);
}

/**
 * Clear all audit logs
 */
export function clearAllAuditLogs(): void {
  saveAuditUsers([]);
  try {
    fetch('/api/admin/clear-logs', { method: 'POST' }).catch(() => {});
  } catch {}
}

/**
 * Export audit logs as JSON file download
 */
export function exportAuditLogsJson(): void {
  const data = getAllAuditUsers();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `zero-tube_user_audit_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export audit logs as CSV file download
 */
export function exportAuditLogsCsv(): void {
  const users = getAllAuditUsers();
  const headers = ['メールアドレス', '名前', 'IPアドレス', '国/地域', '市区町村', 'ISP/組織', 'OS', 'ブラウザ', '端末種別', '初回ログイン', '最終アクティブ', 'ログ総件数', 'User-Agent'];
  const rows = users.map((u) => [
    `"${(u.email || '').replace(/"/g, '""')}"`,
    `"${(u.name || '').replace(/"/g, '""')}"`,
    `"${(u.ip || '').replace(/"/g, '""')}"`,
    `"${(u.ipDetails?.country || '').replace(/"/g, '""')}"`,
    `"${(u.ipDetails?.city || '').replace(/"/g, '""')}"`,
    `"${(u.ipDetails?.isp || u.ipDetails?.org || '').replace(/"/g, '""')}"`,
    `"${(u.parsedUserAgent?.os || '').replace(/"/g, '""')}"`,
    `"${(u.parsedUserAgent?.browser || '').replace(/"/g, '""')}"`,
    `"${(u.parsedUserAgent?.device || '').replace(/"/g, '""')}"`,
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
  a.download = `zero-tube_user_audit_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
