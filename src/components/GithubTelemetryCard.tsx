import React from 'react';
import { PackageMetadata } from '../types';
import { formatNumber, formatCompactDate } from '../utils/npmApi';
import { Star, GitFork, AlertCircle, Eye, Activity, Calendar, Zap } from 'lucide-react';

interface GithubTelemetryCardProps {
  metadata: PackageMetadata;
}

export const GithubTelemetryCard: React.FC<GithubTelemetryCardProps> = ({ metadata }) => {
  const { github, releaseVelocity } = metadata;

  return (
    <div className="newspaper-card p-6 text-[#1A1918] space-y-5 relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b-2 border-[#1A1918]">
        <div className="flex items-center gap-2">
          <div className="bg-[#1A1918] text-white p-1.5 shrink-0">
            <Zap className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="font-headline text-xl font-bold uppercase tracking-tight">
              The Github Bureau: Registry Telemetry
            </h3>
            <p className="text-xs font-mono-news text-[#4A4744] mt-0.5">
              Live repository health indicators, social statistics, and release velocity analytics
            </p>
          </div>
        </div>
      </div>

      {/* Grid of Git Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono-news text-xs">
        <div className="bg-[#EAE6DF] border-2 border-[#1A1918] p-3 shadow-[2px_2px_0px_#1A1918]">
          <span className="opacity-70 text-[9px] uppercase font-bold block mb-1">Stars</span>
          <span className="text-xl font-black text-[#A82424] flex items-center gap-1">
            <Star className="w-4 h-4 fill-current" />
            {github ? github.stars.toLocaleString() : 'N/A'}
          </span>
        </div>

        <div className="bg-[#EAE6DF] border-2 border-[#1A1918] p-3 shadow-[2px_2px_0px_#1A1918]">
          <span className="opacity-70 text-[9px] uppercase font-bold block mb-1">Forks</span>
          <span className="text-xl font-black text-[#1A1918] flex items-center gap-1">
            <GitFork className="w-4 h-4" />
            {github ? github.forks.toLocaleString() : 'N/A'}
          </span>
        </div>

        <div className="bg-[#EAE6DF] border-2 border-[#1A1918] p-3 shadow-[2px_2px_0px_#1A1918]">
          <span className="opacity-70 text-[9px] uppercase font-bold block mb-1">Open Issues</span>
          <span className="text-xl font-black text-[#1A1918] flex items-center gap-1">
            <AlertCircle className="w-4 h-4 text-[#A82424]" />
            {github ? github.openIssues.toLocaleString() : 'N/A'}
          </span>
        </div>

        <div className="bg-[#EAE6DF] border-2 border-[#1A1918] p-3 shadow-[2px_2px_0px_#1A1918]">
          <span className="opacity-70 text-[9px] uppercase font-bold block mb-1">Watchers</span>
          <span className="text-xl font-black text-[#1A1918] flex items-center gap-1">
            <Eye className="w-4 h-4" />
            {github ? github.watchers.toLocaleString() : 'N/A'}
          </span>
        </div>
      </div>

      {/* Release Velocity Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono-news">
        {/* Release Frequency Column */}
        <div className="bg-[#EAE6DF] border-2 border-[#1A1918] p-4 space-y-3 shadow-[2px_2px_0px_#1A1918]">
          <span className="font-bold text-[#1A1918] flex items-center gap-1.5 uppercase text-xs border-b border-[#1A1918]/20 pb-1">
            <Activity className="w-4 h-4 text-[#A82424]" /> Maintenance Velocity
          </span>
          <div className="space-y-2 font-body-news text-xs">
            <div className="flex justify-between items-center border-b border-[#1A1918]/10 pb-1">
              <span className="font-mono-news font-bold uppercase text-[10px]">Releases (Last 12M):</span>
              <span className="font-bold text-[#1A1918]">
                {releaseVelocity ? `${releaseVelocity.releasesLastYear} versions` : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center border-b border-[#1A1918]/10 pb-1">
              <span className="font-mono-news font-bold uppercase text-[10px]">Avg Days Between Releases:</span>
              <span className="font-bold text-[#1A1918]">
                {releaseVelocity ? `${releaseVelocity.avgDaysBetweenReleases} days` : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-mono-news font-bold uppercase text-[10px]">Days Since Last Release:</span>
              <span className={`font-bold ${releaseVelocity && releaseVelocity.daysSinceLastRelease > 180 ? 'text-[#A82424]' : 'text-emerald-800'}`}>
                {releaseVelocity ? `${releaseVelocity.daysSinceLastRelease} days ago` : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Repository Details Column */}
        <div className="bg-[#EAE6DF] border-2 border-[#1A1918] p-4 space-y-3 shadow-[2px_2px_0px_#1A1918]">
          <span className="font-bold text-[#1A1918] flex items-center gap-1.5 uppercase text-xs border-b border-[#1A1918]/20 pb-1">
            <Calendar className="w-4 h-4 text-emerald-800" /> Repository Telemetry
          </span>
          <div className="space-y-2 font-body-news text-xs">
            <div className="flex justify-between items-center border-b border-[#1A1918]/10 pb-1">
              <span className="font-mono-news font-bold uppercase text-[10px]">Last Commit / Push:</span>
              <span className="font-bold text-[#1A1918]">
                {github && github.lastCommit ? formatCompactDate(github.lastCommit) : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center border-b border-[#1A1918]/10 pb-1">
              <span className="font-mono-news font-bold uppercase text-[10px]">Registry Age:</span>
              <span className="font-bold text-[#1A1918]">
                {metadata.time?.created ? formatCompactDate(metadata.time.created) : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-mono-news font-bold uppercase text-[10px]">Ecosystem Standing:</span>
              <span className="font-bold text-emerald-800">ACTIVE DISPATCH</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
