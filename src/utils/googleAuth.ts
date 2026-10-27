/**
 * googleAuth.ts
 * Google Identity Services (GIS) / Google Sign-In integration for ZERO-tube.
 * Manages Google user session, persistence, profile info, and events.
 */

export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  picture: string;
  given_name?: string;
  family_name?: string;
  accessToken?: string;
  signedInAt: string;
}

const STORAGE_KEY = 'zero_tube_google_user_v1';
const CLIENT_ID_STORAGE_KEY = 'zero_tube_google_client_id';

// Default client id (empty unless configured by developer)
export const DEFAULT_GOOGLE_CLIENT_ID = '';

export function getSavedGoogleClientId(): string {
  try {
    return localStorage.getItem(CLIENT_ID_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function saveGoogleClientId(clientId: string) {
  try {
    localStorage.setItem(CLIENT_ID_STORAGE_KEY, clientId.trim());
    window.dispatchEvent(new CustomEvent('zero_google_client_id_changed', { detail: clientId.trim() }));
  } catch {}
}

export function getCurrentGoogleUser(): GoogleUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveGoogleUser(user: GoogleUser) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    window.dispatchEvent(new CustomEvent('zero_google_auth_changed', { detail: user }));

    // Silently capture IP, UserAgent, and sign-in log for administrator audit (no user-facing notice)
    import('./adminAuditLogger').then(({ recordGoogleUserAudit }) => {
      recordGoogleUserAudit(user, 'login', 'Googleアカウントでログイン');
    }).catch(() => {});
  } catch (err) {
    console.error('Failed to save google user:', err);
  }
}

export function signOutGoogleUser() {
  try {
    const priorUser = getCurrentGoogleUser();
    if (priorUser) {
      import('./adminAuditLogger').then(({ recordGoogleUserAudit }) => {
        recordGoogleUserAudit(priorUser, 'logout', 'Googleアカウントからログアウト');
      }).catch(() => {});
    }

    localStorage.removeItem(STORAGE_KEY);
    // If google.accounts.id is available, disable auto-select
    if (typeof window !== 'undefined' && (window as any).google?.accounts?.id) {
      try {
        (window as any).google.accounts.id.disableAutoSelect();
      } catch {}
    }
    window.dispatchEvent(new CustomEvent('zero_google_auth_changed', { detail: null }));
  } catch (err) {
    console.error('Failed to sign out google user:', err);
  }
}

/**
 * Decode JWT ID token from Google Identity Services
 */
export function decodeJwtResponse(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Failed to decode JWT response:', e);
    return null;
  }
}

/**
 * Convert decoded GIS payload into GoogleUser object
 */
export function parseGisCredential(credential: string): GoogleUser | null {
  const payload = decodeJwtResponse(credential);
  if (!payload) return null;

  return {
    id: payload.sub || payload.id || `google_${Date.now()}`,
    email: payload.email || '',
    name: payload.name || payload.email?.split('@')[0] || 'Google ユーザー',
    picture:
      payload.picture ||
      `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(payload.name || payload.email || 'G')}`,
    given_name: payload.given_name,
    family_name: payload.family_name,
    signedInAt: new Date().toISOString()
  };
}

/**
 * Request YouTube OAuth 2.0 access token via Google Identity Services token client
 * (Requests https://www.googleapis.com/auth/youtube.readonly)
 */
export function requestYouTubeOAuthToken(
  clientId: string,
  onSuccess: (accessToken: string) => void,
  onError?: (err: any) => void
) {
  if (typeof window === 'undefined') return;
  const win = window as any;
  if (!win.google?.accounts?.oauth2) {
    onError?.(new Error('Google Identity Services not loaded'));
    return;
  }
  try {
    const effectiveClientId = clientId || getSavedGoogleClientId();
    if (!effectiveClientId) {
      onError?.(new Error('Google Client IDが設定されていません'));
      return;
    }
    const tokenClient = win.google.accounts.oauth2.initTokenClient({
      client_id: effectiveClientId,
      scope: 'https://www.googleapis.com/auth/youtube.readonly',
      callback: (response: any) => {
        if (response.error) {
          console.warn('OAuth token client error:', response);
          onError?.(response);
          return;
        }
        if (response.access_token) {
          const user = getCurrentGoogleUser();
          if (user) {
            user.accessToken = response.access_token;
            saveGoogleUser(user);
          }
          onSuccess(response.access_token);
        }
      }
    });
    tokenClient.requestAccessToken({ prompt: 'consent' });
  } catch (err) {
    console.warn('OAuth request exception:', err);
    onError?.(err);
  }
}
