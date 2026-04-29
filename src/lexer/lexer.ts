import { Token, TokenType, KEYWORDS } from './tokens';

export class Lexer {
  private src:    string;
  private pos:    number = 0;
  private line:   number = 1;
  private col:    number = 1;
  private tokens: Token[] = [];

  constructor(source: string) { this.src = source; }

  tokenize(): Token[] {
    while (this.pos < this.src.length) {
      this.skipWhitespace();
      if (this.pos >= this.src.length) break;

      const ch = this.ch();

      if (ch === '/' && this.peek() === '/') { this.skipLineComment(); continue; }
      if (ch === '/' && this.peek() === '*') { this.skipBlockComment(); continue; }
      if (ch === '"' || ch === "'") { this.readString(ch); continue; }
      if (this.isDigit(ch)) { this.readNumber(); continue; }
      if (this.isAlpha(ch)) { this.readIdent(); continue; }
      this.readSymbol();
    }
    this.push(TokenType.EOF, '');
    return this.tokens;
  }

  private ch(offset = 0): string { return this.src[this.pos + offset] ?? ''; }
  private peek(): string { return this.ch(1); }

  private advance(): string {
    const c = this.src[this.pos++];
    if (c === '\n') { this.line++; this.col = 1; } else { this.col++; }
    return c;
  }

  private push(type: TokenType, value: string, line = this.line, col = this.col): void {
    this.tokens.push({ type, value, line, column: col });
  }

  private skipWhitespace(): void {
    while (this.pos < this.src.length && /[ \t\r\n]/.test(this.ch())) this.advance();
  }

  private skipLineComment(): void {
    while (this.pos < this.src.length && this.ch() !== '\n') this.advance();
  }

  private skipBlockComment(): void {
    this.advance(); this.advance(); // /*
    while (this.pos < this.src.length && !(this.ch() === '*' && this.peek() === '/')) this.advance();
    if (this.pos < this.src.length) { this.advance(); this.advance(); } // */
  }

  private readString(q: string): void {
    const l = this.line; const c = this.col;
    this.advance(); // opening quote
    let val = '';
    while (this.pos < this.src.length && this.ch() !== q) {
      if (this.ch() === '\\') {
        this.advance();
        const e = this.advance();
        val += e === 'n' ? '\n' : e === 't' ? '\t' : e;
      } else {
        val += this.advance();
      }
    }
    this.advance(); // closing quote
    this.tokens.push({ type: TokenType.STRING, value: val, line: l, column: c });
  }

  private readNumber(): void {
    const l = this.line; const c = this.col;
    let val = '';
    while (this.pos < this.src.length && (this.isDigit(this.ch()) || this.ch() === '.')) val += this.advance();
    this.tokens.push({ type: TokenType.NUMBER, value: val, line: l, column: c });
  }

  private readIdent(): void {
    const l = this.line; const c = this.col;
    let val = '';
    while (this.pos < this.src.length && (this.isAlpha(this.ch()) || this.isDigit(this.ch()) || this.ch() === '_')) val += this.advance();
    const type = KEYWORDS[val] ?? TokenType.IDENTIFIER;
    this.tokens.push({ type, value: val, line: l, column: c });
  }

  private readSymbol(): void {
    const l = this.line; const c = this.col;
    const ch = this.advance();
    const next = this.ch();

    const dbl: Array<[string, string, TokenType]> = [
      ['>', '=', TokenType.GTE],  ['<', '=', TokenType.LTE],
      ['=', '=', TokenType.EQ],   ['!', '=', TokenType.NEQ],
      ['&', '&', TokenType.AND],  ['|', '|', TokenType.OR],
    ];
    for (const [a, b, t] of dbl) {
      if (ch === a && next === b) { this.advance(); this.tokens.push({ type: t, value: ch + b, line: l, column: c }); return; }
    }

    const single: Record<string, TokenType> = {
      '=': TokenType.ASSIGN, '>': TokenType.GT,   '<': TokenType.LT,
      '!': TokenType.NOT,    '+': TokenType.PLUS, '-': TokenType.MINUS,
      '*': TokenType.STAR,   '/': TokenType.SLASH, '.': TokenType.DOT,
      ',': TokenType.COMMA,  ':': TokenType.COLON, ';': TokenType.SEMICOLON,
      '(': TokenType.LPAREN, ')': TokenType.RPAREN,
      '{': TokenType.LBRACE, '}': TokenType.RBRACE,
      '[': TokenType.LBRACKET, ']': TokenType.RBRACKET,
    };
    const type = single[ch];
    if (type) this.tokens.push({ type, value: ch, line: l, column: c });
    else console.warn(`[Lexer] Unknown character '${ch}' at ${l}:${c}`);
  }

  private isDigit(c: string): boolean { return /[0-9]/.test(c); }
  private isAlpha(c: string): boolean { return /[a-zA-Z_]/.test(c); }
}
