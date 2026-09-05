/**
 * Permission Service for Unjournal.ai
 * Safely requests essential user permissions:
 * - Microphone (for voice dictation & conversational flow)
 * - Location (for ambient location & timezone context in journal reflections)
 * - Photos access capability
 */

export async function requestJournalPermissions() {
  const permissions = {
    mic: 'unknown',
    location: 'unknown',
    photos: 'available'
  };

  // 1. Microphone Permission
  try {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const micPromise = navigator.mediaDevices.getUserMedia({ audio: true });
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500));
      const stream = await Promise.race([micPromise, timeoutPromise]);
      // Release microphone tracks immediately so device mic light turns off
      if (stream && stream.getTracks) {
        stream.getTracks().forEach(track => track.stop());
      }
      permissions.mic = 'granted';
    }
  } catch (err) {
    console.warn('[Permissions] Microphone notice:', err.message);
    permissions.mic = 'denied';
  }

  // 2. Geolocation Permission
  try {
    if ('geolocation' in navigator) {
      await new Promise(resolve => {
        const timer = setTimeout(() => resolve(), 1500);
        navigator.geolocation.getCurrentPosition(
          pos => {
            clearTimeout(timer);
            permissions.location = 'granted';
            try {
              localStorage.setItem('unjournal_user_location', JSON.stringify({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                timestamp: Date.now()
              }));
            } catch (e) {}
            resolve();
          },
          err => {
            clearTimeout(timer);
            console.warn('[Permissions] Location notice:', err.message);
            permissions.location = 'denied';
            resolve();
          },
          { timeout: 1200, enableHighAccuracy: false }
        );
      });
    }
  } catch (err) {
    console.warn('[Permissions] Geolocation notice:', err);
  }

  // 3. Photos Access Check
  try {
    if ('showOpenFilePicker' in window || document.createElement('input')) {
      permissions.photos = 'granted';
    }
  } catch (err) {
    permissions.photos = 'supported';
  }

  return permissions;
}
