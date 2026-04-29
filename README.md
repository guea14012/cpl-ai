# ⚡ CPL-AI — Cyber Programming Language, AI Native

> A production-ready programming language where AI is a first-class citizen, not just a library.

```cpl
agent pentester {
  goal: "Find vulnerabilities in target"
  tools: [scanner, analyzer, exploit_simulator]
}

let result = ai.generate("Analyze attack surface for 192.168.1.1")
memory.store("recon", result.output)

run pentester on "192.168.1.1"
```

---

## Features

| Feature               | Description |
|-----------------------|-------------|
| `ai.generate()`       | Text generation — first-class syntax |
| `ai.analyze()`        | Data analysis with confidence scores |
| `ai.classify()`       | Classification with structured output |
| `ai.chat()`           | Multi-turn conversation |
| `ai.summarize()`      | Intelligent summarization |
| `agent { ... }`       | Autonomous agents with goal + tools |
| `memory.*`            | Persistent, searchable memory |
| `on event { ... }`    | Event-driven AI execution |
| Safety Layer          | Prompt injection protection + audit log |
| Package System        | `cpl install ai-tools` |
| Web Playground        | Monaco editor + live execution |

---

## Quick Start

### 1. Install

```bash
cd KOppaAN
npm install
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

### 2. Run an example

```bash
npx ts-node src/cli/index.ts run examples/chatbot_agent.cpl
npx ts-node src/cli/index.ts run examples/pentest_assistant.cpl
npx ts-node src/cli/index.ts run examples/threat_intelligence.cpl
npx ts-node src/cli/index.ts run examples/log_analyzer.cpl
npx ts-node src/cli/index.ts run examples/bug_finder.cpl
```

### 3. Interactive REPL

```bash
npx ts-node src/cli/index.ts repl
```

### 4. Web Playground

```bash
# Backend
cd playground/backend && npm install && npm run dev

# Frontend (new terminal)
cd playground/frontend && npm install && npm run dev

# Open http://localhost:5173
```

### 5. Package Manager

```bash
cd packages/cpl-cli && npm install
npx ts-node src/index.ts search
npx ts-node src/index.ts install ai-tools security-scanner
npx ts-node src/index.ts list
```

---

## Project Structure

```
KOppaAN/
├── src/
│   ├── lexer/
│   │   ├── tokens.ts          ← Token types & keywords
│   │   └── lexer.ts           ← Tokenizer
│   ├── parser/
│   │   ├── ast.ts             ← AST node types
│   │   └── parser.ts          ← Recursive descent parser
│   ├── runtime/
│   │   ├── interpreter.ts     ← Tree-walking interpreter
│   │   ├── runtime.ts         ← Main runtime + REPL
│   │   ├── ai_engine/
│   │   │   ├── ai_engine.ts   ← AI abstraction layer
│   │   │   ├── prompt_engine.ts ← Prompt optimization
│   │   │   └── providers/
│   │   │       ├── anthropic.ts ← Claude provider
│   │   │       └── openai.ts    ← OpenAI provider
│   │   ├── memory_engine/
│   │   │   ├── memory.ts      ← Short + long-term memory
│   │   │   └── vector_store.ts ← Cosine similarity search
│   │   ├── agent_engine/
│   │   │   ├── agent.ts       ← Agent registry + execution
│   │   │   └── planner.ts     ← Iterative reasoning loop
│   │   └── safety/
│   │       ├── sanitizer.ts   ← Prompt injection protection
│   │       └── logger.ts      ← Audit logging
│   └── cli/
│       └── index.ts           ← CLI (run/repl/check/install/new)
│
├── playground/
│   ├── backend/src/server.ts  ← Express API + WebSocket
│   └── frontend/src/
│       ├── App.tsx            ← Main UI
│       └── components/
│           ├── Editor.tsx     ← Monaco editor + CPL-AI syntax
│           ├── Output.tsx     ← Execution output panel
│           ├── AgentViz.tsx   ← Agent step visualization
│           └── TokenDisplay.tsx ← Token usage + cost
│
├── packages/
│   ├── cpl-cli/               ← Package manager
│   └── stdlib/
│       ├── ai_tools/nlp.cpl   ← NLP tools
│       ├── security/scanner.cpl ← Security scanner tools
│       └── agents/researcher.cpl ← Research agent
│
├── examples/
│   ├── pentest_assistant.cpl  ← AI penetration testing
│   ├── log_analyzer.cpl       ← AI log analysis
│   ├── bug_finder.cpl         ← AI code vulnerability scanner
│   ├── chatbot_agent.cpl      ← Intelligent chatbot
│   └── threat_intelligence.cpl ← CVE + threat intel
│
├── LANGUAGE_SPEC.md           ← Full language specification
├── .env.example               ← Environment config template
├── package.json
└── tsconfig.json
```

---

## CLI Reference

```bash
cpl run <file>          Execute a .cpl file
cpl repl                Start interactive REPL
cpl check <file>        Syntax check only
cpl new <name>          Scaffold new project
cpl install <pkg>       Install a package

# Package manager
cpl-pkg search [query]  Search registry
cpl-pkg install <pkg>   Install package
cpl-pkg remove <pkg>    Remove package
cpl-pkg list            List installed
cpl-pkg info <pkg>      Show package details
```

---

## Language Syntax Cheatsheet

```cpl
// Variables
let x = 42
const name = "CPL-AI"

// AI — all async, built-in
let r = ai.generate("prompt")
let a = ai.analyze(data)
let c = ai.classify(input)
let m = ai.chat([{ role: "user", content: "hi" }])
let s = ai.summarize(text)

// Result structure
log(r.output)        // string
log(r.confidence)    // 0.0 – 1.0
log(r.tokens_used)   // int

// Memory
memory.store("key", value)
let v = memory.get("key")
memory.delete("key")
let results = memory.search("query")
let keys = memory.list()

// Agent
agent myagent {
  goal: "Do something useful"
  tools: [tool1, tool2]
}
run myagent on "target"

// Tool
tool my_tool(input) {
  let r = ai.analyze(input)
  return r.output
}

// Event
on threat_detected {
  alert("Threat: " + data)
}

// Control flow
if x > 0.8 { log("high") }
for item in list { log(item) }
while running { ... }
```

---

## Security

- All `ai.*` inputs are sanitized for prompt injection
- Sensitive data (API keys, passwords) auto-redacted in prompts
- Every AI call logged with timestamp, tokens, provider
- Rate limiting enforced (configurable)
- Output validation for script injection

---

## Supported AI Providers

| Provider    | Models                          | Config |
|-------------|--------------------------------|--------|
| Anthropic   | claude-sonnet-4-6, claude-opus-4-7 | `ANTHROPIC_API_KEY` |
| OpenAI      | gpt-4o, gpt-4-turbo            | `OPENAI_API_KEY` |
| Mock        | (no key needed, for testing)   | auto-fallback |

---

## Examples

| File | Description |
|------|-------------|
| `pentest_assistant.cpl` | Full AI pentest workflow with agent loop |
| `log_analyzer.cpl` | SIEM-style log anomaly detection |
| `bug_finder.cpl` | Static code security analysis |
| `chatbot_agent.cpl` | Context-aware chatbot with memory |
| `threat_intelligence.cpl` | CVE, IoC, threat actor analysis |

---

*Built with CPL-AI — KoppaZZZ 2024*
