const fs = require('fs');
const html = fs.readFileSync('admin.html', 'utf8'); // or utf16le if needed
const matches = [...html.matchAll(/id=["']([^"']+-tab)["']/g)];
console.log([...new Set(matches.map(m => m[1]))]);
