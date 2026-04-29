import React from 'react';

interface Step {
  iteration:  number;
  thought:    string;
  action:     string;
  findings:   string[];
  confidence: number;
  result?:    unknown;
  error?:     string;
}

interface Props { steps: Step[]; }

const actionColor = (action: string): string => {
  if (action === 'DONE' || action === 'CONCLUDE') return '#3fb950';
  if (action === 'ERROR') return '#f85149';
  return '#58a6ff';
};

export const AgentViz: React.FC<Props> = ({ steps }) => {
  if (steps.length === 0) {
    return (
      <div style={styles.empty}>
        <span style={{ fontSize: 32 }}>🤖</span>
        <p style={{ color: '#8b949e', marginTop: 8, fontSize: 13 }}>Agent steps will appear here when an agent runs</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Agent Execution Trace</h3>
      {steps.map(step => (
        <div key={step.iteration} style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.iter}>Iteration {step.iteration}</span>
            <span style={{ ...styles.actionBadge, background: actionColor(step.action) + '22', color: actionColor(step.action) }}>
              {step.action}
            </span>
            <span style={styles.confidence}>{(step.confidence * 100).toFixed(0)}% conf.</span>
          </div>

          {step.thought && (
            <div style={styles.thought}>
              <span style={styles.label}>💭 Thought</span>
              <p style={styles.text}>{step.thought}</p>
            </div>
          )}

          {step.findings.length > 0 && (
            <div style={styles.findings}>
              <span style={styles.label}>🔍 Findings</span>
              <ul style={styles.list}>
                {step.findings.map((f, i) => <li key={i} style={styles.listItem}>{f}</li>)}
              </ul>
            </div>
          )}

          {step.result && (
            <div style={styles.result}>
              <span style={styles.label}>⚡ Tool Result</span>
              <pre style={styles.pre}>{typeof step.result === 'string' ? step.result : JSON.stringify(step.result, null, 2)}</pre>
            </div>
          )}

          {step.error && (
            <div style={{ ...styles.result, borderColor: '#f85149' }}>
              <span style={{ ...styles.label, color: '#f85149' }}>✗ Error</span>
              <p style={{ color: '#f85149', fontSize: 12 }}>{step.error}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  empty:       { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5 },
  container:   { display: 'flex', flexDirection: 'column', gap: 10 },
  title:       { fontSize: 13, fontWeight: 700, color: '#8b949e', marginBottom: 4 },
  card:        { background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 },
  cardHeader:  { display: 'flex', alignItems: 'center', gap: 8 },
  iter:        { fontSize: 11, fontWeight: 700, color: '#8b949e' },
  actionBadge: { fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12 },
  confidence:  { fontSize: 11, color: '#484f58', marginLeft: 'auto' },
  thought:     { background: '#0d1117', borderRadius: 6, padding: 8 },
  findings:    { background: '#0d1117', borderRadius: 6, padding: 8 },
  result:      { background: '#0d1117', border: '1px solid #30363d', borderRadius: 6, padding: 8 },
  label:       { fontSize: 10, fontWeight: 700, color: '#8b949e', textTransform: 'uppercase', display: 'block', marginBottom: 4 },
  text:        { fontSize: 12, color: '#e6edf3', lineHeight: '1.5', margin: 0 },
  list:        { paddingLeft: 16, margin: 0 },
  listItem:    { fontSize: 12, color: '#e6edf3', lineHeight: '1.6' },
  pre:         { fontSize: 11, color: '#3fb950', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace' },
};
