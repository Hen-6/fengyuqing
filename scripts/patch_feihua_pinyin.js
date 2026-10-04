const fs = require('fs');

let content = fs.readFileSync('src/components/games/FeihuaGame.tsx', 'utf8');

// Add import
content = content.replace(
    'import { pinyin } from "pinyin-pro";',
    'import { pinyin } from "pinyin-pro";\nimport { matchPinyin, getCleanPinyin } from "@/lib/pinyinUtils";'
);

// Remove local definitions
const localDefRegex1 = /\s*const getCleanPinyin = \(str: string\) => \{[\s\S]*?return "";\n\s*\}\n\s*\};\n/;
const localDefRegex2 = /\s*const matchPinyin = \(a: string, b: string\) => \{[\s\S]*?return pA && pB && pA === pB;\n\s*\};\n/;

content = content.replace(localDefRegex1, "");
content = content.replace(localDefRegex2, "");
content = content.replace(localDefRegex1, ""); // do it again because it's defined twice!
content = content.replace(localDefRegex2, "");

fs.writeFileSync('src/components/games/FeihuaGame.tsx', content);
