import React from 'react';

interface AudioWaveProps {
  volume: number; // 0 to 100
  isSpeaking: boolean;
  isMuted?: boolean;
  color?: string;
  barsCount?: number;
}

export const AudioWave: React.FC<AudioWaveProps> = ({
  volume,
  isSpeaking,
  isMuted = false,
  color = 'from-emerald-400 to-cyan-500',
  barsCount = 8,
}) => {
  if (isMuted) {
    return (
      <div className="flex items-center gap-1 h-6">
        {Array.from({ length: barsCount }).map((_, i) => (
          <div key={i} className="w-1 h-1.5 rounded-full bg-red-500/50" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 h-7">
      {Array.from({ length: barsCount }).map((_, i) => {
        // Vary heights based on index and current volume
        const factor = Math.sin((i / (barsCount - 1)) * Math.PI);
        const dynamicHeight = isSpeaking
          ? Math.max(4, Math.round(factor * (volume * 0.28) + 4))
          : Math.max(3, Math.round(factor * 6 + 2));

        return (
          <div
            key={i}
            style={{
              height: `${dynamicHeight}px`,
              transition: 'height 0.08s ease-in-out',
            }}
            className={`w-1 rounded-full bg-gradient-to-t ${color} ${
              isSpeaking ? 'opacity-100 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'opacity-40'
            }`}
          />
        );
      })}
    </div>
  );
};
