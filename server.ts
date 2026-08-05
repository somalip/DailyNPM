import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { getPackageInfo, getDownloadStats, comparePackages } from "./src/services/npm.js";
import { getAiInsights } from "./src/services/ai.js";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// API Route: Get package details from registry.npmjs.org
app.get("/api/npm/package/*", async (req, res) => {
  try {
    const rawPkg = req.params[0];
    if (!rawPkg) {
      return res.status(400).json({ error: "Package name is required" });
    }
    const pkgName = rawPkg.trim();
    const data = await getPackageInfo(pkgName);
    return res.json(data);
  } catch (err: any) {
    if (err.message.includes("not found")) {
      return res.status(404).json({ error: err.message });
    }
    console.error("Error fetching package info:", err);
    return res.status(500).json({ error: err.message || "Server error fetching package data" });
  }
});

// API Route: Get download range stats from api.npmjs.org
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
  } catch (err: any) {
    if (err.message.includes("not found")) {
      return res.status(404).json({ error: err.message });
    }
    console.error("Error fetching download stats:", err);
    return res.status(500).json({ error: err.message || "Server error fetching download stats" });
  }
});

// API Route: Batch comparison of multiple packages
app.post("/api/npm/compare", async (req, res) => {
  try {
    const { packages, period = "last-month" } = req.body;
    if (!Array.isArray(packages) || packages.length === 0) {
      return res.status(400).json({ error: "Packages array is required" });
    }

    const data = await comparePackages(packages, period);
    return res.json(data);
  } catch (err: any) {
    console.error("Error in compare API:", err);
    return res.status(500).json({ error: err.message || "Failed to compare packages" });
  }
});

// API Route: Optional Gemini AI summary & architecture rating
app.post("/api/npm/ai-insights", async (req, res) => {
  try {
    if (!req.body.packageName) {
      return res.status(400).json({ error: "Package name is required" });
    }
    const insights = await getAiInsights(req.body);
    return res.json(insights);
  } catch (err: any) {
    console.error("Gemini AI insights error:", err);
    return res.status(500).json({ error: err.message || "AI Insights error" });
  }
});

async function startServer() {
  const isProduction = process.env.NODE_ENV === "production" || 
                       __filename.endsWith("server.cjs") || 
                       __dirname.includes("/dist") || 
                       __dirname.includes("\\dist");

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = __dirname;
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
