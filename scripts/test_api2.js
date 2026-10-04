const fs = require('fs');
const zlib = require('zlib');
const unzipped = zlib.unzipSync(fs.readFileSync('public/data/SUPER_DATASET_DEDUPED.json.gz')).toString('utf8');
const poems = JSON.parse(unzipped).poems;

const daoqing = poems.filter(p => p.t === "道情" && p.a === "白玉蟾");
console.log("Daoqing:", daoqing.length);
