import fs from 'fs';
import { Lexer }       from '../lexer/lexer';
import { Parser }      from '../parser/parser';
import { Interpreter } from './interpreter';

export interface RunOptions {
  apiKey?:   string;
  provider?: string;
  debug?:    boolean;
}

export interface RunResult {
  success:    boolean;
  error?:     string;
  tokensUsed: number;
  duration:   number;
  logs:       unknown[];
}

export class CPLRuntime {
  private interpreter: Interpreter;

  constructor(options: RunOptions = {}) {
    if (options.debug) process.env.CPL_DEBUG = 'true';
    this.interpreter = new Interpreter({ apiKey: options.apiKey, provider: options.provider });
  }

  async runFile(filePath: string): Promise<RunResult> {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: `File not found: ${filePath}`, tokensUsed: 0, duration: 0, logs: [] };
    }
    const source = fs.readFileSync(filePath, 'utf8');
    return this.runSource(source);
  }

  async runSource(source: string): Promise<RunResult> {
    const start = Date.now();
    try {
      const tokens  = new Lexer(source).tokenize();
      const ast     = new Parser(tokens).parse();
      await this.interpreter.execute(ast);
      const duration = Date.now() - start;
      const logger   = this.interpreter.getLogger();
      return {
        success:    true,
        tokensUsed: logger.getTokenUsage(),
        duration,
        logs:       logger.getEntries(),
      };
    } catch (err) {
      return {
        success:    false,
        error:      String(err),
        tokensUsed: this.interpreter.getLogger().getTokenUsage(),
        duration:   Date.now() - start,
        logs:       this.interpreter.getLogger().getEntries(),
      };
    }
  }

  async triggerEvent(event: string, data?: unknown): Promise<void> {
    return this.interpreter.triggerEvent(event, data);
  }

  getInterpreter(): Interpreter { return this.interpreter; }

  // ─── REPL ─────────────────────────────────────────────────────────────────

  async repl(): Promise<void> {
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log('\x1b[36mCPL-AI REPL v1.0.0\x1b[0m — Type .exit to quit, .help for help');
    const prompt = () => {
      rl.question('\x1b[35mcpl>\x1b[0m ', async (line: string) => {
        const trimmed = line.trim();
        if (trimmed === '.exit' || trimmed === 'exit') { rl.close(); return; }
        if (trimmed === '.help') {
          console.log('Commands: .exit, .help, .tokens, .memory\nOr type any CPL-AI code');
          return prompt();
        }
        if (trimmed === '.tokens') {
          console.log(`Tokens used this session: ${this.interpreter.getLogger().getTokenUsage()}`);
          return prompt();
        }
        if (trimmed === '.memory') {
          console.log('Memory keys:', this.interpreter.getMemory().list());
          return prompt();
        }
        if (!trimmed) return prompt();
        const r = await this.runSource(trimmed);
        if (!r.success) console.error(`\x1b[31mError:\x1b[0m ${r.error}`);
        prompt();
      });
    };
    prompt();
  }
}
