const fs = require('fs');

let content = fs.readFileSync('src/components/games/FeihuaGame.tsx', 'utf8');

// The block to replace in submitText:
const oldBlock = `    if (matchedLines.length === 1 && matchedLines[0].matches.length > 1) {
      // 单行但多结果（同文不同诗）→ 弹窗选择
      const items: SelectionItem[] = matchedLines[0].matches.map((item) => ({
        poem: item.poem,
        reason: "exact",
      }));
      setSelectModal(items);
      setFeedback(null);
      return;
    }`;

const newBlock = `    if (matchedLines.length === 1 && matchedLines[0].matches.length > 1) {
      // 单行但多结果（同文不同诗）
      // 首先检查是否有且仅有一个选项在已学诗词中且熟练度 >= 2
      const masteredMatches = matchedLines[0].matches.filter(item => {
        const pid = \`\${item.poem.name.trim()}:\${item.poem.author.trim()}\`;
        return (store.poems[pid]?.level ?? 0) >= 2;
      });

      if (masteredMatches.length === 1) {
        // 唯一高熟练度匹配，静默自动选择
        await handleAcceptHit(masteredMatches[0].poem, masteredMatches[0].line);
        return;
      }

      // 否则弹窗选择
      const items: SelectionItem[] = matchedLines[0].matches.map((item) => ({
        poem: item.poem,
        reason: "exact",
      }));
      setSelectModal(items);
      setFeedback(null);
      return;
    }`;

content = content.replace(oldBlock, newBlock);

// We must also update submitText dependency array to include `store.poems`.
const oldDeps = `  }, [selectedChar, botPoem, localSeenPoems, linePool]);`;
const newDeps = `  }, [selectedChar, botPoem, localSeenPoems, linePool, store.poems, handleAcceptHit]);`;

content = content.replace(oldDeps, newDeps);

fs.writeFileSync('src/components/games/FeihuaGame.tsx', content);
console.log("Patched submitText successfully");
