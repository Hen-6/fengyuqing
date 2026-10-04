const fs = require('fs');
let content = fs.readFileSync('src/components/games/FeihuaGame.tsx', 'utf8');

// Remove getMasteredLevel
content = content.replace(/function getMasteredLevel[\s\S]*?return 0;\n}\n/, '');

// Revert the 3 filter replacements
content = content.replace(
    `const masteredMatches = matchedLines[0].matches.filter(item => {
        return getMasteredLevel(item.poem, store.poems) >= 2;
      });`,
    `const masteredMatches = matchedLines[0].matches.filter(item => {
        const pid = \`\${item.poem.name.trim()}:\${item.poem.author.trim()}\`;
        return (store.poems[pid]?.level ?? 0) >= 2;
      });`
);

content = content.replace(
    `const mastered = filteredHits.filter(h => {
          return getMasteredLevel(h.poem, store.poems) >= 2;
        });`,
    `const mastered = filteredHits.filter(h => {
          const pid = \`\${h.poem.name.trim()}:\${h.poem.author.trim()}\`;
          return (store.poems[pid]?.level ?? 0) >= 2;
        });`
);

content = content.replace(
    `const mastered = matches.filter(m => {
          return getMasteredLevel(m.poem, store.poems) >= 2;
        });`,
    `const mastered = matches.filter(m => {
          const pid = \`\${m.poem.name.trim()}:\${m.poem.author.trim()}\`;
          return (store.poems[pid]?.level ?? 0) >= 2;
        });`
);

fs.writeFileSync('src/components/games/FeihuaGame.tsx', content);
console.log("Reverted fuzzy matching successfully");
