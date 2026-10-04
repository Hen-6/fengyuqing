const fs = require('fs');
let content = fs.readFileSync('src/components/games/XunhuaGame.tsx', 'utf8');

// Remove the broken end
content = content.replace(
    /        <\/>\n      \)}\n    <\/div>\n  \);\n}\n/g,
    `    </div>\n  );\n}\n`
);

fs.writeFileSync('src/components/games/XunhuaGame.tsx', content);
