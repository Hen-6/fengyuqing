const fs = require('fs');
const d = JSON.parse(fs.readFileSync('data/poems_content.json', 'utf8'));
const matches = Object.entries(d).filter(([k, v]) => v.lines.join('').includes('落花人独立'));
if (matches.length > 0) console.log(matches.map(([k, v]) => k));
else console.log("NO MATCHES");
