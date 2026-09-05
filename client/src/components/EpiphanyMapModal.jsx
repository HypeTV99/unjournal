import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  Compass, 
  X, 
  Calendar
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function EpiphanyMapModal({ isOpen, onClose, journals = [] }) {
  const { idToken } = useAuth();
  const [currentLocation, setCurrentLocation] = useState(null);
  const [detecting, setDetecting] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);

  useEffect(() => {
    if (isOpen && !currentLocation) {
      detectCurrentLocation();
    }
  }, [isOpen]);

  const detectCurrentLocation = () => {
    if (!('geolocation' in navigator)) return;

    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch('/api/location/geocode', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': idToken ? `Bearer ${idToken}` : 'Bearer dev_token_active_user'
            },
            body: JSON.stringify({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude
            })
          });
          const json = await res.json();
          if (json.data) {
            setCurrentLocation(json.data);
          }
        } catch (e) {
          console.warn('Geocoding notice:', e);
        } finally {
          setDetecting(false);
        }
      },
      () => setDetecting(false),
      { timeout: 8000 }
    );
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
        aria-label="Epiphany Maps"
      >
        {/* Top Droplet Accent */}
        <div className="w-12 h-1 bg-white/40 rounded-full mx-auto mt-2.5 opacity-60" />

        {/* Pop-Up Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full liquid-glass-strong flex items-center justify-center text-white/80 shadow-sm">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-heading italic text-xl text-white tracking-tight leading-none">
                Epiphany Maps
              </h2>
              <p className="text-[11px] font-body text-white/50 mt-0.5">
                Where your thoughts and reflections took place
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

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Current Location Card (Liquid-Glass) */}
          <div className="p-4 rounded-2xl liquid-glass-strong border border-white/15 flex items-center justify-between gap-4 shadow-lg">
            <div className="space-y-1">
              <span className="text-[10px] font-body text-white/40 uppercase tracking-wider">
                CURRENT REFLECTION SANCTUARY
              </span>
              <div className="text-xs font-semibold text-white flex items-center gap-2 font-body">
                <MapPin className="w-3.5 h-3.5 text-white/80" />
                <span>
                  {currentLocation 
                    ? `${currentLocation.city}, ${currentLocation.country}` 
                    : detecting ? 'Locating your sanctuary...' : 'Location active (Private)'}
                </span>
              </div>
            </div>

            <button
              onClick={detectCurrentLocation}
              disabled={detecting}
              className="liquid-glass-strong text-xs px-3.5 py-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-all font-body shadow-sm"
            >
              {detecting ? 'Locating...' : 'Refresh Location'}
            </button>
          </div>

          {/* Entries List by Location */}
          <div className="space-y-2.5 pt-1">
            <div className="text-[10px] font-body text-white/40 uppercase tracking-wider">
              Recorded Places ({journals.length} {journals.length === 1 ? 'entry' : 'entries'})
            </div>

            {journals.length === 0 ? (
              <div className="py-10 text-center text-xs text-white/50 font-body">
                No reflections saved yet. As you write, each entry records the location where your thoughts occurred.
              </div>
            ) : (
              journals.map((j) => (
                <div
                  key={j.id}
                  onClick={() => setSelectedEntry(selectedEntry?.id === j.id ? null : j)}
                  className={`group p-4 rounded-2xl border transition-all cursor-pointer text-left ${
                    selectedEntry?.id === j.id
                      ? 'bg-white/15 border-white/40 shadow-lg'
                      : 'liquid-glass-strong hover:bg-white/10 hover:border-white/30 border-white/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <h3 className="font-semibold text-xs sm:text-sm text-white truncate font-body group-hover:text-white transition-colors">
                        {j.title || 'Untitled Reflection'}
                      </h3>
                      <div className="text-[11px] text-white/50 flex items-center gap-3 font-body">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-white/60" />
                          {j.location?.city ? `${j.location.city}, ${j.location.country}` : 'Personal Cloud'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-white/60" />
                          {new Date(j.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {selectedEntry?.id === j.id && (
                    <div className="mt-3 pt-3 border-t border-white/10 text-xs text-white/80 font-body leading-relaxed animate-in fade-in duration-150">
                      {j.summary || 'Recorded journal conversation.'}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
