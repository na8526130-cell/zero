import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { VideoCard } from './components/VideoCard';
import { VideoDetailView } from './components/VideoDetailView';
import { FilterModal } from './components/FilterModal';
import { ChannelModal } from './components/ChannelModal';
import { CategoryView } from './components/CategoryView';
import { LibraryView } from './components/LibraryView';
import { ShortsView } from './components/ShortsView';
import { ChannelsView } from './components/ChannelsView';
import { SettingsModal } from './components/SettingsModal';
import { ShortcutsHelpModal } from './components/ShortcutsHelpModal';
import { Tube613Modal } from './components/Tube613Modal';
import { MinecraftVisitorCounter } from './components/MinecraftVisitorCounter';
import { MiniFloatingPlayer } from './components/MiniFloatingPlayer';
import { GoogleUser, getCurrentGoogleUser } from './utils/googleAuth';
import {
  YouTubeVideoItem,
  YouTubeCategoryItem,
  SearchFilters,
  PlaybackMode,
  UserCustomPlaylist,
  ApiSettings
} from './types';
import { isShortVideo, parseYouTubeUrl, parse613TubeUrl } from './utils/formatters';
import { isChannelBlocked, getSubscribedChannels } from './utils/channelStorage';
import { getApiSettings, saveApiSettings, customFetch } from './utils/apiClient';
import { prefetchStreamSources, fetchStreamSourcesCoalesced } from './utils/streamManager';
import { initThemeListener } from './utils/themeManager';
import {
  addSearchHistory,
  getVideoUniqueId,
  syncPlaylistWithServer,
  fetchSharedPlaylistByIdOrInput,
  clonePlaylistToCustomPlaylists,
  showGlobalToast
} from './utils/userDataManager';
import { loadDefaultPlaybackMode, saveDefaultPlaybackMode } from './utils/streamTypeCookie';
import {
  saveVideoToHistoryIDB,
  loadAllHistoryFromIDB,
  removeHistoryItemFromIDB,
  clearAllHistoryFromIDB,
  savePlaylistsToIDB,
  loadPlaylistsFromIDB
} from './utils/indexedDbStorage';
import { Flame, Play, ShieldCheck, AlertCircle, Zap, Settings, Users, ChevronDown, RefreshCw, Check, Sparkles, LogIn } from 'lucide-react';

export default function App() {
  // Google Account state
  const [currentUser, setCurrentUser] = useState<GoogleUser | null>(() => getCurrentGoogleUser());

  // Listen for Google Auth changes across components
  useEffect(() => {
    const handleAuthChange = (e: any) => {
      setCurrentUser(e.detail || null);
    };
    window.addEventListener('zero_google_auth_changed', handleAuthChange);
    return () => window.removeEventListener('zero_google_auth_changed', handleAuthChange);
  }, []);

  // Listen for YouTube History sync events from Google Login or manual sync
  useEffect(() => {
    const handleHistorySynced = (e: any) => {
      const items = e.detail;
      if (Array.isArray(items) && items.length > 0) {
        setWatchHistory((prev) => {
          const map = new Map<string, YouTubeVideoItem>();
          for (const item of [...items, ...prev]) {
            const id = getVideoUniqueId(item);
            if (id && !map.has(id)) {
              map.set(id, item);
            }
          }
          return Array.from(map.values());
        });
      }
    };
    window.addEventListener('zero_youtube_history_synced', handleHistorySynced);
    return () => window.removeEventListener('zero_youtube_history_synced', handleHistorySynced);
  }, []);

  // Listen for 613Tube toggle events from SidebarDrawer or quick actions
  useEffect(() => {
    const handleToggle613 = () => {
      setFilters((prev) => {
        const nextSource = prev.source === '613tube' ? 'youtube' : '613tube';
        showGlobalToast(
          nextSource === '613tube'
            ? 'セーフモードを有効にしました'
            : '通常検索に戻しました'
        );
        return { ...prev, source: nextSource };
      });
      setActiveTab('home');
      setIsDetailOpen(false);
      setSearchNonce((n) => n + 1);
    };
    window.addEventListener('zero_toggle_613tube', handleToggle613);
    const handleOpen613 = () => setIs613TubeModalOpen(true);
    window.addEventListener('zero_open_613tube_modal', handleOpen613);
    return () => {
      window.removeEventListener('zero_toggle_613tube', handleToggle613);
      window.removeEventListener('zero_open_613tube_modal', handleOpen613);
    };
  }, []);

  // Auto-sync real YouTube watch history from backend when currentUser is logged in
  useEffect(() => {
    if (!currentUser?.email) return;

    const email = currentUser.email.trim();
    const token = currentUser.accessToken || '';

    fetch(`/api/youtube/history?userEmail=${encodeURIComponent(email)}${token ? '&accessToken=' + encodeURIComponent(token) : ''}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.items) && data.items.length > 0) {
          setWatchHistory((prev) => {
            const map = new Map<string, YouTubeVideoItem>();
            for (const item of [...data.items, ...prev]) {
              const id = getVideoUniqueId(item);
              if (id && !map.has(id)) {
                map.set(id, item);
              }
            }
            const merged = Array.from(map.values());
            data.items.slice(0, 50).forEach((item: any) => {
              saveVideoToHistoryIDB(item).catch(() => {});
            });
            return merged;
          });
        }
      })
      .catch((err) => {
        console.warn('Auto-sync YouTube history error:', err);
      });
  }, [currentUser]);

  // Theme auto-listener (OS prefers-color-scheme & cross-tab sync)
  useEffect(() => {
    const cleanup = initThemeListener();
    return cleanup;
  }, []);

  // Set document title to ZERO-tube
  useEffect(() => {
    document.title = 'ZERO-tube';
  }, []);

  // Navigation & View States
  const [activeTab, setActiveTab] = useState<string>('home');
  const [selectedVideo, setSelectedVideo] = useState<YouTubeVideoItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [initialShortVideo, setInitialShortVideo] = useState<YouTubeVideoItem | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);

  // Default playback mode loaded from localStorage + 10-year Cookie (StreamType)
  const [playbackMode, setPlaybackModeState] = useState<PlaybackMode>(() => loadDefaultPlaybackMode());
  const setPlaybackMode = (mode: PlaybackMode) => {
    setPlaybackModeState(mode);
    saveDefaultPlaybackMode(mode);
  };
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [is613TubeModalOpen, setIs613TubeModalOpen] = useState(false);

  // API Settings State
  const [apiSettings, setApiSettings] = useState<ApiSettings>(() => getApiSettings());

  // Search Filters & Trigger Nonce
  const [searchNonce, setSearchNonce] = useState(0);
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    order: 'relevance',
    type: 'all',
    videoDuration: 'any',
    categoryId: '',
    regionCode: 'JP'
  });

  // Data States
  const [rawVideos, setRawVideos] = useState<YouTubeVideoItem[]>([]);
  const [relatedVideos, setRelatedVideos] = useState<YouTubeVideoItem[]>([]);
  const [categories, setCategories] = useState<YouTubeCategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedNextPageToken, setFeedNextPageToken] = useState<string | null>(null);
  const [loadingMoreFeed, setLoadingMoreFeed] = useState(false);

  // Blocked channels tracker
  const [blockedTick, setBlockedTick] = useState(0);
  const [globalToast, setGlobalToast] = useState<string | null>(null);

  useEffect(() => {
    let timer: any;
    const handleToast = (e: any) => {
      const msg = e.detail?.message;
      if (msg) {
        setGlobalToast(msg);
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => setGlobalToast(null), 3000);
      }
    };
    const handlePlaylistsSync = (e: any) => {
      if (e.detail) {
        setCustomPlaylists(e.detail);
      } else {
        try {
          const raw = localStorage.getItem('kaito_custom_playlists');
          if (raw) setCustomPlaylists(JSON.parse(raw));
        } catch {}
      }
    };
    const handleBackupRestored = (e: any) => {
      if (e.detail) {
        if (e.detail.savedVideos) setSavedVideos(e.detail.savedVideos);
        if (e.detail.watchHistory) setWatchHistory(e.detail.watchHistory);
        if (e.detail.customPlaylists) setCustomPlaylists(e.detail.customPlaylists);
      }
    };

    window.addEventListener('kaito_global_toast', handleToast);
    window.addEventListener('kaito_custom_playlists_changed', handlePlaylistsSync);
    window.addEventListener('kaito_backup_restored', handleBackupRestored);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('kaito_global_toast', handleToast);
      window.removeEventListener('kaito_custom_playlists_changed', handlePlaylistsSync);
      window.removeEventListener('kaito_backup_restored', handleBackupRestored);
    };
  }, []);

  // Saved / History / Playlists (LocalStorage)
  const [savedVideos, setSavedVideos] = useState<YouTubeVideoItem[]>(() => {
    try {
      const stored = localStorage.getItem('kaito_saved_videos');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [watchHistory, setWatchHistory] = useState<YouTubeVideoItem[]>(() => {
    try {
      const stored = localStorage.getItem('kaito_watch_history');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [customPlaylists, setCustomPlaylists] = useState<UserCustomPlaylist[]>(() => {
    try {
      const stored = localStorage.getItem('kaito_custom_playlists');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Hydrate unlimited Watch History (VideoHistory DB) & Custom Playlists (PlaylistsDB) with ArrayBuffer thumbnails from IndexedDB
  useEffect(() => {
    loadAllHistoryFromIDB()
      .then((idbHistory) => {
        if (idbHistory && idbHistory.length > 0) {
          setWatchHistory((prev) => {
            const mergedMap = new Map<string, YouTubeVideoItem>();
            for (const item of [...idbHistory, ...prev]) {
              const id = getVideoUniqueId(item);
              if (id && !mergedMap.has(id)) {
                mergedMap.set(id, item);
              }
            }
            return Array.from(mergedMap.values());
          });
        } else {
          // Migrate existing localStorage history items into VideoHistory IndexedDB
          try {
            const raw = localStorage.getItem('kaito_watch_history');
            const parsed: YouTubeVideoItem[] = raw ? JSON.parse(raw) : [];
            for (const item of parsed.slice(0, 50)) {
              saveVideoToHistoryIDB(item).catch(() => {});
            }
          } catch {}
        }
      })
      .catch(() => {});

    loadPlaylistsFromIDB()
      .then((idbPlaylists) => {
        if (idbPlaylists && idbPlaylists.length > 0) {
          setCustomPlaylists((prev) => {
            const plMap = new Map<string, UserCustomPlaylist>();
            for (const pl of [...idbPlaylists, ...prev]) {
              if (pl && pl.id && !plMap.has(pl.id)) {
                plMap.set(pl.id, pl);
              }
            }
            return Array.from(plMap.values());
          });
        } else {
          try {
            const raw = localStorage.getItem('kaito_custom_playlists');
            const parsed: UserCustomPlaylist[] = raw ? JSON.parse(raw) : [];
            if (parsed.length > 0) {
              savePlaylistsToIDB(parsed).catch(() => {});
            }
          } catch {}
        }
      })
      .catch(() => {});
  }, []);

  // Global keydown listener for shortcut help modal
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setIsShortcutsModalOpen((prev) => !prev);
      } else if (e.key === '6') {
        e.preventDefault();
        setIs613TubeModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Listen to block state changes
  useEffect(() => {
    const handleBlockedChange = () => setBlockedTick((t) => t + 1);
    window.addEventListener('kaito_channel_blocked_changed', handleBlockedChange);
    return () => {
      window.removeEventListener('kaito_channel_blocked_changed', handleBlockedChange);
    };
  }, []);

  // Listen to settings change events
  useEffect(() => {
    const handleSettingsChanged = (e: any) => {
      if (e.detail) {
        setApiSettings(e.detail);
      }
    };
    window.addEventListener('kaito_settings_changed', handleSettingsChanged);
    return () => {
      window.removeEventListener('kaito_settings_changed', handleSettingsChanged);
    };
  }, []);

  // Cross-Tab Synchronization via window.addEventListener("storage", ...)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (!e.key) return;

      // 1. Channel Subscriptions
      if (e.key === 'kaito_subscribed_channels') {
        window.dispatchEvent(new CustomEvent('kaito_channel_subs_changed'));
      }

      // 2. Channel Blocks
      if (e.key === 'kaito_blocked_channels') {
        setBlockedTick((t) => t + 1);
        window.dispatchEvent(new CustomEvent('kaito_channel_blocked_changed'));
      }

      // 3. Saved Videos (Library)
      if (e.key === 'kaito_saved_videos') {
        try {
          setSavedVideos(e.newValue ? JSON.parse(e.newValue) : []);
        } catch {}
      }

      // 4. Watch History
      if (e.key === 'kaito_watch_history') {
        try {
          setWatchHistory(e.newValue ? JSON.parse(e.newValue) : []);
        } catch {}
      }

      // 5. Custom Playlists
      if (e.key === 'kaito_custom_playlists') {
        try {
          setCustomPlaylists(e.newValue ? JSON.parse(e.newValue) : []);
        } catch {}
      }

      // 6. Settings / API Config
      if (e.key === 'kaito_api_settings_v1') {
        try {
          if (e.newValue) {
            const parsed = JSON.parse(e.newValue);
            setApiSettings(parsed);
          }
        } catch {}
      }

      // 7. Disguise & Stealth Settings
      if (e.key === 'kaito_disguise_preset' || e.key === 'kaito_stealth_cloak') {
        // Trigger re-evaluation of title/favicon
        window.dispatchEvent(new CustomEvent('kaito_disguise_changed'));
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Save Settings handler
  const handleSaveSettings = (newSettings: ApiSettings) => {
    setApiSettings(newSettings);
    saveApiSettings(newSettings);
  };

  // Load Categories on mount or when API settings change
  useEffect(() => {
    customFetch(`/api/youtube/categories?regionCode=${filters.regionCode}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.items) setCategories(data.items);
      })
      .catch((err) => console.error(err));
  }, [filters.regionCode, apiSettings]);

  // Fetch Main Videos depending on search query, active tab, or apiSettings
  useEffect(() => {
    if (
      activeTab === 'categories' ||
      activeTab === 'library' ||
      activeTab === 'shorts' ||
      activeTab === 'channels' ||
      activeTab === 'subscriptions-feed'
    ) {
      return;
    }

    setLoading(true);

    let apiUrl = '';
    if (filters.source === '613tube') {
      const queryParams = new URLSearchParams({
        q: filters.query.trim() || '人気 おすすめ'
      });
      apiUrl = `/api/613tube/search?${queryParams.toString()}`;
    } else if (filters.query.trim()) {
      const queryParams = new URLSearchParams({
        q: filters.query.trim(),
        order: filters.order,
        type: filters.type,
        videoDuration: filters.videoDuration,
        regionCode: filters.regionCode,
        maxResults: '48'
      });
      if (filters.categoryId) queryParams.set('videoCategoryId', filters.categoryId);
      if (filters.publishedAfter) queryParams.set('publishedAfter', filters.publishedAfter);
      apiUrl = `/api/youtube/search?${queryParams.toString()}`;
    } else {
      // Trending or Home (if logged in, fetch real personalized YouTube recommendations)
      if (currentUser && activeTab === 'home') {
        const queryParams = new URLSearchParams({
          regionCode: filters.regionCode,
          maxResults: '48',
          userId: currentUser.id || '',
          userEmail: currentUser.email || ''
        });
        if (currentUser.accessToken) queryParams.set('accessToken', currentUser.accessToken);
        if (filters.categoryId) queryParams.set('videoCategoryId', filters.categoryId);

        // Gather seed IDs from user's watch history and saved videos
        const seedSet = new Set<string>();
        for (const v of watchHistory) {
          const id = getVideoUniqueId(v);
          if (id) seedSet.add(id);
          if (seedSet.size >= 6) break;
        }
        for (const v of savedVideos) {
          const id = getVideoUniqueId(v);
          if (id) seedSet.add(id);
          if (seedSet.size >= 10) break;
        }
        const seedsList = Array.from(seedSet).filter(Boolean);
        if (seedsList.length > 0) {
          queryParams.set('seeds', seedsList.join(','));
        }

        // Subscribed channels
        const subChannels = getSubscribedChannels()
          .map((c) => c.channelId)
          .filter(Boolean)
          .slice(0, 5);
        if (subChannels.length > 0) {
          queryParams.set('channels', subChannels.join(','));
        }

        apiUrl = `/api/youtube/recommendations?${queryParams.toString()}`;
      } else {
        const queryParams = new URLSearchParams({
          regionCode: filters.regionCode,
          maxResults: '48'
        });
        if (filters.categoryId) queryParams.set('videoCategoryId', filters.categoryId);
        apiUrl = `/api/youtube/trending?${queryParams.toString()}`;
      }
    }

    customFetch(apiUrl)
      .then((res) => res.json())
      .then((data) => {
        setRawVideos(data.items || []);
        setFeedNextPageToken(data.nextPageToken || null);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [
    filters.query,
    filters.order,
    filters.type,
    filters.videoDuration,
    filters.categoryId,
    filters.regionCode,
    filters.publishedAfter,
    activeTab,
    apiSettings,
    currentUser,
    searchNonce
  ]);

  // Load more videos for search results or trending/recommendations feed
  const handleLoadMoreFeed = () => {
    if (!feedNextPageToken || loadingMoreFeed) return;
    setLoadingMoreFeed(true);

    let apiUrl = '';
    if (filters.source === '613tube') {
      const queryParams = new URLSearchParams({
        q: filters.query.trim() || '人気 おすすめ',
        pageToken: feedNextPageToken || ''
      });
      apiUrl = `/api/613tube/search?${queryParams.toString()}`;
    } else if (filters.query.trim()) {
      const queryParams = new URLSearchParams({
        q: filters.query.trim(),
        order: filters.order,
        type: filters.type,
        videoDuration: filters.videoDuration,
        regionCode: filters.regionCode,
        maxResults: '48',
        pageToken: feedNextPageToken
      });
      if (filters.categoryId) queryParams.set('videoCategoryId', filters.categoryId);
      if (filters.publishedAfter) queryParams.set('publishedAfter', filters.publishedAfter);
      apiUrl = `/api/youtube/search?${queryParams.toString()}`;
    } else {
      if (currentUser && activeTab === 'home') {
        const queryParams = new URLSearchParams({
          regionCode: filters.regionCode,
          maxResults: '48',
          pageToken: feedNextPageToken,
          userId: currentUser.id || '',
          userEmail: currentUser.email || ''
        });
        if (currentUser.accessToken) queryParams.set('accessToken', currentUser.accessToken);
        if (filters.categoryId) queryParams.set('videoCategoryId', filters.categoryId);

        const seedSet = new Set<string>();
        for (const v of watchHistory) {
          const id = getVideoUniqueId(v);
          if (id) seedSet.add(id);
          if (seedSet.size >= 6) break;
        }
        for (const v of savedVideos) {
          const id = getVideoUniqueId(v);
          if (id) seedSet.add(id);
          if (seedSet.size >= 10) break;
        }
        const seedsList = Array.from(seedSet).filter(Boolean);
        if (seedsList.length > 0) queryParams.set('seeds', seedsList.join(','));

        const subChannels = getSubscribedChannels()
          .map((c) => c.channelId)
          .filter(Boolean)
          .slice(0, 5);
        if (subChannels.length > 0) queryParams.set('channels', subChannels.join(','));

        apiUrl = `/api/youtube/recommendations?${queryParams.toString()}`;
      } else {
        const queryParams = new URLSearchParams({
          regionCode: filters.regionCode,
          maxResults: '48',
          pageToken: feedNextPageToken
        });
        if (filters.categoryId) queryParams.set('videoCategoryId', filters.categoryId);
        apiUrl = `/api/youtube/trending?${queryParams.toString()}`;
      }
    }

    customFetch(apiUrl)
      .then((res) => res.json())
      .then((data) => {
        if (data.items && data.items.length > 0) {
          setRawVideos((prev) => {
            const existingIds = new Set(prev.map((v) => v.playlistId || (typeof v.id === 'string' ? v.id : (v.id as any)?.videoId || (v.id as any)?.playlistId)));
            const newItems = data.items.filter((v: any) => {
              const id = v.playlistId || (typeof v.id === 'string' ? v.id : (v.id as any)?.videoId || (v.id as any)?.playlistId);
              return id && !existingIds.has(id);
            });
            return [...prev, ...newItems];
          });
        }
        setFeedNextPageToken(data.nextPageToken || null);
        setLoadingMoreFeed(false);
      })
      .catch((err) => {
        console.error('Load more feed error:', err);
        setLoadingMoreFeed(false);
      });
  };

  // Filter out blocked channel videos from feed
  const videos = rawVideos.filter((v) => {
    const chId = v.snippet?.channelId;
    return !chId || !isChannelBlocked(chId);
  });

  // Handle Video Selection & Add to History
  const handleSelectVideo = (video: YouTubeVideoItem, keepMinimized = false) => {
    try {
      localStorage.setItem('yt_user_gesture_v1', '1');
    } catch {}

    const isPl = Boolean(
      video.isPlaylist ||
      video.kind === 'youtube#playlist' ||
      video.playlistId ||
      (video.customPlaylistItems && video.customPlaylistItems.length > 0)
    );

    const stayInDetailView = Boolean((video as any).fromWatchAutoplay || isDetailOpen || keepMinimized);

    if (!isPl && !stayInDetailView && isShortVideo(video)) {
      setInitialShortVideo(video);
      setActiveTab('shorts');
      setSelectedVideo(null);
      setIsDetailOpen(false);
    } else {
      setSelectedVideo(video);
      if (!keepMinimized) {
        setIsDetailOpen(true);
      }
    }

    const targetId =
      video.firstVideoId ||
      (typeof video.id === 'string' ? video.id : (video.id as any)?.videoId || (video.id as any)?.playlistId);
    if (!targetId) return;

    // 1. Prioritize stream acquisition BEFORE any related videos or comments are fetched
    const streamTargetId = video.firstVideoId || (!/^(PL|UU|FL|LP|RD|OLAK5uy_)/.test(targetId) ? targetId : '');
    if (streamTargetId) {
      prefetchStreamSources(streamTargetId);
    }

    const historyItem: YouTubeVideoItem = {
      ...video,
      watchedAt: new Date().toISOString()
    };

    const updatedHistory = [
      historyItem,
      ...watchHistory.filter((v) => {
        const id = getVideoUniqueId(v);
        return id !== targetId;
      })
    ];

    setWatchHistory(updatedHistory);
    // Save unlimited history with ArrayBuffer binary thumbnail to IndexedDB (VideoHistory)
    saveVideoToHistoryIDB(historyItem).catch(() => {});
    try {
      // Keep compact 100-item mirror in localStorage so synchronous reads never exceed 5MB
      localStorage.setItem('kaito_watch_history', JSON.stringify(updatedHistory.slice(0, 100)));
    } catch (e) {
      console.error(e);
    }

    // Sync to server-side history if logged in
    if (currentUser?.email) {
      fetch('/api/youtube/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: currentUser.email,
          video: historyItem
        })
      }).catch(() => {});
    }

    // Clear previous related videos; VideoDetailView fetches related videos & comments AFTER stream is acquired
    setRelatedVideos([]);
  };

  // Toggle Save Video
  const handleToggleSave = (video: YouTubeVideoItem) => {
    const targetId = typeof video.id === 'string' ? video.id : (video.id as any)?.videoId;
    if (!targetId) return;

    const exists = savedVideos.some((v) => {
      const id = typeof v.id === 'string' ? v.id : (v.id as any)?.videoId;
      return id === targetId;
    });

    let updated: YouTubeVideoItem[];
    if (exists) {
      updated = savedVideos.filter((v) => {
        const id = typeof v.id === 'string' ? v.id : (v.id as any)?.videoId;
        return id !== targetId;
      });
    } else {
      updated = [video, ...savedVideos];
    }

    setSavedVideos(updated);
    try {
      localStorage.setItem('kaito_saved_videos', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  const isVideoSaved = (video: YouTubeVideoItem) => {
    const targetId = typeof video.id === 'string' ? video.id : (video.id as any)?.videoId;
    return savedVideos.some((v) => {
      const id = typeof v.id === 'string' ? v.id : (v.id as any)?.videoId;
      return id === targetId;
    });
  };

  const handleClearHistory = () => {
    setWatchHistory([]);
    clearAllHistoryFromIDB().catch(() => {});
    try {
      localStorage.removeItem('kaito_watch_history');
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveHistoryItem = (videoId: string) => {
    const updated = watchHistory.filter((v) => getVideoUniqueId(v) !== videoId);
    setWatchHistory(updated);
    removeHistoryItemFromIDB(videoId).catch(() => {});
    try {
      localStorage.setItem('kaito_watch_history', JSON.stringify(updated.slice(0, 100)));
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreatePlaylist = (
    title: string,
    description: string,
    visibility: 'public' | 'private' = 'private',
    authorName?: string
  ) => {
    const newPl: UserCustomPlaylist = {
      id: Date.now().toString(),
      title,
      description,
      createdAt: new Date().toLocaleDateString('ja-JP'),
      updatedAt: new Date().toLocaleDateString('ja-JP'),
      visibility,
      isPublic: visibility === 'public',
      authorName: authorName || '海斗tube ユーザー',
      videos: []
    };
    const updated = [newPl, ...customPlaylists];
    setCustomPlaylists(updated);
    savePlaylistsToIDB(updated).catch(() => {});
    try {
      localStorage.setItem('kaito_custom_playlists', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    if (visibility === 'public') {
      syncPlaylistWithServer(newPl).catch(() => {});
      showGlobalToast(`公開プレイリスト「${title}」を作成しました`);
    } else {
      showGlobalToast(`非公開プレイリスト「${title}」を作成しました`);
    }
  };

  const handleDeletePlaylist = (id: string) => {
    const target = customPlaylists.find((p) => p.id === id);
    const updated = customPlaylists.filter((p) => p.id !== id);
    setCustomPlaylists(updated);
    savePlaylistsToIDB(updated).catch(() => {});
    try {
      localStorage.setItem('kaito_custom_playlists', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    if (target && (target.visibility === 'public' || target.isPublic)) {
      syncPlaylistWithServer({ ...target, visibility: 'private', isPublic: false }).catch(() => {});
    }
  };

  // Handle shared_playlist URL query parameter
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const sharedId = params.get('shared_playlist');
      const plToken = params.get('pl_token');
      if (sharedId || plToken) {
        fetchSharedPlaylistByIdOrInput(window.location.href).then((resolved) => {
          if (resolved && resolved.videos && resolved.videos.length > 0) {
            showGlobalToast(`共有プレイリスト「${resolved.title}」を読み込みました（再生画面から複製できます）`);
            handleSelectVideo({
              ...resolved.videos[0],
              playlistId: `custom_${resolved.id}`,
              customPlaylistTitle: resolved.title,
              customPlaylistItems: resolved.videos
            });
          }
        });
      }
    } catch {}
  }, []);

  const handleSearchSubmit = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    // Check if the input is a shared playlist URL (?shared_playlist=... or KAITO_PL:...)
    if (trimmed.includes('shared_playlist=') || trimmed.includes('pl_token=') || trimmed.startsWith('KAITO_PL:')) {
      const resolved = await fetchSharedPlaylistByIdOrInput(trimmed);
      if (resolved) {
        await clonePlaylistToCustomPlaylists(resolved);
        if (resolved.videos && resolved.videos.length > 0) {
          handleSelectVideo({
            ...resolved.videos[0],
            playlistId: `custom_${resolved.id}`,
            customPlaylistTitle: resolved.title,
            customPlaylistItems: resolved.videos
          });
        } else {
          setActiveTab('library');
          setIsDetailOpen(false);
        }
        return;
      }
    }

    // Check if input is a 613Tube URL (https://613tube.com/watch/?v=... or https://613tube.com/results/?q=...)
    const parsed613 = parse613TubeUrl(trimmed);
    if (parsed613.is613Tube) {
      if (parsed613.videoId) {
        showGlobalToast('安全な動画を取得しています...');
        const tempVideo: YouTubeVideoItem = {
          id: parsed613.videoId,
          source: '613tube',
          is613Tube: true,
          snippet: {
            title: 'セーフ検証済動画',
            description: 'セーフフィルタより取得',
            publishedAt: new Date().toISOString(),
            channelId: '',
            channelTitle: 'セーフ検証済',
            thumbnails: {
              high: { url: `https://i.ytimg.com/vi/${parsed613.videoId}/hqdefault.jpg` },
              medium: { url: `https://i.ytimg.com/vi/${parsed613.videoId}/mqdefault.jpg` },
              default: { url: `https://i.ytimg.com/vi/${parsed613.videoId}/default.jpg` }
            }
          }
        };
        handleSelectVideo(tempVideo);
        fetchStreamSourcesCoalesced(parsed613.videoId)
          .catch(() => {})
          .finally(() => {
            customFetch(`/api/youtube/video/${parsed613.videoId}`)
              .then((res) => res.json())
              .then((data) => {
                if (data.items && data.items[0]) {
                  handleSelectVideo({ ...data.items[0], is613Tube: true, source: '613tube' });
                }
              })
              .catch(() => {});
          });
        return;
      } else if (parsed613.query) {
        showGlobalToast(`「${parsed613.query}」を安全検索中...`);
        setFilters((prev) => ({ ...prev, query: parsed613.query!, source: '613tube' }));
        setActiveTab('home');
        setIsDetailOpen(false);
        setSearchNonce((n) => n + 1);
        return;
      } else {
        showGlobalToast('セーフ動画取得を開きました');
        setIs613TubeModalOpen(true);
        setFilters((prev) => ({ ...prev, source: '613tube' }));
        setActiveTab('home');
        setIsDetailOpen(false);
        setSearchNonce((n) => n + 1);
        return;
      }
    }

    // Check if the input is explicitly a YouTube / 613Tube URL (shorts, watch, youtu.be, 613tube, embed, etc.) or id: prefix
    const looksLikeUrl = /^(https?:\/\/|www\.|youtube\.com|youtu\.be|613tube\.com|id:)/i.test(trimmed);
    if (looksLikeUrl) {
      const cleanInput = trimmed.replace(/^id:/i, '');
      const parsed = parseYouTubeUrl(cleanInput);
      if (parsed.videoId) {
        // If it contains "shorts" or /shorts/<id>, automatically route to Shorts view
        if (parsed.isShort || trimmed.toLowerCase().includes('short')) {
          const tempShortVideo: YouTubeVideoItem = {
            id: parsed.videoId,
            snippet: {
              title: 'YouTube Short',
              description: '#shorts',
              publishedAt: new Date().toISOString(),
              channelId: '',
              channelTitle: 'YouTube',
              thumbnails: {
                high: { url: `https://i.ytimg.com/vi/${parsed.videoId}/hqdefault.jpg` },
                medium: { url: `https://i.ytimg.com/vi/${parsed.videoId}/mqdefault.jpg` },
                default: { url: `https://i.ytimg.com/vi/${parsed.videoId}/default.jpg` }
              }
            }
          };

          // Try to fetch real video metadata asynchronously in background
          customFetch(`/api/youtube/video/${parsed.videoId}`)
            .then((res) => res.json())
            .then((data) => {
              if (data.items && data.items[0]) {
                setInitialShortVideo(data.items[0]);
              }
            })
            .catch(() => {});

          setInitialShortVideo(tempShortVideo);
          setActiveTab('shorts');
          setSelectedVideo(null);
          setIsDetailOpen(false);
          return;
        }

        // If it is a normal YouTube video URL, open the video directly in detail / player view
        const tempVideo: YouTubeVideoItem = {
          id: parsed.videoId,
          snippet: {
            title: 'YouTube Video',
            description: '',
            publishedAt: new Date().toISOString(),
            channelId: '',
            channelTitle: 'YouTube',
            thumbnails: {
              high: { url: `https://i.ytimg.com/vi/${parsed.videoId}/hqdefault.jpg` },
              medium: { url: `https://i.ytimg.com/vi/${parsed.videoId}/mqdefault.jpg` },
              default: { url: `https://i.ytimg.com/vi/${parsed.videoId}/default.jpg` }
            }
          }
        };

        handleSelectVideo(tempVideo);

        // Fetch complete video metadata only AFTER stream sources are resolved
        fetchStreamSourcesCoalesced(parsed.videoId)
          .catch(() => {})
          .finally(() => {
            customFetch(`/api/youtube/video/${parsed.videoId}`)
              .then((res) => res.json())
              .then((data) => {
                if (data.items && data.items[0]) {
                  handleSelectVideo(data.items[0]);
                }
              })
              .catch(() => {});
          });
        return;
      }
    }

    addSearchHistory(trimmed);
    setFilters((prev) => ({ ...prev, query: trimmed, categoryId: '' }));
    setActiveTab('home');
    setIsDetailOpen(false); // 検索中も動画は小窓・バックグラウンドで自動再生を維持
    setSearchNonce((n) => n + 1);
  };

  const handleUpdateFilters = (newFilters: Partial<SearchFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const handleResetFilters = () => {
    setFilters({
      query: '',
      order: 'relevance',
      type: 'all',
      videoDuration: 'any',
      categoryId: '',
      regionCode: 'JP'
    });
  };

  return (
    <div className="min-h-screen bg-[#fcfcfd] dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col font-sans selection:bg-rose-600 selection:text-white app-loaded transition-colors">
      {/* Top Main Navigation Header */}
      <Header
        filters={filters}
        onUpdateFilters={handleUpdateFilters}
        onSearchSubmit={handleSearchSubmit}
        onOpenFilterModal={() => setIsFilterModalOpen(true)}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        onOpenShortcutsModal={() => setIsShortcutsModalOpen(true)}
        onOpen613TubeModal={() => setIs613TubeModalOpen(true)}
        activeTab={activeTab}
        onChangeTab={(tab) => {
          setActiveTab(tab);
          setIsDetailOpen(false); // タブ移動時も動画はバックグラウンド再生を維持
        }}
        playbackMode={playbackMode}
        onTogglePlaybackMode={setPlaybackMode}
        savedCount={savedVideos.length}
        apiSettings={apiSettings}
        currentUser={currentUser}
        onUserChange={setCurrentUser}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        {selectedVideo && isDetailOpen ? (
          <VideoDetailView
            video={selectedVideo}
            relatedVideos={relatedVideos}
            onSelectVideo={handleSelectVideo}
            onSelectChannel={setSelectedChannelId}
            playbackMode={playbackMode}
            onTogglePlaybackMode={setPlaybackMode}
            isSaved={isVideoSaved(selectedVideo)}
            onToggleSave={handleToggleSave}
            onBackToHome={() => setIsDetailOpen(false)}
            onOpenShortsPlayer={(v) => handleSelectVideo(v)}
          />
        ) : activeTab === 'shorts' ? (
          <ShortsView
            onSelectChannel={setSelectedChannelId}
            playbackMode={playbackMode}
            onTogglePlaybackMode={setPlaybackMode}
            regionCode={filters.regionCode}
            initialShortVideo={initialShortVideo}
            onClearInitialShort={() => setInitialShortVideo(null)}
            onBackToHome={() => setActiveTab('home')}
          />
        ) : activeTab === 'subscriptions-feed' ? (
          <ChannelsView
            onSelectChannel={setSelectedChannelId}
            onSelectVideo={handleSelectVideo}
            initialSubTab="feed"
            isVideoSaved={isVideoSaved}
            onToggleSave={handleToggleSave}
          />
        ) : activeTab === 'channels' ? (
          <ChannelsView
            onSelectChannel={setSelectedChannelId}
            onSelectVideo={handleSelectVideo}
            initialSubTab="subscribed"
            isVideoSaved={isVideoSaved}
            onToggleSave={handleToggleSave}
          />
        ) : activeTab === 'categories' ? (
          <CategoryView
            categories={categories}
            onSelectVideo={handleSelectVideo}
            onSelectChannel={setSelectedChannelId}
            regionCode={filters.regionCode}
          />
        ) : activeTab === 'library' ? (
          <LibraryView
            savedVideos={savedVideos}
            watchHistory={watchHistory}
            customPlaylists={customPlaylists}
            onSelectVideo={handleSelectVideo}
            onSelectChannel={setSelectedChannelId}
            onToggleSave={handleToggleSave}
            onClearHistory={handleClearHistory}
            onRemoveHistoryItem={handleRemoveHistoryItem}
            onCreatePlaylist={handleCreatePlaylist}
            onDeletePlaylist={handleDeletePlaylist}
          />
        ) : (
          /* Home & Trending Video Grid */
          <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
            {/* Title / Filter Status Header */}
            <div className="flex items-center justify-between flex-wrap gap-4 border-b border-neutral-800/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-neutral-900 border border-neutral-700 flex items-center justify-center">
                  {activeTab === 'trending' ? (
                    <Flame className="w-5 h-5 text-amber-500" />
                  ) : currentUser ? (
                    <Sparkles className="w-4 h-4 text-rose-500 fill-rose-500" />
                  ) : (
                    <Play className="w-4 h-4 text-rose-500 fill-rose-500" />
                  )}
                </div>

                <div>
                  <h1 className="text-xl font-bold text-neutral-900 dark:text-white flex items-center flex-wrap gap-2">
                    {filters.query
                      ? `「${filters.query}」の検索結果`
                      : activeTab === 'trending'
                      ? '急上昇トレンド'
                      : currentUser
                      ? '本物のYouTubeおすすめ'
                      : 'おすすめ動画'}
                    {currentUser && !filters.query && activeTab === 'home' && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20 inline-flex items-center gap-1.5 shadow-xs">
                        {currentUser.picture && (
                          <img
                            src={currentUser.picture}
                            alt=""
                            className="w-3.5 h-3.5 rounded-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        )}
                        <span>{currentUser.name || currentUser.email.split('@')[0]} 向け</span>
                      </span>
                    )}
                  </h1>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {currentUser && !filters.query && activeTab === 'home'
                      ? `Google アカウント (${currentUser.email}) の関心と視聴傾向に基づき、本物のYouTubeアルゴリズムからパーソナライズ`
                      : 'Edu埋め込み • ストリーム • 高画質1080p 再生対応'}
                  </p>
                </div>
              </div>

              {currentUser && !filters.query && activeTab === 'home' && (
                <button
                  type="button"
                  onClick={() => {
                    setLoading(true);
                    const queryParams = new URLSearchParams({
                      regionCode: filters.regionCode,
                      maxResults: '48',
                      userId: currentUser.id || '',
                      userEmail: currentUser.email || ''
                    });
                    if (currentUser.accessToken) queryParams.set('accessToken', currentUser.accessToken);
                    const seedSet = new Set<string>();
                    for (const v of watchHistory) {
                      const id = getVideoUniqueId(v);
                      if (id) seedSet.add(id);
                      if (seedSet.size >= 6) break;
                    }
                    for (const v of savedVideos) {
                      const id = getVideoUniqueId(v);
                      if (id) seedSet.add(id);
                      if (seedSet.size >= 10) break;
                    }
                    const seedsList = Array.from(seedSet).filter(Boolean);
                    if (seedsList.length > 0) queryParams.set('seeds', seedsList.join(','));
                    const subChannels = getSubscribedChannels()
                      .map((c) => c.channelId)
                      .filter(Boolean)
                      .slice(0, 5);
                    if (subChannels.length > 0) queryParams.set('channels', subChannels.join(','));

                    customFetch(`/api/youtube/recommendations?${queryParams.toString()}`)
                      .then((res) => res.json())
                      .then((data) => {
                        setRawVideos(data.items || []);
                        setFeedNextPageToken(data.nextPageToken || null);
                        setLoading(false);
                        showGlobalToast('最新のYouTubeおすすめを更新しました');
                      })
                      .catch(() => setLoading(false));
                  }}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95 border border-blue-500"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>おすすめを再取得</span>
                </button>
              )}
            </div>

            {/* Logged Out Home Banner Callout */}
            {!currentUser && !filters.query && activeTab === 'home' && (
              <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-neutral-900 border-2 border-neutral-300 dark:border-neutral-800 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-950/60 border border-blue-300 dark:border-blue-700 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-neutral-900 dark:text-white flex items-center gap-2">
                      ログインすると本物のYouTubeおすすめを取得
                    </h3>
                    <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-0.5">
                      Google アカウントでログインすると、YouTube公式アルゴリズムによるあなた向けのおすすめ動画フィードが表示されます。
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('zero_open_google_login'))}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer shrink-0 active:scale-95 border border-blue-500"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Google でログイン</span>
                </button>
              </div>
            )}

            {/* Logged In Active Sync Banner */}
            {currentUser && !filters.query && activeTab === 'home' && (
              <div className="px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border-2 border-emerald-300 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-300 text-xs flex items-center justify-between gap-3 shadow-xs font-semibold">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>
                    本物のYouTubeおすすめを取得中（{currentUser.name} さんのGoogleアカウントにパーソナライズされています）
                  </span>
                </div>
                <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold hidden sm:inline bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded">リアルタイム同期中</span>
              </div>
            )}

            {/* 613Tube Safe Filter Mode Active Banner */}
            {filters.source === '613tube' && (
              <div className="px-4 py-3 rounded-2xl bg-emerald-500/15 border-2 border-emerald-500/40 text-emerald-950 dark:text-emerald-200 text-xs flex flex-wrap items-center justify-between gap-3 shadow-sm backdrop-blur-xs">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-emerald-600 text-white shadow-xs">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold flex items-center gap-1.5 text-sm text-emerald-900 dark:text-emerald-100">
                      <span>セーフフィルタ動画取得中</span>
                      <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-medium">
                        セーフ
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80">
                      フィルタリング機能を通して安全な動画のみを取得・表示しています。
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIs613TubeModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-bold transition-all cursor-pointer shrink-0 shadow-xs flex items-center gap-1.5"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>URL / キーワードで取得</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateFilters({ source: 'youtube' })}
                    className="px-3 py-1.5 rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 text-xs font-bold transition-all cursor-pointer shrink-0 shadow-xs"
                  >
                    通常検索に戻す
                  </button>
                </div>
              </div>
            )}

            {/* Video Cards Grid */}
            {loading ? (
              <div className="py-24 text-center space-y-3">
                <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-neutral-500 dark:text-neutral-400 text-xs font-medium">
                  動画データを取得中...
                </p>
              </div>
            ) : videos.length === 0 ? (
              <div className="py-20 text-center text-neutral-500 dark:text-neutral-400 space-y-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-8 max-w-xl mx-auto shadow-xs">
                <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
                <p className="text-base font-bold text-neutral-900 dark:text-white">動画が見つかりませんでした</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  検索キーワードやフィルター条件を変更して再度お試しください。
                </p>
                <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                  <button
                    onClick={handleResetFilters}
                    className="px-3.5 py-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                  >
                    検索条件リセット
                  </button>
                  <button
                    onClick={() => {
                      setLoading(true);
                      handleResetFilters();
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-white" />
                    <span>再読み込み</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {videos.map((v) => (
                    <VideoCard
                      key={typeof v.id === 'string' ? v.id : (v.id as any)?.videoId || Math.random().toString()}
                      video={v}
                      onSelectVideo={handleSelectVideo}
                      onSelectChannel={setSelectedChannelId}
                      isSaved={isVideoSaved(v)}
                      onToggleSave={handleToggleSave}
                    />
                  ))}
                </div>

                {/* Load More Button for Search Results / Feed */}
                {feedNextPageToken && (
                  <div className="pt-4 pb-8 text-center">
                    <button
                      onClick={handleLoadMoreFeed}
                      disabled={loadingMoreFeed}
                      className="px-6 py-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-sm font-bold text-neutral-200 hover:text-white rounded-xl transition-all shadow-md flex items-center justify-center gap-2 mx-auto cursor-pointer"
                      id="feed-load-more-btn"
                    >
                      {loadingMoreFeed ? (
                        <>
                          <div className="w-4 h-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                          <span>動画をさらに読み込み中...</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-4 h-4 text-rose-500" />
                          <span>さらに読み込む</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Global Feedback Toast */}
      {globalToast && (
        <div className="fixed bottom-6 left-6 z-50 bg-neutral-900/95 border border-rose-500/60 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold animate-fade-in max-w-sm">
          <div className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0">
            <Check className="w-3.5 h-3.5" />
          </div>
          <span>{globalToast}</span>
        </div>
      )}

      {/* Mini Floating Player for Background Continuous Playback (他の検索や操作中も次の動画が流れるまで自動バックグラウンド再生) */}
      {selectedVideo && !isDetailOpen && activeTab !== 'shorts' && (
        <MiniFloatingPlayer
          video={selectedVideo}
          playbackMode={playbackMode}
          onOpenDetail={() => setIsDetailOpen(true)}
          onClose={() => {
            setSelectedVideo(null);
            setIsDetailOpen(false);
          }}
          onEnded={() => {
            const currentVid =
              selectedVideo.firstVideoId ||
              (typeof selectedVideo.id === 'string'
                ? selectedVideo.id
                : (selectedVideo.id as any)?.videoId || '');
            const list = selectedVideo.customPlaylistItems;
            if (list && list.length > 0) {
              const idx = list.findIndex((it) => {
                const id =
                  typeof it.id === 'string'
                    ? it.id
                    : (it.id as any)?.videoId ||
                      (it as any).snippet?.resourceId?.videoId ||
                      (it as any).contentDetails?.videoId ||
                      it.firstVideoId ||
                      '';
                return id === currentVid;
              });
              if (idx >= 0 && idx < list.length - 1) {
                const nextItem = list[idx + 1];
                const nextVid =
                  typeof nextItem.id === 'string'
                    ? nextItem.id
                    : (nextItem.id as any)?.videoId ||
                      (nextItem as any).snippet?.resourceId?.videoId ||
                      (nextItem as any).contentDetails?.videoId ||
                      nextItem.firstVideoId ||
                      '';
                handleSelectVideo(
                  {
                    ...nextItem,
                    id: nextVid || nextItem.id,
                    firstVideoId: nextVid,
                    isPlaylist: false,
                    kind: 'youtube#video',
                    playlistId: selectedVideo.playlistId,
                    customPlaylistItems: list,
                    customPlaylistTitle: selectedVideo.customPlaylistTitle
                  },
                  true
                );
                return;
              }
            }
            if (relatedVideos.length > 0) {
              const nextRel = relatedVideos.find((r) => {
                const rId = typeof r.id === 'string' ? r.id : (r.id as any)?.videoId;
                return rId && rId !== currentVid;
              });
              if (nextRel) {
                handleSelectVideo(nextRel, true);
              }
            }
          }}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-neutral-800/80 bg-neutral-900/40 py-6 text-center text-xs text-neutral-400 space-y-3">
        <div className="flex items-center justify-center gap-4 flex-wrap text-neutral-400 text-xs">
          <button
            onClick={() => setIsShortcutsModalOpen(true)}
            className="hover:text-white transition-colors cursor-pointer"
          >
            ショートカット一覧
          </button>
        </div>

        {/* Visitor Counter */}
        <div className="flex items-center justify-center pt-1">
          <MinecraftVisitorCounter />
        </div>

        <p className="font-bold text-neutral-800 dark:text-white text-sm">
          ZERO<span className="text-rose-500">-tube</span>
        </p>
        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">
          YouTube Player for Education • 高画質ストリーム • InnerTube API
        </p>
      </footer>

      {/* Search Filter Modal */}
      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        filters={filters}
        categories={categories}
        onUpdateFilters={handleUpdateFilters}
        onResetFilters={handleResetFilters}
      />

      {/* Channel View Modal */}
      <ChannelModal
        channelId={selectedChannelId}
        onClose={() => setSelectedChannelId(null)}
        onSelectVideo={handleSelectVideo}
        isSaved={false}
        onToggleSave={handleToggleSave}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={apiSettings}
        onSaveSettings={handleSaveSettings}
        onOpenProxyGuide={() => window.dispatchEvent(new CustomEvent('kaito_open_proxy_guide'))}
      />

      {/* Keyboard Shortcuts Help Modal */}
      <ShortcutsHelpModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />

      {/* 613Tube Safe Video Fetcher Modal */}
      <Tube613Modal
        isOpen={is613TubeModalOpen}
        onClose={() => setIs613TubeModalOpen(false)}
        onSelectVideo={handleSelectVideo}
        onLoadVideosToFeed={(fetchedVideos, queryDesc) => {
          setRawVideos(fetchedVideos);
          setFilters((prev) => ({ ...prev, query: queryDesc, source: '613tube' }));
          setActiveTab('home');
          setIsDetailOpen(false);
          showGlobalToast(`「${queryDesc}」から ${fetchedVideos.length}件を取得・反映しました`);
        }}
        onActivate613SafeMode={(query) => {
          setFilters((prev) => ({ ...prev, query: query || prev.query, source: '613tube' }));
        }}
      />
    </div>
  );
}
