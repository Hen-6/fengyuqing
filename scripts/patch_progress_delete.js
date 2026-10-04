const fs = require('fs');
let content = fs.readFileSync('src/app/progress/page.tsx', 'utf8');

const target = `        const res = await getPoemByKeyExport(item.key);
        if (res && res.poem) {
          found = {
            t: res.poem.name,
            a: res.poem.author,
            d: res.poem.dynasty,
            content: res.poem.content
          };
        }
      } catch (e) {
        console.error("fetch online fail", e);
      }
    }
    
    if (found) {`;

const replace = `        const res = await getPoemByKeyExport(item.key);
        if (res && res.poem) {
          found = {
            t: res.poem.name,
            a: res.poem.author,
            d: res.poem.dynasty,
            content: res.poem.content,
            note: res.poem.note,
            trans: res.poem.trans,
            shangxi: res.poem.shangxi,
            tags: res.poem.tags
          };
        }
      } catch (e) {
        console.error("fetch online fail", e);
      }
    }
    
    if (!found) {
      if (confirm(\`未能在新字库中找到诗词【\${item.t}】(可能已被除名)。是否直接从学习记录中删除它？\`)) {
        deletePoemProgress(item.key);
      }
      return;
    }
    
    if (found) {`;

content = content.replace(target, replace);
fs.writeFileSync('src/app/progress/page.tsx', content);
