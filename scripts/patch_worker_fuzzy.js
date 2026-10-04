const fs = require('fs');
let content = fs.readFileSync('src/workers/searchWorker.ts', 'utf8');

const targetRegex = /const dist = levenshtein\(line, query\);/g;
content = content.replace(targetRegex, 'const dist = levenshtein(line.replace(/[^\\u4e00-\\u9fa5]/g, ""), query.replace(/[^\\u4e00-\\u9fa5]/g, ""));');

const targetRegex2 = /for \(let i = 0; i <= line\.length - query\.length; i\+\+\) {/g;
const replace2 = `const cleanLineForSub = line.replace(/[^\\u4e00-\\u9fa5]/g, "");
                            const cleanQueryForSub = query.replace(/[^\\u4e00-\\u9fa5]/g, "");
                            for (let i = 0; i <= cleanLineForSub.length - cleanQueryForSub.length; i++) {`;
content = content.replace(targetRegex2, replace2);

const targetRegex3 = /const sub = line\.substring\(i, i \+ query\.length\);\n\s*const dist = levenshtein\(sub, query\);/g;
const replace3 = `const sub = cleanLineForSub.substring(i, i + cleanQueryForSub.length);
                                const dist = levenshtein(sub, cleanQueryForSub);`;
content = content.replace(targetRegex3, replace3);

fs.writeFileSync('src/workers/searchWorker.ts', content);
