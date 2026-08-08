import React, { useState } from 'react';
import { Terminal, Download, Copy, Check, Info, ShieldCheck, Cpu } from 'lucide-react';

export const TuiInfoView: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const installCmd = "npm i digest-cli";

  const handleCopy = () => {
    navigator.clipboard.writeText(installCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadScript = () => {
    // Generate a simple bootstrap shell script
    const scriptContent = `#!/bin/sh\n# The Daily NPM - TUI Bootstrapper\n\necho "[Telegraph wire] Bootstrapping Daily NPM Terminal User Interface..."\nnpm install -g digest-cli && digest-cli\n`;
    const blob = new Blob([scriptContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'dailynpm-tui.sh';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 font-body-news text-[#1A1918] animate-fadeIn">
      {/* Title Header */}
      <div className="border-b-4 border-[#1A1918] pb-4">
        <span className="font-mono-news text-xs font-bold uppercase text-[#A82424] tracking-wider">
          SPECIAL CORRESPONDENCE SECTION
        </span>
        <h2 className="font-headline text-4xl sm:text-5xl font-extrabold uppercase tracking-tight mt-1">
          THE TELEGRAPH TERMINAL TUI
        </h2>
        <p className="text-xs italic text-[#4A4744] mt-1">
          An interactive, full-screen Node telemetry journal operating directly inside your terminal emulator.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Side: Editorial & Info */}
        <div className="lg:col-span-7 space-y-6">
          <div className="newspaper-card p-6 space-y-4">
            <h3 className="font-headline text-2xl font-bold uppercase flex items-center gap-2">
              <Terminal className="w-5 h-5 text-[#A82424]" /> INTRODUCING THE TELEGRAPH TUI
            </h3>
            
            <div className="font-serif text-sm leading-relaxed text-justify space-y-3">
              <p className="drop-cap">
                For developers operating inside remote shell buffers or demanding instant keyboard-driven telemetry reports, the publishing editors are proud to offer <strong>The Daily NPM - Terminal Edition</strong>.
              </p>
              <p>
                The Terminal edition runs directly inside standard console buffers, utilizing Blessed grid rendering and full-screen layouts. It aggregates identical regression metrics, includes local file storage for watchlist syncing, and provides real-time ASCII trend forecasting.
              </p>
            </div>
          </div>

          {/* Features Checklist */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono-news text-xs">
            <div className="p-4 bg-[#EAE6DF]/60 border border-[#1A1918]/20 flex items-start gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0" />
              <div>
                <span className="font-bold block uppercase">SECURE SESSION SYNC</span>
                <span className="text-[10px] text-[#4A4744]">Log in (`L`) inside the TUI to sync your cloud watchlist locally.</span>
              </div>
            </div>

            <div className="p-4 bg-[#EAE6DF]/60 border border-[#1A1918]/20 flex items-start gap-2">
              <Cpu className="w-5 h-5 text-[#A82424] shrink-0" />
              <div>
                <span className="font-bold block uppercase">PREDICTIVE SIMULATOR</span>
                <span className="text-[10px] text-[#4A4744]">Run flat or compounding simulation vectors (`U`) to test forecasts.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Setup & Installation Action */}
        <div className="lg:col-span-5 space-y-6">
          <div className="newspaper-card p-6 space-y-6 border-l-4">
            <span className="font-mono-news text-[10px] font-bold text-[#A82424] uppercase block tracking-wider">
              INSTALLATION WIRES
            </span>
            <h3 className="font-headline text-xl font-bold uppercase">BOOTSTRAP IN 1-STEP</h3>

            {/* Install Code Block */}
            <div className="space-y-2 font-mono-news text-xs">
              <label className="block text-[10px] font-bold uppercase text-[#4A4744]">RUN WIRE COMMAND:</label>
              <div className="flex items-center bg-[#FBF9F5] border-2 border-[#1A1918] p-2 justify-between">
                <code className="text-[#A82424] select-all">{installCmd}</code>
                <button
                  onClick={handleCopy}
                  className="p-1 border border-[#1A1918]/20 hover:bg-[#1A1918] hover:text-white transition-all cursor-pointer"
                  title="Copy command"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Bootstrap Download Button */}
            <div className="space-y-3 pt-4 border-t border-dashed border-[#1A1918]/30">
              <p className="text-[11px] font-mono-news text-[#4A4744]">
                Or download a shell bootstrap file that auto-executes the interactive terminal dashboard when launched.
              </p>
              
              <button
                onClick={handleDownloadScript}
                className="w-full py-2.5 bg-[#1A1918] hover:bg-[#A82424] text-white font-mono-news text-xs uppercase font-bold border-2 border-[#1A1918] shadow-[3px_3px_0px_#1A1918] active:translate-x-0.5 active:translate-y-0.5 hover:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" /> DOWNLOAD TUI BOOTSTRAPPER (.SH)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
