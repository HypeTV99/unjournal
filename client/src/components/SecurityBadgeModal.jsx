import React from 'react';
import { 
  ShieldCheck, 
  X, 
  CheckCircle,
  Key,
  Database,
  Lock
} from 'lucide-react';

const PILLARS = [
  {
    num: '01',
    title: 'Responsible AI Constitution',
    desc: 'System instructions that enforce empathetic, safe, and respectful responses with complete input sanitation.',
    status: 'ACTIVE'
  },
  {
    num: '02',
    title: 'Secure Firebase Authentication',
    desc: 'Every session is protected by cryptographic tokens, ensuring only you have access to your reflections.',
    status: 'VERIFIED'
  },
  {
    num: '03',
    title: 'Isolated Personal Cloud Storage',
    desc: 'Your entries are stored in your own private Firestore database silo, completely separated from other users.',
    status: 'PROTECTED'
  },
  {
    num: '04',
    title: 'Zero Secret Exposure',
    desc: 'AI API keys and tokens are held securely in Google Cloud Secret Manager on the server. Never exposed to browsers.',
    status: 'SECURED'
  }
];

export default function SecurityBadgeModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="w-full max-w-2xl rounded-3xl p-6 sm:p-7 relative bg-[#0D0D0D]/95 border border-white/15 text-white shadow-2xl space-y-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-white/50 hover:text-white rounded-full border border-white/10 hover:border-white/30 bg-white/5 transition-all"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full border border-white/20 bg-white/10 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-base font-medium text-white tracking-tight">
              AI Constitution & Security Architecture
            </h2>
            <p className="text-xs text-white/50">
              The four foundational pillars keeping your journal private, safe, and reliable
            </p>
          </div>
        </div>

        {/* Pillars Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {PILLARS.map((pillar) => (
            <div
              key={pillar.num}
              className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2 hover:border-white/25 transition-all"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono-journal text-white/40 text-[11px] font-bold">
                  {pillar.num}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono-journal bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {pillar.status}
                </span>
              </div>
              <h3 className="text-xs font-medium text-white">
                {pillar.title}
              </h3>
              <p className="text-[11px] text-white/60 font-sans leading-relaxed">
                {pillar.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
