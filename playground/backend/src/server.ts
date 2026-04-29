import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { v4 as uuid } from 'uuid';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import rateLimit from 'express-rate-limit';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../..', '.env') });

// Lazy-load CPL-AI runtime to avoid circular import at startup
function createRuntime(apiKey?: string) {
  const { CPLRuntime } = require('../../../src/runtime/runtime');
  return new CPLRuntime({ apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY });
}

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocketServer({ server });
const PORT   = process.env.PORT ?? 3001;

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3000'] }));
app.use(express.json({ limit: '256kb' }));

const limiter = rateLimit({
  windowMs: 60_000,
  max:      30,
  message:  { error: 'Too many requests, please slow down' },
});
app.use('/api/', limiter);

// ─── In-memory snippet store ──────────────────────────────────────────────────

interface Snippet {
  id:        string;
  title:     string;
  code:      string;
  createdAt: string;
  shareUrl?: string;
}
const snippets = new Map<string, Snippet>();

// ─── WebSocket: streaming execution ──────────────────────────────────────────

const wsClients = new Map<string, WebSocket>();

wss.on('connection', (ws: WebSocket) => {
  const id = uuid();
  wsClients.set(id, ws);
  ws.send(JSON.stringify({ type: 'connected', clientId: id }));
  ws.on('close', () => wsClients.delete(id));
});

function broadcast(clientId: string, data: unknown): void {
  const ws = wsClients.get(clientId);
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}

// ─── REST API ─────────────────────────────────────────────────────────────────

// POST /api/run — execute CPL-AI code
app.post('/api/run', async (req: Request, res: Response) => {
  const { code, apiKey, clientId } = req.body as { code?: string; apiKey?: string; clientId?: string };

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'code is required' });
  }
  if (code.length > 8000) {
    return res.status(400).json({ error: 'Code too long (max 8000 chars)' });
  }

  // Capture console.log during execution
  const logs:   string[] = [];
  const alerts: string[] = [];
  const origLog   = console.log.bind(console);
  const origError = console.error.bind(console);

  console.log = (...args: unknown[]) => {
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ');
    logs.push(msg);
    if (clientId) broadcast(clientId, { type: 'log', message: msg });
    origLog(...args);
  };

  try {
    const runtime = createRuntime(apiKey);
    const result  = await runtime.runSource(code);

    console.log = origLog;
    console.error = origError;

    res.json({
      success:    result.success,
      error:      result.error,
      logs,
      alerts,
      tokensUsed: result.tokensUsed,
      duration:   result.duration,
    });
  } catch (err) {
    console.log = origLog;
    console.error = origError;
    res.status(500).json({ success: false, error: String(err), logs, alerts, tokensUsed: 0, duration: 0 });
  }
});

// POST /api/snippets — save snippet
app.post('/api/snippets', (req: Request, res: Response) => {
  const { code, title } = req.body as { code?: string; title?: string };
  if (!code) return res.status(400).json({ error: 'code required' });

  const id = uuid().slice(0, 8);
  const snippet: Snippet = {
    id,
    title:     title ?? 'Untitled',
    code,
    createdAt: new Date().toISOString(),
    shareUrl:  `http://localhost:${PORT}/playground?snippet=${id}`,
  };
  snippets.set(id, snippet);
  res.json({ id, shareUrl: snippet.shareUrl });
});

// GET /api/snippets/:id — load snippet
app.get('/api/snippets/:id', (req: Request, res: Response) => {
  const s = snippets.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Snippet not found' });
  res.json(s);
});

// GET /api/snippets — list all snippets
app.get('/api/snippets', (_req: Request, res: Response) => {
  res.json([...snippets.values()].map(s => ({ id: s.id, title: s.title, createdAt: s.createdAt })));
});

// GET /api/examples — return built-in example programs
app.get('/api/examples', (_req: Request, res: Response) => {
  const examples = [
    {
      id:    'hello',
      title: 'Hello CPL-AI',
      code:  `let result = ai.generate("Say hello from CPL-AI in one creative sentence")
log(result.output)
log("Confidence: " + result.confidence)`,
    },
    {
      id:    'agent',
      title: 'Pentest Agent',
      code:  `agent pentester {
  goal: "Find vulnerabilities in target"
  tools: [scanner, analyzer, exploit_simulator]
}

memory.store("session", "pentest-2024")
run pentester on "192.168.1.1"`,
    },
    {
      id:    'chatbot',
      title: 'Chatbot Agent',
      code:  `let messages = [
  { role: "user", content: "What is prompt injection?" }
]

let response = ai.chat(messages)
log(response.output)

memory.store("last_response", response.output)
let saved = memory.get("last_response")
log("Saved to memory: " + saved)`,
    },
    {
      id:    'classifier',
      title: 'Threat Classifier',
      code:  `let threats = [
  "SELECT * FROM users WHERE id=1 OR 1=1",
  "Hello, how are you?",
  "<script>alert('xss')</script>",
  "ls -la /etc/passwd"
]

for threat in threats {
  let result = ai.classify(threat)
  log("Input: " + threat)
  log("Classification: " + result.output)
  log("---")
}`,
    },
    {
      id:    'memory',
      title: 'Memory System Demo',
      code:  `memory.store("target_ip", "10.0.0.1")
memory.store("open_ports", [22, 80, 443])
memory.store("risk_level", "HIGH")

let ip    = memory.get("target_ip")
let ports = memory.get("open_ports")
let risk  = memory.get("risk_level")

log("Target: " + ip)
log("Ports: " + JSON.stringify(ports))
log("Risk: " + risk)

let keys = memory.list()
log("All memory keys: " + JSON.stringify(keys))`,
    },
  ];
  res.json(examples);
});

// GET /api/health
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', version: '1.0.0', provider: process.env.CPL_PROVIDER ?? 'anthropic' });
});

// ─── Error handler ────────────────────────────────────────────────────────────

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Server Error]', err.message);
  res.status(500).json({ error: err.message });
});

server.listen(PORT, () => {
  console.log(`\x1b[36m[CPL-AI Playground Backend]\x1b[0m listening on http://localhost:${PORT}`);
  console.log(`  WebSocket: ws://localhost:${PORT}`);
  console.log(`  Provider:  ${process.env.CPL_PROVIDER ?? 'anthropic'}`);
});
