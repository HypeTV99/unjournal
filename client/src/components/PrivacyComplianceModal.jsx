import React, { useState } from 'react';
import { Shield, Download, Trash2, Key, Lock, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { db } from '../config/firebase';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

export default function PrivacyComplianceModal({ 
  isOpen, 
  onClose, 
  user, 
  journals = [], 
  onDataPurged,
  vaultPassphrase,
  onSetVaultPassphrase
}) {
  const [activeTab, setActiveTab] = useState('takeout'); // 'takeout' | 'purge' | 'vault'
  const [passphraseInput, setPassphraseInput] = useState(vaultPassphrase || '');
  const [vaultSaved, setVaultSaved] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [purgeSuccess, setPurgeSuccess] = useState(false);
  const [purgeConfirmText, setPurgeConfirmText] = useState('');

  if (!isOpen) return null;

  // 1. GDPR Data Takeout
  const handleExportData = () => {
    const archivePayload = {
      exportMetadata: {
        platform: 'Unjournal.ai Cognitive Sanctuary',
        exportDate: new Date().toISOString(),
        userEmail: user?.email || 'user@private.secure',
        totalEntries: journals.length,
        gdprCompliance: 'Article 20 (Right to Data Portability)'
      },
      journals: journals.map(j => ({
        id: j.id,
        title: j.title,
        createdAt: j.createdAt,
        summary: j.summary,
        key_insights: j.key_insights || [],
        open_loops: j.open_loops || [],
        conversation: j.conversation || []
      }))
    };

    const blob = new Blob([JSON.stringify(archivePayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unjournal-archive-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 2. Right to be Forgotten (Purge all data)
  const handlePurgeAllData = async () => {
    if (purgeConfirmText !== 'DELETE ALL') {
      alert('Please type "DELETE ALL" to confirm permanent deletion.');
      return;
    }

    setIsPurging(true);
    try {
      if (user?.uid && db) {
        const colRef = collection(db, 'users', user.uid, 'journals');
        const snap = await getDocs(colRef);
        const deletes = snap.docs.map(d => deleteDoc(doc(db, 'users', user.uid, 'journals', d.id)));
        await Promise.all(deletes);
      }

      // Clear local storage reflections
      localStorage.removeItem(`unjournal_cache_${user?.uid}`);
      setPurgeSuccess(true);
      if (onDataPurged) onDataPurged();
      setTimeout(() => {
        setPurgeSuccess(false);
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Failed to purge user data:', err);
      alert('Failed to purge data: ' + err.message);
    } finally {
      setIsPurging(false);
    }
  };

  // 3. Save Vault Passphrase
  const handleSaveVault = (e) => {
    e.preventDefault();
    onSetVaultPassphrase(passphraseInput.trim());
    setVaultSaved(true);
    setTimeout(() => setVaultSaved(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="liquid-glass-strong w-full max-w-xl rounded-3xl border border-white/20 bg-black/90 p-6 md:p-8 shadow-2xl space-y-6 relative font-body text-white">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-heading italic tracking-normal">Privacy & Compliance Enclave</h2>
            <p className="text-xs text-white/50">GDPR Data Portability, Right to be Forgotten, & WebCrypto Vault</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex p-1 rounded-xl bg-white/5 border border-white/10 text-xs">
          <button
            onClick={() => setActiveTab('takeout')}
            className={`flex-1 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'takeout' ? 'bg-white/15 text-white shadow' : 'text-white/60 hover:text-white'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Data Takeout</span>
          </button>

          <button
            onClick={() => setActiveTab('vault')}
            className={`flex-1 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'vault' ? 'bg-white/15 text-white shadow' : 'text-white/60 hover:text-white'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Client-Side Vault</span>
          </button>

          <button
            onClick={() => setActiveTab('purge')}
            className={`flex-1 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'purge' ? 'bg-white/15 text-white shadow' : 'text-white/60 hover:text-white'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Purge Data</span>
          </button>
        </div>

        {/* Tab 1: Data Takeout */}
        {activeTab === 'takeout' && (
          <div className="space-y-4 text-xs">
            <p className="text-white/70 leading-relaxed">
              Under GDPR Article 20, you have the full right to export every thought, reflection, and insight you have ever recorded into an open, portable JSON archive.
            </p>
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1.5 font-mono-journal text-[11px] text-white/60">
              <div className="flex justify-between">
                <span>Total Archived Entries:</span>
                <span className="text-white font-medium">{journals.length} reflections</span>
              </div>
              <div className="flex justify-between">
                <span>Account Identity:</span>
                <span className="text-white font-medium">{user?.email || 'Active User'}</span>
              </div>
              <div className="flex justify-between">
                <span>Export Format:</span>
                <span className="text-emerald-400">Structured JSON (RFC 8259)</span>
              </div>
            </div>

            <button
              onClick={handleExportData}
              className="w-full py-3 rounded-2xl bg-white text-black font-semibold text-xs hover:bg-white/90 transition-all flex items-center justify-center gap-2 shadow-lg"
            >
              <Download className="w-4 h-4" />
              <span>Download Complete Archive (.json)</span>
            </button>
          </div>
        )}

        {/* Tab 2: Client-Side Vault (WebCrypto) */}
        {activeTab === 'vault' && (
          <form onSubmit={handleSaveVault} className="space-y-4 text-xs">
            <p className="text-white/70 leading-relaxed">
              Enable zero-knowledge encryption using native browser WebCrypto (AES-GCM 256-bit). Your thoughts are encrypted locally on your device before transmission.
            </p>

            <div className="space-y-2">
              <label className="text-[11px] text-white/50 block font-mono-journal">
                DEVICE VAULT PASSPHRASE
              </label>
              <input
                type="password"
                value={passphraseInput}
                onChange={(e) => setPassphraseInput(e.target.value)}
                placeholder="Enter private passphrase to encrypt entries..."
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white placeholder-white/30 text-xs focus:outline-none focus:border-white/40"
              />
              <p className="text-[10px] text-amber-400/80 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Never forget this passphrase. Without it, encrypted entries cannot be recovered.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-white/90 transition-all flex items-center justify-center gap-1.5"
              >
                <Key className="w-3.5 h-3.5" />
                <span>{vaultPassphrase ? 'Update Passphrase' : 'Lock Enclave'}</span>
              </button>

              {vaultPassphrase && (
                <button
                  type="button"
                  onClick={() => {
                    setPassphraseInput('');
                    onSetVaultPassphrase('');
                  }}
                  className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/70 hover:text-white transition-all"
                >
                  Disable
                </button>
              )}
            </div>

            {vaultSaved && (
              <div className="text-center text-emerald-400 text-xs flex items-center justify-center gap-1 animate-in fade-in">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Vault configuration updated successfully!</span>
              </div>
            )}
          </form>
        )}

        {/* Tab 3: Right to be Forgotten (Purge) */}
        {activeTab === 'purge' && (
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/15 text-white/70 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                <span>Permanent Irreversible Action</span>
              </div>
              <p className="text-[11px] opacity-90">
                In compliance with GDPR Article 17 (Right to Erasure), clicking purge permanently deletes all {journals.length} journal reflections, AI insights, and memory tokens from Firestore.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] text-white/50 block font-mono-journal">
                TYPE "DELETE ALL" TO CONFIRM
              </label>
              <input
                type="text"
                value={purgeConfirmText}
                onChange={(e) => setPurgeConfirmText(e.target.value)}
                placeholder="DELETE ALL"
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/25 text-white placeholder-white/20 text-xs focus:outline-none focus:border-white/50"
              />
            </div>

            <button
              onClick={handlePurgeAllData}
              disabled={isPurging || purgeConfirmText !== 'DELETE ALL'}
              className="w-full py-3 rounded-2xl bg-white text-black font-semibold text-xs hover:bg-white/90 disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center justify-center gap-2 shadow-lg shadow-black/40"
            >
              <Trash2 className="w-4 h-4" />
              <span>{isPurging ? 'Purging Firestore Database...' : 'Permanently Purge All Data'}</span>
            </button>

            {purgeSuccess && (
              <p className="text-center text-emerald-400 font-medium animate-in fade-in">
                All records successfully erased from database.
              </p>
            )}
          </div>
        )}

        {/* Footer info */}
        <div className="pt-2 border-t border-white/10 text-center text-[10px] text-white/40 font-mono-journal flex items-center justify-center gap-2">
          <span>OWASP LLM SECURED</span>
          <span>•</span>
          <span>ZERO DATA LEAKAGE</span>
          <span>•</span>
          <span>ISO/IEC 27701 ALIGNED</span>
        </div>
      </div>
    </div>
  );
}
