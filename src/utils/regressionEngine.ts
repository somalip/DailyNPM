import { DownloadPoint, ForecastPoint, RegressionResult, RegressionModelType } from '../types';

/**
 * Calculates package age in days from a created date string or timestamp.
 */
export function calculatePackageAgeDays(createdDateStr?: string | null): number {
  if (!createdDateStr) return 365; // fallback default
  const created = new Date(createdDateStr).getTime();
  const now = Date.now();
  const diffDays = Math.max(1, Math.floor((now - created) / (1000 * 60 * 60 * 24)));
  return diffDays;
}

/**
 * Formats package age into readable string like "11.4 yrs" or "245 days".
 */
export function formatPackageAge(days: number): string {
  if (days >= 365) {
    const yrs = (days / 365).toFixed(1);
    return `${yrs} years (${days.toLocaleString()} days)`;
  }
  return `${days} days`;
}

/**
 * Formats date string "YYYY-MM-DD" into short readable label e.g. "Aug 2"
 */
export function formatShortDate(dateStr: string): string {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  } catch {
    // fallback
  }
  return dateStr;
}

/**
 * Perform regression and next-day/future prediction on historical NPM download points.
 */
export function computeDownloadRegression(
  downloads: DownloadPoint[],
  createdDateStr?: string | null,
  modelType: RegressionModelType = 'seasonal_linear',
  forecastDays: number = 7
): RegressionResult {
  if (!downloads || downloads.length === 0) {
    return {
      nextDayPredictedDownloads: 0,
      next7DaysPredictedDownloads: 0,
      next30DaysPredictedDownloads: 0,
      lowerBound: 0,
      upperBound: 0,
      algorithmStrengthScore: 20,
      algorithmStrengthLabel: 'Limited',
      rSquared: 0,
      packageAgeDays: 0,
      packageAgeFormatted: '0 days',
      dataPointsCount: 0,
      dailyGrowthRatePercent: 0,
      slope: 0,
      intercept: 0,
      weekendDipRatio: 1,
      projectedDays: [],
    };
  }

  // 1. Sort downloads chronologically
  const sorted = [...downloads].sort((a, b) => a.day.localeCompare(b.day));
  const N = sorted.length;
  const values = sorted.map(d => Math.max(0, d.downloads));

  // 2. Compute Day-of-Week Seasonality Factors (0 = Sun, 1 = Mon, ... 6 = Sat)
  const dowSums = [0, 0, 0, 0, 0, 0, 0];
  const dowCounts = [0, 0, 0, 0, 0, 0, 0];

  sorted.forEach(d => {
    const dateObj = new Date(d.day + 'T00:00:00Z');
    const dow = dateObj.getUTCDay();
    dowSums[dow] += d.downloads;
    dowCounts[dow]++;
  });

  const overallMean = values.reduce((a, b) => a + b, 0) / Math.max(1, N);
  const dowMeans = dowSums.map((sum, i) => (dowCounts[i] > 0 ? sum / dowCounts[i] : overallMean));
  const seasonalIndices = dowMeans.map(mean => (overallMean > 0 ? mean / overallMean : 1));

  // Weekend vs Weekday ratio (Sat+Sun avg vs Mon-Fri avg)
  const weekdayAvg = (dowMeans[1] + dowMeans[2] + dowMeans[3] + dowMeans[4] + dowMeans[5]) / 5;
  const weekendAvg = (dowMeans[0] + dowMeans[6]) / 2;
  const weekendDipRatio = weekdayAvg > 0 ? weekendAvg / weekdayAvg : 1;

  // 3. Deseasonalize data for linear trend estimation
  const deseasonalized = sorted.map(d => {
    const dateObj = new Date(d.day + 'T00:00:00Z');
    const dow = dateObj.getUTCDay();
    const idx = seasonalIndices[dow] || 1;
    return d.downloads / idx;
  });

  // 4. Ordinary Least Squares (OLS) Linear Regression on deseasonalized data
  const x = Array.from({ length: N }, (_, i) => i);
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = deseasonalized.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((acc, xi, i) => acc + xi * deseasonalized[i], 0);
  const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);

  const denom = N * sumX2 - sumX * sumX;
  const slope = denom !== 0 ? (N * sumXY - sumX * sumY) / denom : 0;
  const intercept = (sumY - slope * sumX) / N;

  // Compute R-squared (Coefficient of Determination)
  const yMean = sumY / N;
  const ssTot = deseasonalized.reduce((acc, yi) => acc + Math.pow(yi - yMean, 2), 0);
  const ssRes = deseasonalized.reduce((acc, yi, i) => {
    const pred = slope * i + intercept;
    return acc + Math.pow(yi - pred, 2);
  }, 0);

  const rSquared = ssTot > 0 ? Math.max(0, Math.min(1, 1 - ssRes / ssTot)) : 0;

  // Residual Standard Error for Confidence Intervals
  const variance = N > 2 ? ssRes / (N - 2) : 0;
  const stdError = Math.sqrt(Math.max(0, variance));

  // Daily Growth Rate Percentage
  const avgBaseline = Math.max(1, yMean);
  const dailyGrowthRatePercent = (slope / avgBaseline) * 100;

  // 5. Package Age & Strength Score Calculation
  // Prompt mandate: "the longer the package has been out the stronger the algorithm is due to more data points in the regression formula"
  const packageAgeDays = calculatePackageAgeDays(createdDateStr);

  // Age score: packages out for 5-10+ years get up to 45 points
  // Formula saturates smoothly with age: 10 + 35 * (1 - exp(-age / 730))
  const ageFactor = Math.min(45, 10 + 35 * (1 - Math.exp(-packageAgeDays / 730)));

  // Sample size N score: up to 35 points for having 180+ daily data points
  const sampleSizeFactor = Math.min(35, 15 + 20 * Math.min(1, N / 180));

  // R² fit score: up to 20 points
  const fitFactor = Math.min(20, Math.max(0, rSquared * 20));

  let algorithmStrengthScore = Math.round(ageFactor + sampleSizeFactor + fitFactor);
  algorithmStrengthScore = Math.max(15, Math.min(99, algorithmStrengthScore));

  let algorithmStrengthLabel: 'Very High' | 'High' | 'Moderate' | 'Limited' = 'Limited';
  if (algorithmStrengthScore >= 85) {
    algorithmStrengthLabel = 'Very High';
  } else if (algorithmStrengthScore >= 70) {
    algorithmStrengthLabel = 'High';
  } else if (algorithmStrengthScore >= 50) {
    algorithmStrengthLabel = 'Moderate';
  }

  // 6. Project Future Days (Next 1 to forecastDays)
  const projectedDays: ForecastPoint[] = [];
  const lastDate = new Date(sorted[N - 1].day + 'T00:00:00Z');

  let nextDayPred = 0;
  let next7DaysSum = 0;
  let next30DaysSum = 0;

  // Calculate 30-day projection points for totals
  const totalDaysToProject = Math.max(30, forecastDays);

  for (let step = 1; step <= totalDaysToProject; step++) {
    const futureDate = new Date(lastDate.getTime() + step * 24 * 60 * 60 * 1000);
    const dayStr = futureDate.toISOString().split('T')[0];
    const futureDow = futureDate.getUTCDay();

    const t = N - 1 + step;
    let basePred = 0;

    if (modelType === 'moving_average') {
      // 7-day EMA trend + seasonality
      const recent7 = values.slice(-7);
      const ema = recent7.reduce((a, b) => a + b, 0) / recent7.length;
      basePred = ema;
    } else if (modelType === 'polynomial' && N >= 10) {
      // Quadratic trend
      const half = Math.floor(N / 2);
      const recentSlope = (values[N - 1] - values[half]) / Math.max(1, N - 1 - half);
      basePred = intercept + slope * t + 0.05 * recentSlope * step;
    } else {
      // Seasonal linear default
      basePred = intercept + slope * t;
    }

    // Apply day of week seasonality multiplier
    const rawPredicted = Math.max(0, basePred * (seasonalIndices[futureDow] || 1));
    const roundedPredicted = Math.round(rawPredicted);

    // Confidence Interval: Margin of Error expands as step increases into the future
    const xMean = sumX / N;
    const distanceTerm = Math.pow(t - xMean, 2) / Math.max(1, sumX2 - (sumX * sumX) / N);
    const margin = 1.96 * stdError * Math.sqrt(1 + 1 / N + distanceTerm) * (seasonalIndices[futureDow] || 1);

    const lowerBound = Math.max(0, Math.round(roundedPredicted - margin));
    const upperBound = Math.round(roundedPredicted + margin);

    if (step === 1) {
      nextDayPred = roundedPredicted;
    }

    if (step <= 7) {
      next7DaysSum += roundedPredicted;
    }

    if (step <= 30) {
      next30DaysSum += roundedPredicted;
    }

    if (step <= forecastDays) {
      projectedDays.push({
        day: dayStr,
        downloads: roundedPredicted,
        isForecast: true,
        lowerBound,
        upperBound,
      });
    }
  }

  const nextDayLower = projectedDays[0]?.lowerBound ?? Math.max(0, Math.round(nextDayPred * 0.9));
  const nextDayUpper = projectedDays[0]?.upperBound ?? Math.round(nextDayPred * 1.1);

  return {
    nextDayPredictedDownloads: nextDayPred,
    next7DaysPredictedDownloads: next7DaysSum,
    next30DaysPredictedDownloads: next30DaysSum,
    lowerBound: nextDayLower,
    upperBound: nextDayUpper,
    algorithmStrengthScore,
    algorithmStrengthLabel,
    rSquared: Math.round(rSquared * 1000) / 1000,
    packageAgeDays,
    packageAgeFormatted: formatPackageAge(packageAgeDays),
    dataPointsCount: N,
    dailyGrowthRatePercent: Math.round(dailyGrowthRatePercent * 100) / 100,
    slope: Math.round(slope),
    intercept: Math.round(intercept),
    weekendDipRatio: Math.round(weekendDipRatio * 100) / 100,
    projectedDays,
  };
}
