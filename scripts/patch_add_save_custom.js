const fs = require('fs');

const path = 'src/lib/userContext.tsx';
let code = fs.readFileSync(path, 'utf8');

const injection = `
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
`;

// Insert it right before "const [overview, setOverview] = useState"
code = code.replace(/const \[overview, setOverview\] = useState/s, match => injection + '\n  ' + match);

fs.writeFileSync(path, code);
