const fs = require('fs');

const path = 'src/lib/userContext.tsx';
let code = fs.readFileSync(path, 'utf8');

const oldSweep = `        for (const poemId of Object.keys(currentPoems)) {
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
        }`;

const newSweep = `        for (const poemId of Object.keys(currentPoems)) {
          const poem = await getPoemByKeyExport(poemId);
          
          let isValid = false;
          if (poem) {
             const returnedTitle = poem.poem.name;
             const returnedAuthor = poem.poem.author;
             const expectedTitle = poemId.split(':')[0];
             const expectedAuthor = poemId.split(':')[1];
             
             // Must strictly match, or we consider it garbage
             if (returnedTitle === expectedTitle && returnedAuthor === expectedAuthor) {
                 isValid = true;
             }
          }
          
          if (!isValid) {
            console.log("Sweeping invalid/dirty poem from progress:", poemId);
            delete currentPoems[poemId];
            modified = true;
            
            // Delete from cloud
            await supabase
              .from("user_progress")
              .delete()
              .eq("user_id", userRef.current.id)
              .eq("poem_id", poemId);
          }
        }`;

code = code.replace(oldSweep, newSweep);

fs.writeFileSync(path, code);
