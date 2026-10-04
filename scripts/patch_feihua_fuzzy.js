const fs = require('fs');

let content = fs.readFileSync('src/components/games/FeihuaGame.tsx', 'utf8');

const helper = `
function getMasteredLevel(poem: OnlinePoemResult, storePoems: Record<string, {level: number}>): number {
  const pid = \`\${poem.name.trim()}:\${poem.author.trim()}\`;
  if (storePoems[pid]) return storePoems[pid].level;

  const cleanTitle = poem.name.replace(/[·\\s]/g, '');
  const author = poem.author.trim();
  
  for (const storeKey of Object.keys(storePoems)) {
    const parts = storeKey.split(':');
    if (parts.length < 2) continue;
    const sTitle = parts[0];
    const sAuthor = parts[1];
    if (sAuthor.trim() !== author) continue;
    
    const cleanStoreTitle = sTitle.replace(/[·\\s]/g, '');
    if (cleanTitle.includes(cleanStoreTitle) || cleanStoreTitle.includes(cleanTitle)) {
      return storePoems[storeKey].level;
    }
  }
  
  return 0;
}
`;

if (!content.includes('function getMasteredLevel')) {
    content = content.replace('export function FeihuaGame() {', helper + '\nexport function FeihuaGame() {');
}

// Replace checks
content = content.replace(
    `const masteredMatches = matchedLines[0].matches.filter(item => {
        const pid = \`\${item.poem.name.trim()}:\${item.poem.author.trim()}\`;
        return (store.poems[pid]?.level ?? 0) >= 2;
      });`,
    `const masteredMatches = matchedLines[0].matches.filter(item => {
        return getMasteredLevel(item.poem, store.poems) >= 2;
      });`
);

content = content.replace(
    `const mastered = filteredHits.filter(h => {
          const pid = \`\${h.poem.name.trim()}:\${h.poem.author.trim()}\`;
          return (store.poems[pid]?.level ?? 0) >= 2;
        });`,
    `const mastered = filteredHits.filter(h => {
          return getMasteredLevel(h.poem, store.poems) >= 2;
        });`
);

content = content.replace(
    `const mastered = matches.filter(m => {
          const pid = \`\${m.poem.name.trim()}:\${m.poem.author.trim()}\`;
          return (store.poems[pid]?.level ?? 0) >= 2;
        });`,
    `const mastered = matches.filter(m => {
          return getMasteredLevel(m.poem, store.poems) >= 2;
        });`
);

fs.writeFileSync('src/components/games/FeihuaGame.tsx', content);
console.log("Patched fuzzy matching successfully");
