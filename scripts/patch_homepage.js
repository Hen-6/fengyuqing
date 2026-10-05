const fs = require('fs');
const path = 'src/app/page.tsx';
let code = fs.readFileSync(path, 'utf8');

const targetStr = `    {
      href: "/games/jielong/",
      emoji: "🔗",
      title: "接龙",
      desc: "末字相接，续出诗句（≥4字）",
      tag: "进阶",
    },`;

const replacementStr = `    /*
    {
      href: "/games/jielong/",
      emoji: "🔗",
      title: "接龙",
      desc: "末字相接，续出诗句（≥4字）",
      tag: "进阶",
    },
    */`;

code = code.replace(targetStr, replacementStr);
fs.writeFileSync(path, code);
