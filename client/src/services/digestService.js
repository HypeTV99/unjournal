/**
 * Yesterday → today digest helpers.
 * Day scoping runs on local calendar days; persistence is per-user in
 * localStorage so the morning loop works fully offline / in demo mode.
 */

export function dayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getYesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dayKey(d);
}

function journalDayKey(j) {
  const raw = j.createdAt || j.updatedAt;
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return dayKey(d);
}

export function filterByDay(journals = [], key) {
  return journals.filter((j) => journalDayKey(j) === key);
}

function digestCacheKey(userId, todayKey) {
  return `gemini_digest_user_${userId}_${todayKey}`;
}

export function getCachedDigest(userId, todayKey) {
  if (!userId || !todayKey) return null;
  try {
    const raw = localStorage.getItem(digestCacheKey(userId, todayKey));
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function setCachedDigest(userId, todayKey, digest) {
  if (!userId || !todayKey) return;
  try {
    localStorage.setItem(digestCacheKey(userId, todayKey), JSON.stringify(digest));
  } catch (e) {
    console.warn('[Digest] cache write failed:', e.message);
  }
}

export function clearCachedDigest(userId, todayKey) {
  if (!userId || !todayKey) return;
  try {
    localStorage.removeItem(digestCacheKey(userId, todayKey));
  } catch (e) {}
}

/** Minimal client-side fallback when the server itself is unreachable. */
export function buildLocalDigest(yesterday = []) {
  const events = yesterday.map((j) => j.title || 'Untitled reflection').filter(Boolean).slice(0, 5);
  const conclusions = yesterday.map((j) => j.summary).filter((s) => s && s.length > 4).slice(0, 3);
  const carryovers = events.slice(0, 3).map((t) => `Follow up on: ${t}`);
  const lead = events[0] || 'your reflections';
  return {
    dateScope: 'yesterday',
    entryCount: yesterday.length,
    events,
    conclusions,
    carryovers,
    spoken_audio_script: `Good morning. Yesterday you recorded ${yesterday.length} reflection${yesterday.length === 1 ? '' : 's'}${events.length ? `, including ${events.slice(0, 2).join(' and ')}` : ''}. So — what are today's events?`,
    today_opener: `Let's begin today. Carrying over from yesterday: ${carryovers[0] || lead}. Ask me what today's events are.`,
    local: true
  };
}

export async function fetchDigest({ yesterday = [], todayCount = 0, idToken }) {
  const res = await fetch('/api/digest/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': idToken ? `Bearer ${idToken}` : 'Bearer dev_token_active_user'
    },
    body: JSON.stringify({ yesterday, todayCount })
  });
  if (!res.ok) {
    throw new Error(`Digest request failed with status ${res.status}`);
  }
  const json = await res.json();
  if (!json?.data) {
    throw new Error('Digest response was empty');
  }
  return json.data;
}
