const fs = require('fs');

let content = fs.readFileSync('src/components/games/FeihuaGame.tsx', 'utf8');

content = content.replace(
`    // 1. 检测是否含关键字
    if (!stripPunct(input).includes(selectedChar)) {
      setFeedback({ ok: false, msg: \`诗句中必须包含关键字「\${selectedChar}」\` });
      return;
    }`,
`    // 1. 检测是否含关键字
    if (matchType === 'exact') {
      if (!stripPunct(input).includes(selectedChar)) {
        setFeedback({ ok: false, msg: \`诗句中必须包含关键字「\${selectedChar}」\` });
        return;
      }
    } else {
      const chars = selectedChar.split('');
      if (!chars.every(c => stripPunct(input).includes(c))) {
        setFeedback({ ok: false, msg: \`诗句中必须包含关键字「\${selectedChar}」中的所有字\` });
        return;
      }
    }`
);

content = content.replace(
`  }, [selectedChar, botPoem, markPoemAnswered, localSeenPoems, botTurn]);`,
`  }, [selectedChar, botPoem, markPoemAnswered, localSeenPoems, botTurn, matchType, linePool]);`
);

content = content.replace(
`    if (!cleanInput.includes(selectedChar)) {
      setFeedback({ ok: false, msg: \`“\${input}”不含关键字「\${selectedChar}」\` });
      setTimeout(() => setFeedback(prev => prev?.msg.includes("不含关键字") ? null : prev), 3000);
      return;
    }`,
`    if (matchType === 'exact') {
      if (!cleanInput.includes(selectedChar)) {
        setFeedback({ ok: false, msg: \`“\${input}”不含关键字「\${selectedChar}」\` });
        setTimeout(() => setFeedback(prev => prev?.msg.includes("不含关键字") ? null : prev), 3000);
        return;
      }
    } else {
      const chars = selectedChar.split('');
      if (!chars.every(c => cleanInput.includes(c))) {
        setFeedback({ ok: false, msg: \`“\${input}”未包含关键字「\${selectedChar}」中的所有字\` });
        setTimeout(() => setFeedback(prev => prev?.msg.includes("未包含") ? null : prev), 3000);
        return;
      }
    }`
);

content = content.replace(
`  }, [selectedChar, botPoem, localSeenPoems, linePool, handleAcceptHitVoiceMode]);`,
`  }, [selectedChar, botPoem, localSeenPoems, linePool, handleAcceptHitVoiceMode, matchType]);`
);

fs.writeFileSync('src/components/games/FeihuaGame.tsx', content);
