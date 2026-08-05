var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server.ts
var server_exports = {};
__export(server_exports, {
  default: () => server_default
});
module.exports = __toCommonJS(server_exports);
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");

// src/services/npm.ts
var cache = /* @__PURE__ */ new Map();
var CACHE_TTL_MS = 15 * 60 * 1e3;
function getCached(key) {
  const item = cache.get(key);
  if (item && Date.now() - item.timestamp < CACHE_TTL_MS) {
    return item.data;
  }
  return null;
}
function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}
async function getPackageInfo(pkgName) {
  const cacheKey = `pkg:${pkgName}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const encodedName = pkgName.startsWith("@") ? `@${encodeURIComponent(pkgName.slice(1))}` : encodeURIComponent(pkgName);
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
      latest: data.time?.[latestVersionTag] || null
    },
    totalVersionsCount: Object.keys(data.time || {}).filter((k) => k !== "created" && k !== "modified" && k !== "unsigned").length,
    dependencies: latestVersion.dependencies || {},
    devDependencies: latestVersion.devDependencies || {},
    peerDependencies: latestVersion.peerDependencies || {},
    readme: typeof data.readme === "string" ? data.readme.slice(0, 3e3) : ""
  };
  setCache(cacheKey, formattedData);
  return formattedData;
}
async function getDownloadStats(pkgName, period) {
  const cacheKey = `dl:${period}:${pkgName}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const encodedName = pkgName.startsWith("@") ? `@${encodeURIComponent(pkgName.slice(1))}` : encodeURIComponent(pkgName);
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
async function comparePackages(packages, period = "last-month") {
  const results = {};
  await Promise.all(
    packages.map(async (pkg) => {
      const cleanName = pkg.trim();
      if (!cleanName) return;
      try {
        const encodedName = cleanName.startsWith("@") ? `@${encodeURIComponent(cleanName.slice(1))}` : encodeURIComponent(cleanName);
        const [infoRes, dlRes] = await Promise.all([
          fetch(`https://registry.npmjs.org/${encodedName}`),
          fetch(`https://api.npmjs.org/downloads/range/${period}/${encodedName}`)
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
            devDependenciesCount: Object.keys(latestVer.devDependencies || {}).length
          };
        }
        if (dlRes.ok) {
          dlData = await dlRes.json();
        }
        results[cleanName] = {
          info: infoData,
          downloads: dlData?.downloads || [],
          start: dlData?.start,
          end: dlData?.end
        };
      } catch (err) {
        console.error(`Error comparing ${cleanName}:`, err);
      }
    })
  );
  return { period, results };
}

// src/services/ai.ts
function getEditorialVerdict(healthScore, ageInDays, dependenciesCount) {
  if (healthScore >= 90) {
    if (dependenciesCount <= 3) {
      return "EXCELLENT STANDING. HIGHLY RECOMMENDED FOR GENERAL INTEGRATION.";
    }
    return "STRONG ARCHITECTURE. PROCEED WITH SOLID ECOSYSTEM BACKING.";
  } else if (healthScore >= 75) {
    if (ageInDays < 180) {
      return "MODERN DESIGN WITH VIGOROUS TRACTION. SUITABLE FOR PRODUCTION WITH ATTENTIVE PINNING.";
    }
    return "STABLE WORKHORSE. WORTHY OF STANDARD DEPLOYMENTS.";
  } else if (healthScore >= 50) {
    if (dependenciesCount > 15) {
      return "CAUTION ADVISEMENT. HEAVY DEPENDENCY TREE REQUIRES DILIGENT AUDITING.";
    }
    return "MODEST ADOPTION. MONITOR FOR UNSTABLE UPGRADES AND HEURISTICS.";
  } else {
    return "HIGH RISK RATING. DEPRECATED OR UNMAINTAINED TELEMETRY DETECTED.";
  }
}
async function getAiInsights(options) {
  const {
    packageName,
    description,
    totalDownloads,
    version,
    ageInDays,
    dependenciesCount,
    readme,
    onProgress
  } = options;
  if (onProgress) onProgress("Running Heuristic Analysis Bureau...");
  let score = 70;
  if (totalDownloads > 1e7) score += 15;
  else if (totalDownloads > 1e6) score += 10;
  else if (totalDownloads > 1e5) score += 5;
  if (ageInDays > 1095) score += 15;
  else if (ageInDays > 365) score += 10;
  else if (ageInDays > 180) score += 5;
  if (dependenciesCount > 20) score -= 10;
  else if (dependenciesCount > 10) score -= 5;
  const healthScore = Math.min(100, Math.max(0, score));
  const pros = [
    totalDownloads > 1e6 ? "Highly established within the JS registry registry.npmjs.org." : "Focussed library catering to niche target setups.",
    dependenciesCount <= 5 ? "Minimal direct package dependencies, reducing dependency bloat." : "Feature-rich API offering comprehensive tooling in a single package.",
    ageInDays > 730 ? "Proven historical stability over years of ecosystem existence." : "Modern, fresh approach to solving developer pain points."
  ];
  const cons = [
    dependenciesCount > 15 ? "Heavy dependency graph requires meticulous security auditing." : "Requires careful major version tracking for API drift.",
    "Verify project compatibility and bundler configuration limits before production use."
  ];
  const summary = `${packageName} is a ${ageInDays > 730 ? "mature" : "recent"} package (v${version || "unknown"}) in the Node ecosystem. It processes approximately ${totalDownloads ? totalDownloads.toLocaleString() : "a moderate level of"} weekly downloads and is structured with ${dependenciesCount} dependency links.`;
  const verdict = getEditorialVerdict(healthScore, ageInDays, dependenciesCount);
  return {
    summary,
    healthScore,
    pros,
    cons,
    verdict,
    aiGenerated: false
  };
}

// server.ts
var app = (0, import_express.default)();
var PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3e3;
app.use(import_express.default.json());
app.get("/api/npm/package/*", async (req, res) => {
  try {
    const rawPkg = req.params[0];
    if (!rawPkg) {
      return res.status(400).json({ error: "Package name is required" });
    }
    const pkgName = rawPkg.trim();
    const data = await getPackageInfo(pkgName);
    return res.json(data);
  } catch (err) {
    if (err.message.includes("not found")) {
      return res.status(404).json({ error: err.message });
    }
    console.error("Error fetching package info:", err);
    return res.status(500).json({ error: err.message || "Server error fetching package data" });
  }
});
app.get("/api/npm/downloads/*", async (req, res) => {
  try {
    const wildcard = req.params[0];
    if (!wildcard) {
      return res.status(400).json({ error: "Period and package name are required" });
    }
    const parts = wildcard.split("/");
    const period = parts[0];
    const rawPkg = parts.slice(1).join("/");
    if (!rawPkg) {
      return res.status(400).json({ error: "Package name is required" });
    }
    const pkgName = rawPkg.trim();
    const data = await getDownloadStats(pkgName, period);
    return res.json(data);
  } catch (err) {
    if (err.message.includes("not found")) {
      return res.status(404).json({ error: err.message });
    }
    console.error("Error fetching download stats:", err);
    return res.status(500).json({ error: err.message || "Server error fetching download stats" });
  }
});
app.post("/api/npm/compare", async (req, res) => {
  try {
    const { packages, period = "last-month" } = req.body;
    if (!Array.isArray(packages) || packages.length === 0) {
      return res.status(400).json({ error: "Packages array is required" });
    }
    const data = await comparePackages(packages, period);
    return res.json(data);
  } catch (err) {
    console.error("Error in compare API:", err);
    return res.status(500).json({ error: err.message || "Failed to compare packages" });
  }
});
app.post("/api/npm/ai-insights", async (req, res) => {
  try {
    if (!req.body.packageName) {
      return res.status(400).json({ error: "Package name is required" });
    }
    const insights = await getAiInsights(req.body);
    return res.json(insights);
  } catch (err) {
    console.error("Gemini AI insights error:", err);
    return res.status(500).json({ error: err.message || "AI Insights error" });
  }
});
var server_default = app;
async function startServer() {
  const isProduction = process.env.NODE_ENV === "production" || __filename.endsWith("server.cjs") || __dirname.includes("/dist") || __dirname.includes("\\dist");
  if (!isProduction) {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = __dirname;
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}
startServer();
//# sourceMappingURL=server.cjs.map
