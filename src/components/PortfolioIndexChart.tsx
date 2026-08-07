import React from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

interface PortfolioIndexChartProps {
  aggregatedData: { day: string; downloads: number; formattedDate?: string }[];
}

export const PortfolioIndexChart: React.FC<PortfolioIndexChartProps> = ({ aggregatedData }) => {
  const formatDate = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    } catch {}
    return dateStr;
  };

  const chartData = aggregatedData.map(pt => ({
    ...pt,
    formattedDate: formatDate(pt.day)
  }));

  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 10 }}>
          <defs>
            <linearGradient id="indexColor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#A82424" stopOpacity={0.2}/>
              <stop offset="95%" stopColor="#A82424" stopOpacity={0.0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis 
            dataKey="formattedDate" 
            stroke="#1A1918" 
            tick={{ fontSize: 9, fontFamily: 'monospace' }}
          />
          <YAxis 
            stroke="#1A1918" 
            tickFormatter={(val) => val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : `${Math.round(val / 1000)}k`}
            tick={{ fontSize: 9, fontFamily: 'monospace' }}
          />
          <Tooltip 
            formatter={(value: any) => [`${Math.round(value).toLocaleString()} downloads`, 'Index Volume']}
            labelStyle={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 'bold' }}
            contentStyle={{ backgroundColor: '#F4F1EA', border: '2px solid #1A1918' }}
          />
          <Area 
            type="monotone" 
            dataKey="downloads" 
            stroke="#A82424" 
            strokeWidth={2} 
            fillOpacity={1} 
            fill="url(#indexColor)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
