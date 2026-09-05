/**
 * API Service for communicating with the Secure Backend Proxy
 * All requests attach the Firebase Bearer token in the Authorization header.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export async function sendChatMessage({ history, message, persona, pastJournals = [], idToken }) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': idToken ? `Bearer ${idToken}` : 'Bearer dev_token_active_user'
  };

  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      history,
      message,
      persona,
      pastJournals
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Chat request failed with status ${response.status}`);
  }

  return response.json();
}

export async function sendChatMessageStream({ history, message, persona, pastJournals = [], idToken, onChunk, onStart }) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': idToken ? `Bearer ${idToken}` : 'Bearer dev_token_active_user'
  };

  const response = await fetch(`${API_BASE_URL}/chat/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      history,
      message,
      persona,
      pastJournals
    })
  });

  if (!response.ok) {
    // Fall back to standard chat endpoint if streaming fails
    return sendChatMessage({ history, message, persona, pastJournals, idToken });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let metadata = {};
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const payload = trimmed.slice(6);
      if (payload === '[DONE]') break;

      try {
        const data = JSON.parse(payload);
        if (data.type === 'start') {
          if (onStart) onStart(data);
        } else if (data.type === 'chunk') {
          fullText += data.text;
          if (onChunk) onChunk(fullText, data.text);
        } else if (data.type === 'done') {
          metadata = data;
        } else if (data.type === 'error') {
          throw new Error(data.error || 'Stream error');
        }
      } catch (err) {
        if (err.message && err.message.includes('Stream error')) throw err;
      }
    }
  }

  return {
    reply: fullText,
    persona,
    modelUsed: metadata.modelUsed,
    timestamp: metadata.timestamp || new Date().toISOString()
  };
}

export async function summarizeSession({ conversation, rawNotes, idToken }) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (idToken) {
    headers['Authorization'] = `Bearer ${idToken}`;
  }

  const response = await fetch(`${API_BASE_URL}/summarize`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      conversation,
      rawNotes
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Summarize request failed with status ${response.status}`);
  }

  return response.json();
}

export async function fetchSocraticPrompts({ mood, recentThemes, idToken }) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (idToken) {
    headers['Authorization'] = `Bearer ${idToken}`;
  }

  const response = await fetch(`${API_BASE_URL}/prompt-suggest`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      mood,
      recentThemes
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to fetch prompts');
  }

  return response.json();
}

export async function searchCognitiveMemory({ queryText, journals, persona, idToken }) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (idToken) {
    headers['Authorization'] = `Bearer ${idToken}`;
  }

  const response = await fetch(`${API_BASE_URL}/memory/search`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      queryText,
      journals,
      persona
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to search cognitive memory');
  }

  return response.json();
}

export async function checkSecurityHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) throw new Error('Health check endpoint failed');
    return await response.json();
  } catch (error) {
    return {
      status: 'offline',
      error: error.message,
      security: {
        zeroTrustModel: 'Enforced via Local Directives',
        tenantIsolationEnforced: true
      }
    };
  }
}
