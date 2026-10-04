const fs = require('fs');
const zlib = require('zlib');
const data = fs.readFileSync('public/data/SUPER_DATASET_DEDUPED.bin');
let jsonStr = '';
try { jsonStr = zlib.inflateSync(data).toString(); } catch(e) { jsonStr = data.toString(); }
const poems = JSON.parse(jsonStr);
const matches = poems.filter(p => p.content.some(c => c.includes("车如流水马如龙")));
console.log(matches.map(m => \`\${m.name}:\${m.author}\`));
