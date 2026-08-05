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
        console.error(`Error comparing ${cleanName}:`, err);
      }
    })
  );

  return { period, results };
}
