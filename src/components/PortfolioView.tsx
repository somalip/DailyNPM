import React, { useState, useEffect } from 'react';
import { TrackedPackage, untrackPackage, updateAlertThreshold, AlertRule, updateAlertRules } from '../services/firebase';
import { fetchPackageMetadata, fetchPackageDownloads } from '../utils/npmApi';
import { computeDownloadRegression } from '../utils/regressionEngine';
import { PortfolioIndexChart } from './PortfolioIndexChart';
import { PortfolioGazette } from './PortfolioGazette';
import { 
  Loader2, Trash2, Bell, AlertTriangle, TrendingUp, TrendingDown, 
  Eye, CheckSquare, Square, BarChart3, HelpCircle, BookOpen, Settings, BellRing, Star, Plus, ShieldCheck 
} from 'lucide-react';

interface PortfolioViewProps {
  user: any;
  onSelectPackage: (pkgName: string) => void;
  onComparePackages: (packages: string[]) => void;
  onRefreshWatchlist: () => void;
}

interface LiveTrackedData {
  package: TrackedPackage;
  metadata: any;
  weeklyChange: number; 
  currentDownloads: number;
  downloads: any[];
  regression: any;
  loading: boolean;
  error: string | null;
}

export const PortfolioView: React.FC<PortfolioViewProps> = ({
  user,
  onSelectPackage,
  onComparePackages,
  onRefreshWatchlist,
}) => {
  const [watchlist, setWatchlist] = useState<TrackedPackage[]>(user.watchlist || []);
  const [liveData, setLiveData] = useState<Record<string, LiveTrackedData>>({});
  const [loadingItems, setLoadingItems] = useState(false);
  const [selectedPackages, setSelectedPackages] = useState<string[]>([]);
  const [editRulesPkg, setEditRulesPkg] = useState<string | null>(null);
  
  // Rule Creation Form States
  const [newRuleType, setNewRuleType] = useState<'wow_change' | 'star_count' | 'version_bump'>('wow_change');
  const [newRuleThreshold, setNewRuleThreshold] = useState<string>('15');

  // Sub-tabs in Portfolio Dashboard
  const [portfolioTab, setPortfolioTab] = useState<'index' | 'gazette' | 'rules'>('index');

  useEffect(() => {
    setWatchlist(user.watchlist || []);
  }, [user.watchlist]);

  const loadAllPackageData = async (list: TrackedPackage[]) => {
    setLoadingItems(true);
    const newData: Record<string, LiveTrackedData> = {};
    
    list.forEach(p => {
      newData[p.name.toLowerCase()] = {
        package: p,
        metadata: null,
        weeklyChange: 0,
        currentDownloads: 0,
        downloads: [],
        regression: null,
        loading: true,
        error: null
      };
    });
    setLiveData({ ...newData });

    await Promise.all(
      list.map(async (p) => {
        const lowerName = p.name.toLowerCase();
        try {
          const [meta, dl] = await Promise.all([
            fetchPackageMetadata(p.name),
            fetchPackageDownloads(p.name, 'last-month')
          ]);

          const dls = dl.downloads || [];
          const regression = computeDownloadRegression(dls, meta.time?.created, 'seasonal_linear', 7);
          
          let weeklyChange = 0;
          let currentDownloads = 0;
          if (dls.length >= 14) {
            const sortedDls = [...dls].sort((a, b) => a.day.localeCompare(b.day));
            const last7 = sortedDls.slice(-7).reduce((acc, d) => acc + d.downloads, 0);
            const prev7 = sortedDls.slice(-14, -7).reduce((acc, d) => acc + d.downloads, 0);
            currentDownloads = last7;
            weeklyChange = prev7 > 0 ? ((last7 - prev7) / prev7) * 100 : 0;
          } else if (dls.length > 0) {
            currentDownloads = dls.reduce((acc, d) => acc + d.downloads, 0);
          }

          newData[lowerName] = {
            package: p,
            metadata: meta,
            weeklyChange: Math.round(weeklyChange * 10) / 10,
            currentDownloads,
            downloads: dls,
            regression,
            loading: false,
            error: null
          };
        } catch (err: any) {
          newData[lowerName] = {
            package: p,
            metadata: null,
            weeklyChange: 0,
            currentDownloads: 0,
            downloads: [],
            regression: null,
            loading: false,
            error: err.message || 'Failed to fetch'
          };
        }
        setLiveData({ ...newData });
      })
    );
    setLoadingItems(false);
  };

  useEffect(() => {
    if (watchlist.length > 0) {
      loadAllPackageData(watchlist);
    } else {
      setLiveData({});
    }
  }, [watchlist]);

  const handleUntrack = async (pkgName: string) => {
    if (!confirm(`Are you sure you want to untrack "${pkgName}"?`)) return;
    try {
      const updatedList = await untrackPackage(user.uid, pkgName);
      user.watchlist = updatedList;
      onRefreshWatchlist();
    } catch (err) {
      console.error(err);
      alert('Failed to untrack package');
    }
  };

  const handleAddRule = async (pkgName: string) => {
    const targetPkg = watchlist.find(p => p.name.toLowerCase() === pkgName.toLowerCase());
    if (!targetPkg) return;

    const currentRules = targetPkg.rules || [];
    const newRule: AlertRule = {
      id: Math.random().toString(36).substring(2, 9),
      type: newRuleType,
      threshold: newRuleType === 'version_bump' ? 'any' : newRuleThreshold,
      isActive: true
    };

    const updatedRules = [...currentRules, newRule];
    try {
      const updatedList = await updateAlertRules(user.uid, pkgName, updatedRules);
      user.watchlist = updatedList;
      onRefreshWatchlist();
      setNewRuleThreshold('15');
    } catch (err) {
      console.error(err);
      alert('Failed to add custom alert rule.');
    }
  };

  const handleRemoveRule = async (pkgName: string, ruleId: string) => {
    const targetPkg = watchlist.find(p => p.name.toLowerCase() === pkgName.toLowerCase());
    if (!targetPkg) return;

    const updatedRules = (targetPkg.rules || []).filter(r => r.id !== ruleId);
    try {
      const updatedList = await updateAlertRules(user.uid, pkgName, updatedRules);
      user.watchlist = updatedList;
      onRefreshWatchlist();
    } catch (err) {
      console.error(err);
      alert('Failed to delete alert rule.');
    }
  };

  const handleToggleRuleActive = async (pkgName: string, ruleId: string) => {
    const targetPkg = watchlist.find(p => p.name.toLowerCase() === pkgName.toLowerCase());
    if (!targetPkg) return;

    const updatedRules = (targetPkg.rules || []).map(r => 
      r.id === ruleId ? { ...r, isActive: !r.isActive } : r
    );
    try {
      const updatedList = await updateAlertRules(user.uid, pkgName, updatedRules);
      user.watchlist = updatedList;
      onRefreshWatchlist();
    } catch (err) {
      console.error(err);
      alert('Failed to toggle alert rule.');
    }
  };

  const handleToggleSelect = (pkgName: string) => {
    setSelectedPackages(prev => 
      prev.includes(pkgName) 
        ? prev.filter(p => p !== pkgName) 
        : [...prev, pkgName]
    );
  };

  const handleCompareSelected = () => {
    if (selectedPackages.length < 2) {
      alert("Please select at least 2 packages to compare.");
      return;
    }
    onComparePackages(selectedPackages);
  };

  // Helper to aggregate day-by-day downloads for all tracked packages
  const getAggregatedDownloads = () => {
    const list = Object.values(liveData).filter(d => !d.loading && !d.error && d.metadata);
    if (list.length === 0) return [];
    
    const dayMap: Record<string, number> = {};
    list.forEach(item => {
      if (Array.isArray(item.downloads)) {
        item.downloads.forEach(d => {
          dayMap[d.day] = (dayMap[d.day] || 0) + d.downloads;
        });
      }
    });
    
    return Object.entries(dayMap).map(([day, downloads]) => ({
      day,
      downloads
    })).sort((a, b) => a.day.localeCompare(b.day));
  };

  const aggregatedDownloads = getAggregatedDownloads();

  // Aggregate Calculations
  const totalVolume30d = aggregatedDownloads.reduce((acc, pt) => acc + pt.downloads, 0);
  
  // Combined Weekly Index Performance
  let combinedWeeklyChange = 0;
  if (aggregatedDownloads.length >= 14) {
    const last7 = aggregatedDownloads.slice(-7).reduce((acc, d) => acc + d.downloads, 0);
    const prev7 = aggregatedDownloads.slice(-14, -7).reduce((acc, d) => acc + d.downloads, 0);
    combinedWeeklyChange = prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100 * 10) / 10 : 0;
  }

  // Active Rule Alerts Detection
  const getTriggeredRules = (data: LiveTrackedData) => {
    if (data.loading || data.error || !data.package) return [];
    const triggered: { rule: AlertRule; message: string }[] = [];

    // 1. Check legacy base threshold (alertThreshold drop trigger)
    if (data.weeklyChange < -data.package.alertThreshold) {
      triggered.push({
        rule: { id: 'base', type: 'wow_change', threshold: data.package.alertThreshold, isActive: true },
        message: `WoW download drop exceeds ${data.package.alertThreshold}% threshold (Current: ${data.weeklyChange}%)`
      });
    }

    // 2. Check custom rules
    const customRules = data.package.rules || [];
    customRules.forEach(rule => {
      if (!rule.isActive) return;

      if (rule.type === 'wow_change') {
        const thresholdVal = parseFloat(rule.threshold as string) || 0;
        if (thresholdVal > 0 && data.weeklyChange < -thresholdVal) {
          triggered.push({
            rule,
            message: `Custom rule drop alert triggered (threshold: ${thresholdVal}%, current: ${data.weeklyChange}%)`
          });
        }
      } else if (rule.type === 'star_count') {
        const thresholdVal = parseInt(rule.threshold as string) || 0;
        const currentStars = data.metadata?.github?.stars || 0;
        if (currentStars >= thresholdVal) {
          triggered.push({
            rule,
            message: `Crossed target star milestone (threshold: ${thresholdVal.toLocaleString()} stars, current: ${currentStars.toLocaleString()} stars)`
          });
        }
      } else if (rule.type === 'version_bump') {
        // Mock version bump trigger: alert if package has been revised in the last 7 days
        const latestTime = data.metadata?.time?.latest;
        if (latestTime) {
          const diffMs = Date.now() - new Date(latestTime).getTime();
          const diffDays = diffMs / (1000 * 60 * 60 * 24);
          if (diffDays <= 7) {
            triggered.push({
              rule,
              message: `New version revision published within last 7 days (version: v${data.metadata.latestVersion})`
            });
          }
        }
      }
    });

    return triggered;
  };

  return (
    <div className="space-y-8 font-body-news text-[#1A1918]">
      {/* Portfolio Title Section */}
      <div className="border-b-4 border-[#1A1918] pb-4 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <span className="font-mono-news text-xs font-bold uppercase text-[#A82424] tracking-wider">
            READER INTELLIGENCE HUB
          </span>
          <h2 className="font-headline text-4xl sm:text-5xl font-extrabold uppercase tracking-tight mt-1">
            MY WATCHLIST & PORTFOLIO
          </h2>
          <p className="text-xs italic text-[#4A4744] mt-1">
            Analyze combined indexes, read the personal Gazette, and configure active alert guards.
          </p>
        </div>

        {/* Action button */}
        <div className="flex gap-2 font-mono-news text-xs">
          {selectedPackages.length >= 2 && (
            <button
              onClick={handleCompareSelected}
              className="px-4 py-2 bg-[#1A1918] hover:bg-[#A82424] text-white uppercase font-bold border-2 border-[#1A1918] shadow-[3px_3px_0px_#1A1918] transition-all cursor-pointer"
            >
              COMPARE SELECTED ({selectedPackages.length})
            </button>
          )}
        </div>
      </div>

      {watchlist.length === 0 ? (
        <div className="newspaper-card p-12 text-center max-w-xl mx-auto space-y-4">
          <div className="w-12 h-12 rounded-full border-2 border-[#1A1918] bg-[#EAE6DF] mx-auto flex items-center justify-center text-[#4A4744]">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-headline uppercase text-xl font-bold">PORTFOLIO IS EMPTY</h3>
            <p className="text-xs font-mono-news text-[#4A4744] mt-1">
              You are not tracking any packages yet. Search for packages and click the bookmark button to build your watch list.
            </p>
          </div>
          <button
            onClick={() => onSelectPackage('react')}
            className="px-4 py-2 bg-[#1A1918] hover:bg-[#A82424] text-white font-mono-news text-xs uppercase font-bold border-2 border-[#1A1918] shadow-[2px_2px_0px_#1A1918]"
          >
            Explore React Report
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Sub Navigation Bar for Portfolio Tabs */}
          <div className="flex border-b-2 border-[#1A1918] bg-[#EAE6DF] p-0.5 max-w-md font-mono-news text-xs font-bold uppercase">
            <button
              onClick={() => setPortfolioTab('index')}
              className={`flex-1 py-2 px-3 text-center transition-all ${
                portfolioTab === 'index' ? 'bg-[#1A1918] text-white' : 'hover:bg-white'
              }`}
            >
              <BarChart3 className="w-4 h-4 inline-block mr-1.5 -mt-0.5" /> DOW NPM INDEX
            </button>
            <button
              onClick={() => setPortfolioTab('gazette')}
              className={`flex-1 py-2 px-3 text-center transition-all ${
                portfolioTab === 'gazette' ? 'bg-[#1A1918] text-white' : 'hover:bg-white'
              }`}
            >
              <BookOpen className="w-4 h-4 inline-block mr-1.5 -mt-0.5" /> THE GAZETTE
            </button>
            <button
              onClick={() => setPortfolioTab('rules')}
              className={`flex-1 py-2 px-3 text-center transition-all ${
                portfolioTab === 'rules' ? 'bg-[#1A1918] text-white' : 'hover:bg-white'
              }`}
            >
              <Settings className="w-4 h-4 inline-block mr-1.5 -mt-0.5" /> RULES & ALERTS
            </button>
          </div>

          {/* DOW NPM INDEX TAB */}
          {portfolioTab === 'index' && (
            <div className="space-y-8 animate-fadeIn">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Financial Summary card */}
                <div className="lg:col-span-4 newspaper-card p-6 flex flex-col justify-between font-mono-news text-xs border-r-4">
                  <div>
                    <span className="font-bold text-[#A82424] text-[10px] uppercase block tracking-wider">
                      INDEX METRICS DISPATCH
                    </span>
                    <h3 className="font-headline text-3xl font-black uppercase mt-1">THE DOW NPM SHARE</h3>
                    <p className="italic text-[#4A4744] text-[11px] mt-0.5">
                      Synthesized trading volume metric tracking aggregate adoption trends.
                    </p>

                    <div className="mt-6 space-y-4 border-t border-dashed border-[#1A1918]/30 pt-4">
                      <div>
                        <span className="block text-[10px] text-[#4A4744] uppercase">COMBINED DOWNLOADS (30D)</span>
                        <span className="font-bold text-2xl">{totalVolume30d.toLocaleString()}</span>
                      </div>

                      <div>
                        <span className="block text-[10px] text-[#4A4744] uppercase">INDEX WEEKLY DIRECTION</span>
                        <span className={`font-bold text-lg flex items-center gap-1 ${
                          combinedWeeklyChange >= 0 ? 'text-emerald-700' : 'text-[#A82424]'
                        }`}>
                          {combinedWeeklyChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                          {combinedWeeklyChange >= 0 ? '+' : ''}{combinedWeeklyChange}% WoW
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-[#1A1918] pt-4 mt-6 text-[10px] leading-relaxed text-[#4A4744]">
                    <span className="font-bold">METHODOLOGY:</span> Sum of historical daily downloads for all tracked portfolio package assets. Updated in real-time.
                  </div>
                </div>

                {/* Index Area Chart */}
                <div className="lg:col-span-8 newspaper-card p-6">
                  <h4 className="font-headline text-lg font-bold uppercase tracking-tight mb-4 flex items-center gap-1.5 border-b border-[#1A1918]/10 pb-2">
                    <TrendingUp className="w-4 h-4 text-[#A82424]" /> Aggregated Index Volume Trend
                  </h4>
                  {aggregatedDownloads.length > 0 ? (
                    <PortfolioIndexChart aggregatedData={aggregatedDownloads} />
                  ) : (
                    <div className="h-[200px] flex items-center justify-center font-mono-news text-xs text-[#4A4744]">
                      [LOADING AGGREGATED TELEGRAMS...]
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Watchlist Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {watchlist.map(p => {
                  const lowerName = p.name.toLowerCase();
                  const data = liveData[lowerName];
                  
                  if (!data || data.loading) {
                    return (
                      <div key={p.name} className="newspaper-card p-6 flex flex-col items-center justify-center min-h-[160px]">
                        <Loader2 className="w-6 h-6 text-[#A82424] animate-spin" />
                      </div>
                    );
                  }

                  if (data.error) {
                    return (
                      <div key={p.name} className="newspaper-card p-6 flex flex-col justify-between border-rose-800 text-xs">
                        <span className="font-bold text-rose-800">[{p.name.toUpperCase()}] ERROR LOADING DATA</span>
                      </div>
                    );
                  }

                  const trRules = getTriggeredRules(data);

                  return (
                    <div key={p.name} className={`newspaper-card p-6 flex flex-col justify-between ${trRules.length > 0 ? 'border-[#A82424]' : ''}`}>
                      <div className="space-y-2">
                        <div className="flex justify-between items-start gap-1">
                          <div className="flex items-center gap-1.5 truncate max-w-[80%]">
                            <button onClick={() => handleToggleSelect(p.name)} className="text-[#1A1918]">
                              {selectedPackages.includes(p.name) ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                            </button>
                            <h4 className="font-headline font-bold text-lg uppercase truncate cursor-pointer" onClick={() => onSelectPackage(p.name)}>
                              {p.name}
                            </h4>
                          </div>
                          <span className="font-mono-news text-[10px] border border-[#1A1918] bg-[#EAE6DF] px-1 font-bold">
                            v{data.metadata?.latestVersion}
                          </span>
                        </div>

                        {trRules.length > 0 && (
                          <div className="p-1.5 bg-[#E8C4C4] border border-[#A82424] text-[9px] font-mono-news font-bold text-[#A82424] flex items-center gap-1 animate-pulse">
                            <AlertTriangle className="w-3 h-3" />
                            <span>RULES BREACH: {trRules.length} ACTIVATED</span>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-dashed border-[#1A1918]/20 font-mono-news text-[11px]">
                        <div>
                          <span className="block text-[9px] text-[#4A4744]">WEEKLY DLs</span>
                          <span className="font-bold text-xs">{data.currentDownloads.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="block text-[9px] text-[#4A4744]">GROWTH RATE</span>
                          <span className={`font-bold text-xs ${data.weeklyChange >= 0 ? 'text-emerald-700' : 'text-[#A82424]'}`}>
                            {data.weeklyChange >= 0 ? '+' : ''}{data.weeklyChange}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* THE GAZETTE TAB */}
          {portfolioTab === 'gazette' && (
            <div className="newspaper-card p-6 sm:p-8 animate-fadeIn">
              <PortfolioGazette
                liveDataList={Object.values(liveData)}
                overallWeeklyChange={combinedWeeklyChange}
                overallVolume={totalVolume30d}
              />
            </div>
          )}

          {/* RULES & ALERTS CONFIGURATOR TAB */}
          {portfolioTab === 'rules' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="newspaper-card p-6 space-y-4">
                <h3 className="font-headline text-2xl font-bold uppercase tracking-tight flex items-center gap-1.5">
                  <BellRing className="w-5 h-5 text-[#A82424]" /> ACTIVE ALERT TRIGGER CONTROL
                </h3>
                <p className="text-xs italic text-[#4A4744] font-body-news">
                  Define triggers based on Star Milestones, Download Drops, or Version Updates. Portfolio rules-guards will monitor incoming telemetry dispatches and flag breaches immediately.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {watchlist.map(p => {
                  const lowerName = p.name.toLowerCase();
                  const data = liveData[lowerName];
                  const rules = p.rules || [];

                  if (!data || data.loading) return null;

                  const trRules = getTriggeredRules(data);

                  return (
                    <div key={p.name} className="newspaper-card p-6 space-y-6">
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-[#1A1918] pb-3">
                        <div>
                          <h4 className="font-headline text-xl font-bold uppercase">{p.name}</h4>
                          <p className="text-[10px] font-mono-news text-[#4A4744]">
                            Tracked since {new Date(p.addedAt).toLocaleDateString()} • Stars: {(data.metadata?.github?.stars || 0).toLocaleString()}
                          </p>
                        </div>
                        <button
                          onClick={() => handleUntrack(p.name)}
                          className="self-start sm:self-center px-3 py-1.5 bg-[#EAE6DF] hover:bg-rose-800 hover:text-white border border-[#1A1918] font-mono-news text-[10px] uppercase font-bold transition-all cursor-pointer flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> untrack asset
                        </button>
                      </div>

                      {/* Display Triggered Rules Warnings */}
                      {trRules.length > 0 && (
                        <div className="space-y-2">
                          <h5 className="font-mono-news text-[10px] font-bold text-[#A82424] uppercase flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> ACTIVE TELEGRAPH ALERTS:
                          </h5>
                          <div className="space-y-1.5">
                            {trRules.map((tr, idx) => (
                              <div key={idx} className="p-3 bg-[#E8C4C4] border-l-4 border-[#A82424] text-xs font-mono-news font-bold text-[#A82424]">
                                {tr.message}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
                        {/* Current Rules List */}
                        <div className="lg:col-span-7 space-y-3 font-mono-news text-xs">
                          <h5 className="font-bold uppercase border-b border-[#1A1918]/10 pb-1 flex items-center gap-1">
                            <ShieldCheck className="w-4 h-4" /> Configured Guard Rules ({rules.length + 1})
                          </h5>
                          
                          {/* Base legacy rule */}
                          <div className="flex justify-between items-center p-2.5 bg-[#FBF9F5] border border-[#1A1918]/20">
                            <div>
                              <span className="font-bold uppercase">[System] WoW Change</span>
                              <span className="block text-[10px] text-[#4A4744]">Alert on &gt;{p.alertThreshold}% weekly drop</span>
                            </div>
                            <span className="font-bold text-emerald-700">SYSTEM GUARD</span>
                          </div>

                          {/* Custom rules */}
                          {rules.map(rule => (
                            <div key={rule.id} className="flex justify-between items-center p-2.5 bg-[#FBF9F5] border border-[#1A1918]/30">
                              <div>
                                <span className="font-bold uppercase">
                                  {rule.type === 'wow_change' ? 'WoW Change' : rule.type === 'star_count' ? 'Star Milestone' : 'Version Watch'}
                                </span>
                                <span className="block text-[10px] text-[#4A4744]">
                                  {rule.type === 'wow_change' && `Alert on >${rule.threshold}% drop`}
                                  {rule.type === 'star_count' && `Alert on stars >= ${(parseInt(rule.threshold as string) || 0).toLocaleString()}`}
                                  {rule.type === 'version_bump' && 'Alert on new release'}
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => handleToggleRuleActive(p.name, rule.id)}
                                  className={`px-2 py-0.5 border text-[9px] font-bold uppercase transition-all ${
                                    rule.isActive ? 'bg-[#1A1918] text-white border-[#1A1918]' : 'bg-[#EAE6DF] text-[#4A4744] border-[#1A1918]/20'
                                  }`}
                                >
                                  {rule.isActive ? 'active' : 'disabled'}
                                </button>
                                <button 
                                  onClick={() => handleRemoveRule(p.name, rule.id)} 
                                  className="text-rose-800 hover:text-black"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Add Rule Form */}
                        <div className="lg:col-span-5 p-4 bg-[#EAE6DF]/40 border border-[#1A1918]/35 font-mono-news text-xs space-y-3">
                          <h5 className="font-bold uppercase border-b border-[#1A1918]/10 pb-1 flex items-center gap-1">
                            <Plus className="w-4 h-4" /> Create Guard Rule
                          </h5>
                          
                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold uppercase">Rule Type</label>
                            <select
                              value={newRuleType}
                              onChange={(e: any) => {
                                setNewRuleType(e.target.value);
                                if (e.target.value === 'star_count') setNewRuleThreshold('100000');
                                if (e.target.value === 'wow_change') setNewRuleThreshold('15');
                              }}
                              className="w-full bg-[#FBF9F5] border border-[#1A1918] py-1 px-2 focus:outline-none"
                            >
                              <option value="wow_change">WoW Drop Alert (Downloads)</option>
                              <option value="star_count">Star Milestone Alert (GitHub)</option>
                              <option value="version_bump">Version Publish Alert (NPM)</option>
                            </select>
                          </div>

                          {newRuleType !== 'version_bump' && (
                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold uppercase">
                                {newRuleType === 'wow_change' ? 'Trigger Threshold (%)' : 'Target Star Count'}
                              </label>
                              <input
                                type="text"
                                value={newRuleThreshold}
                                onChange={(e) => setNewRuleThreshold(e.target.value)}
                                className="w-full bg-[#FBF9F5] border border-[#1A1918] py-1 px-2 focus:outline-none"
                                placeholder={newRuleType === 'wow_change' ? 'e.g. 15' : 'e.g. 50000'}
                              />
                            </div>
                          )}

                          <button
                            onClick={() => handleAddRule(p.name)}
                            className="w-full py-1.5 bg-[#1A1918] hover:bg-[#A82424] text-white font-bold uppercase border border-[#1A1918] shadow-[1px_1px_0px_#1A1918] cursor-pointer text-center"
                          >
                            Add Alert Guard
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
