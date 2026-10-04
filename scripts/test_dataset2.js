const fs = require('fs');
const d = JSON.parse(fs.readFileSync('public/data/all_poems_lookup.json', 'utf8'));
const matches = d.poems.filter(p => p.a === '晏几道');
console.log("Yan Jidao poems:", matches.length);
console.log(matches.filter(m => m.t.includes("临江仙")).map(m => m.t));
