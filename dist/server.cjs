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
var import_url = require("url");
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
function parseGithubUrl(repoUrl) {
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
async function fetchGithubStats(owner, repo) {
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
function calculateReleaseVelocity(timeObj) {
  if (!timeObj) return { releasesLastYear: 0, avgDaysBetweenReleases: 0, daysSinceLastRelease: 0 };
  const dates = Object.entries(timeObj).filter(([k]) => k !== "created" && k !== "modified" && k !== "unsigned").map(([_, v]) => new Date(v).getTime()).sort((a, b) => b - a);
  if (dates.length === 0) {
    return { releasesLastYear: 0, avgDaysBetweenReleases: 0, daysSinceLastRelease: 0 };
  }
  const now = Date.now();
  const oneYearAgo = now - 365 * 24 * 60 * 60 * 1e3;
  const releasesLastYear = dates.filter((d) => d >= oneYearAgo).length;
  let avgDaysBetweenReleases = 0;
  if (dates.length > 1) {
    const totalDiff = dates[0] - dates[dates.length - 1];
    avgDaysBetweenReleases = Math.round(totalDiff / (dates.length - 1) / (1e3 * 60 * 60 * 24));
  }
  const daysSinceLastRelease = Math.max(0, Math.round((now - dates[0]) / (1e3 * 60 * 60 * 24)));
  return {
    releasesLastYear,
    avgDaysBetweenReleases,
    daysSinceLastRelease
  };
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
      latest: data.time?.[latestVersionTag] || null
    },
    totalVersionsCount: Object.keys(data.time || {}).filter((k) => k !== "created" && k !== "modified" && k !== "unsigned").length,
    dependencies: latestVersion.dependencies || {},
    devDependencies: latestVersion.devDependencies || {},
    peerDependencies: latestVersion.peerDependencies || {},
    readme: typeof data.readme === "string" ? data.readme.slice(0, 3e3) : "",
    github: githubStats,
    releaseVelocity
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
var import_dotenv = __toESM(require("dotenv"), 1);
import_dotenv.default.config();
function getApiKey() {
  return process.env.GROQ_API_KEY || "";
}
async function requestTieredLlmServer(options) {
  const mistralKey = process.env.MISTRAL_API_KEY;
  const groqKey = options.customGroqKey || process.env.GROQ_API_KEY || getApiKey();
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const messages = options.chatHistory ? options.systemPrompt ? [{ role: "system", content: options.systemPrompt }, ...options.chatHistory] : options.chatHistory : [{ role: "user", content: options.userPrompt || "" }];
  if (mistralKey) {
    try {
      console.warn("Attempting Mistral (Server Proxy)...");
      const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${mistralKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "ministral-3b-latest",
          messages,
          ...options.responseFormatJson ? { response_format: { type: "json_object" } } : {}
        }),
        signal: AbortSignal.timeout(5e3)
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content;
        if (text) return text;
      }
      console.warn("Mistral request failed. Status:", res.status);
    } catch (e) {
      console.warn("Mistral request threw exception:", e);
    }
  }
  if (groqKey) {
    try {
      console.warn("Attempting Groq (Server Proxy)...");
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages,
          ...options.responseFormatJson ? { response_format: { type: "json_object" } } : {}
        }),
        signal: AbortSignal.timeout(5e3)
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content;
        if (text) return text;
      }
      console.warn("Groq request failed. Status:", res.status);
    } catch (e) {
      console.warn("Groq request threw exception:", e);
    }
  }
  if (openRouterKey) {
    try {
      console.warn("Falling back to OpenRouter (Server Proxy)...");
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openRouterKey}`,
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "DailyNPM",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "openai/gpt-4o",
          messages,
          ...options.responseFormatJson ? { response_format: { type: "json_object" } } : {}
        }),
        signal: AbortSignal.timeout(5e3)
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content;
        if (text) return text;
      }
      console.warn("OpenRouter request failed. Status:", res.status);
    } catch (e) {
      console.warn("OpenRouter request threw exception:", e);
    }
  }
  if (geminiKey) {
    try {
      console.warn("Falling back to Gemini (Server Proxy)...");
      let contents = [];
      if (options.chatHistory) {
        contents = options.chatHistory.map((msg) => ({
          role: msg.role === "assistant" || msg.role === "model" ? "model" : "user",
          parts: [{ text: msg.content }]
        }));
      } else {
        contents = [{ role: "user", parts: [{ text: options.userPrompt || "" }] }];
      }
      const geminiPayload = {
        contents,
        ...options.responseFormatJson ? { generationConfig: { responseMimeType: "application/json" } } : {}
      };
      if (options.systemPrompt) {
        geminiPayload.systemInstruction = {
          parts: [{ text: options.systemPrompt }]
        };
      }
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(geminiPayload),
        signal: AbortSignal.timeout(5e3)
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      }
      console.warn("Gemini request failed. Status:", res.status);
    } catch (e) {
      console.warn("Gemini request threw exception:", e);
    }
  }
  throw new Error("All AI providers (Mistral, Groq, OpenRouter, and Gemini) failed to generate a response or keys are missing.");
}
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
  const hasLlmKey = !!(getApiKey() || process.env.MISTRAL_API_KEY || process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY);
  if (hasLlmKey) {
    if (onProgress) onProgress("Consulting Gemini AI Bureau...");
    try {
      const prompt = `You are an expert NPM package analyst. Analyze the following package:
Name: ${packageName}
Description: ${description}
Latest Version: ${version}
Age (Days): ${ageInDays}
Dependencies Count: ${dependenciesCount}
Total 30-Day Downloads: ${totalDownloads}
Readme: ${readme ? readme.slice(0, 1500) : "N/A"}

Please return your response in JSON format matching this schema:
{
  "summary": "A brief 2-3 sentence overview of the package and its purpose.",
  "healthScore": 85, // an integer between 0 and 100 representing package health
  "pros": ["Pro 1", "Pro 2", "Pro 3"], // array of 2-3 key advantages
  "cons": ["Con 1", "Con 2"], // array of 1-2 drawbacks/cautions
  "verdict": "A concise 1-sentence uppercase editorial recommendation verdict."
}

Do not include any markdown formatting (like \`\`\`json) outside the JSON. Return only the raw JSON.`;
      const text = await requestTieredLlmServer({
        userPrompt: prompt,
        responseFormatJson: true
      });
      const insights = JSON.parse(text);
      return {
        summary: insights.summary || "No summary generated.",
        healthScore: typeof insights.healthScore === "number" ? insights.healthScore : 70,
        pros: Array.isArray(insights.pros) ? insights.pros : [],
        cons: Array.isArray(insights.cons) ? insights.cons : [],
        verdict: insights.verdict || "PROCEED WITH CAUTION",
        aiGenerated: true
      };
    } catch (err) {
      console.warn("AI API failed, falling back to heuristics:", err);
    }
  }
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
var import_nodemailer = __toESM(require("nodemailer"), 1);
var import_meta = {};
var __filename = (0, import_url.fileURLToPath)(import_meta.url);
var __dirname = import_path.default.dirname(__filename);
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
app.post("/api/npm/chat", async (req, res) => {
  try {
    const { systemPrompt, userPrompt, chatHistory, responseFormatJson } = req.body;
    const customGroqKey = req.headers["x-custom-groq-key"];
    const response = await requestTieredLlmServer({
      systemPrompt,
      userPrompt,
      chatHistory,
      responseFormatJson,
      customGroqKey
    });
    return res.json({ text: response });
  } catch (err) {
    console.error("Secure AI completions proxy error:", err);
    return res.status(500).json({ error: err.message || "AI completions proxy error" });
  }
});
var otpStore = /* @__PURE__ */ new Map();
var transporter = import_nodemailer.default.createTransport({
  host: process.env.SMTP_HOST || "",
  port: parseInt(process.env.SMTP_PORT || "587", 10),
  secure: process.env.SMTP_PORT === "465",
  auth: {
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || ""
  }
});
app.post("/api/auth/send-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ error: "Valid email address is required" });
    }
    const cleanEmail = email.trim().toLowerCase();
    const otp = Math.floor(1e5 + Math.random() * 9e5).toString();
    const expires = Date.now() + 10 * 60 * 1e3;
    otpStore.set(cleanEmail, { otp, expires });
    const mailOptions = {
      from: process.env.SMTP_FROM || '"Daily NPM" <noreply@dailynpm.com>',
      to: cleanEmail,
      subject: "Daily NPM - Account Verification Code",
      text: `Your verification code is: ${otp}. It will expire in 10 minutes.`,
      html: `
        <div style="font-family: monospace, sans-serif; background-color: #F4F1EA; color: #1A1918; padding: 24px; border: 4px solid #1A1918; max-width: 480px; margin: 0 auto;">
          <h2 style="font-size: 24px; font-weight: bold; border-bottom: 2px dashed #1A1918; padding-bottom: 12px; margin-bottom: 20px; text-transform: uppercase;">DAILY NPM VERIFICATION</h2>
          <p style="font-size: 14px;">A request has been made to register a new reader portfolio access for this email address.</p>
          <p style="font-size: 14px; font-weight: bold; margin-top: 24px;">Your One-Time Passcode (OTP):</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 4px; background-color: #EAE6DF; border: 2px solid #1A1918; padding: 12px; text-align: center; margin: 16px 0;">
            ${otp}
          </div>
          <p style="font-size: 11px; color: #4A4744; font-style: italic; margin-top: 24px; border-top: 1px solid #1A1918; padding-top: 12px;">
            This security transmission is valid for 10 minutes. If you did not request this, please disregard this dispatch.
          </p>
        </div>
      `
    };
    let sent = false;
    const smtpConfigured = !!(process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_HOST);
    if (smtpConfigured) {
      try {
        await transporter.sendMail(mailOptions);
        sent = true;
      } catch (mailErr) {
        console.error("Failed to send verification email via SMTP:", mailErr);
      }
    }
    const banner = "=".repeat(60);
    console.log(`
${banner}
[SECURITY TRANSIT] Verification Code for ${cleanEmail}:

      >>>   ${otp}   <<<

Expires at: ${new Date(expires).toLocaleTimeString()}
SMTP Sent: ${sent ? "YES" : "NO (FALLBACK LOGGING ACTIVE)"}
${banner}
`);
    const isDev = process.env.NODE_ENV !== "production";
    return res.json({
      success: true,
      message: sent ? "Verification code sent to email." : "Verification code generated (check server console logs).",
      devOtp: isDev ? otp : void 0
    });
  } catch (err) {
    console.error("Error in send-otp API:", err);
    return res.status(500).json({ error: err.message || "Failed to process email verification code" });
  }
});
app.post("/api/auth/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: "Email and OTP verification code are required" });
    }
    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();
    const storedEntry = otpStore.get(cleanEmail);
    if (!storedEntry) {
      return res.status(400).json({ error: "No active verification request for this email." });
    }
    if (Date.now() > storedEntry.expires) {
      otpStore.delete(cleanEmail);
      return res.status(400).json({ error: "Verification code has expired. Please request a new one." });
    }
    if (storedEntry.otp !== cleanOtp) {
      return res.status(400).json({ error: "Incorrect verification code. Please try again." });
    }
    otpStore.delete(cleanEmail);
    return res.json({ success: true, message: "Email verification successful." });
  } catch (err) {
    console.error("Error in verify-otp API:", err);
    return res.status(500).json({ error: err.message || "Failed to verify OTP code" });
  }
});
async function buildDependencyTree(pkgName, maxDepth = 3, currentDepth = 0, resolved = /* @__PURE__ */ new Set()) {
  const cleanName = pkgName.trim();
  if (!cleanName || resolved.has(cleanName) || currentDepth >= maxDepth) {
    return { name: cleanName, dependencies: [] };
  }
  const nextResolved = new Set(resolved);
  nextResolved.add(cleanName);
  try {
    const info = await getPackageInfo(cleanName);
    const deps = info.dependencies || {};
    const depNames = Object.keys(deps);
    const children = [];
    if (currentDepth < maxDepth - 1) {
      const limitNames = depNames.slice(0, 15);
      const resolvedChildren = await Promise.all(
        limitNames.map(async (depName) => {
          const subtree = await buildDependencyTree(depName, maxDepth, currentDepth + 1, nextResolved);
          return {
            name: depName,
            version: deps[depName],
            dependencies: subtree.dependencies
          };
        })
      );
      children.push(...resolvedChildren);
      if (depNames.length > 15) {
        children.push({
          name: `... and ${depNames.length - 15} more dependencies`,
          version: "",
          dependencies: []
        });
      }
    } else {
      depNames.forEach((depName) => {
        children.push({
          name: depName,
          version: deps[depName],
          dependencies: []
        });
      });
    }
    return {
      name: cleanName,
      version: info.latestVersion,
      dependencies: children
    };
  } catch (err) {
    return {
      name: cleanName,
      version: "unknown",
      dependencies: [],
      error: true
    };
  }
}
app.get("/api/npm/package/*/dependency-tree", async (req, res) => {
  try {
    const rawPkg = req.params[0];
    if (!rawPkg) {
      return res.status(400).json({ error: "Package name is required" });
    }
    const pkgName = rawPkg.trim();
    const tree = await buildDependencyTree(pkgName);
    return res.json(tree);
  } catch (err) {
    console.error("Error building dependency tree:", err);
    return res.status(500).json({ error: err.message || "Server error resolving dependency tree" });
  }
});
var server_default = app;
if (typeof module !== "undefined" && module.exports) {
  module.exports = app;
}
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
