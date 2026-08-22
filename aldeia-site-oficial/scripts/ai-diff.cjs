#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const pathArgs = process.argv.slice(2);
const git = process.platform === 'win32' ? 'git.exe' : 'git';

function run(args) {
  const result = spawnSync(git, args, { encoding: 'utf8' });
  if (result.error) return { code: 1, output: result.error.message };
  return { code: result.status ?? 1, output: `${result.stdout || ''}${result.stderr || ''}`.trim() };
}

const suffix = pathArgs.length ? ['--', ...pathArgs] : [];
const names = run(['diff', '--name-status', ...suffix]);
const stat = run(['diff', '--stat', ...suffix]);

if (names.code !== 0 || stat.code !== 0) {
  console.error(`DIFF: FAIL\n${names.output || stat.output}`);
  process.exit(names.code || stat.code);
}

console.log('CHANGED FILES');
console.log(names.output || 'None');
console.log('\nDIFF STAT');
console.log(stat.output || 'None');
console.log('\nFor line-level detail, request a path-scoped git diff.');
