import React from 'react';
import { AIInsights } from '../types';
import { ShieldCheck, CheckCircle2, AlertTriangle, Award, PenTool } from 'lucide-react';

interface AIHealthCardProps {
  insights: AIInsights | null;
  loading: boolean;
  packageName: string;
}

export const AIHealthCard: React.FC<AIHealthCardProps> = ({
  insights,
  loading,
  packageName,
}) => {
  if (loading) {
    return (
      <div className="newspaper-card p-6 space-y-4 animate-pulse">
        <div className="h-6 w-48 bg-[#EAE6DF] border border-[#1A1918]" />
        <div className="h-20 bg-[#EAE6DF] border border-[#1A1918]" />
      </div>
    );
  }

  if (!insights) return null;

  return (
    <div className="newspaper-card p-6 text-[#1A1918] space-y-5 relative overflow-hidden">
      
      {/* Editorial Header */}
      <div className="flex items-center justify-between pb-3 border-b-2 border-[#1A1918]">
        <div className="flex items-center gap-2">
          <div className="bg-[#1A1918] text-white p-1.5 shrink-0">
            <PenTool className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="font-headline text-xl font-bold uppercase tracking-tight">
              Editorial & Opinion: AI Analyst Bureau
            </h3>
            <p className="text-xs font-mono-news text-[#4A4744] mt-0.5">
              Independent architectural appraisal, ecosystem standing, and trade-off assessment
            </p>
          </div>
        </div>

        {/* Vintage Wax Stamp Score */}
        <div className="flex items-center gap-2 bg-[#EAE6DF] border-2 border-[#1A1918] px-3 py-1.5 shadow-[2px_2px_0px_#1A1918]">
          <Award className="w-4 h-4 text-[#A82424]" />
          <span className="text-base font-mono-news font-extrabold text-[#1A1918]">{insights.healthScore}/100</span>
          <span className="text-[9px] font-mono-news text-[#1A1918] uppercase font-bold">GRADE</span>
        </div>
      </div>

      {/* Summary Editorial Column */}
      <div className="bg-[#EAE6DF] p-4 border-2 border-[#1A1918] text-xs text-[#1A1918] leading-relaxed shadow-[2px_2px_0px_#1A1918]">
        <div className="flex items-center gap-1.5 font-mono-news text-xs font-bold uppercase text-[#A82424] mb-1 border-b border-[#1A1918]/20 pb-1">
          <span>CRITIC'S SUMMARY & SYNOPSIS</span>
        </div>
        <p className="font-body-news text-sm leading-relaxed text-[#1A1918]">{insights.summary}</p>
      </div>

      {/* Pros & Cons Editorial Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono-news">
        
        {/* Key Strengths */}
        <div className="bg-[#EAE6DF] border-2 border-[#1A1918] p-4 space-y-2 shadow-[2px_2px_0px_#1A1918]">
          <span className="font-bold text-[#1A1918] flex items-center gap-1.5 uppercase text-xs border-b border-[#1A1918]/20 pb-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-800" /> KEY ADVANTAGES
          </span>
          <ul className="space-y-2 text-[#1A1918] pt-1 font-body-news text-xs">
            {insights.pros.map((pro, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="font-bold text-emerald-800 text-sm">✓</span>
                <span className="leading-snug">{pro}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Potential Trade-offs */}
        <div className="bg-[#EAE6DF] border-2 border-[#1A1918] p-4 space-y-2 shadow-[2px_2px_0px_#1A1918]">
          <span className="font-bold text-[#1A1918] flex items-center gap-1.5 uppercase text-xs border-b border-[#1A1918]/20 pb-1">
            <AlertTriangle className="w-4 h-4 text-[#A82424]" /> EDITORIAL CAUTIONS
          </span>
          <ul className="space-y-2 text-[#1A1918] pt-1 font-body-news text-xs">
            {insights.cons.map((con, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="font-bold text-[#A82424] text-sm">✗</span>
                <span className="leading-snug">{con}</span>
              </li>
            ))}
          </ul>
        </div>

      </div>

      {/* Editorial Recommendation Line */}
      <div className="pt-3 border-t-2 border-[#1A1918] flex items-center justify-between font-mono-news text-xs text-[#1A1918]">
        <span className="font-body-news italic">Editorial Verdict: <strong className="font-bold not-italic text-[#A82424] underline">{insights.verdict}</strong></span>
        {insights.aiGenerated && (
          <span className="text-[10px] bg-[#1A1918] text-white px-2 py-0.5 font-bold uppercase">
            GEMINI AI VERIFIED
          </span>
        )}
      </div>
    </div>
  );
};
