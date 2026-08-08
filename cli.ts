import { Command } from "commander";
import pc from "picocolors";
import ora from "ora";
import Table from "cli-table3";
import { getPackageInfo, getDownloadStats, comparePackages } from "./src/services/npm.js";
import { getAiInsights } from "./src/services/ai.js";
import { renderAsciiLineChart, renderAsciiForecastChart, renderAsciiBarChart } from "./src/cli/charts.js";
import { computeDownloadRegression } from "./src/utils/regressionEngine.js";
import { launchTui } from "./src/cli/tui.js";
import dotenv from "dotenv";

dotenv.config();

const program = new Command();

program
  .name("npm-pulse")
  .description("CLI & Interactive TUI to fetch NPM package stats, ASCII graphs, and AI insights")
  .version("1.0.0");

program
  .command("tui [package]")
  .alias("dashboard")
  .description("Launch the interactive full-screen Terminal User Interface (TUI)")
  .action(async (pkg = "react") => {
    await launchTui(pkg);
  });

program
  .command("info <package>")
  .description("Get information about an NPM package")
  .action(async (pkg) => {
    const spinner = ora(`Fetching info for ${pkg}...`).start();
    try {
      const info = await getPackageInfo(pkg);
      spinner.succeed(pc.green(`Found ${pkg}`));
      
      console.log(`\n📦 ${pc.bold(pc.cyan(info.name))} (v${info.latestVersion})`);
      console.log(`${pc.italic(info.description)}`);
      if (info.license) console.log(`${pc.bold("License:")} ${info.license}`);
      if (info.homepage) console.log(`${pc.bold("Homepage:")} ${pc.underline(pc.blue(info.homepage))}`);
      console.log(`${pc.bold("Dependencies:")} ${Object.keys(info.dependencies).length}`);
      console.log(`${pc.bold("DevDependencies:")} ${Object.keys(info.devDependencies).length}`);
    } catch (err: any) {
      spinner.fail(pc.red(err.message || "Failed to fetch package info"));
    }
  });

program
  .command("stats <package> [period]")
  .description("Get download statistics and ASCII line graph for a package")
  .action(async (pkg, period = "last-month") => {
    const spinner = ora(`Fetching stats & regression for ${pkg} (${period})...`).start();
    try {
      const stats = await getDownloadStats(pkg, period);
      const info = await getPackageInfo(pkg);
      spinner.succeed(pc.green(`Stats for ${pkg}`));
      
      const downloads = stats.downloads || [];
      const total = downloads.reduce((acc: number, d: any) => acc + d.downloads, 0);
      const values = downloads.map((d: any) => d.downloads);
      const reg = computeDownloadRegression(downloads, info.time?.created, 'seasonal_linear', 14);

      console.log(`\n📈 ${pc.bold(pc.cyan(pkg))} downloads in ${period}:`);
      console.log(`${pc.bold("Total Downloads:")} ${pc.yellow(total.toLocaleString())}`);
      console.log(`${pc.bold("Daily Pace:")} ${pc.yellow(Math.round(total / (downloads.length || 1)).toLocaleString())}/day`);
      console.log(`${pc.bold("Tomorrow Forecast:")} ${pc.green(reg.nextDayPredictedDownloads.toLocaleString())}`);
      console.log(`${pc.bold("Date Range:")} ${stats.start} to ${stats.end}`);

      // ASCII Line Chart
      console.log(`\n${pc.bold(pc.magenta("ASCII Download Trend & Forecast Curve:"))}`);
      const projectedVals = reg.projectedDays.map((p: any) => p.downloads);
      const chartStr = renderAsciiForecastChart(values, projectedVals, 10);
      console.log(chartStr);
      console.log(`${pc.dim("Cyan = Historical downloads  •  Magenta = 14-day prediction")}\n`);
    } catch (err: any) {
      spinner.fail(pc.red(err.message || "Failed to fetch package stats"));
    }
  });

program
  .command("compare <packages...>")
  .description("Compare multiple NPM packages in a terminal table")
  .option("-p, --period <period>", "Time period for downloads", "last-month")
  .action(async (packages, options) => {
    const spinner = ora(`Comparing ${packages.join(", ")}...`).start();
    try {
      const data = await comparePackages(packages, options.period);
      spinner.succeed(pc.green(`Comparison ready!`));
      
      const table = new Table({
        head: [pc.bold("Package"), pc.bold("Version"), pc.bold("30D Downloads"), pc.bold("License"), pc.bold("Deps")]
      });
      
      packages.forEach((pkg) => {
        const pkgData = data.results[pkg];
        if (pkgData && pkgData.info) {
          const totalDownloads = pkgData.downloads?.reduce((acc: number, val: any) => acc + val.downloads, 0) || 0;
          table.push([
            pc.cyan(pkgData.info.name),
            pkgData.info.latestVersion,
            pc.yellow(totalDownloads.toLocaleString()),
            pkgData.info.license,
            pkgData.info.dependenciesCount.toString()
          ]);
        } else {
          table.push([pc.red(pkg), "Not found", "-", "-", "-"]);
        }
      });
      
      console.log(`\nComparison for ${options.period}:`);
      console.log(table.toString());
    } catch (err: any) {
      spinner.fail(pc.red(err.message || "Failed to compare packages"));
    }
  });

program
  .command("insights <package>")
  .description("Get Gemini AI insights for an NPM package")
  .action(async (pkg) => {
    const spinner = ora(`Fetching package info and AI insights for ${pkg}...`).start();
    try {
      const info = await getPackageInfo(pkg);
      const stats = await getDownloadStats(pkg, "last-month");
      const totalDownloads = stats.downloads?.reduce((acc: number, val: any) => acc + val.downloads, 0) || 0;
      
      let ageInDays = 0;
      if (info.time?.created) {
        ageInDays = Math.floor((Date.now() - new Date(info.time.created).getTime()) / (1000 * 60 * 60 * 24));
      }
      
      const insights = await getAiInsights({
        packageName: info.name,
        description: info.description,
        totalDownloads,
        version: info.latestVersion,
        ageInDays,
        dependenciesCount: Object.keys(info.dependencies).length
      });
      
      spinner.succeed(pc.green(`Insights for ${pkg}`));
      
      console.log(`\n🧠 ${pc.bold(pc.magenta("Gemini AI Insights"))}`);
      console.log(`${pc.bold("Summary:")} ${insights.summary}`);
      
      const scoreColor = insights.healthScore >= 80 ? pc.green : (insights.healthScore >= 50 ? pc.yellow : pc.red);
      console.log(`${pc.bold("Health Score:")} ${scoreColor(insights.healthScore)} / 100`);
      
      console.log(`\n${pc.bold(pc.green("Pros:"))}`);
      insights.pros.forEach((p: string) => console.log(`  ${pc.green("✓")} ${p}`));
      
      console.log(`\n${pc.bold(pc.red("Cons:"))}`);
      insights.cons.forEach((c: string) => console.log(`  ${pc.red("✗")} ${c}`));
      
      console.log(`\n${pc.bold("Verdict:")} ${pc.italic(insights.verdict)}`);
      if (!insights.aiGenerated) {
        console.log(`\n${pc.dim("(Note: GROQ_API_KEY was not found, showing heuristic fallback)")}`);
      }
    } catch (err: any) {
      spinner.fail(pc.red(err.message || "Failed to fetch AI insights"));
    }
  });

// Default to launching TUI or showing help if no command provided
if (process.argv.length === 2) {
  launchTui("react");
} else {
  program.parse();
}
