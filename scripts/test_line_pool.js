const fs = require('fs');
const zlib = require('zlib');
const data = fs.readFileSync('public/data/SUPER_DATASET_DEDUPED.bin');
let jsonStr = zlib.inflateSync(data).toString();
const poems = JSON.parse(jsonStr).poems;

function searchByChar(char, limit=200) {
    let exactMatches = [];
    for (const p of poems) {
        for (const line of p.content) {
            if (line.includes(char)) {
                exactMatches.push({ t: p.t, a: p.a, line });
                break; // only push the poem once
            }
        }
        if (exactMatches.length >= limit) break;
    }
    return exactMatches;
}

const hits = searchByChar('车');
console.log("Total hits:", hits.length);
console.log("Is 望江南 in hits?", hits.some(h => h.t.includes('望江南') && h.a.includes('李煜')));
