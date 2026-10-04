const fs = require('fs');
const zlib = require('zlib');

console.log("Reading data/meilisearch_poems.json...");
const lines = fs.readFileSync('data/meilisearch_poems.json', 'utf8').split('\n');
const poems = [];
for (const line of lines) {
    if (!line.trim()) continue;
    const p = JSON.parse(line);
    poems.push({
        t: p.title,
        a: p.author,
        d: p.dynasty,
        content: p.lines
    });
}
console.log(`Loaded ${poems.length} poems from chinese-poetry.`);

const finalJsonStr = JSON.stringify({ poems });
console.log(`Uncompressed JSON size: ${(Buffer.byteLength(finalJsonStr)/1024/1024).toFixed(1)} MB`);

console.log("Compressing with gzip...");
const gzipped = zlib.gzipSync(finalJsonStr);
console.log(`Gzipped size: ${(gzipped.length/1024/1024).toFixed(1)} MB`);

fs.writeFileSync('public/data/SUPER_DATASET_DEDUPED.json.gz', gzipped);
console.log("Done packaging SUPER_DATASET_DEDUPED.json.gz");
