const fs = require('fs');

const path = 'src/lib/userContext.tsx';
let code = fs.readFileSync(path, 'utf8');

const injection = `
  // Automatically sweep invalid/garbage poems on load
  useEffect(() => {
    if (!hydrated || !userRef.current) return;
    
    // We run the sweep asynchronously so it doesn't block the UI
    const runSweep = async () => {
      try {
        const { getPoemByKeyExport } = await import("./dbSearch");
        let modified = false;
        const currentPoems = { ...storeRef.current.poems };
        
        for (const poemId of Object.keys(currentPoems)) {
          const poem = await getPoemByKeyExport(poemId);
          // If the poem doesn't exist in the database (or custom poems), it's invalid garbage
          if (!poem) {
            console.log("Sweeping invalid poem from progress:", poemId);
            delete currentPoems[poemId];
            modified = true;
            
            // Delete from cloud
            await supabase
              .from("user_progress")
              .delete()
              .eq("user_id", userRef.current.id)
              .eq("poem_id", poemId);
          }
        }
        
        if (modified) {
          const newStore = { ...storeRef.current, poems: currentPoems };
          saveStore(newStore);
          _setStore(newStore);
          console.log("Sweep complete.");
        }
      } catch (err) {
        console.error("Error during sweep:", err);
      }
    };
    
    // Run it once shortly after hydration
    setTimeout(runSweep, 2000);
  }, [hydrated, user]);
`;

// Insert the injection just before "const [overview, setOverview] = useState"
code = code.replace(/const \[overview, setOverview\] = useState/s, match => injection + '\n  ' + match);

fs.writeFileSync(path, code);
