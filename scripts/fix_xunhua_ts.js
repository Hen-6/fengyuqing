const fs = require('fs');
let content = fs.readFileSync('src/components/games/XunhuaGame.tsx', 'utf8');

content = content.replace(
    'import { OnlinePoemResult, searchOnline, getPoemByKeyExport, SearchResult } from "@/lib/localSearch";',
    'import { OnlinePoemResult, searchOnline, getPoemByKeyExport, SearchResult, searchByChar } from "@/lib/localSearch";\nimport { CharPicker } from "@/components/ui/CharPicker";'
);

content = content.replace(
    /const hitKeys = new Set\(hits\.map\(h => `\$\{h\.t\}:\$\{h\.a\}`\)\);/g,
    'const hitKeys = new Set<string>(hits.map((h: any) => `${h.t}:${h.a}`));'
);

content = content.replace(
    /knownKeys = Array\.from\(hitKeys\);/g,
    'knownKeys = Array.from(hitKeys) as string[];'
);

content = content.replace(
    /<button\n\s*onClick=\{startRound\}\n\s*style=\{\{ flex: 1, padding: "10px", background: "#fff", color: "#333"/g,
    '<button\n              onClick={() => startRound()}\n              style={{ flex: 1, padding: "10px", background: "#fff", color: "#333"'
);

fs.writeFileSync('src/components/games/XunhuaGame.tsx', content);
