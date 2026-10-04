const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const p = path.join(process.cwd(), 'public', 'data', 'SUPER_DATASET_DEDUPED.json.gz');
const gz = fs.readFileSync(p);
const unzipped = zlib.unzipSync(gz).toString('utf8');
const globalPoemsCache = JSON.parse(unzipped).poems;

console.log("Loaded", globalPoemsCache.length, "poems.");

const query = "落花人独立";
const mode = "general";
const limit = 10;

let exactMatches = [];
for (const p of globalPoemsCache) {
    let matched = false;
    if (p.t === query || p.a === query || p.t.includes(query) || p.a.includes(query)) {
        exactMatches.push({ ...p, score: 100, matchedLine: p.content[0] });
        matched = true;
    }
    if (!matched) {
        for (const line of p.content) {
            if (line.includes(query)) {
                exactMatches.push({ ...p, matchedLine: line, score: 90 });
                matched = true;
                break;
            }
        }
    }
}

exactMatches.sort((a, b) => b.score - a.score);
console.log(exactMatches.slice(0, 5).map(m => m.t + " (" + m.a + ")"));
