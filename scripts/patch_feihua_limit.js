const fs = require('fs');

let content = fs.readFileSync('src/components/games/FeihuaGame.tsx', 'utf8');

// The places where setSelectModal is called:
// 1. filteredHits.map(...)
content = content.replace(
    /const items: SelectionItem\[\] = filteredHits\.map\(\(h\) => \(\{\n\s*poem: h\.poem,\n\s*reason: "exact" as const,\n\s*\}\)\);/g,
    `const items: SelectionItem[] = filteredHits.map((h) => ({
          poem: h.poem,
          reason: "exact" as const,
        })).slice(0, 5);`
);

// 2. matchedLines[0].matches.map(...)
content = content.replace(
    /const items: SelectionItem\[\] = matchedLines\[0\]\.matches\.map\(\(item\) => \(\{\n\s*poem: item\.poem,\n\s*reason: "exact",\n\s*\}\)\);/g,
    `const items: SelectionItem[] = matchedLines[0].matches.map((item) => ({
        poem: item.poem,
        reason: "exact" as const,
      })).slice(0, 5);`
);

// 3. For multiline input
content = content.replace(
    /setMultiLineInput\(grouped\.map\(\(g\) => \(\{\n\s*line: g\.line,\n\s*matches: g\.matches\.map\(\(m\) => m\.poem\),\n\s*\}\)\)\);/g,
    `setMultiLineInput(grouped.map((g) => ({
        line: g.line,
        matches: g.matches.map((m) => m.poem).slice(0, 5),
      })));`
);

fs.writeFileSync('src/components/games/FeihuaGame.tsx', content);
console.log("FeihuaGame modal limits applied.");
