export enum TokenType {
  // Literals
  STRING     = 'STRING',
  NUMBER     = 'NUMBER',
  TRUE       = 'TRUE',
  FALSE      = 'FALSE',
  NULL       = 'NULL',

  // Declaration keywords
  LET        = 'LET',
  CONST      = 'CONST',
  AGENT      = 'AGENT',
  TOOL       = 'TOOL',
  IMPORT     = 'IMPORT',
  FROM       = 'FROM',
  ASYNC      = 'ASYNC',
  AWAIT      = 'AWAIT',

  // Control flow
  IF         = 'IF',
  ELSE       = 'ELSE',
  FOR        = 'FOR',
  IN         = 'IN',
  WHILE      = 'WHILE',
  RETURN     = 'RETURN',

  // Agent keywords
  GOAL       = 'GOAL',
  TOOLS_KW   = 'TOOLS_KW',
  ON         = 'ON',
  RUN        = 'RUN',

  // Built-in namespaces
  AI         = 'AI',
  MEMORY     = 'MEMORY',

  // Output
  LOG        = 'LOG',
  ALERT      = 'ALERT',

  // Identifiers
  IDENTIFIER = 'IDENTIFIER',

  // Arithmetic operators
  PLUS       = 'PLUS',
  MINUS      = 'MINUS',
  STAR       = 'STAR',
  SLASH      = 'SLASH',

  // Comparison operators
  GT         = 'GT',
  LT         = 'LT',
  GTE        = 'GTE',
  LTE        = 'LTE',
  EQ         = 'EQ',
  NEQ        = 'NEQ',

  // Logical operators
  AND        = 'AND',
  OR         = 'OR',
  NOT        = 'NOT',

  // Assignment
  ASSIGN     = 'ASSIGN',

  // Punctuation
  DOT        = 'DOT',
  COMMA      = 'COMMA',
  COLON      = 'COLON',
  SEMICOLON  = 'SEMICOLON',

  // Brackets
  LPAREN     = 'LPAREN',
  RPAREN     = 'RPAREN',
  LBRACE     = 'LBRACE',
  RBRACE     = 'RBRACE',
  LBRACKET   = 'LBRACKET',
  RBRACKET   = 'RBRACKET',

  EOF        = 'EOF',
}

export interface Token {
  type:   TokenType;
  value:  string;
  line:   number;
  column: number;
}

export const KEYWORDS: Record<string, TokenType> = {
  let:    TokenType.LET,
  const:  TokenType.CONST,
  agent:  TokenType.AGENT,
  tool:   TokenType.TOOL,
  on:     TokenType.ON,
  run:    TokenType.RUN,
  import: TokenType.IMPORT,
  from:   TokenType.FROM,
  if:     TokenType.IF,
  else:   TokenType.ELSE,
  for:    TokenType.FOR,
  in:     TokenType.IN,
  while:  TokenType.WHILE,
  return: TokenType.RETURN,
  async:  TokenType.ASYNC,
  await:  TokenType.AWAIT,
  log:    TokenType.LOG,
  alert:  TokenType.ALERT,
  true:   TokenType.TRUE,
  false:  TokenType.FALSE,
  null:   TokenType.NULL,
  goal:   TokenType.GOAL,
  tools:  TokenType.TOOLS_KW,
  memory: TokenType.MEMORY,
  ai:     TokenType.AI,
};
