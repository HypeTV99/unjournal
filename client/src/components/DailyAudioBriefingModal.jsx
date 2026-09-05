import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  Play, 
  Pause, 
  X, 
  ListOrdered,
  FileText
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function DailyAudioBriefingModal({ isOpen, onClose, journals = [] }) {
  const { idToken } = useAuth();
  const [briefing, setBriefing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (isOpen && !briefing) {
      loadDailyBriefing();
    }
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isOpen]);

  const loadDailyBriefing = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/briefing/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': idToken ? `Bearer ${idToken}` : ''
        },
        body: JSON.stringify({ journals })
      });
      const json = await res.json();
      setBriefing(json.data);
    } catch (err) {
      console.error('Failed to load briefing:', err);
    } finally {
      setLoading(false);
    }
  };

  const togglePlayAudio = () => {
    if (!briefing?.spoken_audio_script || !('speechSynthesis' in window)) return;

    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
    } else {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(briefing.spoken_audio_script);
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);

      window.speechSynthesis.speak(utterance);
      setIsPlaying(true);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Subtle Ambient Dimming Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Top-to-Bottom Teardrop Pop-Up Container */}
      <div
        className="fixed top-20 left-1/2 z-50 w-[92vw] max-w-xl md:max-w-2xl h-[540px] max-h-[70vh] liquid-glass-strong rounded-[32px] shadow-2xl flex flex-col overflow-hidden animate-teardrop font-body border border-white/20 select-none"
        role="dialog"
        aria-modal="true"
        aria-label="60-Second Audio Briefing"
      >
        {/* Top Droplet Accent */}
        <div className="w-12 h-1 bg-white/40 rounded-full mx-auto mt-2.5 opacity-60" />

        {/* Pop-Up Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full liquid-glass-strong flex items-center justify-center text-white/80 shadow-sm">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-heading italic text-xl text-white tracking-tight leading-none">
                60-Second Podcast Briefing
              </h2>
              <p className="text-[11px] font-body text-white/50 mt-0.5">
                Spoken morning recap synthesized by Gemini
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="liquid-glass-strong rounded-full w-8 h-8 flex items-center justify-center text-white/60 hover:text-white transition-all shadow-sm"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Pop-Up Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
              <span className="w-3 h-3 rounded-full bg-white animate-ping mx-auto block" />
              <p className="text-xs font-body text-white/70">
                Synthesizing your personal 60-second briefing with Gemini...
              </p>
            </div>
          ) : briefing ? (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Player Card (Liquid-Glass) */}
              <div className="p-4 rounded-2xl liquid-glass-strong border border-white/15 flex items-center justify-between gap-4 shadow-lg">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-white/40'}`} />
                    <span className="text-xs font-semibold text-white truncate font-body">
                      {briefing.briefing_theme || 'Morning Reflection'}
                    </span>
                  </div>
                  <div className="text-[11px] text-white/50 flex items-center gap-2 font-body">
                    <span>{isPlaying ? 'Playing spoken briefing aloud' : 'Click play to listen'}</span>
                    {isPlaying && (
                      <div className="flex items-center gap-0.5 ml-1">
                        <span className="w-0.5 h-3 bg-white/80 animate-pulse" />
                        <span className="w-0.5 h-4 bg-white/80 animate-pulse delay-75" />
                        <span className="w-0.5 h-2 bg-white/80 animate-pulse delay-150" />
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={togglePlayAudio}
                  className="bg-white text-black w-11 h-11 rounded-full p-0 flex items-center justify-center flex-shrink-0 shadow-xl hover:scale-105 transition-transform"
                  title={isPlaying ? 'Pause' : 'Play Briefing'}
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 fill-current text-black" />
                  ) : (
                    <Play className="w-4 h-4 fill-current text-black ml-0.5" />
                  )}
                </button>
              </div>

              {/* Spoken Script / Transcript Card */}
              <div className="p-4 rounded-2xl liquid-glass-strong border border-white/10 space-y-1.5 shadow-md">
                <div className="flex items-center gap-1.5 text-[10px] font-body text-white/50 uppercase tracking-wider">
                  <FileText className="w-3 h-3" />
                  <span>Audio Transcript</span>
                </div>
                <p className="text-[13px] text-white/80 leading-relaxed font-body italic">
                  "{briefing.spoken_audio_script}"
                </p>
              </div>

              {/* Key Priorities For Today */}
              {briefing.today_top_3_priorities?.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-body text-white/50 uppercase tracking-wider">
                    <ListOrdered className="w-3 h-3" />
                    <span>Focus For Today</span>
                  </div>
                  <div className="space-y-2">
                    {briefing.today_top_3_priorities.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl liquid-glass-strong border border-white/10 flex items-start gap-3 text-xs font-body shadow-sm"
                      >
                        <span className="text-white/60 font-semibold text-[11px] pt-0.5">
                          0{idx + 1}
                        </span>
                        <span className="text-white/80 leading-relaxed">
                          {item}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-2">
              <p className="text-sm text-white/70 font-body">No previous entries found</p>
              <p className="text-xs text-white/40 max-w-xs font-body">
                Record a few reflections to generate your personalized spoken daily briefing.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
