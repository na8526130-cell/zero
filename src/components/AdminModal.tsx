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
  FileSpreadsheet,
  FileCode,
  Copy,
  Check,
  Eye,
  EyeOff,
  AlertCircle,
  Activity,
  ChevronDown,
  ChevronUp,
  MapPin,
  Server,
  Wifi,
  Cpu,
  Battery,
  BatteryCharging,
  Layers,
  ExternalLink,
  Compass,
  Radio,
  Bell,
  Ban,
  Navigation,
  Fingerprint
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
  detectHardwareDetails,
  detectNetworkDetails,
  detectBatteryDetails,
  DeviceHardwareDetails,
  NetworkConnectionDetails,
  BatteryStatusDetails,
  getBlockedEntities,
  blockVisitor,
  unblockVisitor,
  BlockedEntity,
  getNotifySettings,
  saveNotifySettings,
  NotifySettings,
  dispatchAccessAlert,
  DEFAULT_NOTIFY_EMAIL
} from '../utils/adminAuditLogger';
import { GoogleUser } from '../utils/googleAuth';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: GoogleUser | null;
}

type UserCategoryFilter = 'all' | 'google' | 'guest';
type MainTab = 'users' | 'map' | 'live' | 'blocked' | 'notify' | 'diagnostic';

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

  // Navigation tab
  const [activeTab, setActiveTab] = useState<MainTab>('users');

  // Dashboard state
  const [auditUsers, setAuditUsers] = useState<GoogleUserAuditRecord[]>([]);
  const [userCategory, setUserCategory] = useState<UserCategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [detailTabMap, setDetailTabMap] = useState<Record<string, 'geo' | 'fingerprint' | 'hardware' | 'logs'>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Blacklist state
  const [blockedEntities, setBlockedEntities] = useState<BlockedEntity[]>(() => getBlockedEntities());

  // Notification settings state
  const [notifyConfig, setNotifyConfig] = useState<NotifySettings>(() => getNotifySettings());
  const [isSendingTestAlert, setIsSendingTestAlert] = useState(false);
  const [testAlertResult, setTestAlertResult] = useState<string | null>(null);

  // Live diagnostic tool state
  const [liveGeo, setLiveGeo] = useState<IpGeoDetails | null>(null);
  const [liveHardware, setLiveHardware] = useState<DeviceHardwareDetails | null>(null);
  const [liveNetwork, setLiveNetwork] = useState<NetworkConnectionDetails | null>(null);
  const [liveBattery, setLiveBattery] = useState<BatteryStatusDetails | null>(null);
  const [isLoadingLiveGeo, setIsLoadingLiveGeo] = useState(false);

  // Map state
  const [selectedMapPinUser, setSelectedMapPinUser] = useState<GoogleUserAuditRecord | null>(null);

  // Sync users list
  const loadUsers = () => {
    const list = getAllAuditUsers();
    setAuditUsers(list);
    setBlockedEntities(getBlockedEntities());
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
    window.addEventListener('zero_admin_blocked_changed', () => setBlockedEntities(getBlockedEntities()));
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

  // Boss key listener: Double Esc or Ctrl+Shift+Q immediately hides admin screen
  useEffect(() => {
    if (!isOpen) return;
    const handleBossKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'q' || e.key === 'Q')) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleBossKey);
    return () => window.removeEventListener('keydown', handleBossKey);
  }, [isOpen, onClose]);

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
    }, 180);
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
      setLiveHardware(detectHardwareDetails());
      setLiveNetwork(detectNetworkDetails());
      const bat = await detectBatteryDetails();
      if (bat) setLiveBattery(bat);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingLiveGeo(false);
    }
  };

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    loadUsers();
    setTimeout(() => {
      setIsRefreshing(false);
    }, 400);
  };

  const handleRefreshUser = async (userIdOrEmail: string) => {
    showCopiedTooltip(`refreshed_${userIdOrEmail}`);
    await refreshUserIpInfo(userIdOrEmail);
    loadUsers();
  };

  const handleDeleteUser = (userIdOrEmail: string) => {
    if (window.confirm('このユーザーレコードを削除しますか？')) {
      deleteUserAuditRecord(userIdOrEmail);
      loadUsers();
    }
  };

  const handleBlockUser = (type: 'ip' | 'fingerprint' | 'email', value: string, name: string) => {
    if (!value || value.includes('未取得')) {
      alert('有効なIPまたは識別子が存在しません');
      return;
    }
    const reason = prompt(`${name} (${value}) をブロックしますか？\n理由を入力してください（空欄でも可）:`, '不審なアクセス');
    if (reason !== null) {
      blockVisitor(type, value, reason);
      loadUsers();
      alert(`✅ ${value} をブロック（アクセス遮断）リストに追加しました。次回アクセス時に404エラーで撃退されます。`);
    }
  };

  const handleUnblock = (idOrValue: string) => {
    if (window.confirm('このブロック（アクセス制限）を解除しますか？')) {
      unblockVisitor(idOrValue);
      loadUsers();
    }
  };

  const handleClearAll = () => {
    if (window.confirm('すべての訪問者・ユーザーログ・IP履歴を完全に消去しますか？この操作は取り消せません。')) {
      clearAllAuditLogs();
      loadUsers();
    }
  };

  const handleSaveNotifySettings = () => {
    saveNotifySettings(notifyConfig);
    showCopiedTooltip('saved_notify');
  };

  const handleSendTestAlert = async () => {
    setIsSendingTestAlert(true);
    setTestAlertResult(null);
    try {
      const dummyRecord: GoogleUserAuditRecord = auditUsers[0] || {
        id: 'test_sample',
        userType: 'guest',
        email: 'sample@test.local',
        name: '通知テスト訪問者',
        picture: '',
        firstLoginAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        visitCount: 1,
        ip: '133.200.12.34',
        ipDetails: {
          ip: '133.200.12.34',
          country: '日本',
          city: '東京都 渋谷区',
          isp: 'SoftBank Corp.'
        },
        userAgent: navigator.userAgent,
        parsedUserAgent: { browser: 'Apple Safari', os: 'iOS 17.5', device: 'スマートフォン', raw: navigator.userAgent },
        fingerprint: {
          compositeId: 'FP-TEST-0001',
          canvasHash: '9a8b7c6d',
          audioHash: '1a2b3c4d',
          installedFonts: ['Hiragino Sans', 'Yu Gothic'],
          refreshRateHz: 120,
          refreshRateLabel: '120Hz (ProMotion)'
        },
        activityLogs: []
      };

      const success = await dispatchAccessAlert(dummyRecord, '【テスト送信】管理者通知チェック');
      if (success) {
        setTestAlertResult(`✅ 宛先「${notifyConfig.email || DEFAULT_NOTIFY_EMAIL}」へテストアラートを発信しました！`);
      } else {
        setTestAlertResult('⚠️ 送信リクエストを受理しました。ネットワーク環境により数秒遅延する場合があります。');
      }
    } catch {
      setTestAlertResult('❌ 送信中にエラーが発生しました');
    } finally {
      setIsSendingTestAlert(false);
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

  // Filter users by category and search query
  const filteredUsers = auditUsers.filter((u) => {
    if (userCategory === 'google' && u.userType !== 'google') return false;
    if (userCategory === 'guest' && u.userType === 'google') return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.ip || '').toLowerCase().includes(q) ||
      (u.fingerprint?.compositeId || '').toLowerCase().includes(q) ||
      (u.ipDetails?.city || '').toLowerCase().includes(q) ||
      (u.ipDetails?.region || '').toLowerCase().includes(q) ||
      (u.ipDetails?.country || '').toLowerCase().includes(q) ||
      (u.ipDetails?.isp || '').toLowerCase().includes(q) ||
      (u.ipDetails?.org || '').toLowerCase().includes(q) ||
      (u.parsedUserAgent?.os || '').toLowerCase().includes(q) ||
      (u.parsedUserAgent?.browser || '').toLowerCase().includes(q) ||
      (u.hardware?.gpuRenderer || '').toLowerCase().includes(q)
    );
  });

  // Calculate stats
  const googleUsersCount = auditUsers.filter((u) => u.userType === 'google').length;
  const guestUsersCount = auditUsers.filter((u) => u.userType !== 'google').length;
  const uniqueIpsCount = new Set(auditUsers.map((u) => u.ip).filter((ip) => ip && !ip.includes('未取得'))).size;
  const vpnSuspiciousCount = auditUsers.filter((u) => u.vpn?.isSuspicious).length;

  // Real-time online users (active within last 35 seconds)
  const nowTs = Date.now();
  const onlineUsers = auditUsers.filter((u) => {
    if (!u.lastActiveAt) return false;
    const diffMs = nowTs - new Date(u.lastActiveAt).getTime();
    return diffMs <= 35000;
  });

  // Valid coordinates for map
  const mappableUsers = auditUsers.filter((u) => u.ipDetails?.latitude && u.ipDetails?.longitude);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-5 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-white dark:bg-neutral-900 border-2 border-neutral-300 dark:border-neutral-800 rounded-2xl max-w-5xl w-full max-h-[94vh] shadow-2xl overflow-hidden flex flex-col text-neutral-900 dark:text-neutral-100 animate-scale-up">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/95 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 flex items-center justify-center shadow-xs">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base sm:text-lg text-neutral-900 dark:text-white">
                  管理者セキュリティコンソール
                </h2>
                {isAuthenticated && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    認証済み
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                指紋識別・VPN検知・リアルタイム潜入通知・IP撃退システム
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {isAuthenticated && (
              <>
                <button
                  onClick={onClose}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors flex items-center gap-1 cursor-pointer"
                  title="一瞬で画面を閉じて通常動画プレイヤーに戻る (Ctrl+Q)"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">カモフラージュ</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex items-center gap-1 cursor-pointer"
                  title="管理者ログアウト"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">ログアウト</span>
                </button>
              </>
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
              全アクセスユーザーのログ、IP、フィンガープリント、位置情報マップを閲覧するには管理者パスワードを入力してください。
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
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[11px] text-neutral-500">総記録ユーザー</div>
                  <div className="text-base font-bold text-neutral-900 dark:text-white">
                    {auditUsers.length} <span className="text-xs font-normal text-neutral-500">名</span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[11px] text-neutral-500">検出ユニークIP</div>
                  <div className="text-base font-bold text-neutral-900 dark:text-white">
                    {uniqueIpsCount} <span className="text-xs font-normal text-neutral-500">件</span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                </div>
                <div>
                  <div className="text-[11px] text-neutral-500">現在オンライン</div>
                  <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                    {onlineUsers.length} <span className="text-xs font-normal text-neutral-500">名</span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[11px] text-neutral-500">VPN/偽装疑い</div>
                  <div className="text-base font-bold text-amber-600 dark:text-amber-400">
                    {vpnSuspiciousCount} <span className="text-xs font-normal text-neutral-500">件</span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60 flex items-center gap-2.5 col-span-2 sm:col-span-1">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                  <Ban className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[11px] text-neutral-500">BAN遮断数</div>
                  <div className="text-base font-bold text-red-600 dark:text-red-400">
                    {blockedEntities.length} <span className="text-xs font-normal text-neutral-500">件</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation Tabs Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-1 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 w-fit flex-wrap">
                <button
                  type="button"
                  onClick={() => setActiveTab('users')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'users'
                      ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>アクセス一覧 ({auditUsers.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('map')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'map'
                      ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  <Navigation className="w-3.5 h-3.5 text-cyan-500" />
                  <span>マップビュー ({mappableUsers.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('live')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'live'
                      ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  <Radio className="w-3.5 h-3.5 text-emerald-500" />
                  <span>リアルタイム監視 ({onlineUsers.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('blocked')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'blocked'
                      ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  <Ban className="w-3.5 h-3.5 text-red-500" />
                  <span>BAN管理 ({blockedEntities.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('notify')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'notify'
                      ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  <Bell className="w-3.5 h-3.5 text-amber-500" />
                  <span>潜入通知</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('diagnostic')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'diagnostic'
                      ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  <Wifi className="w-3.5 h-3.5" />
                  <span>端末診断</span>
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={handleRefreshAll}
                  disabled={isRefreshing}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors flex items-center gap-1 cursor-pointer"
                  title="最新データを再取得"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span>更新</span>
                </button>
                <button
                  onClick={exportAuditLogsCsv}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors flex items-center gap-1 cursor-pointer"
                  title="全詳細項目（指紋・VPN・回線等）をCSV出力"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>CSV</span>
                </button>
                <button
                  onClick={exportAuditLogsJson}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors flex items-center gap-1 cursor-pointer"
                  title="全詳細項目をJSON出力"
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
                {/* Category Filter Pills & Search Input */}
                <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setUserCategory('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        userCategory === 'all'
                          ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                      }`}
                    >
                      すべて ({auditUsers.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserCategory('google')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        userCategory === 'google'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                      }`}
                    >
                      Googleログイン ({googleUsersCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserCategory('guest')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        userCategory === 'guest'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                      }`}
                    >
                      ゲスト訪問者 ({guestUsersCount})
                    </button>
                  </div>

                  {/* Search Filter Input */}
                  <div className="relative flex-1 sm:max-w-xs">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="IP, 指紋ID, 市区町村, GPU, OSで検索..."
                      className="w-full pl-9 pr-7 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-xs text-neutral-900 dark:text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {filteredUsers.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl border-2 border-dashed border-neutral-300 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
                    <Users className="w-10 h-10 mx-auto text-neutral-400 mb-2.5" />
                    <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                      {searchQuery ? '検索条件に一致するユーザーは見つかりませんでした' : '現在記録されているユーザーはいません'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredUsers.map((user) => {
                      const userKey = user.id || user.email;
                      const isExpanded = expandedUserId === userKey;
                      const isCurrentActive = currentUser?.email && currentUser.email.toLowerCase() === user.email.toLowerCase();
                      const detailTab = detailTabMap[userKey] || 'geo';

                      // Check online state
                      const diffMs = user.lastActiveAt ? nowTs - new Date(user.lastActiveAt).getTime() : 999999;
                      const isLive = diffMs <= 35000;

                      const setDetailTab = (tab: 'geo' | 'fingerprint' | 'hardware' | 'logs') => {
                        setDetailTabMap((prev) => ({ ...prev, [userKey]: tab }));
                      };

                      return (
                        <div
                          key={userKey}
                          className={`rounded-xl border-2 transition-all overflow-hidden ${
                            isCurrentActive
                              ? 'border-emerald-400/60 dark:border-emerald-600/50 bg-emerald-50/20 dark:bg-emerald-950/10'
                              : user.vpn?.isSuspicious
                              ? 'border-amber-300 dark:border-amber-800/60 bg-amber-50/10 dark:bg-amber-950/10'
                              : user.userType === 'google'
                              ? 'border-blue-200 dark:border-blue-900/40 bg-white dark:bg-neutral-800/40'
                              : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800/40'
                          }`}
                        >
                          {/* User Item Header Card */}
                          <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div className="flex items-start sm:items-center gap-3 min-w-0">
                              <div className="relative shrink-0">
                                {user.userType === 'google' && user.picture ? (
                                  <img
                                    src={user.picture}
                                    alt={user.name}
                                    className="w-11 h-11 rounded-full border border-blue-300 dark:border-blue-700 object-cover"
                                    onError={(e: any) => {
                                      e.target.src = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(user.email)}`;
                                    }}
                                  />
                                ) : (
                                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                                    <Globe className="w-5 h-5" />
                                  </div>
                                )}
                                {isLive && (
                                  <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-neutral-900 shadow-xs" title="現在アクティブに閲覧中">
                                    <span className="w-full h-full rounded-full bg-emerald-400 animate-ping block opacity-75"></span>
                                  </span>
                                )}
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-sm text-neutral-900 dark:text-white truncate">
                                    {user.name}
                                  </span>

                                  {/* Online / Offline tag */}
                                  {isLive ? (
                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                      LIVE
                                    </span>
                                  ) : null}

                                  {/* User Type Badge */}
                                  {user.userType === 'google' ? (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                                      Google認証
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                                      ゲスト
                                    </span>
                                  )}

                                  {/* VPN / Proxy Suspicion Tag */}
                                  {user.vpn?.isSuspicious && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-400 dark:border-amber-800 flex items-center gap-1" title={user.vpn.reasons.join('\n')}>
                                      <Shield className="w-3 h-3 text-amber-600" />
                                      VPN/偽装疑い
                                    </span>
                                  )}

                                  {user.fingerprint?.compositeId && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-300 dark:border-neutral-700 flex items-center gap-1" title="Canvas & Audio 複合指紋ID (シークレットモードでも同一特定)">
                                      <Fingerprint className="w-3 h-3 text-purple-500" />
                                      {user.fingerprint.compositeId}
                                    </span>
                                  )}

                                  <span className="text-[10px] text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                                    第{user.visitCount || 1}回
                                  </span>
                                </div>

                                {/* IP & Location badge */}
                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono font-semibold bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200">
                                    <span>{user.ipDetails?.flagEmoji || '🌐'}</span>
                                    <span>{user.ip}</span>
                                    <button
                                      type="button"
                                      onClick={() => copyToClipboard(user.ip, `ip_${userKey}`)}
                                      className="ml-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
                                      title="IPアドレスをコピー"
                                    >
                                      {copiedKey === `ip_${userKey}` ? (
                                        <Check className="w-3 h-3 text-emerald-500" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </button>
                                  </div>

                                  {(user.ipDetails?.country || user.ipDetails?.region || user.ipDetails?.city) && (
                                    <span className="inline-flex items-center gap-1 text-[11px] text-neutral-600 dark:text-neutral-400">
                                      <MapPin className="w-3 h-3 text-red-500" />
                                      <span>
                                        {[user.ipDetails.country, user.ipDetails.region, user.ipDetails.city].filter(Boolean).join(' / ')}
                                      </span>
                                    </span>
                                  )}

                                  {user.ipDetails?.isp && (
                                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate max-w-[160px]" title={user.ipDetails.isp}>
                                      ({user.ipDetails.isp})
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Client OS & Hardware Badges & Actions */}
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

                                {user.fingerprint?.refreshRateLabel && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                                    {user.fingerprint.refreshRateLabel}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleBlockUser('ip', user.ip, user.name)}
                                  className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer"
                                  title="このユーザーのIPをBAN（出禁）にして404表示で撃退"
                                >
                                  <Ban className="w-4 h-4 text-red-500" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRefreshUser(user.id || user.email)}
                                  className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                                  title="最新情報・指紋を再検査"
                                >
                                  {copiedKey === `refreshed_${user.id || user.email}` ? (
                                    <Check className="w-4 h-4 text-emerald-500" />
                                  ) : (
                                    <RefreshCw className="w-4 h-4" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setExpandedUserId(isExpanded ? null : userKey)}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1 cursor-pointer ${
                                    isExpanded
                                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-transparent shadow-xs'
                                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700'
                                  }`}
                                >
                                  <Compass className="w-3 h-3" />
                                  <span>全詳細・指紋</span>
                                  {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(user.id || user.email)}
                                  className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer"
                                  title="ログレコードを削除"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Expandable Comprehensive Details Panel */}
                          {isExpanded && (
                            <div className="border-t border-neutral-200 dark:border-neutral-700/60 p-4 sm:p-5 bg-neutral-50/70 dark:bg-neutral-900/50 space-y-4">
                              {/* Detail Tabs */}
                              <div className="flex items-center gap-1 border-b border-neutral-200 dark:border-neutral-800 pb-2 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => setDetailTab('geo')}
                                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                    detailTab === 'geo'
                                      ? 'bg-blue-600 text-white'
                                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800'
                                  }`}
                                >
                                  <Globe className="w-3 h-3" />
                                  <span>IP & 位置・回線</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setDetailTab('fingerprint')}
                                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                    detailTab === 'fingerprint'
                                      ? 'bg-purple-600 text-white'
                                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800'
                                  }`}
                                >
                                  <Fingerprint className="w-3 h-3" />
                                  <span>指紋識別 (Canvas/Audio/フォント)</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setDetailTab('hardware')}
                                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                    detailTab === 'hardware'
                                      ? 'bg-blue-600 text-white'
                                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800'
                                  }`}
                                >
                                  <Cpu className="w-3 h-3" />
                                  <span>端末スペック & GPU</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setDetailTab('logs')}
                                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                    detailTab === 'logs'
                                      ? 'bg-blue-600 text-white'
                                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800'
                                  }`}
                                >
                                  <Activity className="w-3 h-3" />
                                  <span>行動ログ ({user.activityLogs?.length || 0})</span>
                                </button>
                              </div>

                              {/* TAB A: Geo & Network Details */}
                              {detailTab === 'geo' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                  <div className="p-3 rounded-xl bg-white dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700/80 space-y-2">
                                    <div className="font-bold text-neutral-800 dark:text-neutral-200 flex items-center justify-between border-b border-neutral-100 dark:border-neutral-700 pb-1.5">
                                      <div className="flex items-center gap-1.5">
                                        <Globe className="w-3.5 h-3.5 text-blue-500" />
                                        <span>IPアドレス & 接続プロバイダ</span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleBlockUser('ip', user.ip, user.name)}
                                        className="text-red-500 hover:underline flex items-center gap-0.5 text-[11px] cursor-pointer"
                                      >
                                        <Ban className="w-3 h-3" />
                                        <span>このIPをBAN</span>
                                      </button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-1">
                                      <span className="text-neutral-500">パブリックIP:</span>
                                      <span className="col-span-2 font-mono font-bold text-neutral-900 dark:text-white flex items-center gap-1">
                                        {user.ip}
                                        {user.ipDetails?.type && <span className="text-[10px] text-neutral-400">({user.ipDetails.type})</span>}
                                      </span>

                                      <span className="text-neutral-500">ISP (回線):</span>
                                      <span className="col-span-2 font-semibold text-neutral-800 dark:text-neutral-200">
                                        {user.ipDetails?.isp || '未取得'}
                                      </span>

                                      <span className="text-neutral-500">組織 (Org):</span>
                                      <span className="col-span-2 text-neutral-700 dark:text-neutral-300">
                                        {user.ipDetails?.org || '未取得'}
                                      </span>

                                      <span className="text-neutral-500">ASN:</span>
                                      <span className="col-span-2 font-mono text-neutral-700 dark:text-neutral-300">
                                        {user.ipDetails?.asn ? `AS${user.ipDetails.asn}` : '未取得'}
                                      </span>

                                      <span className="text-neutral-500">VPN判定:</span>
                                      <span className="col-span-2 text-neutral-800 dark:text-neutral-200">
                                        {user.vpn?.isSuspicious ? (
                                          <span className="text-amber-600 font-bold">
                                            ⚠️ 疑いあり: {user.vpn.reasons.join(', ')}
                                          </span>
                                        ) : (
                                          <span className="text-emerald-600 font-medium">✅ 一般家庭・通信キャリア回線</span>
                                        )}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="p-3 rounded-xl bg-white dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700/80 space-y-2">
                                    <div className="font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5 border-b border-neutral-100 dark:border-neutral-700 pb-1.5">
                                      <MapPin className="w-3.5 h-3.5 text-red-500" />
                                      <span>地理的位置情報 (GeoIP)</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-1">
                                      <span className="text-neutral-500">国 / 地域:</span>
                                      <span className="col-span-2 font-semibold text-neutral-800 dark:text-neutral-200">
                                        {user.ipDetails?.flagEmoji} {user.ipDetails?.country || '日本'} ({user.ipDetails?.countryCode})
                                      </span>

                                      <span className="text-neutral-500">都道府県/地域:</span>
                                      <span className="col-span-2 text-neutral-800 dark:text-neutral-200">
                                        {user.ipDetails?.region || '未取得'}
                                      </span>

                                      <span className="text-neutral-500">市区町村:</span>
                                      <span className="col-span-2 font-semibold text-neutral-800 dark:text-neutral-200">
                                        {user.ipDetails?.city || '未取得'} {user.ipDetails?.postal ? `(〒${user.ipDetails.postal})` : ''}
                                      </span>

                                      <span className="text-neutral-500">緯度・経度:</span>
                                      <span className="col-span-2 font-mono text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                                        {user.ipDetails?.latitude && user.ipDetails?.longitude ? (
                                          <>
                                            <span>{user.ipDetails.latitude.toFixed(4)}, {user.ipDetails.longitude.toFixed(4)}</span>
                                            <a
                                              href={`https://www.google.com/maps?q=${user.ipDetails.latitude},${user.ipDetails.longitude}`}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="text-blue-500 hover:underline inline-flex items-center gap-0.5 ml-1"
                                              title="Googleマップで位置を表示"
                                            >
                                              <ExternalLink className="w-3 h-3" />
                                            </a>
                                          </>
                                        ) : '未取得'}
                                      </span>

                                      <span className="text-neutral-500">タイムゾーン:</span>
                                      <span className="col-span-2 text-neutral-700 dark:text-neutral-300">
                                        {user.ipDetails?.timezone || user.hardware?.timezone || 'Asia/Tokyo'} {user.ipDetails?.timezoneUtc || ''}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* TAB B: Fingerprint Details */}
                              {detailTab === 'fingerprint' && (
                                <div className="p-4 rounded-xl bg-white dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700/80 space-y-3 text-xs">
                                  <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-700 pb-2">
                                    <div className="flex items-center gap-2">
                                      <Fingerprint className="w-4 h-4 text-purple-500" />
                                      <span className="font-bold text-sm text-neutral-900 dark:text-white">
                                        超高精度端末フィンガープリント (シークレットモード対策)
                                      </span>
                                    </div>
                                    {user.fingerprint?.compositeId && (
                                      <button
                                        type="button"
                                        onClick={() => handleBlockUser('fingerprint', user.fingerprint!.compositeId, user.name)}
                                        className="px-2 py-1 rounded text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-800 text-[11px] font-bold cursor-pointer hover:bg-red-100"
                                      >
                                        この端末指紋をBAN
                                      </button>
                                    )}
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between">
                                        <span className="text-neutral-500 font-semibold">複合指紋 ID:</span>
                                        <span className="font-mono font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800">
                                          {user.fingerprint?.compositeId || '未計算'}
                                        </span>
                                      </div>

                                      <div className="flex items-center justify-between">
                                        <span className="text-neutral-500">Canvas 2D ハッシュ:</span>
                                        <span className="font-mono text-neutral-800 dark:text-neutral-200">
                                          {user.fingerprint?.canvasHash || '未取得'}
                                        </span>
                                      </div>

                                      <div className="flex items-center justify-between">
                                        <span className="text-neutral-500">AudioContext DSP ハッシュ:</span>
                                        <span className="font-mono text-neutral-800 dark:text-neutral-200">
                                          {user.fingerprint?.audioHash || '未取得'}
                                        </span>
                                      </div>

                                      <div className="flex items-center justify-between">
                                        <span className="text-neutral-500">画面リフレッシュレート:</span>
                                        <span className="font-bold text-neutral-800 dark:text-neutral-200">
                                          {user.fingerprint?.refreshRateLabel || '60Hz'}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="space-y-1">
                                      <span className="text-neutral-500 font-semibold block">
                                        検出されたインストール済みフォント ({user.fingerprint?.installedFonts?.length || 0} 個):
                                      </span>
                                      <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1.5 rounded bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                                        {user.fingerprint?.installedFonts && user.fingerprint.installedFonts.length > 0 ? (
                                          user.fingerprint.installedFonts.map((f) => (
                                            <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300">
                                              {f}
                                            </span>
                                          ))
                                        ) : (
                                          <span className="text-neutral-400 text-[11px]">標準システムフォントのみ</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* TAB C: Hardware & Specs Details */}
                              {detailTab === 'hardware' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                  <div className="p-3 rounded-xl bg-white dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700/80 space-y-2">
                                    <div className="font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5 border-b border-neutral-100 dark:border-neutral-700 pb-1.5">
                                      <Cpu className="w-3.5 h-3.5 text-purple-500" />
                                      <span>グラフィック (GPU) & プロセッサ</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-1">
                                      <span className="text-neutral-500">GPU レンダラー:</span>
                                      <span className="col-span-2 font-semibold text-neutral-900 dark:text-white break-words">
                                        {user.hardware?.gpuRenderer || '未取得'}
                                      </span>

                                      <span className="text-neutral-500">GPU ベンダー:</span>
                                      <span className="col-span-2 text-neutral-800 dark:text-neutral-200">
                                        {user.hardware?.gpuVendor || '未取得'}
                                      </span>

                                      <span className="text-neutral-500">CPU コア数:</span>
                                      <span className="col-span-2 font-mono text-neutral-800 dark:text-neutral-200">
                                        {user.hardware?.cpuCores ? `${user.hardware.cpuCores} 論理コア` : '未取得'}
                                      </span>

                                      <span className="text-neutral-500">メモリ (RAM):</span>
                                      <span className="col-span-2 font-mono text-neutral-800 dark:text-neutral-200">
                                        {user.hardware?.deviceMemory || '未取得'}
                                      </span>

                                      <span className="text-neutral-500">画面解像度:</span>
                                      <span className="col-span-2 font-mono text-neutral-800 dark:text-neutral-200">
                                        {user.hardware?.screenResolution || '未取得'} (有効領域: {user.hardware?.screenAvailable || '未取得'})
                                      </span>

                                      <span className="text-neutral-500">Retina ピクセル比:</span>
                                      <span className="col-span-2 font-mono text-neutral-800 dark:text-neutral-200">
                                        {user.hardware?.pixelRatio || '1x'}
                                      </span>

                                      <span className="text-neutral-500">タッチ点数:</span>
                                      <span className="col-span-2 text-neutral-800 dark:text-neutral-200">
                                        {user.hardware?.touchPoints ? `最大 ${user.hardware.touchPoints} 点タッチ対応` : 'マウス操作'}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="p-3 rounded-xl bg-white dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700/80 space-y-2">
                                    <div className="font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5 border-b border-neutral-100 dark:border-neutral-700 pb-1.5">
                                      <Radio className="w-3.5 h-3.5 text-emerald-500" />
                                      <span>回線速度・バッテリー・滞在時間</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-1">
                                      <span className="text-neutral-500">回線種別 (Type):</span>
                                      <span className="col-span-2 font-semibold text-neutral-800 dark:text-neutral-200">
                                        {user.network?.effectiveType || '未取得'}
                                      </span>

                                      <span className="text-neutral-500">下り速度 / RTT:</span>
                                      <span className="col-span-2 font-mono text-neutral-800 dark:text-neutral-200">
                                        {user.network?.downlink || 'N/A'} (遅延: {user.network?.rtt || 'N/A'})
                                      </span>

                                      <span className="text-neutral-500">バッテリー残量:</span>
                                      <span className="col-span-2 font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1">
                                        {user.battery?.charging ? <BatteryCharging className="w-3.5 h-3.5 text-emerald-500" /> : <Battery className="w-3.5 h-3.5 text-neutral-400" />}
                                        <span>{user.battery?.level || '取得不可'}</span>
                                        {user.battery?.charging && <span className="text-[10px] text-emerald-600 font-bold">(充電中)</span>}
                                      </span>

                                      <span className="text-neutral-500">アクティブ滞在:</span>
                                      <span className="col-span-2 font-semibold text-neutral-900 dark:text-white">
                                        {user.presence?.activeDurationSec ? `${Math.floor(user.presence.activeDurationSec / 60)}分${user.presence.activeDurationSec % 60}秒` : '計測中'}
                                      </span>

                                      <span className="text-neutral-500">流入元 (Referrer):</span>
                                      <span className="col-span-2 text-neutral-800 dark:text-neutral-200 truncate" title={user.session?.referrer}>
                                        {user.session?.referrer || '直接アクセス'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* TAB D: Activity Logs Timeline */}
                              {detailTab === 'logs' && (
                                <div className="space-y-2">
                                  <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
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
                                                  : 'bg-purple-500'
                                              }`}
                                            />
                                            <span className="font-medium text-neutral-800 dark:text-neutral-200 truncate">
                                              {log.description}
                                            </span>
                                          </div>
                                          <span className="text-[10px] font-mono text-neutral-400 dark:text-neutral-500 shrink-0">
                                            {new Date(log.timestamp).toLocaleString('ja-JP')}
                                          </span>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="text-xs text-neutral-400 text-center py-4">
                                        まだアクティビティ履歴がありません
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Full User-Agent Inspector Footer */}
                              <div className="rounded-lg bg-neutral-100 dark:bg-neutral-800/70 p-3 border border-neutral-200 dark:border-neutral-700">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                                    <Monitor className="w-3 h-3 text-neutral-500" />
                                    <span>生の User-Agent 文字列:</span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(user.userAgent, `ua_${userKey}`)}
                                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                                  >
                                    {copiedKey === `ua_${userKey}` ? (
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
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Map View */}
            {activeTab === 'map' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                      <Navigation className="w-4 h-4 text-cyan-500" />
                      <span>アクセス位置プロット (日本地図 & 座標ビジュアル)</span>
                    </h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      検出されたIP位置情報（緯度・経度）をサイバーマップ上にピン留め表示します。
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800">
                    位置検出数: {mappableUsers.length} 拠点
                  </span>
                </div>

                {/* Cyber Style Interactive Map Canvas / SVG */}
                <div className="relative w-full h-80 sm:h-96 rounded-2xl bg-neutral-950 border-2 border-neutral-800 overflow-hidden flex items-center justify-center shadow-inner">
                  {/* Grid Lines Overlay */}
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f2937_1px,transparent_1px),linear-gradient(to_bottom,#1f2937_1px,transparent_1px)] bg-[size:32px_32px] opacity-25"></div>

                  {/* Stylized Japan Outline SVG */}
                  <svg viewBox="128 30 18 16" className="w-full h-full p-6 text-neutral-700/40">
                    {/* Japan rough schematic paths for positioning */}
                    <path
                      d="M 140 36 L 142 38 L 140 40 L 138 38 Z M 135 34 L 138 35 L 137 37 L 133 35 Z M 130 33 L 132 34 L 131 32 Z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="0.2"
                      strokeDasharray="0.5 0.5"
                    />
                  </svg>

                  {/* Render Pins for each user */}
                  <div className="absolute inset-0 p-8 pointer-events-none">
                    {mappableUsers.map((user) => {
                      const lat = user.ipDetails?.latitude || 35.68;
                      const lng = user.ipDetails?.longitude || 139.76;

                      // Map Japan Lat/Lng to Container Percentage (Lat: 30 to 45, Lng: 128 to 145)
                      const leftPct = Math.max(5, Math.min(95, ((lng - 128) / 18) * 100));
                      const topPct = Math.max(5, Math.min(95, (1 - (lat - 30) / 16) * 100));

                      const isSelected = selectedMapPinUser?.id === user.id;

                      return (
                        <div
                          key={user.id}
                          style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                          className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer group"
                          onClick={() => setSelectedMapPinUser(user)}
                        >
                          <div className="relative">
                            <span className="w-4 h-4 rounded-full bg-cyan-400/80 flex items-center justify-center text-white shadow-lg shadow-cyan-500/50">
                              <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
                            </span>
                            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 border border-white"></span>
                          </div>

                          {/* Hover Tooltip */}
                          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:flex flex-col items-center z-30 pointer-events-none">
                            <div className="bg-neutral-900 border border-cyan-500/50 text-white p-2 rounded-lg text-[10px] shadow-xl whitespace-nowrap space-y-0.5">
                              <div className="font-bold text-cyan-400">{user.name}</div>
                              <div>{user.ipDetails?.flagEmoji} {user.ipDetails?.city || user.ipDetails?.region}</div>
                              <div className="font-mono text-neutral-400">{user.ip}</div>
                              <div className="text-[9px] text-neutral-400">{user.parsedUserAgent?.device} / {user.parsedUserAgent?.os}</div>
                            </div>
                            <div className="w-2 h-2 bg-neutral-900 rotate-45 -mt-1 border-r border-b border-cyan-500/50"></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Selected User Overlay Card in Map */}
                  {selectedMapPinUser && (
                    <div className="absolute bottom-3 left-3 right-3 sm:left-auto sm:right-3 sm:w-80 bg-neutral-900/95 border border-cyan-500/60 p-3 rounded-xl shadow-2xl backdrop-blur-md text-xs text-white z-20 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-cyan-400 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-red-400" />
                          <span>選択中のアクセス地点</span>
                        </span>
                        <button
                          onClick={() => setSelectedMapPinUser(null)}
                          className="text-neutral-400 hover:text-white p-0.5"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="space-y-1">
                        <div className="font-bold text-sm">{selectedMapPinUser.name}</div>
                        <div className="font-mono text-xs text-cyan-300">{selectedMapPinUser.ip}</div>
                        <div className="text-neutral-300">
                          {selectedMapPinUser.ipDetails?.country} {selectedMapPinUser.ipDetails?.region} {selectedMapPinUser.ipDetails?.city}
                        </div>
                        <div className="text-neutral-400 text-[11px] truncate">
                          ISP: {selectedMapPinUser.ipDetails?.isp}
                        </div>
                      </div>

                      <div className="pt-1 flex items-center justify-between border-t border-neutral-800">
                        <a
                          href={`https://www.google.com/maps?q=${selectedMapPinUser.ipDetails?.latitude},${selectedMapPinUser.ipDetails?.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-400 hover:underline flex items-center gap-1 text-[11px]"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Google Mapsで詳細</span>
                        </a>
                        <button
                          onClick={() => {
                            setActiveTab('users');
                            setExpandedUserId(selectedMapPinUser.id);
                          }}
                          className="px-2 py-0.5 rounded bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-[11px]"
                        >
                          ユーザー詳細へ
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: Live Presence Monitor */}
            {activeTab === 'live' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                      <Radio className="w-4 h-4 text-emerald-500 animate-pulse" />
                      <span>現在閲覧中ユーザーのリアルタイム点灯監視</span>
                    </h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      直近35秒以内にアクティブな操作・ハートビートが届いている端末をリアルタイム同期します。
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                    {onlineUsers.length} 名が今まさに閲覧中
                  </span>
                </div>

                {onlineUsers.length === 0 ? (
                  <div className="p-12 text-center rounded-2xl border-2 border-dashed border-neutral-300 dark:border-neutral-800">
                    <Radio className="w-10 h-10 mx-auto text-neutral-400 mb-2 opacity-50" />
                    <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                      現在アクティブな閲覧者はいません
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">
                      誰かがページを開くと、ここに緑のランプが自動点灯してリアルタイム行動が表示されます。
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {onlineUsers.map((u) => (
                      <div
                        key={u.id}
                        className="p-4 rounded-xl border-2 border-emerald-500/60 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-md space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="font-bold text-sm text-neutral-900 dark:text-white">{u.name}</span>
                          </div>
                          <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                            {u.ip}
                          </span>
                        </div>

                        <div className="text-xs text-neutral-600 dark:text-neutral-300 flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-blue-500" />
                          <span className="font-semibold">現在のアクション:</span>
                          <span className="truncate">{u.presence?.currentAction || u.activityLogs?.[0]?.description || '閲覧中'}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-1 text-[11px] text-neutral-500 border-t border-emerald-500/20 pt-2">
                          <div>
                            <span>位置: </span>
                            <span className="text-neutral-800 dark:text-neutral-200 font-medium">
                              {[u.ipDetails?.country, u.ipDetails?.city].filter(Boolean).join(' ')}
                            </span>
                          </div>
                          <div>
                            <span>端末: </span>
                            <span className="text-neutral-800 dark:text-neutral-200 font-medium">
                              {u.parsedUserAgent?.device} ({u.parsedUserAgent?.os})
                            </span>
                          </div>
                          <div>
                            <span>滞在時間: </span>
                            <span className="text-neutral-800 dark:text-neutral-200 font-medium">
                              {u.presence?.activeDurationSec ? `${Math.floor(u.presence.activeDurationSec / 60)}分${u.presence.activeDurationSec % 60}秒` : '開始直後'}
                            </span>
                          </div>
                          <div>
                            <span>指紋ID: </span>
                            <span className="font-mono text-purple-600 dark:text-purple-400 font-bold">
                              {u.fingerprint?.compositeId || '計算中'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: Blacklist BAN Management */}
            {activeTab === 'blocked' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                      <Ban className="w-4 h-4 text-red-500" />
                      <span>アクセス拒否・BANリスト管理</span>
                    </h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      ここに登録されたIPアドレス・端末指紋・メールからのアクセスは即座に「404 Not Found」で遮断されます。
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const val = prompt('手動でブロックするIPアドレスまたは指紋IDを入力してください:');
                      if (val) {
                        blockVisitor('ip', val.trim(), '管理者による手動BAN');
                        loadUsers();
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white cursor-pointer transition-all"
                  >
                    + IP/指紋を手動ブロック
                  </button>
                </div>

                {blockedEntities.length === 0 ? (
                  <div className="p-10 text-center rounded-2xl border-2 border-dashed border-neutral-300 dark:border-neutral-800 text-xs text-neutral-500">
                    現在ブロックされているIPまたは端末はありません。アクセス一覧カードの「🚫」ボタンからワンクリックで出禁にできます。
                  </div>
                ) : (
                  <div className="space-y-2">
                    {blockedEntities.map((b) => (
                      <div
                        key={b.id}
                        className="p-3 rounded-xl bg-white dark:bg-neutral-800 border border-red-200 dark:border-red-900/60 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400 flex items-center justify-center shrink-0">
                            <Ban className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-red-600 dark:text-red-400 text-sm">
                                {b.value}
                              </span>
                              <span className="px-1.5 py-0.2 rounded text-[10px] bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300">
                                {b.type.toUpperCase()}
                              </span>
                            </div>
                            <div className="text-[11px] text-neutral-500 mt-0.5">
                              理由: {b.reason || '手動ブロック'} • 遮断日時: {new Date(b.blockedAt).toLocaleString('ja-JP')}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleUnblock(b.id)}
                          className="px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-200 font-semibold text-xs cursor-pointer"
                        >
                          ブロック解除
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: Notification Settings */}
            {activeTab === 'notify' && (
              <div className="p-4 sm:p-5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/60 space-y-5">
                <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-700 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                      <Bell className="w-4 h-4 text-amber-500" />
                      <span>潜入・アクセス検知のリアルタイム通知設定</span>
                    </h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      訪問者がサイトを開いた瞬間、または動画を再生した瞬間に、即座にメールまたはDiscordへ潜入アラートを飛ばします。
                    </p>
                  </div>
                  <button
                    onClick={handleSendTestAlert}
                    disabled={isSendingTestAlert}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Bell className={`w-3.5 h-3.5 ${isSendingTestAlert ? 'animate-bounce' : ''}`} />
                    <span>即時テスト送信</span>
                  </button>
                </div>

                {testAlertResult && (
                  <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-xs font-medium text-neutral-800 dark:text-neutral-200">
                    {testAlertResult}
                  </div>
                )}

                <div className="space-y-4 text-xs">
                  {/* Email Target Field */}
                  <div className="p-3.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                        <span>📧 宛先メールアドレス（指定先）:</span>
                      </label>
                      <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
                        自動通知有効
                      </span>
                    </div>
                    <input
                      type="email"
                      value={notifyConfig.email}
                      onChange={(e) => setNotifyConfig({ ...notifyConfig, email: e.target.value })}
                      placeholder="r1907058@fkc.ritsumei.ac.jp"
                      className="w-full px-3 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white font-mono text-xs focus:outline-none focus:border-red-500"
                    />
                    <p className="text-[11px] text-neutral-500">
                      新規アクセスやGoogleログイン時に、このメールアドレス宛にIP、位置情報、OS・端末、フィンガープリント情報が送信されます。
                    </p>
                  </div>

                  {/* Discord Webhook Field */}
                  <div className="p-3.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                        <span>💬 Discord Webhook URL（スマホ即時プッシュ通知用）:</span>
                      </label>
                      <label className="flex items-center gap-1 text-[11px] text-neutral-600 dark:text-neutral-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notifyConfig.discordEnabled}
                          onChange={(e) => setNotifyConfig({ ...notifyConfig, discordEnabled: e.target.checked })}
                          className="rounded text-blue-600"
                        />
                        <span>Discord通知を有効化</span>
                      </label>
                    </div>
                    <input
                      type="url"
                      value={notifyConfig.discordWebhookUrl || ''}
                      onChange={(e) => setNotifyConfig({ ...notifyConfig, discordWebhookUrl: e.target.value })}
                      placeholder="https://discord.com/api/webhooks/..."
                      className="w-full px-3 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white font-mono text-xs focus:outline-none focus:border-red-500"
                    />
                    <p className="text-[11px] text-neutral-500">
                      Discordサーバーのチャンネル「連携」→「ウェブフック」のURLを貼ると、スマホのDiscordにリッチカードで即座に来訪アラートが届きます。
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveNotifySettings}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer transition-all flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{copiedKey === 'saved_notify' ? '設定を保存しました！' : '通知設定を保存'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 6: Diagnostic Tool */}
            {activeTab === 'diagnostic' && (
              <div className="p-4 sm:p-5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/60 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                      <Wifi className="w-4 h-4 text-emerald-500" />
                      <span>リアルタイム接続・ネットワーク & 端末環境診断</span>
                    </h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      現在この端末のパブリックIP、プロバイダ情報、位置情報、GPU、CPU、バッテリー状況をリアルタイム計測します。
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
                  <div className="p-10 text-center flex flex-col items-center justify-center">
                    <RefreshCw className="w-7 h-7 animate-spin text-blue-500 mb-2" />
                    <span className="text-xs text-neutral-500 font-medium">
                      ネットワーク・位置・ハードウェア情報を計測中...
                    </span>
                  </div>
                ) : liveGeo ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="p-4 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 space-y-3">
                      <h4 className="font-bold text-sm text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
                        <span>{liveGeo.flagEmoji || '🌐'}</span>
                        <span>IP & 接続プロバイダ情報</span>
                      </h4>
                      <div className="grid grid-cols-3 gap-2">
                        <span className="text-neutral-500">パブリックIP:</span>
                        <span className="col-span-2 font-mono font-bold text-neutral-900 dark:text-white flex items-center gap-1">
                          {liveGeo.ip}
                          <button
                            type="button"
                            onClick={() => copyToClipboard(liveGeo.ip, 'live_ip')}
                            className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 p-0.5 cursor-pointer"
                          >
                            {copiedKey === 'live_ip' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </span>

                        <span className="text-neutral-500">ISP / 回線:</span>
                        <span className="col-span-2 font-semibold text-neutral-800 dark:text-neutral-200">
                          {liveGeo.isp || '未取得'}
                        </span>

                        <span className="text-neutral-500">組織 (Org):</span>
                        <span className="col-span-2 text-neutral-700 dark:text-neutral-300">
                          {liveGeo.org || '未取得'}
                        </span>

                        <span className="text-neutral-500">ASN:</span>
                        <span className="col-span-2 font-mono text-neutral-700 dark:text-neutral-300">
                          {liveGeo.asn ? `AS${liveGeo.asn}` : '未取得'}
                        </span>

                        <span className="text-neutral-500">国 / 地域:</span>
                        <span className="col-span-2 text-neutral-800 dark:text-neutral-200">
                          {liveGeo.country} ({liveGeo.countryCode}) / {liveGeo.region}
                        </span>

                        <span className="text-neutral-500">市区町村:</span>
                        <span className="col-span-2 font-bold text-neutral-900 dark:text-white">
                          {liveGeo.city} {liveGeo.postal ? `(〒${liveGeo.postal})` : ''}
                        </span>

                        <span className="text-neutral-500">緯度・経度:</span>
                        <span className="col-span-2 font-mono text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                          {liveGeo.latitude && liveGeo.longitude ? (
                            <>
                              <span>{liveGeo.latitude.toFixed(4)}, {liveGeo.longitude.toFixed(4)}</span>
                              <a
                                href={`https://www.google.com/maps?q=${liveGeo.latitude},${liveGeo.longitude}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-500 hover:underline inline-flex items-center gap-0.5 ml-1"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </>
                          ) : '未取得'}
                        </span>

                        <span className="text-neutral-500">タイムゾーン:</span>
                        <span className="col-span-2 text-neutral-700 dark:text-neutral-300">
                          {liveGeo.timezone || 'Asia/Tokyo'} {liveGeo.timezoneUtc || ''}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 space-y-3">
                      <h4 className="font-bold text-sm text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                        <Cpu className="w-4 h-4 text-purple-500" />
                        <span>端末ハードウェア & ブラウザ環境</span>
                      </h4>
                      <div className="grid grid-cols-3 gap-2">
                        <span className="text-neutral-500">GPU レンダラー:</span>
                        <span className="col-span-2 font-semibold text-neutral-900 dark:text-white break-words">
                          {liveHardware?.gpuRenderer || '未取得'}
                        </span>

                        <span className="text-neutral-500">CPU コア数:</span>
                        <span className="col-span-2 font-mono text-neutral-800 dark:text-neutral-200">
                          {liveHardware?.cpuCores ? `${liveHardware.cpuCores} 論理コア` : '未取得'}
                        </span>

                        <span className="text-neutral-500">RAM 容量:</span>
                        <span className="col-span-2 font-mono text-neutral-800 dark:text-neutral-200">
                          {liveHardware?.deviceMemory || '未取得'}
                        </span>

                        <span className="text-neutral-500">画面解像度:</span>
                        <span className="col-span-2 font-mono text-neutral-800 dark:text-neutral-200">
                          {liveHardware?.screenResolution} (Retina: {liveHardware?.pixelRatio})
                        </span>

                        <span className="text-neutral-500">タッチ点数:</span>
                        <span className="col-span-2 text-neutral-800 dark:text-neutral-200">
                          {liveHardware?.touchPoints ? `最大 ${liveHardware.touchPoints} 点タッチ` : 'マウス操作'}
                        </span>

                        <span className="text-neutral-500">回線 / 下り速度:</span>
                        <span className="col-span-2 text-neutral-800 dark:text-neutral-200 font-mono">
                          {liveNetwork?.effectiveType || 'WiFi/LAN'} {liveNetwork?.downlink ? `(${liveNetwork.downlink})` : ''}
                        </span>

                        <span className="text-neutral-500">バッテリー状況:</span>
                        <span className="col-span-2 font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1">
                          {liveBattery?.charging ? <BatteryCharging className="w-3.5 h-3.5 text-emerald-500" /> : <Battery className="w-3.5 h-3.5 text-neutral-400" />}
                          <span>{liveBattery?.level || '取得不可 (デスクトップ等)'}</span>
                          {liveBattery?.charging && <span className="text-[10px] text-emerald-600 font-bold">(充電中)</span>}
                        </span>

                        <span className="text-neutral-500">システム言語:</span>
                        <span className="col-span-2 text-neutral-800 dark:text-neutral-200 truncate">
                          {liveHardware?.languages || 'ja-JP'}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-neutral-500">
                    「即時再検査」ボタンを押して診断を実行してください。
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
