import blessed from 'blessed';
import contrib from 'blessed-contrib';
import pc from 'picocolors';
import { getPackageInfo, getDownloadStats } from '../services/npm.js';
import { getAiInsights, setAiModel, askAi } from '../services/ai.js';
import { computeDownloadRegression } from '../utils/regressionEngine.js';
import { 
  onAuthStateListener, 
  signInUser, 
  signUpUser, 
  signOutUser, 
  trackPackage, 
  untrackPackage,
  isSimulationMode
} from '../services/firebase.js';

export async function launchTui(initialPackage = 'react') {
  // Initialize Blessed Screen with mouse support
  const screen = blessed.screen({
    smartCSR: true,
    title: 'The Daily NPM - Terminal User Interface',
  });

  screen.enableMouse();

  // Create Grid Layout (12x12)
  const grid = new contrib.grid({ rows: 12, cols: 12, screen: screen });

  // 1. Top Header / Masthead Box (Rows 0..1, Cols 0..11)
  const headerBox = grid.set(0, 0, 2, 12, blessed.box, {
    content: `{center}{bold}THE DAILY NPM - TERMINAL EDITION{/bold}{/center}\n` +
             `{center}{cyan-fg}"The World's Preeminent Journal of Package Intelligence & Node Statistics"{/cyan-fg}{/center}`,
    tags: true,
    style: {
      fg: 'yellow',
      bg: 'black',
      border: { fg: 'cyan' },
    },
    border: { type: 'line' },
  });

  // 2. Package Overview Card (Rows 2..4, Cols 0..4) - Height 3
  const overviewBox = grid.set(2, 0, 3, 5, blessed.box, {
    label: ' 📦 PACKAGE METADATA ',
    content: 'Loading package metadata...',
    tags: true,
    scrollable: true,
    alwaysScroll: true,
    mouse: true,
    border: { type: 'line' },
    style: { border: { fg: 'yellow' }, label: { fg: 'yellow', bold: true } },
  });

  // 2b. Sparkline (Rows 5..8, Cols 0..4) - Height 4 (Expanded for rich stats)
  const sparklineBox = grid.set(5, 0, 4, 5, blessed.box, {
    label: ' 📈 30D TREND ',
    tags: true,
    valign: 'middle',
    border: { type: 'line' },
    style: { border: { fg: 'green' }, label: { fg: 'green', bold: true } },
  });

  // Custom robust sparkline implementation with extended trend data
  (sparklineBox as any).setTrendData = function(data: number[], reg: any) {
    if (!data || data.length === 0) return;
    const maxVal = Math.max(...data) || 1;
    const minVal = Math.min(...data) || 0;
    const avgVal = Math.round(data.reduce((a, b) => a + b, 0) / data.length);
    const sparkChars = [' ', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
    
    // Auto-scale sparkline strictly to width
    const boxInnerWidth = typeof this.width === 'number' ? this.width - 2 : 30;
    const renderData = data.slice(-boxInnerWidth);
    const sparkText = renderData.map(v => sparkChars[Math.min(7, Math.floor((v / maxVal) * 8))]).join('');
    
    const formatNum = (num: number) => {
      if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
      if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
      return num.toString();
    };
    
    const trendGrowth = avgVal > 0 ? ((reg.slope / avgVal) * 100).toFixed(1) : '0.0';
    const trendColor = reg.slope > 0 ? 'green-fg' : (reg.slope < 0 ? 'red-fg' : 'yellow-fg');
    const trendIcon = reg.slope > 0 ? '▲' : (reg.slope < 0 ? '▼' : '▶');
    
    const weekendDipStr = reg.weekendDipRatio < 1 ? `▼${((1 - reg.weekendDipRatio) * 100).toFixed(0)}%` : `---`;

    this.setContent(
      `{center}{cyan-fg}Max: ${formatNum(maxVal)} │ Min: ${formatNum(minVal)} │ Avg: ${formatNum(avgVal)}{/cyan-fg}{/center}\n` +
      `{center}{magenta-fg}7D: ${formatNum(reg.next7DaysPredictedDownloads)} │ 30D: ${formatNum(reg.next30DaysPredictedDownloads)}{/magenta-fg}{/center}\n` +
      `{center}{${trendColor}}Trend: ${trendIcon}${trendGrowth}% │ R²: ${reg.rSquared}{/${trendColor}}{/center}\n` +
      `{center}{yellow-fg}Wknd Drop: ${weekendDipStr} │ N=${reg.dataPointsCount}{/yellow-fg}{/center}\n` +
      `{center}{white-fg}Alg: ${reg.algorithmStrengthScore}/100 (${reg.algorithmStrengthLabel}){/white-fg}{/center}\n` +
      ` {green-fg}${sparkText}{/green-fg}`
    );
  };

  // 3. Interactive Bar Chart Box (Rows 2..7, Cols 5..11)
  const chartBox = grid.set(2, 5, 6, 7, contrib.bar, {
    label: ' 📊 DAILY DOWNLOAD BAR CHART (USE ← / → ARROWS OR HOVER FOR DETAILS) ',
    barWidth: 2,
    barSpacing: 1,
    xOffset: 0,
    maxHeight: 0,
    tags: true,
    border: { type: 'line' },
    style: { border: { fg: 'cyan' }, label: { fg: 'cyan', bold: true } },
  });

  // Tooltip / Detail Overlay Box inside Chart Area
  const tooltipBox = grid.set(7, 5, 1, 7, blessed.box, {
    content: '{center}{yellow-fg}Hover or use ← / → Arrow keys to inspect daily download counts{/yellow-fg}{/center}',
    tags: true,
    style: { fg: 'white', bg: 'black' },
  });

  // 4. Day of Week Velocity Bar Chart (Rows 9..10, Cols 0..4) - Height 2
  const dowBox = grid.set(9, 0, 2, 5, blessed.box, {
    label: ' 📅 WEEKDAY BUILD PACING ',
    content: 'Calculating daily velocity...',
    tags: true,
    scrollable: true,
    alwaysScroll: true,
    mouse: true,
    scrollbar: { ch: ' ', track: { bg: 'black' }, style: { bg: 'cyan' } },
    border: { type: 'line' },
    style: { border: { fg: 'green' }, label: { fg: 'green', bold: true } },
  });

  // 5. AI Insights & Health Grade Box (Rows 8..10, Cols 5..9) - Width 5
  const aiBox = grid.set(8, 5, 3, 5, blessed.box, {
    label: ' 🧠 AI BUREAU VERDICT ',
    content: 'Consulting AI Bureau...',
    tags: true,
    scrollable: true,
    alwaysScroll: true,
    mouse: true,
    scrollbar: { ch: ' ', track: { bg: 'black' }, style: { bg: 'magenta' } },
    border: { type: 'line' },
    style: { border: { fg: 'magenta' }, label: { fg: 'magenta', bold: true } },
  });

  // 5b. Health Donut Chart (Rows 8..10, Cols 10..11) - Width 2
  const donutBox = grid.set(8, 10, 3, 2, contrib.donut, {
    label: ' HEALTH ',
    radius: 4,
    arcWidth: 2,
    remainColor: 'black',
    yPadding: 0,
    border: { type: 'line' },
    style: { border: { fg: 'cyan' }, label: { fg: 'cyan', bold: true } },
  });

  // 6. Footer Controls Bar (Row 11, Cols 0..11)
  const footerBox = grid.set(11, 0, 1, 12, blessed.box, {
    content: ' {bold}[P]{/bold} Portfolio  •  {bold}[L]{/bold} Login  •  {bold}[T]{/bold} Track  •  {bold}[U]{/bold} Simulate  •  {bold}[S]{/bold} Search  •  {bold}[C]{/bold} Chat AI  •  {bold}[M]{/bold} Model  •  {bold}[R]{/bold} Refresh  •  {bold}[Q]{/bold} Quit ',
    tags: true,
    style: { fg: 'black', bg: 'white' },
  });

  // Prompt Modal for Package Search
  const searchPrompt = blessed.prompt({
    parent: screen,
    border: 'line',
    height: 7,
    width: 'half',
    top: 'center',
    left: 'center',
    label: ' Search Wire ',
    tags: true,
    hidden: true,
    style: {
      border: { fg: 'cyan' },
      label: { fg: 'cyan', bold: true },
    },
  });

  // Chat Modal
  const chatPrompt = blessed.prompt({
    parent: screen,
    border: 'line',
    height: 7,
    width: 'half',
    top: 'center',
    left: 'center',
    label: ' Chat with AI Bureau ',
    tags: true,
    hidden: true,
    style: { border: { fg: 'magenta' }, label: { fg: 'magenta', bold: true } },
  });

  // Model Selection List
  const modelList = blessed.list({
    parent: screen,
    border: 'line',
    height: 6,
    width: 'half',
    top: 'center',
    left: 'center',
    label: ' Select AI Model ',
    keys: true,
    interactive: true,
    hidden: true,
    style: {
      border: { fg: 'cyan' },
      selected: { bg: 'cyan', fg: 'black' },
      item: { fg: 'white' }
    },
    items: [
      '1) SmolLM2-135M-Instruct (90MB - Fastest)',
      '2) SmolLM2-360M-Instruct (250MB - Balanced)',
      '3) SmolLM2-1.7B-Instruct (1.2GB - Smartest)'
    ]
  });

  // Account Modals (Email / Password inputs)
  const emailPrompt = blessed.prompt({
    parent: screen,
    border: 'line',
    height: 7,
    width: 'half',
    top: 'center',
    left: 'center',
    label: ' Reader Sign In - Email ',
    tags: true,
    hidden: true,
    style: { border: { fg: 'yellow' }, label: { fg: 'yellow', bold: true } },
  });

  const passwordPrompt = blessed.prompt({
    parent: screen,
    border: 'line',
    height: 7,
    width: 'half',
    top: 'center',
    left: 'center',
    label: ' Reader Sign In - Password ',
    tags: true,
    hidden: true,
    style: { border: { fg: 'yellow' }, label: { fg: 'yellow', bold: true } },
  });

  // Simulation prompt
  const simPrompt = blessed.prompt({
    parent: screen,
    border: 'line',
    height: 9,
    width: 'half',
    top: 'center',
    left: 'center',
    label: ' Forecast Simulation Scenarios ',
    tags: true,
    hidden: true,
    style: { border: { fg: 'red' }, label: { fg: 'red', bold: true } },
  });

  modelList.on('select', (item: any, index: number) => {
    modelList.hide();
    screen.render();
    const models = [
      'onnx-community/SmolLM2-135M-Instruct-ONNX',
      'onnx-community/SmolLM2-360M-Instruct-ONNX',
      'onnx-community/SmolLM2-1.7B-Instruct-ONNX'
    ];
    setAiModel(models[index]);
    loadData(currentPkgName); // Reload insights using the new model
  });

  modelList.on('cancel', () => {
    modelList.hide();
    screen.render();
  });

  // --- APP TUI STATE ---
  let user: any = null;
  let viewMode: 'package' | 'portfolio' = 'package';
  let simScenario: { type: 'none' | 'flat_add' | 'compound' | 'event_shock'; value: number } = { type: 'none', value: 0 };

  let currentPkgName = initialPackage;
  let activeDownloads: { day: string; downloads: number }[] = [];
  let selectedBarIdx = 0;

  // Listen to Auth State
  onAuthStateListener((currentUser) => {
    user = currentUser;
    updateHeader();
  });

  function updateHeader() {
    const userLabel = user 
      ? `{yellow-fg}READER: ${user.displayName || user.email.split('@')[0]}{/yellow-fg} [L: Account]`
      : `[L: Sign In]`;
    
    const trackLabel = user 
      ? (user.watchlist?.some((p: any) => p.name.toLowerCase() === currentPkgName.toLowerCase())
          ? `{green-fg}[T: Tracked]{/green-fg}`
          : `[T: Track Package]`)
      : `[T: Sign in to track]`;

    const modeLabel = viewMode === 'portfolio' 
      ? `{magenta-fg}{bold}[Active: Portfolio]{/bold}{/magenta-fg}` 
      : `{cyan-fg}[Active: Package Report]{/cyan-fg}`;

    const simLabel = simScenario.type !== 'none'
      ? `{red-fg}[Simulated Forecast ACTIVE]{/red-fg}`
      : '';

    headerBox.setContent(
      `{center}{bold}THE DAILY NPM - TERMINAL EDITION{/bold}{/center}\n` +
      `{left}Mode: ${modeLabel} │ ${userLabel} │ ${trackLabel} ${simLabel}{/left}` +
      `{right}Inspecting: {yellow-fg}${currentPkgName.toUpperCase()}{/yellow-fg}{/right}`
    );
    screen.render();
  }

  function updateTooltip(idx: number) {
    if (!activeDownloads || activeDownloads.length === 0) return;
    const boundedIdx = Math.max(0, Math.min(idx, activeDownloads.length - 1));
    selectedBarIdx = boundedIdx;
    const item = activeDownloads[boundedIdx];

    const dateStr = item.day;
    const downloadsFormatted = item.downloads.toLocaleString();
    const isWeekend = new Date(dateStr + 'T00:00:00Z').getUTCDay() % 6 === 0;

    tooltipBox.setContent(
      `{center}{bold}DATE:{/bold} {cyan-fg}${dateStr}{/cyan-fg}  •  ` +
      `{bold}DOWNLOADS:{/bold} {yellow-fg}${downloadsFormatted}{/yellow-fg}  •  ` +
      `{bold}TYPE:{/bold} ${isWeekend ? '{magenta-fg}Weekend Dip{/magenta-fg}' : '{green-fg}Weekday Build{/green-fg}'} ` +
      `[Bar ${boundedIdx + 1} of ${activeDownloads.length}]{/center}`
    );
    screen.render();
  }

  // --- DATA LOADING & VIEW SWITCHING ---

  async function loadData(pkgName: string) {
    if (viewMode === 'portfolio') {
      await loadPortfolioData();
      return;
    }

    headerBox.setContent(
      `{center}{bold}THE DAILY NPM - TELEGRAPH WIRE{/bold}{/center}\n` +
      `{center}FETCHING WIRE DISPATCHES FOR: {yellow-fg}{bold}${pkgName}{/bold}{/yellow-fg}...{/center}`
    );
    screen.render();

    try {
      const [info, stats] = await Promise.all([
        getPackageInfo(pkgName),
        getDownloadStats(pkgName, 'last-month'),
      ]);

      // Apply growth vector simulation to downloads if active
      let downloads = stats.downloads || [];
      if (simScenario.type !== 'none') {
        downloads = downloads.map((d: any, index: number) => {
          let val = d.downloads;
          if (simScenario.type === 'flat_add') {
            val += simScenario.value * 1000;
          } else if (simScenario.type === 'compound') {
            val = Math.round(val * Math.pow(1 + simScenario.value / 100, index + 1));
          } else if (simScenario.type === 'event_shock' && index >= 14) {
            val = Math.round(val * (1 + simScenario.value / 100));
          }
          return { ...d, downloads: Math.max(0, val) };
        });
      }

      activeDownloads = downloads;
      selectedBarIdx = downloads.length - 1;

      const total30d = downloads.reduce((acc: number, d: any) => acc + d.downloads, 0);
      const avgDaily = downloads.length > 0 ? Math.round(total30d / downloads.length) : 0;
      const reg = computeDownloadRegression(downloads, info.time?.created, 'seasonal_linear', 14);

      // Restore widgets standard labels and visibility
      chartBox.setLabel(' 📊 DAILY DOWNLOAD BAR CHART (←/→ TO INSPECT) ');
      overviewBox.setLabel(' 📦 PACKAGE METADATA ');
      sparklineBox.setLabel(' 📈 30D TREND ');
      aiBox.setLabel(' 🧠 AI BUREAU VERDICT ');
      donutBox.setLabel(' HEALTH ');
      dowBox.setLabel(' 📅 WEEKDAY BUILD PACING ');

      // Render Header info
      updateHeader();

      // Render Overview Box
      const gitText = info.github && info.github.stars > 0
        ? `{bold}Git Telemetry:{/bold} ★ ${info.github.stars.toLocaleString()} / ⑂ ${info.github.forks.toLocaleString()}\n`
        : '';
      const velocityText = info.releaseVelocity
        ? `{bold}Releases (12M):{/bold} ${info.releaseVelocity.releasesLastYear} (avg every ${info.releaseVelocity.avgDaysBetweenReleases}d)\n`
        : '';

      const overviewText =
        `{bold}Name:{/bold} {cyan-fg}${info.name}{/cyan-fg}\n` +
        `{bold}Latest Version:{/bold} v${info.latestVersion}\n` +
        `{bold}License:{/bold} ${info.license}\n` +
        `{bold}30D Volume:{/bold} {yellow-fg}${total30d.toLocaleString()}{/yellow-fg}\n` +
        `{bold}Daily Pace:{/bold} ${avgDaily.toLocaleString()}/day\n` +
        `{bold}Tomorrow Forecast:{/bold} {green-fg}${reg.nextDayPredictedDownloads.toLocaleString()}{/green-fg}\n` +
        `{bold}Dependencies:{/bold} ${Object.keys(info.dependencies).length} direct / ${Object.keys(info.devDependencies).length} dev\n` +
        gitText +
        velocityText +
        `{bold}Age:{/bold} ${reg.packageAgeFormatted}\n\n` +
        `{cyan-fg}${info.description.slice(0, 120)}...{/cyan-fg}`;
      overviewBox.setContent(overviewText);

      // Render Bar Chart
      const screenCols = screen.cols || 80;
      const estimatedWidth = Math.floor((7 / 12) * screenCols);
      const maxBars = Math.max(5, Math.floor((estimatedWidth - 4) / 3));
      const chartDownloads = downloads.slice(-maxBars);

      const barTitles = chartDownloads.map((d: any) => d.day.slice(8));
      const barData = chartDownloads.map((d: any) => d.downloads);

      if (barData.length > 0) {
        try {
          chartBox.setData({
            titles: barTitles,
            data: barData,
          });
        } catch (e) {
          console.error("TUI bar chart draw failed:", e);
        }
      }

      // Render Sparkline
      const fullDownloadsData = downloads.map((d: any) => d.downloads);
      (sparklineBox as any).setTrendData(fullDownloadsData, reg);

      updateTooltip(selectedBarIdx);

      // Render Weekday Pacing
      const dowShorts = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      const dowTotals = [0, 0, 0, 0, 0, 0, 0];
      const dowCounts = [0, 0, 0, 0, 0, 0, 0];

      downloads.forEach((d: any) => {
        const dow = new Date(d.day + 'T00:00:00Z').getUTCDay();
        dowTotals[dow] += d.downloads;
        dowCounts[dow]++;
      });

      let dowText = '{bold}DAY   │ AVERAGE DAILY PACING{/bold}\n─────┼─────────────────────────\n';
      dowShorts.forEach((label, idx) => {
        const avg = dowCounts[idx] > 0 ? Math.round(dowTotals[idx] / dowCounts[idx]) : 0;
        const formatted = avg >= 1_000_000 ? (avg / 1_000_000).toFixed(2) + 'M' : avg.toLocaleString();
        const isWeekend = idx === 0 || idx === 6;
        const color = isWeekend ? 'magenta-fg' : 'cyan-fg';
        dowText += `{bold}${label}{/bold}   │ {${color}}${formatted.padEnd(10)}{/${color}} ${isWeekend ? '(Weekend Dip)' : '(Peak Build)'}\n`;
      });
      dowBox.setContent(dowText);

      // Render AI Verdict
      aiBox.setContent('{yellow-fg}Consulting AI Bureau...{/yellow-fg}');
      donutBox.setData([{ percent: 0, label: 'N/A', color: 'gray' }]);
      screen.render();

      getAiInsights({
        packageName: info.name,
        description: info.description,
        totalDownloads: total30d,
        version: info.latestVersion,
        ageInDays: reg.packageAgeDays,
        dependenciesCount: Object.keys(info.dependencies).length,
        readme: info.readme,
        onProgress: (status) => {
          aiBox.setContent(`{yellow-fg}${status}{/yellow-fg}`);
          screen.render();
        }
      }).then((insights) => {
        const escapedVerdict = insights.verdict.replace(/{/g, '{|').replace(/}/g, '|}');
        const scoreColor = insights.healthScore >= 80 ? 'green' : (insights.healthScore >= 50 ? 'yellow' : 'red');
        const aiText =
          `{bold}Verdict:{/bold} {cyan-fg}${escapedVerdict}{/cyan-fg}\n` +
          `{bold}Pros:{/bold} ${insights.pros.join(', ')}\n` +
          `{bold}Cons:{/bold} ${insights.cons.join(', ')}`;
        aiBox.setContent(aiText);
        
        try {
          donutBox.setData([{
            percent: insights.healthScore,
            label: 'SCORE',
            color: scoreColor,
          }]);
        } catch (e) {
          console.error("TUI donut chart draw failed:", e);
        }
        screen.render();
      }).catch((err) => {
        aiBox.setContent(`{red-fg}AI Bureau Offline:\n${err.message || err}{/red-fg}`);
        screen.render();
      });

    } catch (err: any) {
      headerBox.setContent(
        `{center}{bold}THE DAILY NPM - TELEGRAPH WIRE{/bold}{/center}\n` +
        `{center}{red-fg}ERROR FETCHING DISPATCH: ${pkgName.toUpperCase()}{/red-fg}{/center}`
      );
      overviewBox.setContent(`{red-fg}Error fetching data for ${pkgName}:\n\n${err.message}{/red-fg}`);
      chartBox.setData({ titles: ['Error'], data: [0] });
      
      const emptyReg = computeDownloadRegression([{day: 'error', downloads: 0}], undefined, 'seasonal_linear', 7);
      (sparklineBox as any).setTrendData([0], emptyReg);
      
      dowBox.setContent('{red-fg}Data calculation halted.{/red-fg}');
      aiBox.setContent(`{red-fg}Analysis halted due to fetch error.{/red-fg}`);
      donutBox.setData([{ percent: 0, label: 'Err', color: 'red' }]);
      tooltipBox.setContent('');
    }

    screen.render();
  }

  // --- DOW NPM PORTFOLIO VIEW LOGIC ---

  async function loadPortfolioData() {
    if (!user) {
      viewMode = 'package';
      updateHeader();
      loadData(currentPkgName);
      return;
    }

    // Set layout labels for Portfolio View context
    chartBox.setLabel(' 📊 DOW NPM INDEX (AGGREGATED WATCHLIST DOWNLOADS) ');
    overviewBox.setLabel(' 📰 THE WATCHLIST GAZETTE (EDITORIAL WIRE) ');
    sparklineBox.setLabel(' 📈 PORTFOLIO METRICS ');
    aiBox.setLabel(' 🛡️ ACTIVE ALERTS & WATCHLIST ');
    donutBox.setLabel(' HEALTH ');
    dowBox.setLabel(' 🕒 WATCHLIST METADATA ');

    overviewBox.setContent('{yellow-fg}Fetching aggregated dispatches for your watchlist...{/yellow-fg}');
    screen.render();

    const list = user.watchlist || [];
    if (list.length === 0) {
      overviewBox.setContent(
        `{center}{bold}PORTFOLIO WATCHLIST IS EMPTY{/bold}{/center}\n\n` +
        `Search for packages (press [S]) and toggle tracking (press [T]) to add them to your portfolio watchlist.`
      );
      chartBox.setData({ titles: ['Empty'], data: [0] });
      sparklineBox.setContent('{center}No active tracked positions.{/center}');
      aiBox.setContent('No assets monitored.');
      donutBox.setData([{ percent: 0, label: 'N/A', color: 'gray' }]);
      screen.render();
      return;
    }

    try {
      // Load details for all tracked items
      const loadedDetails = await Promise.all(
        list.map(async (p: any) => {
          try {
            const [meta, dl] = await Promise.all([
              getPackageInfo(p.name),
              getDownloadStats(p.name, 'last-month')
            ]);
            const downloads = dl.downloads || [];
            
            let weeklyChange = 0;
            let currentDownloads = 0;
            if (downloads.length >= 14) {
              const sortedDls = [...downloads].sort((a: any, b: any) => a.day.localeCompare(b.day));
              const last7 = sortedDls.slice(-7).reduce((acc: number, d: any) => acc + d.downloads, 0);
              const prev7 = sortedDls.slice(-14, -7).reduce((acc: number, d: any) => acc + d.downloads, 0);
              currentDownloads = last7;
              weeklyChange = prev7 > 0 ? ((last7 - prev7) / prev7) * 100 : 0;
            }

            return {
              name: p.name,
              version: meta.latestVersion,
              description: meta.description,
              weeklyChange: Math.round(weeklyChange * 10) / 10,
              currentDownloads,
              downloads,
              stars: meta.github?.stars || 0,
              alertThreshold: p.alertThreshold
            };
          } catch (e) {
            return null;
          }
        })
      );

      const validDetails = loadedDetails.filter(d => d !== null) as any[];

      // Aggregate day-by-day downloads
      const dayMap: Record<string, number> = {};
      validDetails.forEach(item => {
        item.downloads.forEach((d: any) => {
          dayMap[d.day] = (dayMap[d.day] || 0) + d.downloads;
        });
      });

      const aggregated = Object.entries(dayMap).map(([day, downloads]) => ({
        day,
        downloads
      })).sort((a, b) => a.day.localeCompare(b.day));

      activeDownloads = aggregated;
      selectedBarIdx = aggregated.length - 1;

      // Overall portfolio calculations
      const totalVolume = aggregated.reduce((acc, pt) => acc + pt.downloads, 0);
      let combinedWeeklyChange = 0;
      if (aggregated.length >= 14) {
        const last7 = aggregated.slice(-7).reduce((acc, d) => acc + d.downloads, 0);
        const prev7 = aggregated.slice(-14, -7).reduce((acc, d) => acc + d.downloads, 0);
        combinedWeeklyChange = prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100 * 10) / 10 : 0;
      }

      // Render aggregate chart
      const screenCols = screen.cols || 80;
      const estimatedWidth = Math.floor((7 / 12) * screenCols);
      const maxBars = Math.max(5, Math.floor((estimatedWidth - 4) / 3));
      const chartDownloads = aggregated.slice(-maxBars);

      const barTitles = chartDownloads.map((d: any) => d.day.slice(8));
      const barData = chartDownloads.map((d: any) => d.downloads);

      if (barData.length > 0) {
        chartBox.setData({ titles: barTitles, data: barData });
      }

      // Render Portfolio stats
      const changeColor = combinedWeeklyChange >= 0 ? 'green-fg' : 'red-fg';
      const changeIcon = combinedWeeklyChange >= 0 ? '▲' : '▼';
      sparklineBox.setContent(
        `\n` +
        `{center}{bold}DOW NPM PORTFOLIO INDEX{/bold}{/center}\n` +
        `{center}{yellow-fg}30D Volume: ${totalVolume.toLocaleString()}{/yellow-fg}{/center}\n` +
        `{center}{${changeColor}}Weekly WoW: ${changeIcon}${combinedWeeklyChange}%{/${changeColor}}{/center}\n` +
        `{center}{cyan-fg}Tracked Assets: ${validDetails.length}{/cyan-fg}{/center}`
      );

      // Render Watchlist Gazette (editorial dispatches)
      let gazetteText = '';
      if (validDetails.length > 0) {
        const marketDirection = combinedWeeklyChange >= 0 ? "BULLISH SURGE" : "BEARISH SHIFT";
        gazetteText += 
          `{center}{bold}DOW NPM DISPATCH{/bold} │ WoW: {${changeColor}}${combinedWeeklyChange}%{/${changeColor}}{/center}\n` +
          `The combined NPM index recorded a ${marketDirection} to close at ${totalVolume.toLocaleString()} total weekly downloads. Analysts note steady builder activity.\n\n`;

        const topPerformer = [...validDetails].sort((a, b) => b.weeklyChange - a.weeklyChange)[0];
        if (topPerformer && topPerformer.weeklyChange > 0) {
          gazetteText += 
            `{center}{bold}SPOTLIGHT: ${topPerformer.name.toUpperCase()} LEADS MARKET{/bold}{/center}\n` +
            `${topPerformer.name} captured substantial attention, spiking ${topPerformer.weeklyChange}% WoW. It is currently operating version v${topPerformer.version}.\n\n`;
        }

        const declining = validDetails.filter(d => d.weeklyChange < 0);
        if (declining.length > 0) {
          const worst = [...declining].sort((a, b) => a.weeklyChange - b.weeklyChange)[0];
          gazetteText += 
            `{center}{bold}RISK WIRE: ${worst.name.toUpperCase()} VOLUME DECELERATING{/bold}{/center}\n` +
            `Downloads for the position ${worst.name} dropped by ${Math.abs(worst.weeklyChange)}% below standard baseline predictions.`;
        } else {
          gazetteText += 
            `{center}{bold}ENVIRONMENTAL REPORT: MARKET STABLE{/bold}{/center}\n` +
            `Ecosystem weather remains uniform. Minimal drops detected across the watchlist.`;
        }
      }
      overviewBox.setContent(gazetteText);

      // Render Watchlist & Active Alerts box
      let alertsText = '{bold}ASSET      │ WoW % │ ALERTS ACTIVE{/bold}\n───────────┼───────┼────────────────\n';
      let totalAlertsCount = 0;
      validDetails.forEach(item => {
        let alertTriggered = false;
        let alertDesc = 'Stable';
        
        // 1. legacy threshold check
        if (item.weeklyChange < -item.alertThreshold) {
          alertTriggered = true;
          alertDesc = `WoW Drop > ${item.alertThreshold}%`;
        }

        const ruleColor = alertTriggered ? 'red-fg' : 'green-fg';
        const changeValColor = item.weeklyChange >= 0 ? 'green-fg' : 'red-fg';
        const changeStr = `${item.weeklyChange >= 0 ? '+' : ''}${item.weeklyChange}%`;
        alertsText += `{bold}${item.name.padEnd(10).slice(0, 10)}{/bold} │ {${changeValColor}}${changeStr.padEnd(5)}{/${changeValColor}} │ {${ruleColor}}${alertDesc}{/${ruleColor}}\n`;
        
        if (alertTriggered) totalAlertsCount++;
      });
      aiBox.setContent(alertsText);

      // Set health score based on alerts
      const baseHealth = Math.max(10, 100 - (totalAlertsCount * 25));
      const donutColor = baseHealth >= 80 ? 'green' : (baseHealth >= 50 ? 'yellow' : 'red');
      try {
        donutBox.setData([{
          percent: baseHealth,
          label: 'HEALTH',
          color: donutColor
        }]);
      } catch (e) {}

      // Watchlist Metadata
      let metaListText = '{bold}Watchlist Registry:{/bold}\n';
      validDetails.forEach(item => {
        metaListText += `• {cyan-fg}${item.name}{/cyan-fg} (v${item.version}) │ Stars: ${item.stars.toLocaleString()}\n`;
      });
      dowBox.setContent(metaListText);

      updateTooltip(selectedBarIdx);

    } catch (err: any) {
      overviewBox.setContent(`{red-fg}Failed to load portfolio statistics:\n\n${err.message}{/red-fg}`);
    }

    screen.render();
  }

  // --- KEYBOARD & PROMPT INTERACTIONS ---

  // Keyboard Navigation to Inspect Downloads
  screen.key(['left'], () => {
    if (selectedBarIdx > 0) {
      updateTooltip(selectedBarIdx - 1);
    }
  });

  screen.key(['right'], () => {
    if (selectedBarIdx < activeDownloads.length - 1) {
      updateTooltip(selectedBarIdx + 1);
    }
  });

  // Scroll AI Verdict
  screen.key(['up'], () => {
    aiBox.scroll(-1);
    screen.render();
  });

  screen.key(['down'], () => {
    aiBox.scroll(1);
    screen.render();
  });

  // Quit
  screen.key(['q', 'C-c'], () => process.exit(0));

  // Refresh
  screen.key(['r'], () => {
    if (viewMode === 'portfolio') {
      loadPortfolioData();
    } else {
      loadData(currentPkgName);
    }
  });

  // Search Package
  screen.key(['s'], () => {
    searchPrompt.input('Enter NPM package name:', '', (err, value) => {
      if (value && value.trim()) {
        currentPkgName = value.trim().toLowerCase();
        viewMode = 'package';
        loadData(currentPkgName);
      }
    });
  });

  // Select AI Model
  screen.key(['m'], () => {
    modelList.show();
    modelList.focus();
    screen.render();
  });

  // AI Chat
  screen.key(['c'], () => {
    chatPrompt.input('Ask a question about this package:', '', async (err, value) => {
      if (value && value.trim()) {
        const userQ = value.trim();
        aiBox.setContent(aiBox.getContent() + `\n\n{cyan-fg}User: ${userQ}{/cyan-fg}`);
        aiBox.setScrollPerc(100);
        screen.render();

        try {
          const response = await askAi(userQ, () => {
            aiBox.setLabel(` 🧠 AI BUREAU (Thinking...) `);
            screen.render();
          });
          aiBox.setLabel(` 🧠 AI BUREAU VERDICT `);
          const escapedResponse = response.replace(/{/g, '{|').replace(/}/g, '|}');
          aiBox.setContent(aiBox.getContent() + `\n{magenta-fg}AI: ${escapedResponse}{/magenta-fg}`);
          aiBox.setScrollPerc(100);
          screen.render();
        } catch (e: any) {
          aiBox.setLabel(` 🧠 AI BUREAU VERDICT `);
          aiBox.setContent(aiBox.getContent() + `\n{red-fg}Error: ${e.message}{/red-fg}`);
          aiBox.setScrollPerc(100);
          screen.render();
        }
      }
    });
  });

  // Toggle view mode (Package Report vs Portfolio Index)
  screen.key(['p'], () => {
    if (!user) {
      emailPrompt.input('Sign in to view portfolio. Enter Email:', '', (err, email) => {
        if (email && email.trim()) {
          passwordPrompt.input('Enter Password:', '', async (err2, password) => {
            if (password) {
              headerBox.setContent('{center}Authenticating reader...{/center}');
              screen.render();
              try {
                const authenticatedUser = await signInUser(email.trim(), password);
                user = authenticatedUser;
                viewMode = 'portfolio';
                await loadPortfolioData();
              } catch (e: any) {
                headerBox.setContent(`{center}{red-fg}Auth failed: ${e.message}{/red-fg}{/center}`);
                screen.render();
                setTimeout(() => updateHeader(), 2000);
              }
            }
          });
        }
      });
      return;
    }

    viewMode = viewMode === 'package' ? 'portfolio' : 'package';
    updateHeader();
    if (viewMode === 'portfolio') {
      loadPortfolioData();
    } else {
      loadData(currentPkgName);
    }
  });

  // Login / Account Settings
  screen.key(['l'], () => {
    if (user) {
      // Logged in: show profile box and offer sign out
      const msg = `Logged in as: ${user.displayName || user.email}\n` +
                  `Watchlist size: ${user.watchlist?.length || 0} packages\n\n` +
                  `Press [S] to Sign Out, [C] to Cancel.`;
      
      const confirmBox = blessed.box({
        parent: screen,
        border: 'line',
        height: 8,
        width: 'half',
        top: 'center',
        left: 'center',
        label: ' Reader Account ',
        content: msg,
        tags: true,
        style: { border: { fg: 'yellow' }, label: { fg: 'yellow', bold: true } },
      });
      confirmBox.focus();
      screen.render();

      const handleKey = (ch: string, key: any) => {
        if (key.name === 's') {
          signOutUser().then(() => {
            user = null;
            viewMode = 'package';
            confirmBox.destroy();
            updateHeader();
            loadData(currentPkgName);
          });
        } else if (key.name === 'c' || key.name === 'escape') {
          confirmBox.destroy();
          screen.render();
        }
      };
      confirmBox.on('keypress', handleKey);
      return;
    }

    // Guest: prompt to Sign In or Sign Up
    emailPrompt.input('Enter Email Address:', '', (err, email) => {
      if (email && email.trim()) {
        passwordPrompt.input('Enter Password:', '', async (err2, password) => {
          if (password) {
            headerBox.setContent('{center}Transmitting login telegram...{/center}');
            screen.render();
            try {
              const authenticatedUser = await signInUser(email.trim(), password);
              user = authenticatedUser;
              updateHeader();
              loadData(currentPkgName);
            } catch (e: any) {
              // Sign in failed, prompt to sign up instead
              const signUpConfirm = blessed.prompt({
                parent: screen,
                border: 'line',
                height: 7,
                width: 'half',
                top: 'center',
                left: 'center',
                label: ' Account Not Found ',
                tags: true,
                style: { border: { fg: 'red' } }
              });
              signUpConfirm.input('Create new account with these credentials? (y/n):', '', async (err3, confirmText) => {
                if (confirmText && confirmText.trim().toLowerCase() === 'y') {
                  headerBox.setContent('{center}Creating reader profile...{/center}');
                  screen.render();
                  try {
                    const newUser = await signUpUser(email.trim(), password);
                    user = newUser;
                    updateHeader();
                    loadData(currentPkgName);
                  } catch (signUpErr: any) {
                    headerBox.setContent(`{center}{red-fg}Registration failed: ${signUpErr.message}{/red-fg}{/center}`);
                    screen.render();
                    setTimeout(() => updateHeader(), 2000);
                  }
                } else {
                  updateHeader();
                  loadData(currentPkgName);
                }
              });
            }
          }
        });
      }
    });
  });

  // Toggle Track Package for logged in user
  screen.key(['t'], async () => {
    if (!user) {
      headerBox.setContent('{center}{red-fg}Sign in using [L] first to track assets{/red-fg}{/center}');
      screen.render();
      setTimeout(() => updateHeader(), 2000);
      return;
    }

    try {
      const lowerName = currentPkgName.toLowerCase();
      const isCurrentlyTracked = user.watchlist?.some((p: any) => p.name.toLowerCase() === lowerName);
      
      let updatedWatchlist;
      if (isCurrentlyTracked) {
        updatedWatchlist = await untrackPackage(user.uid, currentPkgName);
        headerBox.setContent(`{center}Untracked asset: ${currentPkgName}{/center}`);
      } else {
        updatedWatchlist = await trackPackage(user.uid, currentPkgName, 15);
        headerBox.setContent(`{center}{green-fg}Tracking asset: ${currentPkgName}{/green-fg}{/center}`);
      }
      
      user.watchlist = updatedWatchlist;
      updateHeader();
      screen.render();
      setTimeout(() => updateHeader(), 2000);
    } catch (e: any) {
      headerBox.setContent(`{center}{red-fg}Tracking failed: ${e.message}{/red-fg}{/center}`);
      screen.render();
      setTimeout(() => updateHeader(), 2000);
    }
  });

  // Forecast Simulation prompt modal
  screen.key(['u'], () => {
    const scenariosText = 
      'Select Simulation Growth Scenario:\n' +
      '1) Flat Boost (+100k downloads/day)\n' +
      '2) Compounding Daily Growth (+2% daily)\n' +
      '3) Sudden Negative Shock (-30% drop starting day 14)\n' +
      '4) None (Reset Baseline)\n' +
      'Enter selection (1-4):';
    
    simPrompt.input(scenariosText, '', (err, value) => {
      if (value) {
        const sel = value.trim();
        if (sel === '1') {
          simScenario = { type: 'flat_add', value: 100 };
        } else if (sel === '2') {
          simScenario = { type: 'compound', value: 2 };
        } else if (sel === '3') {
          simScenario = { type: 'event_shock', value: -30 };
        } else {
          simScenario = { type: 'none', value: 0 };
        }
        updateHeader();
        loadData(currentPkgName);
      }
    });
  });

  // ASCII Splash Screen Modal Box
  const splashBox = blessed.box({
    parent: screen,
    border: 'line',
    height: 'shrink',
    width: 'shrink',
    top: 'center',
    left: 'center',
    label: ' 📰 THE DAILY NPM - SPECIAL EDITION ',
    tags: true,
    hidden: true,
    style: {
      border: { fg: 'yellow' },
      label: { fg: 'yellow', bold: true },
      bg: 'black',
    },
  });

  const asciiArt = 
    `\n` +
    `{center}{yellow-fg}{bold}DAILY.NPM{/bold}{/yellow-fg}{/center}\n\n` +
    `{center}{cyan-fg}The World's Preeminent Journal of Package Intelligence & Node Statistics{/cyan-fg}{/center}\n\n\n` +
    `{center}Press {bold}any key{/bold} to return to the Wire Dispatches...{/center}`;

  splashBox.setContent(asciiArt);

  // ASCII Splash Screen Toggle
  screen.key(['escape'], () => {
    if (splashBox.hidden) {
      splashBox.show();
      splashBox.focus();
    } else {
      splashBox.hide();
    }
    screen.render();
  });

  splashBox.on('element keypress', () => {
    splashBox.hide();
    screen.render();
  });

  splashBox.on('keypress', () => {
    splashBox.hide();
    screen.render();
  });

  // Initial Load
  loadData(currentPkgName);
}
