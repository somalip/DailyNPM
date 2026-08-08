function getLocalAnswer(question: string, metadata: any, totalDownloads: number): string {
  if (!metadata) return 'No package metadata available.';
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
      for (const [title, sectionContent] of Array.from(readmeSections.entries())) {
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
        for (const [title, sectionContent] of Array.from(readmeSections.entries())) {
          if (title.includes(token)) {
            return `### 📖 From the README: **${title}**\n\n${sectionContent.slice(0, 500)}${sectionContent.length > 500 ? '\n\n*(Truncated. Check the full README for more details)*' : ''}`;
          }
        }
      }
    }

    return `### 📰 Package Intelligence Dispatch: **${packageName}**\n\n* **Identity:** \`${packageName}\` (\`v${version}\`)\n* **Description:** "${description || 'No registry description declared.'}"\n* **Downloads:** ${downloadsStr}/month\n* **Dependencies:** ${dependenciesCount} direct, ${peerDepsCount} peer\n* **License:** \`${license || 'Unspecified'}\`\n* **Health:** ${health.color} ${health.score}/100 (${health.label})\n* **Keywords:** ${pkgKeywordStr}\n\n> **What you can ask — all answered locally, no API key needed:**\n> 🔍 *"What does it do?"* · 💻 *"Show me a code example"* · 🔀 *"What are the alternatives?"*\n> ⚖️ *"Pros and cons?"* · 🏥 *"Is it maintained?"* · 📊 *"How popular is it?"*\n> 🔗 *"What are its peer dependencies?"* · 🛡️ *"Is it safe to use?"* · 👤 *"Who made this?"*`;
  }

import blessed from 'blessed';
import contrib from 'blessed-contrib';
import pc from 'picocolors';
import { getPackageInfo, getDownloadStats } from '../services/npm.js';

import { computeDownloadRegression } from '../utils/regressionEngine.js';
import { 
  onAuthStateListener, 
  signInUser, 
  signUpUser, 
  signOutUser, 
  trackPackage, 
  untrackPackage,
  isSimulationMode
} from '../services/firebase.js';

// Helper to recursively build dependency tree as colored ASCII text
async function buildAsciiTree(pkgName: string, maxDepth = 3, currentDepth = 0, resolved = new Set<string>()): Promise<string[]> {
  const cleanName = pkgName.trim();
  if (!cleanName || resolved.has(cleanName) || currentDepth >= maxDepth) {
    return [];
  }

  const nextResolved = new Set(resolved);
  nextResolved.add(cleanName);

  try {
    const info = await getPackageInfo(cleanName);
    const deps = info.dependencies || {};
    const depNames = Object.keys(deps);
    let lines: string[] = [];

    if (currentDepth === 0) {
      lines.push(`📦  {bold}{cyan-fg}${cleanName}{/cyan-fg}{/bold} (v${info.latestVersion})`);
    }

    if (currentDepth < maxDepth - 1) {
      const limitNames = depNames.slice(0, 15);
      for (let i = 0; i < limitNames.length; i++) {
        const depName = limitNames[i];
        const isLast = i === limitNames.length - 1 && depNames.length <= 15;
        const prefix = isLast ? '└── ' : '├── ';
        lines.push(`${prefix}${depName} (${deps[depName]})`);

        const childLines = await buildAsciiTree(depName, maxDepth, currentDepth + 1, nextResolved);
        childLines.forEach((line) => {
          const childPrefix = isLast ? '    ' : '│   ';
          lines.push(`${childPrefix}${line}`);
        });
      }

      if (depNames.length > 15) {
        lines.push(`└── ... and ${depNames.length - 15} more dependencies`);
      }
    } else {
      for (let i = 0; i < depNames.length; i++) {
        const depName = depNames[i];
        const isLast = i === depNames.length - 1;
        const prefix = isLast ? '└── ' : '├── ';
        lines.push(`${prefix}${depName} (${deps[depName]})`);
      }
    }

    return lines;
  } catch (err) {
    return [`⚠️  ${cleanName} (failed to fetch)`];
  }
}

export async function launchTui(initialPackage = 'react') {
  // Initialize Blessed Screen with mouse support
  const screen = blessed.screen({
    smartCSR: true,
    title: 'The Daily NPM - Terminal User Interface',
  });

  screen.enableMouse();

  // Create Grid Layout (12x12)
  const grid = new contrib.grid({ rows: 12, cols: 12, screen: screen });

  // 1. Top Header / Masthead Box (Rows 0..1, Cols 0..11)
  const headerBox = grid.set(0, 0, 2, 12, blessed.box, {
    content: `{center}{bold}THE DAILY NPM - TERMINAL EDITION{/bold}{/center}\n` +
             `{center}{cyan-fg}"The World's Preeminent Journal of Package Intelligence & Node Statistics"{/cyan-fg}{/center}`,
    tags: true,
    style: {
      fg: 'yellow',
      bg: 'black',
      border: { fg: 'cyan' },
    },
    border: { type: 'line' },
  });

  // 2. Package Overview Card (Rows 2..4, Cols 0..4) - Height 3
  const overviewBox = grid.set(2, 0, 3, 5, blessed.box, {
    label: ' 📦 PACKAGE METADATA ',
    content: 'Loading package metadata...',
    tags: true,
    scrollable: true,
    alwaysScroll: true,
    mouse: true,
    border: { type: 'line' },
    style: { border: { fg: 'yellow' }, label: { fg: 'yellow', bold: true } },
  });

  // 2b. Sparkline (Rows 5..8, Cols 0..4) - Height 4 (Expanded for rich stats)
  const sparklineBox = grid.set(5, 0, 4, 5, blessed.box, {
    label: ' 📈 30D TREND ',
    tags: true,
    valign: 'middle',
    border: { type: 'line' },
    style: { border: { fg: 'green' }, label: { fg: 'green', bold: true } },
  });

  // Custom robust sparkline implementation with extended trend data
  (sparklineBox as any).setTrendData = function(data: number[], reg: any) {
    if (!data || data.length === 0) return;
    const maxVal = Math.max(...data) || 1;
    const minVal = Math.min(...data) || 0;
    const avgVal = Math.round(data.reduce((a, b) => a + b, 0) / data.length);
    const sparkChars = [' ', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
    
    // Auto-scale sparkline strictly to width
    const boxInnerWidth = typeof this.width === 'number' ? this.width - 2 : 30;
    const renderData = data.slice(-boxInnerWidth);
    const sparkText = renderData.map(v => sparkChars[Math.min(7, Math.floor((v / maxVal) * 8))]).join('');
    
    const formatNum = (num: number) => {
      if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
      if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
      return num.toString();
    };
    
    const trendGrowth = avgVal > 0 ? ((reg.slope / avgVal) * 100).toFixed(1) : '0.0';
    const trendColor = reg.slope > 0 ? 'green-fg' : (reg.slope < 0 ? 'red-fg' : 'yellow-fg');
    const trendIcon = reg.slope > 0 ? '▲' : (reg.slope < 0 ? '▼' : '▶');
    
    const weekendDipStr = reg.weekendDipRatio < 1 ? `▼${((1 - reg.weekendDipRatio) * 100).toFixed(0)}%` : `---`;

    this.setContent(
      `{center}{cyan-fg}Max: ${formatNum(maxVal)} │ Min: ${formatNum(minVal)} │ Avg: ${formatNum(avgVal)}{/cyan-fg}{/center}\n` +
      `{center}{magenta-fg}7D: ${formatNum(reg.next7DaysPredictedDownloads)} │ 30D: ${formatNum(reg.next30DaysPredictedDownloads)}{/magenta-fg}{/center}\n` +
      `{center}{${trendColor}}Trend: ${trendIcon}${trendGrowth}% │ R²: ${reg.rSquared}{/${trendColor}}{/center}\n` +
      `{center}{yellow-fg}Wknd Drop: ${weekendDipStr} │ N=${reg.dataPointsCount}{/yellow-fg}{/center}\n` +
      `{center}{white-fg}Alg: ${reg.algorithmStrengthScore}/100 (${reg.algorithmStrengthLabel}){/white-fg}{/center}\n` +
      ` {green-fg}${sparkText}{/green-fg}`
    );
  };

  // 3. Interactive Bar Chart Box (Rows 2..7, Cols 5..11)
  const chartBox = grid.set(2, 5, 6, 7, contrib.bar, {
    label: ' 📊 DAILY DOWNLOAD BAR CHART (USE ← / → ARROWS OR HOVER FOR DETAILS) ',
    barWidth: 2,
    barSpacing: 1,
    xOffset: 0,
    maxHeight: 0,
    tags: true,
    border: { type: 'line' },
    style: { border: { fg: 'cyan' }, label: { fg: 'cyan', bold: true } },
  });

  // Tooltip / Detail Overlay Box inside Chart Area
  const tooltipBox = grid.set(7, 5, 1, 7, blessed.box, {
    content: '{center}{yellow-fg}Hover or use ← / → Arrow keys to inspect daily download counts{/yellow-fg}{/center}',
    tags: true,
    style: { fg: 'white', bg: 'black' },
  });

  // 4. Day of Week Velocity Bar Chart (Rows 9..10, Cols 0..4) - Height 2
  const dowBox = grid.set(9, 0, 2, 5, blessed.box, {
    label: ' 📅 WEEKDAY BUILD PACING ',
    content: 'Calculating daily velocity...',
    tags: true,
    scrollable: true,
    alwaysScroll: true,
    mouse: true,
    scrollbar: { ch: ' ', track: { bg: 'black' }, style: { bg: 'cyan' } },
    border: { type: 'line' },
    style: { border: { fg: 'green' }, label: { fg: 'green', bold: true } },
  });

  // 5. AI Insights & Health Grade Box (Rows 8..10, Cols 5..9) - Width 5
  const aiBox = grid.set(8, 5, 3, 5, blessed.box, {
    label: ' 🧠 AI BUREAU VERDICT ',
    content: 'Consulting AI Bureau...',
    tags: true,
    scrollable: true,
    alwaysScroll: true,
    mouse: true,
    scrollbar: { ch: ' ', track: { bg: 'black' }, style: { bg: 'magenta' } },
    border: { type: 'line' },
    style: { border: { fg: 'magenta' }, label: { fg: 'magenta', bold: true } },
  });

  // 5b. Health Donut Chart (Rows 8..10, Cols 10..11) - Width 2
  const donutBox = grid.set(8, 10, 3, 2, contrib.donut, {
    label: ' HEALTH ',
    radius: 4,
    arcWidth: 2,
    remainColor: 'black',
    yPadding: 0,
    border: { type: 'line' },
    style: { border: { fg: 'cyan' }, label: { fg: 'cyan', bold: true } },
  });

  // 6. Footer Controls Bar (Row 11, Cols 0..11)
  const footerBox = grid.set(11, 0, 1, 12, blessed.box, {
    content: ' {bold}[P]{/bold} Portfolio  •  {bold}[L]{/bold} Login  •  {bold}[T]{/bold} Track  •  {bold}[U]{/bold} Simulate  •  {bold}[S]{/bold} Search  •  {bold}[C]{/bold} Chat AI  •  {bold}[M]{/bold} Model  •  {bold}[D]{/bold} Deps Tree  •  {bold}[R]{/bold} Refresh  •  {bold}[Q]{/bold} Quit ',
    tags: true,
    style: { fg: 'black', bg: 'white' },
  });

  // Prompt Modal for Package Search
  const searchPrompt = blessed.prompt({
    parent: screen,
    border: 'line',
    height: 7,
    width: 'half',
    top: 'center',
    left: 'center',
    label: ' Search Wire ',
    tags: true,
    hidden: true,
    style: {
      border: { fg: 'cyan' },
      label: { fg: 'cyan', bold: true },
    },
  });

  // Chat Modal
  const chatPrompt = blessed.prompt({
    parent: screen,
    border: 'line',
    height: 7,
    width: 'half',
    top: 'center',
    left: 'center',
    label: ' Chat with AI Bureau ',
    tags: true,
    hidden: true,
    style: { border: { fg: 'magenta' }, label: { fg: 'magenta', bold: true } },
  });

  // Model Selection List
  // API Key Config Modal
  const apiKeyPrompt = blessed.prompt({
    parent: screen,
    border: 'line',
    height: 7,
    width: 'half',
    top: 'center',
    left: 'center',
    label: ' Configure GROQ API Key ',
    tags: true,
    hidden: true,
    style: { border: { fg: 'cyan' }, label: { fg: 'cyan', bold: true } },
  });

  // Account Modals (Email / Password inputs)
  const emailPrompt = blessed.prompt({
    parent: screen,
    border: 'line',
    height: 7,
    width: 'half',
    top: 'center',
    left: 'center',
    label: ' Reader Sign In - Email ',
    tags: true,
    hidden: true,
    style: { border: { fg: 'yellow' }, label: { fg: 'yellow', bold: true } },
  });

  const passwordPrompt = blessed.prompt({
    parent: screen,
    border: 'line',
    height: 7,
    width: 'half',
    top: 'center',
    left: 'center',
    label: ' Reader Sign In - Password ',
    tags: true,
    hidden: true,
    style: { border: { fg: 'yellow' }, label: { fg: 'yellow', bold: true } },
  });

  // Simulation prompt
  const simPrompt = blessed.prompt({
    parent: screen,
    border: 'line',
    height: 9,
    width: 'half',
    top: 'center',
    left: 'center',
    label: ' Forecast Simulation Scenarios ',
    tags: true,
    hidden: true,
    style: { border: { fg: 'red' }, label: { fg: 'red', bold: true } },
  });

  

  // --- APP TUI STATE ---
  let user: any = null;
  let viewMode: 'package' | 'portfolio' = 'package';
  let simScenario: { type: 'none' | 'flat_add' | 'compound' | 'event_shock'; value: number } = { type: 'none', value: 0 };

  let currentPkgName = initialPackage;
  let currentPkgInfo: any = null;
  let currentTotal30d: number = 0;
  let customGroqApiKey = '';

  let activeDownloads: { day: string; downloads: number }[] = [];
  let selectedBarIdx = 0;

  // Listen to Auth State
  onAuthStateListener((currentUser) => {
    user = currentUser;
    updateHeader();
  });

  function updateHeader() {
    const userLabel = user 
      ? `{yellow-fg}READER: ${user.displayName || user.email.split('@')[0]}{/yellow-fg} [L: Account]`
      : `[L: Sign In]`;
    
    const trackLabel = user 
      ? (user.watchlist?.some((p: any) => p.name.toLowerCase() === currentPkgName.toLowerCase())
          ? `{green-fg}[T: Tracked]{/green-fg}`
          : `[T: Track Package]`)
      : `[T: Sign in to track]`;

    const modeLabel = viewMode === 'portfolio' 
      ? `{magenta-fg}{bold}[Active: Portfolio]{/bold}{/magenta-fg}` 
      : `{cyan-fg}[Active: Package Report]{/cyan-fg}`;

    const simLabel = simScenario.type !== 'none'
      ? `{red-fg}[Simulated Forecast ACTIVE]{/red-fg}`
      : '';

    headerBox.setContent(
      `{center}{bold}THE DAILY NPM - TERMINAL EDITION{/bold}{/center}\n` +
      `{left}Mode: ${modeLabel} │ ${userLabel} │ ${trackLabel} ${simLabel}{/left}` +
      `{right}Inspecting: {yellow-fg}${currentPkgName.toUpperCase()}{/yellow-fg}{/right}`
    );
    screen.render();
  }

  function updateTooltip(idx: number) {
    if (!activeDownloads || activeDownloads.length === 0) return;
    const boundedIdx = Math.max(0, Math.min(idx, activeDownloads.length - 1));
    selectedBarIdx = boundedIdx;
    const item = activeDownloads[boundedIdx];

    const dateStr = item.day;
    const downloadsFormatted = item.downloads.toLocaleString();
    const isWeekend = new Date(dateStr + 'T00:00:00Z').getUTCDay() % 6 === 0;

    tooltipBox.setContent(
      `{center}{bold}DATE:{/bold} {cyan-fg}${dateStr}{/cyan-fg}  •  ` +
      `{bold}DOWNLOADS:{/bold} {yellow-fg}${downloadsFormatted}{/yellow-fg}  •  ` +
      `{bold}TYPE:{/bold} ${isWeekend ? '{magenta-fg}Weekend Dip{/magenta-fg}' : '{green-fg}Weekday Build{/green-fg}'} ` +
      `[Bar ${boundedIdx + 1} of ${activeDownloads.length}]{/center}`
    );
    screen.render();
  }

  // --- DATA LOADING & VIEW SWITCHING ---

  async function loadData(pkgName: string) {
    if (viewMode === 'portfolio') {
      await loadPortfolioData();
      return;
    }

    headerBox.setContent(
      `{center}{bold}THE DAILY NPM - TELEGRAPH WIRE{/bold}{/center}\n` +
      `{center}FETCHING WIRE DISPATCHES FOR: {yellow-fg}{bold}${pkgName}{/bold}{/yellow-fg}...{/center}`
    );
    screen.render();

    try {
      const [info, stats] = await Promise.all([
        getPackageInfo(pkgName),
        getDownloadStats(pkgName, 'last-month'),
      ]);

      // Apply growth vector simulation to downloads if active
      let downloads = stats.downloads || [];
      if (simScenario.type !== 'none') {
        downloads = downloads.map((d: any, index: number) => {
          let val = d.downloads;
          if (simScenario.type === 'flat_add') {
            val += simScenario.value * 1000;
          } else if (simScenario.type === 'compound') {
            val = Math.round(val * Math.pow(1 + simScenario.value / 100, index + 1));
          } else if (simScenario.type === 'event_shock' && index >= 14) {
            val = Math.round(val * (1 + simScenario.value / 100));
          }
          return { ...d, downloads: Math.max(0, val) };
        });
      }

      activeDownloads = downloads;
      selectedBarIdx = downloads.length - 1;

      const total30d = downloads.reduce((acc: number, d: any) => acc + d.downloads, 0);
      currentPkgInfo = info;
      currentTotal30d = total30d;
      const avgDaily = downloads.length > 0 ? Math.round(total30d / downloads.length) : 0;
      const reg = computeDownloadRegression(downloads, info.time?.created, 'seasonal_linear', 14);

      // Restore widgets standard labels and visibility
      chartBox.setLabel(' 📊 DAILY DOWNLOAD BAR CHART (←/→ TO INSPECT) ');
      overviewBox.setLabel(' 📦 PACKAGE METADATA ');
      sparklineBox.setLabel(' 📈 30D TREND ');
      aiBox.setLabel(' 🧠 AI BUREAU VERDICT ');
      donutBox.setLabel(' HEALTH ');
      dowBox.setLabel(' 📅 WEEKDAY BUILD PACING ');

      // Render Header info
      updateHeader();

      // Render Overview Box
      const gitText = info.github && info.github.stars > 0
        ? `{bold}Git Telemetry:{/bold} ★ ${info.github.stars.toLocaleString()} / ⑂ ${info.github.forks.toLocaleString()}\n`
        : '';
      const velocityText = info.releaseVelocity
        ? `{bold}Releases (12M):{/bold} ${info.releaseVelocity.releasesLastYear} (avg every ${info.releaseVelocity.avgDaysBetweenReleases}d)\n`
        : '';

      const overviewText =
        `{bold}Name:{/bold} {cyan-fg}${info.name}{/cyan-fg}\n` +
        `{bold}Latest Version:{/bold} v${info.latestVersion}\n` +
        `{bold}License:{/bold} ${info.license}\n` +
        `{bold}30D Volume:{/bold} {yellow-fg}${total30d.toLocaleString()}{/yellow-fg}\n` +
        `{bold}Daily Pace:{/bold} ${avgDaily.toLocaleString()}/day\n` +
        `{bold}Tomorrow Forecast:{/bold} {green-fg}${reg.nextDayPredictedDownloads.toLocaleString()}{/green-fg}\n` +
        `{bold}Dependencies:{/bold} ${Object.keys(info.dependencies).length} direct / ${Object.keys(info.devDependencies).length} dev\n` +
        gitText +
        velocityText +
        `{bold}Age:{/bold} ${reg.packageAgeFormatted}\n\n` +
        `{cyan-fg}${info.description.slice(0, 120)}...{/cyan-fg}`;
      overviewBox.setContent(overviewText);

      // Render Bar Chart
      const screenCols = screen.cols || 80;
      const estimatedWidth = Math.floor((7 / 12) * screenCols);
      const maxBars = Math.max(5, Math.floor((estimatedWidth - 4) / 3));
      const chartDownloads = downloads.slice(-maxBars);

      const barTitles = chartDownloads.map((d: any) => d.day.slice(8));
      const barData = chartDownloads.map((d: any) => d.downloads);

      if (barData.length > 0) {
        try {
          chartBox.setData({
            titles: barTitles,
            data: barData,
          });
        } catch (e) {
          console.error("TUI bar chart draw failed:", e);
        }
      }

      // Render Sparkline
      const fullDownloadsData = downloads.map((d: any) => d.downloads);
      (sparklineBox as any).setTrendData(fullDownloadsData, reg);

      updateTooltip(selectedBarIdx);

      // Render Weekday Pacing
      const dowShorts = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      const dowTotals = [0, 0, 0, 0, 0, 0, 0];
      const dowCounts = [0, 0, 0, 0, 0, 0, 0];

      downloads.forEach((d: any) => {
        const dow = new Date(d.day + 'T00:00:00Z').getUTCDay();
        dowTotals[dow] += d.downloads;
        dowCounts[dow]++;
      });

      let dowText = '{bold}DAY   │ AVERAGE DAILY PACING{/bold}\n─────┼─────────────────────────\n';
      dowShorts.forEach((label, idx) => {
        const avg = dowCounts[idx] > 0 ? Math.round(dowTotals[idx] / dowCounts[idx]) : 0;
        const formatted = avg >= 1_000_000 ? (avg / 1_000_000).toFixed(2) + 'M' : avg.toLocaleString();
        const isWeekend = idx === 0 || idx === 6;
        const color = isWeekend ? 'magenta-fg' : 'cyan-fg';
        dowText += `{bold}${label}{/bold}   │ {${color}}${formatted.padEnd(10)}{/${color}} ${isWeekend ? '(Weekend Dip)' : '(Peak Build)'}\n`;
      });
      dowBox.setContent(dowText);

      // Render Heuristic Analysis Verdict (algorithmic, no external API calls)
      aiBox.setContent('{yellow-fg}Running Heuristic Analysis Bureau...{/yellow-fg}');
      donutBox.setData([{ percent: 0, label: 'N/A', color: 'gray' }]);
      screen.render();

      // ── LOCAL ALGORITHMIC HEURISTICS ─────────────────────────────────────────
      // Identical scoring model to the website's heuristic fallback engine.
      let score = 70;
      if (total30d > 10000000) score += 15;
      else if (total30d > 1000000) score += 10;
      else if (total30d > 100000) score += 5;

      if (reg.packageAgeDays > 1095) score += 15;
      else if (reg.packageAgeDays > 365) score += 10;
      else if (reg.packageAgeDays > 180) score += 5;

      const depsCount = Object.keys(info.dependencies).length;
      if (depsCount > 20) score -= 10;
      else if (depsCount > 10) score -= 5;

      const healthScore = Math.min(100, Math.max(0, score));
      const scoreColor = healthScore >= 80 ? 'green' : (healthScore >= 50 ? 'yellow' : 'red');

      const pros = [
        total30d > 1000000 ? "Highly established within the JS registry registry.npmjs.org." : "Focussed library catering to niche target setups.",
        depsCount <= 5 ? "Minimal direct package dependencies, reducing dependency bloat." : "Feature-rich API offering comprehensive tooling in a single package.",
        reg.packageAgeDays > 730 ? "Proven historical stability over years of ecosystem existence." : "Modern, fresh approach to solving developer pain points."
      ];
      const cons = [
        depsCount > 15 ? "Heavy dependency graph requires meticulous security auditing." : "Requires careful major version tracking for API drift.",
        "Verify project compatibility and bundler configuration limits before production use."
      ];

      let verdict = "MODEST ADOPTION. MONITOR FOR UNSTABLE UPGRADES AND HEURISTICS.";
      if (healthScore >= 90) {
        verdict = depsCount <= 3
          ? "EXCELLENT STANDING. HIGHLY RECOMMENDED FOR GENERAL INTEGRATION."
          : "STRONG ARCHITECTURE. PROCEED WITH SOLID ECOSYSTEM BACKING.";
      } else if (healthScore >= 75) {
        verdict = reg.packageAgeDays < 180
          ? "MODERN DESIGN WITH VIGOROUS TRACTION. SUITABLE FOR PRODUCTION WITH ATTENTIVE PINNING."
          : "STABLE WORKHORSE. WORTHY OF STANDARD DEPLOYMENTS.";
      } else if (healthScore >= 50) {
        if (depsCount > 15) {
          verdict = "CAUTION ADVISEMENT. HEAVY DEPENDENCY TREE REQUIRES DILIGENT AUDITING.";
        }
      } else {
        verdict = "HIGH RISK RATING. DEPRECATED OR UNMAINTAINED TELEMETRY DETECTED.";
      }

      const escapedVerdict = verdict.replace(/{/g, '{|').replace(/}/g, '|}');
      const aiText =
        `{bold}Verdict:{/bold} {cyan-fg}${escapedVerdict}{/cyan-fg}\n` +
        `{bold}Pros:{/bold} ${pros.join(', ')}\n` +
        `{bold}Cons:{/bold} ${cons.join(', ')}`;
      aiBox.setContent(aiText);

      try {
        donutBox.setData([{
          percent: healthScore,
          label: 'SCORE',
          color: scoreColor,
        }]);
      } catch (e) {}
      screen.render();

    } catch (err: any) {
      headerBox.setContent(
        `{center}{bold}THE DAILY NPM - TELEGRAPH WIRE{/bold}{/center}\n` +
        `{center}{red-fg}ERROR FETCHING DISPATCH: ${pkgName.toUpperCase()}{/red-fg}{/center}`
      );
      overviewBox.setContent(`{red-fg}Error fetching data for ${pkgName}:\n\n${err.message}{/red-fg}`);
      chartBox.setData({ titles: ['Error'], data: [0] });
      
      const emptyReg = computeDownloadRegression([{day: 'error', downloads: 0}], undefined, 'seasonal_linear', 7);
      (sparklineBox as any).setTrendData([0], emptyReg);
      
      dowBox.setContent('{red-fg}Data calculation halted.{/red-fg}');
      aiBox.setContent(`{red-fg}Analysis halted due to fetch error.{/red-fg}`);
      donutBox.setData([{ percent: 0, label: 'Err', color: 'red' }]);
      tooltipBox.setContent('');
    }

    screen.render();
  }

  // --- DOW NPM PORTFOLIO VIEW LOGIC ---

  async function loadPortfolioData() {
    if (!user) {
      viewMode = 'package';
      updateHeader();
      loadData(currentPkgName);
      return;
    }

    // Set layout labels for Portfolio View context
    chartBox.setLabel(' 📊 DOW NPM INDEX (AGGREGATED WATCHLIST DOWNLOADS) ');
    overviewBox.setLabel(' 📰 THE WATCHLIST GAZETTE (EDITORIAL WIRE) ');
    sparklineBox.setLabel(' 📈 PORTFOLIO METRICS ');
    aiBox.setLabel(' 🛡️ ACTIVE ALERTS & WATCHLIST ');
    donutBox.setLabel(' HEALTH ');
    dowBox.setLabel(' 🕒 WATCHLIST METADATA ');

    overviewBox.setContent('{yellow-fg}Fetching aggregated dispatches for your watchlist...{/yellow-fg}');
    screen.render();

    const list = user.watchlist || [];
    if (list.length === 0) {
      overviewBox.setContent(
        `{center}{bold}PORTFOLIO WATCHLIST IS EMPTY{/bold}{/center}\n\n` +
        `Search for packages (press [S]) and toggle tracking (press [T]) to add them to your portfolio watchlist.`
      );
      chartBox.setData({ titles: ['Empty'], data: [0] });
      sparklineBox.setContent('{center}No active tracked positions.{/center}');
      aiBox.setContent('No assets monitored.');
      donutBox.setData([{ percent: 0, label: 'N/A', color: 'gray' }]);
      screen.render();
      return;
    }

    try {
      // Load details for all tracked items
      const loadedDetails = await Promise.all(
        list.map(async (p: any) => {
          try {
            const [meta, dl] = await Promise.all([
              getPackageInfo(p.name),
              getDownloadStats(p.name, 'last-month')
            ]);
            const downloads = dl.downloads || [];
            
            let weeklyChange = 0;
            let currentDownloads = 0;
            if (downloads.length >= 14) {
              const sortedDls = [...downloads].sort((a: any, b: any) => a.day.localeCompare(b.day));
              const last7 = sortedDls.slice(-7).reduce((acc: number, d: any) => acc + d.downloads, 0);
              const prev7 = sortedDls.slice(-14, -7).reduce((acc: number, d: any) => acc + d.downloads, 0);
              currentDownloads = last7;
              weeklyChange = prev7 > 0 ? ((last7 - prev7) / prev7) * 100 : 0;
            }

            return {
              name: p.name,
              version: meta.latestVersion,
              description: meta.description,
              weeklyChange: Math.round(weeklyChange * 10) / 10,
              currentDownloads,
              downloads,
              stars: meta.github?.stars || 0,
              alertThreshold: p.alertThreshold
            };
          } catch (e) {
            return null;
          }
        })
      );

      const validDetails = loadedDetails.filter(d => d !== null) as any[];

      // Aggregate day-by-day downloads
      const dayMap: Record<string, number> = {};
      validDetails.forEach(item => {
        item.downloads.forEach((d: any) => {
          dayMap[d.day] = (dayMap[d.day] || 0) + d.downloads;
        });
      });

      const aggregated = Object.entries(dayMap).map(([day, downloads]) => ({
        day,
        downloads
      })).sort((a, b) => a.day.localeCompare(b.day));

      activeDownloads = aggregated;
      selectedBarIdx = aggregated.length - 1;

      // Overall portfolio calculations
      const totalVolume = aggregated.reduce((acc, pt) => acc + pt.downloads, 0);
      let combinedWeeklyChange = 0;
      if (aggregated.length >= 14) {
        const last7 = aggregated.slice(-7).reduce((acc, d) => acc + d.downloads, 0);
        const prev7 = aggregated.slice(-14, -7).reduce((acc, d) => acc + d.downloads, 0);
        combinedWeeklyChange = prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100 * 10) / 10 : 0;
      }

      // Render aggregate chart
      const screenCols = screen.cols || 80;
      const estimatedWidth = Math.floor((7 / 12) * screenCols);
      const maxBars = Math.max(5, Math.floor((estimatedWidth - 4) / 3));
      const chartDownloads = aggregated.slice(-maxBars);

      const barTitles = chartDownloads.map((d: any) => d.day.slice(8));
      const barData = chartDownloads.map((d: any) => d.downloads);

      if (barData.length > 0) {
        chartBox.setData({ titles: barTitles, data: barData });
      }

      // Render Portfolio stats
      const changeColor = combinedWeeklyChange >= 0 ? 'green-fg' : 'red-fg';
      const changeIcon = combinedWeeklyChange >= 0 ? '▲' : '▼';
      sparklineBox.setContent(
        `\n` +
        `{center}{bold}DOW NPM PORTFOLIO INDEX{/bold}{/center}\n` +
        `{center}{yellow-fg}30D Volume: ${totalVolume.toLocaleString()}{/yellow-fg}{/center}\n` +
        `{center}{${changeColor}}Weekly WoW: ${changeIcon}${combinedWeeklyChange}%{/${changeColor}}{/center}\n` +
        `{center}{cyan-fg}Tracked Assets: ${validDetails.length}{/cyan-fg}{/center}`
      );

      // Render Watchlist Gazette (editorial dispatches)
      let gazetteText = '';
      if (validDetails.length > 0) {
        const marketDirection = combinedWeeklyChange >= 0 ? "BULLISH SURGE" : "BEARISH SHIFT";
        gazetteText += 
          `{center}{bold}DOW NPM DISPATCH{/bold} │ WoW: {${changeColor}}${combinedWeeklyChange}%{/${changeColor}}{/center}\n` +
          `The combined NPM index recorded a ${marketDirection} to close at ${totalVolume.toLocaleString()} total weekly downloads. Analysts note steady builder activity.\n\n`;

        const topPerformer = [...validDetails].sort((a, b) => b.weeklyChange - a.weeklyChange)[0];
        if (topPerformer && topPerformer.weeklyChange > 0) {
          gazetteText += 
            `{center}{bold}SPOTLIGHT: ${topPerformer.name.toUpperCase()} LEADS MARKET{/bold}{/center}\n` +
            `${topPerformer.name} captured substantial attention, spiking ${topPerformer.weeklyChange}% WoW. It is currently operating version v${topPerformer.version}.\n\n`;
        }

        const declining = validDetails.filter(d => d.weeklyChange < 0);
        if (declining.length > 0) {
          const worst = [...declining].sort((a, b) => a.weeklyChange - b.weeklyChange)[0];
          gazetteText += 
            `{center}{bold}RISK WIRE: ${worst.name.toUpperCase()} VOLUME DECELERATING{/bold}{/center}\n` +
            `Downloads for the position ${worst.name} dropped by ${Math.abs(worst.weeklyChange)}% below standard baseline predictions.`;
        } else {
          gazetteText += 
            `{center}{bold}ENVIRONMENTAL REPORT: MARKET STABLE{/bold}{/center}\n` +
            `Ecosystem weather remains uniform. Minimal drops detected across the watchlist.`;
        }
      }
      overviewBox.setContent(gazetteText);

      // Render Watchlist & Active Alerts box
      let alertsText = '{bold}ASSET      │ WoW % │ ALERTS ACTIVE{/bold}\n───────────┼───────┼────────────────\n';
      let totalAlertsCount = 0;
      validDetails.forEach(item => {
        let alertTriggered = false;
        let alertDesc = 'Stable';
        
        // 1. legacy threshold check
        if (item.weeklyChange < -item.alertThreshold) {
          alertTriggered = true;
          alertDesc = `WoW Drop > ${item.alertThreshold}%`;
        }

        const ruleColor = alertTriggered ? 'red-fg' : 'green-fg';
        const changeValColor = item.weeklyChange >= 0 ? 'green-fg' : 'red-fg';
        const changeStr = `${item.weeklyChange >= 0 ? '+' : ''}${item.weeklyChange}%`;
        alertsText += `{bold}${item.name.padEnd(10).slice(0, 10)}{/bold} │ {${changeValColor}}${changeStr.padEnd(5)}{/${changeValColor}} │ {${ruleColor}}${alertDesc}{/${ruleColor}}\n`;
        
        if (alertTriggered) totalAlertsCount++;
      });
      aiBox.setContent(alertsText);

      // Set health score based on alerts
      const baseHealth = Math.max(10, 100 - (totalAlertsCount * 25));
      const donutColor = baseHealth >= 80 ? 'green' : (baseHealth >= 50 ? 'yellow' : 'red');
      try {
        donutBox.setData([{
          percent: baseHealth,
          label: 'HEALTH',
          color: donutColor
        }]);
      } catch (e) {}

      // Watchlist Metadata
      let metaListText = '{bold}Watchlist Registry:{/bold}\n';
      validDetails.forEach(item => {
        metaListText += `• {cyan-fg}${item.name}{/cyan-fg} (v${item.version}) │ Stars: ${item.stars.toLocaleString()}\n`;
      });
      dowBox.setContent(metaListText);

      updateTooltip(selectedBarIdx);

    } catch (err: any) {
      overviewBox.setContent(`{red-fg}Failed to load portfolio statistics:\n\n${err.message}{/red-fg}`);
    }

    screen.render();
  }

  // --- KEYBOARD & PROMPT INTERACTIONS ---

  // Keyboard Navigation to Inspect Downloads
  screen.key(['left'], () => {
    if (selectedBarIdx > 0) {
      updateTooltip(selectedBarIdx - 1);
    }
  });

  screen.key(['right'], () => {
    if (selectedBarIdx < activeDownloads.length - 1) {
      updateTooltip(selectedBarIdx + 1);
    }
  });

  // Scroll AI Verdict
  screen.key(['up'], () => {
    aiBox.scroll(-1);
    screen.render();
  });

  screen.key(['down'], () => {
    aiBox.scroll(1);
    screen.render();
  });

  // Quit
  screen.key(['q', 'C-c'], () => process.exit(0));

  // Refresh
  screen.key(['r'], () => {
    if (viewMode === 'portfolio') {
      loadPortfolioData();
    } else {
      loadData(currentPkgName);
    }
  });

  // Search Package
  screen.key(['s'], () => {
    searchPrompt.input('Enter NPM package name:', '', (err, value) => {
      if (value && value.trim()) {
        currentPkgName = value.trim().toLowerCase();
        viewMode = 'package';
        loadData(currentPkgName);
      }
    });
  });

  // Configure API Key
  screen.key(['m'], () => {
    apiKeyPrompt.input('Enter GROQ_API_KEY (leave empty to use local algorithm):', customGroqApiKey, (err, value) => {
      if (value !== null) {
        customGroqApiKey = value.trim();
        if (customGroqApiKey) {
          process.env.GROQ_API_KEY = customGroqApiKey;
        }
      }
      screen.render();
    });
  });

  // AI Chat
  screen.key(['c'], () => {
    chatPrompt.input('Ask a question about this package:', '', async (err, value) => {
      if (value && value.trim()) {
        const userQ = value.trim();
        aiBox.setContent(aiBox.getContent() + `\n\n{cyan-fg}User: ${userQ}{/cyan-fg}`);
        aiBox.setScrollPerc(100);
        screen.render();

        try {
          // Always use the local heuristic search engine (no external API calls)
          aiBox.setLabel(` 🧠 HEURISTIC BUREAU (Thinking...) `);
          screen.render();
          let response = getLocalAnswer(userQ, currentPkgInfo, currentTotal30d);
          aiBox.setLabel(` 🧠 AI BUREAU VERDICT `);
          const escapedResponse = response.replace(/{/g, '{|').replace(/}/g, '|}');
          aiBox.setContent(aiBox.getContent() + `\n{magenta-fg}AI: ${escapedResponse}{/magenta-fg}`);
          aiBox.setScrollPerc(100);
          screen.render();
        } catch (e: any) {
          aiBox.setLabel(` 🧠 AI BUREAU VERDICT `);
          aiBox.setContent(aiBox.getContent() + `\n{red-fg}Error: ${e.message}{/red-fg}`);
          aiBox.setScrollPerc(100);
          screen.render();
        }
      }
    });
  });

  // Toggle view mode (Package Report vs Portfolio Index)
  screen.key(['p'], () => {
    if (!user) {
      emailPrompt.input('Sign in to view portfolio. Enter Email:', '', (err, email) => {
        if (email && email.trim()) {
          passwordPrompt.input('Enter Password:', '', async (err2, password) => {
            if (password) {
              headerBox.setContent('{center}Authenticating reader...{/center}');
              screen.render();
              try {
                const authenticatedUser = await signInUser(email.trim(), password);
                user = authenticatedUser;
                viewMode = 'portfolio';
                await loadPortfolioData();
              } catch (e: any) {
                headerBox.setContent(`{center}{red-fg}Auth failed: ${e.message}{/red-fg}{/center}`);
                screen.render();
                setTimeout(() => updateHeader(), 2000);
              }
            }
          });
        }
      });
      return;
    }

    viewMode = viewMode === 'package' ? 'portfolio' : 'package';
    updateHeader();
    if (viewMode === 'portfolio') {
      loadPortfolioData();
    } else {
      loadData(currentPkgName);
    }
  });

  // Login / Account Settings
  screen.key(['l'], () => {
    if (user) {
      // Logged in: show profile box and offer sign out
      const msg = `Logged in as: ${user.displayName || user.email}\n` +
                  `Watchlist size: ${user.watchlist?.length || 0} packages\n\n` +
                  `Press [S] to Sign Out, [C] to Cancel.`;
      
      const confirmBox = blessed.box({
        parent: screen,
        border: 'line',
        height: 8,
        width: 'half',
        top: 'center',
        left: 'center',
        label: ' Reader Account ',
        content: msg,
        tags: true,
        style: { border: { fg: 'yellow' }, label: { fg: 'yellow', bold: true } },
      });
      confirmBox.focus();
      screen.render();

      const handleKey = (ch: string, key: any) => {
        if (key.name === 's') {
          signOutUser().then(() => {
            user = null;
            viewMode = 'package';
            confirmBox.destroy();
            updateHeader();
            loadData(currentPkgName);
          });
        } else if (key.name === 'c' || key.name === 'escape') {
          confirmBox.destroy();
          screen.render();
        }
      };
      confirmBox.on('keypress', handleKey);
      return;
    }

    // Guest: prompt to Sign In or Sign Up
    emailPrompt.input('Enter Email Address:', '', (err, email) => {
      if (email && email.trim()) {
        passwordPrompt.input('Enter Password:', '', async (err2, password) => {
          if (password) {
            headerBox.setContent('{center}Transmitting login telegram...{/center}');
            screen.render();
            try {
              const authenticatedUser = await signInUser(email.trim(), password);
              user = authenticatedUser;
              updateHeader();
              loadData(currentPkgName);
            } catch (e: any) {
              // Sign in failed, prompt to sign up instead
              const signUpConfirm = blessed.prompt({
                parent: screen,
                border: 'line',
                height: 7,
                width: 'half',
                top: 'center',
                left: 'center',
                label: ' Account Not Found ',
                tags: true,
                style: { border: { fg: 'red' } }
              });
              signUpConfirm.input('Create new account with these credentials? (y/n):', '', async (err3, confirmText) => {
                if (confirmText && confirmText.trim().toLowerCase() === 'y') {
                  headerBox.setContent('{center}Creating reader profile...{/center}');
                  screen.render();
                  try {
                    const newUser = await signUpUser(email.trim(), password);
                    user = newUser;
                    updateHeader();
                    loadData(currentPkgName);
                  } catch (signUpErr: any) {
                    headerBox.setContent(`{center}{red-fg}Registration failed: ${signUpErr.message}{/red-fg}{/center}`);
                    screen.render();
                    setTimeout(() => updateHeader(), 2000);
                  }
                } else {
                  updateHeader();
                  loadData(currentPkgName);
                }
              });
            }
          }
        });
      }
    });
  });

  // Toggle Track Package for logged in user
  screen.key(['t'], async () => {
    if (!user) {
      headerBox.setContent('{center}{red-fg}Sign in using [L] first to track assets{/red-fg}{/center}');
      screen.render();
      setTimeout(() => updateHeader(), 2000);
      return;
    }

    try {
      const lowerName = currentPkgName.toLowerCase();
      const isCurrentlyTracked = user.watchlist?.some((p: any) => p.name.toLowerCase() === lowerName);
      
      let updatedWatchlist;
      if (isCurrentlyTracked) {
        updatedWatchlist = await untrackPackage(user.uid, currentPkgName);
        headerBox.setContent(`{center}Untracked asset: ${currentPkgName}{/center}`);
      } else {
        updatedWatchlist = await trackPackage(user.uid, currentPkgName, 15);
        headerBox.setContent(`{center}{green-fg}Tracking asset: ${currentPkgName}{/green-fg}{/center}`);
      }
      
      user.watchlist = updatedWatchlist;
      updateHeader();
      screen.render();
      setTimeout(() => updateHeader(), 2000);
    } catch (e: any) {
      headerBox.setContent(`{center}{red-fg}Tracking failed: ${e.message}{/red-fg}{/center}`);
      screen.render();
      setTimeout(() => updateHeader(), 2000);
    }
  });

  // Forecast Simulation prompt modal
  screen.key(['u'], () => {
    const scenariosText = 
      'Select Simulation Growth Scenario:\n' +
      '1) Flat Boost (+100k downloads/day)\n' +
      '2) Compounding Daily Growth (+2% daily)\n' +
      '3) Sudden Negative Shock (-30% drop starting day 14)\n' +
      '4) None (Reset Baseline)\n' +
      'Enter selection (1-4):';
    
    simPrompt.input(scenariosText, '', (err, value) => {
      if (value) {
        const sel = value.trim();
        if (sel === '1') {
          simScenario = { type: 'flat_add', value: 100 };
        } else if (sel === '2') {
          simScenario = { type: 'compound', value: 2 };
        } else if (sel === '3') {
          simScenario = { type: 'event_shock', value: -30 };
        } else {
          simScenario = { type: 'none', value: 0 };
        }
        updateHeader();
        loadData(currentPkgName);
      }
    });
  });

  // Dependency Tree Modal Trigger
  screen.key(['d'], async () => {
    const loadingBox = blessed.box({
      parent: screen,
      border: 'line',
      height: 5,
      width: 40,
      top: 'center',
      left: 'center',
      label: ' Resolving ',
      content: '\n   ⏳  RESOLVING DEPENDENCY TREE...',
      tags: true,
      style: {
        border: { fg: 'yellow' },
        label: { fg: 'yellow', bold: true },
        bg: 'black',
      },
    });
    screen.render();

    try {
      const treeLines = await buildAsciiTree(currentPkgName);
      loadingBox.destroy();

      const treeBox = blessed.box({
        parent: screen,
        border: 'line',
        height: 'shrink',
        maxHeight: 25,
        width: 60,
        top: 'center',
        left: 'center',
        label: ` Dependency Classifieds: ${currentPkgName} `,
        content: treeLines.join('\n') + '\n\n   {bold}Press [C] or [Escape] to Close{/bold}',
        tags: true,
        scrollable: true,
        alwaysScroll: true,
        keys: true,
        style: {
          border: { fg: 'yellow' },
          label: { fg: 'yellow', bold: true },
          bg: 'black',
        },
      });
      treeBox.focus();
      screen.render();

      const handleKey = (ch: string, key: any) => {
        if (key.name === 'c' || key.name === 'escape') {
          treeBox.destroy();
          screen.render();
        }
      };
      treeBox.on('keypress', handleKey);
    } catch (err: any) {
      loadingBox.destroy();
      const errBox = blessed.box({
        parent: screen,
        border: 'line',
        height: 6,
        width: 40,
        top: 'center',
        left: 'center',
        label: ' Error ',
        content: `\n{red-fg}Failed to fetch tree:{/red-fg}\n${err.message || err}\n\nPress any key to close`,
        tags: true,
        style: {
          border: { fg: 'red' },
          label: { fg: 'red', bold: true },
          bg: 'black',
        },
      });
      screen.render();
      errBox.once('keypress', () => {
        errBox.destroy();
        screen.render();
      });
    }
  });

  // ASCII Splash Screen Modal Box
  const splashBox = blessed.box({
    parent: screen,
    border: 'line',
    height: 'shrink',
    width: 'shrink',
    top: 'center',
    left: 'center',
    label: ' 📰 THE DAILY NPM - SPECIAL EDITION ',
    tags: true,
    hidden: true,
    style: {
      border: { fg: 'yellow' },
      label: { fg: 'yellow', bold: true },
      bg: 'black',
    },
  });

  const asciiArt = 
    `\n` +
    `{center}{yellow-fg}{bold}DAILY.NPM{/bold}{/yellow-fg}{/center}\n\n` +
    `{center}{cyan-fg}The World's Preeminent Journal of Package Intelligence & Node Statistics{/cyan-fg}{/center}\n\n\n` +
    `{center}Press {bold}any key{/bold} to return to the Wire Dispatches...{/center}`;

  splashBox.setContent(asciiArt);

  // ASCII Splash Screen Toggle
  screen.key(['escape'], () => {
    if (splashBox.hidden) {
      splashBox.show();
      splashBox.focus();
    } else {
      splashBox.hide();
    }
    screen.render();
  });

  splashBox.on('element keypress', () => {
    splashBox.hide();
    screen.render();
  });

  splashBox.on('keypress', () => {
    splashBox.hide();
    screen.render();
  });

  // Initial Load
  loadData(currentPkgName);
}
