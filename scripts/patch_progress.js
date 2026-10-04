const fs = require('fs');

let content = fs.readFileSync('src/app/progress/page.tsx', 'utf8');

// Remove SyncDataButton usage
content = content.replace(/<SyncDataButton \/>\n/g, '');

// Find and remove the SyncDataButton definition block
const syncDefStart = content.indexOf('function SyncDataButton() {');
if (syncDefStart !== -1) {
    const importStart = content.indexOf('import { useEffect, useState } from "react";', syncDefStart);
    if (importStart !== -1) {
        content = content.slice(0, syncDefStart) + content.slice(importStart);
    }
}

fs.writeFileSync('src/app/progress/page.tsx', content);
console.log("Removed SyncDataButton.");
