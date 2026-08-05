import React, { useState } from 'react';
import { PackageMetadata } from '../types';
import { X, Box, Search, ExternalLink, ScrollText } from 'lucide-react';

interface DependenciesModalProps {
  metadata: PackageMetadata;
  isOpen: boolean;
  onClose: () => void;
  onSelectPackage: (pkgName: string) => void;
}

export const DependenciesModal: React.FC<DependenciesModalProps> = ({
  metadata,
  isOpen,
  onClose,
  onSelectPackage,
}) => {
  const [activeTab, setActiveTab] = useState<'dependencies' | 'devDependencies' | 'peerDependencies'>('dependencies');
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const currentMap = metadata[activeTab] || {};
  const entries = Object.entries(currentMap).filter(([name]) =>
    name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay-newspaper">
      <div className="paper-clipping max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden text-[#1A1918] border-double-thick">
        
        {/* Newspaper Classified Header */}
        <div className="p-4 sm:p-5 border-b-4 border-[#1A1918] flex items-center justify-between bg-[#EAE6DF] relative">
          <div className="flex items-center gap-2.5">
            <div className="bg-[#1A1918] text-white p-1.5 shrink-0 border border-[#FAF6ED]">
              <ScrollText className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-headline font-bold text-xl text-[#1A1918] uppercase tracking-tight ink-bleed">
                The Classifieds: Dependency Directory
              </h3>
              <p className="text-xs font-mono-news text-[#4A4744] mt-0.5">
                Official registry notice for <strong className="text-[#1A1918] font-bold font-headline italic">{metadata.name}</strong> (v{metadata.latestVersion})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#1A1918] hover:bg-[#1A1918] hover:text-white border-2 border-[#1A1918] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Tabs & Search */}
        <div className="p-4 bg-[#FBF9F5] border-b-2 border-[#1A1918] space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 font-mono-news text-xs">
            <div className="flex items-center gap-1">
              {(
                [
                  { id: 'dependencies', label: `DIRECT (${Object.keys(metadata.dependencies || {}).length})` },
                  { id: 'devDependencies', label: `DEV (${Object.keys(metadata.devDependencies || {}).length})` },
                  { id: 'peerDependencies', label: `PEER (${Object.keys(metadata.peerDependencies || {}).length})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-2.5 py-1 text-[11px] uppercase font-bold border-2 border-[#1A1918] transition-all ${
                    activeTab === tab.id
                      ? 'bg-[#1A1918] text-white'
                      : 'bg-[#EAE6DF] text-[#1A1918] hover:bg-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative flex-1 max-w-xs">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#1A1918]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search classifieds..."
                className="w-full bg-[#EAE6DF] text-[#1A1918] font-mono-news text-xs pl-8 pr-3 py-1 border-2 border-[#1A1918] focus:outline-none focus:bg-white"
              />
            </div>
          </div>
        </div>

        {/* List Body */}
        <div className="p-4 overflow-y-auto flex-1 space-y-2 divide-y divide-[#1A1918]/20 font-mono-news text-xs bg-[#FBF9F5]">
          {entries.length === 0 ? (
            <div className="text-center py-10 font-mono-news text-xs text-[#4A4744]">
              No listings found in this classified category.
            </div>
          ) : (
            entries.map(([depName, versionSpec]) => (
              <div
                key={depName}
                className="pt-2 first:pt-0 flex items-center justify-between gap-4 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#1A1918]">
                    {depName}
                  </span>
                  <span className="font-mono-news text-[#4A4744] text-[11px] bg-[#EAE6DF] px-2 py-0.5 border border-[#1A1918]">
                    {versionSpec}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      onSelectPackage(depName);
                      onClose();
                    }}
                    className="px-2.5 py-1 bg-[#1A1918] hover:bg-[#A82424] text-white font-mono-news text-[10px] uppercase font-bold transition-colors"
                  >
                    READ REPORT
                  </button>
                  <a
                    href={`https://www.npmjs.com/package/${depName}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1 text-[#1A1918] hover:text-[#A82424]"
                    title="Open on NPM"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
};
