const fs = require('fs');
const zlib = require('zlib');

console.log("Loading all_poems_lookup.json...");
const lookup = JSON.parse(fs.readFileSync('public/data/all_poems_lookup.json', 'utf8')).poems;

console.log("Loading untrimmed raw...");
const untrimmedStr = zlib.gunzipSync(fs.readFileSync('public/data/all_poems_untrimmed.json.gz')).toString('utf8');
const untrimmed = JSON.parse(untrimmedStr).poems;

const allPoems = [...lookup, ...untrimmed];
console.log("Combined count:", allPoems.length);

const finalJsonStr = JSON.stringify({ poems: allPoems });
console.log(`Uncompressed JSON size: ${(Buffer.byteLength(finalJsonStr)/1024/1024).toFixed(1)} MB`);

console.log("Compressing with gzip...");
const gzipped = zlib.gzipSync(finalJsonStr);
console.log(`Gzipped size: ${(gzipped.length/1024/1024).toFixed(1)} MB`);

fs.writeFileSync('public/data/SUPER_DATASET.json.gz', gzipped);
console.log("Done: public/data/SUPER_DATASET.json.gz");
