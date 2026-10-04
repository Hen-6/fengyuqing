const fs = require('fs');
const zlib = require('zlib');
const unzipped = zlib.unzipSync(fs.readFileSync('public/data/SUPER_DATASET_DEDUPED.json.gz')).toString('utf8');
const poems = JSON.parse(unzipped).poems;
const p = poems.find(x => x.t === "静夜思" && x.a === "李白");
console.log("Found:", !!p);
