// Prompt injection and output safety layer

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions?/gi,
  /you\s+are\s+now\s+(?:a|an)\s+\w+/gi,
  /act\s+as\s+(?:a|an)\s+\w+/gi,
  /disregard\s+(?:all\s+)?(?:previous|prior)\s+/gi,
  /jailbreak/gi,
  /DAN\s+mode/gi,
  /system\s+prompt\s*:/gi,
  /<\/?(?:script|iframe|object|embed)/gi,
  /\bexec\s*\(/gi,
  /\beval\s*\(/gi,
  /\b__import__\s*\(/gi,
  /\bos\.system\s*\(/gi,
  /\bsubprocess\./gi,
];

const SENSITIVE_PATTERNS: Record<string, RegExp> = {
  apiKey:      /\b(?:sk|pk|api)[_-]?(?:key|secret|token)[_-]?[a-zA-Z0-9]{16,}\b/gi,
  awsKey:      /AKIA[0-9A-Z]{16}/g,
  jwt:         /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  creditCard:  /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/g,
  password:    /(?:password|passwd|pwd)\s*[:=]\s*\S+/gi,
};

export interface SanitizeResult {
  clean:    string;
  warnings: string[];
  blocked:  boolean;
}

export class SafetyLayer {
  sanitize(input: string): string {
    const result = this.sanitizeFull(input);
    if (result.blocked) throw new Error(`[Safety] Prompt blocked: ${result.warnings[0]}`);
    return result.clean;
  }

  sanitizeFull(input: string): SanitizeResult {
    const warnings: string[] = [];
    let clean = input;
    let blocked = false;

    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        warnings.push(`Prompt injection pattern detected: ${pattern.source}`);
        blocked = true;
        pattern.lastIndex = 0;
      }
    }

    for (const [name, pattern] of Object.entries(SENSITIVE_PATTERNS)) {
      if (pattern.test(input)) {
        warnings.push(`Sensitive data (${name}) found and redacted`);
        clean = clean.replace(pattern, `[REDACTED_${name.toUpperCase()}]`);
        pattern.lastIndex = 0;
      }
    }

    return { clean, warnings, blocked };
  }

  validateOutput(output: string): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check for unexpected code execution indicators
    if (/<script[\s>]/i.test(output)) issues.push('Output contains script tag');
    if (/\bexec\s*\(/.test(output))  issues.push('Output contains exec() call');

    return { valid: issues.length === 0, issues };
  }

  truncateContext(text: string, maxTokens: number): string {
    // Rough approximation: 1 token ≈ 4 chars
    const maxChars = maxTokens * 4;
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars) + '\n[... truncated for token limit ...]';
  }
}
