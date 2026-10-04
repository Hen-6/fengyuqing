const fs = require('fs');
let content = fs.readFileSync('src/app/progress/page.tsx', 'utf8');

const target = `      setActivePoem({
        _id: item.key,
        name: found.t,
        author: found.a,
        dynasty: found.d,
        content: found.content,
        note: "",
        matchedLine: found.content[0] || "",
        matchedLineIndex: 0
      });`;

const replace = `      setActivePoem({
        _id: item.key,
        name: found.t,
        author: found.a,
        dynasty: found.d,
        content: found.content,
        note: (found as any).note || "",
        trans: (found as any).trans || "",
        shangxi: (found as any).shangxi || "",
        tags: (found as any).tags || [],
        matchedLine: found.content[0] || "",
        matchedLineIndex: 0
      });`;

content = content.replace(target, replace);
fs.writeFileSync('src/app/progress/page.tsx', content);
