const fs = require('fs');
const path = 'src/lib/userContext.tsx';
let code = fs.readFileSync(path, 'utf8');

// Inside syncProgress, we should load custom poems from localStorage and send them to worker
const syncReplace = `
  const syncProgress = useCallback(async () => {
    if (!user) return;
    
    // Load custom poems and inject into worker
    if (typeof window !== "undefined") {
      try {
        const customPoemsStr = localStorage.getItem("fengyuqing_custom_poems_v1");
        if (customPoemsStr) {
          const customPoems = JSON.parse(customPoemsStr);
          if (Array.isArray(customPoems) && customPoems.length > 0) {
            import("./dbSearch").then(db => {
              db.addCustomPoemsToWorker(customPoems);
            });
          }
        }
      } catch (e) {
        console.error("Error loading custom poems", e);
      }
    }
`;

code = code.replace(/const syncProgress = useCallback\(async \(\) => \{\n\s*if \(\!user\) return;/, syncReplace);

// We need a function to save custom poems
const saveCustomReplace = `
  const saveCustomPoem = useCallback((poem: any) => {
    if (typeof window === "undefined") return;
    try {
      const customPoemsStr = localStorage.getItem("fengyuqing_custom_poems_v1");
      let customPoems = [];
      if (customPoemsStr) {
        customPoems = JSON.parse(customPoemsStr);
      }
      const existingIdx = customPoems.findIndex((p: any) => p.t === poem.t && p.a === poem.a);
      if (existingIdx !== -1) {
        customPoems[existingIdx] = poem;
      } else {
        customPoems.push(poem);
      }
      localStorage.setItem("fengyuqing_custom_poems_v1", JSON.stringify(customPoems));
      import("./dbSearch").then(db => {
        db.addCustomPoemsToWorker([poem]);
      });
    } catch (e) {
      console.error("Error saving custom poem", e);
    }
  }, []);

  const value = {
`;

code = code.replace(/const value = \{/, saveCustomReplace);
code = code.replace(/upsertPoemProgress,\n/, 'upsertPoemProgress,\n    saveCustomPoem,\n');

// Add saveCustomPoem to the context interface
code = code.replace(/upsertPoemProgress: \(poemKey: string, score: number\) => Promise<void>;/, 'upsertPoemProgress: (poemKey: string, score: number) => Promise<void>;\n  saveCustomPoem: (poem: any) => void;');

fs.writeFileSync(path, code);
