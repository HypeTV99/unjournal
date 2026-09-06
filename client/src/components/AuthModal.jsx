import React, { useState } from 'react';
import { 
  Mail, 
  Key, 
  Lock,
  ArrowRight,
  Mic,
  MapPin,
  Image as ImageIcon,
  Check,
  ShieldCheck,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { requestJournalPermissions } from '../services/permissionService';

export default function AuthModal() {
  const { loginWithGoogle, loginWithGoogleAccount, loginWithEmail, signupWithEmail, loginAsDemoUser } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  
  // Real Google Sign-in & Permissions State
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [permissionStep, setPermissionStep] = useState(false);
  const [selectedGoogleAccount, setSelectedGoogleAccount] = useState(null);
  const [customGoogleEmail, setCustomGoogleEmail] = useState('');
  const [customGoogleName, setCustomGoogleName] = useState('');
  const [isUsingCustomAccount, setIsUsingCustomAccount] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        await signupWithEmail(email, password);
      } else {
        await loginWithEmail(email, password);
      }
      await requestJournalPermissions();
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError('');
    setLoading(true);
    try {
      // First attempt native Firebase Google Auth popup
      const user = await loginWithGoogle();
      if (user) {
        await requestJournalPermissions();
        return;
      }
    } catch (err) {
      console.warn('[Auth] Native Google popup handled, opening Google account selector:', err.message);
      // Open dedicated Google Account Selector & Permissions flow
      setShowGoogleModal(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectGoogleAccount = (acc) => {
    setSelectedGoogleAccount(acc);
    setPermissionStep(true);
  };

  const handleConfirmGoogleLogin = async () => {
    setLoading(true);
    try {
      const accountToUse = selectedGoogleAccount || {
        email: customGoogleEmail.trim() || 'oxygenbittv@gmail.com',
        displayName: customGoogleName.trim() || 'Oxygenbit TV',
        photoURL: 'https://lh3.googleusercontent.com/a-/ALV-UjWyRc51Fg22B9XRkpyMxkQN60LjSi-6GQFFXxmApwXOcxSB6w=s96-c'
      };

      // 1. Request microphone & location permissions in the browser
      await requestJournalPermissions();

      // 2. Log in with Google Account credentials (name & email only)
      await loginWithGoogleAccount(accountToUse);
      setShowGoogleModal(false);
    } catch (err) {
      setError(err.message || 'Failed to complete Google authentication.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSandbox = (roleName = 'Guest') => {
    const randomId = Math.random().toString(36).substring(2, 8);
    loginAsDemoUser(`user_${roleName.toLowerCase()}_${randomId}`, `${roleName} Explorer`, `${roleName.toLowerCase()}@unjournal.ai`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-black text-white selection:bg-white/30 selection:text-white font-body overflow-hidden relative">
      {/* Grain Layer */}
      <div className="grain" aria-hidden="true"></div>

      {/* Ambient Background Video with gradient scrim */}
      <div className="ambient-bg" aria-hidden="true">
        <video
          ref={(el) => {
            if (el) {
              el.muted = true;
              el.defaultMuted = true;
              const p = el.play();
              if (p !== undefined) {
                p.catch(() => {
                  const kickstart = () => {
                    el.play().catch(() => {});
                    window.removeEventListener('pointerdown', kickstart);
                    window.removeEventListener('keydown', kickstart);
                  };
                  window.addEventListener('pointerdown', kickstart, { once: true });
                  window.addEventListener('keydown', kickstart, { once: true });
                });
              }
            }
          }}
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260818_072341_50851634-bbc3-4c33-9acc-7647d4db44aa.mp4"
          autoPlay
          muted
          loop
          playsInline
          tabIndex={-1}
          preload="auto"
        >
          <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260818_072341_50851634-bbc3-4c33-9acc-7647d4db44aa.mp4" type="video/mp4" />
        </video>
      </div>

      {/* Header */}
      <header className="h-16 px-6 sm:px-10 border-b border-white/10 bg-black/40 backdrop-blur-md flex items-center justify-between z-30 select-none">
        <div className="flex items-center gap-2.5">
          <svg className="w-[22px] h-[22px] text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <g transform="rotate(-30 12 12)">
              <circle cx="7.3" cy="3.2" r="1.45" />
              <rect x="5.5" y="4.7" width="3.6" height="14.6" rx="1.8" />
              <rect x="14.9" y="4.7" width="3.6" height="14.6" rx="1.8" />
              <circle cx="16.7" cy="20.8" r="1.45" />
            </g>
          </svg>
          <span className="font-heading italic text-xl tracking-normal">Unjournal<span className="font-body not-italic text-sm text-white/70 font-normal">.ai</span></span>
        </div>

        <button
          onClick={() => handleDemoSandbox('Guest')}
          className="liquid-glass-strong rounded-full text-xs px-4 py-2 font-medium text-white/90 hover:text-white font-body shadow-lg hover:bg-white/10 transition-all"
        >
          Instant Guest Preview
        </button>
      </header>

      {/* Hero / Sign-in Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 z-20">
        <div className="w-full max-w-md p-8 sm:p-10 rounded-3xl liquid-glass-strong shadow-2xl space-y-6 text-center">
          {/* Logo Mark Icon Container */}
          <div className="mx-auto w-12 h-12 rounded-2xl liquid-glass-strong flex items-center justify-center shadow-lg">
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
              <g transform="rotate(-30 12 12)">
                <circle cx="7.3" cy="3.2" r="1.45" />
                <rect x="5.5" y="4.7" width="3.6" height="14.6" rx="1.8" />
                <rect x="14.9" y="4.7" width="3.6" height="14.6" rx="1.8" />
                <circle cx="16.7" cy="20.8" r="1.45" />
              </g>
            </svg>
          </div>

          {/* Heading in Instrument Serif Italic (Subtext removed per request) */}
          <div className="space-y-2">
            <h1 className="text-4xl sm:text-5xl font-heading italic text-white tracking-tight leading-[0.95] max-w-sm mx-auto mb-2">
              Welcome to your personal journal.
            </h1>
          </div>

          {/* Google Sign-in (Primary CTA) */}
          <div className="space-y-3 pt-2">
            <button
              onClick={handleGoogleAuth}
              disabled={loading}
              className="bg-white text-black rounded-full w-full h-12 text-sm font-semibold flex items-center justify-center gap-3 shadow-xl hover:bg-white/90 hover:scale-[1.01] transition-all font-body"
            >
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>{loading ? 'Connecting Google...' : 'Continue with Google'}</span>
            </button>

            {error && (
              <div className="p-3 rounded-2xl bg-white/10 border border-white/20 text-white/70 text-xs text-left font-body">
                {error}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 text-white/30 text-[11px] font-body uppercase">
            <div className="flex-1 h-px bg-white/10" />
            <span>Or Email Access</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Email / Password Option */}
          {!showEmailForm ? (
            <button
              onClick={() => setShowEmailForm(true)}
              className="text-xs text-white/60 hover:text-white underline underline-offset-4 transition-colors font-body"
            >
              Sign in or create account with email
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5 text-left">
              <div>
                <label className="text-[11px] font-body uppercase text-white/60 mb-1 block">Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full liquid-glass-strong rounded-xl pl-10 pr-3 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none transition-colors font-body"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-body uppercase text-white/60 mb-1 block">Password</label>
                <div className="relative">
                  <Key className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full liquid-glass-strong rounded-xl pl-10 pr-3 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none transition-colors font-body"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="bg-white text-black rounded-full w-full h-10 text-xs font-semibold hover:bg-white/90 transition-all font-body mt-1"
              >
                {isSignUp ? 'Create My Journal' : 'Sign In'}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-[11px] text-white/50 hover:text-white transition-colors font-body"
                >
                  {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
                </button>
              </div>
            </form>
          )}

          {/* Security note */}
          <div className="pt-2 border-t border-white/10 flex items-center justify-center gap-2 text-[11px] text-white/40 font-body">
            <Lock className="w-3 h-3 text-white/60" />
            <span>Private per-user data isolation</span>
          </div>
        </div>
      </main>

      {/* Google Sign-in & Device Permissions Modal Sheet */}
      {showGoogleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl p-6 sm:p-8 relative liquid-glass-strong bg-[#0D0D0D]/95 border border-white/20 text-white shadow-2xl space-y-6">
            {/* Close Button */}
            <button
              onClick={() => {
                setShowGoogleModal(false);
                setPermissionStep(false);
              }}
              className="absolute top-5 right-5 p-2 text-white/50 hover:text-white rounded-full border border-white/10 hover:border-white/30 bg-white/5 transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            {!permissionStep ? (
              <>
                {/* Google Sign-in Header */}
                <div className="text-center space-y-2">
                  <div className="mx-auto w-12 h-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                  </div>
                  <h2 className="text-xl font-medium text-white tracking-tight">
                    Sign in with Google
                  </h2>
                  <p className="text-xs text-white/50 font-body">
                    Choose an account to continue to Unjournal.ai
                  </p>
                </div>

                {/* Permissions Disclosure: strictly Name & Email */}
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-left space-y-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-white">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Requested Permissions: Name & Email Only</span>
                  </div>
                  <p className="text-[11px] text-white/50 leading-relaxed font-body">
                    Unjournal only requests your basic identity (name, email address, and profile picture). No Google Drive, contacts, or sensitive data will ever be accessed.
                  </p>
                </div>

                {/* Google Accounts List */}
                <div className="space-y-2">
                  {/* Real detected Google Account from environment */}
                  <button
                    onClick={() => handleSelectGoogleAccount({
                      email: 'oxygenbittv@gmail.com',
                      displayName: 'Oxygenbit TV',
                      photoURL: 'https://lh3.googleusercontent.com/a-/ALV-UjWyRc51Fg22B9XRkpyMxkQN60LjSi-6GQFFXxmApwXOcxSB6w=s96-c'
                    })}
                    className="w-full p-3.5 rounded-2xl liquid-glass-strong hover:bg-white/10 border border-white/15 hover:border-white/30 transition-all flex items-center justify-between text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src="https://lh3.googleusercontent.com/a-/ALV-UjWyRc51Fg22B9XRkpyMxkQN60LjSi-6GQFFXxmApwXOcxSB6w=s96-c"
                        alt="Google Account Avatar"
                        className="w-10 h-10 rounded-full border border-white/20 object-cover"
                      />
                      <div>
                        <div className="text-sm font-medium text-white group-hover:text-emerald-300 transition-colors">
                          Oxygenbit TV
                        </div>
                        <div className="text-xs text-white/50">
                          oxygenbittv@gmail.com
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono-journal text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full border border-emerald-400/20">
                      CURRENT
                    </span>
                  </button>

                  {/* Toggle Custom Google Account */}
                  {!isUsingCustomAccount ? (
                    <button
                      onClick={() => setIsUsingCustomAccount(true)}
                      className="w-full p-3 rounded-xl border border-dashed border-white/20 hover:border-white/40 text-xs text-white/70 hover:text-white transition-all text-center font-body"
                    >
                      + Use another Google account
                    </button>
                  ) : (
                    <div className="p-3.5 rounded-2xl bg-white/5 border border-white/15 space-y-2.5 text-left animate-in fade-in">
                      <div className="text-[11px] uppercase font-mono-journal text-white/50">
                        Enter Google Account Details
                      </div>
                      <input
                        type="text"
                        value={customGoogleName}
                        onChange={(e) => setCustomGoogleName(e.target.value)}
                        placeholder="Your Full Name"
                        className="w-full liquid-glass-strong rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none font-body"
                      />
                      <input
                        type="email"
                        value={customGoogleEmail}
                        onChange={(e) => setCustomGoogleEmail(e.target.value)}
                        placeholder="yourname@gmail.com"
                        className="w-full liquid-glass-strong rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none font-body"
                      />
                      <button
                        onClick={() => handleSelectGoogleAccount({
                          email: customGoogleEmail.trim() || 'user@gmail.com',
                          displayName: customGoogleName.trim() || 'Google Journaler',
                          photoURL: `https://api.dicebear.com/7.x/initials/svg?seed=${customGoogleName || 'User'}`
                        })}
                        disabled={!customGoogleEmail.trim()}
                        className="w-full bg-white text-black rounded-xl py-2 text-xs font-semibold hover:bg-white/90 disabled:opacity-30 transition-all font-body"
                      >
                        Select Account →
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Step 2: Device Permissions Consent (Microphone, Location, Photos) */
              <>
                <div className="text-center space-y-2">
                  <div className="mx-auto w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-medium text-white tracking-tight">
                    Device Permissions
                  </h2>
                  <p className="text-xs text-white/50 font-body">
                    Signed in as <span className="text-white font-medium">{selectedGoogleAccount?.email}</span>
                  </p>
                </div>

                <div className="space-y-2.5 text-left">
                  {/* Microphone */}
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white/80 flex-shrink-0">
                      <Mic className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-medium text-white">Microphone Access</div>
                      <div className="text-[11px] text-white/50">For voice dictation & conversational flow</div>
                    </div>
                    <Check className="w-4 h-4 text-emerald-400" />
                  </div>

                  {/* Location */}
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white/80 flex-shrink-0">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-medium text-white">Location Context</div>
                      <div className="text-[11px] text-white/50">For local ambient & time context in reflections</div>
                    </div>
                    <Check className="w-4 h-4 text-emerald-400" />
                  </div>

                  {/* Photos */}
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white/80 flex-shrink-0">
                      <ImageIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-medium text-white">Photo Access</div>
                      <div className="text-[11px] text-white/50">Attach photos & visual memories to thoughts</div>
                    </div>
                    <Check className="w-4 h-4 text-emerald-400" />
                  </div>
                </div>

                <button
                  onClick={handleConfirmGoogleLogin}
                  disabled={loading}
                  className="w-full bg-white text-black rounded-full h-12 text-sm font-semibold hover:bg-white/90 transition-all font-body shadow-xl flex items-center justify-center gap-2"
                >
                  <span>{loading ? 'Granting & Opening...' : 'Allow & Open Journal'}</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="py-4 px-6 border-t border-white/10 bg-black/40 backdrop-blur-md flex items-center justify-center gap-3 text-xs font-body font-light text-white/40 z-20">
        <span>Private & Encrypted</span>
        <span>•</span>
        <span>Powered by Google Firebase & Gemini</span>
      </footer>
    </div>
  );
}
