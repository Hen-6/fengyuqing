const fs = require('fs');
let content = fs.readFileSync('src/components/games/LearnGame.tsx', 'utf8');

// Add import
content = content.replace(
    'import { getPoemByKeyExport, SearchResult } from "@/lib/localSearch";',
    'import { getPoemByKeyExport, SearchResult } from "@/lib/localSearch";\nimport { LEVEL_LABELS, setLevel } from "@/lib/srs";'
);

// Update updater logic
content = content.replace(
    'upsertPoemProgress(currentKey, p => ({ ...p, level }));',
    'upsertPoemProgress(currentKey, p => setLevel(p, level));'
);

// Replace button section
const oldButtons = `                    <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
                      <button
                        onClick={() => handleLevelSelect(1)}
                        style={{ flex: "1 1 auto", minWidth: "120px", padding: "12px", background: "#fff", color: "#e74c3c", border: "1px solid #e74c3c", borderRadius: "4px", fontSize: "14px", fontWeight: "bold", cursor: "pointer" }}
                      >
                        需要复习 (Level 1)
                      </button>
                      <button
                        onClick={() => handleLevelSelect(2)}
                        style={{ flex: "1 1 auto", minWidth: "120px", padding: "12px", background: "#fff", color: "#f39c12", border: "1px solid #f39c12", borderRadius: "4px", fontSize: "14px", fontWeight: "bold", cursor: "pointer" }}
                      >
                        比较熟悉 (Level 2)
                      </button>
                      <button
                        onClick={() => handleLevelSelect(3)}
                        style={{ flex: "1 1 auto", minWidth: "120px", padding: "12px", background: "#fff", color: "#6aaa64", border: "1px solid #6aaa64", borderRadius: "4px", fontSize: "14px", fontWeight: "bold", cursor: "pointer" }}
                      >
                        完全掌握 (Level 3)
                      </button>
                    </div>`;

const newButtons = `                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {[1, 2, 3, 4, 5].map((lvl) => {
                        const isCurrent = store.poems[currentKey]?.level === lvl;
                        return (
                          <button
                            key={lvl}
                            onClick={() => handleLevelSelect(lvl)}
                            style={{
                              padding: "12px",
                              background: isCurrent ? "#f0f8ff" : "#fff",
                              border: \`1px solid \${isCurrent ? "#2980b9" : "#ddd"}\`,
                              borderRadius: "4px",
                              cursor: "pointer",
                              textAlign: "left",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              transition: "all 0.2s"
                            }}
                          >
                            <span style={{ fontSize: "15px", fontWeight: "bold", color: "#333" }}>
                              Lv.{lvl} {LEVEL_LABELS[lvl as keyof typeof LEVEL_LABELS].name}
                            </span>
                            <span style={{ fontSize: "13px", color: "#666" }}>
                              {LEVEL_LABELS[lvl as keyof typeof LEVEL_LABELS].desc}
                            </span>
                          </button>
                        );
                      })}
                    </div>`;

content = content.replace(oldButtons, newButtons);
fs.writeFileSync('src/components/games/LearnGame.tsx', content);
