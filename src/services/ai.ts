import dotenv from "dotenv";
dotenv.config();

const API_KEY = process.env.GROQ_API_KEY || '';

let currentModel = 'None (Local LLM disabled)';

export async function requestTieredLlmServer(options: {
  systemPrompt?: string;
  userPrompt?: string;
  chatHistory?: { role: string; content: string }[];
  responseFormatJson?: boolean;
  customGroqKey?: string;
}): Promise<string> {
  const mistralKey = process.env.MISTRAL_API_KEY;
  const groqKey = options.customGroqKey || process.env.GROQ_API_KEY || API_KEY;
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  const messages = options.chatHistory 
    ? (options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }, ...options.chatHistory] : options.chatHistory)
    : [{ role: 'user', content: options.userPrompt || '' }];

  // 1. Try Mistral
  if (mistralKey) {
    try {
      console.warn("Attempting Mistral (Server Proxy)...");
      const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${mistralKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "ministral-3b-latest",
          messages,
          ...(options.responseFormatJson ? { response_format: { type: "json_object" } } : {})
        }),
        signal: AbortSignal.timeout(5000)
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

  // 2. Try Groq
  if (groqKey) {
    try {
      console.warn("Attempting Groq (Server Proxy)...");
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages,
          ...(options.responseFormatJson ? { response_format: { type: "json_object" } } : {})
        }),
        signal: AbortSignal.timeout(5000)
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

  // 3. Try OpenRouter (GPT-4o)
  if (openRouterKey) {
    try {
      console.warn("Falling back to OpenRouter (Server Proxy)...");
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openRouterKey}`,
          "HTTP-Referer": 'http://localhost:3000',
          "X-Title": 'DailyNPM',
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "openai/gpt-4o",
          messages,
          ...(options.responseFormatJson ? { response_format: { type: "json_object" } } : {})
        }),
        signal: AbortSignal.timeout(5000)
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

  // 4. Try Gemini (Gemini 2.0 Flash)
  if (geminiKey) {
    try {
      console.warn("Falling back to Gemini (Server Proxy)...");
      
      let contents: any[] = [];
      if (options.chatHistory) {
        contents = options.chatHistory.map(msg => ({
          role: msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        }));
      } else {
        contents = [{ role: 'user', parts: [{ text: options.userPrompt || '' }] }];
      }

      const geminiPayload: any = {
        contents,
        ...(options.responseFormatJson ? { generationConfig: { responseMimeType: "application/json" } } : {})
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
        signal: AbortSignal.timeout(5000)
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

export function setAiModel(model: string) {
  currentModel = model;
}

export function getCurrentModel() {
  return currentModel;
}

function getEditorialVerdict(healthScore: number, ageInDays: number, dependenciesCount: number): string {
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

export async function getAiInsights(options: {
  packageName: string;
  description: string;
  totalDownloads: number;
  version: string;
  ageInDays: number;
  dependenciesCount: number;
  readme?: string;
  onProgress?: (status: string) => void;
}) {
  const {
    packageName,
    description,
    totalDownloads,
    version,
    ageInDays,
    dependenciesCount,
    readme,
    onProgress,
  } = options;

  if (API_KEY) {
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
      console.error("AI API failed, falling back to heuristics:", err);
    }
  }

  if (onProgress) onProgress("Running Heuristic Analysis Bureau...");

  // Mathematically calculate healthScore: base score of 70, plus downloads factor, minus dependencies factor, plus age factor
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

  // Heuristic pros
  const pros = [
    totalDownloads > 1000000 ? "Highly established within the JS registry registry.npmjs.org." : "Focussed library catering to niche target setups.",
    dependenciesCount <= 5 ? "Minimal direct package dependencies, reducing dependency bloat." : "Feature-rich API offering comprehensive tooling in a single package.",
    ageInDays > 730 ? "Proven historical stability over years of ecosystem existence." : "Modern, fresh approach to solving developer pain points."
  ];

  // Heuristic cons
  const cons = [
    dependenciesCount > 15 ? "Heavy dependency graph requires meticulous security auditing." : "Requires careful major version tracking for API drift.",
    "Verify project compatibility and bundler configuration limits before production use."
  ];

  // Heuristic summary
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

let chatHistory: { role: string; content: string }[] = [];

export async function askAi(question: string, onProgress?: (status: string) => void) {
  if (!API_KEY) {
    return "Local AI chat is offline. Add a GROQ_API_KEY in your .env file to enable live Groq AI chat.";
  }

  if (onProgress) onProgress("AI is thinking...");

  try {
    chatHistory.push({
      role: "user",
      content: question
    });

    // Keep history bounded to avoid hitting token limits in quick chat
    if (chatHistory.length > 20) {
      chatHistory = chatHistory.slice(-20);
    }

    const text = await requestTieredLlmServer({
      chatHistory
    });

    chatHistory.push({
      role: "assistant",
      content: text
    });

    return text;
  } catch (err: any) {
    console.error("AI Chat failed:", err);
    return `Chat error: ${err.message || "Failed to contact AI API"}`;
  }
}
