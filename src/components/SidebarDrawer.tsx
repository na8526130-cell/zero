import React from 'react';
import {
  X,
  Play,
  Flame,
  Zap,
  LayoutGrid,
  Rss,
  Users,
  Bookmark,
  GraduationCap,
  Waves,
  Film,
  Music,
  Tv,
  LogOut,
  User,
  ShieldCheck,
  Globe
} from 'lucide-react';
import { PlaybackMode } from '../types';
import { GoogleUser } from '../utils/googleAuth';

interface SidebarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  onChangeTab: (tab: string) => void;
  playbackMode: PlaybackMode;
  onTogglePlaybackMode: (mode: PlaybackMode) => void;
  savedCount: number;
  onOpenSettingsModal: () => void;
  onOpenLoginModal: () => void;
  onOpen613TubeModal?: () => void;
  currentUser: GoogleUser | null;
  onSignOut: () => void;
}

export const SidebarDrawer: React.FC<SidebarDrawerProps> = ({
  isOpen,
  onClose,
  activeTab,
  onChangeTab,
  playbackMode,
  onTogglePlaybackMode,
  savedCount,
  onOpenSettingsModal,
  onOpenLoginModal,
  onOpen613TubeModal,
  currentUser,
  onSignOut
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer content */}
      <div className="relative w-72 max-w-[80vw] h-full bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-2xl flex flex-col z-10 border-r border-neutral-200 dark:border-neutral-800 animate-slide-right">
        {/* Top Header */}
        <div className="p-4 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2.5">
            {/* Colorful Pinwheel / Fan Icon from mock */}
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-rose-500 via-amber-400 to-emerald-400 p-0.5 shadow-sm flex items-center justify-center">
              <div className="w-full h-full bg-white dark:bg-neutral-900 rounded-[6px] flex items-center justify-center">
                <span className="text-base font-black bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500 bg-clip-text text-transparent">
                  Z
                </span>
              </div>
            </div>
            <span className="font-extrabold text-lg tracking-tight">
              ZERO<span className="text-rose-500">-tube</span>
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Card */}
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40">
          {currentUser ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={currentUser.picture}
                  alt={currentUser.name}
                  className="w-9 h-9 rounded-full border border-neutral-300 dark:border-neutral-700 object-cover"
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">{currentUser.name}</div>
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                    {currentUser.email}
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  onSignOut();
                  onClose();
                }}
                title="ログアウト"
                className="p-1.5 text-neutral-400 hover:text-rose-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                onOpenLoginModal();
                onClose();
              }}
              className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
            >
              <User className="w-4 h-4" />
              <span>Google でログイン</span>
            </button>
          )}
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-6">
          {/* Main Tabs */}
          <div className="space-y-1">
            <div className="px-3 py-1 text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
              メニュー
            </div>
            <button
              onClick={() => {
                onChangeTab('home');
                onClose();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                activeTab === 'home'
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                  : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <Play className="w-4 h-4 text-rose-500" />
              <span>ホーム</span>
            </button>

            <button
              onClick={() => {
                onChangeTab('trending');
                onClose();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                activeTab === 'trending'
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                  : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <Flame className="w-4 h-4 text-amber-500" />
              <span>急上昇</span>
            </button>

            <button
              onClick={() => {
                onChangeTab('shorts');
                onClose();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                activeTab === 'shorts'
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                  : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <Zap className="w-4 h-4 text-rose-400" />
              <span>ショート</span>
            </button>

            <button
              onClick={() => {
                onChangeTab('categories');
                onClose();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                activeTab === 'categories'
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                  : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <LayoutGrid className="w-4 h-4 text-emerald-400" />
              <span>カテゴリ一覧</span>
            </button>

            <button
              onClick={() => {
                onChangeTab('channels');
                onClose();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                activeTab === 'channels'
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                  : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <Users className="w-4 h-4 text-indigo-400" />
              <span>登録チャンネル</span>
            </button>

            <button
              onClick={() => {
                onChangeTab('library');
                onClose();
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                activeTab === 'library'
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                  : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <Bookmark className="w-4 h-4 text-sky-400" />
                <span>ライブラリ</span>
              </div>
              {savedCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white">
                  {savedCount}
                </span>
              )}
            </button>

            {/* Safe Video Fetch Action */}
            <button
              onClick={() => {
                if (onOpen613TubeModal) {
                  onOpen613TubeModal();
                } else {
                  window.dispatchEvent(new CustomEvent('zero_open_613tube_modal'));
                }
                onClose();
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-emerald-500/30 cursor-pointer shadow-xs"
              title="安全な動画を取得"
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>セーフ動画取得</span>
              </div>
              <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-medium">セーフ</span>
            </button>
          </div>

          {/* YouTube Playback Mode Section */}
          <div className="space-y-1 pt-2 border-t border-neutral-200 dark:border-neutral-800">
            <div className="px-3 py-1 text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
              YouTube 再生機能
            </div>
            <button
              onClick={() => onTogglePlaybackMode('education')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                playbackMode === 'education'
                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                  : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <GraduationCap className="w-4 h-4 text-blue-500" />
                <span>Edu 埋め込み (公式教育用)</span>
              </div>
              {playbackMode === 'education' && <span className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded">選択中</span>}
            </button>

            <button
              onClick={() => onTogglePlaybackMode('stream-sync')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                playbackMode === 'stream-sync'
                  ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800'
                  : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Waves className="w-4 h-4 text-purple-500" />
                <span>高画質ストリーム (1080p同期)</span>
              </div>
              {playbackMode === 'stream-sync' && <span className="text-[10px] bg-purple-500 text-white px-1.5 py-0.5 rounded">選択中</span>}
            </button>

            <button
              onClick={() => onTogglePlaybackMode('stream-360')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                playbackMode === 'stream-360'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                  : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Film className="w-4 h-4 text-emerald-500" />
                <span>ストリーム (通常 360p)</span>
              </div>
              {playbackMode === 'stream-360' && <span className="text-[10px] bg-emerald-500 text-white px-1.5 py-0.5 rounded">選択中</span>}
            </button>

            <button
              onClick={() => onTogglePlaybackMode('tube613')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                playbackMode === 'tube613'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                  : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>セーフ埋め込み (広告なし)</span>
              </div>
              {playbackMode === 'tube613' && <span className="text-[10px] bg-emerald-500 text-white px-1.5 py-0.5 rounded">選択中</span>}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-center">
          <span className="text-[10px] text-neutral-400 font-mono">v2.0 (ZERO-tube)</span>
        </div>
      </div>
    </div>
  );
};
