const fs = require('fs');
let content = fs.readFileSync('src/components/games/LearnGame.tsx', 'utf8');

content = content.replace(
    'upsertPoemProgress(currentKey, level);',
    'upsertPoemProgress(currentKey, p => ({ ...p, level }));'
);

content = content.replace(
    '{currentPoem.title}',
    '{currentPoem.poem.name}'
);

content = content.replace(
    '[{currentPoem.dynasty}] {currentPoem.author}',
    '[{currentPoem.poem.dynasty}] {currentPoem.poem.author}'
);

content = content.replace(
    '{currentPoem.lines.map((line, i) => (',
    '{currentPoem.poem.content.map((line: string, i: number) => ('
);

fs.writeFileSync('src/components/games/LearnGame.tsx', content);
