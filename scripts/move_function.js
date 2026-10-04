const fs = require('fs');

const content = fs.readFileSync('src/components/games/FeihuaGame.tsx', 'utf8');

const regex = /\/\*\* 用户在弹窗中选中一首诗 \*\/\n\s*const handleAcceptHit = useCallback\(async \(poem: OnlinePoemResult, userLine: string\) => \{[\s\S]*?\}, \[selectedChar, botPoem, markPoemAnswered, localSeenPoems\]\);\n/;

const match = content.match(regex);
if (match) {
    let newContent = content.replace(match[0], '');
    const targetIdx = newContent.indexOf('  /** 提交用户输入 */');
    newContent = newContent.slice(0, targetIdx) + match[0] + '\n' + newContent.slice(targetIdx);
    fs.writeFileSync('src/components/games/FeihuaGame.tsx', newContent);
    console.log("Moved handleAcceptHit successfully");
} else {
    console.error("Could not find handleAcceptHit");
}
