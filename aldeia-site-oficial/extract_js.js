const fs = require('fs');
const txt = fs.readFileSync('admin.backup.html', 'utf8');
const scriptIndex = txt.indexOf('<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>');
fs.writeFileSync('admin_js_only.txt', txt.slice(scriptIndex));
