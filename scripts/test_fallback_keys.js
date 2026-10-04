const fs = require('fs');
const zlib = require('zlib');
const data = fs.readFileSync('public/data/SUPER_DATASET_DEDUPED.bin');
let jsonStr = zlib.inflateSync(data).toString();
const poems = JSON.parse(jsonStr).poems;

const fallbackKeys = [
    "静夜思:李白",
    "登鹳雀楼:王之涣",
    "春晓:孟浩然",
    "江雪:柳宗元",
    "鹿柴:王维",
    "相思:王维",
    "悯农:李绅",
    "寻隐者不遇:贾岛"
];

for (const key of fallbackKeys) {
    const [t, a] = key.split(':');
    const p = poems.find(x => x.t === t && x.a === a);
    console.log(key, p ? "FOUND" : "NOT FOUND");
}
