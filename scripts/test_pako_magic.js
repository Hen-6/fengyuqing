const fs = require('fs');
const buf = fs.readFileSync('public/data/SUPER_DATASET_DEDUPED.json.gz');
console.log("First byte:", buf[0], buf[1]);
