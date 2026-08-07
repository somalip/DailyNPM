import React, { useState, useEffect } from 'react';
import { PackageMetadata, DownloadPoint, RegressionResult, AIInsights, RegressionModelType } from './types';
import { fetchPackageMetadata, fetchPackageDownloads, fetchAIInsights } from './utils/npmApi';
import { computeDownloadRegression } from './utils/regressionEngine';
import { Header } from './components/Header';
import { PackageHeader } from './components/PackageHeader';
import { DownloadChart } from './components/DownloadChart';
import { RegressionCard } from './components/RegressionCard';
import { RegressionSimulator } from './components/RegressionSimulator';
import { DayOfWeekChart } from './components/DayOfWeekChart';
import { ComparisonView } from './components/ComparisonView';
import { DependenciesModal } from './components/DependenciesModal';
import { AIHealthCard } from './components/AIHealthCard';
import { GithubTelemetryCard } from './components/GithubTelemetryCard';
import { AuthModal } from './components/AuthModal';
import { PortfolioView } from './components/PortfolioView';
import { Loader2, AlertCircle, Newspaper } from 'lucide-react';
import { onAuthStateListener, signOutUser, trackPackage, untrackPackage } from './services/firebase';

const POPULAR_PACKAGES = [
  'react', 'express', 'vite', 'lodash', 'tailwindcss', 
  'next', 'vue', 'svelte', 'typescript', 'esbuild', 
  'jest', 'vitest', 'axios', 'rxjs', 'sass', 'prettier', 
  'eslint', 'webpack', 'rollup', 'postcss'
];

const getRandomPackage = () => {
  const randomIndex = Math.floor(Math.random() * POPULAR_PACKAGES.length);
  return POPULAR_PACKAGES[randomIndex];
};

export default function App() {
  const [currentPackage, setCurrentPackage] = useState<string>(getRandomPackage);
  const [period, setPeriod] = useState<string>('last-month');
  const [activeTab, setActiveTab] = useState<'overview' | 'comparison' | 'portfolio'>('overview');
  const [recentSearches, setRecentSearches] = useState<string[]>(['react', 'express', 'vite', 'lodash', 'tailwindcss']);
  const [comparisonSet, setComparisonSet] = useState<string[]>(['react', 'vue', 'svelte']);

  // Authentication State
  const [user, setUser] = useState<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  // Data states
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<PackageMetadata | null>(null);
  const [downloads, setDownloads] = useState<DownloadPoint[]>([]);
  const [regression, setRegression] = useState<RegressionResult | null>(null);
  const [modelType, setModelType] = useState<RegressionModelType>('seasonal_linear');

  // AI Insights
  const [insights, setInsights] = useState<AIInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState<boolean>(false);

  // Modal
  const [isDepsModalOpen, setIsDepsModalOpen] = useState<boolean>(false);

  // Auth State Listener
  useEffect(() => {
    const unsubscribe = onAuthStateListener((currentUser) => {
      setUser(currentUser);
      if (!currentUser && activeTab === 'portfolio') {
        setActiveTab('overview');
      }
    });
    return () => unsubscribe();
  }, [activeTab]);

  const loadPackageData = async (pkgName: string, downloadPeriod: string) => {
    setLoading(true);
    setError(null);
    try {
      const [meta, dl] = await Promise.all([
        fetchPackageMetadata(pkgName),
        fetchPackageDownloads(pkgName, downloadPeriod),
      ]);

      setMetadata(meta);
      setDownloads(dl.downloads || []);

      // Compute regression analysis
      const reg = computeDownloadRegression(dl.downloads || [], meta.time?.created, modelType, 14);
      setRegression(reg);

      // Add to recent searches if not present
      setRecentSearches((prev) => {
        const filtered = prev.filter((item) => item.toLowerCase() !== pkgName.toLowerCase());
        return [pkgName, ...filtered].slice(0, 8);
      });

      // Trigger AI insights in background
      const total30d = (dl.downloads || []).reduce((acc: number, d: DownloadPoint) => acc + d.downloads, 0);
      const ageDays = reg.packageAgeDays;
      const depsCount = Object.keys(meta.dependencies || {}).length;

      setInsightsLoading(true);
      fetchAIInsights({
        packageName: meta.name,
        description: meta.description,
        totalDownloads: total30d,
        version: meta.latestVersion,
        ageInDays: ageDays,
        dependenciesCount: depsCount,
      })
        .then((res) => setInsights(res))
        .catch(() => setInsights(null))
        .finally(() => setInsightsLoading(false));
    } catch (err: any) {
      console.error('Error loading package data:', err);
      setError(err.message || `Failed to fetch data for package "${pkgName}". Please verify the package name.`);
      setMetadata(null);
      setDownloads([]);
      setRegression(null);
      setInsights(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPackageData(currentPackage, period);
  }, [currentPackage, period]);

  // Re-run regression when model type changes
  useEffect(() => {
    if (downloads.length > 0 && metadata) {
      const reg = computeDownloadRegression(downloads, metadata.time?.created, modelType, 14);
      setRegression(reg);
    }
  }, [modelType]);

  const handleSearch = (pkgName: string) => {
    setCurrentPackage(pkgName);
    setActiveTab('overview');
  };

  const handleLoadPreset = (packages: string[]) => {
    setComparisonSet(packages);
    setActiveTab('comparison');
  };

  const handleToggleTrack = async () => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    if (!metadata) return;

    try {
      const lowerName = metadata.name.toLowerCase();
      const isCurrentlyTracked = user.watchlist?.some((p: any) => p.name.toLowerCase() === lowerName);
      
      let updatedWatchlist;
      if (isCurrentlyTracked) {
        updatedWatchlist = await untrackPackage(user.uid, metadata.name);
      } else {
        updatedWatchlist = await trackPackage(user.uid, metadata.name, 15);
      }
      
      setUser((prev: any) => ({ ...prev, watchlist: updatedWatchlist }));
    } catch (err) {
      console.error("Failed to toggle track package:", err);
    }
  };

  const total30dDownloads = downloads.reduce((acc, d) => acc + d.downloads, 0);
  const avgDailyDownloads = downloads.length > 0 ? Math.round(total30dDownloads / downloads.length) : 0;
  
  const isTracked = user?.watchlist?.some((p: any) => p.name.toLowerCase() === metadata?.name.toLowerCase()) || false;

  return (
    <div className="min-h-screen text-[#1A1918] font-body-news selection:bg-[#1A1918] selection:text-white flex flex-col">
      
      {/* Header Bar */}
      <Header
        currentPackage={currentPackage}
        onSearch={handleSearch}
        onLoadPreset={handleLoadPreset}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        recentSearches={recentSearches}
        user={user}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onSignOut={async () => {
          await signOutUser();
          setActiveTab('overview');
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {activeTab === 'portfolio' && user ? (
          <PortfolioView
            user={user}
            onSelectPackage={handleSearch}
            onComparePackages={handleLoadPreset}
            onRefreshWatchlist={() => {
              // trigger user profile refresh from local state
              setUser({ ...user });
            }}
          />
        ) : activeTab === 'comparison' ? (
          <ComparisonView
            initialPackages={comparisonSet}
            onSelectMainPackage={handleSearch}
          />
        ) : (
          <>
            {loading ? (
              <div className="py-24 flex flex-col items-center justify-center space-y-4 text-[#1A1918] font-mono-news">
                <Loader2 className="w-10 h-10 text-[#A82424] animate-spin" />
                <p className="text-sm font-bold uppercase tracking-wider">
                  [TELEGRAPHING DATA]: Fetching wire dispatches for <span className="underline">{currentPackage}</span>...
                </p>
              </div>
            ) : error ? (
              <div className="newspaper-card p-8 text-center space-y-4 max-w-xl mx-auto my-12 text-[#1A1918]">
                <div className="p-3 bg-[#EAE6DF] text-[#A82424] border-2 border-[#1A1918] w-12 h-12 mx-auto flex items-center justify-center shadow-[2px_2px_0px_#1A1918]">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-headline uppercase text-2xl font-bold text-[#A82424]">PACKAGE NOT FOUND</h3>
                  <p className="text-xs font-mono-news text-[#4A4744] mt-1">{error}</p>
                </div>
                <div className="pt-2 flex flex-wrap justify-center gap-2 font-mono-news text-xs">
                  {['react', 'express', 'lodash', 'vite'].map((pkg) => (
                    <button
                      key={pkg}
                      onClick={() => handleSearch(pkg)}
                      className="px-3 py-1.5 bg-[#EAE6DF] hover:bg-[#1A1918] hover:text-white text-[#1A1918] text-xs font-bold border-2 border-[#1A1918] shadow-[2px_2px_0px_#1A1918] transition-colors uppercase"
                    >
                      Search {pkg}
                    </button>
                  ))}
                </div>
              </div>
            ) : metadata && regression ? (
              <div className="space-y-8">
                
                {/* Package Overview Header */}
                <PackageHeader
                  metadata={metadata}
                  regression={regression}
                  total30dDownloads={total30dDownloads}
                  avgDailyDownloads={avgDailyDownloads}
                  onViewDependencies={() => setIsDepsModalOpen(true)}
                  user={user}
                  isTracked={isTracked}
                  onToggleTrack={handleToggleTrack}
                />

                {/* Regression Simulator / Predictor */}
                <RegressionSimulator
                  downloads={downloads}
                  createdDate={metadata.time?.created}
                  packageName={metadata.name}
                />

                {/* Main Download Chart */}
                <DownloadChart
                  downloads={downloads}
                  regression={regression}
                  period={period}
                  onPeriodChange={setPeriod}
                  packageName={metadata.name}
                />

                {/* Grid of Secondary Insights */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <GithubTelemetryCard metadata={metadata} />
                  <AIHealthCard
                    insights={insights}
                    loading={insightsLoading}
                    packageName={metadata.name}
                  />
                </div>

                <div className="grid grid-cols-1 gap-8">
                  <DayOfWeekChart downloads={downloads} />
                </div>

                {/* Dependencies Inspector Modal */}
                <DependenciesModal
                  metadata={metadata}
                  isOpen={isDepsModalOpen}
                  onClose={() => setIsDepsModalOpen(false)}
                  onSelectPackage={handleSearch}
                />

              </div>
            ) : null}
          </>
        )}

      </main>

      {/* Newspaper Footer */}
      <footer className="border-t-4 border-[#1A1918] bg-[#EAE6DF] py-6 text-center text-xs font-mono-news text-[#1A1918]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Newspaper className="w-4 h-4 text-[#A82424]" />
            <span className="font-bold uppercase text-xs">PRINTED DAILY BY THE DAILY NPM PUBLISHING CO.</span>
            <span>• Powered by NPM Registry & Algorithms Designed by Daily NPM</span>
          </div>
          <p>© {new Date().getFullYear()} The Daily NPM • All Rights Reserved</p>
        </div>
      </footer>

      {/* Auth Modal Popup */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={(authenticatedUser) => {
          setUser(authenticatedUser);
          setActiveTab('portfolio');
        }}
      />

    </div>
  );
}
