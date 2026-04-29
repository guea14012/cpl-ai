import React from 'react';

interface RunResult {
  success:    boolean;
  tokensUsed: number;
  duration:   number;
  logs:       string[];
}

interface Props { result: RunResult | null; }

const PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6': { input: 3.00,  output: 15.00  },
  'claude-opus-4-7':   { input: 15.00, output: 75.00  },
  'claude-haiku-4-5':  { input: 0.25,  output: 1.25   },
  'gpt-4o':            { input: 5.00,  output: 15.00  },
};

export const TokenDisplay: React.FC<Props> = ({ result }) => {
  if (!result) {
    return (
      <div style={styles.empty}>
        <span style={{ fontSize: 32 }}>📊</span>
        <p style={{ color: '#8b949e', marginTop: 8 }}>Token usage appears after running</p>
      </div>
    );
  }

  const tokens  = result.tokensUsed;
  const model   = 'claude-sonnet-4-6';
  const price   = PRICING[model];
  const estCost = tokens > 0 && price ? ((tokens / 2 * price.input + tokens / 2 * price.output) / 1_000_000).toFixed(6) : '0.000000';

  const logsPerCategory: Record<string, number> = {};
  for (const log of result.logs) {
    const match = log.match(/\[([A-Z_]+)\]/);
    if (match) logsPerCategory[match[1]] = (logsPerCategory[match[1]] ?? 0) + 1;
  }

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Token Usage</h3>

      <div style={styles.bigStat}>
        <span style={styles.bigNum}>{tokens.toLocaleString()}</span>
        <span style={styles.bigLabel}>tokens used</span>
      </div>

      <div style={styles.grid}>
        <StatCard label="Duration"   value={`${result.duration}ms`} color="#58a6ff" />
        <StatCard label="Est. Cost"  value={`$${estCost}`}          color="#3fb950" />
        <StatCard label="Log Lines"  value={String(result.logs.length)} color="#a371f7" />
        <StatCard label="Status"     value={result.success ? 'OK' : 'ERR'} color={result.success ? '#3fb950' : '#f85149'} />
      </div>

      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>Model Pricing Reference</h4>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Model</th>
              <th style={styles.th}>Input /1M</th>
              <th style={styles.th}>Output /1M</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(PRICING).map(([m, p]) => (
              <tr key={m} style={{ background: m === model ? '#1a2a3a' : 'transparent' }}>
                <td style={styles.td}>{m}</td>
                <td style={styles.td}>${p.input.toFixed(2)}</td>
                <td style={styles.td}>${p.output.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {Object.keys(logsPerCategory).length > 0 && (
        <div style={styles.section}>
          <h4 style={styles.sectionTitle}>Event Categories</h4>
          {Object.entries(logsPerCategory).map(([cat, count]) => (
            <div key={cat} style={styles.catRow}>
              <span style={styles.catName}>{cat}</span>
              <div style={styles.bar}>
                <div style={{ ...styles.barFill, width: `${Math.min(100, count * 20)}%` }} />
              </div>
              <span style={styles.catCount}>{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '12px', textAlign: 'center' }}>
    <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
    <div style={{ fontSize: 11, color: '#8b949e', marginTop: 2 }}>{label}</div>
  </div>
);

const styles: Record<string, React.CSSProperties> = {
  empty:        { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5 },
  container:    { display: 'flex', flexDirection: 'column', gap: 14 },
  title:        { fontSize: 13, fontWeight: 700, color: '#8b949e' },
  bigStat:      { textAlign: 'center', padding: '16px 0' },
  bigNum:       { display: 'block', fontSize: 48, fontWeight: 700, color: '#58a6ff' },
  bigLabel:     { display: 'block', fontSize: 12, color: '#8b949e', marginTop: 4 },
  grid:         { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  section:      { background: '#161b22', borderRadius: 8, padding: 12, border: '1px solid #30363d' },
  sectionTitle: { fontSize: 11, fontWeight: 700, color: '#8b949e', marginBottom: 8, textTransform: 'uppercase' },
  table:        { width: '100%', borderCollapse: 'collapse', fontSize: 11 },
  th:           { textAlign: 'left', color: '#8b949e', padding: '4px 8px', borderBottom: '1px solid #30363d' },
  td:           { color: '#e6edf3', padding: '4px 8px', fontFamily: 'monospace' },
  catRow:       { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 },
  catName:      { width: 80, fontSize: 11, color: '#8b949e', fontFamily: 'monospace' },
  bar:          { flex: 1, height: 6, background: '#30363d', borderRadius: 3, overflow: 'hidden' },
  barFill:      { height: '100%', background: '#58a6ff', borderRadius: 3, transition: 'width 0.3s' },
  catCount:     { width: 24, fontSize: 11, color: '#e6edf3', textAlign: 'right' },
};
