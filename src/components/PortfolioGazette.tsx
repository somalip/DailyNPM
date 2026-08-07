import React from 'react';
import { Newspaper, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';

interface PortfolioGazetteProps {
  liveDataList: any[];
  overallWeeklyChange: number;
  overallVolume: number;
}

export const PortfolioGazette: React.FC<PortfolioGazetteProps> = ({
  liveDataList,
  overallWeeklyChange,
  overallVolume,
}) => {

  const generateArticles = () => {
    if (liveDataList.length === 0) return [];

    const articles = [];

    // Article 1: Market Indices & General Sentiment
    const marketDirection = overallWeeklyChange >= 0 ? "BULLISH SURGE" : "BEARISH DIP";
    const marketText = `In a week of significant trading activity, the reader's combined portfolio index recorded a ${marketDirection}, moving by ${Math.abs(overallWeeklyChange)}% to close at a weekly volume of ${overallVolume.toLocaleString()} total downloads. Staff analysts suggest that the index remains highly responsive to developer activity.`;
    
    articles.push({
      headline: `DOW NPM INDEX REPORTS ${marketDirection}: PORTFOLIO SHIFTS ${overallWeeklyChange >= 0 ? '+' : ''}${overallWeeklyChange}%`,
      subhead: `Combined wire dispatches record a weekly volume of ${overallVolume.toLocaleString()} downloads.`,
      content: marketText,
      tag: "FINANCIAL WIRE"
    });

    // Article 2: Top Performer
    const validPerformers = liveDataList.filter(d => !d.loading && !d.error && d.metadata);
    if (validPerformers.length > 0) {
      const topPerformer = [...validPerformers].sort((a, b) => b.weeklyChange - a.weeklyChange)[0];
      if (topPerformer && topPerformer.weeklyChange > 0) {
        articles.push({
          headline: `DISPATCH: ${topPerformer.package.name.toUpperCase()} OUTPACES MARKET ESTIMATES`,
          subhead: `${topPerformer.package.name} records a massive ${topPerformer.weeklyChange}% volume spike.`,
          content: `Staff reporters located in the NPM Registry offices confirm that ${topPerformer.package.name} has captured substantial developer attention this week. Standard regression models predicted a standard linear baseline, but final metrics surpassed expectation. The package is running version ${topPerformer.metadata?.latestVersion} with high strength scores.`,
          tag: "MARKET BULLETIN"
        });
      }
    }

    // Article 3: Stability & Risk Warning
    const decliningPerformers = validPerformers.filter(d => d.weeklyChange < 0);
    if (decliningPerformers.length > 0) {
      const worstPerformer = [...decliningPerformers].sort((a, b) => a.weeklyChange - b.weeklyChange)[0];
      articles.push({
        headline: `SECURITY WARNING: CONCERN RISES AS ${worstPerformer.package.name.toUpperCase()} VELOCITY DECREASES`,
        subhead: `Download volumes drop by ${Math.abs(worstPerformer.weeklyChange)}% WoW.`,
        content: `Independent investigators have noted a download deceleration for the asset ${worstPerformer.package.name}. A drop of ${Math.abs(worstPerformer.weeklyChange)}% below standard weekly estimates indicates a shift in ecosystem preferences. Portfolio rule-guards have triggered active warnings to all readers monitoring this position.`,
        tag: "RISK WIRE"
      });
    } else {
      // General Stability article if nothing is declining
      articles.push({
        headline: "ECOSYSTEM WEATHER REPORT: CALM SEAS AND UNIFORM STABILITY",
        subhead: "No significant download drops reported across tracked assets.",
        content: "Standard checks confirm that all assets on the reader's watchlist are performing in line with seasonal trends. Linear models report steady, uninterrupted adoption with standard weekend dips acting as the only deviation.",
        tag: "CLIMATE REPORT"
      });
    }

    // Article 4: Release Velocity Bulletins
    const sortedByRelease = [...validPerformers].sort((a, b) => {
      const dateA = a.metadata?.time?.latest ? new Date(a.metadata.time.latest).getTime() : 0;
      const dateB = b.metadata?.time?.latest ? new Date(b.metadata.time.latest).getTime() : 0;
      return dateB - dateA;
    });

    if (sortedByRelease.length > 0 && sortedByRelease[0].metadata?.time?.latest) {
      const newestRelease = sortedByRelease[0];
      const dateStr = new Date(newestRelease.metadata.time.latest).toLocaleDateString();
      articles.push({
        headline: `LATEST REVISIONS: ${newestRelease.package.name.toUpperCase()} SHIPS UPDATE v${newestRelease.metadata.latestVersion}`,
        subhead: `Registry updates registered on ${dateStr}.`,
        content: `A new version release of ${newestRelease.package.name} has crossed the wire dispatches. Release velocity calculations show steady revision patterns, marking this as a crucial update for production operations. Users are advised to review the dependencies payload in the market inspector.`,
        tag: "TELEGRAM GAZETTE"
      });
    }

    return articles;
  };

  const articles = generateArticles();

  return (
    <div className="space-y-6 font-body-news text-[#1A1918]">
      {/* Newspaper header section */}
      <div className="text-center py-4 border-b-2 border-t-2 border-[#1A1918]">
        <div className="flex items-center justify-center gap-2">
          <Newspaper className="w-5 h-5 text-[#A82424]" />
          <h3 className="font-masthead text-3xl font-extrabold tracking-tight uppercase">
            THE WATCHLIST GAZETTE
          </h3>
        </div>
        <p className="text-[10px] font-mono-news uppercase text-[#4A4744] mt-0.5 tracking-wider">
          PERSONALIZED WIRE REVIEWS FOR USER PROFILE • PRINTED ON DEMAND
        </p>
      </div>

      {articles.length === 0 ? (
        <p className="text-xs font-mono-news text-center text-[#4A4744] py-8">
          [WAITING ON TELEGRAMS: Add packages to your watchlist to generate the Gazette]
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 divide-y md:divide-y-0 md:divide-x divide-dashed divide-[#1A1918]/30">
          {articles.map((art, idx) => (
            <div key={idx} className={`space-y-3 pt-6 md:pt-0 ${idx > 0 ? 'md:pl-6' : ''}`}>
              <div className="flex justify-between items-center text-[9px] font-mono-news font-bold text-[#A82424] uppercase border-b border-[#1A1918]/10 pb-1">
                <span>{art.tag}</span>
                <span>• WIRE #00{idx + 1}</span>
              </div>
              <h4 className="font-headline text-lg sm:text-xl font-bold uppercase tracking-tight leading-tight hover:underline cursor-pointer">
                {art.headline}
              </h4>
              <p className="text-xs font-semibold italic text-[#4A4744] leading-snug">
                "{art.subhead}"
              </p>
              <p className="text-xs text-justify leading-relaxed text-[#1A1918] font-serif pr-1">
                {art.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
