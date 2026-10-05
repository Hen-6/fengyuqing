const fs = require('fs');
const path = 'src/app/progress/page.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Add state for worker lookup AFTER practiced is defined
const target = '  const practiced = Object.values(store.poems).filter(\n    (p) => !OBJECTID_RE.test(p.poemId) && p.level > 1\n  );';
const stateInjection = `

  const [workerLookupMap, setWorkerLookupMap] = useState<Record<string, {d: string}>>({});

  useEffect(() => {
    if (!allLoaded) return;
    const fetchMissing = async () => {
      const promises = practiced.map(async (prog) => {
        if (rankMap.has(prog.poemId)) return null;
        try {
          const res = await getPoemByKeyExport(prog.poemId);
          if (res && res.poem) {
            return { id: prog.poemId, d: res.poem.dynasty };
          }
        } catch (e) {}
        return null;
      });
      const results = await Promise.all(promises);
      const newMap: Record<string, {d: string}> = {};
      let changed = false;
      results.forEach(r => {
        if (r) {
          newMap[r.id] = { d: r.d };
          changed = true;
        }
      });
      if (changed) setWorkerLookupMap(newMap);
    };
    fetchMissing();
  }, [allLoaded, practiced.length, rankMap]);
`;

code = code.replace(target, target + stateInjection);

// 2. Update the d resolution logic
code = code.replace(/const d = info\?\.d \|\| lookup\?\.d \|\| "未知";/, 'const d = info?.d || lookup?.d || workerLookupMap[prog.poemId]?.d || "未知";');

fs.writeFileSync(path, code);
