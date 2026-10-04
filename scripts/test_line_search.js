const fs = require('fs');
const zlib = require('zlib');
const data = fs.readFileSync('public/data/SUPER_DATASET_DEDUPED.bin');
let jsonStr = zlib.inflateSync(data).toString();
const poems = JSON.parse(jsonStr).poems;

function searchOnlineLine(query, limit=15) {
    let exactMatches = [];
    for (const p of poems) {
        for (const line of p.content) {
            if (line.replace(/[^\u4e00-\u9fa5]/g, '').includes(query)) {
                exactMatches.push({ t: p.t, a: p.a, line });
                break;
            }
        }
        if (exactMatches.length >= limit) break;
    }
    return exactMatches;
}

const hits = searchOnlineLine('车如流水马如龙');
console.log("Total hits:", hits.length);
hits.forEach((h, i) => console.log(i, h.t, h.a));
