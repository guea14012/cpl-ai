import { AIEngine } from '../ai_engine/ai_engine';
import { MemoryEngine } from '../memory_engine/memory';
import { TaskPlanner, PlanResult } from './planner';

interface AgentDef {
  name:  string;
  goal:  string;
  tools: string[];
}

export class AgentEngine {
  private agents:  Map<string, AgentDef>  = new Map();
  private tools:   Map<string, Function>  = new Map();
  private planner: TaskPlanner;

  constructor(
    private ai:     AIEngine,
    private memory: MemoryEngine,
  ) {
    this.planner = new TaskPlanner(ai, memory);
    this.registerBuiltinTools();
  }

  // ─── Registration ──────────────────────────────────────────────────────────

  registerAgent(name: string, goal: string, tools: string[]): void {
    this.agents.set(name, { name, goal, tools });
    console.log(`[CPL-AI] Agent registered: "${name}" with tools: [${tools.join(', ')}]`);
  }

  registerTool(name: string, fn: Function): void {
    this.tools.set(name, fn);
  }

  // ─── Execution ─────────────────────────────────────────────────────────────

  async run(agentName: string, target: unknown): Promise<PlanResult> {
    const def = this.agents.get(agentName);
    if (!def) throw new Error(`[AgentEngine] Agent "${agentName}" not found`);

    // Build tool map for this agent (its declared tools + builtins)
    const toolMap = new Map<string, Function>();
    for (const toolName of def.tools) {
      if (this.tools.has(toolName)) toolMap.set(toolName, this.tools.get(toolName)!);
      else toolMap.set(toolName, this.makeMockTool(toolName));
    }

    return this.planner.plan(def.name, def.goal, def.tools, target, toolMap);
  }

  // ─── Built-in tools ───────────────────────────────────────────────────────

  private registerBuiltinTools(): void {
    // ai_analyze — use AI to analyze arbitrary input
    this.tools.set('ai_analyze', async (input: string) => {
      const r = await this.ai.analyze(input);
      return r.output;
    });

    // ai_classify — classify input
    this.tools.set('ai_classify', async (input: string) => {
      const r = await this.ai.classify(input);
      return r.output;
    });

    // scanner — simulate a port/service scan
    this.tools.set('scanner', async (target: string) => {
      await this.delay(200);
      return JSON.stringify({
        target,
        open_ports: [22, 80, 443, 8080],
        services:   { 22: 'SSH', 80: 'HTTP', 443: 'HTTPS', 8080: 'HTTP-Alt' },
        os_hint:    'Linux 5.x',
        scan_time:  '0.42s',
      });
    });

    // analyzer — analyze scan results or data
    this.tools.set('analyzer', async (data: string) => {
      const r = await this.ai.analyze(data);
      return r.output;
    });

    // exploit_simulator — simulate (safe, mock) exploitation
    this.tools.set('exploit_simulator', async (target: string) => {
      await this.delay(300);
      return JSON.stringify({
        target,
        simulated:        true,
        vulnerabilities:  ['CVE-2024-MOCK-001: Outdated SSH version', 'CVE-2024-MOCK-002: Default credentials possible'],
        risk_level:       'MEDIUM',
        recommendation:   'Update services and enforce MFA',
      });
    });

    // log_parser — parse log lines for anomalies
    this.tools.set('log_parser', async (logs: string) => {
      const lines  = logs.split('\n').filter(Boolean);
      const errors = lines.filter(l => /error|fail|warn|critical/i.test(l));
      return JSON.stringify({ total: lines.length, anomalies: errors.length, samples: errors.slice(0, 5) });
    });

    // cve_lookup — look up CVE information (mock)
    this.tools.set('cve_lookup', async (query: string) => {
      await this.delay(100);
      return JSON.stringify({
        query,
        results: [
          { id: 'CVE-2024-MOCK', score: 7.5, severity: 'HIGH', description: `Mock CVE matching: ${query}`, published: '2024-01-01' },
        ],
      });
    });

    // code_scanner — scan code for vulnerabilities
    this.tools.set('code_scanner', async (code: string) => {
      const issues: string[] = [];
      if (/eval\s*\(/.test(code))      issues.push('eval() usage detected — potential RCE');
      if (/innerHTML\s*=/.test(code))  issues.push('innerHTML assignment — potential XSS');
      if (/SELECT.*FROM.*WHERE/i.test(code) && /\+|concat/i.test(code)) issues.push('Possible SQL injection');
      if (/password\s*=\s*["'][^"']+["']/i.test(code)) issues.push('Hardcoded password detected');
      return JSON.stringify({ issues, risk: issues.length > 2 ? 'HIGH' : issues.length > 0 ? 'MEDIUM' : 'LOW' });
    });
  }

  private makeMockTool(name: string): Function {
    return async (input: string) => {
      console.warn(`[AgentEngine] Tool "${name}" not implemented, using AI fallback`);
      const r = await this.ai.generate(`Execute tool "${name}" on input: ${input}\nSimulate realistic output.`);
      return r.output;
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }
}
