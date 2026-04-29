# CPL-AI Language Specification v1.0
> Cyber Programming Language — AI Native

---

## 1. Overview

CPL-AI is an AI-first programming language where AI primitives (`ai.*`, `memory.*`, `agent`, `tool`) are built into the syntax — not imported from a library. The runtime is async by default, type-safe, and includes a prompt sanitization and audit logging layer.

---

## 2. Core Principles

| Principle           | Description |
|---------------------|-------------|
| AI-First            | `ai.*` is a first-class language construct, not a library call |
| Async by Default    | All AI operations are implicitly awaited |
| Secure by Default   | Prompt injection protection and output validation built in |
| Declarative Agents  | Agents are language-level constructs with `goal` and `tools` |
| Auditable           | Every AI call is automatically logged |

---

## 3. Syntax

### 3.1 Variables

```cpl
let name: string = "Alice"
const MAX_TOKENS: int = 4096
let data = { key: "value", count: 42 }
let items = ["a", "b", "c"]
```

### 3.2 AI Core

All `ai.*` calls return an `AIResult` object:
```
{
  output:      string    // AI-generated text
  confidence:  float     // 0.0 – 1.0 confidence score
  tokens_used: int       // tokens consumed
  provider:    string    // "anthropic" | "openai" | "mock"
  model:       string    // model identifier
}
```

```cpl
// Generate text
let result = ai.generate("Explain TCP handshake in 3 sentences")
log(result.output)

// Analyze data
let analysis = ai.analyze(log_data)
if analysis.confidence > 0.8 {
  alert(analysis.output)
}

// Classify input
let label = ai.classify("SELECT * FROM users WHERE 1=1")
log(label.output)

// Chat (multi-turn)
let messages = [
  { role: "user", content: "What is XSS?" }
]
let reply = ai.chat(messages)

// Summarize
let summary = ai.summarize(long_text)
```

### 3.3 Memory System

```cpl
// Store (optional TTL in seconds)
memory.store("key", value)
memory.store("session", data, 3600)   // expires in 1 hour

// Retrieve
let val = memory.get("key")

// Delete
memory.delete("key")

// Semantic search
let similar = memory.search("port scan results")

// List all keys
let keys = memory.list()

// Build context string for AI prompts
let ctx = memory.context()
let ctx = memory.context(["key1", "key2"])  // specific keys only
```

### 3.4 Agents

```cpl
agent <name> {
  goal:  "What this agent must accomplish"
  tools: [tool1, tool2, tool3]
}

// Run agent against a target
run <agent_name> on <target_expression>
```

The agent engine uses an iterative reasoning loop:
1. Build prompt with goal + tools + findings so far
2. Ask AI: thought → action → action_input
3. Execute chosen tool
4. Append findings to memory
5. Repeat until `DONE` or max iterations

### 3.5 Tools

```cpl
tool <name>(<param1>, <param2>) {
  // tool body — can use ai.*, memory.*, call other tools
  let result = ai.analyze(param1)
  return result.output
}
```

Tools are automatically registered to the agent engine and can be called by agents.

### 3.6 Event-Driven AI

```cpl
on <event_name> {
  // `data` is automatically bound to the event payload
  let insight = ai.analyze(data)
  if insight.confidence > 0.7 {
    alert(insight.output)
  }
}

// Trigger events programmatically (from runtime/host)
// runtime.triggerEvent("new_data", payload)
```

### 3.7 Control Flow

```cpl
if condition {
  // ...
} else if other {
  // ...
} else {
  // ...
}

for item in collection {
  // ...
}

while condition {
  // ...
}
```

### 3.8 Functions

```cpl
tool my_function(a, b) {
  return a + b
}

async my_async_fn(x) {
  let r = await ai.generate(x)
  return r
}
```

### 3.9 Imports

```cpl
import security.scanner
import { nlp_sentiment, nlp_summarize } from ai_tools.nlp
import my_custom_module
```

---

## 4. Type System

| Type          | Description                          | Example |
|---------------|--------------------------------------|---------|
| `string`      | UTF-8 text                           | `"hello"` |
| `int`         | Integer number                       | `42` |
| `float`       | Floating point                       | `3.14` |
| `bool`        | Boolean                              | `true`, `false` |
| `null`        | Null/absent value                    | `null` |
| `array`       | Ordered list                         | `[1, 2, 3]` |
| `object`      | Key-value map                        | `{ key: val }` |
| `AIResult`    | Result of any `ai.*` call            | `{ output, confidence, tokens_used }` |
| `Agent`       | Agent declaration reference          | `agent pentester { ... }` |
| `Tool`        | Tool function reference              | `tool scan(target) { ... }` |

Type annotations are optional (inference is used):
```cpl
let score: float = 0.95
let name: string = "target"
```

---

## 5. Security Model

### 5.1 Prompt Sanitization
All string inputs to `ai.*` are automatically screened for:
- Prompt injection patterns (`ignore previous instructions`, `jailbreak`, etc.)
- Sensitive data (API keys, passwords, JWTs, credit cards) — redacted automatically
- Malicious code patterns (`eval()`, `exec()`, `os.system()`)

Blocked prompts throw a runtime error.

### 5.2 Output Validation
All `ai.*` outputs are screened for:
- Script injection (`<script>` tags)
- Unexpected code execution markers

### 5.3 Audit Logging
Every AI call is logged with:
```json
{
  "timestamp": "2024-01-15T10:00:00Z",
  "level": "INFO",
  "category": "AI_CALL",
  "data": {
    "method": "generate",
    "tokens_used": 256,
    "provider": "anthropic",
    "elapsed_ms": 1240
  },
  "sessionId": "session-xyz"
}
```

Enable file logging:
```
CPL_LOG_FILE=./cpl-audit.log
```

### 5.4 Rate Limiting
Default: 60 AI calls per minute. Configure:
```
CPL_RATE_LIMIT=30
```

---

## 6. Runtime Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CPL-AI Source (.cpl)                 │
└──────────────────────────┬──────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │    Lexer    │  tokenize()
                    └──────┬──────┘
                           │ Token[]
                    ┌──────▼──────┐
                    │    Parser   │  parse()
                    └──────┬──────┘
                           │ AST (Program)
                    ┌──────▼──────┐
                    │ Interpreter │  eval()
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
  ┌──────▼──────┐  ┌───────▼──────┐  ┌──────▼──────┐
  │  AI Engine  │  │Memory Engine │  │Agent Engine │
  │  ─────────  │  │  ──────────  │  │  ─────────  │
  │ Anthropic   │  │ Short-term   │  │  Planner    │
  │ OpenAI      │  │ Vector store │  │  Tool exec  │
  │ Prompt opt. │  │ Persistence  │  │  Reasoning  │
  └──────┬──────┘  └──────┬───────┘  └──────┬──────┘
         │                │                 │
         └────────────────┼─────────────────┘
                          │
                   ┌──────▼──────┐
                   │Safety Layer │
                   │  ─────────  │
                   │ Sanitizer   │
                   │ Audit Log   │
                   │ Rate limit  │
                   └─────────────┘
```

---

## 7. Grammar (EBNF)

```ebnf
program       ::= statement*

statement     ::= let_decl
               | agent_decl
               | tool_decl
               | on_decl
               | run_stmt
               | import_stmt
               | if_stmt
               | for_stmt
               | while_stmt
               | return_stmt
               | log_stmt
               | alert_stmt
               | expr_stmt

let_decl      ::= ("let" | "const") IDENT (":" TYPE)? "=" expr ";"?
agent_decl    ::= "agent" IDENT "{" ("goal" ":" STRING)? ("tools" ":" "[" ident_list "]")? statement* "}"
tool_decl     ::= "tool" IDENT "(" param_list ")" block
on_decl       ::= "on" IDENT block
run_stmt      ::= "run" IDENT "on" expr ";"?
import_stmt   ::= "import" ("{" ident_list "}" "from")? (IDENT | STRING) ";"?

if_stmt       ::= "if" expr block ("else" (if_stmt | block))?
for_stmt      ::= "for" IDENT "in" expr block
while_stmt    ::= "while" expr block
return_stmt   ::= "return" expr? ";"?
log_stmt      ::= "log" "(" expr ")" ";"?
alert_stmt    ::= "alert" "(" expr ")" ";"?
expr_stmt     ::= expr ";"?

block         ::= "{" statement* "}"
param_list    ::= (IDENT (":" TYPE)? ("," IDENT (":" TYPE)?)*)?
ident_list    ::= (IDENT ("," IDENT)*)?

expr          ::= assign
assign        ::= or ("=" assign)?
or            ::= and ("||" and)*
and           ::= equality ("&&" equality)*
equality      ::= comparison (("==" | "!=") comparison)*
comparison    ::= add ((">" | ">=" | "<" | "<=") add)*
add           ::= mul (("+" | "-") mul)*
mul           ::= unary (("*" | "/") unary)*
unary         ::= ("!" | "-") unary | "await" call_member | call_member
call_member   ::= primary (("." IDENT args?) | ("[" expr "]") | args)*

primary       ::= STRING | NUMBER | "true" | "false" | "null"
               | "ai" "." IDENT args
               | "memory" "." IDENT args
               | "[" expr_list "]"
               | "{" obj_prop* "}"
               | "(" expr ")"
               | IDENT

ai_expr       ::= "ai" "." ("generate" | "analyze" | "classify" | "chat" | "summarize") args
memory_expr   ::= "memory" "." ("store" | "get" | "delete" | "search" | "list" | "context") args

args          ::= "(" expr_list ")"
expr_list     ::= (expr ("," expr)*)?
obj_prop      ::= IDENT ":" expr ","?
TYPE          ::= "string" | "int" | "float" | "bool" | "array" | "object" | "AIResult" | IDENT
```

---

## 8. Standard Library

### ai_tools.nlp
```cpl
nlp_sentiment(text)        → AIResult
nlp_summarize(text)        → AIResult
nlp_extract_entities(text) → AIResult
nlp_translate(text, lang)  → AIResult
nlp_intent(text)           → AIResult
nlp_keywords(text)         → AIResult
```

### security.scanner
```cpl
scan_ports(target)         → JSON string
analyze_headers(headers)   → AIResult
check_ssl(domain)          → AIResult
detect_waf(target)         → AIResult
vuln_scan(target)          → AIResult
generate_report(t, f)      → string
```

---

## 9. Configuration

| Variable            | Default            | Description |
|---------------------|--------------------|-------------|
| `CPL_PROVIDER`      | `anthropic`        | AI provider |
| `ANTHROPIC_API_KEY` | —                  | Anthropic key |
| `OPENAI_API_KEY`    | —                  | OpenAI key (optional) |
| `CPL_MODEL`         | `claude-sonnet-4-6`| Model ID |
| `CPL_MAX_TOKENS`    | `4096`             | Max tokens per call |
| `CPL_RATE_LIMIT`    | `60`               | Calls per minute |
| `CPL_DEBUG`         | `false`            | Debug/verbose logging |
| `CPL_LOG_FILE`      | —                  | Audit log file path |
| `CPL_MEMORY_BACKEND`| `memory`           | `memory` or `file` |

---

## 10. Error Handling

```cpl
// Runtime errors throw with descriptive messages:
// - "Undefined variable: X"
// - "Cannot access 'property' of null"
// - "[Safety] Prompt blocked: injection pattern detected"
// - "[CPL-AI] Rate limit exceeded"
// - "[Parser] Expected RBRACE, got EOF"

// Use ai.* result confidence to handle low-quality outputs:
let result = ai.generate(prompt)
if result.confidence < 0.5 {
  alert("Low confidence response — verify manually")
}
```

---

*CPL-AI Language Specification v1.0 — KoppaZZZ / 2024*
