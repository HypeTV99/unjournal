import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  signInAnonymously
} from 'firebase/auth';
import { auth, googleProvider, isRealFirebaseConfigured } from '../config/firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [idToken, setIdToken] = useState(null);
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    // Check for existing saved session in localStorage
    const savedDemoUser = localStorage.getItem('gemini_journal_demo_user');
    if (savedDemoUser) {
      try {
        const parsed = JSON.parse(savedDemoUser);
        setUser(parsed);
        setIdToken(parsed.provider === 'google.com' ? `google_token_${parsed.uid}` : `dev_token_${parsed.uid}`);
        setIsDemoMode(true);
        setLoading(false);
        return;
      } catch (e) {
        localStorage.removeItem('gemini_journal_demo_user');
      }
    }

    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const token = await firebaseUser.getIdToken();
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Journaler',
          photoURL: firebaseUser.photoURL,
          isAnonymous: firebaseUser.isAnonymous
        });
        setIdToken(token);
        setIsDemoMode(false);
      } else {
        const stored = localStorage.getItem('gemini_journal_demo_user');
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            setUser(parsed);
            setIdToken(parsed.provider === 'google.com' ? `google_token_${parsed.uid}` : `dev_token_${parsed.uid}`);
            setIsDemoMode(true);
          } catch (e) {
            localStorage.removeItem('gemini_journal_demo_user');
            setUser(null);
            setIdToken(null);
          }
        } else {
          setUser(null);
          setIdToken(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isDemoMode]);

  const loginWithGoogle = async () => {
    if (!isRealFirebaseConfigured || !auth) {
      return loginAsDemoUser('google_user_demo', 'Google User Demo', 'user@gmail.com');
    }
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const token = await result.user.getIdToken();
      setIdToken(token);
      return result.user;
    } catch (error) {
      console.error('[Auth] Google sign in error:', error);
      throw error;
    }
  };

  const loginWithEmail = async (email, password) => {
    if (!isRealFirebaseConfigured || !auth) {
      return loginAsDemoUser(`demo_${email.replace(/[^a-zA-Z0-9]/g, '_')}`, email.split('@')[0], email);
    }
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const token = await result.user.getIdToken();
      setIdToken(token);
      return result.user;
    } catch (error) {
      console.error('[Auth] Email login error:', error);
      throw error;
    }
  };

  const signupWithEmail = async (email, password) => {
    if (!isRealFirebaseConfigured || !auth) {
      return loginAsDemoUser(`demo_${email.replace(/[^a-zA-Z0-9]/g, '_')}`, email.split('@')[0], email);
    }
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      const token = await result.user.getIdToken();
      setIdToken(token);
      return result.user;
    } catch (error) {
      console.error('[Auth] Email signup error:', error);
      throw error;
    }
  };

  const loginAsDemoUser = (customUid, customName, customEmail) => {
    const uid = customUid || `sec_user_${Math.random().toString(36).substring(2, 9)}`;
    const demoUser = {
      uid: uid,
      email: customEmail || `${uid}@geminijournal.secure`,
      displayName: customName || 'Security Engineer',
      photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${uid}`,
      isDemo: true
    };
    localStorage.setItem('gemini_journal_demo_user', JSON.stringify(demoUser));
    setUser(demoUser);
    setIdToken(`dev_token_${uid}`);
    setIsDemoMode(true);
    return demoUser;
  };

  const loginWithGoogleAccount = (googleAccount) => {
    const uid = googleAccount.uid || `google_${googleAccount.email.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const googleUser = {
      uid: uid,
      email: googleAccount.email,
      displayName: googleAccount.displayName || googleAccount.name || googleAccount.email.split('@')[0],
      photoURL: googleAccount.photoURL || googleAccount.picture || `https://lh3.googleusercontent.com/a-/ALV-UjWyRc51Fg22B9XRkpyMxkQN60LjSi-6GQFFXxmApwXOcxSB6w=s96-c`,
      provider: 'google.com'
    };
    localStorage.setItem('gemini_journal_demo_user', JSON.stringify(googleUser));
    setUser(googleUser);
    setIdToken(`google_token_${uid}`);
    setIsDemoMode(true);
    return googleUser;
  };

  const logout = async () => {
    localStorage.removeItem('gemini_journal_demo_user');
    setIsDemoMode(false);
    setUser(null);
    setIdToken(null);
    if (auth && isRealFirebaseConfigured) {
      await signOut(auth);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        idToken,
        isDemoMode,
        isRealFirebaseConfigured,
        loginWithGoogle,
        loginWithGoogleAccount,
        loginWithEmail,
        signupWithEmail,
        loginAsDemoUser,
        logout,
        signOutUser: logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
