const fs = require('fs');
let content = fs.readFileSync('src/app/page.tsx', 'utf8');

const target = `{
      href: "/search/",
      emoji: "🔍",
      title: "搜索诗词",
      desc: "按作者、标题或内容搜索，快捷调整熟练度",
      tag: "工具",
    },`;

const replace = `{
      href: "/games/learn/",
      emoji: "📖",
      title: "学习模式",
      desc: "随机抽查已学诗词，遮蔽内容，检验背诵",
      tag: "复习",
    },
    {
      href: "/search/",
      emoji: "🔍",
      title: "搜索诗词",
      desc: "按作者、标题或内容搜索，快捷调整熟练度",
      tag: "工具",
    },`;

content = content.replace(target, replace);
fs.writeFileSync('src/app/page.tsx', content);
