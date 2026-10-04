const fs = require('fs');

let content = fs.readFileSync('src/components/games/FeihuaGame.tsx', 'utf8');

const oldBlock = `      // 多结果 → 用选择弹窗（同 selectModal 流程）
      if (filteredHits.length > 1) {
        const items: SelectionItem[] = filteredHits.map((h) => ({
          poem: h.poem,
          reason: "exact" as const,
        }));
        setSelectModal(items);
        setFeedback(null);
        return;
      }`;

const newBlock = `      // 多结果 → 用选择弹窗（同 selectModal 流程）
      if (filteredHits.length > 1) {
        const mastered = filteredHits.filter(h => {
          const pid = \`\${h.poem.name.trim()}:\${h.poem.author.trim()}\`;
          return (store.poems[pid]?.level ?? 0) >= 2;
        });

        if (mastered.length === 1) {
          // 只有一首熟练，静默自动选择
          await handleAcceptHit(mastered[0].poem, matchedLines.length > 0 ? matchedLines[0].line : userLines[0]);
          return;
        }

        const items: SelectionItem[] = filteredHits.map((h) => ({
          poem: h.poem,
          reason: "exact" as const,
        }));
        setSelectModal(items);
        setFeedback(null);
        return;
      }`;

content = content.replace(oldBlock, newBlock);

fs.writeFileSync('src/components/games/FeihuaGame.tsx', content);
console.log("Patched global search multi-match successfully");
