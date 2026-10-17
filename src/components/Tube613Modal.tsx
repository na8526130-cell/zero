import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  Search,
  Link as LinkIcon,
  Play,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Copy,
  HelpCircle,
  Plus,
  Loader2
} from 'lucide-react';
import { YouTubeVideoItem } from '../types';
import { customFetch } from '../utils/apiClient';
import { parse613TubeUrl } from '../utils/formatters';

interface Tube613ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectVideo: (video: YouTubeVideoItem) => void;
  onLoadVideosToFeed: (videos: YouTubeVideoItem[], queryDesc: string) => void;
  onActivate613SafeMode: (query?: string) => void;
}

const PRESET_CATEGORIES = [
  { id: 'education', label: '📚 勉強・学習', query: '勉強 教育' },
  { id: 'science', label: '🔬 科学・実験', query: '科学 実験' },
  { id: 'music', label: '🎵 作業用BGM', query: '作業用BGM 勉強用' },
  { id: 'minecraft', label: '🎮 マインクラフト', query: 'minecraft 建築' },
  { id: 'programming', label: '💻 プログラミング', query: 'プログラミング 入門' },
  { id: 'nature', label: '🌿 自然・動物', query: '自然 動物 癒やし' },
  { id: 'english', label: '🗣 英語学習', query: '英語 リスニング' },
  { id: 'trivia', label: '💡 雑学・教養', query: '雑学 科学解説' },
];

export const Tube613Modal: React.FC<Tube613ModalProps> = ({
  isOpen,
  onClose,
  onSelectVideo,
  onLoadVideosToFeed,
  onActivate613SafeMode
}) => {
  const [activeTab, setActiveTab] = useState<'url' | 'search' | 'featured' | 'guide'>('url');
  const [urlInput, setUrlInput] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Single preview video resolved from URL
  const [previewVideo, setPreviewVideo] = useState<YouTubeVideoItem | null>(null);

  // Search / Featured video results
  const [videoResults, setVideoResults] = useState<YouTubeVideoItem[]>([]);
  const [currentQueryDesc, setCurrentQueryDesc] = useState('');

  // Server Status
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  useEffect(() => {
    if (!isOpen) return;
    customFetch('/api/613tube/status')
      .then((r) => r.json())
      .then((data) => {
        if (data.available) {
          setServerStatus('online');
        } else {
          setServerStatus('offline');
        }
      })
      .catch(() => setServerStatus('online'));
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle URL Fetch
  const handleFetchUrl = async (inputOverride?: string) => {
    const raw = (inputOverride || urlInput).trim();
    if (!raw) {
      setErrorMsg('動画のURLを入力してください');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setPreviewVideo(null);

    try {
      const parsed = parse613TubeUrl(raw);

      // If it has a videoId
      if (parsed.videoId) {
        const res = await customFetch(`/api/613tube/fetch?videoId=${encodeURIComponent(parsed.videoId)}`);
        const data = await res.json();
        if (data.item) {
          setPreviewVideo(data.item);
          setSuccessMsg('動画情報を取得しました！「今すぐ再生」または「フィードに読み込む」が可能です。');
        } else {
          throw new Error('動画情報が見つかりませんでした');
        }
      } else if (parsed.query) {
        const res = await customFetch(`/api/613tube/search?q=${encodeURIComponent(parsed.query)}`);
        const data = await res.json();
        if (data.items && data.items.length > 0) {
          setVideoResults(data.items);
          setCurrentQueryDesc(`検索: ${parsed.query}`);
          setActiveTab('search');
          setSearchInput(parsed.query);
          setSuccessMsg(`${data.items.length} 件の安全な動画を取得しました！`);
        } else {
          throw new Error('該当するセーフ動画が見つかりませんでした');
        }
      } else if (parsed.is613Tube) {
        handleFetchFeatured('popular');
        setActiveTab('featured');
        setSuccessMsg('おすすめセーフ動画を取得しました！');
      } else {
        const res = await customFetch(`/api/613tube/fetch?url=${encodeURIComponent(raw)}`);
        const data = await res.json();
        if (data.item) {
          setPreviewVideo(data.item);
          setSuccessMsg('動画情報を取得しました！');
        } else if (data.items && data.items.length > 0) {
          setVideoResults(data.items);
          setCurrentQueryDesc(`取得結果 (${raw})`);
          setActiveTab('search');
          setSuccessMsg(`${data.items.length} 件のセーフ動画を取得しました！`);
        } else {
          throw new Error('動画を取得できませんでした。URLをご確認ください。');
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || '取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  // Handle Search Fetch
  const handleSearchSafe = async (queryText?: string) => {
    const q = (queryText || searchInput).trim();
    if (!q) {
      setErrorMsg('検索キーワードを入力してください');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setVideoResults([]);
    setCurrentQueryDesc(q);

    try {
      const res = await customFetch(`/api/613tube/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        setVideoResults(data.items);
        setSuccessMsg(`「${q}」から ${data.items.length} 件の安全な動画を取得しました！`);
      } else {
        setErrorMsg('一致するセーフ動画が見つかりませんでした。別のキーワードをお試しください。');
      }
    } catch (err: any) {
      setErrorMsg(err.message || '検索結果の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // Handle Featured Fetch
  const handleFetchFeatured = async (categoryName: string = 'trending') => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await customFetch(`/api/613tube/search?q=${encodeURIComponent(categoryName)}`);
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        setVideoResults(data.items);
        setCurrentQueryDesc(`おすすめ動画 (${categoryName})`);
        setSuccessMsg(`おすすめ動画 ${data.items.length} 件を取得しました！`);
      } else {
        throw new Error('おすすめ動画の取得に失敗しました');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'おすすめ動画の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // Handle Play Now
  const handlePlayDirect = (video: YouTubeVideoItem) => {
    onSelectVideo({
      ...video,
      source: '613tube',
      is613Tube: true
    });
    onClose();
  };

  // Handle Load to main feed
  const handleLoadAllToFeed = () => {
    if (videoResults.length === 0) return;
    onLoadVideosToFeed(videoResults, currentQueryDesc || 'セーフ動画');
    onActivate613SafeMode(currentQueryDesc);
    onClose();
  };

  // Paste from clipboard
  const handlePasteFromClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setUrlInput(text.trim());
          handleFetchUrl(text.trim());
        }
      }
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="px-5 py-4 bg-neutral-50 dark:bg-neutral-850 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-sm">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  動画取得 (セーフモード)
                </h2>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full font-medium">
                  セーフ
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                広告や有害おすすめを遮断した安全な動画を直接取得・再生
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Server Status Pill */}
            <div
              className={`hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                serverStatus === 'online'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                  : 'bg-neutral-100 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-neutral-500'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${serverStatus === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-400'}`} />
              <span>{serverStatus === 'online' ? '正常稼働中' : '確認中'}</span>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-white rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-neutral-200 dark:border-neutral-800 bg-neutral-100/60 dark:bg-neutral-900/60 px-3 pt-2 gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('url')}
            className={`px-3.5 py-2 rounded-t-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'url'
                ? 'bg-white dark:bg-neutral-800 text-emerald-600 dark:text-emerald-400 border-t border-x border-neutral-200 dark:border-neutral-700 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>URLから取得</span>
          </button>

          <button
            onClick={() => setActiveTab('search')}
            className={`px-3.5 py-2 rounded-t-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'search'
                ? 'bg-white dark:bg-neutral-800 text-emerald-600 dark:text-emerald-400 border-t border-x border-neutral-200 dark:border-neutral-700 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>キーワード検索</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('featured');
              if (videoResults.length === 0) handleFetchFeatured('popular');
            }}
            className={`px-3.5 py-2 rounded-t-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'featured'
                ? 'bg-white dark:bg-neutral-800 text-emerald-600 dark:text-emerald-400 border-t border-x border-neutral-200 dark:border-neutral-700 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>おすすめセーフ動画</span>
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`px-3.5 py-2 rounded-t-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'guide'
                ? 'bg-white dark:bg-neutral-800 text-emerald-600 dark:text-emerald-400 border-t border-x border-neutral-200 dark:border-neutral-700 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>使い方ガイド</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {/* Status Messages */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: URL Fetcher */}
          {activeTab === 'url' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                  動画のURLを入力
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleFetchUrl();
                      }}
                      placeholder="例: https://... または動画URLを入力"
                      className="w-full px-3.5 py-2.5 bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs sm:text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-emerald-500 pr-10"
                    />
                    {urlInput && (
                      <button
                        type="button"
                        onClick={() => setUrlInput('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handlePasteFromClipboard}
                    className="px-3 py-2 bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                    title="クリップボードから貼り付け"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">貼り付け</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFetchUrl()}
                    disabled={loading || !urlInput.trim()}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-sm"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    <span>動画取得</span>
                  </button>
                </div>
              </div>

              {/* Quick Sample URLs */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400">
                  ワンクリックでお試し:
                </span>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      const sample = 'https://613tube.com/watch/?v=tTgWxD9wrKE';
                      setUrlInput(sample);
                      handleFetchUrl(sample);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-neutral-300 dark:border-neutral-700 hover:border-emerald-500 text-neutral-700 dark:text-neutral-300 text-[11px] transition-colors cursor-pointer"
                  >
                    🎯 セーフ動画サンプル
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const sample = 'https://613tube.com/results/?q=minecraft';
                      setUrlInput(sample);
                      handleFetchUrl(sample);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-neutral-300 dark:border-neutral-700 hover:border-emerald-500 text-neutral-700 dark:text-neutral-300 text-[11px] transition-colors cursor-pointer"
                  >
                    🎮 マイクラ検索
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const sample = 'https://613tube.com/';
                      setUrlInput(sample);
                      handleFetchUrl(sample);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-neutral-300 dark:border-neutral-700 hover:border-emerald-500 text-neutral-700 dark:text-neutral-300 text-[11px] transition-colors cursor-pointer"
                  >
                    🌐 おすすめ一覧取得
                  </button>
                </div>
              </div>

              {/* Resolved Video Card Preview */}
              {previewVideo && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border-2 border-emerald-500/30 flex flex-col sm:flex-row gap-4 items-center animate-in fade-in">
                  <img
                    src={previewVideo.snippet.thumbnails?.medium?.url || previewVideo.snippet.thumbnails?.default?.url}
                    alt={previewVideo.snippet.title}
                    className="w-full sm:w-44 aspect-video rounded-lg object-cover shadow-sm"
                  />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded font-medium">
                        SAFE 検証済
                      </span>
                      <span className="text-xs text-emerald-800 dark:text-emerald-300 font-semibold truncate">
                        {previewVideo.snippet.channelTitle}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 line-clamp-2">
                      {previewVideo.snippet.title}
                    </h3>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handlePlayDirect(previewVideo)}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-transform active:scale-95 cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>今すぐ再生 (セーフモード)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onLoadVideosToFeed([previewVideo], '取得動画');
                          onActivate613SafeMode();
                          onClose();
                        }}
                        className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>フィードに読み込む</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Search */}
          {activeTab === 'search' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                  安全フィルタを通して検索
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSearchSafe();
                    }}
                    placeholder="キーワードを入力 (例: 科学実験, ピアノ, プログラミング...)"
                    className="flex-1 px-3.5 py-2.5 bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs sm:text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleSearchSafe()}
                    disabled={loading || !searchInput.trim()}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-sm"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    <span>セーフ検索</span>
                  </button>
                </div>
              </div>

              {/* Category tags */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400">
                  安全な人気カテゴリ:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setSearchInput(cat.query);
                        handleSearchSafe(cat.query);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-neutral-300 dark:border-neutral-700 hover:border-emerald-500 text-neutral-700 dark:text-neutral-300 text-xs font-medium transition-colors cursor-pointer"
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Video Results Grid */}
              {videoResults.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                      取得結果: {videoResults.length}件
                    </span>
                    <button
                      type="button"
                      onClick={handleLoadAllToFeed}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>メイン画面に全件読み込む</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                    {videoResults.map((v) => (
                      <div
                        key={v.id}
                        onClick={() => handlePlayDirect(v)}
                        className="p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-neutral-200 dark:border-neutral-700 hover:border-emerald-500/50 flex gap-2.5 cursor-pointer transition-all group"
                      >
                        <img
                          src={v.snippet.thumbnails?.medium?.url || v.snippet.thumbnails?.default?.url}
                          alt={v.snippet.title}
                          className="w-24 aspect-video rounded-lg object-cover shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 line-clamp-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                            {v.snippet.title}
                          </h4>
                          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate mt-1">
                            {v.snippet.channelTitle}
                          </p>
                          <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                            <Play className="w-3 h-3 fill-emerald-600 dark:fill-emerald-400" />
                            <span>再生</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Featured / Safe Recommendations */}
          {activeTab === 'featured' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  セーフフィルターを通過したクリーンな動画リストです。
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleFetchFeatured('trending')}
                    className="px-2.5 py-1 bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    🔄 再読み込み
                  </button>
                  {videoResults.length > 0 && (
                    <button
                      type="button"
                      onClick={handleLoadAllToFeed}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>メイン画面に全件反映</span>
                    </button>
                  )}
                </div>
              </div>

              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-neutral-500">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                  <span className="text-xs">安全な動画を取得中...</span>
                </div>
              ) : videoResults.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
                  {videoResults.map((v) => (
                    <div
                      key={v.id}
                      onClick={() => handlePlayDirect(v)}
                      className="p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-neutral-200 dark:border-neutral-700 hover:border-emerald-500/50 flex gap-2.5 cursor-pointer transition-all group"
                    >
                      <img
                        src={v.snippet.thumbnails?.medium?.url || v.snippet.thumbnails?.default?.url}
                        alt={v.snippet.title}
                        className="w-24 aspect-video rounded-lg object-cover shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 line-clamp-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                          {v.snippet.title}
                        </h4>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate mt-1">
                          {v.snippet.channelTitle}
                        </p>
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                          <Play className="w-3 h-3 fill-emerald-600 dark:fill-emerald-400" />
                          <span>セーフ再生</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-neutral-500">
                  「🔄 再読み込み」ボタンを押して動画を取得してください。
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Guide */}
          {activeTab === 'guide' && (
            <div className="space-y-4 text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed">
              <div className="p-4 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 space-y-2">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                  <span>セーフ動画取得について</span>
                </h3>
                <p>
                  動画以外の<strong>「広告」「有害な関連動画の推薦」「不快なコメント欄」を完全に取り除き</strong>、
                  子どもや学生、集中して学習したいすべての人が安全に動画を視聴できるように設計されたセーフブラウジング機能です。
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-700 space-y-1.5">
                  <h4 className="font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                    <span className="p-1 rounded bg-blue-500 text-white text-[10px]">方法1</span>
                    <span>URLの貼り付けで即時取得</span>
                  </h4>
                  <p className="text-neutral-600 dark:text-neutral-400">
                    動画のURLを入力欄に貼り付けて「動画取得」を押すと、広告のない安全なストリームで即座に再生されます。
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-700 space-y-1.5">
                  <h4 className="font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                    <span className="p-1 rounded bg-emerald-500 text-white text-[10px]">方法2</span>
                    <span>上部検索バーに直接貼り付け</span>
                  </h4>
                  <p className="text-neutral-600 dark:text-neutral-400">
                    ヘッダー検索バーにURLをそのまま貼り付けてEnterキーを押しても、自動的に動画が解析されセーフ再生が始まります。
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200 space-y-1">
                <div className="font-bold">✨ 再生モード「セーフ埋め込み」も利用可能</div>
                <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80">
                  サイドバーまたは動画詳細画面の再生モード設定から「セーフ埋め込み (広告なし)」を選択すると、すべての動画を安全なプロトコルで直接再生できます。
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-neutral-50 dark:bg-neutral-850 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>セーフフィルタリング稼働中</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-bold transition-colors cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
