import express from 'express';
import { 
  handleChatMessage, 
  handleChatMessageStream,
  summarizeAndSynthesizeEntry, 
  generateSocraticPrompts, 
  handleInitialCheckinGreeting, 
  transcribeAudioWithGemini,
  answerRetrospectiveQuery
} from '../services/geminiService.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply authentication middleware to all chat endpoints
router.use(requireAuth);

/**
 * POST /api/retrospection/query
 * Standout Feature: "Ask Your Journal" Semantic Reasoning Enclave across all lifetime memories
 */
router.post('/retrospection/query', async (req, res) => {
  try {
    const { question, journals } = req.body;
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'Question string is required' });
    }

    const result = await answerRetrospectiveQuery({
      question,
      journals: journals || []
    });

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[Route /api/retrospection/query] Error:', error);
    return res.status(500).json({
      error: 'Failed to process retrospective query',
      details: error.message
    });
  }
});

/**
 * POST /api/transcribe
 * Direct multimodal audio transcription via Gemini
 */
router.post('/transcribe', async (req, res) => {
  try {
    const { audioBase64, mimeType } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ error: 'Audio base64 payload is required' });
    }

    const text = await transcribeAudioWithGemini({ audioBase64, mimeType });
    return res.json({
      success: true,
      text
    });
  } catch (error) {
    console.error('[Route /api/transcribe] Error:', error);
    return res.status(500).json({
      error: 'Failed to transcribe audio',
      details: error.message
    });
  }
});

/**
 * POST /api/chat/checkin-greet
 * Generates dynamic initial greeting based on Daily Check-In ritual
 */
router.post('/chat/checkin-greet', async (req, res) => {
  try {
    const { mood, intent, tone, lastContext, openLoop } = req.body;
    const greeting = await handleInitialCheckinGreeting({
      mood,
      intent,
      tone,
      lastContext,
      openLoop
    });

    return res.json({
      success: true,
      greeting
    });
  } catch (error) {
    console.error('[Route /api/chat/checkin-greet] Error:', error);
    return res.json({
      success: true,
      greeting: `Welcome to today's reflection session. You marked feeling "${req.body.mood || 'Ready'}" with the intention to "${req.body.intent || 'Reflect'}". What is top of mind for you today?`
    });
  }
});

/**
 * POST /api/chat/stream
 * Multi-turn conversational journal assistant with real-time token streaming via SSE
 */
router.post('/chat/stream', async (req, res) => {
  const { message, persona, history, pastJournals } = req.body;
  const userId = req.user?.uid;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message cannot be empty' });
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  try {
    const generator = handleChatMessageStream({
      message,
      persona: persona || 'mindful',
      history: history || [],
      userId,
      pastJournals: pastJournals || []
    });

    for await (const event of generator) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      if (typeof res.flush === 'function') {
        res.flush();
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('[Route /api/chat/stream] Error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
    res.end();
  }
});

/**
 * POST /api/chat
 * Multi-turn conversational journal assistant with automatic background RAG memory
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, persona, history, pastJournals } = req.body;
    const userId = req.user?.uid;

    const result = await handleChatMessage({
      message,
      persona: persona || 'mindful',
      history: history || [],
      userId,
      pastJournals: pastJournals || []
    });

    return res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('[Route /api/chat] Error:', error);
    return res.status(500).json({
      error: 'Failed to process chat message',
      details: error.message
    });
  }
});

/**
 * POST /api/summarize
 * Auto-summarizes journal session into structured insights & action items
 */
router.post('/summarize', async (req, res) => {
  try {
    const { conversation, rawNotes } = req.body;

    if ((!conversation || conversation.length === 0) && (!rawNotes || rawNotes.trim().length === 0)) {
      return res.status(400).json({ error: 'Conversation history or raw notes must be provided.' });
    }

    const summaryData = await summarizeAndSynthesizeEntry({
      conversation,
      rawNotes
    });

    return res.json({
      success: true,
      data: summaryData
    });
  } catch (error) {
    console.error('[Route /api/summarize] Error:', error);
    return res.status(500).json({
      error: 'Failed to synthesize journal session',
      message: error.message
    });
  }
});

/**
 * POST /api/memory/search
 * Semantic RAG search across user's past journal entries
 */
router.post('/memory/search', async (req, res) => {
  try {
    const { queryText, journals, persona } = req.body;

    if (!queryText || typeof queryText !== 'string') {
      return res.status(400).json({ error: 'Valid queryText is required.' });
    }

    const { queryCognitiveMemory } = await import('../services/geminiService.js');
    const result = await queryCognitiveMemory({
      queryText,
      journals: journals || [],
      persona: persona || 'socratic'
    });

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[Route /api/memory/search] Error:', error);
    return res.status(500).json({
      error: 'Failed to query cognitive memory',
      message: error.message
    });
  }
});

/**
 * POST /api/prompt-suggest
 * Generates dynamic Socratic prompts based on user's current mood and themes
 */
router.post('/prompt-suggest', async (req, res) => {
  try {
    const { mood, recentThemes } = req.body;
    const data = await generateSocraticPrompts({ mood, recentThemes });
    return res.json({
      success: true,
      ...data
    });
  } catch (error) {
    console.error('[Route /api/prompt-suggest] Error:', error);
    return res.status(500).json({
      error: 'Failed to generate prompts',
      message: error.message
    });
  }
});

export default router;
