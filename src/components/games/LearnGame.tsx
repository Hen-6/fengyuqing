"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useUser } from "@/lib/userContext";
import { getPoemByKeyExport, SearchResult } from "@/lib/localSearch";

export function LearnGame() {
  const { store, loaded, upsertPoemProgress } = useUser();
  const [currentPoem, setCurrentPoem] = useState<SearchResult | null>(null);
  const [currentKey, setCurrentKey] = useState<string>("");
  const [revealed, setRevealed] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [hasNoPoems, setHasNoPoems] = useState(false);

  const startNext = useCallback(async (currentStore = store) => {
    setRevealed(false);
    setCurrentPoem(null);
    setCurrentKey("");

    const keys = Object.keys(currentStore.poems).filter((k) => currentStore.poems[k].level >= 1);
    
    if (keys.length === 0) {
      setHasNoPoems(true);
      return;
    }
    setHasNoPoems(false);

    let randomKey = keys[Math.floor(Math.random() * keys.length)];
    // Prevent showing the same poem twice in a row if there are multiple
    if (keys.length > 1 && randomKey === currentKey) {
      const idx = keys.indexOf(randomKey);
      randomKey = keys[(idx + 1) % keys.length];
    }

    const poem = await getPoemByKeyExport(randomKey);
    setCurrentKey(randomKey);
    setCurrentPoem(poem);
  }, [store, currentKey]);

  useEffect(() => {
    if (loaded && !initialized) {
      setInitialized(true);
      startNext(store);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, initialized]);

  const handleLevelSelect = (level: number) => {
    if (currentKey) {
      upsertPoemProgress(currentKey, p => ({ ...p, level }));
      const newStore = {
        ...store,
        poems: {
          ...store.poems,
          [currentKey]: { ...store.poems[currentKey], level }
        }
      };
      startNext(newStore);
    }
  };

  if (!loaded || (!initialized && !hasNoPoems)) {
    return (
      <div style={{ textAlign: "center", padding: "40px", color: "#666", fontFamily: "system-ui, sans-serif" }}>
        <p style={{ fontSize: "14px" }}>加载学习模式…</p>
      </div>
    );
  }

  return (
    <div style={{ background: "#fff", minHeight: "100vh", padding: "16px", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: "600px", margin: "0 auto 24px" }}>
        <Link href="/" style={{ color: "#333", textDecoration: "none", fontSize: "14px", fontWeight: "bold" }}>
          ← 返回
        </Link>
        <span style={{ fontSize: "14px", fontWeight: "bold", color: "#333" }}>学习模式</span>
        <div style={{ width: "40px" }} /> {/* Spacer for centering */}
      </div>

      <div style={{ maxWidth: "600px", margin: "0 auto", textAlign: "center" }}>
        {hasNoPoems ? (
          <div style={{ padding: "40px 20px", color: "#666" }}>
            <p style={{ marginBottom: "16px" }}>您还没有添加任何诗词到学习库。</p>
            <p style={{ fontSize: "14px" }}>请先前往搜索页面，将诗词的熟练度设为1或以上，然后再来抽查背诵。</p>
            <Link href="/search/" style={{ display: "inline-block", marginTop: "24px", padding: "10px 20px", background: "#6aaa64", color: "#fff", borderRadius: "4px", textDecoration: "none", fontWeight: "bold", fontSize: "14px" }}>
              前往搜索
            </Link>
          </div>
        ) : (
          currentPoem ? (
            <div style={{ background: "#f9f9f9", borderRadius: "8px", padding: "32px 16px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
              <h2 style={{ fontSize: "24px", fontWeight: "bold", color: "#333", marginBottom: "8px", margin: 0 }}>
                {currentPoem.poem.name}
              </h2>
              <p style={{ fontSize: "14px", color: "#666", margin: "0 0 32px 0" }}>
                [{currentPoem.poem.dynasty}] {currentPoem.poem.author}
              </p>

              {!revealed ? (
                <div style={{ padding: "40px 0" }}>
                  <p style={{ fontSize: "14px", color: "#999", marginBottom: "24px" }}>（请尝试背诵全诗）</p>
                  <button
                    onClick={() => setRevealed(true)}
                    style={{ padding: "12px 32px", background: "#333", color: "#fff", border: "none", borderRadius: "24px", fontSize: "16px", fontWeight: "bold", cursor: "pointer", boxShadow: "0 2px 6px rgba(0,0,0,0.15)" }}
                  >
                    显示内容
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: "18px", lineHeight: "1.8", color: "#333", marginBottom: "40px", whiteSpace: "pre-wrap" }}>
                    {currentPoem.poem.content.map((line: string, i: number) => (
                      <div key={i}>{line}</div>
                    ))}
                  </div>

                  <div style={{ borderTop: "1px solid #eee", paddingTop: "24px" }}>
                    <p style={{ fontSize: "14px", color: "#666", marginBottom: "16px", fontWeight: "bold" }}>背诵情况如何？</p>
                    <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
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
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: "40px" }}>
              <p>无法加载该诗词数据（{currentKey}）</p>
              <button onClick={() => startNext(store)} style={{ marginTop: "16px", padding: "8px 16px", cursor: "pointer" }}>跳过</button>
            </div>
          )
        )}
      </div>
    </div>
  );
}
