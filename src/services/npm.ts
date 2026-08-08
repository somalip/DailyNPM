const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export function getCached(key: string) {
  const item = cache.get(key);
  if (item && Date.now() - item.timestamp < CACHE_TTL_MS) {
    return item.data;
  }
  return null;
}

export function setCache(key: string, data: any) {
  cache.set(key, { data, timestamp: Date.now() });
}

function parseGithubUrl(repoUrl?: string | null): { owner: string; repo: string } | null {
  if (!repoUrl || typeof repoUrl !== "string") return null;
  const cleanUrl = repoUrl.replace(/^git\+/, "").replace(/\.git$/, "").replace(/^git:\/\//, "https://");
  const match = cleanUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (match) {
    const owner = match[1];
    let repo = match[2];
    const hashIdx = repo.indexOf("#");
    if (hashIdx !== -1) repo = repo.substring(0, hashIdx);
    const slashIdx = repo.indexOf("/");
    if (slashIdx !== -1) repo = repo.substring(0, slashIdx);
    return { owner, repo };
  }
  return null;
}

async function fetchGithubStats(owner: string, repo: string) {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        "User-Agent": "DailyNPM-App"
      }
    });
    if (!res.ok) {
      if (res.status === 403 || res.status === 404) {
        return null;
      }
      throw new Error(`GitHub API responded with status ${res.status}`);
    }
    const data = await res.json();
    return {
      stars: data.stargazers_count || 0,
      forks: data.forks_count || 0,
      openIssues: data.open_issues_count || 0,
      watchers: data.subscribers_count || data.watchers_count || 0,
      lastCommit: data.pushed_at || null,
      homepage: data.homepage || null
    };
  } catch (err) {
    console.error("Error fetching GitHub stats:", err);
    return null;
  }
}

function calculateReleaseVelocity(timeObj?: Record<string, string>) {
  if (!timeObj) return { releasesLastYear: 0, avgDaysBetweenReleases: 0, daysSinceLastRelease: 0 };
  const dates = Object.entries(timeObj)
    .filter(([k]) => k !== "created" && k !== "modified" && k !== "unsigned")
    .map(([_, v]) => new Date(v).getTime())
    .sort((a, b) => b - a);

  if (dates.length === 0) {
    return { releasesLastYear: 0, avgDaysBetweenReleases: 0, daysSinceLastRelease: 0 };
  }

  const now = Date.now();
  const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;
  const releasesLastYear = dates.filter(d => d >= oneYearAgo).length;

  let avgDaysBetweenReleases = 0;
  if (dates.length > 1) {
    const totalDiff = dates[0] - dates[dates.length - 1];
    avgDaysBetweenReleases = Math.round((totalDiff / (dates.length - 1)) / (1000 * 60 * 60 * 24));
  }

  const daysSinceLastRelease = Math.max(0, Math.round((now - dates[0]) / (1000 * 60 * 60 * 24)));

  return {
    releasesLastYear,
    avgDaysBetweenReleases,
    daysSinceLastRelease
  };
}

export async function getPackageInfo(pkgName: string) {
  const cacheKey = `pkg:${pkgName}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const encodedName = pkgName.startsWith("@")
    ? `@${encodeURIComponent(pkgName.slice(1))}`
    : encodeURIComponent(pkgName);

  const npmRes = await fetch(`https://registry.npmjs.org/${encodedName}`);
  if (!npmRes.ok) {
    if (npmRes.status === 404) {
      throw new Error(`Package "${pkgName}" not found on NPM registry.`);
    }
    throw new Error(`Failed to fetch package data from NPM (${npmRes.status})`);
  }

  const data = await npmRes.json();
  const latestVersionTag = data["dist-tags"]?.latest || Object.keys(data.versions || {}).pop();
  const latestVersion = data.versions?.[latestVersionTag] || {};

  const repoUrl = data.repository?.url || latestVersion.repository?.url || data.repository || latestVersion.repository;
  const parsedRepo = parseGithubUrl(typeof repoUrl === "string" ? repoUrl : repoUrl?.url);

  let githubStats = null;
  if (parsedRepo) {
    githubStats = await fetchGithubStats(parsedRepo.owner, parsedRepo.repo);
  }

  if (!githubStats) {
    githubStats = {
      stars: null,
      forks: null,
      openIssues: null,
      watchers: null,
      lastCommit: data.time?.[latestVersionTag] || data.time?.modified || null,
      homepage: data.homepage || null
    };
  }

  const releaseVelocity = calculateReleaseVelocity(data.time);

  const formattedData = {
    name: data.name,
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
    github: githubStats,
    releaseVelocity
  };

  setCache(cacheKey, formattedData);
  return formattedData;
}

export async function getDownloadStats(pkgName: string, period: string) {
  const cacheKey = `dl:${period}:${pkgName}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const encodedName = pkgName.startsWith("@")
    ? `@${encodeURIComponent(pkgName.slice(1))}`
    : encodeURIComponent(pkgName);

  const apiUrl = `https://api.npmjs.org/downloads/range/${period}/${encodedName}`;
  const npmRes = await fetch(apiUrl);

  if (!npmRes.ok) {
    if (npmRes.status === 404) {
      throw new Error(`Download statistics not found for "${pkgName}".`);
    }
    throw new Error(`Failed to fetch downloads from NPM API (${npmRes.status})`);
  }

  const data = await npmRes.json();
  setCache(cacheKey, data);
  return data;
}

export async function comparePackages(packages: string[], period = "last-month") {
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
          
          const releaseVelocity = calculateReleaseVelocity(raw.time);
          const repoUrl = raw.repository?.url || latestVer.repository?.url || raw.repository || latestVer.repository;
          const parsedRepo = parseGithubUrl(typeof repoUrl === "string" ? repoUrl : repoUrl?.url);
          let githubStats = null;
          if (parsedRepo) {
            githubStats = await fetchGithubStats(parsedRepo.owner, parsedRepo.repo);
          }
          if (!githubStats) {
            githubStats = {
              stars: 0,
              forks: 0,
              openIssues: 0,
              watchers: 0,
              lastCommit: raw.time?.[latestTag] || raw.time?.modified || null,
              homepage: raw.homepage || null
            };
          }

          infoData = {
            name: raw.name,
            description: raw.description || latestVer.description || "",
            latestVersion: latestTag || "unknown",
            license: raw.license || latestVer.license || "Unspecified",
            created: raw.time?.created || null,
            latest: raw.time?.[latestTag] || null,
            dependenciesCount: Object.keys(latestVer.dependencies || {}).length,
            devDependenciesCount: Object.keys(latestVer.devDependencies || {}).length,
            github: githubStats,
            releaseVelocity
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
        console.error(`Error comparing ${cleanName}:`, err);
      }
    })
  );

  return { period, results };
}
