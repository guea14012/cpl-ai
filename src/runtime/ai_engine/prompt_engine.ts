// Prompt optimization, context compression, and token management

export interface PromptContext {
  systemPrompt?: string;
  history:       Array<{ role: string; content: string }>;
  maxTokens:     number;
}

export class PromptEngine {
  private readonly MAX_HISTORY_TOKENS = 8000;
  private readonly AVG_CHARS_PER_TOKEN = 4;

  optimize(prompt: string, context?: PromptContext): string {
    let optimized = prompt.trim();
    optimized = this.removeRedundantWhitespace(optimized);
    optimized = this.addStructuralHints(optimized);
    return optimized;
  }

  buildSystemPrompt(role: string, goal: string): string {
    return `You are ${role} operating inside the CPL-AI runtime.
Your goal: ${goal}
Always respond with structured, actionable output.
If asked to produce code or commands, wrap them in code blocks.
Be concise but thorough.`;
  }

  buildAgentPrompt(agentName: string, goal: string, tools: string[], target: unknown, iteration: number): string {
    return `# CPL-AI Agent: ${agentName}
## Goal
${goal}

## Target
${JSON.stringify(target, null, 2)}

## Available Tools
${tools.map(t => `- ${t}`).join('\n')}

## Iteration: ${iteration}

Analyze the target, decide which tool to use next (or conclude), and explain your reasoning.
Respond with JSON:
{
  "thought": "your analysis",
  "action": "tool_name | DONE",
  "action_input": "input for the tool",
  "findings": ["finding1", "finding2"],
  "confidence": 0.0-1.0
}`;
  }

  compressHistory(history: Array<{ role: string; content: string }>): Array<{ role: string; content: string }> {
    const totalChars = history.reduce((s, m) => s + m.content.length, 0);
    const totalEstTokens = totalChars / this.AVG_CHARS_PER_TOKEN;
    if (totalEstTokens <= this.MAX_HISTORY_TOKENS) return history;

    // Keep first message (system context) and last N messages
    const budget = this.MAX_HISTORY_TOKENS * this.AVG_CHARS_PER_TOKEN;
    const compressed: Array<{ role: string; content: string }> = [];
    let used = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      if (used + history[i].content.length > budget && compressed.length > 2) break;
      compressed.unshift(history[i]);
      used += history[i].content.length;
    }
    return compressed;
  }

  estimateTokens(text: string): number {
    return Math.ceil(text.length / this.AVG_CHARS_PER_TOKEN);
  }

  private removeRedundantWhitespace(text: string): string {
    return text.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n').trim();
  }

  private addStructuralHints(prompt: string): string {
    // If prompt lacks explicit output format instruction and is long, add one
    if (prompt.length > 200 && !prompt.includes('JSON') && !prompt.includes('format')) {
      return prompt + '\n\nRespond clearly and concisely.';
    }
    return prompt;
  }
}
