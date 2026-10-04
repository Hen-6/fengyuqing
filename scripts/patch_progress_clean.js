const fs = require('fs');
let content = fs.readFileSync('src/app/progress/page.tsx', 'utf8');

const targetState = `  const [allLoaded, setAllLoaded] = useState(false);`;
const replaceState = `  const [allLoaded, setAllLoaded] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleanStatus, setCleanStatus] = useState("");

  const handleClean = async () => {
    if (cleaning) return;
    setCleaning(true);
    
    const keys = Object.keys(store.poems).filter(k => !OBJECTID_RE.test(k));
    let deletedCount = 0;
    
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      setCleanStatus(\`清理中 (\${i + 1}/\${keys.length})...\`);
      const res = await getPoemByKeyExport(key);
      if (!res) {
        deletePoemProgress(key);
        deletedCount++;
      }
    }
    
    setCleanStatus(\`清理完成 (删除了 \${deletedCount} 首)\`);
    setTimeout(() => {
      setCleanStatus("");
      setCleaning(false);
    }, 3000);
  };`;

const targetHeader = `<header className="flex items-center gap-4">
          <Link href="/" className="text-2xl text-text-muted hover:text-accent transition">←</Link>
          <h1 className="text-xl font-bold text-ink">学习详情</h1>
        </header>`;
const replaceHeader = `<header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-2xl text-text-muted hover:text-accent transition">←</Link>
            <h1 className="text-xl font-bold text-ink">学习详情</h1>
          </div>
          <button
            onClick={handleClean}
            disabled={cleaning}
            className="text-xs px-3 py-1.5 rounded bg-accent/10 text-accent hover:bg-accent/20 transition"
          >
            {cleanStatus || "一键清理失效诗词"}
          </button>
        </header>`;

content = content.replace(targetState, replaceState);
content = content.replace(targetHeader, replaceHeader);

fs.writeFileSync('src/app/progress/page.tsx', content);
