import Anthropic from '@anthropic-ai/sdk';

export interface AIResult {
  output:      string;
  confidence:  number;
  tokens_used: number;
  provider:    string;
  model:       string;
}

export class AnthropicProvider {
  private client: Anthropic;
  private model:  string;

  constructor(apiKey: string, model = 'claude-sonnet-4-6') {
    this.client = new Anthropic({ apiKey });
    this.model  = model;
  }

  async generate(prompt: string, systemPrompt?: string, maxTokens = 2048): Promise<AIResult> {
    const system = systemPrompt ?? 'You are a helpful AI assistant embedded in CPL-AI runtime. Be precise and structured.';
    const msg = await this.client.messages.create({
      model:      this.model,
      max_tokens: maxTokens,
      system,
      messages:   [{ role: 'user', content: prompt }],
    });
    const text = msg.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('');
    return {
      output:      text,
      confidence:  0.95,
      tokens_used: msg.usage.input_tokens + msg.usage.output_tokens,
      provider:    'anthropic',
      model:       this.model,
    };
  }

  async chat(messages: Array<{ role: string; content: string }>, maxTokens = 2048): Promise<AIResult> {
    const typed = messages.map(m => ({
      role:    m.role as 'user' | 'assistant',
      content: m.content,
    }));
    const msg = await this.client.messages.create({
      model:      this.model,
      max_tokens: maxTokens,
      system:     'You are a helpful AI assistant embedded in CPL-AI. Respond concisely and accurately.',
      messages:   typed,
    });
    const text = msg.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('');
    return {
      output:      text,
      confidence:  0.95,
      tokens_used: msg.usage.input_tokens + msg.usage.output_tokens,
      provider:    'anthropic',
      model:       this.model,
    };
  }

  async analyze(data: string): Promise<AIResult> {
    return this.generate(
      `Analyze the following data and provide a structured analysis with key findings, patterns, anomalies, and risk level (1-10):\n\n${data}`,
      'You are a data analysis expert. Provide structured, actionable insights.'
    );
  }

  async classify(input: string, categories?: string[]): Promise<AIResult> {
    const catStr = categories ? `Categories: ${categories.join(', ')}\n\n` : '';
    return this.generate(
      `${catStr}Classify the following input and explain your classification:\n\n${input}\n\nRespond with JSON: { "category": "...", "confidence": 0.0-1.0, "reasoning": "..." }`,
      'You are a classification expert. Always respond with valid JSON.'
    );
  }

  async summarize(text: string): Promise<AIResult> {
    return this.generate(
      `Summarize the following text concisely, preserving key information:\n\n${text}`,
      'You are a summarization expert. Be concise but comprehensive.'
    );
  }
}
