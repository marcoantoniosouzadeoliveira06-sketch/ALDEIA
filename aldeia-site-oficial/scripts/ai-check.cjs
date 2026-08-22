#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const command = process.platform === 'win32' ? 'cmd.exe' : 'npm';
const args = process.platform === 'win32'
  ? ['/d', '/s', '/c', 'npm.cmd run check']
  : ['run', 'check'];
const result = spawnSync(command, args, { encoding: 'utf8' });
const output = `${result.stdout || ''}${result.stderr || ''}`.trim();

if (result.error || result.status !== 0) {
  const lines = output.split(/\r?\n/).filter(Boolean);
  console.error('QUALITY_GATE check: FAIL');
  console.error(lines.slice(-100).join('\n') || result.error?.message || 'Command failed without output.');
  process.exit(result.status || 1);
}

console.log('QUALITY_GATE check: PASS');
