import React, { useState } from 'react';
import { X, Mail, Lock, User, RefreshCw, AlertTriangle } from 'lucide-react';
import { signInUser, signUpUser, isSimulationMode } from '../services/firebase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: any) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onAuthSuccess }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let user;
      if (isSignUp) {
        user = await signUpUser(email, password, displayName);
      } else {
        user = await signInUser(email, password);
      }
      onAuthSuccess(user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A1918]/60 backdrop-blur-xs font-body-news">
      <div className="relative w-full max-w-md bg-[#F4F1EA] border-4 border-[#1A1918] shadow-[8px_8px_0px_#1A1918] p-6 text-[#1A1918]">
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-1 border-2 border-transparent hover:border-[#1A1918] bg-[#EAE6DF] hover:bg-[#A82424] hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Newspaper Masthead Tag */}
        <div className="text-center pb-4 mb-4 border-b-2 border-dashed border-[#1A1918]">
          <span className="font-mono-news text-[10px] font-bold uppercase tracking-wider text-[#A82424]">
            {isSimulationMode ? '• SIMULATION MODE ACTIVE •' : '• SECURE CLOUD AUTHENTICATION •'}
          </span>
          <h2 className="font-headline text-3xl font-extrabold tracking-tight uppercase mt-1">
            {isSignUp ? 'REGISTER ACCOUNT' : 'READER LOGIN'}
          </h2>
          <p className="text-xs italic text-[#4A4744] mt-0.5">
            "Subscribe to personalized package dispatches and portfolio analysis"
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-[#EAE6DF] border-2 border-[#A82424] text-xs font-mono-news flex gap-2 items-start text-[#A82424]">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">TELEGRAM ERROR:</span> {error}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 font-mono-news text-xs">
          {isSignUp && (
            <div>
              <label className="block font-bold uppercase mb-1">Display Name</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1A1918]/60">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Editor-in-Chief"
                  className="w-full bg-[#FBF9F5] border-2 border-[#1A1918] py-2 pl-10 pr-3 focus:outline-none focus:bg-white"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block font-bold uppercase mb-1">Email Address</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1A1918]/60">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="reader@dailynpm.com"
                className="w-full bg-[#FBF9F5] border-2 border-[#1A1918] py-2 pl-10 pr-3 focus:outline-none focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold uppercase mb-1">Secret Key / Password</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1A1918]/60">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#FBF9F5] border-2 border-[#1A1918] py-2 pl-10 pr-3 focus:outline-none focus:bg-white"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#1A1918] hover:bg-[#A82424] disabled:bg-[#4A4744] text-white font-bold uppercase border-2 border-[#1A1918] shadow-[2px_2px_0px_#1A1918] hover:shadow-none active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                TRANSMITTING WIRE DISPATCH...
              </>
            ) : isSignUp ? (
              'CREATE PORTFOLIO ACCESS'
            ) : (
              'ENTER ARCHIVES'
            )}
          </button>
        </form>

        <div className="mt-4 pt-4 border-t border-dashed border-[#1A1918] text-center font-mono-news text-[11px]">
          {isSignUp ? (
            <p>
              Already registered?{' '}
              <button 
                onClick={() => { setIsSignUp(false); setError(null); }}
                className="font-bold underline text-[#A82424] hover:text-[#1A1918]"
              >
                Sign in to existing archives.
              </button>
            </p>
          ) : (
            <p>
              First time reader?{' '}
              <button 
                onClick={() => { setIsSignUp(true); setError(null); }}
                className="font-bold underline text-[#A82424] hover:text-[#1A1918]"
              >
                Register a new reader portfolio.
              </button>
            </p>
          )}
        </div>

        {isSimulationMode && (
          <div className="mt-4 p-2 bg-[#EAE6DF] border border-[#1A1918] text-[10px] font-mono-news text-center leading-relaxed text-[#4A4744]">
            <span className="font-bold">NOTE:</span> Real Firebase credentials not provided. Your accounts and watchlists will be securely managed inside your local web browser's Storage.
          </div>
        )}
      </div>
    </div>
  );
};
