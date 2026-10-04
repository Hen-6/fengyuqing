const fs = require('fs');

let content = fs.readFileSync('src/app/progress/page.tsx', 'utf8');

const regex = /"use client";\s*/;
content = content.replace(regex, '');

content = '"use client";\n\n' + content;

fs.writeFileSync('src/app/progress/page.tsx', content);
console.log("Fixed use client");
