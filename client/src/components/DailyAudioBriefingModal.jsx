import React, { useState, useEffect, useMemo } from 'react';
import {
  Radio,
  Play,
  Pause,
  X,
  ListOrdered,
  FileText,
  CalendarDays,
  CheckCheck,
  ArrowRight,
  RotateCcw,
  Sunrise
} from 'lucide-react';
import { ThinkingOrb } from 'thinking-orbs';
import { useAuth } from '../context/AuthContext';
import {
  dayKey,
  getYesterdayKey,
  filterByDay,
  getCachedDigest,
  setCachedDigest,
  clearCachedDigest,
  buildLocalDigest,
  fetchDigest
} from '../services/digestService';

export default function DailyAudioBriefingModal({ isOpen, onClose, journals = [], onBeginToday }) {
  const { user, idToken } = useAuth();
  const [digest, setDigest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [usedFallback, setUsedFallback] = useState(false);

  const yesterdayEntries = useMemo(
    () => filterByDay(journals, getYesterdayKey()),
    [journals]
  );
  const todayEntries = useMemo(
    () => filterByDay(journals, dayKey()),
    [journals]
  );

  useEffect(() => {
    if (isOpen) {
      loadDigest();
    }
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsPlaying(false);
    };
  }, [isOpen]);

  const loadDigest = async (forceRefresh = false) => {
    if (yesterdayEntries.length === 0) {
      setDigest(null);
      return;
    }
    const today = dayKey();
    if (!forceRefresh) {
      const cached = getCachedDigest(user?.uid, today);
      if (cached && cached.entryCount === yesterdayEntries.length) {
        setDigest(cached);
        return;
      }
    }
    setLoading(true);
    try {
      const data = await fetchDigest({
        yesterday: yesterdayEntries,
        todayCount: todayEntries.length,
        idToken
      });
      setUsedFallback(Boolean(data.fallback || data.local));
      setDigest(data);
      setCachedDigest(user?.uid, today, data);
    } catch (err) {
      console.warn('Digest server unreachable, using local recap:', err.message);
      const local = buildLocalDigest(yesterdayEntries);
      setUsedFallback(true);
      setDigest(local);
      setCachedDigest(user?.uid, today, local);
    } finally {
      setLoading(false);
    }
  };

  const togglePlayAudio = () => {
    if (!digest?.spoken_audio_script || !('speechSynthesis' in window)) return;

    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
    } else {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(digest.spoken_audio_script);
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
        aria-label="Yesterday carried forward"
      >
        {/* Top Droplet Accent */}
        <div className="w-12 h-1 bg-white/40 rounded-full mx-auto mt-2.5 opacity-60" />

        {/* Pop-Up Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full liquid-glass-strong flex items-center justify-center text-white/80 shadow-sm">
              <Sunrise className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-heading italic text-xl text-white tracking-tight leading-none">
                Yesterday, carried forward
              </h2>
              <p className="text-[11px] font-body text-white/50 mt-0.5">
                {digest ? `${digest.entryCount} reflection${digest.entryCount === 1 ? '' : 's'} distilled into today's start` : 'Your morning recap'}
                {usedFallback ? ' · on-device recap' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {digest && (
              <button
                onClick={() => loadDigest(true)}
                className="liquid-glass-strong rounded-full w-8 h-8 flex items-center justify-center text-white/60 hover:text-white transition-all shadow-sm"
                title="Regenerate recap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="liquid-glass-strong rounded-full w-8 h-8 flex items-center justify-center text-white/60 hover:text-white transition-all shadow-sm"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Pop-Up Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
              <ThinkingOrb state="breathing" size={64} theme="dark" aria-label="Distilling yesterday" />
              <p className="text-xs font-body text-white/70">
                Distilling yesterday into this morning...
              </p>
            </div>
          ) : digest ? (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Player Card (Liquid-Glass) */}
              <div className="p-4 rounded-2xl liquid-glass-strong border border-white/15 flex items-center justify-between gap-4 shadow-lg">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-white/40'}`} />
                    <span className="text-xs font-semibold text-white truncate font-body">
                      Yesterday in 60 seconds
                    </span>
                  </div>
                  <div className="text-[11px] text-white/50 flex items-center gap-2 font-body">
                    <span>{isPlaying ? 'Playing your recap aloud' : 'Click play to listen'}</span>
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
                  title={isPlaying ? 'Pause' : 'Play Recap'}
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 fill-current text-black" />
                  ) : (
                    <Play className="w-4 h-4 fill-current text-black ml-0.5" />
                  )}
                </button>
              </div>

              {/* Yesterday's events */}
              {digest.events?.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-body text-white/50 uppercase tracking-wider">
                    <CalendarDays className="w-3 h-3" />
                    <span>What you did yesterday</span>
                  </div>
                  <div className="space-y-2">
                    {digest.events.map((item, idx) => (
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

              {/* Conclusions */}
              {digest.conclusions?.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-body text-white/50 uppercase tracking-wider">
                    <CheckCheck className="w-3 h-3" />
                    <span>Conclusions you reached</span>
                  </div>
                  <div className="p-4 rounded-2xl liquid-glass-strong border border-white/10 space-y-1.5 shadow-md">
                    {digest.conclusions.map((item, idx) => (
                      <p key={idx} className="text-[13px] text-white/80 leading-relaxed font-body italic">
                        “{item}”
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Carryovers */}
              {digest.carryovers?.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-body text-white/50 uppercase tracking-wider">
                    <ListOrdered className="w-3 h-3" />
                    <span>Carry into today</span>
                  </div>
                  <div className="space-y-2">
                    {digest.carryovers.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-white/10 border border-white/20 flex items-start gap-3 text-xs font-body shadow-sm"
                      >
                        <ArrowRight className="w-3.5 h-3.5 text-white/70 mt-0.5 flex-shrink-0" />
                        <span className="text-white leading-relaxed">
                          {item}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Spoken Script / Transcript Card */}
              {digest.spoken_audio_script && (
                <div className="p-4 rounded-2xl liquid-glass-strong border border-white/10 space-y-1.5 shadow-md">
                  <div className="flex items-center gap-1.5 text-[10px] font-body text-white/50 uppercase tracking-wider">
                    <FileText className="w-3 h-3" />
                    <span>Audio Transcript</span>
                  </div>
                  <p className="text-[13px] text-white/80 leading-relaxed font-body italic">
                    "{digest.spoken_audio_script}"
                  </p>
                </div>
              )}

              {/* Begin today */}
              <button
                onClick={() => onBeginToday && onBeginToday(digest)}
                className="w-full py-3.5 rounded-2xl bg-white text-black font-semibold text-xs hover:bg-white/90 transition-all flex items-center justify-center gap-2 shadow-xl"
              >
                <Radio className="w-4 h-4" />
                <span>Begin today from this recap</span>
              </button>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-2">
              <p className="text-sm text-white/70 font-body">Nothing from yesterday yet</p>
              <p className="text-xs text-white/40 max-w-xs font-body">
                Record a few reflections today and tomorrow morning you'll wake up to a spoken recap of it all.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
