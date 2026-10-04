const fs = require('fs');
const zlib = require('zlib');

// Read the existing V2 dataset
const data = fs.readFileSync('public/data/SUPER_DATASET_V2.bin');
const jsonStr = zlib.inflateSync(data).toString();
const dataset = JSON.parse(jsonStr);

// Check if already added
if (!dataset.poems.some(p => p.t === '卧云')) {
    dataset.poems.push({
        t: "卧云",
        a: "白玉蟾",
        d: "宋代",
        content: [
            "满室天香仙子家，一琴一剑一杯茶。",
            "羽衣常带烟霞色，不惹人间桃李花。"
        ],
        note: "这首诗表现了道家清心寡欲、超凡脱俗的高尚境界。“惹”字一作“染”。",
        trans: "满室飘散着天界的香气，这是神仙的居所，身边只有一琴、一剑和一杯清茶。身上穿着的羽衣总是带着云烟晚霞的色彩，绝不去沾惹凡尘世俗中的桃李繁花。",
        shangxi: "此诗为南宗道教祖师白玉蟾所作，全诗充满道家隐逸出尘之气。前两句写景与物，后两句写人与心境。羽衣烟霞，代表了道士修行的清净；“不惹人间桃李花”则隐喻不沾染世俗的名利情欲，境界极高。",
        tags: ["道教", "隐逸", "修心"]
    });
    console.log("Added 卧云 by 白玉蟾");
}

const payload = JSON.stringify(dataset);
const compressed = zlib.deflateSync(payload);
fs.writeFileSync('public/data/SUPER_DATASET_V2.bin', compressed);
console.log(`Wrote appended V2 dataset: ${(compressed.length / 1024 / 1024).toFixed(2)} MB`);
