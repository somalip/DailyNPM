// AI insights are calculated mathematically using local heuristics
import { checkSystemRequirements } from './systemCheck.js';

let currentModel = 'None (Local LLM disabled)';

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

export async function askAi(question: string, onProgress?: (status: string) => void) {
  return "Local AI chat is offline. LLM dependencies and transformers have been removed to optimize deployment size.";
}
