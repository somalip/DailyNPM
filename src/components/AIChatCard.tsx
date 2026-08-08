import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, RefreshCw, MessageSquare, Trash2, ArrowUpRight } from 'lucide-react';
import { requestTieredLlmClient, isUsingCustomApiKey } from '../utils/npmApi';
import { PackageMetadata } from '../types';

interface AIChatCardProps {
  metadata: PackageMetadata;
  totalDownloads: number;
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

const PRESETS = [
  "How do I use this package? Show me a code example.",
  "What are the best alternatives or competitors to this package?",
  "Is this package actively maintained and production-ready?",
  "What are the pros and cons of using this package?",
  "How does this compare to similar packages in its ecosystem?",
];

// Simple inline parser for bold ** and inline code `
function parseInline(str: string): React.ReactNode[] {
  const parts = str.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-extrabold text-[#1A1918]">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="bg-[#EAE6DF] border border-[#1A1918]/20 px-1 py-0.5 font-mono text-[10px] rounded-xs text-[#A82424]">{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

const MarkdownText: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        if (trimmed.startsWith('###')) {
          return (
            <h4 key={idx} className="font-headline text-xs font-bold uppercase tracking-tight text-[#A82424] mt-2.5 pb-0.5 border-b border-[#1A1918]/10">
              {parseInline(trimmed.replace(/^###\s+/, ''))}
            </h4>
          );
        }

        if (trimmed.startsWith('>')) {
          return (
            <blockquote key={idx} className="border-l-2 border-[#A82424] pl-2.5 italic my-1.5 text-[#4A4744] bg-[#EAE6DF]/30 py-0.5 px-1.5 font-serif text-[11px] leading-relaxed">
              {parseInline(trimmed.replace(/^>\s*/, '').replace(/^"(.*)"$/, '$1'))}
            </blockquote>
          );
        }

        if (trimmed.startsWith('*')) {
          return (
            <div key={idx} className="flex gap-1 ml-1 items-start leading-relaxed text-[11px] my-0.5">
              <span className="text-[#A82424] font-bold">•</span>
              <span className="flex-1">{parseInline(trimmed.replace(/^\*\s*/, ''))}</span>
            </div>
          );
        }

        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          return (
            <div key={idx} className="flex gap-1 ml-1 items-start leading-relaxed text-[11px] my-0.5">
              <span className="font-bold text-[#A82424]">{numMatch[1]}.</span>
              <span className="flex-1">{parseInline(numMatch[2])}</span>
            </div>
          );
        }

        if (trimmed.startsWith('```')) {
          return null; 
        }

        const isCodeLine = line.startsWith('//') || line.includes('const ') || line.includes('import ') || line.includes('npm ') || line.includes('yarn ') || line.includes('pnpm ');
        if (isCodeLine && trimmed.length > 0) {
          return (
            <pre key={idx} className="bg-[#1A1918] text-amber-100 p-2 font-mono text-[9px] my-1 overflow-x-auto border-l-2 border-amber-500 shadow-inner">
              <code>{line}</code>
            </pre>
          );
        }

        if (trimmed.length === 0) {
          return <div key={idx} className="h-0.5" />;
        }

        return (
          <p key={idx} className="leading-relaxed text-[11px]">
            {parseInline(line)}
          </p>
        );
      })}
    </div>
  );
};

export const AIChatCard: React.FC<AIChatCardProps> = ({
  metadata,
  totalDownloads,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const {
    name: packageName,
    description,
    latestVersion: version,
    dependencies,
    devDependencies,
    peerDependencies,
    author,
    maintainers,
    license,
    time,
    github,
    keywords,
    totalVersionsCount,
    releaseVelocity,
    readme,
  } = metadata;

  const dependenciesCount = Object.keys(dependencies || {}).length;

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Reset chat if the package changes
  useEffect(() => {
    setMessages([]);
    setError(null);
    setInput('');
  }, [packageName]);

  const getLocalAnswer = (question: string): string => {
    // ── README INTELLIGENCE LAYER ─────────────────────────────────────────────
    const safeReadme = (readme || '') as string;
    
    // Parse install commands
    const installCmdRegex = /(?:npm install|yarn add|pnpm add|bun add|npx)\s+[a-zA-Z0-9@./_-]+/g;
    const readmeInstallCmds = Array.from(new Set(safeReadme.match(installCmdRegex) || []));

    // Parse code blocks
    const codeBlockRegex = /```([\w-]*)\n([\s\S]*?)```/g;
    const readmeCodeBlocks: { lang: string, code: string }[] = [];
    let match;
    while ((match = codeBlockRegex.exec(safeReadme)) !== null) {
      readmeCodeBlocks.push({ lang: match[1], code: match[2] });
    }

    // Parse sections
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const readmeSections = new Map<string, string>();
    const headings: {level: number, title: string, index: number}[] = [];
    while ((match = headingRegex.exec(safeReadme)) !== null) {
      headings.push({ level: match[1].length, title: match[2], index: match.index });
    }
    
    for (let i = 0; i < headings.length; i++) {
      const h = headings[i];
      const nextH = headings[i + 1];
      const sectionContent = safeReadme.substring(
        h.index + h.title.length + h.level + 1, 
        nextH ? nextH.index : safeReadme.length
      ).trim();
      readmeSections.set(h.title.toLowerCase().trim(), sectionContent);
    }

    // Helpers to extract section text by heading keywords
    const getSectionText = (keywords: string[]): string => {
      let result = '';
      for (const [title, sectionContent] of readmeSections.entries()) {
        if (keywords.some(k => title.includes(k))) {
          result += `\n\n${sectionContent}`;
        }
      }
      return result.trim();
    };

    const readmeApiSections = getSectionText(['api', 'options', 'config', 'props', 'parameters', 'methods', 'usage']);
    const readmeCliSection = getSectionText(['cli', 'command', 'terminal', 'shell']);
    
    // Parse features (bullet points under specific headings)
    const featureSections = getSectionText(['features', 'highlights', 'what', 'why']);
    const featureRegex = /^\s*[-*+]\s+(.+)$/gm;
    const readmeFeatures: string[] = [];
    while ((match = featureRegex.exec(featureSections)) !== null) {
      readmeFeatures.push(match[1].trim());
    }

    // TypeScript detection
    const pkgDeps = Object.keys(dependencies || {});
    const pkgDevDeps = Object.keys(devDependencies || {});
    const hasTsDep = [...pkgDeps, ...pkgDevDeps].some(d => d === 'typescript' || d.startsWith('@types/'));
    const tsRegex = /\b(typescript|\.d\.ts|@types|ts)\b/i;
    const readmeHasTypeScript = tsRegex.test(safeReadme) || hasTsDep;


    // ── GENERAL TOPIC INTERCEPTION (Not scored) ───────────────────────────────
    const cleanQ = question.toLowerCase().replace(/[.,/#!$%^&*;:{}=_`~()]/g, '').trim();
    const tokens = cleanQ.split(/\s+/);
    
    if (/^(hi|hello|hey|greetings|howdy|sup|yo|hola|what'?s up)[!?.\s]*$/i.test(question)) {
      return `### 👋 Hello! I'm ready to help with **${packageName}**.\n\n` +
             `It is ${description ? `a package that ${description.toLowerCase()}` : 'a package on NPM'}. ` +
             `Feel free to ask me for a code example, pros and cons, or alternatives!`;
    }
    if (/^(thanks?|thank you|thx|ty|cheers|appreciated|cool|great|nice|awesome|perfect|got it|ok|okay)[!?.\s]*$/i.test(question)) {
      return `### You're welcome! 😊\n\n` +
             `If you need anything else about **${packageName}**, just ask. You could try:\n` +
             `* *"How do I install it?"*\n` +
             `* *"What are its dependencies?"*\n` +
             `* *"Show me the pros and cons."*`;
    }
    if (/\b(help|what can you|what do you|capabilities|commands|menu)\b/i.test(question)) {
      return `### 🤖 What I can answer about **${packageName}**:\n\n` +
             `- **Code & Usage:** *"Show me an example"*, *"How do I get started?"*\n` +
             `- **Comparisons:** *"What are the alternatives?"*, *"Pros and cons?"*, *"Compare with..."*\n` +
             `- **Metrics:** *"How popular is it?"*, *"Is it actively maintained?"*, *"Package size?"*\n` +
             `- **Details:** *"What are the dependencies?"*, *"TypeScript support?"*, *"License info?"*\n` +
             `- **Troubleshooting:** *"How do I fix errors?"*, *"Migration guide?"*\n\n` +
             `Just ask naturally!`;
    }
    if (/^(bye|goodbye|see ya|later|cya|farewell)[!?.\s]*$/i.test(question)) {
      return `### 👋 Goodbye!\n\nHappy coding with **${packageName}**! Come back if you need more help.`;
    }

    // ── ECOSYSTEM KNOWLEDGE BASE ─────────────────────────────────────────────
    // Maps categories to: { members, keywords }
    // Used to infer the package's category and suggest alternatives.
    const ECOSYSTEM: Record<string, { members: string[]; tags: string[] }> = {
      UI_FRAMEWORK:    { members: ['react', 'vue', 'svelte', 'solid-js', 'preact', 'alpine.js', 'lit', '@angular/core', 'qwik'], tags: ['ui', 'framework', 'component', 'frontend', 'dom', 'jsx', 'template', 'reactive', 'view'] },
      HTTP_SERVER:     { members: ['express', 'fastify', 'hono', 'koa', 'nestjs', 'restify', 'polka', 'micro', 'h3', '@hapi/hapi'], tags: ['server', 'http', 'api', 'rest', 'route', 'middleware', 'web', 'backend'] },
      HTTP_CLIENT:     { members: ['axios', 'node-fetch', 'got', 'ky', 'superagent', 'cross-fetch', 'undici', 'ofetch'], tags: ['http', 'fetch', 'request', 'ajax', 'client', 'api'] },
      STATE_MGMT:      { members: ['zustand', 'react-redux', 'mobx', 'jotai', 'recoil', 'valtio', 'nanostores', 'pinia', '@ngrx/store'], tags: ['state', 'store', 'redux', 'reactive', 'global'] },
      BUILD_TOOL:      { members: ['vite', 'webpack', 'esbuild', 'rollup', 'parcel', 'turbopack', 'rspack', 'tsup', 'bun'], tags: ['build', 'bundle', 'compile', 'transpile', 'minify', 'dev', 'hot'] },
      DATE_UTIL:       { members: ['dayjs', 'date-fns', 'moment', 'luxon', 'chrono-node', 'tempo'], tags: ['date', 'time', 'moment', 'timezone', 'calendar', 'format', 'parse'] },
      CSS_STYLING:     { members: ['tailwindcss', 'styled-components', 'emotion', 'stitches', 'vanilla-extract', 'unocss', 'panda-css', 'linaria'], tags: ['css', 'style', 'theme', 'design', 'class', 'color'] },
      TESTING:         { members: ['jest', 'vitest', 'mocha', 'jasmine', 'ava', 'tap', 'playwright', 'cypress', '@testing-library/react'], tags: ['test', 'spec', 'mock', 'assert', 'expect', 'coverage', 'e2e'] },
      VALIDATION:      { members: ['zod', 'joi', 'yup', 'valibot', 'ajv', 'superstruct', 'class-validator'], tags: ['validate', 'schema', 'parse', 'type', 'sanitize', 'constraint'] },
      ORM_DATABASE:    { members: ['prisma', 'drizzle-orm', 'sequelize', 'typeorm', 'knex', 'mongoose', 'mikro-orm'], tags: ['database', 'orm', 'sql', 'query', 'model', 'migration', 'db', 'mongo'] },
      LOGGING:         { members: ['winston', 'pino', 'bunyan', 'morgan', 'loglevel', 'consola', 'debug'], tags: ['log', 'logger', 'debug', 'trace', 'error', 'info', 'audit'] },
      ROUTER:          { members: ['react-router', 'react-router-dom', 'vue-router', 'wouter', 'tanstack-router', 'next/router'], tags: ['route', 'router', 'navigation', 'history', 'url', 'path', 'link'] },
      QUERY_DATA:      { members: ['@tanstack/react-query', 'swr', 'apollo-client', 'relay', 'urql'], tags: ['query', 'fetch', 'cache', 'data', 'async', 'mutation'] },
      ANIMATION:       { members: ['framer-motion', 'gsap', 'motion', 'animejs', 'react-spring', 'auto-animate', '@vueuse/motion'], tags: ['animation', 'motion', 'transition', 'tween', 'spring', 'animate'] },
      FORM:            { members: ['react-hook-form', 'formik', 'vee-validate', 'final-form', '@tanstack/react-form'], tags: ['form', 'input', 'field', 'submit', 'control', 'register', 'watch'] },
      AUTH:            { members: ['passport', 'next-auth', 'lucia', 'jose', 'jsonwebtoken', 'bcrypt', 'auth.js'], tags: ['auth', 'login', 'session', 'jwt', 'token', 'oauth', 'password', 'user'] },
      CHARTING:        { members: ['recharts', 'd3', 'chart.js', 'echarts', 'apexcharts', 'highcharts', 'victory', 'nivo'], tags: ['chart', 'graph', 'plot', 'visualization', 'data', 'bar', 'line', 'pie'] },
      MARKDOWN:        { members: ['marked', 'remark', 'unified', 'showdown', 'commonmark', 'micromark', 'mdx'], tags: ['markdown', 'html', 'parse', 'render', 'text', 'mdx', 'remark'] },
      UTILITY:         { members: ['lodash', 'ramda', 'underscore', 'radash', 'ts-belt', 'remeda'], tags: ['utility', 'helper', 'function', 'collection', 'array', 'object', 'string'] },
      I18N:            { members: ['i18next', 'react-i18next', 'vue-i18n', 'next-intl', 'format.js', 'intl-messageformat'], tags: ['i18n', 'locale', 'translation', 'language', 'format', 'plural'] },
      ENV_CONFIG:      { members: ['dotenv', 'env-cmd', 'cross-env', 'dotenv-expand', 't3-env'], tags: ['env', 'config', 'environment', 'dotenv', 'variable', 'settings'] },
    };

    // ── INFER PACKAGE CATEGORY FROM KEYWORDS + DESCRIPTION + DEPENDENCIES ───
    const pkgKeywords = (keywords || []).map((k: string) => k.toLowerCase());
    const pkgDesc = (description || '').toLowerCase();

    let inferredCategory: string | null = null;
    let inferredAlternatives: string[] = [];
    let maxCategoryScore = 0;

    for (const [cat, { members, tags }] of Object.entries(ECOSYSTEM)) {
      let score = 0;
      // Direct member check (the package IS one of these)
      const isMember = members.includes(packageName);
      // Tag matching against keywords & description
      for (const tag of tags) {
        if (pkgKeywords.some(k => k.includes(tag) || tag.includes(k))) score += 2;
        if (pkgDesc.includes(tag)) score += 1;
      }
      // Dependency overlap
      for (const dep of pkgDeps) {
        if (members.includes(dep)) score += 1.5;
      }
      if (score > maxCategoryScore) {
        maxCategoryScore = score;
        inferredCategory = cat;
        inferredAlternatives = isMember
          ? members.filter(m => m !== packageName)
          : members;
      }
    }

    // ── TOPIC SCORING ENGINE ──────────────────────────────────────────────────
    const topicScores: Record<string, number> = {
      CREATOR: 0, SIZE: 0, LICENSE: 0, DATES: 0, SOCIAL: 0,
      USE_CASE: 0, SECURITY: 0, CODE_EXAMPLE: 0,
      ALTERNATIVES: 0, HEALTH: 0, VERSIONS: 0, PEERS: 0,
      KEYWORDS: 0, DOWNLOADS: 0, PROS_CONS: 0, COMPARE: 0,
      TYPESCRIPT: 0, DEPENDENCIES_DETAIL: 0, CONFIGURATION: 0,
      COMPATIBILITY: 0, MIGRATION: 0, PERFORMANCE: 0,
      TROUBLESHOOTING: 0, GETTING_STARTED: 0, FEATURES: 0, CLI_USAGE: 0
    };

    const keywordMap: Record<string, string[]> = {
      CREATOR:      ['author', 'creator', 'who', 'wrote', 'developer', 'developers', 'owner', 'owners', 'maintain', 'maintainer', 'maintainers', 'team', 'built', 'maker', 'person', 'company', 'org', 'organization'],
      SIZE:         ['size', 'weight', 'big', 'heavy', 'large', 'mb', 'kb', 'kilobytes', 'megabytes', 'bytes', 'unpackedsize', 'footprint', 'lightweight', 'slim', 'bloat'],
      LICENSE:      ['license', 'licence', 'legal', 'commercial', 'copyright', 'mit', 'apache', 'gpl', 'isc', 'permission', 'restrict', 'closed', 'open'],
      DATES:        ['created', 'date', 'when', 'age', 'old', 'first', 'published', 'year', 'modified', 'history', 'initial', 'released', 'launch', 'started'],
      SOCIAL:       ['stars', 'forks', 'issues', 'github', 'repo', 'repository', 'watchers', 'popular', 'popularity', 'trending', 'community'],
      USE_CASE:     ['use', 'case', 'why', 'what', 'purpose', 'benefit', 'help', 'solve', 'function', 'description', 'about', 'summary', 'details', 'info', 'need', 'tell', 'explain', 'overview', 'does', 'good', 'for'],
      SECURITY:     ['security', 'safe', 'audit', 'vulnerability', 'exploit', 'malware', 'hack', 'risk', 'danger', 'trust', 'reliable', 'stability', 'stable', 'production', 'cve', 'supply', 'chain'],
      CODE_EXAMPLE: ['example', 'code', 'snippet', 'demo', 'coding', 'sample', 'api', 'how', 'implement', 'integrate', 'install', 'setup', 'import', 'require', 'run', 'usage', 'start', 'begin', 'initialize', 'init', 'configure', 'tutorial', 'guide', 'show', 'write', 'basic', 'simple', 'try', 'quickstart'],
      ALTERNATIVES: ['alternative', 'alternatives', 'competitor', 'competitors', 'similar', 'compared', 'instead', 'replacement', 'replace', 'switch', 'migrate', 'migration', 'other', 'options', 'choices', 'vs', 'versus', 'better', 'best', 'like'],
      HEALTH:       ['health', 'maintenance', 'maintained', 'active', 'inactive', 'dead', 'abandoned', 'support', 'activity', 'velocity', 'release', 'update', 'updates', 'fresh', 'stale', 'cadence', 'commit', 'commits'],
      VERSIONS:     ['version', 'versions', 'releases', 'total', 'how', 'many', 'changelog', 'latest', 'update', 'upgrade', 'history', 'semver', 'major', 'minor'],
      PEERS:        ['peer', 'peers', 'peerdependency', 'peerdependencies', 'requires', 'compatible', 'compatibility', 'works', 'with'],
      KEYWORDS:     ['keywords', 'tags', 'categories', 'category', 'labeled', 'classified', 'topic', 'topics', 'domain', 'tagged'],
      DOWNLOADS:    ['downloads', 'download', 'popularity', 'usage', 'weekly', 'monthly', 'installs', 'installed', 'trending', 'adoption', 'growth', 'metrics'],
      PROS_CONS:    ['pros', 'cons', 'advantages', 'disadvantages', 'benefits', 'drawbacks', 'upsides', 'downsides', 'tradeoffs', 'trade-offs', 'worth', 'recommend', 'recommended', 'should', 'strengths', 'weaknesses'],
      COMPARE:      ['compare', 'comparison', 'vs', 'versus', 'difference', 'differences', 'better', 'worse', 'faster', 'lighter', 'heavier', 'against', 'benchmark'],
      TYPESCRIPT:   ['typescript', 'types', 'typed', 'typings', 'generics', 'interface', 'd.ts', '@types', 'type-safe', 'typesafe'],
      DEPENDENCIES_DETAIL: ['dependency', 'dependencies', 'depends', 'requires', 'needs', 'imports', 'modules', 'packages', 'libraries', 'node_modules', 'tree', 'transitive'],
      CONFIGURATION: ['configure', 'configuration', 'config', 'options', 'settings', 'preferences', 'parameters', 'flags', 'arguments', 'props', 'customize', 'customization'],
      COMPATIBILITY: ['compatible', 'compatibility', 'browser', 'node', 'version', 'support', 'supports', 'engine', 'engines', 'runtime', 'environment', 'platform', 'works'],
      MIGRATION:    ['migrate', 'migration', 'upgrade', 'upgrading', 'breaking', 'changes', 'changelog', 'update', 'updating', 'v2', 'v3', 'v4', 'v5', 'deprecat'],
      PERFORMANCE:  ['performance', 'speed', 'fast', 'slow', 'benchmark', 'latency', 'throughput', 'bundle', 'tree-shake', 'treeshake', 'minif', 'gzip', 'overhead'],
      TROUBLESHOOTING: ['error', 'bug', 'issue', 'problem', 'broken', 'fix', 'debug', 'crash', 'fail', 'failing', 'wrong', 'stuck', 'help', 'doesnt', 'wont', 'cant', 'cannot', 'unable'],
      GETTING_STARTED: ['getting', 'started', 'start', 'beginning', 'beginner', 'newbie', 'tutorial', 'walkthrough', 'step-by-step', 'stepbystep', 'learn', 'learning'],
      FEATURES:     ['features', 'capabilities', 'functionality', 'abilities', 'what', 'can', 'does', 'offers', 'provides', 'includes', 'supports', 'power', 'powers'],
      CLI_USAGE:    ['cli', 'command', 'terminal', 'shell', 'binary', 'bin', 'npx', 'executable', 'script', 'flag', 'flags']
    };

    tokens.forEach(token => {
      for (const [topic, words] of Object.entries(keywordMap)) {
        if (words.includes(token)) {
          topicScores[topic] += 1.8;
        } else {
          const match = words.find(w => token.length > 3 && (token.includes(w) || w.includes(token)));
          if (match && match.length > 3) topicScores[topic] += 0.8;
        }
      }
    });

    // ── PHRASE PATTERNS (high-confidence, each adds a large boost) ───────────
    type TopicKey = keyof typeof topicScores;
    const phrasePatterns: { pattern: RegExp; topic: TopicKey; boost: number }[] = [
      // Code / Usage
      { pattern: /\bhow\b.{0,20}\b(use|using|utilize|work|works?|run|apply|call|invoke)\b/i, topic: 'CODE_EXAMPLE', boost: 12 },
      { pattern: /\bhow\b.{0,20}\b(install|add|get|set\s*up|setup|configure|init|start)\b/i, topic: 'CODE_EXAMPLE', boost: 12 },
      { pattern: /\bhow\b.{0,20}\b(import|require|include|load)\b/i, topic: 'CODE_EXAMPLE', boost: 12 },
      { pattern: /\b(show|give|write|provide|need|want)\b.{0,25}\b(example|code|snippet|demo|sample|tutorial|usage|guide)\b/i, topic: 'CODE_EXAMPLE', boost: 12 },
      { pattern: /\b(usage|example|demo|sample|snippet|quickstart|quick start)\b/i, topic: 'CODE_EXAMPLE', boost: 6 },
      { pattern: /\b(npm install|yarn add|pnpm add)\b/i, topic: 'CODE_EXAMPLE', boost: 10 },
      // Use case / description
      { pattern: /\bwhat\b.{0,15}\b(is|does|are)\b.{0,30}\b(package|it|this|library|module|do|used|for)\b/i, topic: 'USE_CASE', boost: 12 },
      { pattern: /\b(tell me about|explain|describe|summarize|overview|what is)\b/i, topic: 'USE_CASE', boost: 10 },
      { pattern: /\b(use cases?|primary use|main use|what.*for|what.*purpose|reason to use)\b/i, topic: 'USE_CASE', boost: 8 },
      // Alternatives / Competitors
      { pattern: /\b(alternative|alternatives|competitor|competitors|similar)\b/i, topic: 'ALTERNATIVES', boost: 14 },
      { pattern: /\b(instead of|replace|replacement|switch from|migrate from)\b/i, topic: 'ALTERNATIVES', boost: 14 },
      { pattern: /\b(best (alternative|option|choice|replacement|substitute))\b/i, topic: 'ALTERNATIVES', boost: 16 },
      { pattern: /\bwhat (else|other|packages?|libraries?) (can|could|should|do|does|is|are|would)\b/i, topic: 'ALTERNATIVES', boost: 12 },
      { pattern: /\b(options?|choices?)\b.{0,20}\b(this|it|that|package|library)\b/i, topic: 'ALTERNATIVES', boost: 10 },
      // Compare
      { pattern: /\b(compare|comparison|vs\.?|versus)\b/i, topic: 'COMPARE', boost: 14 },
      { pattern: /\b(better|worse|faster|lighter|heavier|more popular|less popular)\b.{0,20}\b(than|vs|versus|compared)\b/i, topic: 'COMPARE', boost: 12 },
      { pattern: /\bhow does.{0,20}(compare|stack up|differ)\b/i, topic: 'COMPARE', boost: 14 },
      // Pros/Cons
      { pattern: /\b(pros and cons|advantages and disadvantages|strengths and weaknesses)\b/i, topic: 'PROS_CONS', boost: 16 },
      { pattern: /\b(pros|cons|advantages|disadvantages|benefits|drawbacks|upsides|downsides|tradeoffs)\b/i, topic: 'PROS_CONS', boost: 12 },
      { pattern: /\b(should i use|worth using|worth it|is it good|is it worth)\b/i, topic: 'PROS_CONS', boost: 14 },
      { pattern: /\b(recommend|recommended|suggest|suggestion)\b/i, topic: 'PROS_CONS', boost: 8 },
      // Health / Maintenance
      { pattern: /\b(is it (actively |still |being |well )?(maintained|supported|active|updated|alive|dead|abandoned))\b/i, topic: 'HEALTH', boost: 16 },
      { pattern: /\b(maintenance|activity|release cadence|commit|commits|last (release|update|commit))\b/i, topic: 'HEALTH', boost: 12 },
      { pattern: /\b(production.?ready|safe for production|stable|stability)\b/i, topic: 'HEALTH', boost: 10 },
      { pattern: /\bhow (active|often|frequently|regularly|fast)\b/i, topic: 'HEALTH', boost: 10 },
      // Versions
      { pattern: /\b(how many (versions?|releases?)|total (versions?|releases?)|version history|changelog)\b/i, topic: 'VERSIONS', boost: 14 },
      { pattern: /\b(what version|latest version|current version|semver|upgrade|downgrade)\b/i, topic: 'VERSIONS', boost: 12 },
      // Downloads
      { pattern: /\b(how (many |popular |much ).*(downloads?|installs?|usage|used))\b/i, topic: 'DOWNLOADS', boost: 14 },
      { pattern: /\b(download (count|stats?|number|metrics?|volume))\b/i, topic: 'DOWNLOADS', boost: 12 },
      { pattern: /\b(monthly|weekly) (downloads?|installs?)\b/i, topic: 'DOWNLOADS', boost: 12 },
      { pattern: /\bhow popular\b/i, topic: 'DOWNLOADS', boost: 10 },
      // Security
      { pattern: /\b(is it safe|is it secure|is it trusted|can i trust|safe to use)\b/i, topic: 'SECURITY', boost: 14 },
      { pattern: /\b(vulnerability|vulnerabilities|cve|exploit|supply chain|audit)\b/i, topic: 'SECURITY', boost: 14 },
      // Creator
      { pattern: /\bwho\b.{0,20}\b(made|created|built|wrote|developed|maintains|owns)\b/i, topic: 'CREATOR', boost: 12 },
      // Dates
      { pattern: /\b(how old|when was|when did|when is|how long ago|first released)\b/i, topic: 'DATES', boost: 12 },
      // License
      { pattern: /\b(what license|what licence|is it open source|open source|licensing|copyright)\b/i, topic: 'LICENSE', boost: 12 },
      // Social
      { pattern: /\b(github (stats?|metrics?)|how many stars|how popular|stars|forks|open issues)\b/i, topic: 'SOCIAL', boost: 12 },
      // Size
      { pattern: /\b(how big|bundle size|package size|file size|how heavy|footprint|weight|kilobyte|megabyte)\b/i, topic: 'SIZE', boost: 12 },
      // Peers
      { pattern: /\b(peer.?dep|peerdependencies|what (else |packages? |libraries? )?does it (require|need|use)|works? with)\b/i, topic: 'PEERS', boost: 14 },
      // Keywords
      { pattern: /\b(keywords?|tags?|categories?|labeled|classified|what domain|what category)\b/i, topic: 'KEYWORDS', boost: 12 },
      
      // New Topic Patterns
      { pattern: /does it (support|have|include|ship|provide).*type(s|script)?/i, topic: 'TYPESCRIPT', boost: 14 },
      { pattern: /type(s|script)? support/i, topic: 'TYPESCRIPT', boost: 12 },
      { pattern: /is it typed/i, topic: 'TYPESCRIPT', boost: 12 },
      { pattern: /type definitions/i, topic: 'TYPESCRIPT', boost: 12 },
      
      { pattern: /what (does it|dependencies|packages|modules).*depend/i, topic: 'DEPENDENCIES_DETAIL', boost: 14 },
      { pattern: /list.*depend/i, topic: 'DEPENDENCIES_DETAIL', boost: 12 },
      { pattern: /dependency (tree|graph|list|detail)/i, topic: 'DEPENDENCIES_DETAIL', boost: 14 },
      
      { pattern: /how.*config/i, topic: 'CONFIGURATION', boost: 12 },
      { pattern: /what options/i, topic: 'CONFIGURATION', boost: 12 },
      { pattern: /configuration (guide|options|file)/i, topic: 'CONFIGURATION', boost: 12 },
      { pattern: /how.*customize/i, topic: 'CONFIGURATION', boost: 12 },
      
      { pattern: /what (node|browser|version).*support/i, topic: 'COMPATIBILITY', boost: 12 },
      { pattern: /does it (work|run) (on|with|in)/i, topic: 'COMPATIBILITY', boost: 12 },
      { pattern: /compatible with/i, topic: 'COMPATIBILITY', boost: 10 },
      { pattern: /browser support/i, topic: 'COMPATIBILITY', boost: 10 },
      { pattern: /node version/i, topic: 'COMPATIBILITY', boost: 10 },
      { pattern: /engine requirement/i, topic: 'COMPATIBILITY', boost: 10 },
      
      { pattern: /how.*upgrade/i, topic: 'MIGRATION', boost: 14 },
      { pattern: /migration guide/i, topic: 'MIGRATION', boost: 14 },
      { pattern: /breaking changes/i, topic: 'MIGRATION', boost: 14 },
      { pattern: /upgrade from/i, topic: 'MIGRATION', boost: 12 },
      { pattern: /migrate from/i, topic: 'MIGRATION', boost: 12 },
      { pattern: /what changed/i, topic: 'MIGRATION', boost: 12 },
      
      { pattern: /is it fast/i, topic: 'PERFORMANCE', boost: 12 },
      { pattern: /performance (benchmark|comparison|profile)/i, topic: 'PERFORMANCE', boost: 14 },
      { pattern: /bundle size/i, topic: 'PERFORMANCE', boost: 12 },
      { pattern: /tree.?shak/i, topic: 'PERFORMANCE', boost: 12 },
      { pattern: /how fast/i, topic: 'PERFORMANCE', boost: 12 },
      { pattern: /overhead/i, topic: 'PERFORMANCE', boost: 10 },
      
      { pattern: /not working/i, topic: 'TROUBLESHOOTING', boost: 14 },
      { pattern: /doesn'?t work/i, topic: 'TROUBLESHOOTING', boost: 14 },
      { pattern: /won'?t (work|install|run|build|compile)/i, topic: 'TROUBLESHOOTING', boost: 14 },
      { pattern: /how.*fix/i, topic: 'TROUBLESHOOTING', boost: 12 },
      { pattern: /how.*debug/i, topic: 'TROUBLESHOOTING', boost: 12 },
      { pattern: /getting.*error/i, topic: 'TROUBLESHOOTING', boost: 12 },
      { pattern: /having.*problem/i, topic: 'TROUBLESHOOTING', boost: 12 },
      { pattern: /issue with/i, topic: 'TROUBLESHOOTING', boost: 12 },
      
      { pattern: /getting started/i, topic: 'GETTING_STARTED', boost: 16 },
      { pattern: /step.?by.?step/i, topic: 'GETTING_STARTED', boost: 14 },
      { pattern: /beginner.?guide/i, topic: 'GETTING_STARTED', boost: 14 },
      { pattern: /how.*get started/i, topic: 'GETTING_STARTED', boost: 14 },
      { pattern: /where.*start/i, topic: 'GETTING_STARTED', boost: 12 },
      { pattern: /from scratch/i, topic: 'GETTING_STARTED', boost: 12 },
      
      { pattern: /what (features|can it do|does it offer|does it provide|does it include|capabilities)/i, topic: 'FEATURES', boost: 14 },
      { pattern: /list.*features/i, topic: 'FEATURES', boost: 12 },
      { pattern: /key features/i, topic: 'FEATURES', boost: 12 },
      { pattern: /feature list/i, topic: 'FEATURES', boost: 12 },
      
      { pattern: /cli (usage|commands?|options?|flags?)/i, topic: 'CLI_USAGE', boost: 14 },
      { pattern: /command.?line/i, topic: 'CLI_USAGE', boost: 12 },
      { pattern: /terminal (usage|commands?)/i, topic: 'CLI_USAGE', boost: 12 },
      { pattern: /how.*run.*cli/i, topic: 'CLI_USAGE', boost: 12 },
      { pattern: /npx.*command/i, topic: 'CLI_USAGE', boost: 12 },
    ];

    for (const { pattern, topic, boost } of phrasePatterns) {
      if (pattern.test(question)) topicScores[topic] += boost;
    }

    // ── MODIFIER FLAGS ────────────────────────────────────────────────────────
    const isConcernedAboutSize = tokens.some(t => ['bloat', 'heavy', 'size', 'weight', 'bytes', 'large', 'slow'].includes(t));
    const isRequestingSetup = tokens.some(t => ['install', 'setup', 'npm', 'yarn', 'pnpm', 'add', 'init', 'configure'].includes(t))
      || /\b(how to install|npm install|yarn add|pnpm add|get started|setup guide)\b/i.test(question);
    const isRequestingUsageGuide = /\bhow\b.{0,20}\b(use|using|works?|utilize|call|invoke)\b/i.test(question);

    // ── DETERMINE PRIMARY & SECONDARY TOPIC ──────────────────────────────────
    const sortedTopics = (Object.entries(topicScores) as [TopicKey, number][]).sort((a, b) => b[1] - a[1]);
    const primaryTopic = sortedTopics[0][1] > 0 ? sortedTopics[0][0] : 'USE_CASE';
    const primaryScore = sortedTopics[0][1];
    
    let secondaryTopic: TopicKey | null = null;
    if (sortedTopics.length > 1) {
      const secondaryScore = sortedTopics[1][1];
      if (secondaryScore >= 0.6 * primaryScore && secondaryScore >= 8) {
        secondaryTopic = sortedTopics[1][0];
      }
    }

    // ── DERIVED METADATA ─────────────────────────────────────────────────────
    const downloadsStr = totalDownloads.toLocaleString();
    const camelName = packageName
      .replace(/^@[^/]+\//, '')
      .replace(/-([a-z])/g, (_: string, g: string) => g.toUpperCase())
      .replace(/[^a-zA-Z0-9]/g, '');
    const peerDepsCount = Object.keys(peerDependencies || {}).length;
    const peerDepsList = Object.keys(peerDependencies || {}).slice(0, 5).join(', ') || 'None';
    const dependenciesCount = Object.keys(dependencies || {}).length;
    const devDepsCount = Object.keys(devDependencies || {}).length;
    const totalVersions = totalVersionsCount || 0;
    const rvLastYear = releaseVelocity?.releasesLastYear ?? 0;
    const rvAvgDays = releaseVelocity?.avgDaysBetweenReleases ?? 0;
    const rvDaysSince = releaseVelocity?.daysSinceLastRelease ?? 0;
    const lastCommit = github?.lastCommit;
    const pkgKeywordStr = (keywords || []).slice(0, 8).join(', ') || 'None declared';

    // ── HEALTH SCORE SYNTHESIS ────────────────────────────────────────────────
    const computeHealthScore = (): { score: number; label: string; color: string } => {
      let h = 60;
      if (totalDownloads > 10_000_000) h += 15;
      else if (totalDownloads > 1_000_000) h += 10;
      else if (totalDownloads > 100_000) h += 5;
      if (rvLastYear >= 12) h += 10;
      else if (rvLastYear >= 4) h += 5;
      else if (rvLastYear === 0) h -= 10;
      if (rvDaysSince < 30) h += 5;
      else if (rvDaysSince > 365) h -= 10;
      else if (rvDaysSince > 180) h -= 5;
      if (totalVersions > 50) h += 5;
      if ((maintainers || []).length > 3) h += 5;
      if (dependenciesCount > 20) h -= 8;
      const score = Math.min(100, Math.max(0, h));
      const label = score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Moderate' : 'Poor';
      const color = score >= 85 ? '🟢' : score >= 70 ? '🟡' : score >= 50 ? '🟠' : '🔴';
      return { score, label, color };
    };

    const health = computeHealthScore();

    // ── RESPONSE GENERATION ENGINE ────────────────────────────────────────────
    
    const generateResponseForTopic = (topic: TopicKey): string | null => {
      if (topic === 'TYPESCRIPT') {
        const dts = pkgDeps.some(d => d.startsWith('@types/')) || pkgDevDeps.some(d => d.startsWith('@types/'));
        const bundled = pkgDeps.includes('typescript') || pkgDevDeps.includes('typescript') || tsRegex.test(safeReadme);
        
        let status = 'Unknown';
        if (readmeHasTypeScript) {
          if (bundled) status = '✅ Types are likely bundled or supported natively.';
          else if (dts) status = '📦 Types are provided via DefinitelyTyped (\`@types/\`).';
          else status = '📝 TypeScript is mentioned in the README, suggesting support.';
        } else {
          status = '❌ No clear TypeScript support detected in metadata or README.';
        }
        
        return `### 📘 TypeScript Support: **${packageName}**\n\n* **Status:** ${status}\n* **Indicators:** ${readmeHasTypeScript ? 'TypeScript signals detected' : 'No strong signals found'}. Check if there's an \`@types/${packageName.replace('@', '').replace('/', '__')}\` package if types are missing.`;
      }
      
      if (topic === 'DEPENDENCIES_DETAIL') {
        const depNames = Object.keys(dependencies || {});
        return `### 🌳 Dependency Tree: **${packageName}**\n\n* **Direct Dependencies (${dependenciesCount}):**\n${depNames.length ? depNames.map(d => `  * \`${d}\``).join('\n') : '  * None (Zero-dependency!)'}\n\n* **Dev Dependencies:** **${devDepsCount}** (used for building/testing)\n* **Peer Dependencies:** **${peerDepsCount}**`;
      }
      
      if (topic === 'CONFIGURATION') {
        if (readmeApiSections) {
          return `### ⚙️ Configuration & API: **${packageName}**\n\nHere's what I found in the documentation:\n\n${readmeApiSections.slice(0, 800)}${readmeApiSections.length > 800 ? '\n\n*(Truncated. Check the full README for more details)*' : ''}`;
        }
        return `### ⚙️ Configuration & API: **${packageName}**\n\nI couldn't find a dedicated API or Configuration section in the README. Usually, configuration options are passed as an object to the main initialization function. Please check the full documentation or GitHub repository for specific \`options\` or \`config\` parameters.`;
      }
      
      if (topic === 'COMPATIBILITY') {
        const envMatches = safeReadme.match(/\b(node(?:\.js)?\s*v?\d+|browser|deno|bun|edge)\b/gi) || [];
        const uniqueEnvs = Array.from(new Set(envMatches.map(e => e.toLowerCase())));
        return `### 🧩 Compatibility & Environments: **${packageName}**\n\n* **Framework Peers:** ${peerDepsCount ? peerDepsList : 'None explicitly required.'}\n* **Environment Signals (from README):** ${uniqueEnvs.length ? uniqueEnvs.join(', ') : 'Not explicitly stated'}.\n* **Keywords:** ${pkgKeywordStr}\n\n> Typically, packages lacking explicit browser/node mentions assume the environment they were built for based on their category (${inferredCategory || 'General'}).`;
      }
      
      if (topic === 'MIGRATION') {
        return `### 🚀 Migration & Upgrades: **${packageName}**\n\n* **Current Version:** \`v${version}\`\n* **Total Releases:** **${totalVersions}**\n* **Release Velocity:** ${rvLastYear} releases in the past year.\n\nFor breaking changes or upgrade guides, you should check the package's **CHANGELOG.md** or the "Releases" tab on its GitHub repository. ${totalVersions > 100 ? 'With many versions published, there are likely established migration paths between major versions.' : ''}`;
      }
      
      if (topic === 'PERFORMANCE') {
        return `### ⚡ Performance Profile: **${packageName}**\n\n* **Dependency Weight:** ${dependenciesCount === 0 ? 'Zero dependencies — excellent for performance!' : dependenciesCount <= 5 ? 'Lightweight dependency tree.' : 'Heavy dependency tree — might impact bundle size or install times.'}\n* **Optimization:** Check the README for mentions of "tree-shaking" or "minified".\n\n> **Tip:** You can check exact bundle sizes on [Bundlephobia](https://bundlephobia.com/package/${packageName}).`;
      }
      
      if (topic === 'TROUBLESHOOTING') {
        return `### 🛠️ Troubleshooting: **${packageName}**\n\nIf you're having issues, try these common steps:\n1. **Clear cache:** \`npm cache clean --force\` or delete \`node_modules\` and \`package-lock.json\`, then reinstall.\n2. **Check Peers:** Ensure these peer dependencies are met: ${peerDepsCount ? peerDepsList : 'None'}.\n3. **Check Node Version:** Ensure your Node version aligns with the package's requirements.\n4. **Known Issues:** Check the open issues on GitHub (${github?.openIssues != null ? `${github.openIssues} open` : 'link in metadata'}).`;
      }
      
      if (topic === 'GETTING_STARTED') {
        const installStr = readmeInstallCmds.length ? readmeInstallCmds[0] : `npm install ${packageName}`;
        const codeStr = readmeCodeBlocks.length ? readmeCodeBlocks[0].code : `import ${camelName || 'module'} from '${packageName}';\n// Check README for usage`;
        const featuresStr = readmeFeatures.slice(0, 3).map(f => `* ${f}`).join('\n');
        
        return `### 🚀 Getting Started with **${packageName}**\n\n${featuresStr ? `**Key Highlights:**\n${featuresStr}\n\n` : ''}**1. Install**\n\`\`\`bash\n${installStr}\n\`\`\`\n\n**2. Basic Usage**\n\`\`\`javascript\n${codeStr}\n\`\`\`\n\n${peerDepsCount ? `> Don't forget to install peer dependencies: \`${peerDepsList}\`` : ''}`;
      }
      
      if (topic === 'FEATURES') {
        if (readmeFeatures.length) {
          return `### ✨ Features of **${packageName}**\n\n${readmeFeatures.slice(0, 10).map(f => `* ${f}`).join('\n')}${readmeFeatures.length > 10 ? '\n* *(and more...)*' : ''}`;
        }
        return `### ✨ Features of **${packageName}**\n\nBased on its description and keywords:\n* **Purpose:** ${description}\n* **Domain:** ${pkgKeywordStr}\n* **Category:** ${inferredCategory || 'General'}\n\n*(No explicit feature list found in the README)*`;
      }
      
      if (topic === 'CLI_USAGE') {
        if (readmeCliSection) {
          return `### 🖥️ CLI Usage: **${packageName}**\n\n${readmeCliSection.slice(0, 800)}${readmeCliSection.length > 800 ? '\n\n*(Truncated. Check the full README for more details)*' : ''}`;
        }
        const hasCliSignals = pkgKeywordStr.includes('cli') || description?.toLowerCase().includes('cli');
        return `### 🖥️ CLI Usage: **${packageName}**\n\n${hasCliSignals ? 'This package appears to have a CLI, but specific commands were not found in the README parsing. Try running `npx ' + packageName + ' --help`.' : 'No prominent CLI section found. This may be primarily a programmatic library rather than a CLI tool.'}`;
      }

      if (topic === 'ALTERNATIVES' || topic === 'COMPARE') {
        const alts = inferredAlternatives.slice(0, 6);
        const categoryLabel = inferredCategory
          ? inferredCategory.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
          : 'this domain';
  
        let altLines = alts.length > 0
          ? alts.map(a => `* \`${a}\``).join('\n')
          : '* No close ecosystem alternatives detected in the local knowledge base.';
  
        const categoryContext = inferredCategory
          ? `**${packageName}** belongs to the **${categoryLabel}** ecosystem.`
          : `**${packageName}** is categorized based on its keywords and dependencies.`;
  
        return `### 🔀 Alternatives & Competitors: **${packageName}**\n\n${categoryContext}\n\n**Known alternatives in the same space:**\n${altLines}\n\n* **Why switch?** Consider alternatives if you need a different performance profile, smaller bundle size, a more active maintainer community, or better TypeScript support.\n* **Current standing:** **${packageName}** records **${downloadsStr}** monthly downloads — ${totalDownloads > 1_000_000 ? 'a dominant player in its category, suggesting broad ecosystem trust' : 'a more specialized option; verify alternatives cover your specific use case'}.\n* **License:** \`${license || 'Unspecified'}\` — ensure any alternative aligns with your project's licensing requirements.\n\n> **Tip:** Use the **Comparison View** in DailyNPM to run a live side-by-side download chart against any of these packages.`;
      }
  
      if (topic === 'PROS_CONS') {
        const pros: string[] = [];
        const cons: string[] = [];
  
        if (totalDownloads > 1_000_000) pros.push(`Massive adoption (**${downloadsStr}** monthly downloads) — highly battle-tested in real production environments.`);
        else if (totalDownloads > 100_000) pros.push(`Solid download traction (**${downloadsStr}**/month) — sufficient community coverage for most use cases.`);
        if (dependenciesCount === 0) pros.push('**Zero runtime dependencies** — installs clean with no transitive bloat risk.');
        else if (dependenciesCount <= 3) pros.push(`**Minimal dependency footprint** (${dependenciesCount} direct deps) — keeps your node_modules lean.`);
        if (rvLastYear >= 6) pros.push(`Actively released: **${rvLastYear} releases in the past year** (~every ${rvAvgDays} days) — demonstrates ongoing maintenance commitment.`);
        if (github?.stars && github.stars > 5000) pros.push(`Strong GitHub presence: ⭐ **${github.stars.toLocaleString()} stars** — signals wide developer trust.`);
        if (['MIT', 'ISC', 'BSD', '0BSD', 'Apache-2.0'].some(l => (license || '').includes(l))) pros.push(`**Permissive license** (\`${license}\`) — safe for commercial and closed-source use without legal friction.`);
        if (totalVersions > 20) pros.push(`**${totalVersions} published versions** — a long release history indicates sustained stewardship.`);
        if (pros.length === 0) pros.push('Focused scope — purpose-built for its stated use case without unnecessary bloat.');
  
        if (dependenciesCount > 15) cons.push(`**Heavy dependency tree** (${dependenciesCount} direct deps) — elevates supply-chain risk and audit overhead.`);
        if (rvDaysSince > 180) cons.push(`**No release in ${rvDaysSince} days** — potential maintenance lag; check GitHub for activity signals.`);
        else if (rvLastYear === 0) cons.push('**No releases in the past year** — could indicate an unmaintained or feature-complete codebase.');
        if (peerDepsCount > 0) cons.push(`Requires **${peerDepsCount} peer ${peerDepsCount === 1 ? 'dependency' : 'dependencies'}** (\`${peerDepsList}\`) — adds setup friction in monorepo environments.`);
        if (totalDownloads < 10_000) cons.push('**Low download volume** — limited community resources, fewer Stack Overflow answers, higher risk of long-term deprecation.');
        if (cons.length === 0) cons.push('No major drawbacks detected from registry metadata. Perform a full audit before critical production use.');
  
        const proLines = pros.map(p => `* ✅ ${p}`).join('\n');
        const conLines = cons.map(c => `* ⚠️ ${c}`).join('\n');
  
        return `### ⚖️ Pros & Cons Analysis: **${packageName}**\n\n### ADVANTAGES\n${proLines}\n\n### DRAWBACKS\n${conLines}\n\n* **Overall Health Score:** ${health.color} **${health.score}/100** (${health.label})\n* **Recommendation:** ${health.score >= 75 ? 'Suitable for production use — proceed with standard version pinning.' : health.score >= 50 ? 'Use with caution — evaluate alternatives and monitor for updates.' : 'High risk — consider a more actively maintained alternative.'}`;
      }
  
      if (topic === 'HEALTH') {
        const maintenanceStr = rvLastYear > 0
          ? `**${rvLastYear} releases** in the past year (avg every **${rvAvgDays} days**).`
          : 'No releases recorded in the past year — activity unverifiable from registry data.';
  
        const lastReleaseStr = rvDaysSince > 0 ? `${rvDaysSince} day(s) ago` : 'Recently';
        const maintCount = (maintainers || []).length;
        const lastCommitStr = lastCommit
          ? new Date(lastCommit).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
          : 'Unknown';
  
        return `### 🏥 Maintenance Health Report: **${packageName}**\n\n* **Overall Health Score:** ${health.color} **${health.score}/100** — ${health.label}\n* **Release Velocity:** ${maintenanceStr}\n* **Last Release:** ${lastReleaseStr}\n* **Last GitHub Commit:** ${lastCommitStr}\n* **Total Published Versions:** **${totalVersions}**\n* **Active Maintainers:** **${maintCount}** registered maintainer(s)\n* **Monthly Downloads:** **${downloadsStr}** — ${totalDownloads > 500_000 ? 'high traffic ensures rapid community bug detection.' : 'moderate traffic; monitor GitHub issues for unresolved bugs.'}\n\n* **Verdict:** ${
          health.score >= 85 ? '🟢 **Actively maintained.** Safe for long-term production use.' :
          health.score >= 70 ? '🟡 **Healthy but watch for slowdowns.** Pin your version and monitor releases.' :
          health.score >= 50 ? '🟠 **Mixed signals.** Check GitHub for recent activity before committing.' :
          '🔴 **Potentially unmaintained.** Strongly consider evaluating alternatives.'
        }`;
      }
  
      if (topic === 'DOWNLOADS') {
        const tier = totalDownloads > 10_000_000 ? 'Tier 1 — Ecosystem Cornerstone'
          : totalDownloads > 1_000_000 ? 'Tier 2 — Widely Adopted'
          : totalDownloads > 100_000 ? 'Tier 3 — Established Niche'
          : totalDownloads > 10_000 ? 'Tier 4 — Growing'
          : 'Tier 5 — Early Stage / Specialized';
  
        return `### 📊 Download Metrics: **${packageName}**\n\n* **Monthly Downloads:** **${downloadsStr}**\n* **Adoption Tier:** ${tier}\n* **Popularity Signal:** ${totalDownloads > 1_000_000 ? 'Battle-tested at scale — used in production by thousands of projects worldwide.' : totalDownloads > 100_000 ? 'Solid community trust — sufficient coverage for most use cases.' : 'Niche or emerging — verify community support before committing to production.'}\n* **Registry Ranking:** ${totalDownloads > 5_000_000 ? 'Top-tier NPM package — among the most-installed in the ecosystem.' : 'Mid-range adoption — monitor growth trends over time.'}\n\n> **Tip:** Use the **Download Chart** on DailyNPM to see the full 30-day trend and the **Regression Engine** to get a 7-day download forecast.`;
      }
  
      if (topic === 'VERSIONS') {
        const lastReleaseDateStr = time?.modified
          ? new Date(time.modified).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
          : 'Unknown';
        const createdDateStr = time?.created
          ? new Date(time.created).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
          : 'Unknown';
        return `### 📦 Version History: **${packageName}**\n\n* **Latest Version:** \`v${version}\`\n* **Total Published Versions:** **${totalVersions}**\n* **First Published:** ${createdDateStr}\n* **Last Modified:** ${lastReleaseDateStr}\n* **Release Cadence (last year):** **${rvLastYear}** releases${rvAvgDays > 0 ? ` (~every ${rvAvgDays} days)` : ''}\n* **Days Since Last Release:** **${rvDaysSince > 0 ? rvDaysSince : 'Recent'}**\n\n* **Maturity Assessment:** ${totalVersions > 50 ? 'Highly mature — a long release history signals sustained development.' : totalVersions > 10 ? 'Moderately mature — in active development with multiple iterations.' : 'Early-stage — fewer than 10 versions published.'}`;
      }
  
      if (topic === 'PEERS') {
        const peerList = peerDepsCount > 0
          ? Object.entries(peerDependencies || {}).map(([k, v]) => `* \`${k}\` @ \`${v}\``).join('\n')
          : '* No peer dependencies declared.';
        return `### 🔗 Peer Dependency Report: **${packageName}**\n\nPeer dependencies are packages that **${packageName}** expects to be present in *your* project — they are not automatically installed.\n\n**Declared Peer Dependencies (${peerDepsCount}):**\n${peerList}\n\n* **What this means:** You must manually install any peer dependencies listed above. Missing peers will typically cause runtime warnings or errors.\n* **Direct Dependencies:** **${dependenciesCount}** (auto-installed)\n* **DevDependencies:** **${devDepsCount}** (build/test only)`;
      }
  
      if (topic === 'KEYWORDS') {
        const category = inferredCategory
          ? inferredCategory.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
          : 'General Purpose';
        return `### 🏷️ Keywords & Category Classification: **${packageName}**\n\n* **Registry Tags:** \`${pkgKeywordStr}\`\n* **Inferred Ecosystem Category:** **${category}**\n* **Description:** "${description || 'No description declared.'}"\n* **Practical Domain:** ${inferredCategory ? `This package operates in the **${category}** space — a competitive area with several alternatives.` : 'Category could not be confidently inferred from available metadata.'}\n\n> **Related packages** in the same category: ${inferredAlternatives.slice(0, 4).map(a => `\`${a}\``).join(', ') || 'None detected'}`;
      }
  
      if (topic === 'CREATOR') {
        let authorName = 'Unknown author';
        if (author) authorName = typeof author === 'string' ? author : (author.name || authorName);
        const maintainersList = maintainers && maintainers.length > 0
          ? maintainers.map((m: { name: string }) => m.name).join(', ')
          : 'None listed';
        return `### 👤 Package Authorship: **${packageName}**\n\n* **Primary Author:** \`${authorName}\`\n* **Registered Maintainers:** ${maintainersList}\n* **Maintainer Count:** **${(maintainers || []).length}** — ${(maintainers || []).length > 3 ? 'a multi-person team suggests organizational backing.' : 'a small maintainer count means bus-factor risk; verify GitHub activity.'}\n* **Published Under:** \`${packageName}\` in the NPM registry.`;
      }
  
      if (topic === 'SIZE') {
        let sizeLabel = dependenciesCount === 0 ? 'Featherweight (no dependencies)' : dependenciesCount <= 3 ? 'Lightweight' : dependenciesCount <= 10 ? 'Moderate' : 'Heavy';
        return `### ⚖️ Package Weight & Footprint: **${packageName}**\n\n* **Direct Dependencies:** **${dependenciesCount}** — ${sizeLabel}\n* **DevDependencies:** **${devDepsCount}** (build/test, not shipped to users)\n* **Peer Dependencies:** **${peerDepsCount}** (must be installed separately)\n* **Footprint Verdict:** ${dependenciesCount > 15 ? '⚠️ Heavy — run `npm audit` and inspect the full dependency tree before bundling.' : dependenciesCount > 5 ? '🟡 Moderate — tree-shaking via Vite or Webpack will help reduce final bundle size.' : '🟢 Lean — minimal transitive dependencies make this a safe choice for bundle-sensitive projects.'}\n* **Bundle Tip:** Use \`bundlephobia.com/${packageName}\` to see the exact minified+gzipped byte count.`;
      }
  
      if (topic === 'LICENSE') {
        const licenseStr = license || 'Unspecified License';
        const isPermissive = ['MIT', 'BSD', 'ISC', 'APACHE', 'UNLICENSED', '0BSD', 'CC0'].some(l => licenseStr.toUpperCase().includes(l));
        return `### 📄 Licensing & Legal Status: **${packageName}**\n\n* **License:** \`${licenseStr}\`\n* **Type:** ${isPermissive ? '✅ Permissive — no copyleft restrictions.' : '⚠️ Non-permissive — review terms before commercial use.'}\n* **Commercial Use:** ${isPermissive ? 'Permitted without requirement to open-source your code.' : 'Consult the full license text — copyleft terms may require source disclosure.'}\n* **Attribution Required:** ${licenseStr.includes('MIT') || licenseStr.includes('BSD') ? 'Yes — include the original license notice in your distribution.' : 'Review license text for specific attribution requirements.'}`;
      }
  
      if (topic === 'DATES') {
        const createdDate = time?.created ? new Date(time.created).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Unknown';
        const modifiedDate = time?.modified ? new Date(time.modified).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Unknown';
        let ageStr = 'N/A';
        if (time?.created) {
          const diffMs = Date.now() - new Date(time.created).getTime();
          const y = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25));
          ageStr = y >= 1 ? `${y} year(s) old` : `${Math.floor(diffMs / (1000 * 60 * 60 * 24))} day(s) old`;
        }
        return `### 📅 Registry Timeline: **${packageName}**\n\n* **First Published:** ${createdDate}\n* **Last Modified:** ${modifiedDate}\n* **Package Age:** ${ageStr}\n* **Current Version:** \`v${version}\`\n* **Total Releases:** **${totalVersions}**`;
      }
  
      if (topic === 'SOCIAL') {
        const stars = github?.stars != null ? github.stars.toLocaleString() : 'Unknown';
        const forks = github?.forks != null ? github.forks.toLocaleString() : 'Unknown';
        const openIssues = github?.openIssues != null ? github.openIssues.toLocaleString() : 'Unknown';
        const watchers = github?.watchers != null ? github.watchers.toLocaleString() : 'Unknown';
        return `### 🌐 Social Metrics & GitHub Telemetry: **${packageName}**\n\n* **GitHub Stars:** ⭐ **${stars}**\n* **Forks:** 🍴 **${forks}**\n* **Open Issues:** 🐛 **${openIssues}**\n* **Watchers:** 👁️ **${watchers}**\n* **Monthly Downloads:** **${downloadsStr}**\n* **Repository:** ${github?.homepage || metadata.homepage || 'Not linked'}\n* **Community Signal:** ${github?.stars && github.stars > 10000 ? '🔥 Top-tier adoption — large star count reflects significant ecosystem trust.' : github?.stars && github.stars > 1000 ? '🟢 Well-regarded in its niche.' : '🟡 Smaller community footprint — evaluate GitHub issues for unresolved bugs.'}`;
      }
  
      if (topic === 'SECURITY') {
        const depVerdict = dependenciesCount === 0
          ? 'Zero direct dependencies — minimal supply-chain exposure.'
          : dependenciesCount <= 4 ? `Only ${dependenciesCount} deps — low attack surface.`
          : `${dependenciesCount} dependencies — standard auditing recommended.`;
        const safetyVerdict = totalDownloads > 5_000_000
          ? 'Extreme download volume ensures rapid CVE discovery and community response.'
          : 'Stable community coverage — security issues are likely reported via GitHub.';
        if (isConcernedAboutSize) {
          return `### ⚖️ Bloat & Dependency Audit: **${packageName}**\n\n* **Direct Dependencies:** **${dependenciesCount}** — ${depVerdict}\n* **DevDeps (not shipped):** **${devDepsCount}**\n* **Verdict:** ${dependenciesCount > 8 ? '⚠️ Moderate tree — use `npm audit` and inspect with `npm ls --all` before bundling.' : '✅ Lean footprint — minimal transitive dependency risk.'}\n* **Build Tip:** Run \`npx bundlephobia ${packageName}\` to measure exact bundle impact.`;
        }
        return `### 🛡️ Security Profile: **${packageName}**\n\n* **Version Assessed:** \`v${version}\`\n* **Download Volume:** **${downloadsStr}** — ${safetyVerdict}\n* **Dependency Surface:** ${depVerdict}\n* **Open Issues:** ${github?.openIssues != null ? `**${github.openIssues.toLocaleString()}** open issues on GitHub` : 'GitHub data unavailable — check manually.'}\n* **Risk Indicator:** No known CVEs found in registry metadata. Always run \`npm audit\` to check your installed version against the advisory database.\n* **Best Practice:** Pin to exact version \`v${version}\` in package.json to prevent unintended registry drift.`;
      }
  
      if (topic === 'CODE_EXAMPLE') {
        const defaultDesc = description || `perform operations provided by ${packageName}`;
        const descLower = defaultDesc.charAt(0).toLowerCase() + defaultDesc.slice(1);
        
        let installCommandText = readmeInstallCmds.length > 0 
          ? readmeInstallCmds.join('\n\n')
          : `npm install ${packageName}\n\nyarn add ${packageName}\n\npnpm add ${packageName}`;
          
        let usageExampleText = readmeCodeBlocks.length > 0
          ? `// From README.md\n${readmeCodeBlocks[0].code}`
          : `// 1. Import\nimport ${camelName || 'module'} from '${packageName}';\n\n// 2. Initialize\nconst instance = ${camelName || 'module'}();\n\n// 3. Use\nconsole.log("${packageName} loaded. Deps: ${dependenciesCount}");`;
  
        if (isRequestingSetup && !isRequestingUsageGuide) {
          return `### ⚙️ Installation Guide: **${packageName}**\n\n${installCommandText}\n\nThen import it in your project:\n\nimport ${camelName || 'module'} from '${packageName}';\n\n${peerDepsCount > 0 ? `> **Peer deps required:** Also install \`${peerDepsList}\`` : '> **No peer dependencies** — install and import, you are ready to go.'}\n> Version pinned to: \`v${version}\``;
        }
  
        if (isRequestingUsageGuide) {
          return `### 📖 Usage Guide: **${packageName}** \`v${version}\`\n\n**${packageName}** is used to ${descLower}.\n\n**Step 1 — Install:**\n${readmeInstallCmds.length > 0 ? readmeInstallCmds[0] : `npm install ${packageName}`}\n\n**Step 2 — Basic Usage:**\n\`\`\`javascript\n${usageExampleText}\n\`\`\`\n\n${peerDepsCount > 0 ? `> **Note:** You must also install peer deps: \`${peerDepsList}\`` : ''}\n> **Keywords:** ${pkgKeywordStr}`;
        }
  
        return `### 💻 Code Blueprint: **${packageName}** \`v${version}\`\n\n**${packageName}** is used to ${descLower}.\n\n**Install:**\n${readmeInstallCmds.length > 0 ? readmeInstallCmds[0] : `npm install ${packageName}`}\n\n**Basic Integration:**\n\`\`\`javascript\n${usageExampleText}\n\`\`\`\n\n> **Note:** ${readmeCodeBlocks.length > 0 ? 'Code example extracted from the official README.' : 'This is a generic scaffold. Consult the README for API-specific patterns.'}`;
      }
  
      if (topic === 'USE_CASE') {
        const defaultDesc = description || 'an integration component in the JavaScript registry';
        const popularity = totalDownloads > 1_000_000 ? 'central pillar' : totalDownloads > 100_000 ? 'popular resource' : 'emerging tool';
        const altsPreview = inferredAlternatives.slice(0, 3).map(a => `\`${a}\``).join(', ');
        const featuresList = readmeFeatures.length > 0 ? `\n* **Key Features:**\n${readmeFeatures.slice(0, 5).map(f => `  * ${f}`).join('\n')}` : '';
        
        return `### 📰 Package Overview: **${packageName}**\n\n* **Core Purpose:** The registry defines this package as:\n  > "${defaultDesc}"\n\n* **Current Version:** \`v${version}\`\n* **Monthly Downloads:** **${downloadsStr}** — a ${popularity} for developers.\n* **Ecosystem Category:** ${inferredCategory ? inferredCategory.replace(/_/g, ' ') : 'General Purpose'}\n* **Dependencies:** **${dependenciesCount}** direct, **${peerDepsCount}** peer\n* **License:** \`${license || 'Unspecified'}\`\n* **Keywords:** ${pkgKeywordStr}${featuresList}\n${altsPreview ? `* **Related Packages:** ${altsPreview}` : ''}\n\n> Ask: *"How do I use it?"*, *"What are the alternatives?"*, *"Is it maintained?"*, or *"Show pros & cons."*`;
      }

      return null;
    };

    let response = generateResponseForTopic(primaryTopic);

    if (secondaryTopic && response) {
      const secondaryResponse = generateResponseForTopic(secondaryTopic);
      if (secondaryResponse) {
        response += `\n---\n${secondaryResponse}`;
      }
    }

    if (response) return response;

    // ── DEFAULT FALLBACK ──────────────────────────────────────────────────────
    // Check if question word matches a heading in readmeSections
    for (const token of tokens) {
      if (token.length > 3) {
        for (const [title, sectionContent] of readmeSections.entries()) {
          if (title.includes(token)) {
            return `### 📖 From the README: **${title}**\n\n${sectionContent.slice(0, 500)}${sectionContent.length > 500 ? '\n\n*(Truncated. Check the full README for more details)*' : ''}`;
          }
        }
      }
    }

    return `### 📰 Package Intelligence Dispatch: **${packageName}**\n\n* **Identity:** \`${packageName}\` (\`v${version}\`)\n* **Description:** "${description || 'No registry description declared.'}"\n* **Downloads:** ${downloadsStr}/month\n* **Dependencies:** ${dependenciesCount} direct, ${peerDepsCount} peer\n* **License:** \`${license || 'Unspecified'}\`\n* **Health:** ${health.color} ${health.score}/100 (${health.label})\n* **Keywords:** ${pkgKeywordStr}\n\n> **What you can ask — all answered locally, no API key needed:**\n> 🔍 *"What does it do?"* · 💻 *"Show me a code example"* · 🔀 *"What are the alternatives?"*\n> ⚖️ *"Pros and cons?"* · 🏥 *"Is it maintained?"* · 📊 *"How popular is it?"*\n> 🔗 *"What are its peer dependencies?"* · 🛡️ *"Is it safe to use?"* · 👤 *"Who made this?"*`;
  };


  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    setError(null);
    setLoading(true);

    const userMessage: ChatMessage = { role: 'user', text: textToSend };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');

    // Check if custom API key is available
    const hasKey = isUsingCustomApiKey();

    if (!hasKey) {
      // Offline fallback mode: run the local match algorithm
      setTimeout(() => {
        const answer = getLocalAnswer(textToSend);
        setMessages(prev => [...prev, { role: 'model', text: answer }]);
        setLoading(false);
      }, 500); // Small delay to simulate transmission
      return;
    }

    try {
      const systemPrompt = `You are an expert NPM package analyst. You are answering user questions about the NPM package "${packageName}".
Here is the package metadata:
- Description: ${description}
- Latest Version: ${version}
- Direct Dependencies: ${dependenciesCount}
- 30-Day Downloads: ${totalDownloads.toLocaleString()}

Provide objective, architectural, and educational answers. Keep answers concise, readable, and matching the tone of a premium tech journal.`;

      const chatHistory = updatedMessages.map(msg => ({
        role: msg.role === 'model' ? 'assistant' : 'user',
        content: msg.text
      }));

      const answer = await requestTieredLlmClient({
        systemPrompt,
        chatHistory
      });

      setMessages(prev => [...prev, { role: 'model', text: answer }]);
    } catch (err: any) {
      console.error("AI Q&A failed:", err);
      setError(err.message || "Failed to get response from AI. Please check your internet connection or API Key.");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([]);
    setError(null);
    setInput('');
  };

  return (
    <div className="newspaper-card p-6 text-[#1A1918] space-y-4 relative overflow-hidden">
      {/* Editorial Header */}
      <div className="flex items-center justify-between pb-3 border-b-2 border-[#1A1918]">
        <div className="flex items-center gap-2">
          <div className="bg-[#1A1918] text-white p-1.5 shrink-0">
            <MessageSquare className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="font-headline text-xl font-bold uppercase tracking-tight">
              Q&A Bureau: Interactive package intelligence
            </h3>
            <p className="text-xs font-mono-news text-[#4A4744] mt-0.5">
              Consult the AI repository analyst on safety, integration, and architecture of <span className="italic font-bold">{packageName}</span>
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            className="p-1 border border-[#1A1918] hover:bg-[#A82424] hover:text-white transition-colors cursor-pointer"
            title="Reset Chat Transcript"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Chat Display Box */}
      <div className="bg-[#EAE6DF]/60 border-2 border-[#1A1918] p-4 h-64 overflow-y-auto space-y-3 font-mono-news text-xs scrollbar-thin">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-[#4A4744] italic p-4 space-y-2">
            <Sparkles className="w-8 h-8 text-amber-600 animate-pulse" />
            <p className="text-xs">No dispatches recorded. Inquire below to consult the AI Bureau.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`p-2.5 border-2 border-[#1A1918] max-w-[85%] shadow-[2px_2px_0px_#1A1918] ${
                  msg.role === 'user'
                    ? 'bg-[#FBF9F5] ml-auto'
                    : 'bg-[#F4F1EA] mr-auto leading-relaxed'
                }`}
              >
                <div className="text-[10px] font-bold uppercase mb-1 text-[#A82424] border-b border-[#1A1918]/10 pb-0.5">
                  {msg.role === 'user' ? 'READER INQUIRY' : 'ANALYST DECREE'}
                </div>
                <div className="font-body-news text-xs leading-relaxed text-[#1a1918]">
                  {msg.role === 'user' ? msg.text : <MarkdownText text={msg.text} />}
                </div>
              </div>
            ))}
            {loading && (
              <div className="bg-[#F4F1EA] border-2 border-[#1A1918] p-2.5 max-w-[80%] shadow-[2px_2px_0px_#1A1918] mr-auto flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#A82424]" />
                <span className="text-[10px] font-bold">TRANSMITTING TELEGRAM FROM BUREAU...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3 bg-[#EAE6DF] border-2 border-[#A82424] text-xs font-mono-news text-[#A82424]">
          <strong>COMMUNICATION ERROR:</strong> {error}
        </div>
      )}

      {/* Preset Suggestions */}
      {messages.length === 0 && (
        <div className="space-y-1.5">
          <span className="block text-[10px] font-bold uppercase text-[#4A4744]">RECOMMENDED INQUIRIES:</span>
          <div className="flex flex-col gap-1">
            {PRESETS.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(preset)}
                className="w-full text-left p-2 border border-[#1A1918]/30 hover:border-[#1A1918] hover:bg-[#FBF9F5] transition-all cursor-pointer font-mono-news text-[11px] text-[#1A1918] flex items-center justify-between"
              >
                <span>{preset}</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-[#A82424]" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Message Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend(input);
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Inquire about ${packageName}...`}
          disabled={loading}
          className="flex-1 bg-[#FBF9F5] text-[#1A1918] placeholder-[#7A7570] font-mono-news text-xs py-2 px-3 border-2 border-[#1A1918] focus:outline-none focus:bg-white shadow-[2px_2px_0px_#1A1918]"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="bg-[#1A1918] hover:bg-[#A82424] disabled:bg-[#4A4744] text-white font-mono-news text-xs uppercase font-bold px-4 py-2 border-2 border-[#1A1918] shadow-[2px_2px_0px_#1A1918] hover:shadow-none active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" /> ASK
        </button>
      </form>
    </div>
  );
};
