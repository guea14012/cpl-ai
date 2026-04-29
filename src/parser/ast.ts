export type NodeType =
  | 'Program'
  | 'LetDeclaration'
  | 'AgentDeclaration'
  | 'ToolDeclaration'
  | 'FunctionDeclaration'
  | 'OnDeclaration'
  | 'RunStatement'
  | 'ImportStatement'
  | 'IfStatement'
  | 'ForStatement'
  | 'WhileStatement'
  | 'ReturnStatement'
  | 'LogStatement'
  | 'AlertStatement'
  | 'ExpressionStatement'
  | 'BlockStatement'
  | 'AssignmentExpression'
  | 'BinaryExpression'
  | 'UnaryExpression'
  | 'CallExpression'
  | 'MemberExpression'
  | 'IndexExpression'
  | 'AwaitExpression'
  | 'AIExpression'
  | 'MemoryExpression'
  | 'Identifier'
  | 'StringLiteral'
  | 'NumberLiteral'
  | 'BooleanLiteral'
  | 'NullLiteral'
  | 'ArrayLiteral'
  | 'ObjectLiteral';

export interface ASTNode { type: NodeType; line?: number; }

// ─── Top-level ──────────────────────────────────────────────────────────────

export interface Program extends ASTNode {
  type: 'Program';
  body: ASTNode[];
}

export interface LetDeclaration extends ASTNode {
  type: 'LetDeclaration';
  name: string;
  mutable: boolean;
  typeAnnotation?: string;
  init: ASTNode;
}

export interface AgentDeclaration extends ASTNode {
  type: 'AgentDeclaration';
  name: string;
  goal: string;
  tools: string[];
  body: ASTNode[];
}

export interface ToolDeclaration extends ASTNode {
  type: 'ToolDeclaration';
  name: string;
  params: string[];
  body: BlockStatement;
}

export interface FunctionDeclaration extends ASTNode {
  type: 'FunctionDeclaration';
  name: string;
  params: string[];
  body: BlockStatement;
  isAsync: boolean;
}

export interface OnDeclaration extends ASTNode {
  type: 'OnDeclaration';
  event: string;
  body: BlockStatement;
}

// ─── Statements ─────────────────────────────────────────────────────────────

export interface RunStatement extends ASTNode {
  type: 'RunStatement';
  agent: string;
  target: ASTNode;
}

export interface ImportStatement extends ASTNode {
  type: 'ImportStatement';
  path: string;
  names: string[];
}

export interface IfStatement extends ASTNode {
  type: 'IfStatement';
  condition: ASTNode;
  consequent: BlockStatement;
  alternate?: BlockStatement | IfStatement;
}

export interface ForStatement extends ASTNode {
  type: 'ForStatement';
  variable: string;
  iterable: ASTNode;
  body: BlockStatement;
}

export interface WhileStatement extends ASTNode {
  type: 'WhileStatement';
  condition: ASTNode;
  body: BlockStatement;
}

export interface ReturnStatement extends ASTNode {
  type: 'ReturnStatement';
  value?: ASTNode;
}

export interface LogStatement extends ASTNode {
  type: 'LogStatement';
  value: ASTNode;
}

export interface AlertStatement extends ASTNode {
  type: 'AlertStatement';
  value: ASTNode;
}

export interface ExpressionStatement extends ASTNode {
  type: 'ExpressionStatement';
  expression: ASTNode;
}

export interface BlockStatement extends ASTNode {
  type: 'BlockStatement';
  body: ASTNode[];
}

// ─── Expressions ────────────────────────────────────────────────────────────

export interface AssignmentExpression extends ASTNode {
  type: 'AssignmentExpression';
  target: ASTNode;
  value: ASTNode;
}

export interface BinaryExpression extends ASTNode {
  type: 'BinaryExpression';
  operator: string;
  left: ASTNode;
  right: ASTNode;
}

export interface UnaryExpression extends ASTNode {
  type: 'UnaryExpression';
  operator: string;
  operand: ASTNode;
}

export interface CallExpression extends ASTNode {
  type: 'CallExpression';
  callee: ASTNode;
  args: ASTNode[];
}

export interface MemberExpression extends ASTNode {
  type: 'MemberExpression';
  object: ASTNode;
  property: string;
}

export interface IndexExpression extends ASTNode {
  type: 'IndexExpression';
  object: ASTNode;
  index: ASTNode;
}

export interface AwaitExpression extends ASTNode {
  type: 'AwaitExpression';
  expression: ASTNode;
}

// ─── AI / Memory builtins ───────────────────────────────────────────────────

export interface AIExpression extends ASTNode {
  type: 'AIExpression';
  method: string;
  args: ASTNode[];
}

export interface MemoryExpression extends ASTNode {
  type: 'MemoryExpression';
  method: string;
  args: ASTNode[];
}

// ─── Literals ───────────────────────────────────────────────────────────────

export interface Identifier    extends ASTNode { type: 'Identifier';    name: string; }
export interface StringLiteral extends ASTNode { type: 'StringLiteral'; value: string; }
export interface NumberLiteral extends ASTNode { type: 'NumberLiteral'; value: number; }
export interface BooleanLiteral extends ASTNode { type: 'BooleanLiteral'; value: boolean; }
export interface NullLiteral   extends ASTNode { type: 'NullLiteral'; }

export interface ArrayLiteral extends ASTNode {
  type: 'ArrayLiteral';
  elements: ASTNode[];
}

export interface ObjectLiteral extends ASTNode {
  type: 'ObjectLiteral';
  properties: { key: string; value: ASTNode }[];
}
