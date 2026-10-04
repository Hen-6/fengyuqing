const fs = require('fs');
let content = fs.readFileSync('src/lib/userContext.tsx', 'utf8');

const target = `    if (typeof window !== "undefined" && !(window as any).hasSwept) {
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
    }`;

const replace = `    if (typeof window !== "undefined" && !(window as any).hasHardWiped) {
      (window as any).hasHardWiped = true;
      console.log("HARD WIPE EXECUTING");
      localStorage.removeItem("fengyuqing_v1");
      const fresh = { overview: { version: 1, lastSync: 0 }, poems: {} };
      _setStore(fresh);
      alert("已按照您的要求，彻底清空了所有的学习进度。系统已恢复为最初的纯净状态。");
    }`;

content = content.replace(target, replace);
fs.writeFileSync('src/lib/userContext.tsx', content);
