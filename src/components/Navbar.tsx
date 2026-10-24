import React, { useState } from 'react';
import { Radio, Bot, Edit2, Check, Flame, Volume2, Database } from 'lucide-react';

interface NavbarProps {
  userName: string;
  onUpdateUserName: (name: string) => void;
  connectionStatus: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  userName,
  onUpdateUserName,
  connectionStatus,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(userName);

  const handleSaveName = () => {
    if (tempName.trim()) {
      onUpdateUserName(tempName.trim());
    }
    setIsEditingName(false);
  };

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-zinc-950/80 border-b border-zinc-800/80">
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4 min-w-0">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-600 to-red-600 shadow-[0_0_15px_rgba(249,115,22,0.4)]">
            <Flame className="w-5 h-5 text-white" />
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-zinc-950"></span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-black text-lg tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-300 to-rose-400">
                FF DUO VOICE
              </h1>
              <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-widest rounded bg-orange-500/10 text-orange-400 border border-orange-500/30">
                Live
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 hidden sm:block">
              ইউনিক রুম লাইভ ডুও ভয়েস ও চ্যাট
            </p>
          </div>
        </div>

        {/* Right User Tag & Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* User Name Tag */}
          <div className="flex items-center bg-zinc-900/90 border border-zinc-700/80 rounded-xl px-3 py-1.5 text-xs text-white">
            {isEditingName ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                  className="bg-zinc-800 px-2 py-0.5 rounded text-white text-xs w-24 sm:w-32 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  autoFocus
                />
                <button
                  onClick={handleSaveName}
                  className="p-1 text-emerald-400 hover:text-emerald-300"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-semibold max-w-[120px] sm:max-w-[160px] truncate">
                  {userName}
                </span>
                <button
                  onClick={() => {
                    setTempName(userName);
                    setIsEditingName(true);
                  }}
                  className="p-1 text-zinc-400 hover:text-white transition"
                  title="নাম পরিবর্তন করুন"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
