import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { getPackageInfo, getDownloadStats, comparePackages } from "./src/services/npm.js";
import { getAiInsights, requestTieredLlmServer } from "./src/services/ai.js";
import nodemailer from "nodemailer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// API Route: Secure multi-tiered AI chat & completions proxy
app.post("/api/npm/chat", async (req, res) => {
  try {
    const { systemPrompt, userPrompt, chatHistory, responseFormatJson } = req.body;
    const customGroqKey = req.headers["x-custom-groq-key"] as string | undefined;

    const response = await requestTieredLlmServer({
      systemPrompt,
      userPrompt,
      chatHistory,
      responseFormatJson,
      customGroqKey
    });

    return res.json({ text: response });
  } catch (err: any) {
    console.error("Secure AI completions proxy error:", err);
    return res.status(500).json({ error: err.message || "AI completions proxy error" });
  }
});

// --- OTP Verification Storage & Transporter ---
interface OtpEntry {
  otp: string;
  expires: number;
}
const otpStore = new Map<string, OtpEntry>();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "",
  port: parseInt(process.env.SMTP_PORT || "587", 10),
  secure: process.env.SMTP_PORT === "465",
  auth: {
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
  },
});

// API Route: Send OTP for Email Verification
app.post("/api/auth/send-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ error: "Valid email address is required" });
    }

    const cleanEmail = email.trim().toLowerCase();
    
    // Generate a 6-digit OTP code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 10 * 60 * 1000; // 10 minutes from now
    
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
      `,
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

    // Dev/Fallback mode: Always log OTP to console
    const banner = "=".repeat(60);
    console.log(`\n${banner}\n[SECURITY TRANSIT] Verification Code for ${cleanEmail}:\n\n      >>>   ${otp}   <<<\n\nExpires at: ${new Date(expires).toLocaleTimeString()}\nSMTP Sent: ${sent ? "YES" : "NO (FALLBACK LOGGING ACTIVE)"}\n${banner}\n`);

    // In development or simulation mode, return the OTP to allow automated testing / easy local manual validation without SMTP setup.
    const isDev = process.env.NODE_ENV !== "production";
    
    return res.json({ 
      success: true, 
      message: sent ? "Verification code sent to email." : "Verification code generated (check server console logs).",
      devOtp: isDev ? otp : undefined 
    });
  } catch (err: any) {
    console.error("Error in send-otp API:", err);
    return res.status(500).json({ error: err.message || "Failed to process email verification code" });
  }
});

// API Route: Verify OTP
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

    // Verification successful - consume the OTP
    otpStore.delete(cleanEmail);

    return res.json({ success: true, message: "Email verification successful." });
  } catch (err: any) {
    console.error("Error in verify-otp API:", err);
    return res.status(500).json({ error: err.message || "Failed to verify OTP code" });
  }
});

// Helper to recursively build dependency tree
async function buildDependencyTree(
  pkgName: string,
  maxDepth = 3,
  currentDepth = 0,
  resolved = new Set<string>()
): Promise<any> {
  const cleanName = pkgName.trim();
  if (!cleanName || resolved.has(cleanName) || currentDepth >= maxDepth) {
    return { name: cleanName, dependencies: [] };
  }

  // Add current package to prevent circular dependencies in this branch
  const nextResolved = new Set(resolved);
  nextResolved.add(cleanName);

  try {
    const info = await getPackageInfo(cleanName);
    const deps = info.dependencies || {};
    const depNames = Object.keys(deps);
    const children: any[] = [];

    // Only fetch grandchildren if we are not at the max depth
    if (currentDepth < maxDepth - 1) {
      // Resolve up to 15 dependencies to avoid hitting rate limits or slow responses
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
      // Depth limit reached, just map them as flat child nodes
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

// API Route: Get recursive dependency tree
app.get("/api/npm/package/*/dependency-tree", async (req, res) => {
  try {
    const rawPkg = req.params[0];
    if (!rawPkg) {
      return res.status(400).json({ error: "Package name is required" });
    }
    const pkgName = rawPkg.trim();
    const tree = await buildDependencyTree(pkgName);
    return res.json(tree);
  } catch (err: any) {
    console.error("Error building dependency tree:", err);
    return res.status(500).json({ error: err.message || "Server error resolving dependency tree" });
  }
});

export default app;

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

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();
