const fs = require('fs');

let content = fs.readFileSync('src/components/games/XunhuaGame.tsx', 'utf8');

// Add import
content = content.replace(
    'import { searchOnline, getPoemByKeyExport, SearchResult } from "@/lib/localSearch";',
    'import { searchOnline, getPoemByKeyExport, SearchResult } from "@/lib/localSearch";\nimport { matchPinyin } from "@/lib/pinyinUtils";'
);

// Replace exactMatch
content = content.replace(
    'const exactMatch = couplets.find((c) => c.text === clean);',
    'const exactMatch = couplets.find((c) => c.text === clean || matchPinyin(c.text, clean));'
);

fs.writeFileSync('src/components/games/XunhuaGame.tsx', content);
