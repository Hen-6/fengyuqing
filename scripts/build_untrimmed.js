const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

console.log("Reading raw NDJSON files...");
const files = ['poems1.json', 'poems2.json', 'poems3.json', 'poems4.json'];
const allPoems = [];

function cleanHtml(str) {
    if (!str) return "";
    return str.replace(/<[^>]+>/g, "").trim();
}

function processFile(filename) {
    const content = fs.readFileSync(path.join('data/yxcs', filename), 'utf8');
    const lines = content.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === '[' || trimmed === ']' || trimmed === ',') continue;
        try {
            const obj = JSON.parse(trimmed);
            const title = obj.name || obj.title || "";
            if (!title) continue;
            
            const author = obj.author || "佚名";
            const dynasty = obj.dynasty || "未知";
            
            if (!obj.content || !Array.isArray(obj.content)) continue;
            
            const rawContent = obj.content;
            const contentLines = [];
            for (const item of rawContent) {
                const cleaned = cleanHtml(String(item));
                if (!cleaned) continue;
                
                // naive split by punctuation for our game lines
                const parts = cleaned.split(/[\n\r]+|([。！？\.]+)/).filter(Boolean);
                for (const p of parts) {
                    const pTrimmed = p.trim();
                    if (pTrimmed && !contentLines.includes(pTrimmed)) {
                        contentLines.push(pTrimmed);
                    }
                }
            }
            if (contentLines.length === 0) continue;
            
            allPoems.push({
                t: title,
                a: author,
                d: dynasty,
                content: contentLines
            });
        } catch(e) {
            // ignore bad json lines
        }
    }
}

for (const f of files) {
    console.log(`Processing ${f}...`);
    processFile(f);
}

// Check for explicitly requested missing Daoist poem
const hasDaoqing = allPoems.some(p => p.t === "道情" && p.a === "白玉蟾");
if (!hasDaoqing) {
    allPoems.push({
        t: "道情",
        a: "白玉蟾",
        d: "宋代",
        content: ["白云黄鹤道人家，一琴一剑一杯茶。", "羽衣常带烟霞色，不染人间桃李花。"]
    });
}

console.log(`Total untrimmed poems: ${allPoems.length}`);

const finalJsonStr = JSON.stringify({ poems: allPoems });
console.log(`Uncompressed JSON size: ${(Buffer.byteLength(finalJsonStr)/1024/1024).toFixed(1)} MB`);

console.log("Compressing with gzip...");
const gzipped = zlib.gzipSync(finalJsonStr);
console.log(`Gzipped size: ${(gzipped.length/1024/1024).toFixed(1)} MB`);

fs.writeFileSync('public/data/all_poems_untrimmed.json.gz', gzipped);
console.log("Done: public/data/all_poems_untrimmed.json.gz");
