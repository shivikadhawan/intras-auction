// Rebuilds index.html from src/app.html + src/core.js.  Run: node build.js
const fs = require('fs'), path = require('path');
const src = p => fs.readFileSync(path.join(__dirname, 'src', p), 'utf8');
const core = src('core.js').replace(/if \(typeof module[^\n]*\n?/, '');
const body = src('app.html').split('/*CORE*/').join(core);
const head = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<style>html,body{margin:0}img{max-width:100%}</style>\n</head>\n<body>\n';
fs.writeFileSync(path.join(__dirname, 'index.html'), head + body + '\n</body>\n</html>\n');
console.log('Wrote index.html');
