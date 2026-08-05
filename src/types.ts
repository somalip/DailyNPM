export interface DownloadPoint {
  day: string; // "YYYY-MM-DD"
  downloads: number;
  formattedDate?: string;
  dayOfWeek?: string;
}

export interface PackageMetadata {
  name: string;
  description: string;
  latestVersion: string;
  homepage: string | null;
  repository: { type?: string; url?: string } | null;
  license: string;
  keywords: string[];
  author: any;
  maintainers: { name: string; email?: string }[];
  time: {
    created?: string;
    modified?: string;
    latest?: string;
  };
  totalVersionsCount: number;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
  readme?: string;
}

export interface ForecastPoint {
  day: string;
  downloads: number;
  isForecast: boolean;
  lowerBound: number;
  upperBound: number;
}

export interface RegressionResult {
  nextDayPredictedDownloads: number;
  next7DaysPredictedDownloads: number;
  next30DaysPredictedDownloads: number;
  lowerBound: number;
  upperBound: number;
  algorithmStrengthScore: number; // 0 - 100 confidence percentage
  algorithmStrengthLabel: "Very High" | "High" | "Moderate" | "Limited";
  rSquared: number;
  packageAgeDays: number;
  packageAgeFormatted: string;
  dataPointsCount: number;
  dailyGrowthRatePercent: number;
  slope: number;
  intercept: number;
  weekendDipRatio: number; // weekend vs weekday download velocity ratio
  projectedDays: ForecastPoint[];
}

export interface ComparisonPackage {
  name: string;
  info: {
    name: string;
    description: string;
    latestVersion: string;
    license: string;
    created: string | null;
    latest: string | null;
    dependenciesCount: number;
    devDependenciesCount: number;
  } | null;
  downloads: DownloadPoint[];
  color: string;
  predictedNextDay: number;
  total30dDownloads: number;
  avgDailyDownloads: number;
}

export interface AIInsights {
  summary: string;
  healthScore: number;
  pros: string[];
  cons: string[];
  verdict: string;
  aiGenerated: boolean;
}

export type RegressionModelType = 'seasonal_linear' | 'moving_average' | 'polynomial';
