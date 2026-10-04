const fs = require('fs');
const d = JSON.parse(fs.readFileSync('public/data/all_poems_lookup.json', 'utf8'));
const matches = d.poems.filter(p => p.content.some(l => l.includes("落花人独立")));
console.log(matches.map(m => m.t + ' - ' + m.a));
