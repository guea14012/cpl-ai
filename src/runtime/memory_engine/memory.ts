import fs from 'fs';
import { VectorStore } from './vector_store';

// Short-term context cache (session-scoped key/value)
interface ShortTermEntry {
  value:     unknown;
  expiresAt: number | null;
}

export class MemoryEngine {
  private shortTerm: Map<string, ShortTermEntry> = new Map();
  private longTerm:  VectorStore = new VectorStore();
  private filePath:  string | null;

  constructor() {
    this.filePath = process.env.CPL_MEMORY_BACKEND === 'file'
      ? (process.env.CPL_MEMORY_FILE ?? './cpl-memory.json')
      : null;

    if (this.filePath) this.load();
  }

  // ─── Short-term (session) ──────────────────────────────────────────────────

  store(key: string, value: unknown, ttlSeconds?: number): void {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    this.shortTerm.set(key, { value, expiresAt });
    // Also persist to long-term for semantic search
    this.longTerm.store(key, value);
    if (this.filePath) this.persist();
  }

  get(key: string): unknown {
    const entry = this.shortTerm.get(key);
    if (!entry) return this.longTerm.get(key);
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.shortTerm.delete(key);
      return null;
    }
    return entry.value;
  }

  delete(key: string): void {
    this.shortTerm.delete(key);
    this.longTerm.delete(key);
    if (this.filePath) this.persist();
  }

  list(): string[] {
    const stKeys = [...this.shortTerm.keys()].filter(k => {
      const e = this.shortTerm.get(k)!;
      return !e.expiresAt || Date.now() <= e.expiresAt;
    });
    const ltKeys = this.longTerm.list();
    return [...new Set([...stKeys, ...ltKeys])];
  }

  // ─── Long-term (semantic search) ──────────────────────────────────────────

  search(query: string, topK = 5): Array<{ key: string; value: unknown; score: number }> {
    return this.longTerm.search(query, topK);
  }

  // ─── Context summary ──────────────────────────────────────────────────────

  buildContext(keys?: string[]): string {
    const entries = keys
      ? keys.map(k => ({ key: k, value: this.get(k) }))
      : this.list().map(k => ({ key: k, value: this.get(k) }));

    return entries
      .filter(e => e.value !== null)
      .map(e => `[${e.key}]: ${JSON.stringify(e.value)}`)
      .join('\n');
  }

  clear(): void {
    this.shortTerm.clear();
    if (this.filePath) this.persist();
  }

  // ─── Persistence ──────────────────────────────────────────────────────────

  private persist(): void {
    try {
      const data = {
        shortTerm: Object.fromEntries(this.shortTerm),
        longTerm:  this.longTerm.exportAll(),
      };
      fs.writeFileSync(this.filePath!, JSON.stringify(data, null, 2), 'utf8');
    } catch { /* non-fatal */ }
  }

  private load(): void {
    try {
      if (!fs.existsSync(this.filePath!)) return;
      const raw  = JSON.parse(fs.readFileSync(this.filePath!, 'utf8'));
      for (const [k, v] of Object.entries(raw.shortTerm ?? {})) {
        this.shortTerm.set(k, v as ShortTermEntry);
      }
      if (raw.longTerm) this.longTerm.importAll(raw.longTerm);
    } catch { /* non-fatal */ }
  }
}
