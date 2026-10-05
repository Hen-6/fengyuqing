const fs = require('fs');
const path = 'src/app/progress/page.tsx';
let code = fs.readFileSync(path, 'utf8');

// The new correct order of hooks and logic without breaking React rules
const replacement = `
export default function ProgressPage() {
  const { store, loaded, upsertPoemProgress, deletePoemProgress, hardNuke } = useUser();
  const [rankMap, setRankMap] = useState<Map<string, { t: string; a: string; d: string }>>(new Map());
  const [allLoaded, setAllLoaded] = useState(false);
  const [workerLookupMap, setWorkerLookupMap] = useState<Record<string, {d: string}>>({});

  useEffect(() => {
    const list = getRankList();
    const map = new Map<string, { t: string; a: string; d: string }>();
    for (const p of list) {
      map.set(\`\${p.t}:\${p.a}\`, { t: p.t, a: p.a, d: p.d });
    }
    setRankMap(map);
    setAllLoaded(true);
  }, []);

  const practiced = store?.poems ? Object.values(store.poems).filter(
    (p) => !OBJECTID_RE.test(p.poemId) && p.level > 1
  ) : [];

  useEffect(() => {
    if (!allLoaded || practiced.length === 0) return;
    let isActive = true;
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
      if (!isActive) return;
      const newMap: Record<string, {d: string}> = {};
      let changed = false;
      results.forEach(r => {
        if (r) {
          newMap[r.id] = { d: r.d };
          changed = true;
        }
      });
      if (changed) setWorkerLookupMap(prev => ({...prev, ...newMap}));
    };
    fetchMissing();
    return () => { isActive = false; };
  }, [allLoaded, practiced.length, rankMap]);

  if (!loaded) return null;

  type PoemEntry = { key: string; title: string; author: string; dynasty: string; p: PoemProgress };
`;

// Extract everything from export default function ProgressPage() { up to type PoemEntry = ...
const startStr = "export default function ProgressPage() {";
const endStr = "  type PoemEntry = { key: string; title: string; author: string; dynasty: string; p: PoemProgress };";

const startIndex = code.indexOf(startStr);
const endIndex = code.indexOf(endStr) + endStr.length;

if (startIndex !== -1 && endIndex !== -1) {
  code = code.slice(0, startIndex) + replacement + code.slice(endIndex);
  fs.writeFileSync(path, code);
} else {
  console.log("Could not find blocks to replace.");
}
