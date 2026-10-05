const fs = require('fs');

// 1. Update globals.css
let css = fs.readFileSync('src/app/globals.css', 'utf8');
if (!css.includes('.safe-pt')) {
  css += `\n/* Safe Area Utilities */\n.safe-pt { padding-top: calc(max(env(safe-area-inset-top), 20px) + 1.5rem); }\n.safe-pb { padding-bottom: calc(max(env(safe-area-inset-bottom), 20px) + 1.5rem); }\n`;
  fs.writeFileSync('src/app/globals.css', css);
}

const replaceInFile = (file, search, replace) => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes(search)) {
    content = content.replace(search, replace);
    fs.writeFileSync(file, content);
  }
};

const replaceRegexInFile = (file, regex, replace) => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(regex, replace);
  fs.writeFileSync(file, content);
};

// Replace regular pages
const target1 = 'className="min-h-screen paper-texture px-6 py-8"';
const repl1 = 'className="min-h-screen paper-texture px-6 pb-8 safe-pt"';
replaceInFile('src/app/daily/page.tsx', target1, repl1);
replaceInFile('src/app/progress/page.tsx', target1, repl1);
replaceInFile('src/app/search/page.tsx', target1, repl1);
replaceInFile('src/app/games/feihua/page.tsx', target1, repl1);
replaceInFile('src/app/games/jielong/page.tsx', target1, repl1);

// xunhua
replaceRegexInFile(
  'src/app/games/xunhua/page.tsx', 
  /style=\{\{\s*background:\s*"#fff",\s*minHeight:\s*"100vh"\s*\}\}/, 
  'style={{ background: "#fff", minHeight: "100vh" }} className="safe-pt"'
);

// LearnGame
replaceRegexInFile(
  'src/components/games/LearnGame.tsx', 
  /padding:\s*"16px"/, 
  'padding: "16px", paddingTop: "calc(max(env(safe-area-inset-top), 20px) + 16px)"'
);
