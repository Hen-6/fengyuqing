const fs = require('fs');
let content = fs.readFileSync('src/lib/dbSearch.ts', 'utf8');

// Patch searchOnline, generalSearch, searchByChar
content = content.replace(
    /note: "",\n\s*matchedLine: r\.matchedLine \|\| r\.lines\[0\] \|\| "",/g,
    'note: r.note || "",\n               trans: r.trans || "",\n               shangxi: r.shangxi || "",\n               tags: r.tags || [],\n               matchedLine: r.matchedLine || r.lines[0] || "",'
);

// Patch getPoemByKeyExport cached
content = content.replace(
    /content: cached\.content \|\| \[\], note: "", matchedLine: cached\.content\?\.\[0\] \|\| "",/g,
    'content: cached.content || [], note: cached.note || "", trans: cached.trans || "", shangxi: cached.shangxi || "", tags: cached.tags || [], matchedLine: cached.content?.[0] || "",'
);

// Patch getPoemByKeyExport worker
content = content.replace(
    /content: p\.content \|\| \[\], note: "", matchedLine: p\.content\?\.\[0\] \|\| "",/g,
    'content: p.content || [], note: p.note || "", trans: p.trans || "", shangxi: p.shangxi || "", tags: p.tags || [], matchedLine: p.content?.[0] || "",'
);

fs.writeFileSync('src/lib/dbSearch.ts', content);
