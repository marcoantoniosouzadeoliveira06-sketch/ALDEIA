'use strict';

const fs = require('fs');
const vm = require('vm');

const htmlFiles = ['admin.html', 'index.html', 'portfolio.html', 'projeto.html'];

for (const file of htmlFiles) {
    const html = fs.readFileSync(file, 'utf8');
    const scriptPattern = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
    let match;
    let checked = 0;

    while ((match = scriptPattern.exec(html))) {
        if (/\bsrc\s*=|application\/ld\+json/i.test(match[1])) continue;
        checked += 1;
        new vm.Script(match[2], { filename: `${file}#script${checked}` });
    }

    console.log(`${file}: ${checked} scripts inline válidos`);
}
