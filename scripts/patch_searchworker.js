const fs = require('fs');

let content = fs.readFileSync('src/workers/searchWorker.ts', 'utf8');

const targetBlock = `            if (mode === 'line') {
                for (const p of poems) {
                    for (const line of p.content) {
                        if (line.includes(query)) {`;

const newBlock = `            if (mode === 'line') {
                const cleanQuery = query.replace(/[^\\u4e00-\\u9fa5]/g, "");
                for (const p of poems) {
                    for (const line of p.content) {
                        const cleanLine = line.replace(/[^\\u4e00-\\u9fa5]/g, "");
                        if (cleanLine.includes(cleanQuery) || line.includes(query)) {`;

content = content.replace(targetBlock, newBlock);

fs.writeFileSync('src/workers/searchWorker.ts', content);
console.log("Patched searchWorker.ts");
