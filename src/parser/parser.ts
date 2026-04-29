import { Token, TokenType } from '../lexer/tokens';
import * as AST from './ast';

export class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) { this.tokens = tokens; }

  parse(): AST.Program {
    const body: AST.ASTNode[] = [];
    while (!this.eof()) {
      const s = this.statement();
      if (s) body.push(s);
    }
    return { type: 'Program', body };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private cur(): Token  { return this.tokens[this.pos]; }
  private peek(n = 1):  Token { return this.tokens[Math.min(this.pos + n, this.tokens.length - 1)]; }
  private eof(): boolean { return this.cur().type === TokenType.EOF; }

  private advance(): Token {
    const t = this.tokens[this.pos];
    if (!this.eof()) this.pos++;
    return t;
  }

  private check(...types: TokenType[]): boolean {
    return types.includes(this.cur().type);
  }

  private match(...types: TokenType[]): boolean {
    if (this.check(...types)) { this.advance(); return true; }
    return false;
  }

  private expect(type: TokenType): Token {
    if (this.check(type)) return this.advance();
    throw new Error(`[Parser] Expected ${type}, got ${this.cur().type} ("${this.cur().value}") at line ${this.cur().line}`);
  }

  // ─── Statements ────────────────────────────────────────────────────────────

  private statement(): AST.ASTNode | null {
    switch (this.cur().type) {
      case TokenType.LET:
      case TokenType.CONST:
        return this.letDecl();
      case TokenType.AGENT:
        return this.agentDecl();
      case TokenType.TOOL:
        return this.toolDecl();
      case TokenType.ON:
        return this.onDecl();
      case TokenType.RUN:
        return this.runStmt();
      case TokenType.IMPORT:
        return this.importStmt();
      case TokenType.IF:
        return this.ifStmt();
      case TokenType.FOR:
        return this.forStmt();
      case TokenType.WHILE:
        return this.whileStmt();
      case TokenType.RETURN:
        return this.returnStmt();
      case TokenType.LOG:
        return this.logStmt();
      case TokenType.ALERT:
        return this.alertStmt();
      case TokenType.ASYNC:
        return this.funcDecl(true);
      default:
        return this.exprStmt();
    }
  }

  private letDecl(): AST.LetDeclaration {
    const line = this.cur().line;
    const mutable = this.cur().type === TokenType.LET;
    this.advance();
    const name = this.expect(TokenType.IDENTIFIER).value;
    let typeAnnotation: string | undefined;
    if (this.match(TokenType.COLON)) typeAnnotation = this.advance().value;
    this.expect(TokenType.ASSIGN);
    const init = this.expr();
    this.match(TokenType.SEMICOLON);
    return { type: 'LetDeclaration', name, mutable, typeAnnotation, init, line };
  }

  private agentDecl(): AST.AgentDeclaration {
    const line = this.cur().line;
    this.advance(); // agent
    const name = this.expect(TokenType.IDENTIFIER).value;
    this.expect(TokenType.LBRACE);

    let goal = '';
    let tools: string[] = [];
    const body: AST.ASTNode[] = [];

    while (!this.check(TokenType.RBRACE) && !this.eof()) {
      if (this.check(TokenType.GOAL)) {
        this.advance();
        this.expect(TokenType.COLON);
        goal = this.expect(TokenType.STRING).value;
        this.match(TokenType.SEMICOLON);
      } else if (this.check(TokenType.TOOLS_KW)) {
        this.advance();
        this.expect(TokenType.COLON);
        this.expect(TokenType.LBRACKET);
        while (!this.check(TokenType.RBRACKET) && !this.eof()) {
          tools.push(this.expect(TokenType.IDENTIFIER).value);
          this.match(TokenType.COMMA);
        }
        this.expect(TokenType.RBRACKET);
        this.match(TokenType.SEMICOLON);
      } else {
        const s = this.statement();
        if (s) body.push(s);
      }
    }
    this.expect(TokenType.RBRACE);
    return { type: 'AgentDeclaration', name, goal, tools, body, line };
  }

  private toolDecl(): AST.ToolDeclaration {
    const line = this.cur().line;
    this.advance(); // tool
    const name = this.expect(TokenType.IDENTIFIER).value;
    const params = this.paramList();
    const body = this.block();
    return { type: 'ToolDeclaration', name, params, body, line };
  }

  private funcDecl(isAsync: boolean): AST.FunctionDeclaration {
    const line = this.cur().line;
    if (isAsync) this.advance(); // async
    const name = this.expect(TokenType.IDENTIFIER).value;
    const params = this.paramList();
    const body = this.block();
    return { type: 'FunctionDeclaration', name, params, body, isAsync, line };
  }

  private paramList(): string[] {
    this.expect(TokenType.LPAREN);
    const params: string[] = [];
    while (!this.check(TokenType.RPAREN) && !this.eof()) {
      params.push(this.expect(TokenType.IDENTIFIER).value);
      if (this.match(TokenType.COLON)) this.advance(); // skip type
      this.match(TokenType.COMMA);
    }
    this.expect(TokenType.RPAREN);
    return params;
  }

  private onDecl(): AST.OnDeclaration {
    const line = this.cur().line;
    this.advance(); // on
    const event = this.expect(TokenType.IDENTIFIER).value;
    const body = this.block();
    return { type: 'OnDeclaration', event, body, line };
  }

  private runStmt(): AST.RunStatement {
    const line = this.cur().line;
    this.advance(); // run
    const agent = this.expect(TokenType.IDENTIFIER).value;
    // consume optional 'on'
    if (this.check(TokenType.ON) || (this.check(TokenType.IDENTIFIER) && this.cur().value === 'on')) this.advance();
    const target = this.expr();
    this.match(TokenType.SEMICOLON);
    return { type: 'RunStatement', agent, target, line };
  }

  private importStmt(): AST.ImportStatement {
    const line = this.cur().line;
    this.advance(); // import
    const names: string[] = [];
    if (this.check(TokenType.LBRACE)) {
      this.advance();
      while (!this.check(TokenType.RBRACE) && !this.eof()) {
        names.push(this.expect(TokenType.IDENTIFIER).value);
        this.match(TokenType.COMMA);
      }
      this.expect(TokenType.RBRACE);
    }
    let path = '';
    if (this.match(TokenType.FROM)) path = this.expect(TokenType.STRING).value;
    else if (this.check(TokenType.IDENTIFIER)) path = this.advance().value;
    else if (this.check(TokenType.STRING))     path = this.advance().value;
    this.match(TokenType.SEMICOLON);
    return { type: 'ImportStatement', path, names, line };
  }

  private ifStmt(): AST.IfStatement {
    const line = this.cur().line;
    this.advance(); // if
    const condition = this.expr();
    const consequent = this.block();
    let alternate: AST.BlockStatement | AST.IfStatement | undefined;
    if (this.match(TokenType.ELSE)) {
      alternate = this.check(TokenType.IF) ? this.ifStmt() : this.block();
    }
    return { type: 'IfStatement', condition, consequent, alternate, line };
  }

  private forStmt(): AST.ForStatement {
    const line = this.cur().line;
    this.advance(); // for
    const variable = this.expect(TokenType.IDENTIFIER).value;
    this.expect(TokenType.IN);
    const iterable = this.expr();
    const body = this.block();
    return { type: 'ForStatement', variable, iterable, body, line };
  }

  private whileStmt(): AST.WhileStatement {
    const line = this.cur().line;
    this.advance(); // while
    const condition = this.expr();
    const body = this.block();
    return { type: 'WhileStatement', condition, body, line };
  }

  private returnStmt(): AST.ReturnStatement {
    const line = this.cur().line;
    this.advance(); // return
    const value = (!this.check(TokenType.SEMICOLON) && !this.check(TokenType.RBRACE) && !this.eof())
      ? this.expr() : undefined;
    this.match(TokenType.SEMICOLON);
    return { type: 'ReturnStatement', value, line };
  }

  private logStmt(): AST.LogStatement {
    const line = this.cur().line;
    this.advance();
    this.expect(TokenType.LPAREN);
    const value = this.expr();
    this.expect(TokenType.RPAREN);
    this.match(TokenType.SEMICOLON);
    return { type: 'LogStatement', value, line };
  }

  private alertStmt(): AST.AlertStatement {
    const line = this.cur().line;
    this.advance();
    this.expect(TokenType.LPAREN);
    const value = this.expr();
    this.expect(TokenType.RPAREN);
    this.match(TokenType.SEMICOLON);
    return { type: 'AlertStatement', value, line };
  }

  private exprStmt(): AST.ExpressionStatement {
    const line = this.cur().line;
    const expression = this.expr();
    this.match(TokenType.SEMICOLON);
    return { type: 'ExpressionStatement', expression, line };
  }

  private block(): AST.BlockStatement {
    const line = this.cur().line;
    this.expect(TokenType.LBRACE);
    const body: AST.ASTNode[] = [];
    while (!this.check(TokenType.RBRACE) && !this.eof()) {
      const s = this.statement();
      if (s) body.push(s);
    }
    this.expect(TokenType.RBRACE);
    return { type: 'BlockStatement', body, line };
  }

  // ─── Expression hierarchy ──────────────────────────────────────────────────

  private expr():   AST.ASTNode { return this.assign(); }

  private assign(): AST.ASTNode {
    const left = this.or();
    if (this.match(TokenType.ASSIGN)) {
      const value = this.assign();
      return { type: 'AssignmentExpression', target: left, value } as AST.AssignmentExpression;
    }
    return left;
  }

  private or(): AST.ASTNode {
    let left = this.and();
    while (this.match(TokenType.OR)) {
      const right = this.and();
      left = { type: 'BinaryExpression', operator: '||', left, right } as AST.BinaryExpression;
    }
    return left;
  }

  private and(): AST.ASTNode {
    let left = this.equality();
    while (this.match(TokenType.AND)) {
      const right = this.equality();
      left = { type: 'BinaryExpression', operator: '&&', left, right } as AST.BinaryExpression;
    }
    return left;
  }

  private equality(): AST.ASTNode {
    let left = this.comparison();
    while (this.check(TokenType.EQ, TokenType.NEQ)) {
      const op = this.advance().value;
      left = { type: 'BinaryExpression', operator: op, left, right: this.comparison() } as AST.BinaryExpression;
    }
    return left;
  }

  private comparison(): AST.ASTNode {
    let left = this.addSub();
    while (this.check(TokenType.GT, TokenType.GTE, TokenType.LT, TokenType.LTE)) {
      const op = this.advance().value;
      left = { type: 'BinaryExpression', operator: op, left, right: this.addSub() } as AST.BinaryExpression;
    }
    return left;
  }

  private addSub(): AST.ASTNode {
    let left = this.mulDiv();
    while (this.check(TokenType.PLUS, TokenType.MINUS)) {
      const op = this.advance().value;
      left = { type: 'BinaryExpression', operator: op, left, right: this.mulDiv() } as AST.BinaryExpression;
    }
    return left;
  }

  private mulDiv(): AST.ASTNode {
    let left = this.unary();
    while (this.check(TokenType.STAR, TokenType.SLASH)) {
      const op = this.advance().value;
      left = { type: 'BinaryExpression', operator: op, left, right: this.unary() } as AST.BinaryExpression;
    }
    return left;
  }

  private unary(): AST.ASTNode {
    if (this.check(TokenType.NOT, TokenType.MINUS)) {
      const op = this.advance().value;
      return { type: 'UnaryExpression', operator: op, operand: this.unary() } as AST.UnaryExpression;
    }
    if (this.match(TokenType.AWAIT)) {
      return { type: 'AwaitExpression', expression: this.callMember() } as AST.AwaitExpression;
    }
    return this.callMember();
  }

  private callMember(): AST.ASTNode {
    let expr = this.primary();
    while (true) {
      if (this.match(TokenType.DOT)) {
        const prop = this.advance().value; // allow keywords as property names
        if (this.check(TokenType.LPAREN)) {
          const args = this.argList();
          expr = { type: 'CallExpression', callee: { type: 'MemberExpression', object: expr, property: prop }, args } as AST.CallExpression;
        } else {
          expr = { type: 'MemberExpression', object: expr, property: prop } as AST.MemberExpression;
        }
      } else if (this.check(TokenType.LBRACKET)) {
        this.advance();
        const index = this.expr();
        this.expect(TokenType.RBRACKET);
        expr = { type: 'IndexExpression', object: expr, index } as AST.IndexExpression;
      } else if (this.check(TokenType.LPAREN)) {
        const args = this.argList();
        expr = { type: 'CallExpression', callee: expr, args } as AST.CallExpression;
      } else break;
    }
    return expr;
  }

  private argList(): AST.ASTNode[] {
    this.expect(TokenType.LPAREN);
    const args: AST.ASTNode[] = [];
    while (!this.check(TokenType.RPAREN) && !this.eof()) {
      args.push(this.expr());
      this.match(TokenType.COMMA);
    }
    this.expect(TokenType.RPAREN);
    return args;
  }

  private primary(): AST.ASTNode {
    const tok = this.cur();

    if (this.match(TokenType.STRING))  return { type: 'StringLiteral',  value: tok.value,          line: tok.line } as AST.StringLiteral;
    if (this.match(TokenType.NUMBER))  return { type: 'NumberLiteral',  value: parseFloat(tok.value), line: tok.line } as AST.NumberLiteral;
    if (this.match(TokenType.TRUE))    return { type: 'BooleanLiteral', value: true,                line: tok.line } as AST.BooleanLiteral;
    if (this.match(TokenType.FALSE))   return { type: 'BooleanLiteral', value: false,               line: tok.line } as AST.BooleanLiteral;
    if (this.match(TokenType.NULL))    return { type: 'NullLiteral',                                line: tok.line } as AST.NullLiteral;

    // ai.method(...)
    if (this.check(TokenType.AI)) {
      this.advance();
      this.expect(TokenType.DOT);
      const method = this.advance().value;
      const args = this.argList();
      return { type: 'AIExpression', method, args, line: tok.line } as AST.AIExpression;
    }

    // memory.method(...)
    if (this.check(TokenType.MEMORY)) {
      this.advance();
      this.expect(TokenType.DOT);
      const method = this.advance().value;
      const args = this.argList();
      return { type: 'MemoryExpression', method, args, line: tok.line } as AST.MemoryExpression;
    }

    // Array literal
    if (this.check(TokenType.LBRACKET)) {
      this.advance();
      const elements: AST.ASTNode[] = [];
      while (!this.check(TokenType.RBRACKET) && !this.eof()) {
        elements.push(this.expr());
        this.match(TokenType.COMMA);
      }
      this.expect(TokenType.RBRACKET);
      return { type: 'ArrayLiteral', elements, line: tok.line } as AST.ArrayLiteral;
    }

    // Object literal
    if (this.check(TokenType.LBRACE)) {
      this.advance();
      const properties: { key: string; value: AST.ASTNode }[] = [];
      while (!this.check(TokenType.RBRACE) && !this.eof()) {
        const key = this.advance().value;
        this.expect(TokenType.COLON);
        const value = this.expr();
        properties.push({ key, value });
        this.match(TokenType.COMMA);
      }
      this.expect(TokenType.RBRACE);
      return { type: 'ObjectLiteral', properties, line: tok.line } as AST.ObjectLiteral;
    }

    // Grouped expression
    if (this.match(TokenType.LPAREN)) {
      const e = this.expr();
      this.expect(TokenType.RPAREN);
      return e;
    }

    // Identifier (or keyword used as identifier)
    this.advance();
    return { type: 'Identifier', name: tok.value, line: tok.line } as AST.Identifier;
  }
}
