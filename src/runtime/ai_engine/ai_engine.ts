import dotenv from 'dotenv';
import { AnthropicProvider, AIResult } from './providers/anthropic';
import { OpenAIProvider } from './providers/openai';
import { PromptEngine } from './prompt_engine';
import { SafetyLayer } from '../safety/sanitizer';
import { AuditLogger } from '../safety/logger';

dotenv.config();

export type { AIResult };

interface RateLimiter {
  count:     number;
  resetTime: number;
}

export class AIEngine {
  private anthropic?: AnthropicProvider;
  private openai?:    OpenAIProvider;
  private prompt:     PromptEngine;
  private safety:     SafetyLayer;
  private logger:     AuditLogger;
  private provider:   string;
  private rateLimit:  RateLimiter = { count: 0, resetTime: Date.now() + 60_000 };
  private maxRate:    number;

  constructor(config?: { apiKey?: string; provider?: string }, logger?: AuditLogger) {
    this.prompt   = new PromptEngine();
    this.safety   = new SafetyLayer();
    this.logger   = logger ?? new AuditLogger();
    this.provider = config?.provider ?? process.env.CPL_PROVIDER ?? 'anthropic';
    this.maxRate  = parseInt(process.env.CPL_RATE_LIMIT ?? '60', 10);

    const anthropicKey = config?.apiKey ?? process.env.ANTHROPIC_API_KEY;
    const openaiKey    = process.env.OPENAI_API_KEY;
    const model        = process.env.CPL_MODEL ?? 'claude-sonnet-4-6';

    if (anthropicKey) this.anthropic = new AnthropicProvider(anthropicKey, model);
    if (openaiKey)    this.openai    = new OpenAIProvider(openaiKey);

    if (!this.anthropic && !this.openai) {
      console.warn('[CPL-AI] No API key configured. AI calls will return mock responses.');
    }
  }

  async generate(prompt: string, systemPrompt?: string): Promise<AIResult> {
    return this.call('generate', prompt, { systemPrompt });
  }

  async analyze(data: unknown): Promise<AIResult> {
    const input = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    return this.call('analyze', input);
  }

  async classify(input: unknown, categories?: string[]): Promise<AIResult> {
    const text = typeof input === 'string' ? input : JSON.stringify(input);
    return this.call('classify', text, { categories });
  }

  async chat(messages: Array<{ role: string; content: string }>): Promise<AIResult> {
    return this.call('chat', '', { messages });
  }

  async summarize(text: string): Promise<AIResult> {
    return this.call('summarize', text);
  }

  private async call(method: string, input: string, opts: Record<string, unknown> = {}): Promise<AIResult> {
    this.checkRateLimit();

    // Sanitize string input
    const sanitized = input ? this.safety.sanitize(input) : input;
    const optimized = sanitized ? this.prompt.optimize(sanitized) : sanitized;

    const start = Date.now();
    let result: AIResult;

    try {
      result = await this.dispatch(method, optimized, opts);
    } catch (err) {
      this.logger.error('AI_ERROR', { method, error: String(err) });
      result = this.mockResult(`[AI Error: ${String(err)}]`);
    }

    const elapsed = Date.now() - start;
    this.logger.log('AI_CALL', {
      method,
      tokens_used:   result.tokens_used,
      provider:      result.provider,
      elapsed_ms:    elapsed,
      prompt_length: input.length,
    });
    this.rateLimit.count++;

    return result;
  }

  private async dispatch(method: string, input: string, opts: Record<string, unknown>): Promise<AIResult> {
    const provider = this.pickProvider();

    if (!provider) return this.mockResult(`[Mock ${method}: ${input.slice(0, 80)}...]`);

    switch (method) {
      case 'generate':  return provider.generate(input, opts.systemPrompt as string | undefined);
      case 'analyze':   return provider.analyze(input);
      case 'classify':  return (provider as AnthropicProvider).classify(input, opts.categories as string[] | undefined);
      case 'summarize': return provider.summarize(input);
      case 'chat': {
        const msgs = opts.messages as Array<{ role: string; content: string }>;
        const compressed = this.prompt.compressHistory(msgs);
        return provider.chat(compressed);
      }
      default:          return provider.generate(input);
    }
  }

  private pickProvider(): AnthropicProvider | OpenAIProvider | null {
    if (this.provider === 'openai' && this.openai) return this.openai;
    if (this.anthropic) return this.anthropic;
    if (this.openai)    return this.openai;
    return null;
  }

  private checkRateLimit(): void {
    const now = Date.now();
    if (now > this.rateLimit.resetTime) {
      this.rateLimit = { count: 0, resetTime: now + 60_000 };
    }
    if (this.rateLimit.count >= this.maxRate) {
      throw new Error(`[CPL-AI] Rate limit exceeded (${this.maxRate} calls/min). Please wait.`);
    }
  }

  private mockResult(output: string): AIResult {
    return { output, confidence: 0.5, tokens_used: 0, provider: 'mock', model: 'none' };
  }
}
