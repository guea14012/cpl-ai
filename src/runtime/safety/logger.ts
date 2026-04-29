import fs from 'fs';
import path from 'path';

export interface LogEntry {
  timestamp: string;
  level: string;
  category: string;
  data: unknown;
  sessionId: string;
}

export class AuditLogger {
  private entries: LogEntry[] = [];
  private sessionId: string;
  private logFile: string | null;
  private debugMode: boolean;

  constructor() {
    this.sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.logFile   = process.env.CPL_LOG_FILE ?? null;
    this.debugMode = process.env.CPL_DEBUG === 'true';
  }

  log(category: string, data: unknown, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO'): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      data,
      sessionId: this.sessionId,
    };
    this.entries.push(entry);

    if (this.debugMode) {
      const col = level === 'ERROR' ? '\x1b[31m' : level === 'WARN' ? '\x1b[33m' : '\x1b[36m';
      console.error(`${col}[AUDIT/${category}]\x1b[0m`, JSON.stringify(data));
    }

    if (this.logFile) this.persist(entry);
  }

  warn(category: string, data: unknown): void  { this.log(category, data, 'WARN'); }
  error(category: string, data: unknown): void { this.log(category, data, 'ERROR'); }

  getEntries(category?: string): LogEntry[] {
    return category ? this.entries.filter(e => e.category === category) : this.entries;
  }

  getTokenUsage(): number {
    return this.entries
      .filter(e => e.category === 'AI_CALL' && typeof e.data === 'object' && e.data !== null)
      .reduce((sum, e) => {
        const d = e.data as Record<string, unknown>;
        return sum + (typeof d.tokens_used === 'number' ? d.tokens_used : 0);
      }, 0);
  }

  exportSession(): string {
    return JSON.stringify({ sessionId: this.sessionId, entries: this.entries }, null, 2);
  }

  private persist(entry: LogEntry): void {
    try {
      const line = JSON.stringify(entry) + '\n';
      fs.appendFileSync(this.logFile!, line, 'utf8');
    } catch { /* non-fatal */ }
  }
}
