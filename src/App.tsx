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
import { AIChatCard } from './components/AIChatCard';
import { GithubTelemetryCard } from './components/GithubTelemetryCard';
import { AuthModal } from './components/AuthModal';
import { PortfolioView } from './components/PortfolioView';
import { TuiInfoView } from './components/TuiInfoView';
import { Loader2, AlertCircle, Newspaper, Github, Shield } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'overview' | 'comparison' | 'portfolio' | 'tui'>('overview');
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
  const [isCreditsOpen, setIsCreditsOpen] = useState<boolean>(false);
  const [isSecurityOpen, setIsSecurityOpen] = useState<boolean>(false);
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState<boolean>(false);

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
        
        {activeTab === 'tui' ? (
          <TuiInfoView />
        ) : activeTab === 'portfolio' && user ? (
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
                  <AIChatCard
                    metadata={metadata}
                    totalDownloads={downloads.reduce((acc, d) => acc + d.downloads, 0)}
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
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 text-center sm:text-left">
            <div className="flex items-center gap-2">
              <Newspaper className="w-4 h-4 text-[#A82424]" />
              <span className="font-bold uppercase text-xs">THE DAILY NPM PUBLISHING CO.</span>
            </div>
            <span className="hidden sm:inline">•</span>
            <span>Created by <span className="font-bold underline text-[#A82424]">Pranav Somalinga</span></span>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap justify-center md:justify-end">
            <button
              onClick={() => setIsHowItWorksOpen(true)}
              className="px-2.5 py-1 border border-[#1A1918] bg-[#FBF9F5] hover:bg-[#1A1918] hover:text-white transition-colors cursor-pointer uppercase font-bold text-[10px]"
            >
              [HOW IT WORKS DISPATCH]
            </button>
            <button
              onClick={() => setIsCreditsOpen(true)}
              className="px-2.5 py-1 border border-[#1A1918] bg-[#FBF9F5] hover:bg-[#1A1918] hover:text-white transition-colors cursor-pointer uppercase font-bold text-[10px]"
            >
              [CREDITS DISPATCH]
            </button>
            <button
              onClick={() => setIsSecurityOpen(true)}
              className="px-2.5 py-1 border border-[#1A1918] bg-[#FBF9F5] hover:bg-[#1A1918] hover:text-white transition-colors cursor-pointer uppercase font-bold text-[10px] flex items-center gap-1"
            >
              <Shield className="w-3 h-3 text-[#A82424]" /> [SECURITY DISPATCH]
            </button>
            <a
              href="https://github.com/Somalip/DailyNPM"
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 border border-[#1A1918] bg-[#FBF9F5] hover:bg-[#1A1918] hover:text-white transition-colors uppercase font-bold text-[10px] flex items-center gap-1"
            >
              <Github className="w-3.5 h-3.5" /> [GITHUB WIRE]
            </a>
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

      {/* Credits Modal */}
      {isCreditsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A1918]/60 backdrop-blur-xs font-body-news">
          <div className="relative w-full max-w-md bg-[#F4F1EA] border-4 border-[#1A1918] shadow-[8px_8px_0px_#1A1918] p-6 text-[#1A1918]">
            <button 
              onClick={() => setIsCreditsOpen(false)}
              className="absolute top-4 right-4 p-1 border-2 border-transparent hover:border-[#1A1918] bg-[#EAE6DF] hover:bg-[#A82424] hover:text-white transition-colors cursor-pointer"
            >
              [X]
            </button>

            <div className="text-center pb-4 mb-4 border-b-2 border-dashed border-[#1A1918]">
              <span className="font-mono-news text-[10px] font-bold uppercase tracking-wider text-[#A82424]">
                • PRESS CORPS DISPATCH •
              </span>
              <h2 className="font-headline text-3xl font-extrabold tracking-tight uppercase mt-1">
                EDITORIAL CREDITS
              </h2>
            </div>

            <div className="space-y-4 font-serif text-xs leading-relaxed text-justify">
              <p>
                <strong>The Daily NPM</strong> is an independent journal of registry intelligence, designed and engineered by <strong className="underline">Pranav Somalinga</strong>. 
              </p>
              <p>
                Special wire dispatches and registry records are fetched in real-time from the official public NPM Registry APIs.
              </p>
              <p>
                Predictive telemetry and regression equations (Linear, Moving Average, and Polynomial curves) are calculated dynamically on the client-side using OLS regression modules.
              </p>
              <p>
                Visual iconography is provided by Lucide-React. Custom layouts utilize Vanilla CSS and Tailwind CSS classes in a double-bordered newspaper layout.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-[#1A1918] text-center font-mono-news">
              <button
                onClick={() => setIsCreditsOpen(false)}
                className="px-4 py-2 bg-[#1A1918] hover:bg-[#A82424] text-white font-bold uppercase border-2 border-[#1A1918] shadow-[2px_2px_0px_#1A1918] cursor-pointer"
              >
                RETURN TO ARCHIVES
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Security Dispatch Modal */}
      {isSecurityOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A1918]/60 backdrop-blur-xs font-body-news">
          <div className="relative w-full max-w-lg bg-[#F4F1EA] border-4 border-[#1A1918] shadow-[8px_8px_0px_#1A1918] p-6 text-[#1A1918]">
            <button 
              onClick={() => setIsSecurityOpen(false)}
              className="absolute top-4 right-4 p-1 border-2 border-transparent hover:border-[#1A1918] bg-[#EAE6DF] hover:bg-[#A82424] hover:text-white transition-colors cursor-pointer"
            >
              [X]
            </button>

            <div className="text-center pb-4 mb-4 border-b-2 border-dashed border-[#1A1918]">
              <span className="font-mono-news text-[10px] font-bold uppercase tracking-wider text-[#A82424] flex items-center justify-center gap-1">
                <Shield className="w-3.5 h-3.5" /> • SECURITY & TELEGRAPHY DISCLAIMER •
              </span>
              <h2 className="font-headline text-3xl font-extrabold tracking-tight uppercase mt-1">
                SECURITY BULLETIN
              </h2>
            </div>

            <div className="space-y-4 font-serif text-xs leading-relaxed text-justify overflow-y-auto max-h-[60vh] pr-2">
              <h3 className="font-headline font-bold text-sm uppercase text-[#A82424] border-b border-[#1A1918] pb-1">
                Firestore Security Rulebase
              </h3>
              <p>
                Our infrastructure enforces strict data isolation and authorization protocols via Firestore security rules:
              </p>
              <ul className="list-disc pl-5 space-y-1 font-mono-news text-[11px] text-[#4A4744]">
                <li><strong>User Isolation:</strong> Reads and writes are only permitted for authenticated owners matching the document UID (`/users/{"{userId}"}`).</li>
                <li><strong>Input Guardrails:</strong> Display names are limited to 100 characters to prevent buffer issues.</li>
                <li><strong>Watchlist Restrictions:</strong> A maximum of 50 tracked packages is enforced per account to prevent resource abuse.</li>
                <li><strong>Immutability:</strong> The system locks critical credentials (UID and email) upon initial registry.</li>
              </ul>

              <h3 className="font-headline font-bold text-sm uppercase text-[#A82424] border-b border-[#1A1918] pb-1 pt-2">
                LLM Safety & Bring Your Own Key (BYOK)
              </h3>
              <p>
                Our AI integrations enforce robust browser security and privacy isolation guardrails:
              </p>
              <ul className="list-disc pl-5 space-y-1 font-mono-news text-[11px] text-[#4A4744]">
                <li><strong>Local Storage Isolation:</strong> Custom LLM API keys are saved strictly in your local browser's \`localStorage\` and are never transmitted to, or persisted in, our backend databases.</li>
                <li><strong>Direct Client Fallback:</strong> If a custom API key is supplied, the browser directly communicates with the AI providers (such as Groq) from your local device, bypassing our backend entirely.</li>
                <li><strong>Relay Privacy:</strong> Any backend relay requests are proxied securely without logging or tracking user credentials.</li>
              </ul>

              <h3 className="font-headline font-bold text-sm uppercase text-[#A82424] border-b border-[#1A1918] pb-1 pt-2">
                Disclaimer & Liability Limits
              </h3>
              <p>
                <strong>The Daily NPM</strong> operates purely as a public directory analyzer. This product is provided "as is" and is <strong>not reliable for, and accepts absolutely no liability for, any loss of data, theft of data</strong>, interceptive telemetry, unauthorized account access, or database breaches.
              </p>
              <p className="bg-[#EAE6DF] p-2 border-l-4 border-[#A82424] font-bold text-[10px] flex items-start gap-1.5">
                <AlertCircle className="w-4 h-4 text-[#A82424] shrink-0 mt-0.5" />
                <span>
                  <strong>IMPORTANT WARNING:</strong> Users must exercise extreme caution. Never enter sensitive passwords, npm auth tokens, private API keys, or production configuration secrets into any interface on this site.
                </span>
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-[#1A1918] text-center font-mono-news">
              <button
                onClick={() => setIsSecurityOpen(false)}
                className="px-4 py-2 bg-[#1A1918] hover:bg-[#A82424] text-white font-bold uppercase border-2 border-[#1A1918] shadow-[2px_2px_0px_#1A1918] cursor-pointer"
              >
                DISMISS BULLETIN
              </button>
            </div>
          </div>
        </div>
      )}
      {/* How It Works Dispatch Modal */}
      {isHowItWorksOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A1918]/60 backdrop-blur-xs font-body-news">
          <div className="relative w-full max-w-lg bg-[#F4F1EA] border-4 border-[#1A1918] shadow-[8px_8px_0px_#1A1918] p-6 text-[#1A1918]">
            <button 
              onClick={() => setIsHowItWorksOpen(false)}
              className="absolute top-4 right-4 p-1 border-2 border-transparent hover:border-[#1A1918] bg-[#EAE6DF] hover:bg-[#A82424] hover:text-white transition-colors cursor-pointer"
            >
              [X]
            </button>

            <div className="text-center pb-4 mb-4 border-b-2 border-dashed border-[#1A1918]">
              <span className="font-mono-news text-[10px] font-bold uppercase tracking-wider text-[#A82424] flex items-center justify-center gap-1">
                <Shield className="w-3.5 h-3.5" /> • ALGORITHMIC COMPILER PROTOCOL •
              </span>
              <h2 className="font-headline text-3xl font-extrabold tracking-tight uppercase mt-1">
                HOW IT WORKS
              </h2>
            </div>

            <div className="space-y-4 font-serif text-xs leading-relaxed text-justify overflow-y-auto max-h-[60vh] pr-2">
              <h3 className="font-headline font-bold text-sm uppercase text-[#A82424] border-b border-[#1A1918] pb-1">
                Local Algorithmic NLP Engine
              </h3>
              <p>
                In the absence of a custom API key, the Q&A Bureau employs a deterministic, zero-dependency Natural Language Processing (NLP) algorithm running fully client-side in the browser:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 font-mono-news text-[11px] text-[#4A4744]">
                <li><strong>Tokenization & Normalization:</strong> Input queries are normalized (lowercased, punctuation removed) and tokenized into individual semantic words.</li>
                <li><strong>Relevance Matrix Scoring:</strong> Tokens are scored against weighted keyword maps across 8 distinct architectural topics (Authorship, Size/Bloat, Licenses, Release timelines, Social metrics, Use cases, Security assessments, and Code snippets).</li>
                <li><strong>Contextual Modifiers:</strong> The engine flags secondary intent attributes (such as identifying concern about bundle weight, security vulnerabilities, or explicit installation instructions).</li>
                <li><strong>Dynamic Synthesis Engine:</strong> The resolved primary topic compiles custom responses in real-time, matching database telemetry variables (downloads, dependency chains, versions, created dates, stars) directly into editorial templates.</li>
              </ul>
              <p>
                This ensures completely private, high-speed, local Q&A capability without sending queries to server proxies or external networks unless explicitly opted-in by entering a custom API key.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-[#1A1918] text-center font-mono-news">
              <button
                onClick={() => setIsHowItWorksOpen(false)}
                className="px-4 py-2 bg-[#1A1918] hover:bg-[#A82424] text-white font-bold uppercase border-2 border-[#1A1918] shadow-[2px_2px_0px_#1A1918] cursor-pointer"
              >
                DISMISS BULLETIN
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
