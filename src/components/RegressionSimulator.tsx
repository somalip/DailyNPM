import React, { useState, useEffect } from 'react';
import { DownloadPoint, RegressionModelType } from '../types';
import { computeDownloadRegression } from '../utils/regressionEngine';
import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { TrendingUp, Sparkles, Sliders, RefreshCw, BarChart, FileJson } from 'lucide-react';

interface RegressionSimulatorProps {
  downloads: DownloadPoint[];
  createdDate: string | undefined;
  packageName: string;
}

export const RegressionSimulator: React.FC<RegressionSimulatorProps> = ({
  downloads,
  createdDate,
  packageName,
}) => {
  const [modelType, setModelType] = useState<RegressionModelType>('seasonal_linear');
  const [forecastDays, setForecastDays] = useState<number>(14);
  
  // Simulation parameters
  const [simulationType, setSimulationType] = useState<'none' | 'flat_add' | 'compound' | 'event_shock'>('none');
  const [simulationValue, setSimulationValue] = useState<number>(10); // flat additions (in thousands) or compound percent
  const [shockDay, setShockDay] = useState<number>(3); // day of forecast shock happens
  
  const [chartData, setChartData] = useState<any[]>([]);
  const [regResults, setRegResults] = useState<any>(null);

  const runSimulation = () => {
    if (!downloads || downloads.length === 0) return;

    // 1. Run standard regression on historical data
    const baseReg = computeDownloadRegression(downloads, createdDate, modelType, forecastDays);
    setRegResults(baseReg);

    // 2. Build projection points with simulated vectors
    const historicalPoints = downloads.map(d => ({
      day: d.day,
      downloads: d.downloads,
      isForecast: false,
      modelPredicted: null,
      simulatedPredicted: null,
      lowerBound: null,
      upperBound: null
    }));

    // Generate forecast points
    const forecastPoints = baseReg.projectedDays.map((pt, index) => {
      let simValue = pt.downloads;

      if (simulationType === 'flat_add') {
        // Add a flat number of downloads (value is in thousands)
        simValue += simulationValue * 1000;
      } else if (simulationType === 'compound') {
        // Compounding growth percentage per day
        const compoundingFactor = Math.pow(1 + simulationValue / 100, index + 1);
        simValue = Math.round(simValue * compoundingFactor);
      } else if (simulationType === 'event_shock') {
        // Trigger a shock drop/spike on specific day
        if (index >= shockDay) {
          const multiplier = 1 + simulationValue / 100;
          simValue = Math.round(simValue * multiplier);
        }
      }

      // Re-calculate confidence interval for simulation
      const spread = pt.upperBound - pt.downloads;
      const simLower = Math.max(0, Math.round(simValue - spread));
      const simUpper = Math.round(simValue + spread);

      return {
        day: pt.day,
        downloads: null, // no historical downloads here
        isForecast: true,
        modelPredicted: pt.downloads,
        simulatedPredicted: simValue,
        lowerBound: simLower,
        upperBound: simUpper
      };
    });

    // Format dates for display
    const formattedHistorical = historicalPoints.slice(-14).map(pt => ({
      ...pt,
      formattedDate: formatDate(pt.day)
    }));

    const formattedForecast = forecastPoints.map(pt => ({
      ...pt,
      formattedDate: formatDate(pt.day) + " (F)"
    }));

    setChartData([...formattedHistorical, ...formattedForecast]);
  };

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

  useEffect(() => {
    runSimulation();
  }, [downloads, modelType, forecastDays, simulationType, simulationValue, shockDay]);

  const total30dSim = regResults ? regResults.next30DaysPredictedDownloads : 0;
  const growthRate = regResults ? regResults.dailyGrowthRatePercent : 0;

  return (
    <div className="newspaper-card p-6 space-y-6 text-[#1A1918]">
      {/* Title Header */}
      <div className="border-b-2 border-[#1A1918] pb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#A82424]" />
          <h3 className="font-headline text-2xl font-bold uppercase tracking-tight">
            PREDICTIVE FORECASTING SIMULATOR
          </h3>
        </div>
        <span className="font-mono-news text-[10px] bg-[#1A1918] text-white px-2 py-0.5 uppercase tracking-wider font-bold">
          Beta Sandbox
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Controls Column */}
        <div className="lg:col-span-4 space-y-5 border-b lg:border-b-0 lg:border-r border-dashed border-[#1A1918]/30 pb-6 lg:pb-0 lg:pr-6 font-mono-news text-xs">
          
          {/* Model Selection */}
          <div className="space-y-2">
            <label className="block font-bold uppercase flex items-center gap-1">
              <BarChart className="w-3.5 h-3.5" /> 1. SELECT REGRESSION ALGORITHM
            </label>
            <div className="flex flex-col gap-1">
              {[
                { type: 'seasonal_linear', label: 'Seasonal Linear (OLS)', desc: 'Deseasonalized ordinary least squares' },
                { type: 'moving_average', label: 'EMA Trend', desc: 'Exponential moving average baseline' },
                { type: 'polynomial', label: 'Quadratic Curve', desc: 'Polynomial quadratic trend mapping' }
              ].map(m => (
                <button
                  key={m.type}
                  onClick={() => setModelType(m.type as RegressionModelType)}
                  className={`p-2 text-left border border-[#1A1918] transition-all cursor-pointer ${
                    modelType === m.type 
                      ? 'bg-[#1A1918] text-white font-bold' 
                      : 'bg-[#FBF9F5] hover:bg-[#EAE6DF]'
                  }`}
                >
                  <div className="font-bold uppercase text-[11px]">{m.label}</div>
                  <div className={`text-[9px] mt-0.5 ${modelType === m.type ? 'text-[#EAE6DF]' : 'text-[#4A4744]'}`}>
                    {m.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Forecast Days */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="font-bold uppercase">FORECAST WINDOW</label>
              <span className="font-bold underline">{forecastDays} Days</span>
            </div>
            <input
              type="range"
              min="7"
              max="30"
              value={forecastDays}
              onChange={(e) => setForecastDays(parseInt(e.target.value))}
              className="w-full accent-[#1A1918] cursor-pointer"
            />
          </div>

          {/* Growth Simulator Scenarios */}
          <div className="space-y-3 pt-3 border-t border-dashed border-[#1A1918]/30">
            <label className="block font-bold uppercase flex items-center gap-1 text-[#A82424]">
              <Sliders className="w-3.5 h-3.5" /> 2. GROWTH SCENARIO SIMULATOR
            </label>

            <select
              value={simulationType}
              onChange={(e: any) => {
                setSimulationType(e.target.value);
                if (e.target.value === 'flat_add') setSimulationValue(50);
                if (e.target.value === 'compound') setSimulationValue(2);
                if (e.target.value === 'event_shock') setSimulationValue(-30);
              }}
              className="w-full bg-[#FBF9F5] border-2 border-[#1A1918] py-1.5 px-2 focus:outline-none focus:bg-white"
            >
              <option value="none">No External Shock (Standard Baseline)</option>
              <option value="flat_add">Flat Download Boost (+N per day)</option>
              <option value="compound">Compounding Growth Vector (+N% daily)</option>
              <option value="event_shock">Sudden Shock Event (+N% on day X)</option>
            </select>

            {simulationType !== 'none' && (
              <div className="space-y-3 p-3.5 bg-[#EAE6DF]/60 border border-[#1A1918]/30 rounded-xs">
                {simulationType === 'flat_add' && (
                  <div className="space-y-1">
                    <div className="flex justify-between font-bold text-[10px]">
                      <span>BOOST VALUE:</span>
                      <span>+{simulationValue}k downloads/day</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="500"
                      value={simulationValue}
                      onChange={(e) => setSimulationValue(parseInt(e.target.value))}
                      className="w-full accent-[#1A1918]"
                    />
                  </div>
                )}

                {simulationType === 'compound' && (
                  <div className="space-y-1">
                    <div className="flex justify-between font-bold text-[10px]">
                      <span>DAILY COMPOUND GROWTH:</span>
                      <span>+{simulationValue}% / day</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="10"
                      step="0.5"
                      value={simulationValue}
                      onChange={(e) => setSimulationValue(parseFloat(e.target.value))}
                      className="w-full accent-[#1A1918]"
                    />
                  </div>
                )}

                {simulationType === 'event_shock' && (
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <div className="flex justify-between font-bold text-[10px]">
                        <span>SHOCK MAGNITUDE:</span>
                        <span className={simulationValue < 0 ? 'text-[#A82424]' : 'text-emerald-700'}>
                          {simulationValue}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="-90"
                        max="200"
                        value={simulationValue}
                        onChange={(e) => setSimulationValue(parseInt(e.target.value))}
                        className="w-full accent-[#1A1918]"
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between font-bold text-[10px]">
                        <span>TRIGGER DAY (IN FUTURE):</span>
                        <span>Day {shockDay}</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max={forecastDays - 2}
                        value={shockDay}
                        onChange={(e) => setShockDay(parseInt(e.target.value))}
                        className="w-full accent-[#1A1918]"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Chart Display Column */}
        <div className="lg:col-span-8 space-y-4 flex flex-col justify-between">
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 10, right: 10, bottom: 0, left: 10 }}
              >
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
                  formatter={(value: any, name: any) => {
                    const label = name === 'downloads' ? 'Historical DLs' : name === 'modelPredicted' ? 'Model Baseline' : 'Simulated Forecast';
                    return [`${Math.round(value).toLocaleString()} downloads`, label];
                  }}
                  labelStyle={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 'bold' }}
                  contentStyle={{ backgroundColor: '#F4F1EA', border: '2px solid #1A1918' }}
                />
                <Legend 
                  wrapperStyle={{ fontSize: 10, fontFamily: 'monospace' }} 
                  verticalAlign="top"
                  height={32}
                />
                
                {/* Historical Downloads */}
                <Line 
                  name="downloads" 
                  type="monotone" 
                  dataKey="downloads" 
                  stroke="#1A1918" 
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
                
                {/* Standard Model Forecast */}
                <Line 
                  name="modelPredicted" 
                  type="monotone" 
                  dataKey="modelPredicted" 
                  stroke="#4A4744" 
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  dot={false}
                />

                {/* Simulated Scenario Forecast */}
                {simulationType !== 'none' && (
                  <Line 
                    name="simulatedPredicted" 
                    type="monotone" 
                    dataKey="simulatedPredicted" 
                    stroke="#A82424" 
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Model Statistics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-[#EAE6DF] border-t-2 border-[#1A1918] font-mono-news text-[11px]">
            <div>
              <span className="block text-[9px] uppercase text-[#4A4744]">R² COEFFICIENT</span>
              <span className="font-bold text-sm underline text-[#1A1918]">
                {regResults ? (regResults.rSquared * 100).toFixed(1) : 0}%
              </span>
            </div>
            <div>
              <span className="block text-[9px] uppercase text-[#4A4744]">GROWTH VECTOR</span>
              <span className={`font-bold text-sm flex items-center gap-0.5 ${growthRate >= 0 ? 'text-emerald-700' : 'text-[#A82424]'}`}>
                {growthRate >= 0 ? '+' : ''}{growthRate}% / day
              </span>
            </div>
            <div>
              <span className="block text-[9px] uppercase text-[#4A4744]">FORECAST STRENGTH</span>
              <span className="font-bold text-sm uppercase text-[#1A1918]">
                {regResults ? regResults.algorithmStrengthLabel : 'Limited'}
              </span>
            </div>
            <div>
              <span className="block text-[9px] uppercase text-[#4A4744]">WEEKEND DIP</span>
              <span className="font-bold text-sm text-[#1A1918]">
                {regResults ? (100 - regResults.weekendDipRatio * 100).toFixed(0) : 0}% drop
              </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
