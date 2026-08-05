import blessed from 'blessed';
import contrib from 'blessed-contrib';
import pc from 'picocolors';
import { getPackageInfo, getDownloadStats } from '../services/npm.js';
import { getAiInsights, setAiModel, askAi } from '../services/ai.js';
import { computeDownloadRegression } from '../utils/regressionEngine.js';

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
    
    // Format trend predictions compactly to prevent text wrapping
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
    maxHeight: 0, // CRITICAL: blessed-contrib bug causes NaN crash if this is undefined
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
    content: ' {bold}[←/→]{/bold} Bar  •  {bold}[↑/↓]{/bold} Scroll AI  •  {bold}[S]{/bold} Search  •  {bold}[C]{/bold} Chat AI  •  {bold}[M]{/bold} Model  •  {bold}[R]{/bold} Refresh  •  {bold}[Q]{/bold} Quit ',
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

  let currentPkgName = initialPackage;
  let activeDownloads: { day: string; downloads: number }[] = [];
  let selectedBarIdx = 0;

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

  async function loadData(pkgName: string) {
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

      const downloads = stats.downloads || [];
      activeDownloads = downloads;
      selectedBarIdx = downloads.length - 1;

      const total30d = downloads.reduce((acc: number, d: any) => acc + d.downloads, 0);
      const avgDaily = downloads.length > 0 ? Math.round(total30d / downloads.length) : 0;
      const reg = computeDownloadRegression(downloads, info.time?.created, 'seasonal_linear', 14);

      // Render Header
      headerBox.setContent(
        `{center}{bold}THE DAILY NPM - TERMINAL EDITION{/bold}{/center}\n` +
        `{center}SPECIAL REPORT: {yellow-fg}{bold}${info.name.toUpperCase()}{/bold}{/yellow-fg} (v${info.latestVersion})  •  LICENSE: {green-fg}${info.license}{/green-fg}{/center}`
      );

      // Render Overview Box
      const overviewText =
        `{bold}Name:{/bold} {cyan-fg}${info.name}{/cyan-fg}\n` +
        `{bold}Latest Version:{/bold} v${info.latestVersion}\n` +
        `{bold}License:{/bold} ${info.license}\n` +
        `{bold}30D Volume:{/bold} {yellow-fg}${total30d.toLocaleString()}{/yellow-fg}\n` +
        `{bold}Daily Pace:{/bold} ${avgDaily.toLocaleString()}/day\n` +
        `{bold}Tomorrow Forecast:{/bold} {green-fg}${reg.nextDayPredictedDownloads.toLocaleString()}{/green-fg}\n` +
        `{bold}Dependencies:{/bold} ${Object.keys(info.dependencies).length} direct / ${Object.keys(info.devDependencies).length} dev\n` +
        `{bold}Age:{/bold} ${reg.packageAgeFormatted}\n\n` +
        `{cyan-fg}${info.description.slice(0, 120)}...{/cyan-fg}`;
      overviewBox.setContent(overviewText);

      // Render Bar Chart Box
      // Dynamically calculate max bars based on estimated physical terminal width (7 cols out of 12)
      const screenCols = screen.cols || 80;
      const estimatedWidth = Math.floor((7 / 12) * screenCols);
      const maxBars = Math.max(5, Math.floor((estimatedWidth - 4) / 3)); // 3 chars per bar (2 width + 1 spacing)
      const chartDownloads = downloads.slice(-maxBars);

      const barTitles = chartDownloads.map((d: any) => d.day.slice(8)); // Short date e.g. "03", "04"
      const barData = chartDownloads.map((d: any) => d.downloads);

      chartBox.setData({
        titles: barTitles,
        data: barData,
      });

      // Render Sparkline with extended trends (Using the full 30 days of data, not the truncated barData)
      const fullDownloadsData = downloads.map((d: any) => d.downloads);
      (sparklineBox as any).setTrendData(fullDownloadsData, reg);

      updateTooltip(selectedBarIdx);

      // Render Day-of-Week Velocity Box
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

      // Render AI Insights Box (in background)
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
        
        donutBox.setData([{
          percent: insights.healthScore,
          label: 'SCORE',
          color: scoreColor,
        }]);
        
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
      
      dowBox.setData({ headers: ['Error'], data: [['---']] });
      aiBox.setContent(`{red-fg}Analysis halted due to fetch error.{/red-fg}`);
      donutBox.setData([{ percent: 0, label: 'Err', color: 'red' }]);
      tooltipBox.setContent('');
    }

    screen.render();
  }

  // Keyboard Arrow Navigation to Inspect Daily Downloads
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

  // Keyboard Arrow Navigation to Scroll AI Bureau
  screen.key(['up'], () => {
    aiBox.scroll(-1);
    screen.render();
  });

  screen.key(['down'], () => {
    aiBox.scroll(1);
    screen.render();
  });

  // Mouse Click & Movement Support
  chartBox.on('click', (data: any) => {
    if (activeDownloads.length === 0) return;
    // Estimate bar index from click X position
    const boxLeft = typeof chartBox.left === 'number' ? chartBox.left : 0;
    const boxWidth = typeof chartBox.width === 'number' ? chartBox.width : 1;
    const relX = (data.x || 0) - boxLeft;
    const estIdx = Math.floor((relX / Math.max(1, boxWidth)) * activeDownloads.length);
    updateTooltip(estIdx);
  });

  // Keybindings
  screen.key(['q', 'C-c'], () => process.exit(0));

  screen.key(['r'], () => loadData(currentPkgName));

  screen.key(['s'], () => {
    searchPrompt.input('Enter NPM package name:', '', (err, value) => {
      if (value && value.trim()) {
        currentPkgName = value.trim().toLowerCase();
        loadData(currentPkgName);
      }
    });
  });

  screen.key(['m'], () => {
    modelList.show();
    modelList.focus();
    screen.render();
  });

  screen.key(['c'], () => {
    chatPrompt.input('Ask a question about this package:', '', async (err, value) => {
      if (value && value.trim()) {
        const userQ = value.trim();
        aiBox.setContent(aiBox.getContent() + `\n\n{cyan-fg}User: ${userQ}{/cyan-fg}`);
        aiBox.setScrollPerc(100); // auto-scroll to bottom
        screen.render();

        try {
          const response = await askAi(userQ, (status) => {
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

  // Initial Load
  loadData(currentPkgName);
}
