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
                exactMatches.push({ t: p.t, a: p.a });
                break;
            }
        }
        if (exactMatches.length >= 500) break;
    }
    return exactMatches.some(p => p.t.includes('望江南') && p.a.includes('李煜'));
}

console.log("车:", getHits("车"));
console.log("如:", getHits("如"));
console.log("流:", getHits("流"));
console.log("水:", getHits("水"));
console.log("马:", getHits("马"));
console.log("龙:", getHits("龙"));
