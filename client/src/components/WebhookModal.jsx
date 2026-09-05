import React, { useState } from 'react';
import { 
  Send, 
  X, 
  CheckCircle2, 
  Radio,
  Share2,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function WebhookModal({ isOpen, onClose, briefing = null, journals = [] }) {
  const { idToken } = useAuth();
  const [webhookUrl, setWebhookUrl] = useState(localStorage.getItem('unjournal_webhook_url') || '');
  const [platform, setPlatform] = useState('discord');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null);

  if (!isOpen) return null;

  const handleDispatch = async () => {
    if (!webhookUrl.trim() || sending) return;

    setSending(true);
    setStatus(null);

    // Save webhook URL for convenience
    localStorage.setItem('unjournal_webhook_url', webhookUrl.trim());

    try {
      const topPriorities = briefing?.today_top_3_priorities || [
        "Focus on key personal milestone",
        "Take 20 minutes for quiet reflection",
        "Review daily learnings"
      ];

      const res = await fetch('/api/webhooks/dispatch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': idToken ? `Bearer ${idToken}` : 'Bearer dev_token_active_user'
        },
        body: JSON.stringify({
          webhookUrl: webhookUrl.trim(),
          platform,
          briefing,
          topPriorities
        })
      });

      const data = await res.json();
      if (res.ok) {
        setStatus({ success: true, message: 'Dispatched successfully!' });
      } else {
        setStatus({ success: false, message: data.error || 'Dispatch failed' });
      }
    } catch (e) {
      setStatus({ success: false, message: 'Network error during dispatch.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-3xl p-6 sm:p-7 relative bg-[#0D0D0D]/95 border border-white/15 text-white shadow-2xl space-y-6">
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
            <Share2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-base font-medium text-white tracking-tight">
              Webhook Dispatcher
            </h2>
            <p className="text-xs text-white/50">
              Send daily reflections and priorities directly to Discord or Slack
            </p>
          </div>
        </div>

        {/* Platform Selector */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPlatform('discord')}
            className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-all ${
              platform === 'discord'
                ? 'bg-white/15 border-white/40 text-white'
                : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
            }`}
          >
            Discord Webhook
          </button>
          <button
            type="button"
            onClick={() => setPlatform('slack')}
            className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-all ${
              platform === 'slack'
                ? 'bg-white/15 border-white/40 text-white'
                : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
            }`}
          >
            Slack Webhook
          </button>
        </div>

        {/* Webhook Input */}
        <div className="space-y-2">
          <label className="text-[11px] font-mono-journal uppercase text-white/60 block">
            {platform.toUpperCase()} WEBHOOK URL
          </label>
          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder={`https://${platform === 'discord' ? 'discord.com/api/webhooks/...' : 'hooks.slack.com/services/...'}`}
            className="w-full bg-black/60 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/40 transition-colors font-mono-journal"
          />
        </div>

        {/* Status Message */}
        {status && (
          <div className={`p-3 rounded-xl text-xs border ${
            status.success
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              : 'bg-red-500/10 border-red-500/20 text-red-300'
          }`}>
            {status.message}
          </div>
        )}

        {/* Dispatch Action */}
        <div className="pt-2">
          <button
            onClick={handleDispatch}
            disabled={!webhookUrl.trim() || sending}
            className="btn-solid w-full h-11 rounded-xl text-xs font-medium flex items-center justify-center gap-2"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{sending ? 'Sending to Channel...' : 'Send Daily Briefing'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
