import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { DownloadPoint, RegressionResult } from '../types';
import { formatNumber } from '../utils/npmApi';
import { formatShortDate } from '../utils/regressionEngine';
import { Eye, Activity, LineChart } from 'lucide-react';

interface DownloadChartProps {
  downloads: DownloadPoint[];
  regression: RegressionResult;
  period: string;
  onPeriodChange: (period: string) => void;
  packageName: string;
}

export const DownloadChart: React.FC<DownloadChartProps> = ({
  downloads,
  regression,
  period,
  onPeriodChange,
  packageName,
}) => {
  const [showConfidenceBounds, setShowConfidenceBounds] = useState(true);

  // Combine historical downloads with future projected forecast points
  const sortedHistorical = [...downloads].sort((a, b) => a.day.localeCompare(b.day));

  const chartData = [
    ...sortedHistorical.map((d) => ({
      day: d.day,
      displayDate: formatShortDate(d.day),
      actualDownloads: d.downloads,
      forecastDownloads: null as number | null,
      lowerBound: null as number | null,
      upperBound: null as number | null,
      isForecast: false,
    })),
  ];

  // Attach last actual point to start forecast line seamlessly
  if (sortedHistorical.length > 0 && regression.projectedDays.length > 0) {
    const lastActual = sortedHistorical[sortedHistorical.length - 1];

    chartData[chartData.length - 1].forecastDownloads = lastActual.downloads;
    chartData[chartData.length - 1].lowerBound = lastActual.downloads;
    chartData[chartData.length - 1].upperBound = lastActual.downloads;

    regression.projectedDays.forEach((p) => {
      chartData.push({
        day: p.day,
        displayDate: formatShortDate(p.day),
        actualDownloads: null,
        forecastDownloads: p.downloads,
        lowerBound: p.lowerBound,
        upperBound: p.upperBound,
        isForecast: true,
      });
    });
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;

    return (
      <div className="bg-[#FBF9F5] border-2 border-[#1A1918] shadow-[3px_3px_0px_#1A1918] p-3 text-xs font-mono-news space-y-1.5 text-[#1A1918]">
        <div className="font-bold border-b border-[#1A1918]/30 pb-1 flex items-center justify-between gap-3">
          <span>DATE: {data.day}</span>
          {data.isForecast ? (
            <span className="bg-[#A82424] text-white px-1.5 py-0.2 text-[9px] uppercase font-bold">
              PROJECTION
            </span>
          ) : (
            <span className="opacity-70 text-[10px]">RECORDED</span>
          )}
        </div>

        {data.actualDownloads !== null && (
          <div className="flex items-center justify-between gap-4">
            <span className="opacity-80">VOLUME RECORDED:</span>
            <span className="font-bold text-[#1A1918]">
              {formatNumber(data.actualDownloads)}
            </span>
          </div>
        )}

        {data.forecastDownloads !== null && (
          <div className="flex items-center justify-between gap-4">
            <span className="font-bold text-[#A82424]">PREDICTED VOLUME:</span>
            <span className="font-bold text-[#A82424]">
              {formatNumber(data.forecastDownloads)}
            </span>
          </div>
        )}

        {data.isForecast && data.lowerBound !== null && data.upperBound !== null && (
          <div className="flex items-center justify-between gap-4 text-[10px] opacity-80 border-t border-[#1A1918]/20 pt-1">
            <span>CONFIDENCE BAND:</span>
            <span>
              {formatNumber(data.lowerBound)} - {formatNumber(data.upperBound)}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="newspaper-card p-6 text-[#1A1918] space-y-4">
      
      {/* Chart Newspaper Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b-2 border-[#1A1918]">
        <div>
          <div className="flex items-center gap-2">
            <LineChart className="w-5 h-5 text-[#A82424]" />
            <h3 className="font-headline text-2xl font-bold tracking-tight uppercase">
              Download Velocity Lithograph & Projection Graph
            </h3>
          </div>
          <p className="text-xs font-mono-news text-[#4A4744] mt-0.5">
            Historical trajectory & algorithmic forecast for <code className="bg-[#EAE6DF] px-1 border border-[#1A1918] text-xs font-mono-news">{packageName}</code>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Period Selector */}
          <div className="flex items-center gap-1 bg-[#EAE6DF] p-0.5 border border-[#1A1918] text-xs font-mono-news">
            {[
              { id: 'last-month', label: '30 DAYS' },
              { id: 'last-month-90', label: '90 DAYS' },
              { id: 'last-year', label: '1 YEAR' },
            ].map((p) => {
              const actualPeriod = p.id === 'last-month-90' ? 'last-month' : p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => onPeriodChange(actualPeriod)}
                  className={`px-3 py-1 uppercase font-bold transition-all ${
                    period === actualPeriod
                      ? 'bg-[#1A1918] text-white'
                      : 'text-[#1A1918] hover:bg-white'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Toggle Confidence Bounds */}
          <button
            onClick={() => setShowConfidenceBounds(!showConfidenceBounds)}
            className={`flex items-center gap-1 px-3 py-1 border-2 border-[#1A1918] font-mono-news text-xs uppercase font-bold transition-colors ${
              showConfidenceBounds
                ? 'bg-[#1A1918] text-white'
                : 'bg-[#EAE6DF] text-[#1A1918] hover:bg-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>CONFIDENCE BAND</span>
          </button>
        </div>
      </div>

      {/* Legend & Indicator Bar */}
      <div className="flex flex-wrap items-center gap-6 font-mono-news text-xs text-[#1A1918] pt-1">
        <span className="flex items-center gap-2 font-bold">
          <span className="w-3 h-3 bg-[#1A1918] inline-block border border-[#1A1918]" />
          RECORDED DOWNLOADS
        </span>
        <span className="flex items-center gap-2 font-bold text-[#A82424]">
          <span className="w-3 h-0.5 bg-[#A82424] border-b-2 border-dashed border-[#A82424] inline-block" />
          ALGORITHMIC FORECAST
        </span>
        {showConfidenceBounds && (
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 bg-[#1A1918]/15 border border-[#1A1918] inline-block" />
            95% CONFIDENCE BAND
          </span>
        )}
      </div>

      {/* Main Recharts Area */}
      <div className="h-80 w-full pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1A1918" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#1A1918" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#A82424" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#A82424" stopOpacity={0.0} />
              </linearGradient>
            </defs>

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
            <Tooltip content={<CustomTooltip />} />

            {showConfidenceBounds && (
              <Area
                type="monotone"
                dataKey="upperBound"
                stroke="none"
                fill="#1A1918"
                fillOpacity={0.1}
                connectNulls
              />
            )}

            <Area
              type="monotone"
              dataKey="actualDownloads"
              stroke="#1A1918"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#colorActual)"
              connectNulls
            />

            <Area
              type="monotone"
              dataKey="forecastDownloads"
              stroke="#A82424"
              strokeWidth={2.5}
              strokeDasharray="4 4"
              fillOpacity={1}
              fill="url(#colorForecast)"
              connectNulls
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

    </section>
  );
};
