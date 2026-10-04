const fs = require('fs');

let content = fs.readFileSync('src/app/progress/page.tsx', 'utf8');

const newComponent = `
function SyncDataButton() {
  const { store, upsertPoemProgress, deletePoemProgress } = useUser();
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleSync = async () => {
    if (!confirm("这将会根据最新 37 万题库重新匹配您所有已学诗词的名称。对于无法在题库中找到的诗词，将会彻底删除记录。是否继续？")) return;
    setSyncing(true);
    setResult("正在校验数据，请勿关闭页面...");
    
    let migrated = 0;
    let deleted = 0;
    
    const keys = Object.keys(store.poems);
    for (const key of keys) {
      if (/^[0-9a-f]{24}$/i.test(key)) continue; // ignore mongo ids? or maybe let them be deleted?
      // Actually, if it's an old mongo ID, getPoemByKeyExport will definitely return null and delete it.
      
      const res = await getPoemByKeyExport(key);
      if (!res) {
        deletePoemProgress(key);
        deleted++;
      } else {
        const newKey = \`\${res.name.trim()}:\${res.author.trim()}\`;
        if (newKey !== key) {
          const oldProg = store.poems[key];
          upsertPoemProgress(newKey, (prev) => {
              if (prev && prev.level > oldProg.level) return prev;
              return { ...oldProg };
          });
          deletePoemProgress(key);
          migrated++;
        }
      }
    }
    
    setResult(\`同步完成！共迁移统一了 \${migrated} 首诗词名称，删除了 \${deleted} 首无法匹配的记录。\`);
    setSyncing(false);
  };

  return (
    <div className="mt-8 rounded-xl border border-accent/20 bg-accent/5 p-4">
      <h3 className="font-semibold text-accent mb-2">统一诗词数据</h3>
      <p className="text-xs text-text-muted mb-4">
        如果您之前学习的诗词名称（如《相见欢》）与最新题库（如《望江南·多少恨》）不匹配，可点击下方按钮自动迁移。遇到无法匹配的条目将自动清除。
      </p>
      <button
        onClick={handleSync}
        disabled={syncing}
        className="w-full btn-secondary text-sm py-2 disabled:opacity-50"
        style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
      >
        {syncing ? '正在统一数据...' : '严格统一我的诗词名称并清理无效记录'}
      </button>
      {result && <p className="mt-2 text-xs text-accent text-center">{result}</p>}
    </div>
  );
}
`;

if (!content.includes('function SyncDataButton')) {
    content = newComponent + '\n' + content;
}

content = content.replace(
    `        {[2, 3, 4, 5].map((lvl) => {`,
    `        <SyncDataButton />\n\n        {[2, 3, 4, 5].map((lvl) => {`
);

fs.writeFileSync('src/app/progress/page.tsx', content);
console.log("Patched progress page successfully");
