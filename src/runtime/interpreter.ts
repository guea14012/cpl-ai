import * as AST from '../parser/ast';
import { AIEngine }    from './ai_engine/ai_engine';
import { MemoryEngine } from './memory_engine/memory';
import { AgentEngine }  from './agent_engine/agent';
import { SafetyLayer }  from './safety/sanitizer';
import { AuditLogger }  from './safety/logger';

// ─── Scope environment ────────────────────────────────────────────────────────

export class Environment {
  private vars: Map<string, unknown> = new Map();
  constructor(public parent?: Environment) {}

  get(name: string): unknown {
    if (this.vars.has(name)) return this.vars.get(name);
    if (this.parent) return this.parent.get(name);
    throw new Error(`Undefined variable: "${name}"`);
  }

  set(name: string, value: unknown): void { this.vars.set(name, value); }

  assign(name: string, value: unknown): void {
    if (this.vars.has(name))    { this.vars.set(name, value); return; }
    if (this.parent)            { this.parent.assign(name, value); return; }
    throw new Error(`Cannot assign to undefined variable: "${name}"`);
  }

  has(name: string): boolean {
    return this.vars.has(name) || (this.parent?.has(name) ?? false);
  }
}

export class ReturnSignal { constructor(public value: unknown) {} }

// ─── Interpreter ─────────────────────────────────────────────────────────────

export class Interpreter {
  private global: Environment;
  private agents: Map<string, AST.AgentDeclaration> = new Map();
  private events: Map<string, AST.BlockStatement[]> = new Map();

  private ai:     AIEngine;
  private memory: MemoryEngine;
  private agents2: AgentEngine;
  private safety: SafetyLayer;
  private logger: AuditLogger;

  constructor(config?: { apiKey?: string; provider?: string }) {
    this.global  = new Environment();
    this.logger  = new AuditLogger();
    this.ai      = new AIEngine(config, this.logger);
    this.memory  = new MemoryEngine();
    this.agents2 = new AgentEngine(this.ai, this.memory);
    this.safety  = new SafetyLayer();
    this.setupBuiltins();
  }

  private setupBuiltins(): void {
    const g = this.global;
    g.set('print',   (...a: unknown[]) => { console.log(...a); });
    g.set('typeof',  (v: unknown) => typeof v);
    g.set('String',  String);
    g.set('Number',  Number);
    g.set('Boolean', Boolean);
    g.set('JSON',    { stringify: JSON.stringify, parse: JSON.parse });
    g.set('Math',    Math);
    g.set('Date',    Date);
    g.set('Array',   { from: Array.from, isArray: Array.isArray });
    g.set('parseInt',    parseInt);
    g.set('parseFloat',  parseFloat);
    g.set('console',     console);
    g.set('Object',      { keys: Object.keys, values: Object.values, entries: Object.entries, assign: Object.assign });
  }

  async execute(program: AST.Program): Promise<void> {
    for (const node of program.body) {
      await this.eval(node, this.global);
    }
  }

  getLogger():  AuditLogger  { return this.logger; }
  getMemory():  MemoryEngine { return this.memory; }
  getAI():      AIEngine     { return this.ai; }

  async triggerEvent(event: string, data?: unknown): Promise<void> {
    const handlers = this.events.get(event) ?? [];
    for (const h of handlers) {
      const env = new Environment(this.global);
      if (data !== undefined) env.set('data', data);
      await this.evalBlock(h, env);
    }
  }

  // ─── Node dispatch ────────────────────────────────────────────────────────

  async eval(node: AST.ASTNode, env: Environment): Promise<unknown> {
    switch (node.type) {
      case 'LetDeclaration':     return this.evalLet(node as AST.LetDeclaration, env);
      case 'AgentDeclaration':   return this.evalAgentDecl(node as AST.AgentDeclaration);
      case 'ToolDeclaration':    return this.evalToolDecl(node as AST.ToolDeclaration, env);
      case 'FunctionDeclaration':return this.evalFuncDecl(node as AST.FunctionDeclaration, env);
      case 'OnDeclaration':      return this.evalOnDecl(node as AST.OnDeclaration);
      case 'RunStatement':       return this.evalRun(node as AST.RunStatement, env);
      case 'ImportStatement':    return this.evalImport(node as AST.ImportStatement, env);
      case 'IfStatement':        return this.evalIf(node as AST.IfStatement, env);
      case 'ForStatement':       return this.evalFor(node as AST.ForStatement, env);
      case 'WhileStatement':     return this.evalWhile(node as AST.WhileStatement, env);
      case 'ReturnStatement':    return this.evalReturn(node as AST.ReturnStatement, env);
      case 'LogStatement':       return this.evalLog(node as AST.LogStatement, env);
      case 'AlertStatement':     return this.evalAlert(node as AST.AlertStatement, env);
      case 'ExpressionStatement':return this.eval((node as AST.ExpressionStatement).expression, env);
      case 'BlockStatement':     return this.evalBlock(node as AST.BlockStatement, env);
      case 'BinaryExpression':   return this.evalBinary(node as AST.BinaryExpression, env);
      case 'UnaryExpression':    return this.evalUnary(node as AST.UnaryExpression, env);
      case 'CallExpression':     return this.evalCall(node as AST.CallExpression, env);
      case 'MemberExpression':   return this.evalMember(node as AST.MemberExpression, env);
      case 'IndexExpression':    return this.evalIndex(node as AST.IndexExpression, env);
      case 'AssignmentExpression': return this.evalAssign(node as AST.AssignmentExpression, env);
      case 'AwaitExpression':    return this.eval((node as AST.AwaitExpression).expression, env);
      case 'AIExpression':       return this.evalAI(node as AST.AIExpression, env);
      case 'MemoryExpression':   return this.evalMemory(node as AST.MemoryExpression, env);
      case 'Identifier':         return env.get((node as AST.Identifier).name);
      case 'StringLiteral':      return (node as AST.StringLiteral).value;
      case 'NumberLiteral':      return (node as AST.NumberLiteral).value;
      case 'BooleanLiteral':     return (node as AST.BooleanLiteral).value;
      case 'NullLiteral':        return null;
      case 'ArrayLiteral':       return Promise.all((node as AST.ArrayLiteral).elements.map(e => this.eval(e, env)));
      case 'ObjectLiteral':      return this.evalObject(node as AST.ObjectLiteral, env);
      default:
        throw new Error(`[Interpreter] Unknown node type: ${node.type}`);
    }
  }

  // ─── Declarations ─────────────────────────────────────────────────────────

  private async evalLet(node: AST.LetDeclaration, env: Environment): Promise<void> {
    env.set(node.name, await this.eval(node.init, env));
  }

  private evalAgentDecl(node: AST.AgentDeclaration): void {
    this.agents.set(node.name, node);
    this.agents2.registerAgent(node.name, node.goal, node.tools);
    // Run any body statements in global env at declaration time (tool registrations etc.)
  }

  private evalToolDecl(node: AST.ToolDeclaration, env: Environment): void {
    const fn = async (...args: unknown[]) => {
      const fnEnv = new Environment(this.global);
      node.params.forEach((p, i) => fnEnv.set(p, args[i]));
      try {
        return await this.evalBlock(node.body, fnEnv);
      } catch (e) {
        if (e instanceof ReturnSignal) return e.value;
        throw e;
      }
    };
    env.set(node.name, fn);
    this.agents2.registerTool(node.name, fn);
  }

  private evalFuncDecl(node: AST.FunctionDeclaration, env: Environment): void {
    env.set(node.name, async (...args: unknown[]) => {
      const fnEnv = new Environment(env);
      node.params.forEach((p, i) => fnEnv.set(p, args[i]));
      try {
        return await this.evalBlock(node.body, fnEnv);
      } catch (e) {
        if (e instanceof ReturnSignal) return e.value;
        throw e;
      }
    });
  }

  private evalOnDecl(node: AST.OnDeclaration): void {
    const list = this.events.get(node.event) ?? [];
    list.push(node.body);
    this.events.set(node.event, list);
  }

  // ─── Statements ───────────────────────────────────────────────────────────

  private async evalRun(node: AST.RunStatement, env: Environment): Promise<unknown> {
    const target = await this.eval(node.target, env);
    console.log(`\n\x1b[35m[RUN]\x1b[0m agent "${node.agent}" → target: ${JSON.stringify(target)}`);
    return this.agents2.run(node.agent, target);
  }

  private async evalImport(node: AST.ImportStatement, env: Environment): Promise<void> {
    try {
      const mod = require(node.path.startsWith('.') ? node.path : `./${node.path}`);
      if (node.names.length > 0) node.names.forEach(n => env.set(n, mod[n]));
      else {
        const alias = node.path.split('/').pop()!.replace(/\.[^/.]+$/, '');
        env.set(alias, mod);
      }
    } catch {
      console.warn(`[CPL-AI] Cannot import "${node.path}" — skipping`);
    }
  }

  private async evalIf(node: AST.IfStatement, env: Environment): Promise<unknown> {
    const cond = await this.eval(node.condition, env);
    if (this.truthy(cond)) return this.evalBlock(node.consequent, new Environment(env));
    if (node.alternate) {
      if (node.alternate.type === 'IfStatement') return this.evalIf(node.alternate as AST.IfStatement, env);
      return this.evalBlock(node.alternate as AST.BlockStatement, new Environment(env));
    }
  }

  private async evalFor(node: AST.ForStatement, env: Environment): Promise<void> {
    const iterable = await this.eval(node.iterable, env) as Iterable<unknown>;
    for (const item of iterable) {
      const loopEnv = new Environment(env);
      loopEnv.set(node.variable, item);
      try { await this.evalBlock(node.body, loopEnv); }
      catch (e) { if (e instanceof ReturnSignal) throw e; }
    }
  }

  private async evalWhile(node: AST.WhileStatement, env: Environment): Promise<void> {
    while (this.truthy(await this.eval(node.condition, env))) {
      try { await this.evalBlock(node.body, new Environment(env)); }
      catch (e) { if (e instanceof ReturnSignal) throw e; }
    }
  }

  private async evalReturn(node: AST.ReturnStatement, env: Environment): Promise<never> {
    const value = node.value ? await this.eval(node.value, env) : null;
    throw new ReturnSignal(value);
  }

  private async evalLog(node: AST.LogStatement, env: Environment): Promise<void> {
    const v = await this.eval(node.value, env);
    const s = typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v);
    console.log(`\x1b[32m[LOG]\x1b[0m ${s}`);
    this.logger.log('LOG', { value: s });
  }

  private async evalAlert(node: AST.AlertStatement, env: Environment): Promise<void> {
    const v = await this.eval(node.value, env);
    const s = typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v);
    console.log(`\x1b[33m⚠ [ALERT]\x1b[0m ${s}`);
    this.logger.warn('ALERT', { value: s });
  }

  async evalBlock(node: AST.BlockStatement, env: Environment): Promise<unknown> {
    let result: unknown;
    for (const stmt of node.body) {
      result = await this.eval(stmt, env);
      if (result instanceof ReturnSignal) throw result;
    }
    return result;
  }

  // ─── Expressions ─────────────────────────────────────────────────────────

  private async evalBinary(node: AST.BinaryExpression, env: Environment): Promise<unknown> {
    const l = await this.eval(node.left, env);
    const r = await this.eval(node.right, env);
    switch (node.operator) {
      case '+':  return (l as number) + (r as number);
      case '-':  return (l as number) - (r as number);
      case '*':  return (l as number) * (r as number);
      case '/':  return (l as number) / (r as number);
      case '>':  return (l as number) > (r as number);
      case '<':  return (l as number) < (r as number);
      case '>=': return (l as number) >= (r as number);
      case '<=': return (l as number) <= (r as number);
      case '==': return l === r;
      case '!=': return l !== r;
      case '&&': return l && r;
      case '||': return l || r;
      default: throw new Error(`Unknown operator: ${node.operator}`);
    }
  }

  private async evalUnary(node: AST.UnaryExpression, env: Environment): Promise<unknown> {
    const v = await this.eval(node.operand, env);
    if (node.operator === '!') return !v;
    if (node.operator === '-') return -(v as number);
    throw new Error(`Unknown unary: ${node.operator}`);
  }

  private async evalCall(node: AST.CallExpression, env: Environment): Promise<unknown> {
    // Handle method call shortcut
    if (node.callee.type === 'MemberExpression') {
      const mem  = node.callee as AST.MemberExpression;
      const obj  = await this.eval(mem.object, env) as Record<string, unknown>;
      const args = await Promise.all(node.args.map(a => this.eval(a, env)));
      if (obj === null || obj === undefined) throw new Error(`Cannot call method "${mem.property}" on ${obj}`);
      const fn = obj[mem.property];
      if (typeof fn !== 'function') throw new Error(`"${mem.property}" is not a function`);
      return (fn as Function).apply(obj, args);
    }
    const fn   = await this.eval(node.callee, env);
    const args = await Promise.all(node.args.map(a => this.eval(a, env)));
    if (typeof fn !== 'function') throw new Error(`${JSON.stringify(node.callee)} is not callable`);
    return (fn as Function)(...args);
  }

  private async evalMember(node: AST.MemberExpression, env: Environment): Promise<unknown> {
    const obj = await this.eval(node.object, env) as Record<string, unknown>;
    if (obj === null || obj === undefined) throw new Error(`Cannot access "${node.property}" of ${obj}`);
    return obj[node.property];
  }

  private async evalIndex(node: AST.IndexExpression, env: Environment): Promise<unknown> {
    const obj = await this.eval(node.object, env) as Record<string | number, unknown>;
    const idx = await this.eval(node.index, env) as string | number;
    return obj[idx];
  }

  private async evalAssign(node: AST.AssignmentExpression, env: Environment): Promise<unknown> {
    const value = await this.eval(node.value, env);
    if (node.target.type === 'Identifier') {
      const name = (node.target as AST.Identifier).name;
      if (env.has(name)) env.assign(name, value);
      else               env.set(name, value);
    } else if (node.target.type === 'MemberExpression') {
      const m   = node.target as AST.MemberExpression;
      const obj = await this.eval(m.object, env) as Record<string, unknown>;
      obj[m.property] = value;
    } else if (node.target.type === 'IndexExpression') {
      const ix  = node.target as AST.IndexExpression;
      const obj = await this.eval(ix.object, env) as Record<string | number, unknown>;
      const idx = await this.eval(ix.index, env) as string | number;
      obj[idx]  = value;
    }
    return value;
  }

  private async evalObject(node: AST.ObjectLiteral, env: Environment): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};
    for (const { key, value } of node.properties) result[key] = await this.eval(value, env);
    return result;
  }

  // ─── AI / Memory builtins ─────────────────────────────────────────────────

  private async evalAI(node: AST.AIExpression, env: Environment): Promise<unknown> {
    const args = await Promise.all(node.args.map(a => this.eval(a, env)));
    const safeArgs = args.map(a => typeof a === 'string' ? this.safety.sanitize(a) : a);

    switch (node.method) {
      case 'generate':  return this.ai.generate(safeArgs[0] as string, safeArgs[1] as string | undefined);
      case 'analyze':   return this.ai.analyze(safeArgs[0]);
      case 'classify':  return this.ai.classify(safeArgs[0]);
      case 'chat':      return this.ai.chat(safeArgs[0] as Array<{ role: string; content: string }>);
      case 'summarize': return this.ai.summarize(safeArgs[0] as string);
      default: throw new Error(`Unknown ai method: ${node.method}`);
    }
  }

  private async evalMemory(node: AST.MemoryExpression, env: Environment): Promise<unknown> {
    const args = await Promise.all(node.args.map(a => this.eval(a, env)));
    switch (node.method) {
      case 'store':  this.memory.store(args[0] as string, args[1], args[2] as number | undefined); return null;
      case 'get':    return this.memory.get(args[0] as string);
      case 'delete': this.memory.delete(args[0] as string); return null;
      case 'search': return this.memory.search(args[0] as string, args[1] as number | undefined);
      case 'list':   return this.memory.list();
      case 'context':return this.memory.buildContext(args[0] as string[] | undefined);
      default: throw new Error(`Unknown memory method: ${node.method}`);
    }
  }

  private truthy(v: unknown): boolean {
    return v !== null && v !== undefined && v !== false && v !== 0 && v !== '';
  }
}
