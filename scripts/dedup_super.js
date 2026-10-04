const fs = require('fs');
const zlib = require('zlib');

console.log("Reading super dataset...");
const dataStr = zlib.gunzipSync(fs.readFileSync('public/data/SUPER_DATASET.json.gz')).toString('utf8');
const allPoems = JSON.parse(dataStr).poems;

console.log("Deduplicating by exact title+author+content...");
const unique = new Map();
for (const p of allPoems) {
    const key = p.t + '|' + p.a + '|' + p.content.join('|');
    if (!unique.has(key)) {
        unique.set(key, p);
    }
}
const deduped = Array.from(unique.values());
console.log(`Went from ${allPoems.length} to ${deduped.length} poems.`);

const finalJsonStr = JSON.stringify({ poems: deduped });
console.log(`Uncompressed JSON size: ${(Buffer.byteLength(finalJsonStr)/1024/1024).toFixed(1)} MB`);

console.log("Compressing with gzip...");
const gzipped = zlib.gzipSync(finalJsonStr);
console.log(`Gzipped size: ${(gzipped.length/1024/1024).toFixed(1)} MB`);

fs.writeFileSync('public/data/SUPER_DATASET_DEDUPED.json.gz', gzipped);
console.log("Done!");
