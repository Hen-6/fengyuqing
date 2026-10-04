const fs = require('fs');
let content = fs.readFileSync('src/lib/userContext.tsx', 'utf8');

const importAdd = `import { getPoemByKeyExport } from "./dbSearch";\nexport const UserContext`;
content = content.replace('export const UserContext', importAdd);

const targetMount = `  // 2) Client hydration
  useEffect(() => {
    const s = loadStore();
    _setStore(s);
    setLoaded(true);
    setHydrated(true);
  }, []);`;

const replaceMount = `  // 2) Client hydration
  useEffect(() => {
    const s = loadStore();
    _setStore(s);
    setLoaded(true);
    setHydrated(true);
    
    // ONE-TIME SWEEP FOR INVALID KEYS
    if (typeof window !== "undefined" && !(window as any).hasSwept) {
      (window as any).hasSwept = true;
      const sweep = async () => {
        const keys = Object.keys(s.poems);
        let removedCount = 0;
        for (const k of keys) {
          if (/^[0-9a-f]{24}$/i.test(k)) continue;
          const res = await getPoemByKeyExport(k);
          if (!res) {
            deletePoemProgress(k);
            removedCount++;
          }
        }
        if (removedCount > 0) {
          console.log(\`[AutoSweep] Removed \${removedCount} invalid poems.\`);
          alert(\`自动清理了 \${removedCount} 首失效的诗词进度。\`);
        }
      };
      sweep();
    }
  }, [deletePoemProgress]);`;

content = content.replace(targetMount, replaceMount);

fs.writeFileSync('src/lib/userContext.tsx', content);
