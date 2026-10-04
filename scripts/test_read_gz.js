const fs = require('fs');
const zlib = require('zlib');
const path = require('path');
const p = path.join(process.cwd(), 'public/data/SUPER_DATASET.json.gz');
const start = Date.now();
const gz = fs.readFileSync(p);
const unzipped = zlib.gunzipSync(gz).toString('utf8');
const data = JSON.parse(unzipped);
console.log(`Parsed ${data.poems.length} poems in ${Date.now() - start}ms`);
