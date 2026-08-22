#!/usr/bin/env node

const { spawnSync } = require('node:child_process');

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.error) return { code: 1, output: result.error.message };
  return { code: result.status ?? 1, output: `${result.stdout || ''}${result.stderr || ''}`.trim() };
}

const git = process.platform === 'win32' ? 'git.exe' : 'git';
const status = run(git, ['status', '--short']);
const stat = run(git, ['diff', '--stat']);

if (status.code !== 0) {
  console.error(`STATUS: FAIL\n${status.output}`);
  process.exit(status.code);
}

const entries = status.output ? status.output.split(/\r?\n/) : [];
const shown = entries.slice(0, 40);
console.log(`WORKTREE: ${entries.length === 0 ? 'clean' : `${entries.length} change(s)`}`);
if (shown.length) console.log(shown.join('\n'));
if (entries.length > shown.length) console.log(`… ${entries.length - shown.length} more change(s); use git status --short for the full list.`);
if (stat.code === 0 && stat.output) console.log(`\nDIFF STAT\n${stat.output}`);
