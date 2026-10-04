const fs = require('fs');
let content = fs.readFileSync('src/components/games/LearnGame.tsx', 'utf8');

// Modify startNext
const targetStartNext = `    const poem = await getPoemByKeyExport(randomKey);
    setCurrentKey(randomKey);
    setCurrentPoem(poem);
  }, [store, currentKey]);`;

const replaceStartNext = `    const poem = await getPoemByKeyExport(randomKey);
    if (!poem) {
      // Auto-delete invalid key and retry
      deletePoemProgress(randomKey);
      const newStore = { ...currentStore, poems: { ...currentStore.poems } };
      delete newStore.poems[randomKey];
      startNext(newStore);
      return;
    }
    setCurrentKey(randomKey);
    setCurrentPoem(poem);
  }, [store, currentKey, deletePoemProgress]);`;

content = content.replace(targetStartNext, replaceStartNext);

// Add deletePoemProgress to useUser destructuring
content = content.replace(
  'const { store, loaded, upsertPoemProgress } = useUser();',
  'const { store, loaded, upsertPoemProgress, deletePoemProgress } = useUser();'
);

// We need to add Translation/Appreciation to LearnGame's display when revealed.
const targetDetails = `                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>`;

const addDetails = `
                  {/* Translation and Appreciation */}
                  <div style={{ marginBottom: "32px", textAlign: "left", display: "flex", flexDirection: "column", gap: "12px" }}>
                    {currentPoem.poem.tags && currentPoem.poem.tags.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center", marginBottom: "8px" }}>
                        {currentPoem.poem.tags.map((t: string, i: number) => (
                          <span key={i} style={{ background: "#f0f8ff", color: "#2980b9", border: "1px solid #bce0fd", padding: "2px 8px", borderRadius: "12px", fontSize: "12px" }}>
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    {currentPoem.poem.trans && (
                      <details style={{ background: "#f5f5f5", padding: "12px", borderRadius: "8px" }}>
                        <summary style={{ cursor: "pointer", fontWeight: "bold", fontSize: "14px", color: "#333", outline: "none" }}>译文</summary>
                        <div style={{ marginTop: "8px", fontSize: "14px", color: "#555", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>{currentPoem.poem.trans}</div>
                      </details>
                    )}
                    {currentPoem.poem.note && (
                      <details style={{ background: "#f5f5f5", padding: "12px", borderRadius: "8px" }}>
                        <summary style={{ cursor: "pointer", fontWeight: "bold", fontSize: "14px", color: "#333", outline: "none" }}>注释</summary>
                        <div style={{ marginTop: "8px", fontSize: "14px", color: "#555", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>{currentPoem.poem.note}</div>
                      </details>
                    )}
                    {currentPoem.poem.shangxi && (
                      <details style={{ background: "#f5f5f5", padding: "12px", borderRadius: "8px" }}>
                        <summary style={{ cursor: "pointer", fontWeight: "bold", fontSize: "14px", color: "#333", outline: "none" }}>赏析</summary>
                        <div style={{ marginTop: "8px", fontSize: "14px", color: "#555", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>{currentPoem.poem.shangxi}</div>
                      </details>
                    )}
                  </div>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>`;

content = content.replace(targetDetails, addDetails);

// Remove the manual skip block because we now auto-delete and fetch next
const manualSkipBlock = `          ) : (
            <div style={{ padding: "40px" }}>
              <p>无法加载该诗词数据（{currentKey}）</p>
              <button onClick={() => startNext(store)} style={{ marginTop: "16px", padding: "8px 16px", cursor: "pointer" }}>跳过</button>
            </div>
          )
        )}
      </div>`;
const replaceSkipBlock = `          )
        )}
      </div>`;
content = content.replace(manualSkipBlock, replaceSkipBlock);

// Replace "currentPoem ? (" with "currentPoem && (" since there's no else block now
content = content.replace(
  '          currentPoem ? (',
  '          currentPoem && ('
);

fs.writeFileSync('src/components/games/LearnGame.tsx', content);
