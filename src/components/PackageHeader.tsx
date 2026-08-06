import React, { useState } from 'react';
import { PackageMetadata, RegressionResult } from '../types';
import { formatNumber, formatCompactDate } from '../utils/npmApi';
import { ExternalLink, Copy, Check, Clock, GitFork, Box, Calendar, Award, ShieldCheck, Newspaper } from 'lucide-react';

interface PackageHeaderProps {
  metadata: PackageMetadata;
  regression: RegressionResult;
  total30dDownloads: number;
  avgDailyDownloads: number;
  onViewDependencies: () => void;
}

export const PackageHeader: React.FC<PackageHeaderProps> = ({
  metadata,
  regression,
  total30dDownloads,
  avgDailyDownloads,
  onViewDependencies,
}) => {
  const [packageManager, setPackageManager] = useState<'npm' | 'pnpm' | 'yarn' | 'bun'>('npm');
  const [copied, setCopied] = useState(false);

  const getInstallCmd = () => {
    switch (packageManager) {
      case 'pnpm':
        return `pnpm add ${metadata.name}`;
      case 'yarn':
        return `yarn add ${metadata.name}`;
      case 'bun':
        return `bun add ${metadata.name}`;
      default:
        return `npm i ${metadata.name}`;
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getInstallCmd());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const dependenciesCount = Object.keys(metadata.dependencies || {}).length;
  const devDependenciesCount = Object.keys(metadata.devDependencies || {}).length;

  return (
    <article className="newspaper-card p-6 sm:p-8 text-[#1A1918] relative">
      {/* Top Banner Tagline */}
      <div className="flex items-center justify-between border-b-2 border-[#1A1918] pb-2 mb-4 font-mono-news text-[11px] uppercase tracking-wider font-bold">
        <span className="text-[#A82424] flex items-center gap-1.5">
          <Newspaper className="w-4 h-4" /> FRONT PAGE EXTRA • SPECIAL DISPATCH
        </span>
        <span>ISSUE EDITION: RELEASE v{metadata.latestVersion}</span>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* Main Article Body */}
        <div className="space-y-4 flex-1">
          {/* Main Headline */}
          <h2 className="font-headline text-3xl sm:text-5xl font-black tracking-tight text-[#1A1918] leading-none uppercase">
            {metadata.name}: {metadata.description.split('.')[0] || 'A Core JavaScript Utility'}
          </h2>

          {/* Article Byline */}
          <div className="font-mono-news text-xs border-y border-[#1A1918]/30 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[#4A4744]">
            <span>BY WIRE SERVICES & STAFF ANALYSTS</span>
            {metadata.github && metadata.github.stars > 0 && (
              <span className="font-bold text-[#A82424] flex items-center gap-0.5">
                ★ {metadata.github.stars.toLocaleString()} STARS
              </span>
            )}
            {metadata.github && metadata.github.forks > 0 && (
              <span className="font-bold text-[#1A1918] flex items-center gap-0.5">
                ⑂ {metadata.github.forks.toLocaleString()} FORKS
              </span>
            )}
            <span>PUBLISHED: {metadata.time?.latest ? formatCompactDate(metadata.time.latest) : 'RECENTLY'}</span>
            <span className="font-bold text-[#1A1918]">{metadata.license} LICENSE</span>
          </div>

          {/* Lead Paragraph with Newspaper Drop Cap */}
          <div className="drop-cap newspaper-columns font-body-news text-base md:text-lg leading-relaxed text-[#1A1918] tracking-normal text-justify">
            {metadata.name} (version {metadata.latestVersion}) has recorded a total of {formatNumber(total30dDownloads)} downloads over the past month. {metadata.description} First introduced {metadata.time?.created ? formatCompactDate(metadata.time.created) : 'in past releases'}, the package maintains an active presence in the Node.js package index with {dependenciesCount} direct dependencies and {devDependenciesCount} development tool requirements.
          </div>

          {/* Metadata Badges */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-mono-news pt-2 border-t border-[#1A1918]/20">
            {metadata.time?.created && (
              <span className="flex items-center gap-1.5 font-bold" title="Original publish date">
                <Calendar className="w-4 h-4 text-[#A82424]" />
                FOUNDED: {formatCompactDate(metadata.time.created)} ({regression.packageAgeFormatted})
              </span>
            )}
            {metadata.time?.latest && (
              <span className="flex items-center gap-1.5 font-bold" title="Latest version release date">
                <Clock className="w-4 h-4 text-[#1A1918]" />
                REVISED: {formatCompactDate(metadata.time.latest)}
              </span>
            )}
            <button
              onClick={onViewDependencies}
              className="flex items-center gap-1.5 font-bold hover:underline text-[#A82424]"
            >
              <Box className="w-4 h-4 text-[#1A1918]" />
              [{dependenciesCount} DEPENDENCIES / {devDependenciesCount} DEV]
            </button>
            {metadata.repository?.url && (
              <a
                href={metadata.repository.url.replace(/^git\+/, '').replace(/\.git$/, '')}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 font-bold hover:underline"
              >
                <GitFork className="w-4 h-4" /> REPOSITORY <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        {/* Side Column: Telegraph Box & Install Command */}
        <div className="w-full lg:w-80 shrink-0 bg-[#EAE6DF] p-4 border-2 border-[#1A1918] shadow-[3px_3px_0px_#1A1918] space-y-3">
          <div className="flex items-center justify-between gap-3 text-xs font-mono-news font-bold uppercase border-b-2 border-[#1A1918] pb-2">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-4 h-4 text-[#A82424]" /> TELEGRAPH WIRE
            </span>
            <span className="text-[10px] bg-[#1A1918] text-white px-1.5 py-0.5">CLI CODE</span>
          </div>

          <p className="font-body-news text-xs text-[#4A4744] italic">
            To acquire this package for your local codebase, execute the telegraph command below:
          </p>

          {/* Package Manager Selectors */}
          <div className="flex items-center border border-[#1A1918] bg-[#FBF9F5] p-0.5">
            {(['npm', 'pnpm', 'yarn', 'bun'] as const).map((pm) => (
              <button
                key={pm}
                onClick={() => setPackageManager(pm)}
                className={`flex-1 py-1 font-mono-news text-[11px] uppercase transition-colors font-bold ${
                  packageManager === pm
                    ? 'bg-[#1A1918] text-white'
                    : 'text-[#1A1918] hover:bg-[#EAE6DF]'
                }`}
              >
                {pm}
              </button>
            ))}
          </div>

          {/* Command Copy Box */}
          <div className="flex items-center gap-2 font-mono-news text-xs bg-[#FBF9F5] px-3 py-2 border-2 border-[#1A1918] text-[#1A1918]">
            <span className="select-all flex-1 font-bold tracking-tight">{getInstallCmd()}</span>
            <button
              onClick={handleCopy}
              className="p-1.5 text-[#1A1918] hover:bg-[#1A1918] hover:text-white border border-[#1A1918] transition-colors"
              title="Copy install command"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-700 font-bold" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

      </div>

      {/* Financial & Stock Ticker Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t-2 border-[#1A1918] font-mono-news">
        <div className="bg-[#EAE6DF] p-3 border border-[#1A1918] shadow-[2px_2px_0px_#1A1918]">
          <span className="text-[10px] uppercase opacity-70 block font-bold tracking-wider">MONTHLY VOLUME</span>
          <span className="text-2xl font-extrabold text-[#1A1918] mt-0.5 block">
            {formatNumber(total30dDownloads)}
          </span>
        </div>

        <div className="bg-[#EAE6DF] p-3 border border-[#1A1918] shadow-[2px_2px_0px_#1A1918]">
          <span className="text-[10px] uppercase opacity-70 block font-bold tracking-wider">DAILY VELOCITY</span>
          <span className="text-2xl font-extrabold text-[#1A1918] mt-0.5 block">
            {formatNumber(avgDailyDownloads)}<span className="text-xs font-normal">/day</span>
          </span>
        </div>

        <div className="bg-[#EAE6DF] p-3 border border-[#1A1918] shadow-[2px_2px_0px_#1A1918]">
          <span className="text-[10px] uppercase opacity-70 block font-bold tracking-wider">ECOSYSTEM TENURE</span>
          <span className="text-2xl font-extrabold text-[#1A1918] mt-0.5 block">
            {regression.packageAgeFormatted.split(' ')[0]} {regression.packageAgeFormatted.split(' ')[1]}
          </span>
        </div>

        <div className="bg-[#EAE6DF] p-3 border border-[#1A1918] shadow-[2px_2px_0px_#1A1918]">
          <span className="text-[10px] uppercase opacity-70 block font-bold tracking-wider">ALGORITHM ACCURACY</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Award className="w-5 h-5 text-[#A82424]" />
            <span className="text-2xl font-extrabold text-[#1A1918]">
              {regression.algorithmStrengthScore}%
            </span>
            <span className="text-[9px] px-1.5 py-0.5 bg-[#1A1918] text-white font-bold uppercase">
              {regression.algorithmStrengthLabel}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
};
