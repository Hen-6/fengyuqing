const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const sourceDir = '/tmp/chinese-gushiwen/guwen';
const files = fs.readdirSync(sourceDir).filter(f => f.endsWith('.json'));

let poems = [];
let seen = new Set();

for (const file of files) {
    const content = fs.readFileSync(path.join(sourceDir, file), 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    
    for (const line of lines) {
        try {
            const item = JSON.parse(line);
            
            // Clean title: remove 《 and 》
            let title = (item.title || "").trim();
            title = title.replace(/[《》]/g, '');
            
            const author = (item.writer || "佚名").trim();
            const dynasty = (item.dynasty || "").trim();
            
            const key = `${title}:${author}`;
            if (seen.has(key)) continue;
            seen.add(key);
            
            let rawContent = item.content || "";
            // Split by \n or multiple spaces, clean up
            const contentArray = rawContent
                .split('\n')
                .map(l => l.trim())
                .filter(l => l.length > 0);
                
            const processedItem = {
                t: title,
                a: author,
                d: dynasty,
                content: contentArray,
                note: (item.remark || "").trim(),
                trans: (item.translation || "").trim(),
                shangxi: (item.shangxi || "").trim(),
                tags: item.type || []
            };
            
            poems.push(processedItem);
        } catch (e) {
            console.error("Error parsing line in", file);
        }
    }
}

console.log(`Total unique poems loaded: ${poems.length}`);

const payload = JSON.stringify({ poems });
const compressed = zlib.deflateSync(payload);

fs.writeFileSync('public/data/SUPER_DATASET_V2.bin', compressed);
console.log(`Wrote V2 dataset: ${(compressed.length / 1024 / 1024).toFixed(2)} MB`);
