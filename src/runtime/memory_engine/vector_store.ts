// Lightweight in-process vector store (cosine similarity over TF-IDF bag-of-words)
// No external dependencies required.

export interface VectorEntry {
  id:        string;
  key:       string;
  value:     unknown;
  embedding: number[];
  tags:      string[];
  createdAt: string;
}

export class VectorStore {
  private entries: VectorEntry[] = [];

  store(key: string, value: unknown, tags: string[] = []): void {
    const existing = this.entries.findIndex(e => e.key === key);
    const entry: VectorEntry = {
      id:        `vec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      key,
      value,
      embedding: this.embed(key + ' ' + JSON.stringify(value)),
      tags,
      createdAt: new Date().toISOString(),
    };
    if (existing >= 0) this.entries[existing] = entry;
    else               this.entries.push(entry);
  }

  get(key: string): unknown | null {
    return this.entries.find(e => e.key === key)?.value ?? null;
  }

  delete(key: string): boolean {
    const idx = this.entries.findIndex(e => e.key === key);
    if (idx < 0) return false;
    this.entries.splice(idx, 1);
    return true;
  }

  search(query: string, topK = 5): Array<{ key: string; value: unknown; score: number }> {
    const qVec = this.embed(query);
    return this.entries
      .map(e => ({ key: e.key, value: e.value, score: this.cosine(qVec, e.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  list(): string[] {
    return this.entries.map(e => e.key);
  }

  size(): number { return this.entries.length; }

  exportAll(): VectorEntry[] { return [...this.entries]; }

  importAll(entries: VectorEntry[]): void { this.entries = entries; }

  // ─── Embedding ─────────────────────────────────────────────────────────────

  private embed(text: string): number[] {
    const tokens = this.tokenize(text);
    const vocab  = this.buildVocab(tokens);
    return vocab.map(term => {
      const tf = tokens.filter(t => t === term).length / tokens.length;
      return tf;
    });
  }

  private tokenize(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
  }

  private buildVocab(tokens: string[]): string[] {
    return [...new Set([...this.entries.flatMap(e => this.tokenize(e.key + ' ' + JSON.stringify(e.value))), ...tokens])].slice(0, 512);
  }

  private cosine(a: number[], b: number[]): number {
    const len = Math.min(a.length, b.length);
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < len; i++) {
      dot += a[i] * b[i];
      na  += a[i] * a[i];
      nb  += b[i] * b[i];
    }
    const denom = Math.sqrt(na) * Math.sqrt(nb);
    return denom === 0 ? 0 : dot / denom;
  }
}
