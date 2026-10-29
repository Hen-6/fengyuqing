"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useUser } from "@/lib/userContext";
import { getPoemByKeyExport, getAllWorkerKeys, SearchResult } from "@/lib/localSearch";
import { LEVEL_LABELS, setLevel } from "@/lib/srs";

type ScopeMode = "learned" | "favorite" | "explore";

function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function LearnGame() {
  const { store, loaded, upsertPoemProgress, deletePoemProgress, toggleFavorite } = useUser();
  const [scope, setScope] = useState<ScopeMode>("learned");
  const [currentPoem, setCurrentPoem] = useState<SearchResult | null>(null);
  const [currentKey, setCurrentKey] = useState<string>("");
  const [revealed, setRevealed] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [hasNoPoems, setHasNoPoems] = useState(false);

  // Non-repeating rotation deck/queue
  const queueRef = useRef<string[]>([]);
  const poolKeysRef = useRef<string[]>([]);
  const allWorkerKeysRef = useRef<string[]>([]);
  const [cycleIndex, setCycleIndex] = useState(0);
  const [cycleTotal, setCycleTotal] = useState(0);

  // Counts for scopes
  const learnedCount = Object.values(store?.poems || {}).filter((p) => p.level >= 1).length;
  const favoriteCount = Object.values(store?.poems || {}).filter((p) => p.isFavorite).length;

  // Read URL search param on mount (e.g. /games/learn?mode=favorite)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const modeParam = params.get("mode");
      if (modeParam === "favorite") {
        setScope("favorite");
      } else if (modeParam === "explore") {
        setScope("explore");
      }
    }
  }, []);

  // Pre-fetch all worker keys once in background for explore mode
  useEffect(() => {
    getAllWorkerKeys().then((keys) => {
      if (keys && keys.length > 0) {
        allWorkerKeysRef.current = keys;
      }
    });
  }, []);

  const getScopeKeys = useCallback(
    async (targetScope: ScopeMode, currentStore = store): Promise<string[]> => {
      if (targetScope === "favorite") {
        return Object.keys(currentStore.poems).filter((k) => currentStore.poems[k].isFavorite);
      }
      if (targetScope === "learned") {
        return Object.keys(currentStore.poems).filter((k) => currentStore.poems[k].level >= 1);
      }
      if (targetScope === "explore") {
        if (allWorkerKeysRef.current.length > 0) {
          return allWorkerKeysRef.current;
        }
        const keys = await getAllWorkerKeys();
        if (keys && keys.length > 0) {
          allWorkerKeysRef.current = keys;
          return keys;
        }
        return Object.keys(currentStore.poems);
      }
      return [];
    },
    [store]
  );

  const startNextFromQueue = useCallback(
    async (targetScope = scope, currentStore = store) => {
      setRevealed(false);
      setCurrentPoem(null);

      // If queue is empty, regenerate and shuffle
      if (!queueRef.current || queueRef.current.length === 0) {
        const pool = await getScopeKeys(targetScope, currentStore);
        if (pool.length === 0) {
          setHasNoPoems(true);
          setCurrentKey("");
          return;
        }
        setHasNoPoems(false);
        poolKeysRef.current = pool;
        queueRef.current = shuffleArray(pool);
        setCycleTotal(pool.length);
        setCycleIndex(1);
      } else {
        setCycleIndex((prev) => prev + 1);
      }

      let nextKey = queueRef.current.pop();
      if (!nextKey) {
        setHasNoPoems(true);
        return;
      }

      const poem = await getPoemByKeyExport(nextKey);
      if (!poem) {
        // If key failed, delete from progress if in learned mode and try next
        if (targetScope === "learned" || targetScope === "favorite") {
          deletePoemProgress(nextKey);
        }
        startNextFromQueue(targetScope, currentStore);
        return;
      }

      setCurrentKey(nextKey);
      setCurrentPoem(poem);
    },
    [scope, store, getScopeKeys, deletePoemProgress]
  );

  // Switch scope
  const handleScopeChange = useCallback(
    (newScope: ScopeMode) => {
      setScope(newScope);
      queueRef.current = [];
      startNextFromQueue(newScope, store);
    },
    [startNextFromQueue, store]
  );

  useEffect(() => {
    if (loaded && !initialized) {
      setInitialized(true);
      startNextFromQueue(scope, store);
    }
  }, [loaded, initialized, startNextFromQueue, scope, store]);

  const handleLevelSelect = (level: number) => {
    if (currentKey) {
      upsertPoemProgress(currentKey, (p) => setLevel(p, level));
      const newStore = {
        ...store,
        poems: {
          ...store.poems,
          [currentKey]: { ...store.poems[currentKey], level },
        },
      };
      startNextFromQueue(scope, newStore);
    }
  };

  const isCurrentFavorite = Boolean(store?.poems[currentKey]?.isFavorite);

  if (!loaded || (!initialized && !hasNoPoems)) {
    return (
      <div style={{ textAlign: "center", padding: "40px", color: "#666", fontFamily: "system-ui, sans-serif" }}>
        <p style={{ fontSize: "14px" }}>加载学习模式…</p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#fff",
        minHeight: "100vh",
        padding: "16px",
        paddingTop: "calc(max(env(safe-area-inset-top), 20px) + 2.5rem)",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          maxWidth: "600px",
          margin: "0 auto 16px",
        }}
      >
        <Link
          href="/"
          style={{
            color: "#333",
            textDecoration: "none",
            fontSize: "15px",
            fontWeight: "bold",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "8px 16px",
            borderRadius: "20px",
            backgroundColor: "rgba(0, 0, 0, 0.05)",
            minHeight: "44px",
            minWidth: "44px",
          }}
        >
          ← 返回
        </Link>
        <span style={{ fontSize: "16px", fontWeight: "bold", color: "#333" }}>学习复习</span>
        <div style={{ width: "44px" }} />
      </div>

      {/* Scope Selector Segmented Tabs */}
      <div style={{ maxWidth: "600px", margin: "0 auto 20px" }}>
        <div
          style={{
            display: "flex",
            background: "#f0f0f0",
            padding: "4px",
            borderRadius: "12px",
            gap: "4px",
          }}
        >
          <button
            onClick={() => handleScopeChange("learned")}
            style={{
              flex: 1,
              padding: "8px 4px",
              fontSize: "13px",
              fontWeight: scope === "learned" ? "bold" : "normal",
              borderRadius: "8px",
              border: "none",
              background: scope === "learned" ? "#fff" : "transparent",
              color: scope === "learned" ? "#111" : "#666",
              boxShadow: scope === "learned" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            📚 已学 ({learnedCount})
          </button>
          <button
            onClick={() => handleScopeChange("favorite")}
            style={{
              flex: 1,
              padding: "8px 4px",
              fontSize: "13px",
              fontWeight: scope === "favorite" ? "bold" : "normal",
              borderRadius: "8px",
              border: "none",
              background: scope === "favorite" ? "#fff" : "transparent",
              color: scope === "favorite" ? "#b45309" : "#666",
              boxShadow: scope === "favorite" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            ⭐ 重点 ({favoriteCount})
          </button>
          <button
            onClick={() => handleScopeChange("explore")}
            style={{
              flex: 1,
              padding: "8px 4px",
              fontSize: "13px",
              fontWeight: scope === "explore" ? "bold" : "normal",
              borderRadius: "8px",
              border: "none",
              background: scope === "explore" ? "#fff" : "transparent",
              color: scope === "explore" ? "#111" : "#666",
              boxShadow: scope === "explore" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            🌐 全库探索 (9880)
          </button>
        </div>

        {/* Rotation progress bar/hint */}
        {cycleTotal > 0 && !hasNoPoems && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "8px",
              padding: "0 4px",
              fontSize: "12px",
              color: "#888",
            }}
          >
            <span>
              {scope === "favorite"
                ? "⭐ 重点专练轮换"
                : scope === "learned"
                ? "📚 全部已学无重轮换"
                : "🌐 全库随机轮换探索"}
            </span>
            <span style={{ fontWeight: "bold" }}>
              第 {Math.min(cycleIndex, cycleTotal)} / {cycleTotal} 首
            </span>
          </div>
        )}
      </div>

      <div style={{ maxWidth: "600px", margin: "0 auto", textAlign: "center" }}>
        {hasNoPoems ? (
          <div style={{ padding: "40px 20px", color: "#666" }}>
            {scope === "favorite" ? (
              <div>
                <span style={{ fontSize: "40px", display: "block", marginBottom: "12px" }}>⭐</span>
                <p style={{ fontWeight: "bold", fontSize: "16px", color: "#333", marginBottom: "8px" }}>
                  您还没有标记任何重点诗词
                </p>
                <p style={{ fontSize: "14px", color: "#777", marginBottom: "20px" }}>
                  在学习中、学习详情或搜索列表里，点击诗词旁的 ⭐ 即可加入重点复习库，随时进行定向攻坚！
                </p>
                <button
                  onClick={() => handleScopeChange("learned")}
                  style={{
                    padding: "10px 20px",
                    background: "#b45309",
                    color: "#fff",
                    borderRadius: "8px",
                    border: "none",
                    fontWeight: "bold",
                    fontSize: "14px",
                    cursor: "pointer",
                  }}
                >
                  前往背诵已学诗词
                </button>
              </div>
            ) : (
              <div>
                <p style={{ marginBottom: "16px" }}>您还没有添加任何诗词到学习库。</p>
                <p style={{ fontSize: "14px", marginBottom: "20px" }}>
                  您可以切换到上方「🌐 全库探索」直接背诵任意古诗，也可以前往搜索页面标记熟练度。
                </p>
                <button
                  onClick={() => handleScopeChange("explore")}
                  style={{
                    padding: "10px 20px",
                    background: "#2563eb",
                    color: "#fff",
                    borderRadius: "8px",
                    border: "none",
                    fontWeight: "bold",
                    fontSize: "14px",
                    cursor: "pointer",
                  }}
                >
                  去全库探索学习
                </button>
              </div>
            )}
          </div>
        ) : (
          currentPoem && (
            <div
              style={{
                background: "#f9f9f9",
                borderRadius: "16px",
                padding: "28px 16px",
                boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                border: "1px solid #eee",
              }}
            >
              {/* Top controls: Favorite Star Toggle */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  marginBottom: "8px",
                }}
              >
                <button
                  onClick={() => toggleFavorite(currentKey)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "6px 12px",
                    borderRadius: "20px",
                    fontSize: "12px",
                    fontWeight: "bold",
                    border: isCurrentFavorite ? "1px solid #f59e0b" : "1px solid #ddd",
                    background: isCurrentFavorite ? "#fef3c7" : "#fff",
                    color: isCurrentFavorite ? "#b45309" : "#666",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  <span>{isCurrentFavorite ? "⭐" : "☆"}</span>
                  <span>{isCurrentFavorite ? "已设为重点" : "设为重点"}</span>
                </button>
              </div>

              <h2 style={{ fontSize: "24px", fontWeight: "bold", color: "#333", marginBottom: "6px", margin: 0 }}>
                {currentPoem.poem.name}
              </h2>
              <p style={{ fontSize: "14px", color: "#666", margin: "0 0 28px 0" }}>
                [{currentPoem.poem.dynasty}] {currentPoem.poem.author}
              </p>

              {!revealed ? (
                <div style={{ padding: "36px 0" }}>
                  <p style={{ fontSize: "14px", color: "#999", marginBottom: "24px" }}>（请尝试背诵全诗）</p>
                  <button
                    onClick={() => setRevealed(true)}
                    style={{
                      padding: "12px 36px",
                      background: "#222",
                      color: "#fff",
                      border: "none",
                      borderRadius: "24px",
                      fontSize: "16px",
                      fontWeight: "bold",
                      cursor: "pointer",
                      boxShadow: "0 3px 8px rgba(0,0,0,0.18)",
                    }}
                  >
                    显示内容
                  </button>
                </div>
              ) : (
                <div>
                  <div
                    style={{
                      fontSize: "18px",
                      lineHeight: "1.85",
                      color: "#222",
                      marginBottom: "36px",
                      whiteSpace: "pre-wrap",
                      fontFamily: "serif",
                    }}
                  >
                    {currentPoem.poem.content.map((line: string, i: number) => (
                      <div key={i}>{line}</div>
                    ))}
                  </div>

                  <div style={{ borderTop: "1px solid #eee", paddingTop: "24px" }}>
                    <p style={{ fontSize: "14px", color: "#666", marginBottom: "16px", fontWeight: "bold" }}>
                      背诵情况如何？
                    </p>

                    {/* Translation and Appreciation */}
                    <div style={{ marginBottom: "28px", textAlign: "left", display: "flex", flexDirection: "column", gap: "10px" }}>
                      {currentPoem.poem.tags && currentPoem.poem.tags.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", justifyContent: "center", marginBottom: "6px" }}>
                          {currentPoem.poem.tags.map((t: string, i: number) => (
                            <span
                              key={i}
                              style={{
                                background: "#f0f8ff",
                                color: "#2980b9",
                                border: "1px solid #bce0fd",
                                padding: "2px 8px",
                                borderRadius: "12px",
                                fontSize: "12px",
                              }}
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                      {currentPoem.poem.trans && (
                        <details style={{ background: "#f5f5f5", padding: "12px", borderRadius: "8px" }}>
                          <summary style={{ cursor: "pointer", fontWeight: "bold", fontSize: "14px", color: "#333", outline: "none" }}>
                            译文
                          </summary>
                          <div style={{ marginTop: "8px", fontSize: "14px", color: "#555", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
                            {currentPoem.poem.trans}
                          </div>
                        </details>
                      )}
                      {currentPoem.poem.note && (
                        <details style={{ background: "#f5f5f5", padding: "12px", borderRadius: "8px" }}>
                          <summary style={{ cursor: "pointer", fontWeight: "bold", fontSize: "14px", color: "#333", outline: "none" }}>
                            注释
                          </summary>
                          <div style={{ marginTop: "8px", fontSize: "14px", color: "#555", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
                            {currentPoem.poem.note}
                          </div>
                        </details>
                      )}
                      {currentPoem.poem.shangxi && (
                        <details style={{ background: "#f5f5f5", padding: "12px", borderRadius: "8px" }}>
                          <summary style={{ cursor: "pointer", fontWeight: "bold", fontSize: "14px", color: "#333", outline: "none" }}>
                            赏析
                          </summary>
                          <div style={{ marginTop: "8px", fontSize: "14px", color: "#555", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
                            {currentPoem.poem.shangxi}
                          </div>
                        </details>
                      )}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {[1, 2, 3, 4, 5].map((lvl) => {
                        const isCurrent = store.poems[currentKey]?.level === lvl;
                        return (
                          <button
                            key={lvl}
                            onClick={() => handleLevelSelect(lvl)}
                            style={{
                              padding: "12px",
                              background: isCurrent ? "#f0f8ff" : "#fff",
                              border: `1px solid ${isCurrent ? "#2980b9" : "#ddd"}`,
                              borderRadius: "8px",
                              cursor: "pointer",
                              textAlign: "left",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              transition: "all 0.15s",
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
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
