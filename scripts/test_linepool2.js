const fs = require('fs');
const zlib = require('zlib');
const data = fs.readFileSync('public/data/SUPER_DATASET_DEDUPED.bin');
let jsonStr = zlib.inflateSync(data).toString();
const poems = JSON.parse(jsonStr).poems;

function getHits(char) {
    let exactMatches = [];
    for (const p of poems) {
        for (const line of p.content) {
            if (line.includes(char)) {
                exactMatches.push({ t: p.t, a: p.a, line });
                break;
            }
        }
        if (exactMatches.length >= 500) break;
    }
    
    // Check if any of these hits exactly match '车如流水马如龙'
    const carMatches = exactMatches.filter(h => h.line.replace(/[^\u4e00-\u9fa5]/g, '').includes('车如流水马如龙'));
    return carMatches;
}

console.log("车:", getHits("车"));
console.log("如:", getHits("如"));
