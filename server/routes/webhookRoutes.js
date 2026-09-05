import express from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(requireAuth);

/**
 * POST /api/webhooks/dispatch
 * Standout Feature: Dispatch daily 60s briefing & open loops to Discord or Slack
 */
router.post('/dispatch', async (req, res) => {
  try {
    const { webhookUrl, platform, briefing, topPriorities = [] } = req.body;

    if (!webhookUrl || typeof webhookUrl !== 'string') {
      return res.status(400).json({ error: 'Valid webhook URL is required' });
    }

    const prioritiesText = topPriorities.length > 0 
      ? topPriorities.map((p, i) => `${i + 1}. ${p}`).join('\n')
      : 'No pending priority items for today.';

    let payload = {};

    if (platform === 'slack') {
      payload = {
        text: `*( UN ) JOURNAL // MORNING BRIEFING*\n\n> "${briefing?.spoken_audio_script || 'Your morning reflection is ready.'}"\n\n*TOP PRIORITIES:*\n${prioritiesText}`
      };
    } else {
      // Default: Discord Embed format
      payload = {
        username: "UnJournal Bot",
        avatar_url: "https://generativeai.google/favicon.ico",
        embeds: [
          {
            title: "🎙️ ( UN ) MORNING AUDIO BRIEF // 60s",
            description: `*"${briefing?.spoken_audio_script || 'Your morning cognitive reflection is synthesized.'}"*`,
            color: 0xEB0029, // Nothing Red
            fields: [
              {
                name: "🎯 Top 3 Strategic Priorities",
                value: prioritiesText,
                inline: false
              },
              {
                name: "🔒 Privacy & Security",
                value: "Zero-Trust Cloud Run • Multi-Tenant Isolated Firestore",
                inline: true
              }
            ],
            footer: {
              text: "UnJournal • Powered by Gemini 3.6 Flash"
            },
            timestamp: new Date().toISOString()
          }
        ]
      };
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({
        error: `Webhook delivery failed: ${response.status}`,
        details: errText
      });
    }

    return res.json({
      success: true,
      message: 'Briefing dispatched successfully to webhook.',
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('[Route /api/webhooks/dispatch] Error:', err);
    return res.status(500).json({
      error: 'Failed to dispatch webhook',
      details: err.message
    });
  }
});

export default router;
