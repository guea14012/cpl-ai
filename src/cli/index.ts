#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { CPLRuntime } from '../runtime/runtime';

dotenv.config();

const program = new Command();

program
  .name('cpl')
  .description('CPL-AI — Cyber Programming Language, AI Native')
  .version('1.0.0');

// ─── run ─────────────────────────────────────────────────────────────────────

program
  .command('run <file>')
  .description('Execute a .cpl file')
  .option('-k, --api-key <key>', 'Anthropic API key')
  .option('-p, --provider <provider>', 'AI provider (anthropic|openai)', 'anthropic')
  .option('-d, --debug', 'Enable debug/audit logging')
  .action(async (file: string, opts: { apiKey?: string; provider: string; debug?: boolean }) => {
    const resolved = path.resolve(file);
    if (!fs.existsSync(resolved)) {
      console.error(chalk.red(`File not found: ${resolved}`));
      process.exit(1);
    }

    console.log(chalk.cyan('━'.repeat(60)));
    console.log(chalk.cyan.bold(' CPL-AI Runtime v1.0.0'));
    console.log(chalk.cyan(`  File    : ${resolved}`));
    console.log(chalk.cyan(`  Provider: ${opts.provider}`));
    console.log(chalk.cyan('━'.repeat(60)));

    const runtime = new CPLRuntime({
      apiKey:   opts.apiKey ?? process.env.ANTHROPIC_API_KEY,
      provider: opts.provider,
      debug:    opts.debug,
    });

    const result = await runtime.runFile(resolved);

    console.log(chalk.cyan('\n' + '━'.repeat(60)));
    if (result.success) {
      console.log(chalk.green.bold(' ✓ Execution complete'));
    } else {
      console.log(chalk.red.bold(` ✗ Execution failed: ${result.error}`));
    }
    console.log(chalk.cyan(`  Duration   : ${result.duration}ms`));
    console.log(chalk.cyan(`  Tokens used: ${result.tokensUsed}`));
    console.log(chalk.cyan('━'.repeat(60)));

    if (!result.success) process.exit(1);
  });

// ─── repl ─────────────────────────────────────────────────────────────────────

program
  .command('repl')
  .description('Start interactive REPL')
  .option('-k, --api-key <key>', 'Anthropic API key')
  .option('-p, --provider <provider>', 'AI provider', 'anthropic')
  .action(async (opts: { apiKey?: string; provider: string }) => {
    const runtime = new CPLRuntime({
      apiKey:   opts.apiKey ?? process.env.ANTHROPIC_API_KEY,
      provider: opts.provider,
    });
    await runtime.repl();
  });

// ─── check ────────────────────────────────────────────────────────────────────

program
  .command('check <file>')
  .description('Parse and check syntax of a .cpl file without running it')
  .action((file: string) => {
    const { Lexer }  = require('../lexer/lexer');
    const { Parser } = require('../parser/parser');
    try {
      const src    = fs.readFileSync(path.resolve(file), 'utf8');
      const tokens = new Lexer(src).tokenize();
      const ast    = new Parser(tokens).parse();
      console.log(chalk.green(`✓ Syntax OK — ${ast.body.length} top-level statements`));
    } catch (err) {
      console.error(chalk.red(`✗ Syntax error: ${err}`));
      process.exit(1);
    }
  });

// ─── install (stub for package system) ───────────────────────────────────────

program
  .command('install <package>')
  .description('Install a CPL-AI package')
  .action((pkg: string) => {
    console.log(chalk.yellow(`[cpl install] Installing package: ${pkg}`));
    const pkgDir = path.join(process.cwd(), 'cpl_modules', pkg);
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(path.join(pkgDir, 'index.cpl'), `// Package: ${pkg}\n// Auto-installed by CPL-AI\n`, 'utf8');
    console.log(chalk.green(`✓ Package "${pkg}" installed to ./cpl_modules/${pkg}/`));
  });

// ─── new ──────────────────────────────────────────────────────────────────────

program
  .command('new <name>')
  .description('Scaffold a new CPL-AI project')
  .action((name: string) => {
    const dir = path.join(process.cwd(), name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'main.cpl'), `// ${name} — CPL-AI project
// Run with: cpl run main.cpl

agent assistant {
  goal: "Help with tasks"
  tools: [ai_analyze]
}

let greeting = ai.generate("Say hello from CPL-AI in one sentence")
log(greeting.output)
`, 'utf8');
    fs.writeFileSync(path.join(dir, '.env'), `CPL_PROVIDER=anthropic\nANTHROPIC_API_KEY=your_key_here\n`, 'utf8');
    console.log(chalk.green(`✓ Project "${name}" created at ${dir}`));
    console.log(chalk.cyan('  Next steps:'));
    console.log(`    cd ${name}`);
    console.log(`    # Edit .env and add your API key`);
    console.log(`    cpl run main.cpl`);
  });

program.parse(process.argv);
