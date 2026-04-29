import React, { useRef } from 'react';
import MonacoEditor, { OnMount } from '@monaco-editor/react';
import type { Monaco } from '@monaco-editor/react';

interface Props {
  code:     string;
  onChange: (code: string) => void;
}

// CPL-AI language definition for Monaco
function registerCPLLanguage(monaco: Monaco): void {
  if (monaco.languages.getLanguages().some(l => l.id === 'cpl-ai')) return;

  monaco.languages.register({ id: 'cpl-ai', extensions: ['.cpl'], aliases: ['CPL-AI', 'cpl'] });

  monaco.languages.setMonarchTokensProvider('cpl-ai', {
    keywords: ['let', 'const', 'agent', 'tool', 'on', 'run', 'import', 'from', 'if', 'else',
               'for', 'in', 'while', 'return', 'async', 'await', 'log', 'alert', 'goal', 'tools',
               'true', 'false', 'null'],
    builtins: ['ai', 'memory'],
    tokenizer: {
      root: [
        [/\/\/.*$/, 'comment'],
        [/\/\*/, 'comment', '@comment'],
        [/"([^"\\]|\\.)*"/, 'string'],
        [/'([^'\\]|\\.)*'/, 'string'],
        [/\b\d+(\.\d+)?\b/, 'number'],
        [/\b(ai|memory)\b/, 'builtin'],
        [/\b(agent|tool|goal|tools|run|on)\b/, 'keyword.agent'],
        [/\b(let|const|if|else|for|in|while|return|async|await|import|from)\b/, 'keyword'],
        [/\b(log|alert)\b/, 'keyword.output'],
        [/\b(true|false|null)\b/, 'constant'],
        [/[a-zA-Z_]\w*/, 'identifier'],
        [/[=><!+\-*\/&|]+/, 'operator'],
        [/[{}[\]()]/, 'delimiter'],
        [/[.,:;]/, 'punctuation'],
      ],
      comment: [
        [/[^/*]+/, 'comment'],
        [/\*\//, 'comment', '@pop'],
        [/[/*]/, 'comment'],
      ],
    },
  });

  monaco.editor.defineTheme('cpl-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword',        foreground: 'ff79c6', fontStyle: 'bold' },
      { token: 'keyword.agent',  foreground: 'bd93f9', fontStyle: 'bold' },
      { token: 'keyword.output', foreground: 'ffb86c', fontStyle: 'bold' },
      { token: 'builtin',        foreground: '50fa7b', fontStyle: 'bold' },
      { token: 'string',         foreground: 'f1fa8c' },
      { token: 'number',         foreground: 'bd93f9' },
      { token: 'constant',       foreground: 'ff79c6' },
      { token: 'comment',        foreground: '6272a4', fontStyle: 'italic' },
      { token: 'operator',       foreground: 'ff79c6' },
      { token: 'identifier',     foreground: 'f8f8f2' },
      { token: 'delimiter',      foreground: 'f8f8f2' },
    ],
    colors: {
      'editor.background':           '#0d1117',
      'editor.foreground':           '#e6edf3',
      'editorLineNumber.foreground': '#484f58',
      'editor.selectionBackground':  '#264f78',
      'editor.lineHighlightBackground': '#161b22',
      'editorCursor.foreground':     '#58a6ff',
    },
  });

  // Auto-completion
  monaco.languages.registerCompletionItemProvider('cpl-ai', {
    triggerCharacters: ['.'],
    provideCompletionItems: (model, position) => {
      const word  = model.getWordUntilPosition(position);
      const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
      const line  = model.getLineContent(position.lineNumber);

      const suggestions: unknown[] = [];

      if (/\bai\.$/.test(line.slice(0, position.column - 1))) {
        ['generate', 'analyze', 'classify', 'chat', 'summarize'].forEach(m => {
          suggestions.push({ label: m, kind: monaco.languages.CompletionItemKind.Method, insertText: `${m}($1)`, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, documentation: `ai.${m}()`, range });
        });
      } else if (/\bmemory\.$/.test(line.slice(0, position.column - 1))) {
        ['store', 'get', 'delete', 'search', 'list'].forEach(m => {
          suggestions.push({ label: m, kind: monaco.languages.CompletionItemKind.Method, insertText: `${m}($1)`, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, documentation: `memory.${m}()`, range });
        });
      }

      return { suggestions } as { suggestions: unknown[] };
    },
  });
}

export const Editor: React.FC<Props> = ({ code, onChange }) => {
  const monacoRef = useRef<Monaco | null>(null);

  const handleMount: OnMount = (_editor, monaco) => {
    monacoRef.current = monaco;
    registerCPLLanguage(monaco);
    monaco.editor.setTheme('cpl-dark');
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '4px 12px', background: '#161b22', fontSize: 11, color: '#8b949e', borderBottom: '1px solid #30363d' }}>
        main.cpl — CPL-AI
      </div>
      <MonacoEditor
        height="100%"
        language="cpl-ai"
        value={code}
        onChange={v => onChange(v ?? '')}
        onMount={handleMount}
        options={{
          fontSize:          14,
          fontFamily:        "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
          fontLigatures:     true,
          minimap:           { enabled: false },
          lineNumbers:       'on',
          scrollBeyondLastLine: false,
          wordWrap:          'on',
          tabSize:           2,
          automaticLayout:   true,
          padding:           { top: 12, bottom: 12 },
          smoothScrolling:   true,
          cursorBlinking:    'smooth',
          renderLineHighlight: 'line',
          bracketPairColorization: { enabled: true },
        }}
      />
    </div>
  );
};
