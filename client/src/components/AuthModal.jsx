import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Key, 
  Lock,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  X,
  ExternalLink
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
  
  // Real Google Sign-in API State
  const defaultClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  const [googleClientId, setGoogleClientId] = useState(() => {
    return localStorage.getItem('google_oauth_client_id') || defaultClientId;
  });
  const [showClientIdConfig, setShowClientIdConfig] = useState(false);
  const [customClientIdInput, setCustomClientIdInput] = useState('');

  useEffect(() => {
    if (googleClientId) {
      localStorage.setItem('google_oauth_client_id', googleClientId);
    }
  }, [googleClientId]);

  // Handle Real Google Account Sign-In via Google Identity Services
  const handleGoogleAuth = async (clientIdOverride) => {
    setError('');
    const targetClientId = (typeof clientIdOverride === 'string' && clientIdOverride.trim()) 
      ? clientIdOverride.trim() 
      : (googleClientId ? googleClientId.trim() : '');

    // 1. First check if Google Identity Services script is available
    if (typeof window === 'undefined' || !window.google?.accounts?.oauth2) {
      setError('Google Identity Services is initializing. Please wait a moment and try again.');
      return;
    }

    // 2. If client ID is empty or placeholder, ask user to configure their Google Cloud OAuth Client ID
    if (!targetClientId || targetClientId.includes('your-') || targetClientId === '1021404915767-unjournal.apps.googleusercontent.com') {
      setShowClientIdConfig(true);
      return;
    }

    setLoading(true);

    try {
      // 3. Official Google Identity Services OAuth2 Token Client
      // This initiates the authentic Google Account sign-in window asking for user permissions
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: targetClientId,
        scope: 'openid email profile',
        prompt: 'consent', // Explicitly prompts user to verify permissions and what the app can access
        callback: async (tokenResponse) => {
          if (tokenResponse.error) {
            console.error('[Google Sign-In Error]', tokenResponse);
            if (tokenResponse.error === 'invalid_client' || tokenResponse.error === 'unauthorized_client') {
              setError(`Google OAuth Error: ${tokenResponse.error_description || tokenResponse.error}. Please check your Google Cloud Web Client ID.`);
              setShowClientIdConfig(true);
            } else if (tokenResponse.error === 'access_denied') {
              setError('Google sign-in was canceled or permissions were not granted.');
            } else {
              setError(`Google authentication failed: ${tokenResponse.error_description || tokenResponse.error}`);
            }
            setLoading(false);
            return;
          }

          try {
            // 4. Verify authentic Google Account by querying the official Google OAuth2 UserInfo API
            const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: {
                Authorization: `Bearer ${tokenResponse.access_token}`
              }
            });

            if (!response.ok) {
              throw new Error(`Google API returned status ${response.status}`);
            }

            const profile = await response.json();
            // Authentic verified profile returned directly from accounts.google.com
            // { sub, email, name, picture, email_verified }
            
            // Request journal ambient & voice permissions
            await requestJournalPermissions();

            // Log in with verified Google user
            loginWithGoogleAccount({
              uid: profile.sub,
              email: profile.email,
              displayName: profile.name,
              photoURL: profile.picture,
              emailVerified: profile.email_verified
            });
            setShowClientIdConfig(false);
          } catch (profileErr) {
            console.error('[Google Profile Fetch Error]', profileErr);
            setError('Failed to verify Google account profile.');
          } finally {
            setLoading(false);
          }
        },
        error_callback: (err) => {
          console.error('[Google GIS Error Callback]', err);
          setError(`Google Sign-In API error: ${err.message || err.type || 'Initialization failed'}`);
          setShowClientIdConfig(true);
          setLoading(false);
        }
      });

      // Open authentic Google account consent popup
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (err) {
      console.error('[Google Sign-In Exception]', err);
      setError(err.message || 'Failed to start Google Sign-In.');
      setLoading(false);
    }
  };

  const handleSaveCustomClientId = (e) => {
    e.preventDefault();
    const cleanId = customClientIdInput.trim();
    if (!cleanId) return;
    setGoogleClientId(cleanId);
    localStorage.setItem('google_oauth_client_id', cleanId);
    setShowClientIdConfig(false);
    handleGoogleAuth(cleanId);
  };

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
        <div className="flex items-center">
          <span className="font-heading italic text-2xl tracking-normal text-white">unjournal</span>
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

          {/* Heading in Instrument Serif Italic */}
          <div className="space-y-2">
            <h1 className="text-4xl sm:text-5xl font-heading italic text-white tracking-tight leading-[0.95] max-w-sm mx-auto mb-2">
              Welcome to your personal journal.
            </h1>
          </div>

          {/* Real Google Sign-in (Primary CTA) */}
          <div className="space-y-3 pt-2">
            <button
              onClick={() => handleGoogleAuth()}
              disabled={loading}
              className="bg-white text-black rounded-full w-full h-12 text-sm font-semibold flex items-center justify-center gap-3 shadow-xl hover:bg-white/90 hover:scale-[1.01] active:scale-[0.99] transition-all font-body"
            >
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>{loading ? 'Connecting Google API...' : 'Continue with Google'}</span>
            </button>

            {error && (
              <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-200 text-xs text-left font-body flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 leading-snug">{error}</div>
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

      {/* Google OAuth Client ID Configuration Modal */}
      {showClientIdConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl p-6 sm:p-8 relative liquid-glass-strong bg-[#0D0D0D]/95 border border-white/20 text-white shadow-2xl space-y-5">
            {/* Close Button */}
            <button
              onClick={() => setShowClientIdConfig(false)}
              className="absolute top-5 right-5 p-2 text-white/50 hover:text-white rounded-full border border-white/10 hover:border-white/30 bg-white/5 transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
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
                Google Sign-In API
              </h2>
              <p className="text-xs text-white/60 font-body leading-relaxed">
                Connect using the official Google Sign-in API. Provide your Google Cloud OAuth 2.0 Web Client ID from <span className="text-white font-mono text-[11px]">unjournal-ai-2026</span>.
              </p>
            </div>

            {/* Permission explanation */}
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-left space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Real Google Account Verification</span>
              </div>
              <p className="text-[11px] text-white/50 leading-relaxed font-body">
                Once initiated, Google opens its official consent screen asking you to allow access to your name and email.
              </p>
            </div>

            {/* Client ID Form */}
            <form onSubmit={handleSaveCustomClientId} className="space-y-3 text-left">
              <div>
                <label className="text-[11px] font-body uppercase text-white/60 mb-1 block">Google OAuth Client ID</label>
                <input
                  type="text"
                  value={customClientIdInput}
                  onChange={(e) => setCustomClientIdInput(e.target.value)}
                  placeholder="1021404915767-xxx.apps.googleusercontent.com"
                  className="w-full liquid-glass-strong rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none font-mono border border-white/15 focus:border-white/40 transition-colors"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={!customClientIdInput.trim()}
                className="w-full bg-white text-black rounded-full h-11 text-xs font-semibold hover:bg-white/90 disabled:opacity-40 transition-all font-body flex items-center justify-center gap-2 shadow-lg mt-2"
              >
                <span>Launch Google Sign-in</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>

            <div className="text-center pt-2">
              <button
                onClick={() => {
                  setShowClientIdConfig(false);
                  handleDemoSandbox('Guest');
                }}
                className="text-xs text-white/50 hover:text-white underline font-body"
              >
                Or continue with Instant Guest Preview
              </button>
            </div>
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
