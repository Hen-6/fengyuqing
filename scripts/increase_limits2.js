const fs = require('fs');

let content = fs.readFileSync('src/components/games/FeihuaGame.tsx', 'utf8');

// Increase limit from 200 to 500 for searchByChar
content = content.replace(/searchByChar\(char, 200, mt\)/g, "searchByChar(char, 500, mt)");
content = content.replace(/searchByChar\(cleaned, cleaned.length > 1 \? matchType : 'exact'\)/g, "searchByChar(cleaned, 500, cleaned.length > 1 ? matchType : 'exact')");

fs.writeFileSync('src/components/games/FeihuaGame.tsx', content);
console.log("FeihuaGame searchByChar limit increased.");
