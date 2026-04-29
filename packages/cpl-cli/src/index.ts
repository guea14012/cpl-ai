#!/usr/bin/env node
/**
 * CPL-AI Package Manager
 * Manages tools, agents, and prompt packages for CPL-AI programs.
 *
 * Package types:
 *   tool   — reusable CPL-AI tool definitions
 *   agent  — pre-built agent configurations
 *   prompt — prompt template libraries
 */

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

// ─── Package registry (local manifest) ───────────────────────────────────────

interface Package {
  name:        string;
  version:     string;
  type:        'tool' | 'agent' | 'prompt';
  description: string;
  author:      string;
  entry:       string;
  deps:        string[];
}

const BUILTIN_REGISTRY: Package[] = [
  { name: 'ai-tools',         version: '1.0.0', type: 'tool',   description: 'NLP, sentiment, classification tools',   author: 'koppa', entry: 'ai_tools/index.cpl',    deps: [] },
  { name: 'security-scanner', version: '1.0.0', type: 'tool',   description: 'Port scanner and vuln detection tools',  author: 'koppa', entry: 'security/scanner.cpl',  deps: [] },
  { name: 'pentest-agent',    version: '1.0.0', type: 'agent',  description: 'Autonomous penetration testing agent',   author: 'koppa', entry: 'agents/pentester.cpl',  deps: ['security-scanner'] },
  { name: 'threat-intel',     version: '1.0.0', type: 'agent',  description: 'CVE + threat intelligence agent',        author: 'koppa', entry: 'agents/threat_intel.cpl',deps: ['ai-tools'] },
  { name: 'log-analyzer',     version: '1.0.0', type: 'agent',  description: 'AI-powered log analysis agent',          author: 'koppa', entry: 'agents/log_analyzer.cpl', deps: [] },
  { name: 'nlp-prompts',      version: '1.0.0', type: 'prompt', description: 'NLP task prompt templates',              author: 'koppa', entry: 'prompts/nlp.json',        deps: [] },
  { name: 'security-prompts', version: '1.0.0', type: 'prompt', description: 'Security analysis prompt templates',    author: 'koppa', entry: 'prompts/security.json',   deps: [] },
];

const MODULES_DIR = 'cpl_modules';
const MANIFEST    = 'cpl-lock.json';

function readManifest(): Record<string, Package> {
  if (!fs.existsSync(MANIFEST)) return {};
  return JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
}

function writeManifest(data: Record<string, Package>): void {
  fs.writeFileSync(MANIFEST, JSON.stringify(data, null, 2), 'utf8');
}

function findPackage(name: string): Package | undefined {
  return BUILTIN_REGISTRY.find(p => p.name === name);
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

const program = new Command();

program
  .name('cpl-pkg')
  .description('CPL-AI Package Manager')
  .version('1.0.0');

// install
program
  .command('install <package...>')
  .alias('i')
  .description('Install one or more CPL-AI packages')
  .action((packages: string[]) => {
    const manifest = readManifest();
    for (const name of packages) {
      const pkg = findPackage(name);
      if (!pkg) { console.error(chalk.red(`Package "${name}" not found in registry`)); continue; }

      // Install deps first
      for (const dep of pkg.deps) {
        const depPkg = findPackage(dep);
        if (depPkg && !manifest[dep]) {
          installPkg(dep, depPkg, manifest);
        }
      }
      installPkg(name, pkg, manifest);
    }
    writeManifest(manifest);
    console.log(chalk.green('\n✓ Installation complete'));
  });

function installPkg(name: string, pkg: Package, manifest: Record<string, Package>): void {
  const pkgDir = path.join(MODULES_DIR, name);
  fs.mkdirSync(pkgDir, { recursive: true });

  // Write stub index.cpl
  const stub = generateStub(pkg);
  fs.writeFileSync(path.join(pkgDir, 'index.cpl'), stub, 'utf8');

  // Write package.json
  fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify(pkg, null, 2), 'utf8');

  manifest[name] = pkg;
  console.log(chalk.cyan(`  ✓ installed ${name}@${pkg.version} [${pkg.type}]`));
}

function generateStub(pkg: Package): string {
  const header = `// CPL-AI Package: ${pkg.name} v${pkg.version}
// Type: ${pkg.type}
// ${pkg.description}
// Auto-generated stub — implement as needed
`;
  if (pkg.type === 'tool') {
    return header + `
tool ${pkg.name.replace(/-/g, '_')}_analyze(input) {
  let result = ai.analyze(input)
  return result
}

tool ${pkg.name.replace(/-/g, '_')}_classify(input) {
  let result = ai.classify(input)
  return result
}
`;
  }
  if (pkg.type === 'agent') {
    return header + `
agent ${pkg.name.replace(/-/g, '_')} {
  goal: "${pkg.description}"
  tools: [ai_analyze]
}
`;
  }
  return header + `// Prompt templates for ${pkg.name}\n`;
}

// remove
program
  .command('remove <package>')
  .alias('rm')
  .description('Remove a package')
  .action((name: string) => {
    const manifest = readManifest();
    if (!manifest[name]) { console.error(chalk.red(`Package "${name}" not installed`)); return; }
    const pkgDir = path.join(MODULES_DIR, name);
    if (fs.existsSync(pkgDir)) fs.rmSync(pkgDir, { recursive: true });
    delete manifest[name];
    writeManifest(manifest);
    console.log(chalk.green(`✓ Removed ${name}`));
  });

// list
program
  .command('list')
  .alias('ls')
  .description('List installed packages')
  .action(() => {
    const manifest = readManifest();
    const installed = Object.values(manifest);
    if (installed.length === 0) { console.log(chalk.yellow('No packages installed')); return; }
    console.log(chalk.cyan(`\nInstalled packages (${installed.length}):\n`));
    for (const p of installed) {
      console.log(`  ${chalk.bold(p.name.padEnd(24))} ${chalk.green(p.version.padEnd(10))} [${p.type}]  ${chalk.gray(p.description)}`);
    }
  });

// search
program
  .command('search [query]')
  .description('Search the package registry')
  .option('-t, --type <type>', 'Filter by type: tool|agent|prompt')
  .action((query: string | undefined, opts: { type?: string }) => {
    let results = BUILTIN_REGISTRY;
    if (query)      results = results.filter(p => p.name.includes(query) || p.description.toLowerCase().includes(query.toLowerCase()));
    if (opts.type)  results = results.filter(p => p.type === opts.type);
    console.log(chalk.cyan(`\nCPL-AI Registry (${results.length} results):\n`));
    for (const p of results) {
      console.log(`  ${chalk.bold(p.name.padEnd(24))} ${chalk.green(p.version.padEnd(10))} [${p.type.padEnd(6)}]  ${chalk.gray(p.description)}`);
    }
    console.log('\n  Install with: cpl-pkg install <name>');
  });

// info
program
  .command('info <package>')
  .description('Show package details')
  .action((name: string) => {
    const pkg = findPackage(name);
    if (!pkg) { console.error(chalk.red(`Package "${name}" not found`)); return; }
    console.log(chalk.cyan(`\n${pkg.name} v${pkg.version}\n`));
    console.log(`  Type:         ${pkg.type}`);
    console.log(`  Description:  ${pkg.description}`);
    console.log(`  Author:       ${pkg.author}`);
    console.log(`  Dependencies: ${pkg.deps.length ? pkg.deps.join(', ') : 'none'}`);
    console.log(`  Entry:        ${pkg.entry}`);
    console.log(`\n  Import in CPL-AI:\n    import ${name}`);
  });

// publish (stub)
program
  .command('publish')
  .description('Publish a package to the registry (requires auth)')
  .action(() => {
    console.log(chalk.yellow('[cpl-pkg publish] Registry publishing coming soon.'));
    console.log('  1. Create a cpl-package.json in your project');
    console.log('  2. Run: cpl-pkg login');
    console.log('  3. Run: cpl-pkg publish');
  });

program.parse(process.argv);
