import React, { useState, useEffect } from 'react';

interface YouTubeLaunchSplashProps {
  onDismiss?: () => void;
  durationMs?: number;
}

export const YouTubeLaunchSplash: React.FC<YouTubeLaunchSplashProps> = ({
  onDismiss,
  durationMs = 850
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    // Check if user already saw splash in this session
    const hasLaunched = sessionStorage.getItem('yt_launch_shown_v1');
    if (hasLaunched) {
      setIsVisible(false);
      onDismiss?.();
      return;
    }

    sessionStorage.setItem('yt_launch_shown_v1', '1');

    const fadeTimer = setTimeout(() => {
      setIsFading(true);
    }, durationMs - 350);

    const endTimer = setTimeout(() => {
      setIsVisible(false);
      onDismiss?.();
    }, durationMs);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(endTimer);
    };
  }, [durationMs, onDismiss]);

  if (!isVisible) return null;

  return (
    <div
      onClick={() => {
        setIsVisible(false);
        onDismiss?.();
      }}
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0f0f0f] select-none transition-opacity duration-300 ${
        isFading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
      }}
    >
      <div className="flex flex-col items-center justify-center">
        {/* Iconic Centered YouTube Red Badge Logo */}
        <div className="flex items-center gap-3 transform transition-transform duration-500 hover:scale-105 animate-in zoom-in-95 duration-400">
          <div className="w-[72px] h-[50px] bg-[#ff0000] rounded-[16px] flex items-center justify-center shadow-[0_10px_30px_rgba(255,0,0,0.45)] relative overflow-hidden">
            {/* White play triangle */}
            <svg
              className="w-7 h-7 text-white ml-0.5 filter drop-shadow-sm"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
            {/* Gloss shine reflection */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/20 pointer-events-none" />
          </div>

          <div className="text-white text-[28px] font-black tracking-[-1.2px] flex items-baseline">
            <span>ZERO</span>
            <span className="text-[#ff0000] ml-0.5">tube</span>
          </div>
        </div>

        {/* YouTube App Subtle Red Accent Shimmer Line */}
        <div className="w-28 h-[3px] bg-white/10 rounded-full mt-8 overflow-hidden relative">
          <div className="w-1/2 h-full bg-[#ff0000] rounded-full animate-[ytLaunchShimmer_1.2s_ease-in-out_infinite]" />
        </div>
      </div>

      <style>{`
        @keyframes ytLaunchShimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
};
