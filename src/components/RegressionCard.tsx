import React from 'react';
import { RegressionResult, RegressionModelType } from '../types';
import { formatNumber } from '../utils/npmApi';
import { TrendingUp, Activity, Info, Sliders, SunMedium } from 'lucide-react';

interface RegressionCardProps {
  regression: RegressionResult;
  modelType: RegressionModelType;
  setModelType: (type: RegressionModelType) => void;
  packageName: string;
}

export const RegressionCard: React.FC<RegressionCardProps> = ({
  regression,
  modelType,
  setModelType,
  packageName,
}) => {
  return (
    <section className="newspaper-card p-6 text-[#1A1918] space-y-6">
      
      {/* Newspaper Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-[#1A1918]">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-[#1A1918] text-white px-2 py-0.5 font-mono-news text-[10px] uppercase font-bold tracking-wider">
              FORECAST BUREAU
            </span>
            <h3 className="font-headline text-2xl font-bold tracking-tight uppercase">
              Predictive Download Weather & Regression Bureau
            </h3>
          </div>
          <p className="text-xs font-mono-news text-[#4A4744] mt-1">
            Algorithmic estimation engine incorporating day-of-week seasonality, linear OLS, and sample age.
          </p>
        </div>

        {/* Model Switcher */}
        <div className="flex items-center gap-1 bg-[#EAE6DF] p-1 border-2 border-[#1A1918] self-start sm:self-auto font-mono-news">
          <Sliders className="w-4 h-4 text-[#A82424] ml-1.5 mr-0.5" />
          {[
            { id: 'seasonal_linear', label: 'SEASONAL OLS' },
            { id: 'moving_average', label: 'EMA-7' },
            { id: 'polynomial', label: 'POLYNOMIAL' },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setModelType(m.id as RegressionModelType)}
              className={`px-2.5 py-1 text-[11px] uppercase transition-all font-bold ${
                modelType === m.id
                  ? 'bg-[#1A1918] text-white'
                  : 'text-[#1A1918] hover:bg-white'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Prediction Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono-news">
        
        {/* Next Day Box */}
        <div className="bg-[#EAE6DF] p-4 border-2 border-[#1A1918] shadow-[3px_3px_0px_#1A1918] relative">
          <div className="flex items-center justify-between border-b border-[#1A1918]/30 pb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#A82424]">
              TOMORROW'S FORECAST
            </span>
            <span className="bg-[#1A1918] text-white text-[9px] px-1.5 py-0.5 uppercase font-bold">
              TARGET DAY +1
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#1A1918] tracking-tight">
              {formatNumber(regression.nextDayPredictedDownloads)}
            </span>
            <span className="text-xs text-[#4A4744]">downloads</span>
          </div>

          <div className="mt-4 pt-3 border-t border-[#1A1918]/20 text-xs flex items-center justify-between">
            <span className="opacity-70 text-[10px]">95% CONFIDENCE BAND:</span>
            <span className="font-extrabold text-[#1A1918]">
              {formatNumber(regression.lowerBound)} – {formatNumber(regression.upperBound)}
            </span>
          </div>
        </div>

        {/* 7-Day Cumulative */}
        <div className="bg-[#EAE6DF] p-4 border-2 border-[#1A1918] shadow-[3px_3px_0px_#1A1918]">
          <div className="flex items-center justify-between border-b border-[#1A1918]/30 pb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#1A1918]">
              7-DAY CUMULATIVE FORECAST
            </span>
            <TrendingUp className="w-4 h-4 text-[#A82424]" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#1A1918]">
              {formatNumber(regression.next7DaysPredictedDownloads)}
            </span>
            <span className="text-xs text-[#4A4744]">est. downloads</span>
          </div>

          <div className="mt-4 pt-3 border-t border-[#1A1918]/20 text-xs flex items-center justify-between">
            <span className="opacity-70 text-[10px]">DAILY PACE:</span>
            <span className="font-extrabold text-emerald-800">
              ~{formatNumber(Math.round(regression.next7DaysPredictedDownloads / 7))}/day
            </span>
          </div>
        </div>

        {/* 30-Day Cumulative */}
        <div className="bg-[#EAE6DF] p-4 border-2 border-[#1A1918] shadow-[3px_3px_0px_#1A1918]">
          <div className="flex items-center justify-between border-b border-[#1A1918]/30 pb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#1A1918]">
              30-DAY CUMULATIVE FORECAST
            </span>
            <Activity className="w-4 h-4 text-[#1A1918]" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#1A1918]">
              {formatNumber(regression.next30DaysPredictedDownloads)}
            </span>
            <span className="text-xs text-[#4A4744]">est. downloads</span>
          </div>

          <div className="mt-4 pt-3 border-t border-[#1A1918]/20 text-xs flex items-center justify-between">
            <span className="opacity-70 text-[10px]">GROWTH PACING:</span>
            <span className={`font-extrabold ${regression.dailyGrowthRatePercent >= 0 ? 'text-emerald-800' : 'text-[#A82424]'}`}>
              {regression.dailyGrowthRatePercent >= 0 ? '+' : ''}{regression.dailyGrowthRatePercent}% / day
            </span>
          </div>
        </div>
      </div>

      {/* Statistical Explanation Banner */}
      <div className="bg-[#EAE6DF] border-2 border-[#1A1918] p-4 text-xs font-mono-news space-y-3">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-[#1A1918] text-white shrink-0">
            <SunMedium className="w-5 h-5 text-amber-400" />
          </div>
          <div className="space-y-1 flex-1">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-[#1A1918]/20 pb-1">
              <span className="font-bold text-[#1A1918] uppercase">
                ALGORITHM ACCURACY SCORE: <span className="underline text-[#A82424]">{regression.algorithmStrengthScore}% ({regression.algorithmStrengthLabel} CONFIDENCE)</span>
              </span>
              <span className="text-[11px]">
                PACKAGE TENURE: <strong>{regression.packageAgeFormatted}</strong>
              </span>
            </div>
            <p className="text-[#1A1918] leading-relaxed font-body-news text-xs pt-1">
              <strong className="font-headline font-bold uppercase">METHODOLOGY NOTE:</strong> Sample size reliability scales directly with package age. Since <code className="bg-[#FBF9F5] px-1 border border-[#1A1918] font-mono-news text-xs">{packageName}</code> has been active for {regression.packageAgeFormatted} with {regression.dataPointsCount} recorded daily observations, the OLS regression formula achieves a confidence coefficient of R² = {regression.rSquared}.
            </p>
          </div>
        </div>

        {/* Statistical Factors breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[#1A1918]/20 text-[11px]">
          <div className="bg-[#FBF9F5] p-2 border border-[#1A1918]">
            <span className="opacity-70 block text-[9px] uppercase font-bold">Goodness of Fit (R²)</span>
            <span className="font-mono-news font-bold">{regression.rSquared}</span>
          </div>
          <div className="bg-[#FBF9F5] p-2 border border-[#1A1918]">
            <span className="opacity-70 block text-[9px] uppercase font-bold">Sample Observations</span>
            <span className="font-mono-news font-bold">{regression.dataPointsCount} days</span>
          </div>
          <div className="bg-[#FBF9F5] p-2 border border-[#1A1918]">
            <span className="opacity-70 block text-[9px] uppercase font-bold">Weekend Dip Ratio</span>
            <span className="font-mono-news font-bold">{(regression.weekendDipRatio * 100).toFixed(0)}% of weekday</span>
          </div>
          <div className="bg-[#FBF9F5] p-2 border border-[#1A1918]">
            <span className="opacity-70 block text-[9px] uppercase font-bold">Slope Coeff (m)</span>
            <span className="font-mono-news font-bold">{regression.slope > 0 ? '+' : ''}{regression.slope} dl/day</span>
          </div>
        </div>
      </div>

    </section>
  );
};
