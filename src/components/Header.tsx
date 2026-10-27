import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Menu,
  Search,
  SlidersHorizontal,
  Play,
  Flame,
  LayoutGrid,
  Bookmark,
  Mic,
  X,
  Globe,
  ShieldCheck,
  Shield,
  Zap,
  GraduationCap,
  LogOut,
  Users,
  Keyboard,
  Film,
  Music,
  Waves,
  AlertTriangle,
  Pin,
  Clock,
  Rss,
  Plus,
  Trash2,
  Tv,
  User,
  CheckCircle,
  Sun,
  Moon,
  Laptop
} from 'lucide-react';
import { SearchFilters, PlaybackMode, ApiSettings } from '../types';
import { customFetch } from '../utils/apiClient';
import { ServerStatusBadge } from './ServerStatusBadge';
import { ProxyGuideModal } from './ProxyGuideModal';
import { SidebarDrawer } from './SidebarDrawer';
import { GoogleLoginModal } from './GoogleLoginModal';
import { GoogleUser, getCurrentGoogleUser, signOutGoogleUser } from '../utils/googleAuth';
import { getThemePreference, setThemePreference, ThemeMode } from '../utils/themeManager';
import {
  getSearchHistory,
  addSearchHistory,
  removeSearchHistoryItem,
  clearSearchHistory,
  getPinnedSearchTags,
  togglePinnedSearchTag
} from '../utils/userDataManager';

interface HeaderProps {
  filters: SearchFilters;
  onUpdateFilters: (newFilters: Partial<SearchFilters>) => void;
  onSearchSubmit: (q: string) => void;
  onOpenFilterModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenShortcutsModal?: () => void;
  activeTab: string;
  onChangeTab: (tab: string) => void;
  playbackMode: PlaybackMode;
  onTogglePlaybackMode: (mode: PlaybackMode) => void;
  savedCount: number;
  apiSettings: ApiSettings;
  onLockDisguise?: () => void;
  currentUser?: GoogleUser | null;
  onUserChange?: (user: GoogleUser | null) => void;
  onOpen613TubeModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  filters,
  onUpdateFilters,
  onSearchSubmit,
  onOpenFilterModal,
  onOpenSettingsModal,
  onOpenShortcutsModal,
  activeTab,
  onChangeTab,
  playbackMode,
  onTogglePlaybackMode,
  savedCount,
  apiSettings,
  currentUser: propUser,
  onUserChange: propOnUserChange,
  onOpen613TubeModal
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [internalUser, setInternalUser] = useState<GoogleUser | null>(() => getCurrentGoogleUser());
  const currentUser = propUser !== undefined ? propUser : internalUser;

  const handleUserChange = (u: GoogleUser | null) => {
    setInternalUser(u);
    if (propOnUserChange) propOnUserChange(u);
  };

  const [queryInput, setQueryInput] = useState(filters.query);
  const [isListening, setIsListening] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [isSuggestOpen, setIsSuggestOpen] = useState(false);
  const [isProxyModalOpen, setIsProxyModalOpen] = useState(false);
  const [hasConnectionBlock, setHasConnectionBlock] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<ThemeMode>(() => getThemePreference());
  const [searchHistory, setSearchHistory] = useState<string[]>(() => getSearchHistory());
  const [pinnedTags, setPinnedTags] = useState<string[]>(() => getPinnedSearchTags());
  const suggestRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Sync auth events
  useEffect(() => {
    const handleAuthChange = (e: any) => {
      setInternalUser(e.detail || null);
    };
    const handleOpenLogin = () => {
      setIsLoginModalOpen(true);
    };
    window.addEventListener('zero_google_auth_changed', handleAuthChange);
    window.addEventListener('zero_open_google_login', handleOpenLogin);
    return () => {
      window.removeEventListener('zero_google_auth_changed', handleAuthChange);
      window.removeEventListener('zero_open_google_login', handleOpenLogin);
    };
  }, []);

  // Sync search history and pinned tags
  useEffect(() => {
    const syncTags = () => {
      setSearchHistory(getSearchHistory());
      setPinnedTags(getPinnedSearchTags());
    };
    window.addEventListener('kaito_search_tags_changed', syncTags);
    return () => window.removeEventListener('kaito_search_tags_changed', syncTags);
  }, []);

  // Sync theme changes
  useEffect(() => {
    const handleThemeChange = (e: any) => {
      setCurrentTheme(e.detail?.mode || getThemePreference());
    };
    const handleOpenProxy = () => setIsProxyModalOpen(true);

    window.addEventListener('kaito_theme_changed', handleThemeChange);
    window.addEventListener('kaito_open_proxy_guide', handleOpenProxy);

    return () => {
      window.removeEventListener('kaito_theme_changed', handleThemeChange);
      window.removeEventListener('kaito_open_proxy_guide', handleOpenProxy);
    };
  }, []);

  // Handle outside click to close user dropdown & suggestions
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestRef.current && !suggestRef.current.contains(e.target as Node)) {
        setIsSuggestOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync external filters.query
  useEffect(() => {
    setQueryInput(filters.query);
  }, [filters.query]);

  // Fetch suggestions on debounce
  useEffect(() => {
    const trimmed = queryInput.trim();
    if (!trimmed || !isSuggestOpen) {
      setSuggestions([]);
      setSelectedIndex(-1);
      return;
    }

    const timer = setTimeout(() => {
      customFetch(`/api/youtube/suggest?q=${encodeURIComponent(trimmed)}`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setSuggestions(data.slice(0, 8));
          } else if (data && Array.isArray(data.suggestions)) {
            setSuggestions(data.suggestions.slice(0, 8));
          } else if (data && Array.isArray(data[1])) {
            setSuggestions(data[1].slice(0, 8));
          }
        })
        .catch(() => {});
    }, 200);

    return () => clearTimeout(timer);
  }, [queryInput, isSuggestOpen]);

  // Unified suggestions list combining past search_history and live API suggestions
  const unifiedSuggestions = useMemo(() => {
    const trimmed = queryInput.trim().toLowerCase();
    const matchedHistory = trimmed
      ? searchHistory.filter((h) => h.toLowerCase().includes(trimmed)).slice(0, 6)
      : searchHistory.slice(0, 8);

    const seen = new Set<string>();
    const combined: { text: string; isHistory: boolean }[] = [];

    for (const h of matchedHistory) {
      const key = h.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        combined.push({ text: h, isHistory: true });
      }
    }

    for (const s of suggestions) {
      const key = String(s || '').trim().toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        const alsoInHistory = searchHistory.some((h) => h.toLowerCase() === key);
        combined.push({ text: s, isHistory: alsoInHistory });
      }
    }

    return combined.slice(0, 10);
  }, [queryInput, searchHistory, suggestions]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      // If user is actively typing with Japanese IME, let composition finish
      if ((e.nativeEvent as any).isComposing) {
        return;
      }
      e.preventDefault();
      const term =
        selectedIndex >= 0 && unifiedSuggestions[selectedIndex]
          ? unifiedSuggestions[selectedIndex].text
          : queryInput.trim();
      if (term) {
        setQueryInput(term);
        setIsSuggestOpen(false);
        addSearchHistory(term);
        onSearchSubmit(term);
      }
      return;
    }

    if (!isSuggestOpen || unifiedSuggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < unifiedSuggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : unifiedSuggestions.length - 1));
    } else if (e.key === 'Escape') {
      setIsSuggestOpen(false);
      setSelectedIndex(-1);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const term =
      selectedIndex >= 0 && unifiedSuggestions[selectedIndex]
        ? unifiedSuggestions[selectedIndex].text
        : queryInput.trim();
    if (!term) return;
    setIsSuggestOpen(false);
    addSearchHistory(term);
    onSearchSubmit(term);
  };

  const handleClear = () => {
    setQueryInput('');
    setSuggestions([]);
    setIsSuggestOpen(false);
    onUpdateFilters({ query: '' });
  };

  const handleSelectSuggestion = (text: string) => {
    setQueryInput(text);
    setIsSuggestOpen(false);
    addSearchHistory(text);
    onSearchSubmit(text);
  };

  const handleVoiceSearch = () => {
    setIsListening(true);
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      try {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = 'ja-JP';
        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setQueryInput(transcript);
          onSearchSubmit(transcript);
          setIsListening(false);
        };
        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);
        recognition.start();
        return;
      } catch (e) {
        console.error(e);
      }
    }

    setTimeout(() => {
      const sampleQueries = ['ゲーム 実況', 'プログラミング 初心者', 'エンタメ 面白い動画', 'Lofi 勉強BGM'];
      const randomQuery = sampleQueries[Math.floor(Math.random() * sampleQueries.length)];
      setQueryInput(randomQuery);
      onSearchSubmit(randomQuery);
      setIsListening(false);
    }, 1200);
  };

  const handleCategoryClick = (categoryName: string) => {
    if (categoryName === 'すべて') {
      onUpdateFilters({ query: '' });
      onChangeTab('home');
    } else if (categoryName === '急上昇') {
      onChangeTab('trending');
    } else {
      setQueryInput(categoryName);
      onSearchSubmit(categoryName);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white shadow-xs transition-colors">
      {/* Network Connection Alert Banner */}
      {hasConnectionBlock && (
        <div className="bg-rose-600 text-white px-4 py-1.5 text-xs flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0 animate-bounce" />
            <span>ネットワーク通信またはYouTube APIへの接続が遮断されています。プロキシ設定をご確認ください。</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsProxyModalOpen(true)}
              className="px-2 py-0.5 bg-white text-rose-700 font-bold rounded text-[11px] hover:bg-neutral-100 transition-colors cursor-pointer"
            >
              プロキシ設定
            </button>
            <button
              onClick={() => setHasConnectionBlock(false)}
              className="p-1 hover:bg-rose-700 rounded text-rose-200 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Primary Top Header: [☰] [🎨 ZERO-tube] 🔍 [___________] [ログイン] */}
      <div className="max-w-[1700px] w-full mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2 sm:gap-6">
        {/* Left: Hamburger Button + ZERO-tube Logo */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            title="メニューを開く"
            className="p-2 rounded-xl text-neutral-800 dark:text-neutral-200 bg-neutral-100 hover:bg-neutral-200 border-2 border-neutral-300 dark:border-neutral-700 transition-colors cursor-pointer shadow-xs"
            id="hamburger-menu-btn"
          >
            <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          <button
            onClick={() => {
              onUpdateFilters({ query: '' });
              onChangeTab('home');
            }}
            className="flex items-center gap-2 group text-left focus:outline-none cursor-pointer"
            id="brand-logo-btn"
          >
            {/* Colorful Windmill/Pinwheel Icon matching user drawing */}
            <div className="relative w-8 h-8 rounded-lg bg-gradient-to-tr from-rose-500 via-amber-400 to-emerald-400 p-0.5 shadow-sm group-hover:scale-105 transition-transform flex items-center justify-center">
              <div className="w-full h-full bg-white dark:bg-neutral-900 rounded-[6px] flex items-center justify-center overflow-hidden">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                  {/* Pinwheel petals */}
                  <path d="M12 12V3C14.5 3 17 5 17 8C17 11 14.5 12 12 12Z" fill="#EF4444" />
                  <path d="M12 12H21C21 14.5 19 17 16 17C13 17 12 14.5 12 12Z" fill="#F59E0B" />
                  <path d="M12 12V21C9.5 21 7 19 7 16C7 13 9.5 12 12 12Z" fill="#10B981" />
                  <path d="M12 12H3C3 9.5 5 7 8 7C11 7 12 9.5 12 12Z" fill="#3B82F6" />
                  <circle cx="12" cy="12" r="2.5" fill="#FFFFFF" />
                </svg>
              </div>
            </div>

            <div className="flex items-center">
              <span className="font-black text-lg sm:text-xl tracking-tight text-neutral-900 dark:text-white">
                zero<span className="text-rose-500">-tube</span>
              </span>
            </div>
          </button>
        </div>

        {/* Center: Search Bar with 🔍 and Clean Border matching mock */}
        <div ref={suggestRef} className="flex-1 max-w-3xl lg:max-w-4xl mx-1 sm:mx-4 relative">
          <form onSubmit={handleFormSubmit}>
            <div className="relative flex items-center bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-300 dark:border-neutral-700 rounded-lg sm:rounded-xl focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all overflow-hidden">
              {/* Left Search Icon - Clickable to search */}
              <button
                type="submit"
                title="検索"
                aria-label="検索を実行"
                className="pl-3.5 pr-2.5 text-neutral-500 hover:text-red-600 dark:text-neutral-400 dark:hover:text-red-400 flex items-center justify-center cursor-pointer transition-colors shrink-0"
              >
                <Search className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <input
                type="text"
                value={queryInput}
                onChange={(e) => {
                  setQueryInput(e.target.value);
                  setIsSuggestOpen(true);
                }}
                onFocus={() => setIsSuggestOpen(true)}
                onKeyDown={handleKeyDown}
                placeholder={
                  filters.source === '613tube'
                    ? 'セーフモードで検索 または URLを入力...'
                    : 'YouTube を検索 または URLを入力...'
                }
                className="w-full py-2 sm:py-2.5 bg-transparent text-xs sm:text-base text-neutral-900 dark:text-white placeholder-neutral-500 focus:outline-none"
                id="search-input"
                autoComplete="off"
              />
              {queryInput && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="p-1.5 sm:p-2 text-neutral-400 hover:text-neutral-700 dark:hover:text-white shrink-0 cursor-pointer"
                  title="入力をクリア"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              {/* Safe Video Fetch Toggle / Modal Button */}
              <button
                type="button"
                onClick={() => {
                  if (onOpen613TubeModal) {
                    onOpen613TubeModal();
                  } else {
                    const nextSource = filters.source === '613tube' ? 'youtube' : '613tube';
                    onUpdateFilters({ source: nextSource });
                  }
                }}
                title="セーフ動画取得（安全な動画のみを取得）"
                className={`px-2 sm:px-2.5 py-1 sm:py-1.5 mx-0.5 rounded-lg flex items-center gap-1 text-[11px] font-bold border transition-all shrink-0 cursor-pointer ${
                  filters.source === '613tube'
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                    : 'bg-neutral-200/80 dark:bg-neutral-700/80 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-600 hover:border-emerald-500 hover:text-emerald-500'
                }`}
              >
                <ShieldCheck className={`w-3.5 h-3.5 ${filters.source === '613tube' ? 'text-white' : 'text-emerald-500'}`} />
                <span className="hidden sm:inline">セーフ取得</span>
                <span className="text-[10px] sm:hidden">セーフ</span>
              </button>

              {/* Voice Search Button */}
              <button
                type="button"
                onClick={handleVoiceSearch}
                title="音声検索"
                className={`p-2 sm:p-2.5 text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white transition-colors shrink-0 cursor-pointer ${
                  isListening ? 'text-rose-500 animate-pulse' : ''
                }`}
              >
                <Mic className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </button>

              {/* Search Filters */}
              <button
                type="button"
                onClick={onOpenFilterModal}
                title="検索フィルター"
                className="p-2 sm:p-2.5 text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white border-l border-neutral-200 dark:border-neutral-700 transition-colors relative shrink-0 cursor-pointer"
              >
                <SlidersHorizontal className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                {(filters.order !== 'relevance' || filters.type !== 'all' || filters.videoDuration !== 'any' || filters.categoryId) && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full" />
                )}
              </button>

              {/* Red Search Submit Button - Always visible on all screen sizes */}
              <button
                type="submit"
                id="search-submit-btn"
                title="検索を実行"
                className="flex items-center gap-1.5 px-3.5 sm:px-6 py-2 sm:py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm border-l border-red-700 transition-all shrink-0 cursor-pointer shadow-xs active:scale-95"
              >
                <Search className="w-3.5 h-3.5 sm:hidden" />
                <span>検索</span>
              </button>
            </div>
          </form>

          {/* Autocomplete & History Dropdown */}
          {isSuggestOpen && unifiedSuggestions.length > 0 && (
            <div
              className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl overflow-hidden z-50 animate-fade-in"
              id="search-suggest-dropdown"
            >
              <div className="max-h-80 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800">
                {unifiedSuggestions.map((entry, idx) => (
                  <div
                    key={`${entry.isHistory ? 'hist' : 'sug'}-${entry.text}-${idx}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectSuggestion(entry.text);
                    }}
                    onClick={() => handleSelectSuggestion(entry.text)}
                    className={`px-4 py-2.5 flex items-center justify-between gap-3 text-xs sm:text-sm cursor-pointer transition-colors ${
                      idx === selectedIndex
                        ? 'bg-blue-50 dark:bg-neutral-800 text-blue-600 dark:text-blue-400 font-semibold'
                        : 'text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {entry.isHistory ? (
                        <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      ) : (
                        <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                      )}
                      <span className="truncate">{entry.text}</span>
                      {entry.isHistory && (
                        <span className="px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-semibold shrink-0">
                          履歴
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Quick Playback Mode + Google ログイン Button */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Safe Video Fetch Action Button */}
          {onOpen613TubeModal && (
            <button
              type="button"
              onClick={onOpen613TubeModal}
              title="安全な動画を取得（URL / キーワード）"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 hover:border-emerald-500 transition-all cursor-pointer shadow-xs shrink-0"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span className="hidden sm:inline">動画取得</span>
              <span className="sm:hidden">取得</span>
            </button>
          )}

          {/* Quick Playback Mode selector badge (Edu / 1080p / Stream) */}
          <div className="hidden lg:flex items-center bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => onTogglePlaybackMode('education')}
              className={`px-2 py-1 rounded font-bold transition-all flex items-center gap-1 cursor-pointer ${
                playbackMode === 'education'
                  ? 'bg-white dark:bg-neutral-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
              title="YouTube Player for Education（広告なし・制限回避）"
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Edu</span>
            </button>
            <button
              onClick={() => onTogglePlaybackMode('stream-sync')}
              className={`px-2 py-1 rounded font-bold transition-all flex items-center gap-1 cursor-pointer ${
                playbackMode === 'stream-sync'
                  ? 'bg-white dark:bg-neutral-900 text-purple-600 dark:text-purple-400 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
              title="1080p 高画質ストリーム（映像+音声同期）"
            >
              <Waves className="w-3.5 h-3.5" />
              <span>1080p</span>
            </button>
            <button
              onClick={() => onTogglePlaybackMode('stream-360')}
              className={`px-2 py-1 rounded font-bold transition-all flex items-center gap-1 cursor-pointer ${
                playbackMode === 'stream-360'
                  ? 'bg-white dark:bg-neutral-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
              title="軽量ストリーム (360p)"
            >
              <Film className="w-3.5 h-3.5" />
              <span>ストリーム</span>
            </button>
          </div>

          {/* Google Login Button or User Avatar Profile Menu */}
          {currentUser ? (
            <div ref={userMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 p-1 pl-1.5 sm:pr-2.5 rounded-full border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                id="user-profile-btn"
              >
                <img
                  src={currentUser.picture}
                  alt={currentUser.name}
                  className="w-7 h-7 rounded-full border border-blue-500 object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(currentUser.email)}`;
                  }}
                />
                <span className="hidden sm:inline font-bold text-xs max-w-[100px] truncate text-neutral-800 dark:text-neutral-200">
                  {currentUser.name}
                </span>
              </button>

              {/* User Dropdown Menu */}
              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl p-2 z-50 animate-scale-up text-neutral-900 dark:text-white">
                  <div className="p-3 border-b border-neutral-100 dark:border-neutral-800 flex items-center gap-3">
                    <img
                      src={currentUser.picture}
                      alt={currentUser.name}
                      className="w-10 h-10 rounded-full border border-blue-500/40 object-cover"
                    />
                    <div className="min-w-0">
                      <div className="font-bold text-xs truncate">{currentUser.name}</div>
                      <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                        {currentUser.email}
                      </div>
                      <span className="inline-flex items-center gap-1 mt-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle className="w-3 h-3" />
                        <span>Google 連携中</span>
                      </span>
                    </div>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        onChangeTab('library');
                        setUserDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                      <Bookmark className="w-4 h-4 text-sky-500" />
                      <span>保存した動画 (ライブラリ)</span>
                    </button>
                    <button
                      onClick={() => {
                        onChangeTab('channels');
                        setUserDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                      <Users className="w-4 h-4 text-indigo-500" />
                      <span>登録チャンネル一覧</span>
                    </button>
                    <button
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('zero_open_admin_modal'));
                        setUserDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-neutral-700 dark:text-neutral-300"
                    >
                      <Shield className="w-4 h-4 text-red-500" />
                      <span>管理者ログイン</span>
                    </button>
                  </div>

                  <div className="pt-1 border-t border-neutral-100 dark:border-neutral-800">
                    <button
                      onClick={() => {
                        signOutGoogleUser();
                        handleUserChange(null);
                        setUserDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>ログアウト</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* High-visibility "ログイン" Button for white theme */
            <button
              type="button"
              onClick={() => setIsLoginModalOpen(true)}
              className="px-4 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white border border-blue-500 text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
              id="google-login-btn"
            >
              <User className="w-3.5 h-3.5 text-white" />
              <span>ログイン</span>
            </button>
          )}
        </div>
      </div>

      {/* Category Pills Bar directly below header with high-contrast pills */}
      <div className="border-t border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xs px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto scrollbar-none text-xs">
          {/* Featured Color Badges matching user diagram */}
          <button
            type="button"
            onClick={() => handleCategoryClick('ゲーム')}
            className="px-3.5 py-1 rounded-full font-bold text-white bg-red-600 hover:bg-red-700 shadow-xs transition-transform active:scale-95 shrink-0 cursor-pointer"
          >
            ゲーム
          </button>

          <button
            type="button"
            onClick={() => handleCategoryClick('エンタメ')}
            className="px-3.5 py-1 rounded-full font-bold text-white bg-amber-500 hover:bg-amber-600 shadow-xs transition-transform active:scale-95 shrink-0 cursor-pointer"
          >
            エンタメ
          </button>

          <button
            type="button"
            onClick={() => handleCategoryClick('プログラミング')}
            className="px-3.5 py-1 rounded-full font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs transition-transform active:scale-95 shrink-0 cursor-pointer"
          >
            プログラミング
          </button>

          <div className="h-4 w-px bg-neutral-300 dark:bg-neutral-700 mx-1 shrink-0" />

          {/* Popular tabs */}
          <button
            type="button"
            onClick={() => handleCategoryClick('すべて')}
            className={`px-3.5 py-1.5 rounded-full font-bold transition-all shrink-0 cursor-pointer shadow-xs ${
              activeTab === 'home' && !filters.query
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-md ring-2 ring-neutral-900/20'
                : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border-2 border-neutral-300 dark:border-neutral-700 hover:border-neutral-400'
            }`}
          >
            すべて
          </button>

          <button
            type="button"
            onClick={() => handleCategoryClick('急上昇')}
            className={`px-3.5 py-1.5 rounded-full font-bold transition-all shrink-0 cursor-pointer shadow-xs ${
              activeTab === 'trending'
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-md ring-2 ring-neutral-900/20'
                : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border-2 border-neutral-300 dark:border-neutral-700 hover:border-neutral-400'
            }`}
          >
            急上昇
          </button>

          <button
            type="button"
            onClick={() => handleCategoryClick('音楽')}
            className="px-3.5 py-1.5 rounded-full font-bold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border-2 border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 transition-all shrink-0 cursor-pointer shadow-xs"
          >
            音楽
          </button>

          <button
            type="button"
            onClick={() => handleCategoryClick('アニメ')}
            className="px-3.5 py-1.5 rounded-full font-bold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border-2 border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 transition-all shrink-0 cursor-pointer shadow-xs"
          >
            アニメ
          </button>

          <button
            type="button"
            onClick={() => handleCategoryClick('学習・教育')}
            className="px-3.5 py-1.5 rounded-full font-bold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border-2 border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 transition-all shrink-0 cursor-pointer shadow-xs"
          >
            学習・教育
          </button>

          <button
            type="button"
            onClick={() => onChangeTab('shorts')}
            className={`px-3.5 py-1.5 rounded-full font-bold transition-all shrink-0 cursor-pointer shadow-xs ${
              activeTab === 'shorts'
                ? 'bg-rose-600 text-white border-2 border-rose-500 shadow-md'
                : 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-2 border-rose-300 dark:border-rose-800'
            }`}
          >
            ショート動画
          </button>
        </div>
      </div>

      {/* Hamburger Sidebar Drawer */}
      <SidebarDrawer
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        activeTab={activeTab}
        onChangeTab={onChangeTab}
        playbackMode={playbackMode}
        onTogglePlaybackMode={onTogglePlaybackMode}
        savedCount={savedCount}
        onOpenSettingsModal={onOpenSettingsModal}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
        onOpen613TubeModal={onOpen613TubeModal}
        currentUser={currentUser}
        onSignOut={() => {
          signOutGoogleUser();
          handleUserChange(null);
        }}
      />

      {/* Google Login Modal */}
      <GoogleLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        currentUser={currentUser}
        onUserChange={handleUserChange}
      />

      {/* Proxy Guide Modal */}
      <ProxyGuideModal
        isOpen={isProxyModalOpen}
        onClose={() => setIsProxyModalOpen(false)}
      />
    </header>
  );
};
