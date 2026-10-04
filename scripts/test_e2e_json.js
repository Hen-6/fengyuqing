const fs = require('fs');
const pako = require('pako');
const buffer = fs.readFileSync('public/data/SUPER_DATASET_DEDUPED.bin');
const decompressed = pako.inflate(new Uint8Array(buffer), { to: 'string' });
console.log(decompressed.slice(0, 100));
