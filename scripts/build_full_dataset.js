const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function walkSync(dir, filelist = []) {
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file);
    if (fs.statSync(dirFile).isDirectory()) {
      filelist = walkSync(dirFile, filelist);
    } else {
      if (dirFile.endsWith(".json")) filelist.push(dirFile);
    }
  });
  return filelist;
}

const sourceDir = '/tmp/canvachen-poetry/data';
const files = walkSync(sourceDir);

let poems = [];
let seen = new Set();

for (const file of files) {
    try {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (!Array.isArray(data)) continue;
        
        for (const item of data) {
            let title = (item.title || "").trim();
            // Clean title: remove 《 and 》
            title = title.replace(/[《》]/g, '');
            // Filter out exact "句" to be safe
            if (title === "句") continue;
            
            const author = (item.author || "佚名").trim();
            const dynasty = (item.dynasty || "").trim();
            
            const key = `${title}:${author}`;
            if (seen.has(key)) continue;
            seen.add(key);
            
            // CanvaChen uses paragraphs for content
            let contentArray = [];
            if (Array.isArray(item.paragraphs)) {
                contentArray = item.paragraphs;
            } else if (typeof item.content === 'string') {
                contentArray = item.content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            } else if (Array.isArray(item.content)) {
                contentArray = item.content;
            }
            
            if (contentArray.length === 0) continue;
            
            const processedItem = {
                t: title,
                a: author,
                d: dynasty,
                content: contentArray,
                note: "",
                trans: "",
                shangxi: "",
                tags: []
            };
            
            poems.push(processedItem);
        }
    } catch (e) {
        console.error("Error parsing", file);
    }
}

console.log(`Total unique poems loaded for FULL: ${poems.length}`);

const payload = JSON.stringify({ poems });
const compressed = zlib.deflateSync(payload);

fs.writeFileSync('public/data/SUPER_DATASET_FULL.bin', compressed);
console.log(`Wrote FULL dataset: ${(compressed.length / 1024 / 1024).toFixed(2)} MB`);
