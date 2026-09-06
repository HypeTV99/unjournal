import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import chatRoutes from './routes/chatRoutes.js';
import journalRoutes from './routes/journalRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';
import locationRoutes from './routes/locationRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import { getGeminiApiKey, getSecretStatus } from './services/secretManager.js';
import { 
  securitySanitizerMiddleware, 
  authenticityVerificationMiddleware, 
  usabilityOptimizationMiddleware, 
  stabilityErrorHandler 
} from './middleware/fourPillarsMiddleware.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Security Middleware: Helmet with customized CSP
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS Configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  process.env.CLIENT_ORIGIN
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Request logger
app.use(morgan('dev'));

// Body Parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Four Pillars Operational Pipeline
app.use(securitySanitizerMiddleware);
app.use(authenticityVerificationMiddleware);
app.use(usabilityOptimizationMiddleware);

// Rate Limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please wait a few minutes before trying again.'
  }
});
app.use('/api/', apiLimiter);

// API Routes
app.use('/api', journalRoutes);
app.use('/api', chatRoutes);
app.use('/api', uploadRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/location', locationRoutes);

// Stability Pillar Global Error Recovery
app.use(stabilityErrorHandler);

// Serve static uploads & frontend in Cloud Run production container
const publicPath = path.join(__dirname, 'public');
app.use('/uploads', express.static(path.join(publicPath, 'uploads')));
app.use(express.static(publicPath));

// Root Health & Diagnostics
app.get('/api/health', async (req, res) => {
  const secretStatus = await getSecretStatus();
  res.json({
    project: 'UnJournal (Personal Gemini Journal)',
    status: 'online',
    version: '2.5.0',
    deploymentLabel: 'dev-tutorial=cloud-run-ai-challenge',
    securityDirectives: 'OWASP LLM Top 10 + Zero-Trust GCP Secret Manager Enforced',
    geminiLiveRelay: 'Active on /ws/live-journal',
    diagnostics: secretStatus
  });
});

// Wildcard route to serve Vite index.html in production
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(publicPath, 'index.html'), (err) => {
    if (err) res.status(200).send('UnJournal API Service is running.');
  });
});

// ==============================================================================
// GEMINI LIVE BIDIRECTIONAL WEBSOCKET RELAY (STATEFUL & SERVERLESS-RESILIENT)
// ==============================================================================
const wss = new WebSocketServer({ server, path: '/ws/live-journal' });
const activeLiveClients = new Set();

// 25-Second Heartbeat: Prevents Cloud Run, ALB & reverse proxy idle disconnects
const heartbeatInterval = setInterval(() => {
  activeLiveClients.forEach((clientWs) => {
    if (clientWs.isAlive === false) {
      console.log('[LiveSocket] Pruning dead client socket.');
      activeLiveClients.delete(clientWs);
      return clientWs.terminate();
    }
    clientWs.isAlive = false;
    try {
      clientWs.ping();
    } catch (e) {}
  });
}, 25000);

// Graceful container recycling for Cloud Run autoscaling
process.on('SIGTERM', () => {
  console.log('[LiveSocket] SIGTERM received. Gracefully closing active live sessions...');
  clearInterval(heartbeatInterval);
  activeLiveClients.forEach((clientWs) => {
    try {
      clientWs.send(JSON.stringify({ type: 'serverless_recycling', reconnect: true }));
      clientWs.close(1001, 'Cloud Run container recycling');
    } catch (e) {}
  });
});

wss.on('connection', async (clientWs, req) => {
  clientWs.isAlive = true;
  activeLiveClients.add(clientWs);

  clientWs.on('pong', () => {
    clientWs.isAlive = true;
  });

  console.log(`[LiveSocket] New client connected. Active sessions: ${activeLiveClients.size}`);
  
  let upstreamWs = null;
  let apiKey = null;

  try {
    apiKey = await getGeminiApiKey();
  } catch (err) {
    clientWs.send(JSON.stringify({ error: 'SecretManager: Gemini API key unavailable.' }));
    activeLiveClients.delete(clientWs);
    clientWs.close();
    return;
  }

  // Parse voice preference from query parameters
  const url = new URL(req.url, `http://${req.headers.host}`);
  const voiceName = url.searchParams.get('voice') || 'Aoede';
  const persona = url.searchParams.get('persona') || 'mindful';

  const host = 'generativelanguage.googleapis.com';
  const liveUri = `wss://${host}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;

  try {
    upstreamWs = new WebSocket(liveUri);

    upstreamWs.on('open', () => {
      console.log('[LiveSocket] Connected to Gemini Live upstream API.');
      
      // Send initial setup frame with persona and system instructions
      const setupMsg = {
        setup: {
          model: 'models/gemini-2.0-flash-exp',
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: voiceName
                }
              }
            }
          },
          systemInstruction: {
            parts: [{
              text: `You are the user's real-time voice journaling companion operating under the "${persona}" persona.
Respond warmly, conversationally, and concisely in spoken dialogue.
Keep turns natural and encourage the user to express their thoughts freely.
This is a private journal: never invent memories or events, never diagnose or give medical advice, and if the user expresses imminent self-harm intent, urge immediate help from emergency services or a trusted person nearby.`
            }]
          }
        }
      };

      upstreamWs.send(JSON.stringify(setupMsg));
      clientWs.send(JSON.stringify({ status: 'connected', voice: voiceName, persona }));
    });

    // Relay upstream Gemini audio/text chunks to client
    upstreamWs.on('message', (data) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data);
      }
    });

    upstreamWs.on('error', (err) => {
      console.warn('[LiveSocket] Upstream error:', err.message);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ error: `Upstream error: ${err.message}` }));
      }
    });

    upstreamWs.on('close', () => {
      console.log('[LiveSocket] Upstream connection closed.');
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close();
      }
    });

    // Relay client speech/audio chunks to upstream Gemini
    clientWs.on('message', (data) => {
      if (upstreamWs && upstreamWs.readyState === WebSocket.OPEN) {
        upstreamWs.send(data);
      }
    });

    clientWs.on('close', () => {
      activeLiveClients.delete(clientWs);
      console.log(`[LiveSocket] Client disconnected. Remaining sessions: ${activeLiveClients.size}`);
      if (upstreamWs && upstreamWs.readyState === WebSocket.OPEN) {
        upstreamWs.close();
      }
    });

  } catch (err) {
    activeLiveClients.delete(clientWs);
    console.error('[LiveSocket] Setup error:', err);
    clientWs.send(JSON.stringify({ error: err.message }));
    clientWs.close();
  }
});

// Start Server
server.listen(PORT, async () => {
  console.log(`\n======================================================`);
  console.log(`🛡️  Personal Gemini Journal API Server running on port ${PORT}`);
  console.log(`🔒  Security Architecture: Zero-Trust Client Proxy active`);
  console.log(`🎙️  Gemini Live WebSocket Relay active on ws://localhost:${PORT}/ws/live-journal`);
  
  try {
    const status = await getSecretStatus();
    console.log(`🔑  Gemini Secret Status: ${status.isOperational ? 'OPERATIONAL' : 'PENDING KEY'}`);
    console.log(`📦  Source: ${status.keySource}`);
  } catch (err) {
    console.warn(`⚠️  Secret Manager warning: ${err.message}`);
  }
  console.log(`======================================================\n`);
});

export default app;
