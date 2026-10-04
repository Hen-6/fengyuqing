const fs = require('fs');
let content = fs.readFileSync('src/components/games/XunhuaGame.tsx', 'utf8');

content = content.replace(
    '  if (loadingTarget || !userLoaded) {',
    '  if (loadingTarget || !userLoaded || !target) {'
);

fs.writeFileSync('src/components/games/XunhuaGame.tsx', content);
