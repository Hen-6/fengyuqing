const fs = require('fs');
const zlib = require('zlib');
const str = zlib.gunzipSync(fs.readFileSync('public/data/SUPER_DATASET_DEDUPED.json.gz')).toString('utf8');
const data = JSON.parse(str);
const linjiangxian = data.poems.filter(p => p.a === "晏几道" && p.t.includes("临江仙"));
console.log("Linjiangxian count:", linjiangxian.length);
console.log(linjiangxian.map(l => l.content[0]));
