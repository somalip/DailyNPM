import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { ComparisonPackage } from '../types';
import { comparePackagesBatch, formatNumber, POPULAR_PRESETS } from '../utils/npmApi';
import { computeDownloadRegression, formatShortDate } from '../utils/regressionEngine';
import { Plus, X, Layers, Sparkles, TrendingUp, RefreshCw, Landmark } from 'lucide-react';

interface ComparisonViewProps {
  initialPackages: string[];
  onSelectMainPackage: (pkgName: string) => void;
}

const PACKAGE_COLORS = [
  '#1A1918', // Ink Black
  '#A82424', // Editorial Red
  '#15803d', // Deep Green
  '#b45309', // Vintage Amber
  '#1d4ed8', // Ink Blue
  '#6b21a8', // Deep Purple
];

export const ComparisonView: React.FC<ComparisonViewProps> = ({
  initialPackages,
  onSelectMainPackage,
}) => {
  const [packageList, setPackageList] = useState<string[]>(initialPackages);
  const [newPackageInput, setNewPackageInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [comparisonData, setComparisonData] = useState<ComparisonPackage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadComparison = async (pkgs: string[]) => {
    if (pkgs.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const data = await comparePackagesBatch(pkgs, 'last-month');
      const results = data.results || {};

      const list: ComparisonPackage[] = [];

      pkgs.forEach((name, idx) => {
        const item = results[name];
        if (!item) return;

        const downloads = item.downloads || [];
        const info = item.info;

        const reg = computeDownloadRegression(downloads, info?.created);

        const total30d = downloads.reduce((acc: number, d: any) => acc + d.downloads, 0);
        const avgDaily = downloads.length > 0 ? Math.round(total30d / downloads.length) : 0;

        list.push({
          name,
          info,
          downloads,
          color: PACKAGE_COLORS[idx % PACKAGE_COLORS.length],
          predictedNextDay: reg.nextDayPredictedDownloads,
          total30dDownloads: total30d,
          avgDailyDownloads: avgDaily,
        });
      });

      setComparisonData(list);
    } catch (err: any) {
      setError(err.message || 'Failed to compare packages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComparison(packageList);
  }, [packageList]);

  const handleAddPackage = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newPackageInput.trim().toLowerCase();
    if (clean && !packageList.includes(clean)) {
      setPackageList([...packageList, clean]);
      setNewPackageInput('');
    }
  };

  const handleRemovePackage = (name: string) => {
    if (packageList.length <= 1) return;
    setPackageList(packageList.filter((p) => p !== name));
  };

  // Build combined merged chart timeline
  const dayMap = new Map<string, Record<string, number>>();

  comparisonData.forEach((pkg) => {
    pkg.downloads.forEach((d) => {
      const existing = dayMap.get(d.day) || {};
      existing[pkg.name] = d.downloads;
      dayMap.set(d.day, existing);
    });
  });

  const mergedChartData = Array.from(dayMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, values]) => ({
      day,
      displayDate: formatShortDate(day),
      ...values,
    }));

  return (
    <div className="space-y-6 text-[#1A1918]">
      
      {/* Top Newspaper Financial Controller Bar */}
      <div className="newspaper-card p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b-2 border-[#1A1918]">
          <div>
            <div className="flex items-center gap-2">
              <Landmark className="w-5 h-5 text-[#A82424]" />
              <h2 className="font-headline text-2xl font-bold tracking-tight uppercase">
                Financial & Market Exchange Page
              </h2>
            </div>
            <p className="text-xs font-mono-news text-[#4A4744] mt-1">
              Side-by-side volume ticker overlays, velocity indices, and comparative growth projections
            </p>
          </div>

          <form onSubmit={handleAddPackage} className="flex items-center gap-2">
            <input
              type="text"
              value={newPackageInput}
              onChange={(e) => setNewPackageInput(e.target.value)}
              placeholder="Add package ticker..."
              className="bg-[#EAE6DF] text-[#1A1918] placeholder-[#7A7570] font-mono-news text-xs px-3 py-1.5 border-2 border-[#1A1918] focus:outline-none focus:bg-white shadow-[2px_2px_0px_#1A1918] w-48 sm:w-60"
            />
            <button
              type="submit"
              className="bg-[#1A1918] hover:bg-[#A82424] text-white font-mono-news text-xs uppercase font-bold px-3.5 py-1.5 border-2 border-[#1A1918] transition-colors flex items-center gap-1 shrink-0"
            >
              <Plus className="w-4 h-4" /> ADD TICKER
            </button>
          </form>
        </div>

        {/* Package Chips Bar */}
        <div className="flex flex-wrap items-center gap-2 font-mono-news text-xs">
          <span className="font-bold uppercase text-[10px] text-[#A82424]">ACTIVE MARKET INDEX:</span>
          {packageList.map((pkgName, i) => {
            const color = PACKAGE_COLORS[i % PACKAGE_COLORS.length];
            return (
              <span
                key={pkgName}
                className="inline-flex items-center gap-2 px-3 py-1 bg-[#EAE6DF] border-2 border-[#1A1918] shadow-[2px_2px_0px_#1A1918] font-bold"
              >
                <span className="w-2.5 h-2.5 rounded-none border border-[#1A1918]" style={{ backgroundColor: color }} />
                <span>{pkgName.toUpperCase()}</span>
                {packageList.length > 1 && (
                  <button
                    onClick={() => handleRemovePackage(pkgName)}
                    className="hover:text-[#A82424] p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </span>
            );
          })}
        </div>

        {/* Quick Category Presets */}
        <div className="flex flex-wrap items-center gap-2 font-mono-news text-xs pt-2 border-t border-[#1A1918]/20">
          <span className="opacity-70 text-[10px] uppercase font-bold">EXCHANGE BENCHMARKS:</span>
          {POPULAR_PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => setPackageList(preset.packages)}
              className="px-2 py-0.5 bg-[#FBF9F5] hover:bg-[#1A1918] hover:text-white text-[#1A1918] border border-[#1A1918] text-[10px] uppercase font-bold transition-colors"
            >
              [{preset.label}]
            </button>
          ))}
        </div>
      </div>

      {/* Main Multi-Line Comparison Chart */}
      <div className="newspaper-card p-6 space-y-4">
        <div className="flex items-center justify-between border-b-2 border-[#1A1918] pb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#A82424]" />
            <h3 className="font-headline text-xl font-bold uppercase tracking-tight">
              30-Day Market Volume Comparison Lithograph
            </h3>
          </div>
          {loading && (
            <span className="font-mono-news text-xs text-[#A82424] flex items-center gap-1.5 animate-pulse font-bold">
              <RefreshCw className="w-4 h-4 animate-spin" /> FETCHING TICKER DATA...
            </span>
          )}
        </div>

        {error ? (
          <div className="p-4 bg-[#EAE6DF] border-2 border-[#1A1918] text-[#A82424] font-mono-news text-xs">
            [TELEGRAPH WIRE ERROR]: {error}
          </div>
        ) : (
          <div className="h-80 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mergedChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1A1918" strokeOpacity={0.2} vertical={false} />
                <XAxis
                  dataKey="displayDate"
                  stroke="#1A1918"
                  fontSize={10}
                  fontFamily="Courier Prime"
                  tickLine={false}
                  axisLine={{ stroke: '#1A1918', strokeWidth: 2 }}
                  minTickGap={25}
                />
                <YAxis
                  stroke="#1A1918"
                  fontSize={10}
                  fontFamily="Courier Prime"
                  tickLine={false}
                  axisLine={{ stroke: '#1A1918', strokeWidth: 2 }}
                  tickFormatter={(v) => formatNumber(v)}
                  width={60}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    return (
                      <div className="bg-[#FBF9F5] border-2 border-[#1A1918] shadow-[3px_3px_0px_#1A1918] p-3 text-xs font-mono-news space-y-2 text-[#1A1918]">
                        <div className="font-bold border-b border-[#1A1918]/20 pb-1">
                          DATE: {label}
                        </div>
                        {payload.map((p: any) => (
                          <div key={p.name} className="flex items-center justify-between gap-6">
                            <span className="flex items-center gap-1.5 font-bold" style={{ color: p.color }}>
                              <span className="w-2 h-2" style={{ backgroundColor: p.color }} />
                              {p.name.toUpperCase()}:
                            </span>
                            <span className="font-mono-news font-bold">
                              {formatNumber(p.value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                <Legend
                  wrapperStyle={{ paddingTop: '15px', fontSize: '11px', fontFamily: 'Courier Prime' }}
                  formatter={(value) => <span className="text-[#1A1918] font-bold uppercase">{value}</span>}
                />
                {comparisonData.map((pkg) => (
                  <Line
                    key={pkg.name}
                    type="monotone"
                    dataKey={pkg.name}
                    stroke={pkg.color}
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5, stroke: '#1A1918', strokeWidth: 2 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Side-by-Side Stock Exchange Table */}
      <div className="newspaper-card p-6 space-y-4">
        <div className="flex items-center gap-2 border-b-2 border-[#1A1918] pb-3">
          <Sparkles className="w-5 h-5 text-[#A82424]" />
          <h3 className="font-headline text-xl font-bold uppercase tracking-tight">
            The Daily NPM Financial Table & Stock Quotes
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono-news text-xs border-2 border-[#1A1918]">
            <thead>
              <tr className="bg-[#EAE6DF] border-b-2 border-[#1A1918] text-[#1A1918] font-bold uppercase text-[10px]">
                <th className="py-2.5 px-3 border-r border-[#1A1918]">TICKER / PACKAGE</th>
                <th className="py-2.5 px-3 border-r border-[#1A1918]">30D VOLUME</th>
                <th className="py-2.5 px-3 border-r border-[#1A1918]">DAILY VELOCITY</th>
                <th className="py-2.5 px-3 border-r border-[#1A1918]">NEXT-DAY EST.</th>
                <th className="py-2.5 px-3 border-r border-[#1A1918]">VERSION</th>
                <th className="py-2.5 px-3 border-r border-[#1A1918]">DEPENDENCIES</th>
                <th className="py-2.5 px-3 border-r border-[#1A1918]">LICENSE</th>
                <th className="py-2.5 px-3 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A1918]/20 text-[#1A1918]">
              {comparisonData.map((item) => (
                <tr key={item.name} className="hover:bg-[#EAE6DF] transition-colors">
                  <td className="py-2.5 px-3 font-bold border-r border-[#1A1918]/30 flex items-center gap-2">
                    <span className="w-2.5 h-2.5" style={{ backgroundColor: item.color }} />
                    <span className="text-sm font-extrabold">{item.name}</span>
                  </td>
                  <td className="py-2.5 px-3 font-bold border-r border-[#1A1918]/30">
                    {formatNumber(item.total30dDownloads)}
                  </td>
                  <td className="py-2.5 px-3 border-r border-[#1A1918]/30">
                    {formatNumber(item.avgDailyDownloads)}/day
                  </td>
                  <td className="py-2.5 px-3 font-extrabold text-emerald-800 bg-emerald-50 border-r border-[#1A1918]/30">
                    {formatNumber(item.predictedNextDay)}
                  </td>
                  <td className="py-2.5 px-3 border-r border-[#1A1918]/30">
                    v{item.info?.latestVersion || 'unknown'}
                  </td>
                  <td className="py-2.5 px-3 border-r border-[#1A1918]/30">
                    {item.info?.dependenciesCount || 0} DEPS
                  </td>
                  <td className="py-2.5 px-3 border-r border-[#1A1918]/30">
                    {item.info?.license || 'N/A'}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => onSelectMainPackage(item.name)}
                      className="px-2.5 py-1 bg-[#1A1918] hover:bg-[#A82424] text-white font-mono-news text-[10px] uppercase font-bold transition-colors"
                    >
                      READ REPORT
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
