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
  const [username, setUsername] = useState('');
  const [authMethod, setAuthMethod] = useState<'email' | 'anonymous'>('email');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const getIdentifier = (val: string) => {
    const trimmed = val.trim();
    if (trimmed.includes('@')) {
      return trimmed;
    }
    // For Firebase cloud mode, map username to a synthetic email.
    // For local simulation mode, keep it as a username.
    return isSimulationMode ? trimmed : `${trimmed.toLowerCase()}@anonymous.dailynpm.com`;
  };

  const handleResendOtp = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to resend code');
      }
      
      if (data.devOtp) {
        console.log(`[DEVELOPMENT] Resent OTP: ${data.devOtp}`);
        setError(`DEVELOPMENT NOTE: OTP code is ${data.devOtp} (Printed to server console!)`);
      } else {
        setError(null);
        alert('Verification code has been resent to your email.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP code.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        if (authMethod === 'anonymous') {
          // Anonymous signup validation
          const trimmedUsername = username.trim();
          if (trimmedUsername.length < 3) {
            throw new Error('Username must be at least 3 characters.');
          }
          if (trimmedUsername.includes('@')) {
            throw new Error('Username cannot contain the "@" symbol.');
          }

          const identifier = getIdentifier(trimmedUsername);
          const user = await signUpUser(identifier, password, trimmedUsername);
          onAuthSuccess(user);
          onClose();
        } else {
          // Email signup
          if (!otpSent) {
            // Phase 1: Request OTP
            const response = await fetch('/api/auth/send-otp', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ email }),
            });
            const data = await response.json();
            if (!response.ok) {
              throw new Error(data.error || 'Failed to send verification code');
            }
            setOtpSent(true);
            
            if (data.devOtp) {
              console.log(`[DEVELOPMENT] Sent OTP: ${data.devOtp}`);
              setError(`DEVELOPMENT NOTE: Verification OTP code is ${data.devOtp} (Printed to server console too!)`);
            }
          } else {
            // Phase 2: Verify OTP
            if (!/^\d{6}$/.test(otp)) {
              throw new Error('Verification code must be exactly 6 digits.');
            }
            const verifyResponse = await fetch('/api/auth/verify-otp', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ email, otp }),
            });
            const verifyData = await verifyResponse.json();
            if (!verifyResponse.ok) {
              throw new Error(verifyData.error || 'Verification code failed');
            }

            // OTP verified successfully, perform actual sign up
            const user = await signUpUser(email, password, displayName);
            onAuthSuccess(user);
            onClose();
          }
        }
      } else {
        // Standard Sign In
        const identifier = getIdentifier(email);
        const user = await signInUser(identifier, password);
        onAuthSuccess(user);
        onClose();
      }
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
            {isSignUp 
              ? (otpSent ? 'VERIFY SECURITY CODE' : 'REGISTER ACCOUNT') 
              : 'READER LOGIN'}
          </h2>
          <p className="text-xs italic text-[#4A4744] mt-0.5">
            "Subscribe to personalized package dispatches and portfolio analysis"
          </p>
        </div>

        {/* Auth Method Selector Tabs for Sign Up */}
        {isSignUp && !otpSent && (
          <div className="flex border-2 border-[#1A1918] mb-4 text-[10px] font-mono-news font-bold">
            <button
              type="button"
              onClick={() => { setAuthMethod('email'); setError(null); }}
              className={`flex-1 py-2 text-center transition-colors cursor-pointer ${
                authMethod === 'email' 
                  ? 'bg-[#1A1918] text-white' 
                  : 'bg-[#EAE6DF] text-[#1A1918] hover:bg-[#FBF9F5]'
              }`}
            >
              DISPATCH ACCESS (EMAIL)
            </button>
            <button
              type="button"
              onClick={() => { setAuthMethod('anonymous'); setError(null); }}
              className={`flex-1 py-2 text-center transition-colors cursor-pointer ${
                authMethod === 'anonymous' 
                  ? 'bg-[#1A1918] text-white' 
                  : 'bg-[#EAE6DF] text-[#1A1918] hover:bg-[#FBF9F5]'
              }`}
            >
              ANONYMOUS LOG (USERNAME)
            </button>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-[#EAE6DF] border-2 border-[#A82424] text-xs font-mono-news flex gap-2 items-start text-[#A82424]">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">SYSTEM MESSAGE:</span> {error}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 font-mono-news text-xs">
          {isSignUp && otpSent ? (
            <div className="space-y-4">
              <p className="text-xs text-[#4A4744] leading-relaxed">
                A verification code has been dispatched to <strong className="text-[#1A1918]">{email}</strong>. 
                Please enter the 6-digit code below to authorize account creation.
              </p>
              
              <div>
                <label className="block font-bold uppercase mb-1">Verification Code (OTP)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1A1918]/60 font-bold">
                    #
                  </span>
                  <input
                      type="text"
                      required
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="123456"
                      className="w-full bg-[#FBF9F5] border-2 border-[#1A1918] py-2.5 pl-10 pr-3 focus:outline-none focus:bg-white tracking-widest text-center text-lg font-bold"
                    />
                </div>
              </div>

              <div className="flex justify-between items-center text-[11px] mt-2">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={loading}
                  className="font-bold underline text-[#A82424] hover:text-[#1A1918] disabled:text-[#4A4744] cursor-pointer"
                >
                  {loading ? "Requesting dispatch..." : "Resend OTP Code"}
                </button>
                <button
                  type="button"
                  onClick={() => { setOtpSent(false); setOtp(''); setError(null); }}
                  className="font-bold underline text-[#1A1918] hover:text-[#A82424] cursor-pointer"
                >
                  Edit Registration Details
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-[#1A1918] hover:bg-[#A82424] disabled:bg-[#4A4744] text-white font-bold uppercase border-2 border-[#1A1918] shadow-[2px_2px_0px_#1A1918] hover:shadow-none active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    AUTHORIZING PORTFOLIO...
                  </>
                ) : (
                  'VERIFY & REGISTER'
                )}
              </button>
            </div>
          ) : (
            <>
              {isSignUp && authMethod === 'email' && (
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

              {isSignUp && authMethod === 'anonymous' && (
                <div>
                  <label className="block font-bold uppercase mb-1">Username</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1A1918]/60">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="reader123"
                      className="w-full bg-[#FBF9F5] border-2 border-[#1A1918] py-2 pl-10 pr-3 focus:outline-none focus:bg-white"
                    />
                  </div>
                </div>
              )}

              {(!isSignUp || authMethod === 'email') && (
                <div>
                  <label className="block font-bold uppercase mb-1">
                    {isSignUp ? 'Email Address' : 'Email or Username'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1A1918]/60">
                      <Mail className="w-4 h-4" />
                    </span>
                    <input
                      type={isSignUp ? 'email' : 'text'}
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={isSignUp ? 'reader@dailynpm.com' : 'reader@dailynpm.com or username'}
                      className="w-full bg-[#FBF9F5] border-2 border-[#1A1918] py-2 pl-10 pr-3 focus:outline-none focus:bg-white"
                    />
                  </div>
                </div>
              )}

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
                  authMethod === 'email' ? 'SEND VERIFICATION CODE' : 'CREATE PORTFOLIO ACCESS'
                ) : (
                  'ENTER ARCHIVES'
                )}
              </button>
            </>
          )}
        </form>

        <div className="mt-4 pt-4 border-t border-dashed border-[#1A1918] text-center font-mono-news text-[11px]">
          {isSignUp ? (
            <p>
              Already registered?{' '}
              <button 
                onClick={() => { setIsSignUp(false); setOtpSent(false); setOtp(''); setError(null); }}
                className="font-bold underline text-[#A82424] hover:text-[#1A1918]"
              >
                Sign in to existing archives.
              </button>
            </p>
          ) : (
            <p>
              First time reader?{' '}
              <button 
                onClick={() => { setIsSignUp(true); setOtpSent(false); setOtp(''); setError(null); }}
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
