import { PackageMetadata, DownloadPoint, ComparisonPackage, AIInsights } from '../types';

export const POPULAR_PRESETS = [
  { label: 'UI Frameworks', packages: ['react', 'vue', 'svelte', '@angular/core'] },
  { label: 'HTTP Servers', packages: ['express', 'fastify', 'hono', 'koa'] },
  { label: 'State & Query', packages: ['zustand', 'react-redux', '@tanstack/react-query'] },
  { label: 'Build Tools', packages: ['vite', 'esbuild', 'webpack', 'rollup'] },
  { label: 'Date Utils', packages: ['dayjs', 'date-fns', 'moment', 'luxon'] },
  { label: 'CSS / Styling', packages: ['tailwindcss', 'styled-components', 'emotion'] },
];

// Helper to check if running in static mode (e.g. GitHub pages) or if the Express server is not reachable
async function tryFetchJson(url: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchPackageMetadata(pkgName: string): Promise<PackageMetadata> {
  const cleanName = pkgName.trim();
  const encodedPath = cleanName.startsWith('@')
    ? `@${encodeURIComponent(cleanName.slice(1))}`
    : encodeURIComponent(cleanName);

  try {
    // 1. Try local express backend proxy
    return await tryFetchJson(`/api/npm/package/${encodedPath}`);
  } catch (e) {
    console.warn(`Local API proxy unavailable, falling back to direct NPM registry lookup for: ${cleanName}`, e);
    // 2. Client-side fallback: Fetch from public registry directly
    let data;
    try {
      const npmRes = await fetch(`https://registry.npmjs.org/${encodedPath}`);
      if (!npmRes.ok) {
        throw new Error(`Registry responded with status ${npmRes.status}`);
      }
      data = await npmRes.json();
    } catch (registryErr) {
      console.warn(`Direct registry lookup failed for ${cleanName}, trying npmmirror fallback`, registryErr);
      try {
        const mirrorRes = await fetch(`https://registry.npmmirror.com/${encodedPath}`);
        if (!mirrorRes.ok) {
          if (mirrorRes.status === 404) {
            throw new Error(`Package "${cleanName}" not found on NPM registry.`);
          }
          throw new Error(`Failed to fetch package data from mirror (${mirrorRes.status})`);
        }
        data = await mirrorRes.json();
      } catch (mirrorErr: any) {
        throw new Error(mirrorErr.message || `Failed to fetch package data for "${cleanName}". Please verify the package name and internet connection.`);
      }
    }

    if (!data) {
      throw new Error(`Empty response received for package "${cleanName}".`);
    }

    const latestVersionTag = data['dist-tags']?.latest || (data.versions ? Object.keys(data.versions).pop() : '') || 'unknown';
    const latestVersion = (data.versions && latestVersionTag) ? (data.versions[latestVersionTag] || {}) : {};

    return {
      name: data.name || cleanName,
      description: data.description || latestVersion.description || "No description provided.",
      latestVersion: latestVersionTag || "unknown",
      homepage: data.homepage || latestVersion.homepage || (data.repository?.url ? data.repository.url.replace(/^git\+/, "").replace(/\.git$/, "") : null),
      repository: data.repository || latestVersion.repository || null,
      license: data.license || latestVersion.license || "Unspecified",
      keywords: data.keywords || latestVersion.keywords || [],
      author: data.author || latestVersion.author || null,
      maintainers: data.maintainers || latestVersion.maintainers || [],
      time: {
        created: data.time?.created || null,
        modified: data.time?.modified || null,
        latest: data.time?.[latestVersionTag] || null,
      },
      totalVersionsCount: Object.keys(data.time || {}).filter(k => k !== "created" && k !== "modified" && k !== "unsigned").length,
      dependencies: latestVersion.dependencies || {},
      devDependencies: latestVersion.devDependencies || {},
      peerDependencies: latestVersion.peerDependencies || {},
      readme: typeof data.readme === "string" ? data.readme.slice(0, 3000) : "",
    };
  }
}

export async function fetchPackageDownloads(
  pkgName: string,
  period: string = 'last-month'
): Promise<{ downloads: DownloadPoint[]; start: string; end: string }> {
  const cleanName = pkgName.trim();
  const encodedPath = cleanName.startsWith('@')
    ? `@${encodeURIComponent(cleanName.slice(1))}`
    : encodeURIComponent(cleanName);

  try {
    // 1. Try local express backend proxy
    return await tryFetchJson(`/api/npm/downloads/${period}/${encodedPath}`);
  } catch (e) {
    console.warn(`Local API proxy unavailable, falling back to direct NPM downloads API lookup for: ${cleanName}`, e);
    // 2. Client-side fallback: Fetch from public downloads API directly
    const res = await fetch(`https://api.npmjs.org/downloads/range/${period}/${encodedPath}`);
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(`Download statistics not found for "${cleanName}".`);
      }
      throw new Error(`Failed to fetch downloads from NPM API (${res.status})`);
    }
    return res.json();
  }
}

export async function comparePackagesBatch(
  packages: string[],
  period: string = 'last-month'
): Promise<{ period: string; results: Record<string, any> }> {
  try {
    // 1. Try local express backend proxy
    return await tryFetchJson('/api/npm/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packages, period }),
    });
  } catch (e) {
    console.warn("Local API proxy comparison failed, running client-side parallel comparison", e);
    // 2. Client-side fallback: Query individual packages in parallel
    const results: Record<string, any> = {};

    await Promise.all(
      packages.map(async (pkg: string) => {
        const cleanName = pkg.trim();
        if (!cleanName) return;
        try {
          const encodedName = cleanName.startsWith("@")
            ? `@${encodeURIComponent(cleanName.slice(1))}`
            : encodeURIComponent(cleanName);

          const [infoRes, dlRes] = await Promise.all([
            fetch(`https://registry.npmjs.org/${encodedName}`),
            fetch(`https://api.npmjs.org/downloads/range/${period}/${encodedName}`),
          ]);

          let infoData = null;
          let dlData = null;

          if (infoRes.ok) {
            const raw = await infoRes.json();
            const latestTag = raw["dist-tags"]?.latest || Object.keys(raw.versions || {}).pop();
            const latestVer = raw.versions?.[latestTag] || {};
            infoData = {
              name: raw.name,
              description: raw.description || latestVer.description || "",
              latestVersion: latestTag || "unknown",
              license: raw.license || latestVer.license || "Unspecified",
              created: raw.time?.created || null,
              latest: raw.time?.[latestTag] || null,
              dependenciesCount: Object.keys(latestVer.dependencies || {}).length,
              devDependenciesCount: Object.keys(latestVer.devDependencies || {}).length,
            };
          }

          if (dlRes.ok) {
            dlData = await dlRes.json();
          }

          results[cleanName] = {
            info: infoData,
            downloads: dlData?.downloads || [],
            start: dlData?.start,
            end: dlData?.end,
          };
        } catch (err) {
          console.error(`Error comparing ${cleanName} on client:`, err);
        }
      })
    );

    return { period, results };
  }
}

export async function fetchAIInsights(params: {
  packageName: string;
  description: string;
  totalDownloads: number;
  version: string;
  ageInDays: number;
  dependenciesCount: number;
}): Promise<AIInsights> {
  try {
    // 1. Try local express backend proxy
    return await tryFetchJson('/api/npm/ai-insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  } catch (e) {
    console.warn("Local AI insights API unavailable, performing local client-side calculation", e);
    // 2. Client-side fallback: Calculate exact heuristic insights locally
    const {
      packageName,
      description,
      totalDownloads,
      version,
      ageInDays,
      dependenciesCount,
    } = params;

    let score = 70;
    
    // Downloads factor (up to +15)
    if (totalDownloads > 10000000) score += 15;
    else if (totalDownloads > 1000000) score += 10;
    else if (totalDownloads > 100000) score += 5;
    
    // Age factor (up to +15)
    if (ageInDays > 1095) score += 15; // 3+ years
    else if (ageInDays > 365) score += 10; // 1+ year
    else if (ageInDays > 180) score += 5;
    
    // Dependency penalty (up to -10)
    if (dependenciesCount > 20) score -= 10;
    else if (dependenciesCount > 10) score -= 5;
    
    const healthScore = Math.min(100, Math.max(0, score));

    const pros = [
      totalDownloads > 1000000 ? "Highly established within the JS registry registry.npmjs.org." : "Focussed library catering to niche target setups.",
      dependenciesCount <= 5 ? "Minimal direct package dependencies, reducing dependency bloat." : "Feature-rich API offering comprehensive tooling in a single package.",
      ageInDays > 730 ? "Proven historical stability over years of ecosystem existence." : "Modern, fresh approach to solving developer pain points."
    ];

    const cons = [
      dependenciesCount > 15 ? "Heavy dependency graph requires meticulous security auditing." : "Requires careful major version tracking for API drift.",
      "Verify project compatibility and bundler configuration limits before production use."
    ];

    const summary = `${packageName} is a ${ageInDays > 730 ? "mature" : "recent"} package (v${version || "unknown"}) in the Node ecosystem. It processes approximately ${totalDownloads ? totalDownloads.toLocaleString() : "a moderate level of"} weekly downloads and is structured with ${dependenciesCount} dependency links.`;

    let verdict = "MODEST ADOPTION. MONITOR FOR UNSTABLE UPGRADES AND HEURISTICS.";
    if (healthScore >= 90) {
      verdict = dependenciesCount <= 3 
        ? "EXCELLENT STANDING. HIGHLY RECOMMENDED FOR GENERAL INTEGRATION."
        : "STRONG ARCHITECTURE. PROCEED WITH SOLID ECOSYSTEM BACKING.";
    } else if (healthScore >= 75) {
      verdict = ageInDays < 180
        ? "MODERN DESIGN WITH VIGOROUS TRACTION. SUITABLE FOR PRODUCTION WITH ATTENTIVE PINNING."
        : "STABLE WORKHORSE. WORTHY OF STANDARD DEPLOYMENTS.";
    } else if (healthScore >= 50) {
      if (dependenciesCount > 15) {
        verdict = "CAUTION ADVISEMENT. HEAVY DEPENDENCY TREE REQUIRES DILIGENT AUDITING.";
      }
    } else {
      verdict = "HIGH RISK RATING. DEPRECATED OR UNMAINTAINED TELEMETRY DETECTED.";
    }

    return {
      summary,
      healthScore,
      pros,
      cons,
      verdict,
      aiGenerated: false
    };
  }
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(2) + 'B';
  }
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(2) + 'M';
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + 'K';
  }
  return num.toString();
}

export function formatCompactDate(dateStr: string): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}
