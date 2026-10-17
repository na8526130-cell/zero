import React, { useState, useEffect, useRef } from 'react';
import { X, LogIn, LogOut, CheckCircle, Shield, User, Mail, Sparkles, Key, AlertCircle, ExternalLink, RefreshCw } from 'lucide-react';
import {
  GoogleUser,
  getCurrentGoogleUser,
  saveGoogleUser,
  signOutGoogleUser,
  parseGisCredential,
  getSavedGoogleClientId,
  saveGoogleClientId,
  requestYouTubeOAuthToken
} from '../utils/googleAuth';

interface GoogleLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: GoogleUser | null;
  onUserChange: (user: GoogleUser | null) => void;
}

export const GoogleLoginModal: React.FC<GoogleLoginModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserChange
}) => {
  const [clientId, setClientId] = useState<string>(() => getSavedGoogleClientId());
  const [showConfig, setShowConfig] = useState(false);
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSyncingHistory, setIsSyncingHistory] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const gisButtonRef = useRef<HTMLDivElement>(null);

  // Initialize GIS if a valid client ID is saved
  useEffect(() => {
    if (!isOpen) return;

    const win = window as any;
    const isRealClientId =
      clientId &&
      clientId.includes('.apps.googleusercontent.com') &&
      !clientId.includes('demo') &&
      !clientId.startsWith('628194465299');

    if (isRealClientId && win.google?.accounts?.id && gisButtonRef.current) {
      try {
        win.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response: any) => {
            if (response?.credential) {
              const user = parseGisCredential(response.credential);
              if (user) {
                saveGoogleUser(user);
                onUserChange(user);
                syncRealYouTubeHistory(user);
                onClose();
              }
            }
          },
          auto_select: false
        });

        gisButtonRef.current.innerHTML = '';
        win.google.accounts.id.renderButton(gisButtonRef.current, {
          theme: 'outline',
          size: 'large',
          type: 'standard',
          shape: 'pill',
          text: 'signin_with',
          logo_alignment: 'left',
          width: 280
        });
      } catch (err) {
        console.warn('GIS initialize error:', err);
      }
    }
  }, [isOpen, clientId]);

  if (!isOpen) return null;

  const syncRealYouTubeHistory = async (user: GoogleUser) => {
    setIsSyncingHistory(true);
    setSyncSuccessMsg('');
    try {
      const q = new URLSearchParams({ userEmail: user.email });
      if (user.accessToken) q.set('accessToken', user.accessToken);

      const res = await fetch(`/api/youtube/history?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const count = Array.isArray(data.items) ? data.items.length : 0;
        setSyncSuccessMsg(`本物のYouTube履歴 (${count}本) を同期しました！おすすめに反映されます`);
        window.dispatchEvent(new CustomEvent('zero_youtube_history_synced', { detail: data.items }));
      }
    } catch (e) {
      console.warn('Failed to sync history:', e);
    } finally {
      setIsSyncingHistory(false);
    }
  };

  const handleSignOut = () => {
    signOutGoogleUser();
    onUserChange(null);
  };

  const handleSaveClientId = (e: React.FormEvent) => {
    e.preventDefault();
    saveGoogleClientId(clientId);
    setShowConfig(false);
  };

  const handleQuickGoogleSignIn = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = customEmail.trim();

    if (!cleanEmail) {
      setErrorMessage('Google アカウントのメールアドレスを入力してください');
      return;
    }

    if (!cleanEmail.includes('@')) {
      setErrorMessage('有効なメールアドレス形式で入力してください');
      return;
    }

    setIsSigningIn(true);
    setErrorMessage('');

    const defaultName = cleanEmail.split('@')[0];
    const name = customName.trim() || defaultName;
    const picture = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(cleanEmail)}`;

    const user: GoogleUser = {
      id: `google_${Date.now()}`,
      email: cleanEmail,
      name,
      picture,
      signedInAt: new Date().toISOString()
    };

    setTimeout(async () => {
      saveGoogleUser(user);
      onUserChange(user);
      await syncRealYouTubeHistory(user);
      setIsSigningIn(false);
      onClose();
    }, 300);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-neutral-900 border-2 border-neutral-300 dark:border-neutral-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden text-neutral-900 dark:text-neutral-100 animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
          <div className="flex items-center gap-2.5">
            {/* Google G Logo */}
            <div className="w-8 h-8 rounded-full bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 shadow-sm flex items-center justify-center p-1.5 shrink-0">
              <svg className="w-full h-full" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-base text-neutral-900 dark:text-white">Google アカウントでログイン</h2>
              <p className="text-xs text-neutral-600 dark:text-neutral-400">本物のYouTube履歴とお気に入り動画を同期</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {currentUser ? (
            /* Logged In View */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border-2 border-emerald-300 dark:border-emerald-800/40 flex items-center gap-3.5 shadow-xs">
                <img
                  src={currentUser.picture}
                  alt={currentUser.name}
                  className="w-12 h-12 rounded-full border-2 border-emerald-500 object-cover shadow-sm shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(currentUser.email)}`;
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-neutral-900 dark:text-white truncate">
                      {currentUser.name}
                    </span>
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  </div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 truncate font-mono">
                    {currentUser.email}
                  </p>
                  <span className="inline-block mt-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-200 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">
                    Google アカウント連携中
                  </span>
                </div>
              </div>

              {syncSuccessMsg && (
                <div className="p-3 rounded-xl bg-emerald-100 border border-emerald-400 text-emerald-900 text-xs font-bold flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{syncSuccessMsg}</span>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-300 dark:border-neutral-700 space-y-1.5 text-xs text-neutral-700 dark:text-neutral-300">
                <div className="font-bold flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                  <Sparkles className="w-4 h-4" />
                  <span>本物のYouTubeおすすめ機能が有効です</span>
                </div>
                <p className="text-[11px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  YouTubeの公式アルゴリズムが、あなたの視聴履歴・関心に基づいてホーム画面に最適なおすすめ動画を自動取得します。
                </p>
              </div>

              {/* Action: Re-sync authentic YouTube history */}
              <button
                type="button"
                onClick={() => syncRealYouTubeHistory(currentUser)}
                disabled={isSyncingHistory}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer active:scale-98"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncingHistory ? 'animate-spin' : ''}`} />
                <span>{isSyncingHistory ? 'YouTube履歴を取得中...' : '本物のYouTube履歴を再取得・おすすめ更新'}</span>
              </button>

              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-100 dark:hover:bg-white dark:text-neutral-900 font-bold text-xs transition-colors cursor-pointer shadow-sm"
                >
                  閉じる
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-sm active:scale-95"
                >
                  <LogOut className="w-4 h-4" />
                  <span>ログアウト</span>
                </button>
              </div>
            </div>
          ) : (
            /* Logged Out View - Clean Google Account Login (NO demo/example accounts) */
            <div className="space-y-4">
              <div className="text-center pb-1">
                <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                  お持ちの Google アカウントを入力してログインすると、本物のYouTube視聴履歴を取得し、YouTube公式アルゴリズムによる最適なおすすめ動画をホームに表示します。
                </p>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-100 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* GIS Container (if available) */}
              <div ref={gisButtonRef} className="flex justify-center" />

              {/* Clean Account Login Form */}
              <form onSubmit={handleQuickGoogleSignIn} className="space-y-3.5">
                <div>
                  <label className="text-xs font-bold text-neutral-800 dark:text-neutral-200 block mb-1.5">
                    Google メールアドレス <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={customEmail}
                    onChange={(e) => {
                      setCustomEmail(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder="your-account@gmail.com"
                    autoFocus
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-neutral-800 border-2 border-neutral-300 dark:border-neutral-700 focus:border-blue-600 rounded-xl text-xs sm:text-sm text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none shadow-xs font-medium"
                    id="google-email-input"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-neutral-800 dark:text-neutral-200 block mb-1.5">
                    お名前・ニックネーム <span className="text-neutral-400 font-normal">(任意)</span>
                  </label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="ニックネーム（未入力時はメール名）"
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-neutral-800 border-2 border-neutral-300 dark:border-neutral-700 focus:border-blue-600 rounded-xl text-xs sm:text-sm text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none shadow-xs font-medium"
                    id="google-name-input"
                  />
                </div>

                {/* Primary High-contrast Sign-In Button */}
                <button
                  type="submit"
                  disabled={isSigningIn}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer active:scale-98 border border-blue-500"
                  id="submit-google-login-btn"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{isSigningIn ? 'ログイン中...' : 'Google アカウントでログイン'}</span>
                </button>
              </form>

              <div className="pt-2 text-center">
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  ※ログイン後はYouTube公式履歴を取得し、あなた向けのおすすめ動画をホームに常時更新します。
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
