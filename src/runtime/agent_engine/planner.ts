import { AIEngine, AIResult } from '../ai_engine/ai_engine';
import { PromptEngine } from '../ai_engine/prompt_engine';
import { MemoryEngine } from '../memory_engine/memory';

export interface AgentStep {
  iteration:   number;
  thought:     string;
  action:      string;
  actionInput: string;
  findings:    string[];
  confidence:  number;
  result?:     unknown;
  error?:      string;
  timestamp:   string;
}

export interface PlanResult {
  agentName:  string;
  goal:       string;
  target:     unknown;
  steps:      AgentStep[];
  summary:    string;
  tokensUsed: number;
  success:    boolean;
}

export class TaskPlanner {
  private promptEngine: PromptEngine;

  constructor(
    private ai:     AIEngine,
    private memory: MemoryEngine,
  ) {
    this.promptEngine = new PromptEngine();
  }

  async plan(
    agentName: string,
    goal:      string,
    tools:     string[],
    target:    unknown,
    toolFns:   Map<string, Function>,
    maxIter  = 8,
  ): Promise<PlanResult> {
    const steps:    AgentStep[] = [];
    let tokensUsed  = 0;
    let findings:   string[] = [];

    console.log(`\n\x1b[36m[AGENT:${agentName}]\x1b[0m Starting — goal: "${goal}"`);
    console.log(`\x1b[36m[AGENT:${agentName}]\x1b[0m Target:`, target);

    // Store initial context in memory
    this.memory.store(`${agentName}.target`,  target);
    this.memory.store(`${agentName}.goal`,    goal);
    this.memory.store(`${agentName}.started`, new Date().toISOString());

    for (let i = 1; i <= maxIter; i++) {
      const memCtx  = this.memory.buildContext([`${agentName}.target`, `${agentName}.findings`]);
      const prompt  = this.promptEngine.buildAgentPrompt(agentName, goal, tools, target, i) +
        (memCtx ? `\n\n## Memory Context\n${memCtx}` : '') +
        (findings.length ? `\n\n## Previous Findings\n${findings.map((f, j) => `${j+1}. ${f}`).join('\n')}` : '');

      let parsed: Record<string, unknown>;
      try {
        const response: AIResult = await this.ai.generate(
          prompt,
          this.promptEngine.buildSystemPrompt(agentName, goal),
        );
        tokensUsed += response.tokens_used;
        parsed = this.parseJSON(response.output);
      } catch (err) {
        steps.push({
          iteration:   i,
          thought:     'Parse error',
          action:      'ERROR',
          actionInput: '',
          findings:    [],
          confidence:  0,
          error:       String(err),
          timestamp:   new Date().toISOString(),
        });
        break;
      }

      const step: AgentStep = {
        iteration:   i,
        thought:     String(parsed.thought   ?? ''),
        action:      String(parsed.action    ?? 'DONE'),
        actionInput: String(parsed.action_input ?? ''),
        findings:    Array.isArray(parsed.findings) ? parsed.findings as string[] : [],
        confidence:  typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
        timestamp:   new Date().toISOString(),
      };

      findings.push(...step.findings);
      this.memory.store(`${agentName}.findings`, findings);

      console.log(`\x1b[36m[AGENT:${agentName}]\x1b[0m Iter ${i} — action: ${step.action}`);
      console.log(`  Thought: ${step.thought.slice(0, 120)}`);

      // Execute tool if action is not DONE/CONCLUDE
      if (step.action !== 'DONE' && step.action !== 'CONCLUDE' && toolFns.has(step.action)) {
        try {
          const fn = toolFns.get(step.action)!;
          step.result = await fn(step.actionInput, target);
          console.log(`  Tool result:`, String(step.result).slice(0, 200));
        } catch (err) {
          step.error = String(err);
          console.log(`  Tool error:`, step.error);
        }
      }

      steps.push(step);

      if (step.action === 'DONE' || step.action === 'CONCLUDE' || step.confidence >= 0.95) break;
    }

    // Generate final summary
    const summaryPrompt = `Summarize the findings of agent "${agentName}" targeting: ${JSON.stringify(target)}
Goal: ${goal}
Findings:\n${findings.map((f, i) => `${i+1}. ${f}`).join('\n')}
Steps taken: ${steps.length}

Provide a concise executive summary with key findings, risk level, and recommendations.`;

    const summaryResult = await this.ai.generate(summaryPrompt, `You are a security reporting expert. Be precise and actionable.`);
    tokensUsed += summaryResult.tokens_used;

    this.memory.store(`${agentName}.summary`, summaryResult.output);

    return {
      agentName,
      goal,
      target,
      steps,
      summary:    summaryResult.output,
      tokensUsed,
      success:    steps.length > 0 && !steps[steps.length - 1].error,
    };
  }

  private parseJSON(text: string): Record<string, unknown> {
    // Extract JSON from markdown code block or raw text
    const block = text.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1] ?? text;
    const start = block.indexOf('{');
    const end   = block.lastIndexOf('}');
    if (start < 0 || end < 0) return { thought: text, action: 'DONE', findings: [], confidence: 0.5 };
    try {
      return JSON.parse(block.slice(start, end + 1));
    } catch {
      return { thought: text, action: 'DONE', findings: [], confidence: 0.5 };
    }
  }
}
