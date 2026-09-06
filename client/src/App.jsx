import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Mic, 
  MicOff, 
  ArrowUp, 
  Radio, 
  History, 
  MoreHorizontal, 
  Plus, 
  X, 
  Compass, 
  MapPin,
  Lock,
  Share2,
  Activity,
  Shield,
  Sunrise,
  LogOut,
  Image as ImageIcon
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ThinkingOrb } from 'thinking-orbs';
import { BorderBeam } from 'border-beam';
import { dayKey, getYesterdayKey, filterByDay } from './services/digestService';
import { useAuth } from './context/AuthContext';
import { fetchUserJournals, saveJournalEntry, deleteUserJournal } from './services/firestoreService';
import { sendChatMessage, sendChatMessageStream } from './services/api';
import AuthModal from './components/AuthModal';
import SecurityBadgeModal from './components/SecurityBadgeModal';
import RedTeamSimulatorModal from './components/RedTeamSimulatorModal';
import DailyAudioBriefingModal from './components/DailyAudioBriefingModal';
import EpiphanyMapModal from './components/EpiphanyMapModal';
import WebhookModal from './components/WebhookModal';
import PrivacyComplianceModal from './components/PrivacyComplianceModal';
import { uploadMemoryPhoto } from './services/storageService';
import { encryptText, decryptText, isEncryptedPayload } from './services/cryptoService';

export default function App() {
  const { user, idToken, loading: authLoading, signOutUser } = useAuth();

  const [journals, setJournals] = useState([]);
  const [activeJournalId, setActiveJournalId] = useState(null);

  // Morning loop: yesterday's entries feed today's recap
  const yesterdayEntries = useMemo(() => filterByDay(journals, getYesterdayKey()), [journals]);
  const hasTodayEntries = useMemo(() => filterByDay(journals, dayKey()).length > 0, [journals]);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // Modals & Privacy Controls
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [vaultPassphrase, setVaultPassphrase] = useState('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isRedTeamModalOpen, setIsRedTeamModalOpen] = useState(false);
  const [isBriefingModalOpen, setIsBriefingModalOpen] = useState(false);
  const [isEpiphanyMapModalOpen, setIsEpiphanyMapModalOpen] = useState(false);
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);

  const chatBottomRef = useRef(null);  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const timerRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const speechTextRef = useRef('');
  const activeStreamRef = useRef(null);
  const photoInputRef = useRef(null);
  const mainScrollRef = useRef(null);
  const [attachedPhoto, setAttachedPhoto] = useState(null);

  // Load user journals from private Firestore sandbox
  useEffect(() => {
    if (user?.uid) {
      loadJournals();
    } else {
      setJournals([]);
      setActiveJournalId(null);
      setMessages([]);
    }
  }, [user?.uid]);

  const loadJournals = async () => {
    if (!user?.uid) return;
    try {
      const records = await fetchUserJournals(user.uid);
      setJournals(records);
      setMessages([]);
    } catch (err) {
      console.error('Failed to load journals:', err);
    }
  };

  useEffect(() => {
    if (messages.length > 0) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
    }
  }, [messages, isSending]);

  const tickerIntervalRef = useRef(null);

  useEffect(() => {
    return () => {
      if (tickerIntervalRef.current) clearInterval(tickerIntervalRef.current);
    };
  }, []);

  const handlePhotoAttachment = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploadingPhoto(true);
      try {
        const result = await uploadMemoryPhoto(file, user?.uid, idToken);
        setAttachedPhoto(result.url);
      } catch (err) {
        console.warn('Photo processing notice:', err);
        const reader = new FileReader();
        reader.onload = () => setAttachedPhoto(reader.result);
        reader.readAsDataURL(file);
      } finally {
        setIsUploadingPhoto(false);
      }
    }
  };

  const cleanAIText = (text) => {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(/^<thought>[\s\S]*?<\/thought>/gi, '')
      .replace(/^<think>[\s\S]*?<\/think>/gi, '')
      .replace(/^(Constraints|Constraints:|Thought Process:|Plan:|Meta:|Persona:)\s*(\*[^\n]*|\n)*/gim, '')
      .trimStart();
  };

  const handleSendMessage = async (textOverride = null) => {
    const rawText = (textOverride || inputMessage || '').trim();
    if (!rawText && !attachedPhoto) return;
    if (isSending) return;

    let textToSend = rawText;
    if (attachedPhoto) {
      textToSend = rawText
        ? `${rawText}\n\n![Memory photo](${attachedPhoto})`
        : `*(Visual memory reflection)*\n\n![Memory photo](${attachedPhoto})`;
      setAttachedPhoto(null);
    }

    if (tickerIntervalRef.current) {
      clearInterval(tickerIntervalRef.current);
      tickerIntervalRef.current = null;
    }

    const userMsg = {
      role: 'user',
      content: textToSend.trim(),
      timestamp: new Date().toISOString()
    };

    const initialModelMsg = {
      role: 'model',
      content: '',
      timestamp: new Date().toISOString()
    };

    const updatedHistory = [...messages, userMsg];
    // Immediate 0ms feedback: show user msg and model bubble with pulsing dots immediately
    setMessages([...updatedHistory, initialModelMsg]);
    setInputMessage('');
    setIsSending(true);

    let streamStarted = false;
    let accumulatedText = '';
    let displayedText = '';
    let streamComplete = false;
    let modelMeta = {};

    // Start progressive word-by-word ticker (ramped up for snappy delivery)
    const startTicker = () => {
      if (tickerIntervalRef.current) return;
      tickerIntervalRef.current = setInterval(() => {
        const remaining = accumulatedText.slice(displayedText.length);

        if (remaining.length > 0) {
          // Adaptive high-speed cadence: 1-2 words normally, 3-5 words if backlog is large, rapid flush if stream complete
          let step = 1;
          if (streamComplete) {
            step = 6;
          } else if (remaining.length > 60) {
            step = 4;
          } else if (remaining.length > 20) {
            step = 2;
          }

          let count = 0;
          let advanceIdx = 0;
          while (advanceIdx < remaining.length && count < step) {
            if (/\s/.test(remaining[advanceIdx])) {
              while (advanceIdx < remaining.length && /\s/.test(remaining[advanceIdx])) {
                advanceIdx++;
              }
              count++;
            } else {
              advanceIdx++;
            }
          }

          if (advanceIdx === 0) {
            advanceIdx = streamComplete ? remaining.length : Math.min(remaining.length, 5);
          }

          displayedText += remaining.slice(0, advanceIdx);

          setMessages(prev => {
            const list = [...prev];
            const last = list[list.length - 1];
            if (last && last.role === 'model') {
              list[list.length - 1] = {
                ...last,
                content: displayedText,
                ...modelMeta
              };
            }
            return list;
          });
        } else if (streamComplete) {
          // All words drained and stream finished
          clearInterval(tickerIntervalRef.current);
          tickerIntervalRef.current = null;
          setIsSending(false);

          const finalMsg = {
            role: 'model',
            content: displayedText,
            memoryAttached: modelMeta.memoryAttached,
            isSemanticRetrospection: modelMeta.isSemanticRetrospection,
            modelUsed: modelMeta.modelUsed,
            timestamp: modelMeta.timestamp || new Date().toISOString()
          };
          const finalHistory = [...updatedHistory, finalMsg];
          setMessages(finalHistory);
          silentBackgroundSave(finalHistory);
        }
      }, 14);
    };

    startTicker();

    try {
      const response = await sendChatMessageStream({
        message: textToSend.trim(),
        history: updatedHistory,
        pastJournals: journals,
        idToken,
        onStart: (meta) => {
          streamStarted = true;
          modelMeta = {
            memoryAttached: meta.memoryAttached,
            isSemanticRetrospection: meta.isSemanticRetrospection,
            modelUsed: meta.modelUsed,
            timestamp: meta.timestamp || new Date().toISOString()
          };
        },
        onChunk: (fullText) => {
          accumulatedText = cleanAIText(fullText);
        }
      });

      streamComplete = true;
      accumulatedText = cleanAIText(response.reply || accumulatedText);
      modelMeta = {
        ...modelMeta,
        modelUsed: response.modelUsed || modelMeta.modelUsed,
        timestamp: response.timestamp || modelMeta.timestamp
      };
    } catch (err) {
      console.error('Chat error:', err);
      if (tickerIntervalRef.current) {
        clearInterval(tickerIntervalRef.current);
        tickerIntervalRef.current = null;
      }
      setIsSending(false);

      if (!streamStarted || !displayedText) {
        setMessages(prev => {
          const list = [...prev];
          const last = list[list.length - 1];
          if (last && last.role === 'model') {
            list[list.length - 1] = {
              role: 'model',
              content: `I am reflecting with you. What feels like the most important part of this to focus on right now?`,
              timestamp: new Date().toISOString()
            };
          }
          return list;
        });
      }
    }
  };

  // Silent Background Auto-Save (Zero user clicks needed)
  const silentBackgroundSave = async (conversation) => {
    setIsSaving(true);
    try {
      const currentEntryId = activeJournalId || `journal_${Date.now()}`;
      const userText = conversation.filter(c => c.role === 'user').map(c => c.content).join(' ');

      let conversationToSave = conversation;
      let summaryToSave = userText.substring(0, 160);
      let privacyScope = 'full_memory';

      // Zero-Knowledge WebCrypto Vault Mode (if user set a passphrase)
      if (vaultPassphrase) {
        privacyScope = 'vault_encrypted';
        try {
          summaryToSave = await encryptText(summaryToSave, vaultPassphrase);
          conversationToSave = await Promise.all(
            conversation.map(async (c) => ({
              ...c,
              content: await encryptText(c.content, vaultPassphrase)
            }))
          );
        } catch (encErr) {
          console.warn('Vault encryption fallback:', encErr);
        }
      }

      const entry = {
        id: currentEntryId,
        title: userText.substring(0, 40) + '...' || 'Personal Reflection',
        conversation: conversationToSave,
        summary: summaryToSave,
        privacyScope,
        isEncrypted: !!vaultPassphrase,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await saveJournalEntry(user.uid, entry);
      if (!activeJournalId) setActiveJournalId(currentEntryId);
    } catch (e) {
      console.warn('Silent save notice:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBeginToday = (digest) => {
    setIsBriefingModalOpen(false);
    const opener = digest?.today_opener || "Let's begin today. Ask me what today's events are.";
    handleSendMessage(opener);
  };

  const handleStartNewSession = () => {
    if (tickerIntervalRef.current) {
      clearInterval(tickerIntervalRef.current);
      tickerIntervalRef.current = null;
    }
    setActiveJournalId(null);
    setMessages([]);
    setShowHistoryDrawer(false);
  };

  // Auto-stop mic and auto-submit spoken sentence to the agent
  const stopAndAutoSubmit = (textOverride = null) => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecordingSeconds(0);
    setIsListening(false);

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
      recognitionRef.current = null;
    }

    if (activeStreamRef.current) {
      try {
        activeStreamRef.current.getTracks().forEach(t => t.stop());
      } catch (e) {}
      activeStreamRef.current = null;
    }

    const textToSend = (textOverride || speechTextRef.current || inputMessage).trim();
    speechTextRef.current = '';
    setInputMessage('');

    if (textToSend) {
      handleSendMessage(textToSend);
    }
  };

  // Cancel voice capture without submitting anything
  const cancelVoiceRecording = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecordingSeconds(0);
    setIsListening(false);

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
      recognitionRef.current = null;
    }

    if (activeStreamRef.current) {
      try {
        activeStreamRef.current.getTracks().forEach(t => t.stop());
      } catch (e) {}
      activeStreamRef.current = null;
    }

    speechTextRef.current = '';
    setInputMessage('');
  };

  // Voice Recording with auto-silence detection and auto-submit
  const toggleVoiceRecording = async () => {
    setMicError(null);
    if (isListening) {
      // User tapped stop -> immediately submit whatever was captured
      stopAndAutoSubmit();
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        speechTextRef.current = '';
        setInputMessage('');
        setIsListening(true);
        setRecordingSeconds(0);
        timerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);

        recognition.onresult = (event) => {
          let fullTranscript = '';
          for (let i = 0; i < event.results.length; i++) {
            fullTranscript += event.results[i][0].transcript + ' ';
          }
          const cleaned = fullTranscript.trim();
          if (cleaned) {
            speechTextRef.current = cleaned;
            setInputMessage(cleaned);

            // Reset silence detection: if user finishes speaking and pauses, auto-stop and submit
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = setTimeout(() => {
              if (speechTextRef.current.trim().length > 0) {
                stopAndAutoSubmit(speechTextRef.current.trim());
              }
            }, 3500); // 3.5s pause so mid-sentence breaks never cut you off
          }
        };

        recognition.onspeechend = () => {
          // When speech ends, auto-submit after a generous pause
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
            if (speechTextRef.current.trim().length > 0) {
              stopAndAutoSubmit(speechTextRef.current.trim());
            }
          }, 3500);
        };

        recognition.onerror = (e) => {
          console.warn('Speech recognition notice:', e.error);
          if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
            setMicError('Microphone blocked — click the padlock icon in the address bar, allow Microphone for this site, then tap the mic again.');
          } else if (e.error === 'audio-capture') {
            setMicError('No microphone found — check that a mic is connected and not in use by another app, then try again.');
          }
          if (e.error !== 'no-speech') {
            stopAndAutoSubmit();
          }
        };

        recognition.onend = () => {
          if (speechTextRef.current.trim().length > 0) {
            stopAndAutoSubmit(speechTextRef.current.trim());
          } else {
            setIsListening(false);
            if (timerRef.current) clearInterval(timerRef.current);
            setRecordingSeconds(0);
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (err) {
        console.error('Speech recognition error:', err);
        setIsListening(false);
      }
    } else {
      // Clean fallback for environments without Web Speech API
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        activeStreamRef.current = stream;
        setIsListening(true);
        setRecordingSeconds(0);
        timerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);

        audioChunksRef.current = [];
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach(track => track.stop());
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          if (audioBlob.size > 1000) {
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = async () => {
              const base64Data = reader.result.split(',')[1];
              try {
                const res = await fetch('/api/transcribe', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': idToken ? `Bearer ${idToken}` : 'Bearer dev_token_active_user'
                  },
                  body: JSON.stringify({
                    audioBase64: base64Data,
                    mimeType: 'audio/webm'
                  })
                });
                const data = await res.json();
                if (data.text && data.text.trim()) {
                  handleSendMessage(data.text.trim());
                }
              } catch (err) {
                console.warn('Transcription notice:', err);
              }
            };
          }
        };

        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start(1000);
      } catch (err) {
        console.error('Microphone access error:', err);
        setMicError('Microphone unavailable — allow access in the browser and in Windows Settings → Privacy & security → Microphone, then try again.');
        setIsListening(false);
      }
    }
  };

  if (authLoading) {
    return (
      <div className="h-screen bg-black text-white flex flex-col items-center justify-center font-mono-journal text-xs space-y-4">
        <ThinkingOrb state="breathing" size={64} theme="dark" aria-label="Initializing UnJournal secure enclave" />
        <span>INITIALIZING UNJOURNAL SECURE ENCLAVE...</span>
      </div>
    );
  }

  if (!user) {
    return <AuthModal />;
  }

  return (
    <div className="h-screen flex flex-col bg-black text-white selection:bg-white/30 selection:text-white font-body overflow-hidden relative">
      {/* Grain Layer */}
      <div className="grain" aria-hidden="true"></div>

      {/* Ambient Background Video with gradient scrim */}
      <div className="ambient-bg" aria-hidden="true">
        <video autoPlay muted loop playsInline tabIndex={-1} preload="auto">
          <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260818_072341_50851634-bbc3-4c33-9acc-7647d4db44aa.mp4" type="video/mp4" />
        </video>
      </div>

      {/* Top Header (3-Column Liquid Grid with V2 Glass Buttons & Typography) */}
      <header className="h-16 px-6 sm:px-10 border-b border-white/10 bg-black/40 backdrop-blur-md flex items-center justify-between z-30 select-none">
        {/* Left — Logo & Brand Mark in Instrument Serif */}
        <div className="flex items-center gap-3">
          <a href="#" onClick={handleStartNewSession} className="inline-flex items-center gap-2.5 font-semibold text-[15.5px] tracking-tight text-white hover:opacity-90 transition-opacity">
            <svg className="w-[22px] h-[22px] text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <g transform="rotate(-30 12 12)">
                <circle cx="7.3" cy="3.2" r="1.45" />
                <rect x="5.5" y="4.7" width="3.6" height="14.6" rx="1.8" />
                <rect x="14.9" y="4.7" width="3.6" height="14.6" rx="1.8" />
                <circle cx="16.7" cy="20.8" r="1.45" />
              </g>
            </svg>
            <span className="font-heading italic text-xl tracking-normal">Unjournal<span className="font-body not-italic text-sm text-white/70 font-normal">.ai</span></span>
          </a>
        </div>

        {/* Center — Liquid-Glass Navigation Buttons matching Main Page UI/UX and Text Style */}
        <nav className="hidden md:flex items-center gap-3" aria-label="Primary">
          <BorderBeam size="sm" colorVariant="mono" strength={0.5} theme="dark">
            <button
              onClick={() => setIsEpiphanyMapModalOpen(true)}
              className="liquid-glass-strong text-xs px-4 py-2.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2 font-body shadow-lg"
              title="Epiphany Horizon Maps"
            >
              <Compass className="w-3.5 h-3.5 text-white/70" />
              <span>Epiphany Maps</span>
            </button>
          </BorderBeam>

          <BorderBeam size="sm" colorVariant="mono" strength={0.5} theme="dark">
            <button
              onClick={() => setIsBriefingModalOpen(true)}
              className="liquid-glass-strong text-xs px-4 py-2.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2 font-body shadow-lg"
              title="60s Morning Spoken Briefing"
            >
              <Radio className="w-3.5 h-3.5 text-white/70" />
              <span>60s Podcast</span>
            </button>
          </BorderBeam>

          <BorderBeam size="sm" colorVariant="mono" strength={0.5} theme="dark">
            <button
              onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
              className="liquid-glass-strong text-xs px-4 py-2.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2 font-body shadow-lg"
              title="Past Reflections History"
            >
              <History className="w-3.5 h-3.5 text-white/70" />
              <span>Reflections ({journals.length})</span>
            </button>
          </BorderBeam>
        </nav>

        {/* Right — Actions with Matching Glass Buttons & Typography */}
        <div className="flex items-center gap-3">
          <BorderBeam size="md" colorVariant="mono" strength={0.6} theme="dark">
            <button
              onClick={handleStartNewSession}
              className="bg-white text-black rounded-full px-4 py-2.5 text-xs font-semibold hover:bg-white/90 transition-colors inline-flex items-center gap-1 font-body shadow-lg"
              title="Start New Reflective Session"
            >
              <Plus className="w-3.5 h-3.5 mr-0.5 stroke-[2.5]" />
              <span>New Entry</span>
            </button>
          </BorderBeam>

          {/* System Menu Toggle */}
          <div className="relative">
            <BorderBeam size="sm" colorVariant="mono" strength={0.5} theme="dark">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className={`liquid-glass-strong rounded-full w-10 h-10 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-all shadow-lg ${
                showMenu ? 'bg-white/15 text-white ring-1 ring-white/30' : ''
              }`}
              title="System Controls"
            >
              <MoreHorizontal className="w-4 h-4 text-white" />
            </button>
            </BorderBeam>

            {showMenu && (
              <>
                {/* Transparent Backdrop to close menu on outside click */}
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowMenu(false)} 
                  aria-hidden="true" 
                />

                {/* Liquid-Glass Pop-Up Menu matching V2 Design */}
                <div className="absolute right-0 mt-2.5 w-64 rounded-2xl liquid-glass-strong bg-black/85 backdrop-blur-2xl border border-white/20 shadow-2xl shadow-black/80 p-2 z-50 animate-in fade-in zoom-in-95 duration-150 font-body text-xs select-none space-y-1">
                  <div className="px-3 py-2 text-[10px] font-mono-journal text-white/40 tracking-widest uppercase border-b border-white/10 flex items-center justify-between">
                    <span>SYSTEM & TOOLS</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/80 animate-pulse" />
                  </div>

                  {/* Mobile-only Nav Buttons */}
                  <div className="md:hidden space-y-1 pb-1 border-b border-white/10">
                    <button
                      onClick={() => {
                        setIsEpiphanyMapModalOpen(true);
                        setShowMenu(false);
                      }}
                      className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/10 text-white/90 hover:text-white transition-all flex items-center gap-2.5 font-body group"
                    >
                      <div className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/70 group-hover:text-white group-hover:bg-white/10 transition-all flex-shrink-0">
                        <Compass className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-medium">Epiphany Maps</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsBriefingModalOpen(true);
                        setShowMenu(false);
                      }}
                      className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/10 text-white/90 hover:text-white transition-all flex items-center gap-2.5 font-body group"
                    >
                      <div className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/70 group-hover:text-white group-hover:bg-white/10 transition-all flex-shrink-0">
                        <Radio className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-medium">60s Podcast</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowHistoryDrawer(true);
                        setShowMenu(false);
                      }}
                      className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/10 text-white/90 hover:text-white transition-all flex items-center gap-2.5 font-body group"
                    >
                      <div className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/70 group-hover:text-white group-hover:bg-white/10 transition-all flex-shrink-0">
                        <History className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-medium">Reflections ({journals.length})</span>
                    </button>
                  </div>

                  {/* Core System Tools */}
                  <button
                    onClick={() => {
                      setIsWebhookModalOpen(true);
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/10 text-white/90 hover:text-white transition-all flex items-center gap-2.5 font-body group"
                  >
                    <div className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/70 group-hover:text-white group-hover:bg-white/10 transition-all flex-shrink-0">
                      <Share2 className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 flex items-center justify-between">
                      <span className="font-medium">Webhook Dispatcher</span>
                      <span className="text-[9px] text-white/35 font-mono-journal">N8N / HOOKS</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setIsRedTeamModalOpen(true);
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/10 text-white/90 hover:text-white transition-all flex items-center gap-2.5 font-body group"
                  >
                    <div className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/70 group-hover:text-white group-hover:bg-white/10 transition-all flex-shrink-0">
                      <Activity className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 flex items-center justify-between">
                      <span className="font-medium">Threat Simulator</span>
                      <span className="text-[9px] text-white/35 font-mono-journal">RED TEAM</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setIsSecurityModalOpen(true);
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/10 text-white/90 hover:text-white transition-all flex items-center gap-2.5 font-body group"
                  >
                    <div className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/70 group-hover:text-white group-hover:bg-white/10 transition-all flex-shrink-0">
                      <Shield className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 flex items-center justify-between">
                      <span className="font-medium">AI Constitution</span>
                      <span className="text-[9px] text-white/35 font-mono-journal">SECURITY</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setIsPrivacyModalOpen(true);
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/10 text-white/90 hover:text-white transition-all flex items-center gap-2.5 font-body group"
                  >
                    <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:text-emerald-300 transition-all flex-shrink-0">
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 flex items-center justify-between">
                      <span className="font-medium">Privacy & Vault</span>
                      <span className="text-[9px] text-emerald-400/80 font-mono-journal">GDPR / AES</span>
                    </div>
                  </button>

                  <div className="border-t border-white/10 my-1" />

                  <button
                    onClick={() => {
                      signOutUser();
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-[#FFFFFF]/15 text-[#FFFFFF] transition-all flex items-center gap-2.5 font-body group"
                  >
                    <div className="w-6 h-6 rounded-lg bg-[#FFFFFF]/10 border border-[#FFFFFF]/20 flex items-center justify-center text-[#FFFFFF] flex-shrink-0">
                      <LogOut className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-medium">Sign Out</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Conversation & Reflection Canvas */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        <main ref={mainScrollRef} className="flex-1 overflow-y-auto px-4 sm:px-8 py-8 flex flex-col items-center">
          <div className="w-full max-w-2xl space-y-6">
            {/* Empty state: V2 Typography and Glass Button prompts */}
            {messages.length === 0 && (
              <div className="w-full flex flex-col items-center text-center select-none space-y-5 pt-1 sm:pt-2 pb-10 my-0">
                {/* Hero: sentence wrapped around a centered mic */}
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-heading italic text-white tracking-tight leading-[1.1] max-w-3xl mx-auto">
                  <span className="block">What is on your</span>
                  <span className="inline-flex my-4 sm:my-5 not-italic">
                    <BorderBeam size="md" colorVariant="ocean" strength={0.6} theme="dark">
                      <button
                        type="button"
                        onClick={toggleVoiceRecording}
                        className="w-24 h-24 rounded-full liquid-glass-strong text-white hover:bg-white/10 inline-flex items-center justify-center transition-all shadow-2xl"
                        title="Speak your reflection"
                      >
                        <Mic className="w-10 h-10" />
                      </button>
                    </BorderBeam>
                  </span>
                  <span className="block">mind right now?</span>
                </h1>

                {/* Morning nudge: yesterday's recap when today is untouched */}
                {yesterdayEntries.length > 0 && !hasTodayEntries && (
                  <div className="w-full flex justify-center pt-1">
                    <BorderBeam size="md" colorVariant="ocean" strength={0.6} theme="dark" className="rounded-full">
                      <button
                        onClick={() => setIsBriefingModalOpen(true)}
                        className="liquid-glass-strong text-xs px-5 py-3 rounded-full text-white hover:bg-white/10 transition-all flex items-center gap-2 font-body shadow-lg"
                      >
                        <Sunrise className="w-4 h-4 text-white/80" />
                        <span>Yesterday's recap is ready — {yesterdayEntries.length} reflection{yesterdayEntries.length === 1 ? '' : 's'} · 60s listen</span>
                      </button>
                    </BorderBeam>
                  </div>
                )}

                {/* Suggested Prompts in Liquid-Glass-Strong rounded pills */}
                <div className="flex flex-wrap items-center justify-center gap-2.5 max-w-2xl pt-2">
                  {[
                    "How did my day go today?",
                    "Talk through something on my mind",
                    "What did I write about my goals recently?",
                    "Help me clear my thoughts and unwind"
                  ].map((prompt, pIdx) => (
                    <BorderBeam key={pIdx} size="md" colorVariant="mono" strength={0.4} theme="dark" className="rounded-full">
                      <button
                        onClick={() => handleSendMessage(prompt)}
                        className="liquid-glass-strong text-xs px-4 py-2.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-all text-center font-body shadow-lg"
                      >
                        → {prompt}
                      </button>
                    </BorderBeam>
                  ))}
                </div>
              </div>
            )}

            {/* Active Conversation Stream */}
            {messages.map((msg, idx) => {
              const isUser = msg.role === 'user';

              return (
                <div
                  key={idx}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5 animate-in fade-in slide-in-from-bottom-4 duration-500`}
                >
                  {/* Turn Metadata */}
                  <span className="font-mono-journal text-[10px] text-white/40 uppercase tracking-wider px-1">
                    {isUser ? 'YOU' : 'UNJOURNAL AI'}
                  </span>

                  {/* Message Container in Symmetrical V2 Glass Style & Barlow */}
                  <div
                    className={`max-w-[92%] sm:max-w-[85%] p-4 sm:p-5 rounded-2xl text-[14px] leading-relaxed font-body ${
                      isUser
                        ? 'bg-white/15 text-white border border-white/20 shadow-lg backdrop-blur-md'
                        : 'liquid-glass-strong text-[#EDEDED] shadow-xl'
                    }`}
                  >
                    <div className="prose prose-invert prose-p:my-1.5 prose-headings:my-2 prose-strong:text-white text-[14px] leading-relaxed font-body">
                      {msg.content ? (
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      ) : (
                        <div className="flex items-center gap-1.5 py-1 text-white/50 text-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse delay-100" />
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse delay-200" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            <div ref={chatBottomRef} />
          </div>
        </main>

      </div>

      {/* Top-to-Bottom Teardrop Reflections Pop-Up */}
      {showHistoryDrawer && (
        <>
          {/* Subtle Ambient Dimming Overlay */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity animate-in fade-in duration-200"
            onClick={() => setShowHistoryDrawer(false)}
            aria-hidden="true"
          />

          {/* Square-like Rounded Pop-Up with Teardrop Expansion */}
          <div
            className="fixed top-20 left-1/2 z-50 w-[92vw] max-w-xl md:max-w-2xl h-[520px] max-h-[68vh] liquid-glass-strong rounded-[32px] shadow-2xl flex flex-col overflow-hidden animate-teardrop font-body border border-white/20 select-none"
            role="dialog"
            aria-modal="true"
            aria-label="Past Reflections"
          >
            {/* Top Droplet Accent */}
            <div className="w-12 h-1 bg-white/40 rounded-full mx-auto mt-2.5 opacity-60" />

            {/* Pop-Up Header */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full liquid-glass-strong flex items-center justify-center text-white/80">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-heading italic text-xl text-white tracking-tight leading-none">
                    Past Reflections
                  </h2>
                  <p className="text-[11px] font-body text-white/50 mt-0.5">
                    {journals.length} {journals.length === 1 ? 'entry' : 'entries'} stored in your personal cloud
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    handleStartNewSession();
                    setShowHistoryDrawer(false);
                  }}
                  className="bg-white text-black rounded-full px-3.5 py-1.5 text-xs font-semibold hover:bg-white/90 transition-all flex items-center gap-1 font-body shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>New</span>
                </button>
                <button
                  onClick={() => setShowHistoryDrawer(false)}
                  className="liquid-glass-strong rounded-full w-8 h-8 flex items-center justify-center text-white/60 hover:text-white transition-all"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Reflections Content Grid */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5">
              {journals.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
                  <div className="w-12 h-12 rounded-2xl liquid-glass-strong flex items-center justify-center text-white/40">
                    <History className="w-6 h-6" />
                  </div>
                  <p className="text-sm text-white/70 font-body">No previous entries yet</p>
                  <p className="text-xs text-white/40 max-w-xs font-body">
                    Speak or write your thoughts on the main canvas to create your first reflection.
                  </p>
                </div>
              ) : (
                journals.map((j) => {
                  const isCurrent = j.id === activeJournalId;
                  const dateStr = j.createdAt 
                    ? new Date(j.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                    : 'Recent';

                  return (
                    <div
                      key={j.id}
                      onClick={() => {
                        setActiveJournalId(j.id);
                        setMessages(j.conversation || []);
                        setShowHistoryDrawer(false);
                      }}
                      className={`group p-4 rounded-2xl transition-all cursor-pointer border text-left ${
                        isCurrent
                          ? 'bg-white/15 border-white/40 shadow-lg'
                          : 'liquid-glass-strong hover:bg-white/10 hover:border-white/30 border-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-semibold text-xs sm:text-sm text-white truncate font-body group-hover:text-white transition-colors">
                          {j.title || 'Untitled Reflection'}
                        </h3>
                        <span className="text-[10px] text-white/40 font-body flex-shrink-0">
                          {dateStr}
                        </span>
                      </div>

                      <p className="text-xs text-white/60 line-clamp-2 mt-1.5 font-body leading-relaxed">
                        {j.summary || 'Recorded journal conversation.'}
                      </p>

                      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-white/5 text-[10px] text-white/40 font-body">
                        <span className="flex items-center gap-1">
                          <Lock className="w-3 h-3 text-white/50" />
                          <span>Encrypted Sandbox</span>
                        </span>
                        <span className="group-hover:text-white transition-colors">
                          Open Entry →
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}

      {/* Bottom Floating Input Bar with V2 Liquid-Glass Styling */}
      <footer className="p-4 sm:p-6 bg-gradient-to-t from-black via-black/80 to-transparent flex flex-col items-center relative z-20 gap-4">
        {micError && (
          <div className="w-full max-w-2xl flex items-start gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/20 text-xs text-white/80 font-body animate-in fade-in">
            <Mic className="w-4 h-4 mt-0.5 flex-shrink-0 text-white/60" />
            <p className="flex-1 leading-relaxed">{micError}</p>
            <button
              type="button"
              onClick={() => setMicError(null)}
              className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white flex items-center justify-center transition-all flex-shrink-0"
              title="Dismiss"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="w-full max-w-2xl flex flex-col items-center gap-4"
        >
          {/* Text input row */}
          <div className="w-full flex items-center gap-2.5">
          {/* Mic docked bottom-left of the text box */}
          <BorderBeam size="sm" colorVariant="ocean" strength={0.6} theme="dark" className="flex-shrink-0 self-end">
            <button
              type="button"
              onClick={toggleVoiceRecording}
              className="w-11 h-11 rounded-full liquid-glass-strong text-white hover:bg-white/10 flex items-center justify-center transition-all shadow-lg"
              title={isListening ? 'Stop Recording' : 'Dictate Reflection'}
            >
              {isListening ? (
                <ThinkingOrb state="listening" size={20} theme="dark" aria-label="Listening to your voice" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>
          </BorderBeam>

          {/* Liquid-Glass-Strong Input Container with Beam border */}
          <BorderBeam size="md" colorVariant="colorful" strength={0.7} theme="dark" className="flex-1">
          <div className="liquid-glass-strong flex-1 rounded-full px-5 py-3 flex items-center shadow-2xl">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={
                isListening
                  ? `● Listening (${recordingSeconds}s)... Speak your reflection clearly`
                  : "Write a thought or ask about your past journals..."
              }
              disabled={isSending}
              className={`flex-1 bg-transparent border-0 text-sm placeholder-white/40 focus:outline-none font-body ${
                isListening ? 'text-white font-medium' : 'text-white'
              }`}
            />

            <button
              type="submit"
              disabled={(!inputMessage.trim() && !attachedPhoto) || isSending}
              className="w-8 h-8 rounded-full bg-white text-black hover:bg-[#EDEDED] disabled:opacity-20 flex items-center justify-center flex-shrink-0 transition-all ml-2 shadow-sm"
            >
              <ArrowUp className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
          </BorderBeam>
          </div>
        </form>
      </footer>

      {/* Fullscreen Listening Takeover — tap anywhere to send */}
      {isListening && (
        <div
          className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-2xl flex flex-col items-center justify-center gap-6 animate-in fade-in duration-200 select-none px-6 cursor-pointer"
          onClick={() => stopAndAutoSubmit()}
        >
          <div className="p-10">
            <ThinkingOrb state="listening" size={64} theme="dark" className="scale-[2]" aria-label="Listening to your voice" />
          </div>

          <div className="flex flex-col items-center gap-2 text-center pointer-events-none">
            <span className="font-mono-journal text-xs text-white/50 tracking-widest">
              LISTENING · {recordingSeconds}s
            </span>
            <p className="text-white/90 font-body text-base max-w-md leading-relaxed min-h-[3rem]">
              {inputMessage || 'Speak your reflection...'}
            </p>
          </div>
        </div>
      )}

      {/* Modals */}
      <SecurityBadgeModal
        isOpen={isSecurityModalOpen}
        onClose={() => setIsSecurityModalOpen(false)}
      />

      <RedTeamSimulatorModal
        isOpen={isRedTeamModalOpen}
        onClose={() => setIsRedTeamModalOpen(false)}
      />

      <DailyAudioBriefingModal
        isOpen={isBriefingModalOpen}
        onClose={() => setIsBriefingModalOpen(false)}
        journals={journals}
        onBeginToday={handleBeginToday}
      />

      <EpiphanyMapModal
        isOpen={isEpiphanyMapModalOpen}
        onClose={() => setIsEpiphanyMapModalOpen(false)}
        journals={journals}
      />

      <WebhookModal
        isOpen={isWebhookModalOpen}
        onClose={() => setIsWebhookModalOpen(false)}
        journals={journals}
      />

      <PrivacyComplianceModal
        isOpen={isPrivacyModalOpen}
        onClose={() => setIsPrivacyModalOpen(false)}
        user={user}
        journals={journals}
        vaultPassphrase={vaultPassphrase}
        onSetVaultPassphrase={setVaultPassphrase}
        onDataPurged={() => {
          setJournals([]);
          setMessages([]);
          setActiveJournalId(null);
        }}
      />
    </div>
  );
}
