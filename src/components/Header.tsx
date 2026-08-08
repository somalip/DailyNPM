import React, { useState, useEffect } from 'react';
import { Search, History, TrendingUp, Layers, Newspaper, Sun, User, LogOut, LogIn, Terminal, Key, X } from 'lucide-react';
import { POPULAR_PRESETS, getGroqApiKey, setGroqApiKey, isUsingCustomApiKey } from '../utils/npmApi';

interface HeaderProps {
  currentPackage: string;
  onSearch: (pkgName: string) => void;
  onLoadPreset: (packages: string[]) => void;
  activeTab: 'overview' | 'comparison' | 'portfolio' | 'tui';
  setActiveTab: (tab: 'overview' | 'comparison' | 'portfolio' | 'tui') => void;
  recentSearches: string[];
  user: any;
  onOpenAuth: () => void;
  onSignOut: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentPackage,
  onSearch,
  onLoadPreset,
  activeTab,
  setActiveTab,
  recentSearches,
  user,
  onOpenAuth,
  onSignOut,
}) => {
  const [inputValue, setInputValue] = useState(currentPackage);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [hasCustomKey, setHasCustomKey] = useState(false);

  useEffect(() => {
    setHasCustomKey(isUsingCustomApiKey());
    setKeyInput(isUsingCustomApiKey() ? getGroqApiKey() : '');
  }, [showKeyModal]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onSearch(inputValue.trim());
      setShowDropdown(false);
    }
  };

  const handleSelectRecent = (name: string) => {
    setInputValue(name);
    onSearch(name);
    setShowDropdown(false);
  };

  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).toUpperCase();

  return (
    <header className="sticky top-0 z-40 bg-[#F4F1EA] border-b-4 border-[#1A1918] text-[#1A1918] shadow-md">
      {/* Top Newspaper Date & Edition Bar */}
      <div className="border-b border-[#1A1918] bg-[#EAE6DF] py-1 px-4 text-[10px] font-mono-news uppercase tracking-wider flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="font-bold">VOL. CIV... NO. 302</span>
          <span>•</span>
          <span>GLOBAL WIRE SERVICE</span>
          <span>•</span>
          <span className="hidden md:inline">PRICE: FREE & OPEN SOURCE</span>
        </div>
        <div className="font-bold tracking-widest">{formattedDate}</div>
        <div className="flex items-center gap-2 text-[10px] font-mono-news">
          <Sun className="w-3 h-3 text-amber-700" />
          <span className="hidden sm:inline">FORECAST: 90% CHANCE OF NPM INSTALL</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        {/* Main Newspaper Masthead Title */}
        <div className="text-center py-2 border-b-2 border-t-2 border-[#1A1918]">
          <div className="flex items-center justify-center gap-3">
            <span className="hidden sm:inline-block h-[2px] bg-[#1A1918] flex-1"></span>
            <h1 className="font-masthead text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-[#1A1918] leading-none select-none">
              The Daily NPM
            </h1>
            <span className="hidden sm:inline-block h-[2px] bg-[#1A1918] flex-1"></span>
          </div>
          <p className="font-headline italic text-xs sm:text-sm text-[#4A4744] mt-1 font-semibold tracking-wide">
            "The World's Preeminent Journal of Package Intelligence & Predictive Ecosystem Statistics" • Est. 2026
          </p>
        </div>

        {/* Action Controls & Navigation Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between py-3 gap-4 border-b border-[#1A1918]">
          
          {/* Wire Search Form */}
          <div className="relative flex-1 max-w-lg">
            <form onSubmit={handleSubmit} className="relative">
              <div className="relative flex items-center">
                <span className="absolute left-3 font-mono-news text-xs uppercase font-bold text-[#1A1918]/60 pointer-events-none select-none">
                  SEARCH WIRE:
                </span>
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="e.g. react, express, lodash, @tanstack/react-query..."
                  className="w-full bg-[#FBF9F5] text-[#1A1918] placeholder-[#7A7570] font-mono-news text-xs pl-28 pr-28 py-2 border-2 border-[#1A1918] focus:outline-none focus:bg-white shadow-[2px_2px_0px_#1A1918] transition-all"
                />
                <button
                  type="submit"
                  className="absolute right-1 top-1/2 -translate-y-1/2 bg-[#1A1918] hover:bg-[#A82424] text-white font-mono-news text-[11px] uppercase font-bold px-3 py-1.5 transition-colors flex items-center gap-1"
                >
                  <Search className="w-3 h-3" /> READ REPORT
                </button>
              </div>
            </form>

            {/* Quick Suggestions & History Dropdown */}
            {showDropdown && recentSearches.length > 0 && (
              <div
                className="absolute top-full left-0 right-0 mt-1 bg-[#FBF9F5] border-2 border-[#1A1918] shadow-[4px_4px_0px_#1A1918] z-50 p-2 text-[#1A1A18]"
                onMouseLeave={() => setShowDropdown(false)}
              >
                <div className="text-[10px] font-mono-news font-bold uppercase text-[#1A1918]/70 px-2 py-1 flex items-center justify-between border-b border-[#1A1918]/20 mb-1">
                  <span className="flex items-center gap-1">
                    <History className="w-3 h-3 text-[#1A1918]" /> RECENT TELEGRAMS & SEARCHES
                  </span>
                  <button
                    onClick={() => setShowDropdown(false)}
                    className="hover:underline text-rose-800"
                  >
                    [CLOSE]
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 p-1">
                  {recentSearches.map((item) => (
                    <button
                      key={item}
                      onClick={() => handleSelectRecent(item)}
                      className="text-xs px-2.5 py-1 bg-[#EAE6DF] hover:bg-[#1A1918] hover:text-white font-mono-news border border-[#1A1918] transition-colors"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Newspaper Sections Navigation Tabs & User Auth */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center border-2 border-[#1A1918] bg-[#EAE6DF] p-0.5">
              <button
                onClick={() => setActiveTab('overview')}
                className={`flex items-center gap-1.5 px-4 py-1.5 font-mono-news text-xs uppercase font-bold transition-all ${
                  activeTab === 'overview'
                    ? 'bg-[#1A1918] text-white shadow-sm'
                    : 'text-[#1A1918] hover:bg-white'
                }`}
              >
                <Newspaper className="w-4 h-4" /> FRONT PAGE
              </button>
              <button
                onClick={() => setActiveTab('comparison')}
                className={`flex items-center gap-1.5 px-4 py-1.5 font-mono-news text-xs uppercase font-bold transition-all ${
                  activeTab === 'comparison'
                    ? 'bg-[#1A1918] text-white shadow-sm'
                    : 'text-[#1A1918] hover:bg-white'
                }`}
              >
                <Layers className="w-4 h-4" /> MARKET EXCHANGE
              </button>
              {user && (
                <button
                  onClick={() => setActiveTab('portfolio')}
                  className={`flex items-center gap-1.5 px-4 py-1.5 font-mono-news text-xs uppercase font-bold transition-all ${
                    activeTab === 'portfolio'
                      ? 'bg-[#1A1918] text-white shadow-sm'
                      : 'text-[#1A1918] hover:bg-white'
                  }`}
                >
                  <User className="w-4 h-4" /> MY PORTFOLIO
                </button>
              )}
              <button
                onClick={() => setActiveTab('tui')}
                className={`flex items-center gap-1.5 px-4 py-1.5 font-mono-news text-xs uppercase font-bold transition-all ${
                  activeTab === 'tui'
                    ? 'bg-[#1A1918] text-white shadow-sm'
                    : 'text-[#1A1918] hover:bg-white'
                }`}
              >
                <Terminal className="w-4 h-4" /> TELEGRAPH TUI
              </button>
            </div>

            {/* Auth Buttons */}
            <div className="flex items-center font-mono-news text-xs">
              {user ? (
                <div className="flex items-center gap-2 border-2 border-[#1A1918] bg-[#FBF9F5] px-3 py-1.5 shadow-[2px_2px_0px_#1A1918]">
                  <span className="font-bold uppercase tracking-tight text-[11px] max-w-[100px] truncate">
                    {user.displayName || user.email.split('@')[0]}
                  </span>
                  <button 
                    onClick={onSignOut}
                    title="Sign Out"
                    className="text-[#A82424] hover:text-black transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={onOpenAuth}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#1A1918] hover:bg-[#A82424] text-white font-bold uppercase border-2 border-[#1A1918] shadow-[2px_2px_0px_#1A1918] active:translate-x-0.5 active:translate-y-0.5 hover:shadow-none transition-all cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" /> READER SIGN IN
                </button>
              )}
            </div>

            {/* Key Settings Button */}
            <div className="flex items-center font-mono-news text-xs">
              <button
                onClick={() => setShowKeyModal(true)}
                className={`px-3 py-2 border-2 border-[#1A1918] bg-[#FBF9F5] hover:bg-[#EAE6DF] transition-colors shadow-[2px_2px_0px_#1A1918] active:translate-x-0.5 active:translate-y-0.5 hover:shadow-none cursor-pointer flex items-center gap-1.5 font-bold uppercase text-[11px] font-mono-news ${
                  hasCustomKey ? 'text-emerald-800' : 'text-[#1A1918]'
                }`}
                title="Configure Groq API Key"
              >
                <Key className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {hasCustomKey ? 'Custom Key' : 'Default Key'}
                </span>
              </button>
            </div>
          </div>

        </div>

        {/* Ticker / Benchmarks Bar */}
        <div className="pt-2 flex items-center gap-2 overflow-x-auto scrollbar-none font-mono-news text-[11px]">
          <span className="font-bold uppercase shrink-0 text-[#A82424] flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> MARKET BENCHMARKS:
          </span>
          {POPULAR_PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => {
                onLoadPreset(preset.packages);
                setActiveTab('comparison');
              }}
              className="shrink-0 px-2 py-0.5 bg-[#FBF9F5] hover:bg-[#1A1918] hover:text-white text-[#1A1918] border border-[#1A1918] font-mono-news text-[10px] uppercase transition-colors"
            >
              [{preset.label}: {preset.packages.join(' VS ')}]
            </button>
          ))}
        </div>
      </div>

      {/* API Key Modal Popup */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A1918]/60 backdrop-blur-xs font-body-news">
          <div className="relative w-full max-w-md bg-[#F4F1EA] border-4 border-[#1A1918] shadow-[8px_8px_0px_#1A1918] p-6 text-[#1A1918]">
            <button 
              onClick={() => setShowKeyModal(false)}
              className="absolute top-4 right-4 p-1 border-2 border-transparent hover:border-[#1A1918] bg-[#EAE6DF] hover:bg-[#A82424] hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center pb-4 mb-4 border-b-2 border-dashed border-[#1A1918]">
              <span className="font-mono-news text-[10px] font-bold uppercase tracking-wider text-[#A82424]">
                • TELEGRAM SERVICE KEY •
              </span>
              <h2 className="font-headline text-2xl font-extrabold tracking-tight uppercase mt-1">
                Groq API Key Settings
              </h2>
              <p className="text-xs italic text-[#4A4744] mt-0.5">
                "Configure your personal credentials for deep intelligence queries"
              </p>
            </div>

            <div className="space-y-4 font-mono-news text-xs">
              <div>
                <span className="block font-bold uppercase mb-1">Current Status</span>
                <div className="p-2 border border-[#1A1918]/30 bg-[#EAE6DF] font-bold text-center">
                  {hasCustomKey ? (
                    <span className="text-emerald-800">USING CUSTOM PERSISTED KEY</span>
                  ) : (
                    <span className="text-[#A82424]">USING DEFAULT GLOBAL KEY</span>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-bold uppercase mb-1">Groq API Key</label>
                <input
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="Paste your API key here..."
                  className="w-full bg-[#FBF9F5] border-2 border-[#1A1918] py-2 px-3 focus:outline-none focus:bg-white text-xs font-mono"
                />
                <span className="text-[10px] text-[#4A4744] italic mt-1 block font-body-news">
                  Keys are stored locally in your web browser and never sent to our servers.
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setGroqApiKey(keyInput);
                    setHasCustomKey(!!keyInput.trim());
                    setShowKeyModal(false);
                  }}
                  className="flex-1 py-2 bg-[#1A1918] hover:bg-emerald-800 text-white font-bold uppercase border-2 border-[#1A1918] shadow-[2px_2px_0px_#1A1918] hover:shadow-none transition-all cursor-pointer text-center"
                >
                  SAVE KEY
                </button>
                {hasCustomKey && (
                  <button
                    onClick={() => {
                      setGroqApiKey('');
                      setKeyInput('');
                      setHasCustomKey(false);
                      setShowKeyModal(false);
                    }}
                    className="py-2 px-4 bg-[#EAE6DF] hover:bg-[#A82424] hover:text-white text-[#1A1918] font-bold uppercase border-2 border-[#1A1918] shadow-[2px_2px_0px_#1A1918] hover:shadow-none transition-all cursor-pointer text-center"
                  >
                    RESET TO DEFAULT
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

