import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, RefreshCw, MessageSquare, Trash2, ArrowUpRight } from 'lucide-react';
import { requestTieredLlmClient } from '../utils/npmApi';

interface AIChatCardProps {
  packageName: string;
  description: string;
  totalDownloads: number;
  version: string;
  dependenciesCount: number;
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

const PRESETS = [
  "What are the primary use cases for this package?",
  "Are there any known security issues or architectural bloat?",
  "Show me a simple code example using this package.",
];

export const AIChatCard: React.FC<AIChatCardProps> = ({
  packageName,
  description,
  totalDownloads,
  version,
  dependenciesCount,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

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

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    setError(null);
    setLoading(true);

    const userMessage: ChatMessage = { role: 'user', text: textToSend };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');

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
                <div className="font-body-news text-xs whitespace-pre-line leading-relaxed text-[#1a1918]">
                  {msg.text}
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
