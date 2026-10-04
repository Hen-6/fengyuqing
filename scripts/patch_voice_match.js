const fs = require('fs');
let content = fs.readFileSync('src/components/games/FeihuaGame.tsx', 'utf8');

const oldVoiceBlock1 = `    if (matchedLines.length > 0) {
      const match = matchedLines[0].matches[0];
      await handleAcceptHitVoiceMode(match.poem, match.line);
      return;
    }`;

const newVoiceBlock1 = `    if (matchedLines.length > 0) {
      const matches = matchedLines[0].matches;
      let match = matches[0];
      if (matches.length > 1) {
        const mastered = matches.filter(m => {
          const pid = \`\${m.poem.name.trim()}:\${m.poem.author.trim()}\`;
          return (store.poems[pid]?.level ?? 0) >= 2;
        });
        if (mastered.length === 1) match = mastered[0];
      }
      await handleAcceptHitVoiceMode(match.poem, match.line);
      return;
    }`;

content = content.replace(oldVoiceBlock1, newVoiceBlock1);

const oldVoiceBlock2 = `    if (filteredHits.length > 0) {
      const match = filteredHits[0].poem;
      await handleAcceptHitVoiceMode(match, match.matchedLine || match.content[0]);
      return;
    }`;

const newVoiceBlock2 = `    if (filteredHits.length > 0) {
      let match = filteredHits[0].poem;
      if (filteredHits.length > 1) {
        const mastered = filteredHits.filter(h => {
          const pid = \`\${h.poem.name.trim()}:\${h.poem.author.trim()}\`;
          return (store.poems[pid]?.level ?? 0) >= 2;
        });
        if (mastered.length === 1) match = mastered[0].poem;
      }
      await handleAcceptHitVoiceMode(match, match.matchedLine || match.content[0]);
      return;
    }`;

content = content.replace(oldVoiceBlock2, newVoiceBlock2);

const oldDepsVoice = `  }, [selectedChar, botPoem, localSeenPoems, linePool, handleAcceptHitVoiceMode, matchType]);`;
const newDepsVoice = `  }, [selectedChar, botPoem, localSeenPoems, linePool, handleAcceptHitVoiceMode, matchType, store.poems]);`;

content = content.replace(oldDepsVoice, newDepsVoice);

fs.writeFileSync('src/components/games/FeihuaGame.tsx', content);
console.log("Patched submitTextVoiceMode successfully");
