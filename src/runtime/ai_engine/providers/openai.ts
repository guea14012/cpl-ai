import { AIResult } from './anthropic';

// OpenAI provider — optional fallback
export class OpenAIProvider {
  private apiKey: string;
  private model:  string;
  private client: unknown = null;

  constructor(apiKey: string, model = 'gpt-4o') {
    this.apiKey = apiKey;
    this.model  = model;
    this.init();
  }

  private init(): void {
    try {
      const { OpenAI } = require('openai');
      this.client = new OpenAI({ apiKey: this.apiKey });
    } catch {
      console.warn('[CPL-AI] openai package not available. Install with: npm install openai');
    }
  }

  async generate(prompt: string, systemPrompt?: string, maxTokens = 2048): Promise<AIResult> {
    if (!this.client) throw new Error('OpenAI client not initialized');
    const openai = this.client as { chat: { completions: { create: Function } } };
    const response = await openai.chat.completions.create({
      model:      this.model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt ?? 'You are a helpful AI assistant in CPL-AI runtime.' },
        { role: 'user',   content: prompt },
      ],
    });
    const choice = response.choices[0];
    return {
      output:      choice.message.content ?? '',
      confidence:  0.90,
      tokens_used: response.usage?.total_tokens ?? 0,
      provider:    'openai',
      model:       this.model,
    };
  }

  async chat(messages: Array<{ role: string; content: string }>, maxTokens = 2048): Promise<AIResult> {
    if (!this.client) throw new Error('OpenAI client not initialized');
    const openai = this.client as { chat: { completions: { create: Function } } };
    const response = await openai.chat.completions.create({
      model:      this.model,
      max_tokens: maxTokens,
      messages:   messages as { role: 'user' | 'assistant' | 'system'; content: string }[],
    });
    return {
      output:      response.choices[0].message.content ?? '',
      confidence:  0.90,
      tokens_used: response.usage?.total_tokens ?? 0,
      provider:    'openai',
      model:       this.model,
    };
  }

  async analyze(data: string):    Promise<AIResult> { return this.generate(`Analyze: ${data}`); }
  async classify(input: string):  Promise<AIResult> { return this.generate(`Classify: ${input}`); }
  async summarize(text: string):  Promise<AIResult> { return this.generate(`Summarize: ${text}`); }
}
