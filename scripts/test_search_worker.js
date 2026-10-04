const fs = require('fs');
const zlib = require('zlib');
const data = fs.readFileSync('public/data/SUPER_DATASET_DEDUPED.bin');
let jsonStr = zlib.inflateSync(data).toString();
const poems = JSON.parse(jsonStr).poems;

function search(query) {
    let exactMatches = [];
    for (const p of poems) {
        if (p.t.includes(query)) {
            exactMatches.push(`${p.t}:${p.a}`);
        }
        if (exactMatches.length >= 20) break;
    }
    return exactMatches;
}

console.log("Search '相见欢':", search("相见欢"));
console.log("Search '望江南':", search("望江南"));
console.log("Search '车如流水马如龙' line:", 
    poems.filter(p => p.content.some(c => c.includes("车如流水马如龙"))).map(p => `${p.t}:${p.a}`)
);
