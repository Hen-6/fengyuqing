const fs = require('fs');
const zlib = require('zlib');
const data = fs.readFileSync('public/data/SUPER_DATASET_DEDUPED.bin');
let jsonStr = zlib.inflateSync(data).toString();
const poems = JSON.parse(jsonStr).poems;

function levenshtein(s, t) {
    if (s === t) return 0;
    if (s.length === 0) return t.length;
    if (t.length === 0) return s.length;
    let v0 = new Array(t.length + 1);
    let v1 = new Array(t.length + 1);
    for (let i = 0; i < v0.length; i++) v0[i] = i;
    for (let i = 0; i < s.length; i++) {
        v1[0] = i + 1;
        for (let j = 0; j < t.length; j++) {
            const cost = s[i] === t[j] ? 0 : 1;
            v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
        }
        for (let j = 0; j < v0.length; j++) v0[j] = v1[j];
    }
    return v1[t.length];
}

function sharesEnoughChars(line, query) {
    let matchCount = 0;
    for (let i = 0; i < query.length; i++) {
        if (line.includes(query[i])) matchCount++;
    }
    return matchCount >= Math.floor(query.length / 2);
}

const query = "取次花丛懒回顾半缘修道半缘俊";
let exactMatches = [];
let roughMatches = [];

const cleanQuery = query.replace(/[^\u4e00-\u9fa5]/g, "");
for (const p of poems) {
    for (const line of p.content) {
        const cleanLine = line.replace(/[^\u4e00-\u9fa5]/g, "");
        if (cleanLine.includes(cleanQuery) || line.includes(query)) {
            exactMatches.push({ t: p.t, a: p.a });
            break;
        }
    }
}

if (exactMatches.length === 0) {
    for (const p of poems) {
        let bestDist = 999;
        for (const line of p.content) {
            if (!sharesEnoughChars(line, query)) continue;
            
            if (Math.abs(line.length - query.length) < 5) {
                const dist = levenshtein(line.replace(/[^\u4e00-\u9fa5]/g, ""), query.replace(/[^\u4e00-\u9fa5]/g, ""));
                if (dist < bestDist) bestDist = dist;
            }
        }
        if (bestDist <= 2) {
            roughMatches.push({ t: p.t, a: p.a, d: bestDist });
        }
    }
}

console.log("Exact matches:", exactMatches);
console.log("Fuzzy matches:", roughMatches.sort((a,b)=>a.d - b.d));
