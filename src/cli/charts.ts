import asciichart from 'asciichart';
import pc from 'picocolors';

export interface ChartPoint {
  label: string;
  value: number;
}

/**
 * Render a high-resolution ASCII line chart from an array of numbers
 */
export function renderAsciiLineChart(
  values: number[],
  options: { height?: number; offset?: number; title?: string } = {}
): string {
  if (!values || values.length === 0) return '';

  const height = options.height || 12;
  const config = {
    height,
    offset: options.offset || 3,
    padding: '       ',
    format: (x: number) => {
      if (x >= 1_000_000) return (x / 1_000_000).toFixed(1) + 'M';
      if (x >= 1_000) return (x / 1_000).toFixed(0) + 'k';
      return Math.round(x).toString();
    },
  };

  const chartStr = asciichart.plot(values, config);
  return chartStr;
}

/**
 * Render historical vs predicted line chart overlay in ASCII
 */
export function renderAsciiForecastChart(
  historicalValues: number[],
  projectedValues: number[],
  height = 12
): string {
  if (!historicalValues || historicalValues.length === 0) return '';

  // Combine historical and projected data series
  // Series 0: Historical + padding for forecast
  // Series 1: Padding for historical + forecast
  const lastHistorical = historicalValues[historicalValues.length - 1];

  const series0: (number | typeof NaN)[] = [...historicalValues];
  const series1: (number | typeof NaN)[] = new Array(historicalValues.length - 1).fill(NaN);
  series1.push(lastHistorical, ...projectedValues);

  // Extend series0 with NaNs for alignment
  for (let i = 0; i < projectedValues.length; i++) {
    series0.push(NaN);
  }

  const config = {
    height,
    offset: 3,
    padding: '       ',
    colors: [
      asciichart.cyan,   // Historical line
      asciichart.magenta // Forecast line
    ],
    format: (x: number) => {
      if (isNaN(x)) return ' ';
      if (x >= 1_000_000) return (x / 1_000_000).toFixed(1) + 'M';
      if (x >= 1_000) return (x / 1_000).toFixed(0) + 'k';
      return Math.round(x).toString();
    },
  };

  try {
    return asciichart.plot([series0 as number[], series1 as number[]], config);
  } catch (err) {
    // Fallback single line plot if multi-line is unsupported
    return asciichart.plot([...historicalValues, ...projectedValues], { ...config, colors: [asciichart.cyan] });
  }
}

/**
 * Render horizontal ASCII bar chart (e.g. for Day of Week velocity)
 */
export function renderAsciiBarChart(
  items: ChartPoint[],
  maxWidth = 30
): string {
  if (!items || items.length === 0) return '';

  const maxVal = Math.max(...items.map((i) => i.value), 1);
  const lines: string[] = [];

  items.forEach((item) => {
    const ratio = item.value / maxVal;
    const barLength = Math.max(1, Math.round(ratio * maxWidth));
    const bar = '█'.repeat(barLength);
    const formattedVal = item.value >= 1_000_000 
      ? (item.value / 1_000_000).toFixed(2) + 'M' 
      : item.value.toLocaleString();

    lines.push(
      `${pc.bold(item.label.padEnd(5))} │ ${pc.cyan(bar)} ${pc.dim(formattedVal)}`
    );
  });

  return lines.join('\n');
}
