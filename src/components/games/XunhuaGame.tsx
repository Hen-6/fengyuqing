"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useUser } from "@/lib/userContext";
import { upgradeToLevel } from "@/lib/srs";
import { searchOnline, getPoemByKeyExport, SearchResult } from "@/lib/localSearch";

// ─── Game types ───────────────────────────────────────────────────────────────

type TileState = "empty" | "correct" | "present" | "absent";
type GamePhase = "playing" | "won" | "lost";

interface Couplet {
  key: string;
  poemTitle: string;
  poemAuthor: string;
  text: string;
  cc: number;
  l1: string;
  l2: string;
}

interface Guess {
  chars: string[];
  states: TileState[];
  couplet: Couplet;
  score: number;
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function strip(s: string): string {
  return s.replace(/[^\u4e00-\u9fa5]/g, "");
}

// 计算两个等长字符串的编辑距离
function textDistance(a: string, b: string): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) d++;
  }
  return d;
}

// 动态提取对句：遵循“句末标点+5/7字+逗号+5/7字+句末标点”的严格规则
function extractCouplets(poem: { name: string; author: string; content: string[] }): Couplet[] {
  const couplets: Couplet[] = [];
  const fullText = poem.content.join("");
  const textNoParens = fullText.replace(/[（(][^)）]*[)）]/g, "");
  const segments = textNoParens.split(/[。？！；]+/);

  const key = `${poem.name}:${poem.author}`;

  for (const seg of segments) {
    const s = seg.trim();
    if (!s) continue;
    const parts = s.split(/[，、]/);
    if (parts.length !== 2) continue;
    const l1_raw = parts[0];
    const l2_raw = parts[1];
    const l1 = strip(l1_raw);
    const l2 = strip(l2_raw);
    
    if (l1.length !== l2.length) continue;
    if (l1.length !== 5 && l1.length !== 7) continue;

    const text = l1 + l2;
    // 去重
    if (couplets.some(c => c.text === text)) continue;

    couplets.push({
      key,
      poemTitle: poem.name,
      poemAuthor: poem.author,
      text,
      cc: l1.length,
      l1,
      l2,
    });
  }
  return couplets;
}

// ─── Game logic (mirrors yusjoel/XunHuaLing) ────────────────────────────────

const MAX_GUESSES = 15;

function analyzeGuess(guess: string, answer: string): { chars: string[]; states: TileState[] } {
  const chars = guess.split("");
  const states: TileState[] = Array(chars.length).fill("absent");
  const answerChars = answer.split("");

  const answerCount: Record<string, number> = {};
  for (const c of answerChars) answerCount[c] = (answerCount[c] ?? 0) + 1;
  const used: Record<string, number> = {};

  for (let i = 0; i < chars.length; i++) {
    if (i < answerChars.length && chars[i] === answerChars[i]) {
      states[i] = "correct";
      used[chars[i]] = (used[chars[i]] ?? 0) + 1;
    }
  }
  for (let i = 0; i < chars.length; i++) {
    if (states[i] === "correct") continue;
    if ((used[chars[i]] ?? 0) < (answerCount[chars[i]] ?? 0)) {
      states[i] = "present";
      used[chars[i]] = (used[chars[i]] ?? 0) + 1;
    }
  }

  return { chars, states };
}

function scoreHintChars(guess: string, answer: string, hintChars: Set<string>, scored: Set<string>): number {
  let score = 0;
  for (let i = 0; i < guess.length; i++) {
    const c = guess[i];
    if (scored.has(c)) continue;
    if (!hintChars.has(c)) continue;
    scored.add(c);
    score += 1;
    if (answer.includes(c)) {
      score += 2;
      if (i < answer.length && guess[i] === answer[i]) {
        score += 2;
      }
    }
  }
  return score;
}

function scoreGuessCount(remaining: number): number {
  const used = MAX_GUESSES - remaining + 1;
  if (used <= 5) return 200;
  return Math.max(0, 200 - (used - 5) * 10);
}

// ─── Hint grid builder ───────────────────────────────────────────────────────

async function buildHintGridAsync(couplet: Couplet, knownKeys: string[]): Promise<string[]> {
  const answerChars = couplet.text.split("");
  const result: string[] = [...answerChars];
  const seen = new Set(answerChars);

  // Fetch up to 8 random poems for noise to ensure we have plenty of characters
  const noiseKeys = [...knownKeys]
    .filter(k => k !== couplet.key)
    .sort(() => Math.random() - 0.5)
    .slice(0, 8);

  for (const k of noiseKeys) {
    const res = await getPoemByKeyExport(k);
    if (!res || !res.poem) continue;
    const txt = res.poem.content.join('');
    const chars = txt.replace(/[^\u4e00-\u9fa5]/g, "");
    for (const c of chars) {
      if (!seen.has(c)) {
        seen.add(c);
        result.push(c);
      }
      if (result.length >= 100) break;
    }
    if (result.length >= 100) break;
  }

  // Pad with an extensive list of common classical Chinese characters to absolutely guarantee 100 unique chars
  const common = "天地日月星辰风雨雷电山川草木花鸟虫鱼春夏秋冬东南西北金木水火土一二三四五六七八九十百千万白黑红黄绿青紫明暗高低大小长短多少新旧好坏美丑生老病死悲欢离合阴晴圆缺悲喜交加琴棋书画笔墨纸砚江河湖海城池宫阙亭台楼阁车马舟船剑戟刀枪帝王将相才子佳人神仙鬼怪龙凤龟麟松竹梅菊桃李杏花江山如画岁月如歌风华正茂";
  for (const c of common) {
    if (!seen.has(c)) {
      seen.add(c);
      result.push(c);
    }
    if (result.length >= 100) break;
  }

  // Shuffle
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  while (result.length < 100) result.push("");
  return result.slice(0, 100);
}

// ─── Main component ─────────────────────────────────────────────────────────

export function XunhuaGame() {
  const { store, loaded: userLoaded, upsertPoemProgress, overview } = useUser();
  const [phase, setPhase] = useState<GamePhase>("playing");
  const [target, setTarget] = useState<Couplet | null>(null);
  const [hintGrid, setHintGrid] = useState<string[]>([]);
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [input, setInput] = useState("");
  const [message, setMessage] = useState("");
  const [totalScore, setTotalScore] = useState(0);
  const [roundScore, setRoundScore] = useState(0);
  const [remaining, setRemaining] = useState(MAX_GUESSES);
  const [loadingTarget, setLoadingTarget] = useState(false);
  const [validatingGuess, setValidatingGuess] = useState(false);
  const [error, setError] = useState("");
  const [showConfirm, setShowConfirm] = useState<{ type: "confirm"; userInput: string; correct: string; match: Couplet } | { type: "nearby"; options: Couplet[] } | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [nearbyInput, setNearbyInput] = useState("");
  const [isDemoMode, setIsDemoMode] = useState(false);

  const scoredCharsRef = useRef<Set<string>>(new Set());
  const hintCharsRef = useRef<Set<string>>(new Set());

  // Start a round
  const startRound = useCallback(async () => {
    // 1. Get known keys (Level 3+)
    let knownKeys = Object.entries(store.poems)
      .filter(([_, prog]) => prog.level >= 3)
      .map(([k]) => k);

    if (knownKeys.length === 0) {
      // Demo fallback keys so it works without log-in/empty progress
      knownKeys = [
        "静夜思:李白",
        "登鹳雀楼:王之涣",
        "春晓:孟浩然",
        "江雪:柳宗元",
        "鹿柴:王维",
        "相思:王维",
        "悯农:李绅",
        "寻隐者不遇:贾岛"
      ];
      setIsDemoMode(true);
    } else {
      setIsDemoMode(false);
    }

    setPhase("playing");
    setLoadingTarget(true);
    setError("");

    try {
      // 2. Fisher-Yates Shuffle
      const shuffled = [...knownKeys];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      let pick: Couplet | null = null;

      // 3. Batch candidate poems in parallel to check for valid couplets
      const BATCH_SIZE = 10;
      for (let i = 0; i < shuffled.length; i += BATCH_SIZE) {
        const batchKeys = shuffled.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(batchKeys.map(k => getPoemByKeyExport(k)));
        
        const validCandidates: Couplet[] = [];
        for (const res of batchResults) {
          if (!res || !res.poem) continue;
          const couplets = extractCouplets(res.poem);
          if (couplets.length > 0) {
            validCandidates.push(couplets[Math.floor(Math.random() * couplets.length)]);
          }
        }
        
        if (validCandidates.length > 0) {
          pick = validCandidates[Math.floor(Math.random() * validCandidates.length)];
          break;
        }
      }

      if (!pick) {
        setError("无法从您已学的诗词中提取出符合 5/7 言格式的对句。");
        setLoadingTarget(false);
        return;
      }

      const grid = await buildHintGridAsync(pick, knownKeys);

      setTarget(pick);
      setHintGrid(grid);
      setGuesses([]);
      setInput("");
      setMessage("");
      setRemaining(MAX_GUESSES);
      setRoundScore(0);
      setSkipped(false);
      scoredCharsRef.current = new Set();
      hintCharsRef.current = new Set(pick.text.split(""));
    } catch (e) {
      setError("加载目标诗词失败，请确保 Meilisearch 正在运行。");
    } finally {
      setLoadingTarget(false);
    }
  }, [store.poems]);

  // First round
  useEffect(() => {
    if (userLoaded && !target && !loadingTarget && !error) {
      startRound();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLoaded]);

  // Submit guess
  const handleSubmit = useCallback(async () => {
    if (phase !== "playing" || !target || validatingGuess) return;
    const clean = strip(input).trim();
    if (!clean) return;

    if (clean.length !== target.cc * 2) {
      setMessage(`每句应为 ${target.cc} 字，请输入 ${target.cc * 2} 字。`);
      return;
    }

    setValidatingGuess(true);
    setMessage("校验中...");

    try {
      // 查询完整数据库，上限给多一点以容纳包含相同片段的诗词
      const results = await searchOnline(clean, 20);

      let matchedCouplet: Couplet | null = null;
      let nearbyCps: { cp: Couplet; diff: number }[] = [];

      // 提取结果中所有的合法对句
      for (const res of results) {
        const couplets = extractCouplets(res.poem);
        
        // 精确匹配
        const exactMatch = couplets.find((c) => c.text === clean);
        if (exactMatch) {
          matchedCouplet = exactMatch;
          break; // Found an exact match, stop searching
        }

        // 收集长度一致的对句计算差距，用于模糊推荐
        for (const cp of couplets) {
          if (cp.text.length === clean.length) {
            const diff = textDistance(clean, cp.text);
            if (diff > 0 && diff <= 3) {
              nearbyCps.push({ cp, diff });
            }
          }
        }
      }

      if (matchedCouplet) {
        const hScore = scoreHintChars(clean, target.text, hintCharsRef.current, scoredCharsRef.current);
        const diff = clean.split("").filter((c, i) => c !== target.text[i]).length;
        const sameChars =
          clean.length === target.text.length &&
          clean.split("").sort().join("") === target.text.split("").sort().join("");

        // 提示字形相同或者只差一个字
        if ((diff === 1 || sameChars) && !showConfirm) {
          setShowConfirm({ type: "confirm", userInput: input, correct: matchedCouplet.l1 + matchedCouplet.l2, match: matchedCouplet });
          setMessage("");
          return;
        }

        applyGuess(matchedCouplet, hScore);
      } else {
        // 未命中任何精确对句，展示接近的对句
        nearbyCps.sort((a, b) => a.diff - b.diff);
        // 去重
        const uniqueNearby: Couplet[] = [];
        for (const item of nearbyCps) {
          if (!uniqueNearby.some(u => u.text === item.cp.text)) {
            uniqueNearby.push(item.cp);
          }
        }

        if (uniqueNearby.length > 0) {
          setNearbyInput(clean);
          setShowConfirm({ type: "nearby", options: uniqueNearby.slice(0, 3) });
          setMessage("");
        } else {
          setNearbyInput(clean);
          setShowConfirm({ type: "nearby", options: [] });
          setMessage(`未在数据库中找到「${clean}」，也没有接近的候选。`);
        }
      }
    } catch (e) {
      setMessage("校验失败，请检查数据库连接。");
    } finally {
      setValidatingGuess(false);
    }
  }, [phase, target, input, showConfirm, validatingGuess]);

  function applyGuess(matched: Couplet, hScore: number) {
    if (!target) return;
    const clean = strip(matched.text).trim();
    const isCorrect = clean === target.text;

    const { chars, states } = analyzeGuess(clean, target.text);

    for (const c of chars) {
      if (hintCharsRef.current.has(c)) scoredCharsRef.current.add(c);
    }

    // Bump this poem to at least level 3 (识句) for every submitted guess
    upsertPoemProgress(matched.key, (p) => upgradeToLevel(p, 3));

    const newGuess: Guess = { chars, states, couplet: matched, score: hScore };
    setGuesses((prev) => [...prev, newGuess]);
    if (hScore > 0) setRoundScore((s) => s + hScore);

    if (isCorrect) {
      const gScore = scoreGuessCount(remaining);
      const total = hScore + gScore;
      setRoundScore((s) => s + gScore);
      setTotalScore((s) => s + total);
      setPhase("won");
      setMessage(`答对！+${hScore}分（提示分）+${gScore}分（猜测分）=+${total}分`);
      setSkipped(false);
      setInput("");
    } else {
      const rem = remaining - 1;
      setRemaining(rem);
      if (rem <= 0) {
        setPhase("lost");
        setMessage(`游戏结束。答案是：${target.l1}　${target.l2}`);
        setInput("");
      } else {
        setMessage(`答错了，还剩 ${rem} 次机会`);
        setInput("");
      }
    }
    setShowConfirm(null);
  }

  const handleConfirmOffByOne = useCallback(() => {
    if (!showConfirm || showConfirm.type !== "confirm" || !target) return;
    const match = showConfirm.match;
    if (match) {
      const hScore = scoreHintChars(
        strip(match.text),
        target.text,
        hintCharsRef.current,
        scoredCharsRef.current
      );
      applyGuess(match, hScore);
    }
    setShowConfirm(null);
  }, [showConfirm, target]);

  const handlePickNearby = useCallback((cp: Couplet) => {
    if (!target) return;
    const hScore = scoreHintChars(
      cp.text,
      target.text,
      hintCharsRef.current,
      scoredCharsRef.current
    );
    applyGuess(cp, hScore);
    setShowConfirm(null);
    setNearbyInput("");
  }, [target]);

  const handleNext = useCallback(() => {
    startRound();
  }, [startRound]);

  const handleRestart = useCallback(() => {
    setTotalScore(0);
    startRound();
  }, [startRound]);

  // 跳过：显示答案，0分，不计分
  const handleSkip = useCallback(() => {
    if (!target || phase !== "playing") return;
    setPhase("won");
    setSkipped(true);
    setRoundScore(0);
    setMessage(`已跳过。答案是：${target.l1}　${target.l2}`);
    setInput("");
  }, [phase, target]);

  // 显示答案：仅揭示，不跳转下一题
  const handleReveal = useCallback(() => {
    if (!target || phase !== "playing") return;
    setPhase("won");
    setSkipped(true);
    setRoundScore(0);
    setMessage(`答案是：${target.l1}　${target.l2}`);
    setInput("");
  }, [phase, target]);

  // ─── Render ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{ textAlign: "center", padding: "40px", color: "#e74c3c", fontFamily: "system-ui, sans-serif" }}>
        <p>{error}</p>
        <button
            onClick={startRound}
            style={{ marginTop: "16px", padding: "10px", background: "#6aaa64", color: "#fff", border: "none", borderRadius: "4px", fontWeight: "bold", fontSize: "14px", cursor: "pointer" }}
          >
            重试
          </button>
      </div>
    );
  }

  if (loadingTarget || !userLoaded) {
    return (
      <div style={{ textAlign: "center", padding: "40px", color: "#666", fontFamily: "system-ui, sans-serif" }}>
        <p style={{ fontSize: "14px" }}>加载目标诗句…</p>
      </div>
    );
  }

  const CELL = 30;
  const GRID = 10;

  return (
    <div style={{ background: "#fff", minHeight: "100vh", padding: "16px", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: `${GRID * (CELL + 2)}px`, margin: "0 auto 12px" }}>
        <span style={{ fontSize: "14px", color: "#666" }}>剩余 {remaining} 次</span>
        <span style={{ fontSize: "14px", fontWeight: "bold", color: "#333" }}>
          {phase === "playing" ? `总分 ${totalScore}分` : `本轮 +${roundScore}分`}
        </span>
      </div>

      {isDemoMode && (
        <div style={{ textAlign: "center", color: "#999", fontSize: "12px", background: "#f8f9fa", border: "1px dashed #ccc", padding: "6px", borderRadius: "4px", margin: "0 auto 12px", maxWidth: `${GRID * (CELL + 2)}px` }}>
          💡 当前为演示模式（已识句库为空）
        </div>
      )}

      {/* 100-char hint grid */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${GRID}, ${CELL}px)`, gap: "2px", maxWidth: `${GRID * (CELL + 2)}px`, margin: "0 auto 16px" }}>
        {hintGrid.map((char, i) => {
          const used = guesses.some((g) => g.chars.includes(char));
          let bg = "#f0f0f0";
          if (char && used && target) {
            bg = target.text.includes(char) ? "#6aaa64" : "#787c7e";
          }
          return (
            <div
              key={i}
              style={{
                width: CELL, height: CELL,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: char ? bg : "#f0f0f0",
                color: char ? (used ? "#fff" : "#333") : "#ccc",
                fontSize: "14px", fontWeight: "bold",
                border: "1px solid #ddd",
              }}
            >
              {char}
            </div>
          );
        })}
      </div>

      {/* Guesses */}
      {guesses.map((g, gi) => {
        const lineLen = target?.cc ?? 5;
        return (
          <div key={gi} style={{ maxWidth: `${GRID * (CELL + 2)}px`, margin: "0 auto 4px" }}>
            {/* Line 1 */}
            <div style={{ display: "flex", gap: "2px", justifyContent: "center", marginBottom: "2px" }}>
              {g.chars.slice(0, lineLen).map((c, ci) => (
                <div
                  key={ci}
                  style={{
                    width: CELL, height: CELL,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: g.states[ci] === "correct" ? "#6aaa64" : g.states[ci] === "present" ? "#c9b458" : g.states[ci] === "absent" ? "#787c7e" : "#f0f0f0",
                    color: g.states[ci] !== "empty" ? "#fff" : "#333",
                    fontSize: "14px", fontWeight: "bold",
                    border: "1px solid #ddd",
                  }}
                >
                  {c}
                </div>
              ))}
              {Array.from({ length: GRID - lineLen }).map((_, ci) => (
                <div key={"e1-" + ci} style={{ width: CELL, height: CELL, background: "#fff", border: "1px solid #ddd" }} />
              ))}
            </div>
            {/* Line 2 */}
            <div style={{ display: "flex", gap: "2px", justifyContent: "center" }}>
              {g.chars.slice(lineLen).map((c, ci) => (
                <div
                  key={ci}
                  style={{
                    width: CELL, height: CELL,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: g.states[lineLen + ci] === "correct" ? "#6aaa64" : g.states[lineLen + ci] === "present" ? "#c9b458" : g.states[lineLen + ci] === "absent" ? "#787c7e" : "#f0f0f0",
                    color: g.states[lineLen + ci] !== "empty" ? "#fff" : "#333",
                    fontSize: "14px", fontWeight: "bold",
                    border: "1px solid #ddd",
                  }}
                >
                  {c}
                </div>
              ))}
              {Array.from({ length: GRID - lineLen }).map((_, ci) => (
                <div key={"e2-" + ci} style={{ width: CELL, height: CELL, background: "#fff", border: "1px solid #ddd" }} />
              ))}
            </div>
          </div>
        );
      })}

      {/* Input */}
      {phase === "playing" && target && (
        <div style={{ maxWidth: `${GRID * (CELL + 2)}px`, margin: "12px auto 0" }}>
          {/* Live preview line 1 */}
          <div style={{ display: "flex", gap: "2px", justifyContent: "center", marginBottom: "2px" }}>
            {Array.from({ length: target.cc }).map((_, i) => {
              const ch = strip(input)[i] ?? "";
              return (
                <div
                  key={"p1-" + i}
                  style={{
                    width: CELL, height: CELL,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: ch ? "#fff" : "#f0f0f0",
                    color: ch ? "#333" : "#ccc",
                    fontSize: "14px", fontWeight: "bold",
                    border: "1px solid " + (ch ? "#878a8c" : "#ddd"),
                  }}
                >
                  {ch}
                </div>
              );
            })}
            {Array.from({ length: GRID - target.cc }).map((_, i) => (
              <div key={"pe1-" + i} style={{ width: CELL, height: CELL, background: "#fff", border: "1px solid #ddd" }} />
            ))}
          </div>
          {/* Live preview line 2 */}
          <div style={{ display: "flex", gap: "2px", justifyContent: "center", marginBottom: "8px" }}>
            {Array.from({ length: target.cc }).map((_, i) => {
              const ch = strip(input)[target.cc + i] ?? "";
              return (
                <div
                  key={"p2-" + i}
                  style={{
                    width: CELL, height: CELL,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: ch ? "#fff" : "#f0f0f0",
                    color: ch ? "#333" : "#ccc",
                    fontSize: "14px", fontWeight: "bold",
                    border: "1px solid " + (ch ? "#878a8c" : "#ddd"),
                  }}
                >
                  {ch}
                </div>
              );
            })}
            {Array.from({ length: GRID - target.cc }).map((_, i) => (
              <div key={"pe2-" + i} style={{ width: CELL, height: CELL, background: "#fff", border: "1px solid #ddd" }} />
            ))}
          </div>

          {/* Input + button */}
          <div style={{ display: "flex", gap: "4px", justifyContent: "center" }}>
            <input
              type="text"
              value={input}
              onChange={(e) => { setInput(e.target.value); setMessage(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder={`输入${target.cc * 2}字对句`}
              disabled={validatingGuess}
              style={{
                flex: 1, maxWidth: `${(GRID - 1) * (CELL + 2) - 4}px`,
                textAlign: "center", fontSize: "16px",
                padding: "8px 12px",
                border: "1px solid #878a8c", borderRadius: "4px",
                outline: "none", fontFamily: "inherit",
              }}
              autoFocus
            />
            <button
              onClick={handleSubmit}
              disabled={validatingGuess}
              style={{
                padding: "8px 16px",
                background: validatingGuess ? "#ccc" : "#6aaa64", color: "#fff",
                border: "none", borderRadius: "4px",
                fontWeight: "bold", fontSize: "14px", cursor: "pointer",
              }}
            >
              猜
            </button>
          </div>
        </div>
      )}

      {/* Message */}
      {message && (
        <p style={{ textAlign: "center", fontSize: "13px", color: phase === "won" ? "#6aaa64" : phase === "lost" ? "#787c7e" : "#c9b458", margin: "10px auto", maxWidth: `${GRID * (CELL + 2)}px` }}>
          {message}
        </p>
      )}

      {/* Controls */}
      {phase === "playing" && (
        <div style={{ display: "flex", gap: "8px", maxWidth: `${GRID * (CELL + 2)}px`, margin: "12px auto 0", justifyContent: "center" }}>
          <button
            onClick={handleSkip}
            style={{ flex: 1, padding: "10px", background: "#fff", color: "#666", border: "1px solid #ccc", borderRadius: "4px", fontWeight: "bold", fontSize: "14px", cursor: "pointer" }}
          >
            跳过（显示答案）
          </button>
          <button
            onClick={handleReveal}
            style={{ flex: 1, padding: "10px", background: "#fff", color: "#999", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px", cursor: "pointer" }}
          >
            只看答案
          </button>
        </div>
      )}

      {phase !== "playing" && target && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxWidth: `${GRID * (CELL + 2)}px`, margin: "12px auto 0" }}>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={handleNext}
              style={{ flex: 1, padding: "10px", background: "#6aaa64", color: "#fff", border: "none", borderRadius: "4px", fontWeight: "bold", fontSize: "14px", cursor: "pointer" }}
            >
              下一题
            </button>
            <button
              onClick={handleRestart}
              style={{ flex: 1, padding: "10px", background: "#fff", color: "#333", border: "1px solid #ccc", borderRadius: "4px", fontWeight: "bold", fontSize: "14px", cursor: "pointer" }}
            >
              重新开始
            </button>
          </div>
          <Link
            href={`/search/?q=${encodeURIComponent(target.poemTitle + " " + target.poemAuthor)}`}
            style={{
              display: "block",
              textAlign: "center",
              padding: "10px",
              background: "rgba(106, 170, 100, 0.08)",
              color: "#6aaa64",
              border: "1px dashed #6aaa64",
              borderRadius: "4px",
              fontWeight: "bold",
              fontSize: "14px",
              cursor: "pointer",
              textDecoration: "none",
            }}
          >
            📖 查看全诗 《{target.poemTitle}》
          </Link>
        </div>
      )}

      {/* Footer */}
      <div style={{ textAlign: "center", marginTop: "16px", fontSize: "12px", color: "#999" }}>
        已识句 {overview.level3plus}首
      </div>

      {/* Approximate match / nearby selection modal */}
      {showConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div style={{ background: "#fff", borderRadius: "8px", padding: "24px", maxWidth: "360px", width: "90%", textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
            {showConfirm.type === "confirm" ? (
              <>
                <p style={{ fontSize: "13px", color: "#666", marginBottom: "8px" }}>
                  {showConfirm.userInput.split("").sort().join("") === showConfirm.correct.split("").sort().join("")
                    ? "字符相同但顺序不同"
                    : "与标准版本仅一字不同"}
                </p>
                <p style={{ fontSize: "18px", fontWeight: "bold", color: "#333", marginBottom: "4px" }}>「{showConfirm.userInput}」</p>
                <p style={{ fontSize: "12px", color: "#999", marginBottom: "16px" }}>标准版本：{showConfirm.correct}</p>
                <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                  <button
                    onClick={handleConfirmOffByOne}
                    style={{ padding: "8px 20px", background: "#6aaa64", color: "#fff", border: "none", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}
                  >
                    提交标准版本
                  </button>
                  <button
                    onClick={() => { setInput(""); setShowConfirm(null); setNearbyInput(""); }}
                    style={{ padding: "8px 20px", background: "#fff", color: "#666", border: "1px solid #ccc", borderRadius: "4px", cursor: "pointer" }}
                  >
                    取消
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: "13px", color: "#666", marginBottom: "12px" }}>
                  未找到「{nearbyInput}」，是否指以下其中一句？
                </p>
                {showConfirm.options.length === 0 ? (
                  <p style={{ fontSize: "13px", color: "#999", marginBottom: "16px" }}>没有找到接近的候选</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
                    {showConfirm.options.map((cp, i) => (
                      <button
                        key={i}
                        onClick={() => handlePickNearby(cp)}
                        style={{
                          padding: "10px 16px",
                          background: "#f8f8f8",
                          border: "1px solid #ddd",
                          borderRadius: "6px",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <div style={{ fontSize: "16px", fontWeight: "bold", color: "#333" }}>
                          {cp.l1}　{cp.l2}
                        </div>
                        <div style={{ fontSize: "11px", color: "#999", marginTop: "2px" }}>
                          {cp.poemTitle} · {cp.poemAuthor}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => { setInput(""); setShowConfirm(null); setNearbyInput(""); }}
                  style={{ padding: "8px 20px", background: "#fff", color: "#666", border: "1px solid #ccc", borderRadius: "4px", cursor: "pointer" }}
                >
                  取消
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
