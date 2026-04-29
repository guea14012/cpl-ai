import React, { useEffect, useRef } from 'react';

interface RunResult {
  success:    boolean;
  error?:     string;
  logs:       string[];
  tokensUsed: number;
  duration:   number;
}

interface Props {
  result:  RunResult | null;
  running: boolean;
}

function colorLine(line: string): React.CSSProperties {
  if (line.startsWith('[LOG]'))   return { color: '#3fb950' };
  if (line.startsWith('⚠ [ALERT]') || line.startsWith('[ALERT]')) return { color: '#d29922' };
  if (line.startsWith('[AGENT:')) return { color: '#58a6ff' };
  if (line.startsWith('[RUN]'))   return { color: '#a371f7' };
  if (line.startsWith('[Error]') || line.includes('Error:')) return { color: '#f85149' };
  if (line.startsWith('━'))       return { color: '#30363d' };
  return { color: '#e6edf3' };
}

export const Output: React.FC<Props> = ({ result, running }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [result]);

  if (running) {
    return (
      <div style={styles.container}>
        <div style={styles.spinner}>
          <div style={styles.dots}>
            <span style={{ animationDelay: '0ms' }}>●</span>
            <span style={{ animationDelay: '200ms' }}>●</span>
            <span style={{ animationDelay: '400ms' }}>●</span>
          </div>
          <p style={{ color: '#8b949e', fontSize: 13, marginTop: 8 }}>Executing CPL-AI program…</p>
        </div>
        <style>{`
          @keyframes pulse { 0%,100% { opacity:.3 } 50% { opacity:1 } }
          .dots span { display:inline-block; margin:0 3px; color:#58a6ff; font-size:18px; animation: pulse 1s infinite; }
        `}</style>
      </div>
    );
  }

  if (!result) {
    return (
      <div style={styles.container}>
        <div style={styles.empty}>
          <span style={{ fontSize: 32 }}>▶</span>
          <p style={{ color: '#8b949e', marginTop: 8 }}>Press Run or Ctrl+Enter to execute</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Status bar */}
      <div style={{ ...styles.statusBar, background: result.success ? '#1a3a2a' : '#3d1a1a' }}>
        <span style={{ color: result.success ? '#3fb950' : '#f85149', fontWeight: 700 }}>
          {result.success ? '✓ SUCCESS' : '✗ FAILED'}
        </span>
        <span style={{ color: '#8b949e', fontSize: 11 }}>
          {result.duration}ms · {result.tokensUsed} tokens
        </span>
      </div>

      {/* Error */}
      {result.error && (
        <div style={styles.errorBox}>
          <strong>Error:</strong> {result.error}
        </div>
      )}

      {/* Logs */}
      <div style={styles.logArea}>
        {result.logs.length === 0 && (
          <p style={{ color: '#484f58', fontSize: 12, fontStyle: 'italic' }}>No output</p>
        )}
        {result.logs.map((line, i) => (
          <div key={i} style={{ ...styles.logLine, ...colorLine(line) }}>
            {line}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', height: '100%', gap: 8 },
  spinner:   { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, opacity: 0.8 },
  dots:      { display: 'flex', gap: 4 },
  empty:     { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, opacity: 0.4 },
  statusBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderRadius: 6, fontSize: 12 },
  errorBox:  { background: '#3d1a1a', border: '1px solid #f85149', borderRadius: 6, padding: '8px 10px', fontSize: 12, color: '#f85149', whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  logArea:   { flex: 1, overflowY: 'auto', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, lineHeight: '1.6' },
  logLine:   { padding: '1px 4px', borderRadius: 2, whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
};
