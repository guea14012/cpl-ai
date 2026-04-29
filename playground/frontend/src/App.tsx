import React, { useState, useEffect, useCallback } from 'react';
import { Editor }       from './components/Editor';
import { Output }       from './components/Output';
import { AgentViz }     from './components/AgentViz';
import { TokenDisplay } from './components/TokenDisplay';

const API = '/api';

const DEFAULT_CODE = `// CPL-AI Playground
// Write AI-native code below and click Run

agent analyst {
  goal: "Analyze security threats"
  tools: [scanner, analyzer]
}

let prompt = "Summarize the top 3 web application security threats in 2024"
let result = ai.generate(prompt)

if result.confidence > 0.8 {
  log(result.output)
  memory.store("last_analysis", result.output)
}

alert("Analysis complete — tokens used: " + result.tokens_used)
`;

interface RunResult {
  success:    boolean;
  error?:     string;
  logs:       string[];
  tokensUsed: number;
  duration:   number;
}

interface Example { id: string; title: string; code: string; }
interface Step    { iteration: number; thought: string; action: string; findings: string[]; }

export default function App() {
  const [code,       setCode]       = useState(DEFAULT_CODE);
  const [running,    setRunning]    = useState(false);
  const [result,     setResult]     = useState<RunResult | null>(null);
  const [apiKey,     setApiKey]     = useState('');
  const [examples,   setExamples]   = useState<Example[]>([]);
  const [agentSteps, setAgentSteps] = useState<Step[]>([]);
  const [shareUrl,   setShareUrl]   = useState('');
  const [savedMsg,   setSavedMsg]   = useState('');
  const [activeTab,  setActiveTab]  = useState<'output' | 'agent' | 'tokens'>('output');

  useEffect(() => {
    fetch(`${API}/examples`).then(r => r.json()).then(setExamples).catch(() => {});
    const params = new URLSearchParams(window.location.search);
    const snipId = params.get('snippet');
    if (snipId) {
      fetch(`${API}/snippets/${snipId}`).then(r => r.json()).then(s => { if (s.code) setCode(s.code); }).catch(() => {});
    }
    const saved = localStorage.getItem('cpl_api_key');
    if (saved) setApiKey(saved);
  }, []);

  const run = useCallback(async () => {
    setRunning(true);
    setResult(null);
    setAgentSteps([]);
    try {
      const res = await fetch(`${API}/run`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ code, apiKey: apiKey || undefined }),
      });
      const data = await res.json() as RunResult;
      setResult(data);
    } catch (err) {
      setResult({ success: false, error: String(err), logs: [], tokensUsed: 0, duration: 0 });
    }
    setRunning(false);
  }, [code, apiKey]);

  const saveSnippet = async () => {
    try {
      const res  = await fetch(`${API}/snippets`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ code, title: 'My CPL-AI snippet' }),
      });
      const data = await res.json() as { shareUrl: string };
      setShareUrl(data.shareUrl);
      setSavedMsg('Snippet saved!');
      setTimeout(() => setSavedMsg(''), 3000);
    } catch { setSavedMsg('Save failed'); }
  };

  const copyShareUrl = () => {
    if (shareUrl) { navigator.clipboard.writeText(shareUrl); setSavedMsg('URL copied!'); setTimeout(() => setSavedMsg(''), 2000); }
  };

  const saveApiKey = () => {
    localStorage.setItem('cpl_api_key', apiKey);
    setSavedMsg('API key saved'); setTimeout(() => setSavedMsg(''), 2000);
  };

  // keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [run]);

  return (
    <div style={styles.root}>
      {/* ── Header ── */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.logo}>⚡ CPL-AI</span>
          <span style={styles.tagline}>Cyber Programming Language · AI Native</span>
        </div>
        <div style={styles.headerRight}>
          <input
            type="password"
            placeholder="Anthropic API Key"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            style={styles.apiInput}
          />
          <button onClick={saveApiKey} style={styles.btnGhost}>Save</button>
          {savedMsg && <span style={styles.savedMsg}>{savedMsg}</span>}
        </div>
      </header>

      {/* ── Toolbar ── */}
      <div style={styles.toolbar}>
        <div style={styles.toolbarLeft}>
          <select
            onChange={e => { const ex = examples.find(x => x.id === e.target.value); if (ex) setCode(ex.code); }}
            style={styles.select}
            defaultValue=""
          >
            <option value="" disabled>Load example…</option>
            {examples.map(ex => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
          </select>
        </div>
        <div style={styles.toolbarRight}>
          <button onClick={saveSnippet} style={styles.btnGhost}>💾 Save</button>
          {shareUrl && <button onClick={copyShareUrl} style={styles.btnGhost}>🔗 Copy URL</button>}
          <button onClick={run} disabled={running} style={styles.btnRun}>
            {running ? '⏳ Running…' : '▶ Run  (Ctrl+Enter)'}
          </button>
        </div>
      </div>

      {/* ── Main panels ── */}
      <div style={styles.main}>
        {/* Left: code editor */}
        <div style={styles.editorPane}>
          <Editor code={code} onChange={setCode} />
        </div>

        {/* Right: output tabs */}
        <div style={styles.outputPane}>
          <div style={styles.tabs}>
            {(['output', 'agent', 'tokens'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{ ...styles.tab, ...(activeTab === tab ? styles.tabActive : {}) }}
              >
                {tab === 'output' ? '📄 Output' : tab === 'agent' ? '🤖 Agent' : '📊 Tokens'}
              </button>
            ))}
          </div>
          <div style={styles.tabContent}>
            {activeTab === 'output' && <Output result={result} running={running} />}
            {activeTab === 'agent'  && <AgentViz steps={agentSteps} />}
            {activeTab === 'tokens' && <TokenDisplay result={result} />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Inline styles (dark theme) ───────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root:        { display: 'flex', flexDirection: 'column', height: '100vh', background: '#0d1117', color: '#e6edf3' },
  header:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', background: '#161b22', borderBottom: '1px solid #30363d' },
  headerLeft:  { display: 'flex', alignItems: 'center', gap: 12 },
  logo:        { fontSize: 20, fontWeight: 700, color: '#58a6ff' },
  tagline:     { fontSize: 12, color: '#8b949e' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 8 },
  apiInput:    { background: '#0d1117', border: '1px solid #30363d', borderRadius: 6, padding: '4px 8px', color: '#e6edf3', fontSize: 12, width: 220 },
  btnGhost:    { background: 'transparent', border: '1px solid #30363d', borderRadius: 6, color: '#8b949e', padding: '4px 10px', cursor: 'pointer', fontSize: 12 },
  savedMsg:    { fontSize: 12, color: '#3fb950' },
  toolbar:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 16px', background: '#161b22', borderBottom: '1px solid #30363d' },
  toolbarLeft: { display: 'flex', gap: 8 },
  toolbarRight:{ display: 'flex', gap: 8, alignItems: 'center' },
  select:      { background: '#0d1117', border: '1px solid #30363d', borderRadius: 6, color: '#e6edf3', padding: '4px 8px', fontSize: 12 },
  btnRun:      { background: '#238636', border: 'none', borderRadius: 6, color: '#fff', padding: '6px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  main:        { display: 'flex', flex: 1, overflow: 'hidden' },
  editorPane:  { flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #30363d', minWidth: 0 },
  outputPane:  { width: 480, display: 'flex', flexDirection: 'column', minWidth: 0 },
  tabs:        { display: 'flex', background: '#161b22', borderBottom: '1px solid #30363d' },
  tab:         { flex: 1, padding: '8px', background: 'transparent', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: 12 },
  tabActive:   { color: '#58a6ff', borderBottom: '2px solid #58a6ff' },
  tabContent:  { flex: 1, overflow: 'auto', padding: 12 },
};
