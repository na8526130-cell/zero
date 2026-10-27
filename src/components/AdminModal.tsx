import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  Lock,
  Unlock,
  Key,
  X,
  User,
  Users,
  Globe,
  Monitor,
  Smartphone,
  Tablet,
  Clock,
  Search,
  RefreshCw,
  Trash2,
  Download,
  FileSpreadsheet,
  FileCode,
  Copy,
  Check,
  Eye,
  EyeOff,
  AlertCircle,
  Activity,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MapPin,
  Server,
  Wifi
} from 'lucide-react';
import {
  GoogleUserAuditRecord,
  getAllAuditUsers,
  verifyAdminPassword,
  isAdminAuthenticated,
  setAdminAuthenticated,
  clearAdminAuthentication,
  refreshUserIpInfo,
  deleteUserAuditRecord,
  clearAllAuditLogs,
  exportAuditLogsJson,
  exportAuditLogsCsv,
  fetchClientIpAndGeo,
  IpGeoDetails,
  parseUserAgentString
} from '../utils/adminAuditLogger';
import { GoogleUser } from '../utils/googleAuth';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: GoogleUser | null;
}

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  currentUser
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => isAdminAuthenticated());
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Dashboard state
  const [auditUsers, setAuditUsers] = useState<GoogleUserAuditRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedUserEmail, setExpandedUserEmail] = useState<string | null>(null);
  const [expandedUaEmail, setExpandedUaEmail] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'diagnostic'>('users');

  // Live diagnostic tool state (Choco-IPchecker style)
  const [liveGeo, setLiveGeo] = useState<IpGeoDetails | null>(null);
  const [isLoadingLiveGeo, setIsLoadingLiveGeo] = useState(false);

  // Sync users list
  const loadUsers = () => {
    const list = getAllAuditUsers();
    setAuditUsers(list);
  };

  useEffect(() => {
    if (!isOpen) return;
    setIsAuthenticated(isAdminAuthenticated());
    if (isAdminAuthenticated()) {
      loadUsers();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleUpdate = () => {
      loadUsers();
    };
    window.addEventListener('zero_admin_audit_updated', handleUpdate);
    window.addEventListener('zero_admin_auth_changed', (e: any) => {
      setIsAuthenticated(e.detail === true);
    });
    return () => {
      window.removeEventListener('zero_admin_audit_updated', handleUpdate);
    };
  }, []);

  // Diagnostic tool: fetch live info when diagnostic tab is selected
  useEffect(() => {
    if (isOpen && isAuthenticated && activeTab === 'diagnostic' && !liveGeo) {
      handleRunDiagnostic();
    }
  }, [isOpen, isAuthenticated, activeTab]);

  if (!isOpen) return null;

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsVerifying(true);

    setTimeout(() => {
      if (verifyAdminPassword(passwordInput)) {
        setAdminAuthenticated(true);
        setIsAuthenticated(true);
        setPasswordInput('');
        loadUsers();
      } else {
        // Strictly no hints as requested by user
        setAuthError('パスワードが正しくありません');
      }
      setIsVerifying(false);
    }, 200);
  };

  const handleLogout = () => {
    clearAdminAuthentication();
    setIsAuthenticated(false);
    setPasswordInput('');
    setAuthError('');
  };

  const handleRunDiagnostic = async () => {
    setIsLoadingLiveGeo(true);
    try {
      const geo = await fetchClientIpAndGeo();
      setLiveGeo(geo);
    } finally {
      setIsLoadingLiveGeo(false);
    }
  };

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    loadUsers();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleRefreshUser = async (email: string) => {
    await refreshUserIpInfo(email);
    loadUsers();
    showCopiedTooltip(`refreshed_${email}`);
  };

  const handleDeleteUser = (email: string) => {
    if (window.confirm(`「${email}」のログ・IP情報を一覧から削除しますか？`)) {
      deleteUserAuditRecord(email);
      loadUsers();
    }
  };

  const handleClearAll = () => {
    if (window.confirm('すべてのGoogleユーザーログ・IP履歴を完全に消去しますか？この操作は取り消せません。')) {
      clearAllAuditLogs();
      loadUsers();
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    showCopiedTooltip(key);
  };

  const showCopiedTooltip = (key: string) => {
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Filter users
  const filteredUsers = auditUsers.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.ip || '').toLowerCase().includes(q) ||
      (u.ipDetails?.city || '').toLowerCase().includes(q) ||
      (u.ipDetails?.country || '').toLowerCase().includes(q) ||
      (u.ipDetails?.isp || '').toLowerCase().includes(q) ||
      (u.parsedUserAgent?.os || '').toLowerCase().includes(q) ||
      (u.parsedUserAgent?.browser || '').toLowerCase().includes(q) ||
      (u.userAgent || '').toLowerCase().includes(q)
    );
  });

  // Calculate stats
  const uniqueIpsCount = new Set(auditUsers.map((u) => u.ip).filter((ip) => ip && !ip.includes('未取得'))).size;
  const totalLogsCount = auditUsers.reduce((acc, u) => acc + (u.activityLogs?.length || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="bg-white dark:bg-neutral-900 border-2 border-neutral-300 dark:border-neutral-800 rounded-2xl max-w-4xl w-full max-h-[92vh] shadow-2xl overflow-hidden flex flex-col text-neutral-900 dark:text-neutral-100 animate-scale-up">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 flex items-center justify-center shadow-xs">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base sm:text-lg text-neutral-900 dark:text-white">
                  管理者ダッシュボード
                </h2>
                {isAuthenticated && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    認証済み
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Googleアカウント認証ログ・IP・UserAgent管理コンソール
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors flex items-center gap-1.5 cursor-pointer"
                title="管理者ログアウト"
              >
                <Lock className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">ログアウト</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              title="閉じる"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        {!isAuthenticated ? (
          /* Password Authentication Gate */
          <div className="p-6 sm:p-10 flex flex-col items-center justify-center my-auto">
            <div className="w-16 h-16 rounded-2xl bg-neutral-100 dark:bg-neutral-800 border-2 border-neutral-300 dark:border-neutral-700 flex items-center justify-center text-neutral-700 dark:text-neutral-300 mb-5 shadow-sm">
              <Key className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-bold text-neutral-900 dark:text-white text-center mb-1.5">
              管理者認証
            </h3>
            <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 text-center max-w-sm mb-6">
              Googleアカウント利用者のログ、IP、UserAgent一覧を閲覧・管理するには管理者パスワードを入力してください。
            </p>

            <form onSubmit={handleLoginSubmit} className="w-full max-w-sm space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                  管理者パスワード
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      if (authError) setAuthError('');
                    }}
                    placeholder="管理者パスワード"
                    autoFocus
                    className="w-full px-4 py-2.5 pr-11 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border-2 border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white placeholder-neutral-500 focus:outline-none focus:border-red-500 transition-colors text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {authError && (
                  <div className="mt-2 text-xs font-medium text-red-600 dark:text-red-400 flex items-center gap-1.5 animate-shake">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isVerifying || !passwordInput}
                className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {isVerifying ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Unlock className="w-4 h-4" />
                )}
                <span>認証してダッシュボードを開く</span>
              </button>
            </form>
          </div>
        ) : (
          /* Authenticated Dashboard View */
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {/* Summary Statistics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">Googleユーザー</div>
                  <div className="text-lg font-bold text-neutral-900 dark:text-white">
                    {auditUsers.length} <span className="text-xs font-normal">名</span>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">検出IPアドレス</div>
                  <div className="text-lg font-bold text-neutral-900 dark:text-white">
                    {uniqueIpsCount} <span className="text-xs font-normal">件</span>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">総アクティビティ</div>
                  <div className="text-lg font-bold text-neutral-900 dark:text-white">
                    {totalLogsCount} <span className="text-xs font-normal">件</span>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">最新記録</div>
                  <div className="text-xs font-semibold text-neutral-900 dark:text-white truncate max-w-[120px]">
                    {auditUsers[0]?.lastActiveAt
                      ? new Date(auditUsers[0].lastActiveAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
                      : 'なし'}
                  </div>
                </div>
              </div>
            </div>

            {/* Sub Tabs & Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 w-fit">
                <button
                  type="button"
                  onClick={() => setActiveTab('users')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === 'users'
                      ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Googleログインユーザー一覧 ({auditUsers.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('diagnostic')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === 'diagnostic'
                      ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  <Wifi className="w-3.5 h-3.5" />
                  <span>IP/端末診断ツール (Choco)</span>
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={handleRefreshAll}
                  disabled={isRefreshing}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors flex items-center gap-1 cursor-pointer"
                  title="一覧を最新に更新"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span>更新</span>
                </button>
                <button
                  onClick={exportAuditLogsCsv}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors flex items-center gap-1 cursor-pointer"
                  title="CSV出力"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>CSV</span>
                </button>
                <button
                  onClick={exportAuditLogsJson}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors flex items-center gap-1 cursor-pointer"
                  title="JSON出力"
                >
                  <FileCode className="w-3.5 h-3.5 text-blue-600" />
                  <span>JSON</span>
                </button>
                <button
                  onClick={handleClearAll}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors flex items-center gap-1 cursor-pointer ml-auto sm:ml-0"
                  title="全ログをクリア"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>全消去</span>
                </button>
              </div>
            </div>

            {/* TAB 1: User List */}
            {activeTab === 'users' && (
              <div className="space-y-4">
                {/* Search Filter Input */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="名前、メール、IPアドレス、市区町村、OS、ブラウザで検索..."
                    className="w-full pl-9 pr-4 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-xs sm:text-sm text-neutral-900 dark:text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {filteredUsers.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl border-2 border-dashed border-neutral-300 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
                    <Users className="w-10 h-10 mx-auto text-neutral-400 mb-2.5" />
                    <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                      {searchQuery ? '検索条件に一致するユーザーは見つかりませんでした' : '現在記録されているGoogleログインユーザーはいません'}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-sm mx-auto">
                      Googleアカウントでログインが行われると、自動的にログ、IPアドレス、UserAgent情報がここにリアルタイム記録されます。
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredUsers.map((user) => {
                      const isExpanded = expandedUserEmail === user.email;
                      const isUaExpanded = expandedUaEmail === user.email;
                      const isCurrentActive = currentUser?.email && currentUser.email.toLowerCase() === user.email.toLowerCase();

                      return (
                        <div
                          key={user.id || user.email}
                          className={`rounded-xl border-2 transition-all overflow-hidden ${
                            isCurrentActive
                              ? 'border-emerald-400/60 dark:border-emerald-600/50 bg-emerald-50/20 dark:bg-emerald-950/10'
                              : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800/40'
                          }`}
                        >
                          {/* User Item Header Card */}
                          <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div className="flex items-start sm:items-center gap-3 min-w-0">
                              <img
                                src={user.picture || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(user.email)}`}
                                alt={user.name}
                                className="w-11 h-11 rounded-full border border-neutral-300 dark:border-neutral-700 object-cover shrink-0"
                                onError={(e: any) => {
                                  e.target.src = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(user.email)}`;
                                }}
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-sm text-neutral-900 dark:text-white truncate">
                                    {user.name}
                                  </span>
                                  {isCurrentActive && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500 text-white">
                                      現在ログイン中
                                    </span>
                                  )}
                                  <span className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                                    {user.email}
                                  </span>
                                </div>

                                {/* IP & Location badge */}
                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono font-semibold bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200">
                                    <Globe className="w-3 h-3 text-blue-500" />
                                    <span>{user.ip}</span>
                                    <button
                                      type="button"
                                      onClick={() => copyToClipboard(user.ip, `ip_${user.email}`)}
                                      className="ml-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
                                      title="IPをコピー"
                                    >
                                      {copiedKey === `ip_${user.email}` ? (
                                        <Check className="w-3 h-3 text-emerald-500" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </button>
                                  </div>

                                  {(user.ipDetails?.country || user.ipDetails?.city) && (
                                    <span className="inline-flex items-center gap-1 text-[11px] text-neutral-600 dark:text-neutral-400">
                                      <MapPin className="w-3 h-3 text-red-500" />
                                      <span>
                                        {[user.ipDetails.country, user.ipDetails.city].filter(Boolean).join(' / ')}
                                      </span>
                                    </span>
                                  )}

                                  {user.ipDetails?.isp && (
                                    <span className="text-[11px] text-neutral-500 dark:text-neutral-500 truncate max-w-[150px]">
                                      ({user.ipDetails.isp})
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Client OS & Browser Badges */}
                            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between md:justify-end">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-neutral-100 dark:bg-neutral-700/60 text-neutral-700 dark:text-neutral-300">
                                  {user.parsedUserAgent?.device === 'スマートフォン' ? (
                                    <Smartphone className="w-3 h-3 text-purple-500" />
                                  ) : user.parsedUserAgent?.device === 'タブレット' ? (
                                    <Tablet className="w-3 h-3 text-amber-500" />
                                  ) : (
                                    <Monitor className="w-3 h-3 text-blue-500" />
                                  )}
                                  <span>{user.parsedUserAgent?.os || '不明OS'}</span>
                                </span>

                                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-neutral-100 dark:bg-neutral-700/60 text-neutral-700 dark:text-neutral-300">
                                  {user.parsedUserAgent?.browser || 'ブラウザ'}
                                </span>
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleRefreshUser(user.email)}
                                  className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                                  title="このユーザーのIPを再検査"
                                >
                                  {copiedKey === `refreshed_${user.email}` ? (
                                    <Check className="w-4 h-4 text-emerald-500" />
                                  ) : (
                                    <RefreshCw className="w-4 h-4" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setExpandedUserEmail(isExpanded ? null : user.email)}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1 cursor-pointer ${
                                    isExpanded
                                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-transparent'
                                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700'
                                  }`}
                                >
                                  <Activity className="w-3 h-3" />
                                  <span>ログ ({user.activityLogs?.length || 0})</span>
                                  {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(user.email)}
                                  className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer"
                                  title="このユーザーを削除"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Expandable User Details (Raw UA & Activity Logs) */}
                          {isExpanded && (
                            <div className="border-t border-neutral-200 dark:border-neutral-700/60 p-4 bg-neutral-50/70 dark:bg-neutral-900/50 space-y-4">
                              {/* Full User-Agent Inspector */}
                              <div className="rounded-lg bg-neutral-100 dark:bg-neutral-800 p-3 border border-neutral-200 dark:border-neutral-700">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                                    <Monitor className="w-3 h-3 text-neutral-500" />
                                    <span>詳細 User-Agent 文字列:</span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(user.userAgent, `ua_${user.email}`)}
                                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                                  >
                                    {copiedKey === `ua_${user.email}` ? (
                                      <>
                                        <Check className="w-3 h-3 text-emerald-500" />
                                        <span>コピー完了</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3 h-3" />
                                        <span>UserAgentをコピー</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                                <div className="font-mono text-[11px] text-neutral-600 dark:text-neutral-400 break-all leading-relaxed bg-white dark:bg-neutral-900 p-2 rounded border border-neutral-200 dark:border-neutral-800">
                                  {user.userAgent || 'User-Agent情報なし'}
                                </div>
                              </div>

                              {/* Activity Logs Timeline */}
                              <div>
                                <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 mb-2 flex items-center gap-1.5">
                                  <Activity className="w-3.5 h-3.5 text-blue-500" />
                                  <span>活動履歴タイムライン (直近 {user.activityLogs?.length || 0} 件)</span>
                                </h4>

                                <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                                  {user.activityLogs && user.activityLogs.length > 0 ? (
                                    user.activityLogs.map((log) => (
                                      <div
                                        key={log.id}
                                        className="p-2 rounded-lg bg-white dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 text-xs flex items-center justify-between gap-2"
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span
                                            className={`w-2 h-2 rounded-full shrink-0 ${
                                              log.action === 'login'
                                                ? 'bg-emerald-500'
                                                : log.action === 'watch'
                                                ? 'bg-red-500'
                                                : log.action === 'search'
                                                ? 'bg-blue-500'
                                                : 'bg-neutral-400'
                                            }`}
                                          />
                                          <span className="font-medium text-neutral-800 dark:text-neutral-200 truncate">
                                            {log.description}
                                          </span>
                                        </div>
                                        <span className="text-[10px] font-mono text-neutral-400 dark:text-neutral-500 shrink-0">
                                          {new Date(log.timestamp).toLocaleString('ja-JP', {
                                            month: '2-digit',
                                            day: '2-digit',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            second: '2-digit'
                                          })}
                                        </span>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-xs text-neutral-500 p-2">ログはありません</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Live Diagnostic Tool (Choco-IPchecker style) */}
            {activeTab === 'diagnostic' && (
              <div className="p-4 sm:p-5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/60 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                      <Wifi className="w-4 h-4 text-emerald-500" />
                      <span>リアルタイム接続・IP診断 (Choco-IPchecker 方式)</span>
                    </h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      現在この端末のパブリックIP、プロバイダ情報、位置情報、ブラウザ環境をリアルタイム計測します。
                    </p>
                  </div>
                  <button
                    onClick={handleRunDiagnostic}
                    disabled={isLoadingLiveGeo}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLiveGeo ? 'animate-spin' : ''}`} />
                    <span>即時再検査</span>
                  </button>
                </div>

                {isLoadingLiveGeo ? (
                  <div className="py-12 flex flex-col items-center justify-center text-neutral-500 gap-2">
                    <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                    <span className="text-xs font-semibold">IP・プロバイダ情報を問い合わせ中...</span>
                  </div>
                ) : liveGeo ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* IP & Location Box */}
                    <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-3">
                      <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1">
                        <Globe className="w-3.5 h-3.5 text-blue-500" />
                        <span>IP & ネットワーク情報</span>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                          <span className="text-neutral-500">パブリックIP:</span>
                          <span className="font-mono font-bold text-neutral-900 dark:text-white">{liveGeo.ip}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                          <span className="text-neutral-500">国 / 地域:</span>
                          <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                            {liveGeo.country || '日本'}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                          <span className="text-neutral-500">都道府県 / 市区町村:</span>
                          <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                            {[liveGeo.region, liveGeo.city].filter(Boolean).join(' ') || '取得完了'}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                          <span className="text-neutral-500">ISP / 組織:</span>
                          <span className="font-semibold text-neutral-800 dark:text-neutral-200 truncate max-w-[200px]">
                            {liveGeo.isp || liveGeo.org || '通常回線'}
                          </span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-neutral-500">タイムゾーン:</span>
                          <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                            {liveGeo.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Environment & UA Box */}
                    <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-3">
                      <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1">
                        <Monitor className="w-3.5 h-3.5 text-purple-500" />
                        <span>クライアント端末環境</span>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                          <span className="text-neutral-500">OS:</span>
                          <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                            {parseUserAgentString().os}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                          <span className="text-neutral-500">ブラウザ:</span>
                          <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                            {parseUserAgentString().browser}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                          <span className="text-neutral-500">デバイス種別:</span>
                          <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                            {parseUserAgentString().device}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                          <span className="text-neutral-500">画面解像度:</span>
                          <span className="font-semibold text-neutral-800 dark:text-neutral-200 font-mono">
                            {typeof window !== 'undefined' ? `${window.screen?.width} × ${window.screen?.height}` : '-'}
                          </span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-neutral-500">言語設定:</span>
                          <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                            {typeof navigator !== 'undefined' ? navigator.language : 'ja-JP'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
