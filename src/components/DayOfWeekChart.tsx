import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { DownloadPoint } from '../types';
import { formatNumber } from '../utils/npmApi';
import { CalendarDays, Info, Newspaper } from 'lucide-react';

interface DayOfWeekChartProps {
  downloads: DownloadPoint[];
}

export const DayOfWeekChart: React.FC<DayOfWeekChartProps> = ({ downloads }) => {
  if (!downloads || downloads.length === 0) return null;

  const dowNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dowShorts = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  const dowTotals = [0, 0, 0, 0, 0, 0, 0];
  const dowCounts = [0, 0, 0, 0, 0, 0, 0];

  downloads.forEach((d) => {
    const dateObj = new Date(d.day + 'T00:00:00Z');
    const dow = dateObj.getUTCDay();
    dowTotals[dow] += d.downloads;
    dowCounts[dow]++;
  });

  const chartData = dowNames.map((name, i) => {
    const avg = dowCounts[i] > 0 ? Math.round(dowTotals[i] / dowCounts[i]) : 0;
    const isWeekend = i === 0 || i === 6;
    return {
      dayFull: name,
      dayShort: dowShorts[i],
      avgDownloads: avg,
      isWeekend,
    };
  });

  const overallAvg =
    chartData.reduce((acc, curr) => acc + curr.avgDownloads, 0) / Math.max(1, chartData.length);

  return (
    <div className="newspaper-card p-6 text-[#1A1918] space-y-4">
      <div className="flex items-center justify-between pb-2 border-b-2 border-[#1A1918]">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-[#A82424]" />
            <h3 className="font-headline text-xl font-bold uppercase tracking-tight">
              Day-of-Week Build Velocity Report
            </h3>
          </div>
          <p className="text-xs font-mono-news text-[#4A4744] mt-0.5">
            Commercial CI/CD pipeline builds (Mon-Fri) vs. Weekend editorial dip
          </p>
        </div>
      </div>

      <div className="h-52 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <XAxis
              dataKey="dayShort"
              stroke="#1A1918"
              fontSize={10}
              fontFamily="Courier Prime"
              tickLine={false}
              axisLine={{ stroke: '#1A1918', strokeWidth: 2 }}
            />
            <YAxis
              stroke="#1A1918"
              fontSize={10}
              fontFamily="Courier Prime"
              tickLine={false}
              axisLine={{ stroke: '#1A1918', strokeWidth: 2 }}
              tickFormatter={(v) => formatNumber(v)}
              width={55}
            />
            <Tooltip
              cursor={{ fill: 'rgba(26, 25, 24, 0.08)' }}
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const data = payload[0].payload;
                const diffPct = Math.round(((data.avgDownloads - overallAvg) / overallAvg) * 100);

                return (
                  <div className="bg-[#FBF9F5] border-2 border-[#1A1918] shadow-[3px_3px_0px_#1A1918] p-3 text-xs font-mono-news space-y-1 text-[#1A1918]">
                    <div className="font-bold border-b border-[#1A1918]/20 pb-1">{data.dayFull.toUpperCase()}</div>
                    <div className="font-bold text-[#1A1918]">
                      {formatNumber(data.avgDownloads)} downloads/day
                    </div>
                    <div
                      className={`text-[11px] font-bold ${
                        diffPct >= 0 ? 'text-emerald-800' : 'text-[#A82424]'
                      }`}
                    >
                      {diffPct >= 0 ? '+' : ''}
                      {diffPct}% vs daily average
                    </div>
                  </div>
                );
              }}
            />
            <Bar dataKey="avgDownloads" radius={[0, 0, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.isWeekend ? '#7A7570' : '#1A1918'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-[#EAE6DF] border-2 border-[#1A1918] p-3 text-[#1A1918] flex items-start gap-2.5">
        <Info className="w-4 h-4 text-[#A82424] shrink-0 mt-0.5" />
        <p className="leading-relaxed font-body-news text-xs">
          <strong className="font-headline font-bold">EDITORIAL NOTE ON SEASONALITY:</strong> Commercial CI/CD builds peak Monday through Friday, creating a distinct weekend dip. The Daily NPM regression engine multiplies forecasts by seasonal factors to prevent false alarms during weekend cycles.
        </p>
      </div>
    </div>
  );
};
