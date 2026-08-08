import React, { useState, useEffect } from 'react';
import { PackageMetadata } from '../types';
import { X, Search, ExternalLink, ScrollText } from 'lucide-react';

interface DependenciesModalProps {
  metadata: PackageMetadata;
  isOpen: boolean;
  onClose: () => void;
  onSelectPackage: (pkgName: string) => void;
}

interface DependencyTreeNode {
  name: string;
  version?: string;
  dependencies?: DependencyTreeNode[];
  error?: boolean;
}

interface DependencyNodeViewProps {
  node: DependencyTreeNode;
  depth: number;
  isLast: boolean;
  onSelectPackage: (pkgName: string) => void;
  onCloseModal: () => void;
}

const DependencyNodeView: React.FC<DependencyNodeViewProps> = ({
  node,
  depth,
  isLast,
  onSelectPackage,
  onCloseModal,
}) => {
  const [isOpen, setIsOpen] = useState(depth < 1);

  const hasChildren = node.dependencies && node.dependencies.length > 0;
  const isPlaceholder = node.name.startsWith('... and');
  const showReportButton = !isPlaceholder && node.version !== 'unknown' && node.version !== '';

  return (
    <div className="font-mono-news text-xs leading-relaxed text-[#1A1918]">
      <div className="flex items-center gap-1 hover:bg-[#EAE6DF]/40 py-1 px-1 transition-colors">
        <span className="text-[#4A4744]/60 font-mono select-none">
          {depth > 0 ? '│  '.repeat(depth - 1) + (isLast ? '└── ' : '├── ') : ''}
        </span>

        {hasChildren ? (
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-4 h-4 inline-flex items-center justify-center border border-[#1A1918] bg-[#EAE6DF] hover:bg-[#1A1918] hover:text-white font-bold text-[9px] mr-1 select-none cursor-pointer"
          >
            {isOpen ? '-' : '+'}
          </button>
        ) : (
          <span className="w-4 mr-1"></span>
        )}

        <span className={`font-bold ${isPlaceholder ? 'italic text-[#4A4744]' : 'text-[#1A1918]'}`}>
          {node.name}
        </span>
        {node.version && (
          <span className="text-[#4A4744] text-[10px] bg-[#EAE6DF] px-1.5 py-0.2 border border-[#1A1918]/30">
            {node.version}
          </span>
        )}

        {showReportButton && (
          <button
            onClick={() => {
              onSelectPackage(node.name);
              onCloseModal();
            }}
            className="ml-2 px-1.5 py-0.2 bg-[#1A1918] hover:bg-[#A82424] text-white text-[9px] uppercase font-bold transition-colors cursor-pointer"
          >
            Read
          </button>
        )}
      </div>

      {hasChildren && isOpen && (
        <div>
          {node.dependencies!.map((child, index) => (
            <DependencyNodeView
              key={`${child.name}-${index}`}
              node={child}
              depth={depth + 1}
              isLast={index === node.dependencies!.length - 1}
              onSelectPackage={onSelectPackage}
              onCloseModal={onCloseModal}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const DependenciesModal: React.FC<DependenciesModalProps> = ({
  metadata,
  isOpen,
  onClose,
  onSelectPackage,
}) => {
  const [activeTab, setActiveTab] = useState<'dependencies' | 'devDependencies' | 'peerDependencies' | 'tree'>('dependencies');
  const [searchTerm, setSearchTerm] = useState('');
  const [treeData, setTreeData] = useState<DependencyTreeNode | null>(null);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeError, setTreeError] = useState<string | null>(null);

  // Fetch dependency tree when switching to 'tree' tab
  useEffect(() => {
    if (isOpen && activeTab === 'tree' && !treeData && !treeLoading) {
      const fetchTree = async () => {
        setTreeLoading(true);
        setTreeError(null);
        try {
          const res = await fetch(`/api/npm/package/${encodeURIComponent(metadata.name)}/dependency-tree`);
          if (!res.ok) throw new Error(`HTTP error ${res.status}`);
          const data = await res.json();
          setTreeData(data);
        } catch (err: any) {
          console.error("Error loading dependency tree:", err);
          setTreeError(err.message || "Failed to load dependency tree.");
        } finally {
          setTreeLoading(false);
        }
      };
      fetchTree();
    }
  }, [activeTab, metadata.name, treeData, treeLoading, isOpen]);

  // Reset tree state when modal is closed or package changes
  useEffect(() => {
    if (!isOpen) {
      setTreeData(null);
      setActiveTab('dependencies');
    }
  }, [isOpen, metadata.name]);

  if (!isOpen) return null;

  const currentMap = activeTab !== 'tree' ? (metadata[activeTab] || {}) : {};
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
            <div className="flex flex-wrap items-center gap-1">
              {(
                [
                  { id: 'dependencies', label: `DIRECT (${Object.keys(metadata.dependencies || {}).length})` },
                  { id: 'devDependencies', label: `DEV (${Object.keys(metadata.devDependencies || {}).length})` },
                  { id: 'peerDependencies', label: `PEER (${Object.keys(metadata.peerDependencies || {}).length})` },
                  { id: 'tree', label: 'DEPENDENCY TREE' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-2.5 py-1 text-[11px] uppercase font-bold border-2 border-[#1A1918] transition-all cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-[#1A1918] text-white'
                      : 'bg-[#EAE6DF] text-[#1A1918] hover:bg-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab !== 'tree' && (
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
            )}
          </div>
        </div>

        {/* List Body */}
        <div className="p-4 overflow-y-auto flex-1 font-mono-news text-xs bg-[#FBF9F5]">
          {activeTab === 'tree' ? (
            <div className="space-y-4">
              {treeLoading && (
                <div className="text-center py-10 font-mono-news text-xs text-[#4A4744] flex items-center justify-center gap-2">
                  <span className="animate-spin text-lg">⏳</span>
                  RESOLVING MULTI-TIER DEPENDENCIES...
                </div>
              )}
              {treeError && (
                <div className="p-3 bg-[#EAE6DF] border-2 border-[#A82424] text-xs font-mono-news text-[#A82424]">
                  <strong>TELEGRAPH ERROR:</strong> {treeError}
                </div>
              )}
              {!treeLoading && !treeError && treeData && (
                <div className="bg-[#EAE6DF]/30 p-4 border-2 border-dashed border-[#1A1918] overflow-x-auto max-h-[50vh]">
                  <DependencyNodeView
                    node={treeData}
                    depth={0}
                    isLast={true}
                    onSelectPackage={onSelectPackage}
                    onCloseModal={onClose}
                  />
                </div>
              )}
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-10 font-mono-news text-xs text-[#4A4744]">
              No listings found in this classified category.
            </div>
          ) : (
            <div className="divide-y divide-[#1A1918]/20 space-y-2">
              {entries.map(([depName, versionSpec]) => (
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
                      className="px-2.5 py-1 bg-[#1A1918] hover:bg-[#A82424] text-white font-mono-news text-[10px] uppercase font-bold transition-colors cursor-pointer"
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
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
