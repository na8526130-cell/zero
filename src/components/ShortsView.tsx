import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  Heart,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  ChevronUp,
  ChevronDown,
  User,
  X,
  Check,
  Search,
  Zap,
  ArrowLeft,
  MoreVertical,
  Disc,
  Send,
  CornerUpRight,
  Share2,
  Sparkles,
  Music
} from 'lucide-react';
import { YouTubeVideoItem, PlaybackMode } from '../types';
import { formatViewCount, formatPublishedAt, cleanCommentText, parseYouTubeUrl } from '../utils/formatters';
import { EducationPlayer } from './EducationPlayer';
import { AuthorAvatar } from './AuthorAvatar';
import { ThumbnailImage } from './ThumbnailImage';
import { customFetch } from '../utils/apiClient';

interface ShortsViewProps {
  onSelectChannel: (channelId: string) => void;
  playbackMode: PlaybackMode;
  onTogglePlaybackMode: (mode: PlaybackMode) => void;
  regionCode: string;
  initialShortVideo?: YouTubeVideoItem | null;
  onClearInitialShort?: () => void;
  onBackToHome?: () => void;
}

export const ShortsView: React.FC<ShortsViewProps> = ({
  onSelectChannel,
  playbackMode,
  onTogglePlaybackMode,
  regionCode,
  initialShortVideo,
  onClearInitialShort,
  onBackToHome
}) => {
  const [shorts, setShorts] = useState<YouTubeVideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // selectedIndex null means Grid List View; number means Fullscreen Vertical Player!
  const [selectedIndex, setSelectedIndex] = useState<number | null>(
    initialShortVideo ? 0 : null
  );

  // Shorts-only search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchInput, setSearchInput] = useState<string>('');

  // Player Interaction States
  const [isLiked, setIsLiked] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);
  const [isRemixModalOpen, setIsRemixModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [commentLikes, setCommentLikes] = useState<Record<string, boolean>>({});

  // Player Search Overlay State inside vertical player
  const [isPlayerSearchOpen, setIsPlayerSearchOpen] = useState(false);
  const [playerSearchInput, setPlayerSearchInput] = useState<string>('');

  // Comments Sheet State
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newCommentInput, setNewCommentInput] = useState('');

  // Timestamp jump state for Shorts player
  const [shortStartTime, setShortStartTime] = useState<number>(0);
  const [shortSeekTrigger, setShortSeekTrigger] = useState<number>(0);

  const handleJumpToShortTime = (seconds: number) => {
    const targetSec = Math.max(0, Math.floor(seconds));
    try {
      localStorage.setItem('yt_user_gesture_v1', '1');
    } catch {}
    setShortStartTime(targetSec);
    setShortSeekTrigger((prev) => prev + 1);
    setIsCommentsOpen(false);
    setIsInfoOpen(false);
  };

  const renderTextWithTimestamps = (text: string) => {
    if (!text) return null;
    const parts = text.split(/((?:(?:\d{1,2}):)?\d{1,2}:\d{2})/g);
    return parts.map((part, index) => {
      const match = part.match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})$/);
      if (match) {
        const hrs = match[1] ? parseInt(match[1], 10) : 0;
        const mins = parseInt(match[2], 10);
        const secs = parseInt(match[3], 10);
        if (secs < 60 && mins < 60) {
          const totalSeconds = hrs * 3600 + mins * 60 + secs;
          return (
            <button
              key={index}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleJumpToShortTime(totalSeconds);
              }}
              className="text-rose-400 hover:text-rose-300 font-mono font-bold bg-rose-500/15 hover:bg-rose-500/30 px-1.5 py-0.2 rounded border border-rose-500/40 transition-colors cursor-pointer inline-flex items-center gap-0.5 mx-0.5"
              title={`${part} にジャンプ再生`}
            >
              {part}
            </button>
          );
        }
      }
      return <React.Fragment key={index}>{part}</React.Fragment>;
    });
  };

  // Gesture & interaction tracking refs
  const lastWheelTimeRef = useRef<number>(0);
  const gestureLayerRef = useRef<HTMLDivElement>(null);
  const stageContainerRef = useRef<HTMLDivElement>(null);

  const [isPaused, setIsPaused] = useState(false);
  const [showPlayPauseFeedback, setShowPlayPauseFeedback] = useState<boolean | null>(null);

  // Sync state refs to prevent stale closures in event listeners
  const selectedIndexRef = useRef<number | null>(selectedIndex);
  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  const isCommentsOpenRef = useRef<boolean>(isCommentsOpen);
  useEffect(() => {
    isCommentsOpenRef.current = isCommentsOpen;
  }, [isCommentsOpen]);

  const isPlayerSearchOpenRef = useRef<boolean>(isPlayerSearchOpen);
  useEffect(() => {
    isPlayerSearchOpenRef.current = isPlayerSearchOpen;
  }, [isPlayerSearchOpen]);

  const isInfoOpenRef = useRef<boolean>(isInfoOpen);
  useEffect(() => {
    isInfoOpenRef.current = isInfoOpen;
  }, [isInfoOpen]);

  const [subscribedChannels, setSubscribedChannels] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem('kaito_subscriptions');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const popularShortTags = ['トレンド', 'プログラミング', 'AI・IT', '学習・勉強', '英語', '雑学'];

  // Load next page of shorts (XeroxYT pagination)
  const loadMoreShorts = async () => {
    if (!nextPageToken || loadingMore) return;
    setLoadingMore(true);
    try {
      let url = `/api/youtube/shorts?regionCode=${regionCode}&pageToken=${encodeURIComponent(nextPageToken)}`;
      if (searchQuery.trim()) {
        url += `&q=${encodeURIComponent(searchQuery.trim() + ' #Shorts')}`;
      }
      const res = await customFetch(url);
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        setShorts((prev) => {
          const existingIds = new Set(prev.map((item) => typeof item.id === 'string' ? item.id : (item.id as any)?.videoId));
          const newItems = data.items.filter((item: any) => {
            const id = typeof item.id === 'string' ? item.id : (item.id as any)?.videoId;
            return id && !existingIds.has(id);
          });
          return [...prev, ...newItems];
        });
        setNextPageToken(data.nextPageToken || null);
      } else {
        setNextPageToken(null);
      }
    } catch (e) {
      console.error('Failed to load more shorts:', e);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleNextShort = useCallback(() => {
    setSelectedIndex((prev) => {
      if (prev === null) return null;
      if (prev < shorts.length - 1) {
        setIsLiked(false);
        setIsCommentsOpen(false);
        setIsInfoOpen(false);
        setShowMoreMenu(false);
        setIsPaused(false);
        setShortStartTime(0);
        setShortSeekTrigger(0);
        return prev + 1;
      } else if (nextPageToken && !loadingMore) {
        loadMoreShorts();
      }
      return prev;
    });
  }, [shorts.length, nextPageToken, loadingMore]);

  const handlePrevShort = useCallback(() => {
    setSelectedIndex((prev) => {
      if (prev === null) return null;
      if (prev > 0) {
        setIsLiked(false);
        setIsCommentsOpen(false);
        setIsInfoOpen(false);
        setShowMoreMenu(false);
        setIsPaused(false);
        setShortStartTime(0);
        setShortSeekTrigger(0);
        return prev - 1;
      }
      return prev;
    });
  }, []);

  const handleClosePlayer = useCallback(() => {
    setSelectedIndex(null);
    onClearInitialShort?.();
    setIsCommentsOpen(false);
    setShowMoreMenu(false);
    setIsPlayerSearchOpen(false);
    setIsPaused(false);
  }, [onClearInitialShort]);

  const handleTogglePlayPause = useCallback(() => {
    setIsPaused((prevPaused) => {
      const nextPaused = !prevPaused;
      setShowPlayPauseFeedback(nextPaused);
      setTimeout(() => setShowPlayPauseFeedback(null), 650);

      // Send command to iframes with full handshake and widget channel support
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach((ifr) => {
        try {
          ifr.contentWindow?.postMessage(
            JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }),
            '*'
          );
          if (!nextPaused) {
            ifr.contentWindow?.postMessage(
              JSON.stringify({ event: 'command', func: 'unMute', args: [], id: 1, channel: 'widget' }),
              '*'
            );
            ifr.contentWindow?.postMessage(
              JSON.stringify({ event: 'command', func: 'unMute', args: [] }),
              '*'
            );
          }
          const commandFunc = nextPaused ? 'pauseVideo' : 'playVideo';
          ifr.contentWindow?.postMessage(
            JSON.stringify({
              event: 'command',
              func: commandFunc,
              args: [],
              id: 1,
              channel: 'widget'
            }),
            '*'
          );
          ifr.contentWindow?.postMessage(
            JSON.stringify({
              event: 'command',
              func: commandFunc,
              args: []
            }),
            '*'
          );
        } catch {}
      });

      // Control HTML5 videos
      const videos = document.querySelectorAll('video');
      videos.forEach((v) => {
        try {
          if (nextPaused) {
            v.pause();
          } else {
            v.muted = false;
            v.play().catch(() => {});
          }
        } catch {}
      });

      return nextPaused;
    });
  }, []);

  // Listen to YouTube embed state messages to keep isPaused synchronized with real player state
  useEffect(() => {
    const handleWindowMessage = (e: MessageEvent) => {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (!data) return;

        // 1. Direct onStateChange event (0=Ended, 1=Playing, 2=Paused, 5=Cued, -1=Unstarted)
        if (data.event === 'onStateChange') {
          if (data.info === 1) {
            setIsPaused(false);
          } else if (data.info === 2 || data.info === 5 || data.info === -1) {
            setIsPaused(true);
          } else if (data.info === 0) {
            handleNextShort();
          }
        }

        // 2. infoDelivery event from YouTube widget
        if (data.event === 'infoDelivery' && data.info) {
          if (data.info.playerState === 1) {
            setIsPaused(false);
          } else if (data.info.playerState === 2 || data.info.playerState === 5 || data.info.playerState === -1) {
            setIsPaused(true);
          } else if (data.info.playerState === 0) {
            handleNextShort();
          }
        }
      } catch {}
    };

    window.addEventListener('message', handleWindowMessage);
    return () => window.removeEventListener('message', handleWindowMessage);
  }, [handleNextShort]);

  // Wheel scrolling handler for vertical stage
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (selectedIndexRef.current === null || isCommentsOpenRef.current || isPlayerSearchOpenRef.current || isInfoOpenRef.current) return;
    const now = Date.now();
    if (now - lastWheelTimeRef.current < 400) return;
    if (e.deltaY > 30) {
      lastWheelTimeRef.current = now;
      handleNextShort();
    } else if (e.deltaY < -30) {
      lastWheelTimeRef.current = now;
      handlePrevShort();
    }
  }, [handleNextShort, handlePrevShort]);

  // Robust touch, swipe & pointer gestures for mobile, tablet & desktop
  useEffect(() => {
    const el = gestureLayerRef.current;
    if (!el) return;

    let touchStartY = 0;
    let touchStartX = 0;
    let touchStartTime = 0;
    let isTouchActive = false;

    let pointerStartY = 0;
    let pointerStartX = 0;
    let pointerStartTime = 0;
    let isPointerActive = false;

    // Mobile / Tablet Touch Handlers
    const onTouchStart = (e: TouchEvent) => {
      if (isCommentsOpenRef.current || isPlayerSearchOpenRef.current || isInfoOpenRef.current) return;
      if (e.touches.length !== 1) return;
      touchStartY = e.touches[0].clientY;
      touchStartX = e.touches[0].clientX;
      touchStartTime = Date.now();
      isTouchActive = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isTouchActive || e.touches.length !== 1) return;
      const currentY = e.touches[0].clientY;
      const currentX = e.touches[0].clientX;
      const diffY = Math.abs(currentY - touchStartY);
      const diffX = Math.abs(currentX - touchStartX);

      // Prevent native browser scroll/rubberband so touchend fires reliably
      if (diffY > 6) {
        if (e.cancelable) {
          e.preventDefault();
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!isTouchActive) return;
      isTouchActive = false;
      if (isCommentsOpenRef.current || isPlayerSearchOpenRef.current || isInfoOpenRef.current) return;

      const endY = e.changedTouches[0].clientY;
      const endX = e.changedTouches[0].clientX;
      const diffY = touchStartY - endY; // Positive = swiped UP (Next), Negative = swiped DOWN (Prev)
      const diffX = touchStartX - endX;
      const duration = Date.now() - touchStartTime;

      // Natural thumb swipe: diffY >= 25px and vertical movement dominant
      if (Math.abs(diffY) >= 25 && Math.abs(diffY) > Math.abs(diffX) * 0.6) {
        if (diffY > 0) {
          handleNextShort();
        } else {
          handlePrevShort();
        }
      } else if (duration < 500 && Math.abs(diffY) < 24 && Math.abs(diffX) < 24) {
        // Quick tap: play/pause
        handleTogglePlayPause();
      }
    };

    const onTouchCancel = () => {
      isTouchActive = false;
    };

    // Desktop Mouse / Trackpad Drag Handlers
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      if (isCommentsOpenRef.current || isPlayerSearchOpenRef.current || isInfoOpenRef.current) return;
      pointerStartY = e.clientY;
      pointerStartX = e.clientX;
      pointerStartTime = Date.now();
      isPointerActive = true;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {}
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isPointerActive || e.pointerType !== 'mouse') return;
      const diffY = Math.abs(e.clientY - pointerStartY);
      if (diffY > 6 && e.cancelable) {
        e.preventDefault();
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!isPointerActive || e.pointerType !== 'mouse') return;
      isPointerActive = false;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {}
      if (isCommentsOpenRef.current || isPlayerSearchOpenRef.current || isInfoOpenRef.current) return;

      const diffY = pointerStartY - e.clientY;
      const diffX = pointerStartX - e.clientX;
      const duration = Date.now() - pointerStartTime;

      if (Math.abs(diffY) >= 28 && Math.abs(diffY) > Math.abs(diffX) * 0.6) {
        if (diffY > 0) {
          handleNextShort();
        } else {
          handlePrevShort();
        }
      } else if (duration < 500 && Math.abs(diffY) < 24 && Math.abs(diffX) < 24) {
        handleTogglePlayPause();
      }
    };

    const onPointerCancel = () => {
      isPointerActive = false;
    };

    const handleClick = (e: MouseEvent) => {
      if (isCommentsOpenRef.current || isPlayerSearchOpenRef.current || isInfoOpenRef.current) return;
      // If click event fires without a long drag, ensure play/pause works
      handleTogglePlayPause();
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchCancel, { passive: true });

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerCancel);
    el.addEventListener('click', handleClick);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchCancel);

      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerCancel);
      el.removeEventListener('click', handleClick);
    };
  }, [handleNextShort, handlePrevShort, handleTogglePlayPause]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedIndex === null) return;

      // Ignore when user is typing in comment/search inputs
      const target = e.target as HTMLElement;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') {
        return;
      }

      // XeroxYT-NTv6 Global Keyboard Shortcuts: ArrowDown / j (Next), ArrowUp / k (Prev)
      if (e.key === 'ArrowDown' || e.key === 'j' || e.key === 'J' || e.key === 'PageDown') {
        e.preventDefault();
        handleNextShort();
      } else if (e.key === 'ArrowUp' || e.key === 'k' || e.key === 'K' || e.key === 'PageUp') {
        e.preventDefault();
        handlePrevShort();
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        setIsLiked((prev) => !prev);
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setIsCommentsOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        if (isCommentsOpen) {
          setIsCommentsOpen(false);
        } else if (isPlayerSearchOpen) {
          setIsPlayerSearchOpen(false);
        } else {
          handleClosePlayer();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedIndex, shorts.length, isCommentsOpen, isPlayerSearchOpen, nextPageToken, loadingMore]);

  // Fetch shorts list
  useEffect(() => {
    setLoading(true);
    let url = `/api/youtube/shorts?regionCode=${regionCode}`;
    if (searchQuery.trim()) {
      url += `&q=${encodeURIComponent(searchQuery.trim() + ' #Shorts')}`;
    }
    customFetch(url)
      .then((res) => res.json())
      .then((data) => {
        let items: YouTubeVideoItem[] = data.items || [];

        // Filter out playlists and long-form horizontal videos (> 3 minutes)
        items = items.filter((item) => {
          if (item.isPlaylist || item.kind === 'youtube#playlist' || item.playlistId) return false;
          const durationStr = item.contentDetails?.duration;
          if (durationStr) {
            const matchH = durationStr.match(/(\d+)H/);
            const matchM = durationStr.match(/(\d+)M/);
            const matchS = durationStr.match(/(\d+)S/);
            if (matchH) return false;
            const secs = (matchM ? parseInt(matchM[1], 10) * 60 : 0) + (matchS ? parseInt(matchS[1], 10) : 0);
            if (secs > 185) return false;
          }
          return true;
        });

        if (initialShortVideo) {
          const initId =
            typeof initialShortVideo.id === 'string'
              ? initialShortVideo.id
              : (initialShortVideo.id as any)?.videoId;

          const exists = items.some((item) => {
            const id = typeof item.id === 'string' ? item.id : (item.id as any)?.videoId;
            return id === initId;
          });

          if (!exists) {
            items = [initialShortVideo, ...items];
          } else {
            items = [
              initialShortVideo,
              ...items.filter((item) => {
                const id = typeof item.id === 'string' ? item.id : (item.id as any)?.videoId;
                return id !== initId;
              })
            ];
          }
          setSelectedIndex(0);
        }
        setShorts(items);
        setNextPageToken(data.nextPageToken || null);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [regionCode, searchQuery, initialShortVideo]);

  const activeShort = selectedIndex !== null ? shorts[selectedIndex] || null : null;
  const activeVideoId = activeShort
    ? typeof activeShort.id === 'string'
      ? activeShort.id
      : (activeShort.id as any)?.videoId
    : null;

  const activeSnippet = activeShort?.snippet;
  const activeChannelId = activeSnippet?.channelId;

  // Fetch comments when comments sheet is toggled
  useEffect(() => {
    if (isCommentsOpen && activeVideoId) {
      setCommentsLoading(true);
      let localSaved: any[] = [];
      try {
        const stored = localStorage.getItem(`kaito_shorts_comments_${activeVideoId}`);
        if (stored) localSaved = JSON.parse(stored);
      } catch {}

      customFetch(`/api/youtube/comments/${activeVideoId}`)
        .then((res) => res.json())
        .then((data) => {
          const apiItems = data.items || [];
          const merged = [...localSaved, ...apiItems.filter((a: any) => !localSaved.some((l: any) => l.id === a.id))];
          setCommentsList(merged);
          setCommentsLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setCommentsList(localSaved);
          setCommentsLoading(false);
        });
    }
  }, [isCommentsOpen, activeVideoId]);

  const handleGridSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = searchInput.trim();
    if (!val) return;

    // Direct YouTube / Shorts URL check
    const parsed = parseYouTubeUrl(val);
    if (parsed.videoId) {
      const directShort: YouTubeVideoItem = {
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

      setShorts((prev) => {
        const filtered = prev.filter((p) => {
          const id = typeof p.id === 'string' ? p.id : (p.id as any)?.videoId;
          return id !== parsed.videoId;
        });
        return [directShort, ...filtered];
      });
      setSelectedIndex(0);
      setSearchInput('');

      // Fetch metadata asynchronously
      customFetch(`/api/youtube/video/${parsed.videoId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.items && data.items[0]) {
            setShorts((prev) => {
              const updated = [...prev];
              if (updated.length > 0) {
                updated[0] = data.items[0];
              }
              return updated;
            });
          }
        })
        .catch(() => {});
      return;
    }

    setSearchQuery(val);
  };

  const handleTagClick = (tag: string) => {
    if (tag === 'トレンド') {
      setSearchInput('');
      setSearchQuery('');
    } else {
      setSearchInput(tag);
      setSearchQuery(tag);
    }
  };

  const handlePlayerSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerSearchInput.trim()) return;
    setSearchQuery(playerSearchInput.trim());
    setIsPlayerSearchOpen(false);
  };

  const toggleSubscribe = (chId?: string) => {
    if (!chId) return;
    const newSubs = { ...subscribedChannels, [chId]: !subscribedChannels[chId] };
    setSubscribedChannels(newSubs);
    try {
      localStorage.setItem('kaito_subscriptions', JSON.stringify(newSubs));
    } catch (e) {
      console.error(e);
    }
  };

  const handleShare = () => {
    if (!activeVideoId) return;
    const url = `https://www.youtube.com/shorts/${activeVideoId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentInput.trim() || !activeVideoId) return;

    let authorName = 'あなた';
    let authorAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80';
    try {
      const storedUser = localStorage.getItem('google_auth_user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed.name) authorName = parsed.name;
        if (parsed.picture) authorAvatar = parsed.picture;
      }
    } catch {}

    const commentText = newCommentInput.trim();
    const newComment = {
      id: `local-${Date.now()}`,
      snippet: {
        topLevelComment: {
          snippet: {
            authorDisplayName: authorName,
            authorProfileImageUrl: authorAvatar,
            textDisplay: commentText,
            textOriginal: commentText,
            likeCount: 0,
            publishedAt: new Date().toISOString()
          }
        }
      }
    };

    setCommentsList((prev) => [newComment, ...prev]);
    setNewCommentInput('');

    // Persist to localStorage
    try {
      const stored = localStorage.getItem(`kaito_shorts_comments_${activeVideoId}`);
      const list = stored ? JSON.parse(stored) : [];
      list.unshift(newComment);
      localStorage.setItem(`kaito_shorts_comments_${activeVideoId}`, JSON.stringify(list));
    } catch {}

    // Post to backend
    try {
      await customFetch(`/api/youtube/comments/${activeVideoId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: commentText,
          authorDisplayName: authorName,
          authorProfileImageUrl: authorAvatar
        })
      });
    } catch (err) {
      console.warn('Failed to post comment to backend:', err);
    }
  };

  const toggleCommentLike = (commentId: string) => {
    setCommentLikes((prev) => ({
      ...prev,
      [commentId]: !prev[commentId]
    }));
  };

  return (
    <div className="w-full min-h-[calc(100vh-64px)] bg-neutral-950 text-white">
      {/* 
        ====================================================
        MODE A: SHORTS GRID LIST VIEW (Default Screen)
        ====================================================
      */}
      {selectedIndex === null ? (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-600 to-amber-500 p-0.5 shadow-lg shrink-0">
                <div className="w-full h-full bg-neutral-950 rounded-[14px] flex items-center justify-center">
                  <Zap className="w-6 h-6 text-rose-500 fill-rose-500" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    ショート動画ライブラリ
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-600/20 border border-rose-500/30 text-rose-400 text-[11px] font-bold">
                    YouTube Shorts
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">
                  サクサク縦スクロール視聴できる短尺コンテンツ
                </p>
              </div>
            </div>
          </div>

          {/* Dedicated Shorts Search Bar */}
          <div className="space-y-3">
            <form onSubmit={handleGridSearchSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="ショート専用検索 (例: 英語, 雑学, AI)..."
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-full pl-10 pr-10 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 transition-colors shadow-inner"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput('');
                      setSearchQuery('');
                    }}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm rounded-full shadow-lg shadow-rose-900/30 transition-all shrink-0 flex items-center gap-1.5"
              >
                <Search className="w-4 h-4" />
                <span>検索</span>
              </button>
            </form>

            {/* Popular Topics Tags */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
              <span className="text-neutral-400 font-semibold shrink-0">人気のテーマ:</span>
              {popularShortTags.map((tag) => {
                const isActive = searchQuery === tag || (tag === 'トレンド' && !searchQuery);
                return (
                  <button
                    key={tag}
                    onClick={() => handleTagClick(tag)}
                    className={`px-3.5 py-1.5 rounded-full font-bold transition-all shrink-0 border ${
                      isActive
                        ? 'bg-rose-600 text-white border-rose-500 shadow-md'
                        : 'bg-neutral-900 text-neutral-300 border-neutral-800 hover:bg-neutral-800 hover:text-white'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grid Content Area */}
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-10 h-10 border-3 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm font-semibold text-rose-400">ショート動画を取得中...</p>
            </div>
          ) : shorts.length === 0 ? (
            <div className="py-16 text-center space-y-3 bg-neutral-900/40 rounded-2xl border border-neutral-800 p-8">
              <Zap className="w-12 h-12 text-neutral-600 mx-auto" />
              <p className="text-sm text-neutral-300">該当するショート動画が見つかりませんでした。</p>
              <button
                onClick={() => {
                  setSearchInput('');
                  setSearchQuery('');
                }}
                className="px-5 py-2 bg-rose-600 text-white font-bold text-xs rounded-full shadow"
              >
                検索をリセット
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-5">
                {shorts.map((item, idx) => {
                  const videoId =
                    typeof item.id === 'string' ? item.id : (item.id as any)?.videoId;
                  const snippet = item.snippet;
                  const thumbnail =
                    snippet?.thumbnails?.high?.url ||
                    snippet?.thumbnails?.medium?.url ||
                    snippet?.thumbnails?.default?.url;

                  return (
                    <div
                      key={`${videoId}-${idx}`}
                      onClick={() => {
                        try {
                          localStorage.setItem('yt_user_gesture_v1', '1');
                        } catch {}
                        setSelectedIndex(idx);
                      }}
                      className="group relative bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-800/80 hover:border-rose-500/60 transition-all duration-300 cursor-pointer shadow-lg hover:shadow-2xl hover:scale-[1.02] flex flex-col"
                    >
                      {/* Vertical 9:16 Thumbnail Aspect Container */}
                      <div className="relative w-full aspect-[9/16] bg-neutral-950 overflow-hidden">
                        <ThumbnailImage
                          video={item}
                          videoId={videoId}
                          fallbackUrl={thumbnail}
                          alt={snippet?.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />

                        {/* Top Gradient & Badge */}
                        <div className="absolute inset-x-0 top-0 p-2.5 bg-gradient-to-b from-black/80 via-black/20 to-transparent flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-black tracking-wide flex items-center gap-1 shadow">
                            <Zap className="w-3 h-3 fill-white" />
                            Shorts
                          </span>
                        </div>

                        {/* Play Button Overlay on Hover */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="w-12 h-12 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-xl transform scale-75 group-hover:scale-100 transition-transform">
                            <Play className="w-6 h-6 fill-white ml-0.5" />
                          </div>
                        </div>

                        {/* Bottom Title Gradient Overlay */}
                        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/95 via-black/60 to-transparent pt-8 space-y-1">
                          <p className="text-xs font-bold text-white line-clamp-2 leading-snug group-hover:text-rose-300 transition-colors">
                            {snippet?.title}
                          </p>
                          <p className="text-[11px] text-neutral-300 truncate">
                            @{snippet?.channelTitle}
                          </p>
                          {item.statistics?.viewCount && (
                            <p className="text-[10px] text-neutral-400 font-medium">
                              {formatViewCount(item.statistics.viewCount)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Load More Button (XeroxYT-NTv6) */}
              {nextPageToken && (
                <div className="text-center pt-4 pb-8">
                  <button
                    type="button"
                    onClick={loadMoreShorts}
                    disabled={loadingMore}
                    className="px-6 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-full border border-neutral-700 transition-all cursor-pointer shadow-md disabled:opacity-50"
                  >
                    {loadingMore ? 'ショート動画を読み込み中...' : 'さらにショート動画を読み込む'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        /* 
          ====================================================
          MODE B: FULLSCREEN VERTICAL PLAYER
          ====================================================
        */
        <div
          className="w-full h-[calc(100vh-64px)] bg-neutral-950 flex flex-col items-center justify-center p-0 sm:p-4 select-none relative overflow-hidden"
        >
          {/* Main Stage & PC Navigation Wrapper */}
          <div className="flex items-center justify-center gap-4 sm:gap-6 w-full max-w-5xl h-full">
            {/* Main Smartphone Stage Container with XeroxYT-NTv6 Wheel & Touch Gestures */}
            <div
              ref={stageContainerRef}
              onWheel={handleWheel}
              className="relative w-full max-w-md h-[calc(100vh-64px)] sm:h-[88vh] max-h-[840px] sm:rounded-2xl overflow-hidden bg-black shadow-2xl flex flex-col justify-between border border-neutral-800/80 shrink-0 select-none"
              style={{ touchAction: 'none' }}
            >

            {/* TOP OVERLAY BAR */}
            <div className="absolute top-0 left-0 right-0 z-40 p-3 bg-gradient-to-b from-black/90 via-black/50 to-transparent flex items-center justify-between pointer-events-auto">
              {/* Back button returns to Shorts Grid List View */}
              <button
                onClick={handleClosePlayer}
                className="p-2.5 rounded-full bg-neutral-900/90 hover:bg-black text-white border border-neutral-700/80 shadow-xl backdrop-blur-md transition-all active:scale-95 cursor-pointer"
                title="一覧に戻る"
                id="shorts-player-back-grid-btn"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              {/* Search Toggle inside Player */}
              {isPlayerSearchOpen ? (
                <div className="flex-1 mx-2 flex flex-col gap-2">
                  <form
                    onSubmit={handlePlayerSearchSubmit}
                    className="flex items-center gap-1.5 bg-neutral-900/95 border border-neutral-600 rounded-full px-3 py-1.5 shadow-2xl backdrop-blur"
                  >
                    <Search className="w-4 h-4 text-neutral-300 shrink-0" />
                    <input
                      type="text"
                      value={playerSearchInput}
                      onChange={(e) => setPlayerSearchInput(e.target.value)}
                      placeholder="ショート動画を検索..."
                      className="w-full bg-transparent text-xs text-white placeholder-neutral-400 focus:outline-none"
                      autoFocus
                    />
                    {playerSearchInput && (
                      <button
                        type="button"
                        onClick={() => setPlayerSearchInput('')}
                        className="text-neutral-400 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="submit"
                      className="text-xs font-bold text-rose-500 hover:text-rose-400 px-1 shrink-0"
                    >
                      検索
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsPlayerSearchOpen(false)}
                      className="text-neutral-400 hover:text-white ml-1 shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {searchQuery && (
                    <div className="px-2.5 py-1 bg-rose-600/40 border border-rose-500/60 rounded-full text-[10px] font-bold text-white flex items-center gap-1 backdrop-blur shadow-sm">
                      <span>「{searchQuery}」</span>
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setSearchInput('');
                        }}
                        className="hover:text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  <span className="hidden md:inline-block px-2.5 py-1 rounded-full bg-neutral-900/85 text-[10px] font-semibold text-neutral-200 border border-neutral-700/80 backdrop-blur shadow-md">
                    ↑/↓ (J/K) : 移動 | L : 高評価 | C : コメント
                  </span>

                  {/* Top Direct Play/Pause Button */}
                  <button
                    type="button"
                    onClick={handleTogglePlayPause}
                    className="p-2.5 rounded-full bg-neutral-900/90 hover:bg-black text-white border border-neutral-700/80 shadow-xl backdrop-blur-md transition-all active:scale-95 cursor-pointer"
                    title={isPaused ? '再生' : '一時停止'}
                    aria-label={isPaused ? '再生' : '一時停止'}
                    id="shorts-top-playpause-btn"
                  >
                    {isPaused ? <Play className="w-5 h-5 fill-white ml-0.5" /> : <Pause className="w-5 h-5 fill-white" />}
                  </button>

                  <button
                    onClick={() => {
                      setIsPlayerSearchOpen(true);
                      setPlayerSearchInput(searchQuery);
                    }}
                    className="p-2.5 rounded-full bg-neutral-900/90 hover:bg-black text-white border border-neutral-700/80 shadow-xl backdrop-blur-md transition-all active:scale-95 cursor-pointer"
                    title="ショート動画を検索"
                  >
                    <Search className="w-5 h-5" />
                  </button>

                  <div className="relative">
                    <button
                      onClick={() => setShowMoreMenu(!showMoreMenu)}
                      className="p-2.5 rounded-full bg-neutral-900/90 hover:bg-black text-white border border-neutral-700/80 shadow-xl backdrop-blur-md transition-all active:scale-95 cursor-pointer"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>

                    {showMoreMenu && (
                      <div className="absolute right-0 top-10 w-52 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl p-2 text-xs text-neutral-200 z-50 space-y-1">
                        <div className="px-3 py-1 text-[10px] font-bold text-neutral-400 border-b border-neutral-800">
                          再生モード切替
                        </div>
                        <button
                          onClick={() => {
                            onTogglePlaybackMode('education');
                            setShowMoreMenu(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 hover:bg-neutral-800 rounded-lg flex items-center justify-between ${
                            playbackMode === 'education' || playbackMode === 'standard' ? 'text-emerald-400 font-bold' : ''
                          }`}
                        >
                          <span>Edu 埋め込み</span>
                          {(playbackMode === 'education' || playbackMode === 'standard') && <Check className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => {
                            onTogglePlaybackMode('nocookie');
                            setShowMoreMenu(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 hover:bg-neutral-800 rounded-lg flex items-center justify-between ${
                            playbackMode === 'nocookie' ? 'text-blue-400 font-bold' : ''
                          }`}
                        >
                          <span>NoCookie 埋め込み</span>
                          {playbackMode === 'nocookie' && <Check className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => {
                            onTogglePlaybackMode('tube613');
                            setShowMoreMenu(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 hover:bg-neutral-800 rounded-lg flex items-center justify-between ${
                            playbackMode === 'tube613' ? 'text-emerald-400 font-bold' : ''
                          }`}
                        >
                          <span>セーフ埋め込み (広告なし)</span>
                          {playbackMode === 'tube613' && <Check className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => {
                            onTogglePlaybackMode('stream-normal');
                            setShowMoreMenu(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 hover:bg-neutral-800 rounded-lg flex items-center justify-between ${
                            playbackMode === 'stream-normal' ? 'text-purple-400 font-bold' : ''
                          }`}
                        >
                          <span>ストリーム直接再生</span>
                          {playbackMode === 'stream-normal' && <Check className="w-3.5 h-3.5" />}
                        </button>
                        <div className="border-t border-neutral-800 my-1" />
                        <button
                          onClick={() => {
                            handleShare();
                            setShowMoreMenu(false);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-neutral-800 rounded-lg flex items-center gap-2"
                        >
                          <CornerUpRight className="w-3.5 h-3.5" />
                          <span>リンクをコピー</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* VIDEO PLAYER */}
            {activeShort && activeVideoId ? (
              <div className="w-full h-full relative bg-black select-none">
                <EducationPlayer
                  key={activeVideoId || `short-${selectedIndex}`}
                  videoId={activeVideoId}
                  title={activeSnippet?.title}
                  playbackMode={playbackMode}
                  onTogglePlaybackMode={onTogglePlaybackMode}
                  onEnded={handleNextShort}
                  startTime={shortStartTime}
                  seekTrigger={shortSeekTrigger}
                  isShort={true}
                  onSwipeNext={handleNextShort}
                  onSwipePrev={handlePrevShort}
                  className="w-full h-full"
                />

                {/* Transparent Gesture Swipe & Tap Layer */}
                <div
                  ref={gestureLayerRef}
                  className="absolute inset-0 z-20 cursor-pointer select-none"
                  style={{ touchAction: 'none' }}
                  onWheel={handleWheel}
                />

                {/* Persistent Big Play Button Overlay when Paused */}
                {isPaused && (
                  <div className="absolute inset-0 z-25 flex items-center justify-center pointer-events-none animate-in fade-in zoom-in-90 duration-150">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePlayPause();
                      }}
                      className="w-20 h-20 rounded-full bg-black/80 hover:bg-black/95 active:scale-90 text-white backdrop-blur-md border-2 border-white/40 flex items-center justify-center shadow-2xl transition-all cursor-pointer pointer-events-auto group focus:outline-none focus:ring-4 focus:ring-rose-500/50"
                      title="再生"
                      aria-label="再生"
                      id="shorts-center-play-btn"
                    >
                      <Play className="w-10 h-10 text-white fill-white ml-1 group-hover:scale-110 transition-transform" />
                    </button>
                  </div>
                )}

                {/* Animated Play/Pause Feedback Icon on tap */}
                {showPlayPauseFeedback !== null && (
                  <div className="absolute inset-0 z-25 pointer-events-none flex items-center justify-center animate-fade-in">
                    <div className="w-16 h-16 rounded-full bg-black/70 backdrop-blur-md border border-white/25 flex items-center justify-center shadow-2xl scale-110 transition-transform">
                      {showPlayPauseFeedback ? (
                        <Pause className="w-8 h-8 text-white fill-white" />
                      ) : (
                        <Play className="w-8 h-8 text-white fill-white ml-0.5" />
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-full bg-neutral-950 flex flex-col items-center justify-center p-6 text-center">
                <Zap className="w-10 h-10 text-neutral-600 mb-2" />
                <p className="text-xs text-neutral-300">動画情報を取得できませんでした。</p>
              </div>
            )}

            {/* BOTTOM LEFT OVERLAY (Protected Dark Card for White Backgrounds) */}
            {activeShort && (
              <div className="absolute bottom-10 left-3 z-30 pointer-events-none text-left max-w-[calc(100%-84px)]">
                <div className="p-3 rounded-2xl bg-neutral-950/85 backdrop-blur-md border border-neutral-800/90 shadow-2xl space-y-2 pointer-events-auto">
                  {/* Channel & Subscribe */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => activeChannelId && onSelectChannel(activeChannelId)}
                      className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center shrink-0 overflow-hidden shadow-md"
                    >
                      <User className="w-4 h-4 text-neutral-300" />
                    </button>
                    <span
                      onClick={() => activeChannelId && onSelectChannel(activeChannelId)}
                      className="text-xs font-bold text-white hover:underline cursor-pointer truncate drop-shadow-sm max-w-[140px]"
                    >
                      @{activeSnippet?.channelTitle?.toLowerCase().replace(/\s+/g, '') || activeSnippet?.channelTitle}
                    </span>

                    <button
                      onClick={() => toggleSubscribe(activeChannelId)}
                      className={`px-3.5 py-1 rounded-full text-[11px] font-black transition-all shadow-md cursor-pointer ${
                        subscribedChannels[activeChannelId || '']
                          ? 'bg-neutral-800 text-neutral-300 border border-neutral-700 hover:bg-neutral-700'
                          : 'bg-red-600 hover:bg-red-700 text-white border border-red-500 active:scale-95'
                      }`}
                    >
                      {subscribedChannels[activeChannelId || ''] ? '登録済み' : 'チャンネル登録'}
                    </button>
                  </div>

                  {/* Title */}
                  <p
                    onClick={() => setIsInfoOpen(true)}
                    className="text-xs font-semibold text-white line-clamp-2 leading-snug cursor-pointer hover:text-rose-300 transition-colors drop-shadow-sm"
                    title="クリックして概要欄・タイムスタンプを表示"
                  >
                    {activeSnippet?.title}
                  </p>

                  {/* Sound / Music Track Banner */}
                  <div className="flex items-center gap-1.5 text-neutral-300 text-[11px] font-medium max-w-[260px]">
                    <Music className="w-3.5 h-3.5 text-rose-400 shrink-0 animate-pulse" />
                    <span className="truncate">
                      オリジナル音源 - {activeSnippet?.channelTitle || 'YouTube Shorts'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* RIGHT ACTION BUTTONS (High-Contrast Buttons & Labels for White Backgrounds) */}
            {activeShort && (
              <div className="absolute right-2.5 bottom-10 z-30 flex flex-col items-center gap-3 text-white pointer-events-auto">
                {/* Direct Play / Pause Action Button */}
                <button
                  type="button"
                  onClick={handleTogglePlayPause}
                  className="flex flex-col items-center gap-1 group cursor-pointer"
                  title={isPaused ? '再生' : '一時停止'}
                  id="shorts-action-playpause-btn"
                >
                  <div
                    className={`p-3 rounded-full backdrop-blur-md transition-all active:scale-95 shadow-xl ${
                      isPaused
                        ? 'bg-rose-600 text-white shadow-rose-600/50 scale-105 border border-rose-500 animate-pulse'
                        : 'bg-neutral-900/90 hover:bg-black text-white border border-neutral-700/90'
                    }`}
                  >
                    {isPaused ? (
                      <Play className="w-5 h-5 fill-white ml-0.5" />
                    ) : (
                      <Pause className="w-5 h-5 fill-white" />
                    )}
                  </div>
                  <span className="text-[10px] font-black text-white bg-neutral-950/90 px-2 py-0.5 rounded-full border border-neutral-800 shadow-md backdrop-blur-xs">
                    {isPaused ? '再生' : '一時停止'}
                  </span>
                </button>

                {/* Like Button */}
                <button
                  onClick={() => {
                    setIsLiked(!isLiked);
                    if (!isLiked) setIsDisliked(false);
                  }}
                  className="flex flex-col items-center gap-1 group cursor-pointer"
                >
                  <div
                    className={`p-3 rounded-full backdrop-blur-md transition-all active:scale-95 shadow-xl ${
                      isLiked
                        ? 'bg-rose-600 text-white shadow-rose-600/50 scale-105 border border-rose-500'
                        : 'bg-neutral-900/90 hover:bg-black text-white border border-neutral-700/90'
                    }`}
                  >
                    <ThumbsUp className={`w-5 h-5 ${isLiked ? 'fill-white' : ''}`} />
                  </div>
                  <span className="text-[10px] font-black text-white bg-neutral-950/90 px-2 py-0.5 rounded-full border border-neutral-800 shadow-md backdrop-blur-xs">
                    {activeShort.statistics?.likeCount
                      ? formatViewCount(activeShort.statistics.likeCount).replace(' 回視聴', '')
                      : '8.2万'}
                  </span>
                </button>

                {/* Dislike Button */}
                <button
                  onClick={() => {
                    setIsDisliked(!isDisliked);
                    if (!isDisliked) setIsLiked(false);
                  }}
                  className="flex flex-col items-center gap-1 group cursor-pointer"
                >
                  <div
                    className={`p-3 rounded-full backdrop-blur-md transition-all active:scale-95 shadow-xl ${
                      isDisliked
                        ? 'bg-neutral-800 text-white shadow-neutral-800/50 scale-105 border border-neutral-600'
                        : 'bg-neutral-900/90 hover:bg-black text-white border border-neutral-700/90'
                    }`}
                  >
                    <ThumbsDown className={`w-5 h-5 ${isDisliked ? 'fill-white' : ''}`} />
                  </div>
                  <span className="text-[10px] font-black text-white bg-neutral-950/90 px-2 py-0.5 rounded-full border border-neutral-800 shadow-md backdrop-blur-xs">
                    低評価
                  </span>
                </button>

                {/* Comments Button */}
                <button
                  onClick={() => setIsCommentsOpen(!isCommentsOpen)}
                  className="flex flex-col items-center gap-1 group cursor-pointer"
                >
                  <div className="p-3 rounded-full bg-neutral-900/90 hover:bg-black text-white border border-neutral-700/90 shadow-xl backdrop-blur-md transition-all active:scale-95">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-black text-white bg-neutral-950/90 px-2 py-0.5 rounded-full border border-neutral-800 shadow-md backdrop-blur-xs">
                    {activeShort.statistics?.commentCount
                      ? formatViewCount(activeShort.statistics.commentCount).replace(' 回視聴', '')
                      : `${commentsList.length || '1,216'}`}
                  </span>
                </button>

                {/* Share Button */}
                <button onClick={handleShare} className="flex flex-col items-center gap-1 group cursor-pointer">
                  <div className="p-3 rounded-full bg-neutral-900/90 hover:bg-black text-white border border-neutral-700/90 shadow-xl backdrop-blur-md transition-all active:scale-95">
                    {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Share2 className="w-5 h-5" />}
                  </div>
                  <span className="text-[10px] font-black text-white bg-neutral-950/90 px-2 py-0.5 rounded-full border border-neutral-800 shadow-md backdrop-blur-xs">
                    {copied ? '完了' : '共有'}
                  </span>
                </button>

                {/* Remix Button */}
                <button
                  onClick={handleShare}
                  className="flex flex-col items-center gap-1 group cursor-pointer"
                >
                  <div className="p-3 rounded-full bg-neutral-900/90 hover:bg-black text-white border border-neutral-700/90 shadow-xl backdrop-blur-md transition-all active:scale-95">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-black text-white bg-neutral-950/90 px-2 py-0.5 rounded-full border border-neutral-800 shadow-md backdrop-blur-xs">
                    リミックス
                  </span>
                </button>


                {/* Sound Disk Icon (Spinning Vinyl) */}
                <div className="mt-1 w-9 h-9 rounded-full bg-neutral-900 border-2 border-neutral-700 p-0.5 overflow-hidden animate-[spin_4s_linear_infinite] shadow-xl flex items-center justify-center cursor-pointer">
                  <div className="w-full h-full rounded-full bg-gradient-to-tr from-neutral-800 via-neutral-700 to-neutral-900 border border-neutral-600 flex items-center justify-center relative">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-600 border border-white/80 shadow-xs" />
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Progress Bar Accent */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-neutral-800 z-30">
              <div className="h-full bg-rose-600 animate-pulse w-2/3" />
            </div>

            {/* COMMENTS DRAWER */}
            {isCommentsOpen && (
              <div className="absolute inset-x-0 bottom-0 top-1/3 z-50 bg-neutral-900/98 rounded-t-2xl border-t border-neutral-700 p-4 flex flex-col justify-between shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom duration-200">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>コメント</span>
                    <span className="text-xs text-neutral-400 font-normal">
                      ({commentsList.length}件)
                    </span>
                  </h3>
                  <button
                    onClick={() => setIsCommentsOpen(false)}
                    className="p-1 text-neutral-400 hover:text-white rounded-full"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto py-3 space-y-3.5 text-xs text-neutral-200 scrollbar-thin">
                  {commentsLoading ? (
                    <div className="py-8 text-center text-neutral-400 space-y-2">
                      <div className="w-5 h-5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto" />
                      <p>コメントを読み込み中...</p>
                    </div>
                  ) : commentsList.length === 0 ? (
                    <p className="py-8 text-center text-neutral-500">コメントはまだありません。</p>
                  ) : (
                    commentsList.map((c: any) => {
                      const commSnip = c.snippet?.topLevelComment?.snippet || c.snippet || {};
                      const commentBody = cleanCommentText(commSnip.textOriginal, commSnip.textDisplay);
                      return (
                        <div key={c.id} className="flex gap-2.5">
                          <AuthorAvatar
                            src={commSnip.authorProfileImageUrl}
                            name={commSnip.authorDisplayName}
                            size="sm"
                          />
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-semibold text-neutral-200 truncate mr-2">
                                {commSnip.authorDisplayName}
                              </span>
                              <span className="text-neutral-500 text-[10px] shrink-0">
                                {formatPublishedAt(commSnip.publishedAt)}
                              </span>
                            </div>
                            <div className="text-neutral-300 leading-snug whitespace-pre-line break-words">
                              {commentBody ? renderTextWithTimestamps(commentBody) : 'コメント内容がありません'}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <form onSubmit={handleAddComment} className="pt-2.5 border-t border-neutral-800 flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-neutral-700 overflow-hidden shrink-0 border border-neutral-600">
                    <img
                      src={(() => {
                        try {
                          const u = localStorage.getItem('google_auth_user');
                          if (u) return JSON.parse(u).picture || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80';
                        } catch {}
                        return 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80';
                      })()}
                      alt="User"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <input
                    type="text"
                    value={newCommentInput}
                    onChange={(e) => setNewCommentInput(e.target.value)}
                    placeholder="コメントを追加..."
                    className="flex-1 bg-neutral-800 border border-neutral-700 rounded-full px-3.5 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={!newCommentInput.trim()}
                    className="p-2 bg-white text-black hover:bg-neutral-200 disabled:opacity-30 disabled:hover:bg-white rounded-full transition-all shrink-0 cursor-pointer shadow-md"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}

            {/* DESCRIPTION / INFO DRAWER */}
            {isInfoOpen && activeShort && (
              <div className="absolute inset-x-0 bottom-0 top-1/3 z-50 bg-neutral-900/98 rounded-t-2xl border-t border-neutral-700 p-4 flex flex-col justify-between shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom duration-200">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>概要欄・動画情報</span>
                  </h3>
                  <button
                    onClick={() => setIsInfoOpen(false)}
                    className="p-1 text-neutral-400 hover:text-white rounded-full"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto py-3 space-y-3 text-xs text-neutral-200 scrollbar-thin">
                  <h4 className="font-bold text-white text-sm">{activeSnippet?.title}</h4>
                  <div className="text-[11px] text-neutral-400">
                    {formatViewCount(activeShort.statistics?.viewCount)} • {formatPublishedAt(activeSnippet?.publishedAt)}
                  </div>
                  <div className="whitespace-pre-line text-neutral-300 leading-relaxed pt-2 border-t border-neutral-800">
                    {activeSnippet?.description
                      ? renderTextWithTimestamps(activeSnippet.description)
                      : '概要欄のテキストはありません。'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* PC / TABLET SIDE NAVIGATION DECK */}
          <div className="hidden sm:flex flex-col items-center gap-4 z-40 shrink-0">
            {/* Up Arrow / Previous Short */}
            <button
              onClick={handlePrevShort}
              disabled={selectedIndex === 0}
              className={`group relative p-4 rounded-2xl bg-neutral-900 border border-neutral-700/90 text-white shadow-2xl transition-all duration-200 ${
                selectedIndex === 0
                  ? 'opacity-30 cursor-not-allowed border-neutral-800'
                  : 'hover:bg-rose-600 hover:border-rose-500 hover:scale-110 active:scale-95'
              }`}
              title="前のショート動画 (↑ キー)"
              id="pc-shorts-prev-btn"
            >
              <ChevronUp className="w-8 h-8" />
              <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-neutral-900/95 border border-neutral-700 text-white text-[11px] font-bold rounded-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl z-50">
                前の動画 [↑]
              </span>
            </button>

            {/* Counter Badge */}
            <div className="px-3.5 py-2.5 rounded-2xl bg-neutral-900/90 border border-neutral-800 text-center shadow-2xl min-w-[90px]">
              <div className="text-[9px] font-black text-rose-500 tracking-wider">
                SHORTS
              </div>
              <div className="text-white font-black text-base mt-0.5">
                {(selectedIndex ?? 0) + 1}
                <span className="text-neutral-500 text-xs font-normal"> / {shorts.length}</span>
              </div>
            </div>

            {/* Down Arrow / Next Short */}
            <button
              onClick={handleNextShort}
              disabled={selectedIndex === shorts.length - 1}
              className={`group relative p-4 rounded-2xl bg-neutral-900 border border-neutral-700/90 text-white shadow-2xl transition-all duration-200 ${
                selectedIndex === shorts.length - 1
                  ? 'opacity-30 cursor-not-allowed border-neutral-800'
                  : 'hover:bg-rose-600 hover:border-rose-500 hover:scale-110 active:scale-95'
              }`}
              title="次のショート動画 (↓ キー)"
              id="pc-shorts-next-btn"
            >
              <ChevronDown className="w-8 h-8" />
              <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-neutral-900/95 border border-neutral-700 text-white text-[11px] font-bold rounded-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl z-50">
                次の動画 [↓]
              </span>
            </button>

            {/* Navigation Tip Badge */}
            <div className="mt-2 px-3 py-2.5 rounded-2xl bg-neutral-900/80 border border-neutral-800 text-[10px] text-neutral-400 text-center space-y-1 max-w-[130px] shadow-xl">
              <div className="text-rose-400 font-bold flex items-center justify-center gap-1">
                <span>ショート切り替え</span>
              </div>
              <div className="text-neutral-200 font-semibold">↑ ↓ キー / ボタン</div>
              <div className="text-[9px] text-neutral-500">ボタンで次の動画へ</div>
            </div>
          </div>
        </div>
      </div>
    )}
    </div>
  );
};
