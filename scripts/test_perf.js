const fs = require('fs');
const data = JSON.parse(fs.readFileSync('public/data/all_poems_lookup.json', 'utf-8'));
const start = Date.now();
let count = 0;
for (const p of data.poems) {
    if (p.content) {
        for (const line of p.content) {
            if (line.includes('月')) {
                count++;
                break;
            }
        }
    }
}
console.log("Found:", count, "in", Date.now() - start, "ms");
