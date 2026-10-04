const fs = require('fs');
const zlib = require('zlib');
const str = zlib.gunzipSync(fs.readFileSync('public/data/SUPER_DATASET_DEDUPED.json.gz')).toString('utf8');
const data = JSON.parse(str);
const daoqing = data.poems.filter(p => p.t === "道情" && p.a === "白玉蟾");
console.log("Daoqing count:", daoqing.length);
