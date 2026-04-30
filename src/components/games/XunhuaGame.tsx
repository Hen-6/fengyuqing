"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { OnlinePoemCard } from "@/components/ui/OnlinePoemCard";
import { VoiceInput } from "@/components/ui/VoiceInput";
import { OnlinePoemResult, loadIndex } from "@/lib/localSearch";
import { stripPunctuation } from "@/lib/poems";
import { loadStore, markPoemAnswered } from "@/lib/user";
import { IndexedPoem } from "@/lib/localSearch";

const MAX_GUESSES = 15;
const MAX_SCORE = 200;
type CharState = "empty" | "correct" | "present" | "absent";

interface Couplet {
  poem: IndexedPoem;
  lineIndex: number;   // 奇数句 index（0,2,4...）
  coupletText: string; // 两句去标点合并
  displayLine1: string; // 原始第一句（带标点）
  displayLine2: string; // 原始第二句（带标点）
  charCount: number;   // 5 或 7
}

interface GuessRecord {
  chars: string[];
  states: CharState[];
  display: string;
  poem: OnlinePoemResult | null;
  matchedLineIndex: number;
  isCorrect: boolean;
  hintScore: number;
}

// ─── 颜色分析（Wordle 规则） ──────────────────────────────────────────────

function analyzeGuess(cleanGuess: string, cleanAnswer: string): { chars: string[]; states: CharState[] } {
  const chars = cleanGuess.split("");
  const states: CharState[] = Array(chars.length).fill("absent");
  const answerChars = cleanAnswer.split("");

  const answerCount: Record<string, number> = {};
  for (const c of answerChars) answerCount[c] = (answerCount[c] ?? 0) + 1;
  const used: Record<string, number> = {};

  // 绿色：位置正确
  for (let i = 0; i < chars.length; i++) {
    if (i < answerChars.length && chars[i] === answerChars[i]) {
      states[i] = "correct";
      used[chars[i]] = (used[chars[i]] ?? 0) + 1;
    }
  }
  // 黄色：存在但位置错误
  for (let i = 0; i < chars.length; i++) {
    if (states[i] === "correct") continue;
    const cnt = used[chars[i]] ?? 0;
    const total = answerCount[chars[i]] ?? 0;
    if (cnt < total) {
      states[i] = "present";
      used[chars[i]] = cnt + 1;
    }
  }

  return { chars, states };
}

function calcGuessScore(guessCount: number): number {
  if (guessCount <= 5) return MAX_SCORE;
  return Math.max(0, MAX_SCORE - (guessCount - 5) * 10);
}

function calcHintScore(
  cleanGuess: string,
  cleanAnswer: string,
  usedHintChars: Set<string>
): number {
  let score = 0;
  for (let i = 0; i < cleanGuess.length; i++) {
    const c = cleanGuess[i];
    if (usedHintChars.has(c)) continue;
    usedHintChars.add(c);
    score += 1;
    if (cleanAnswer.includes(c)) {
      score += 2;
      if (i < cleanAnswer.length && cleanGuess[i] === cleanAnswer[i]) {
        score += 2;
      }
    }
  }
  return score;
}

// ─── Couplet 索引构建（一次性） ──────────────────────────────────────────

let coupletPool: Couplet[] | null = null;
let coupletLoadPromise: Promise<Couplet[]> | null = null;

async function loadCoupletPool(): Promise<Couplet[]> {
  if (coupletPool) return coupletPool;
  if (coupletLoadPromise) return coupletLoadPromise;

  coupletLoadPromise = (async () => {
    const index = await loadIndex();
    const pool: Couplet[] = [];

    for (const poem of index) {
      const content = poem.content;
      for (let j = 0; j < content.length - 1; j += 2) {
        const l1 = stripPunctuation(content[j] ?? "");
        const l2 = stripPunctuation(content[j + 1] ?? "");
        if (l1.length >= 5 && l2.length >= 5 && l1.length === l2.length) {
          pool.push({
            poem,
            lineIndex: j,
            coupletText: l1 + l2,
            displayLine1: (content[j] ?? "").trim(),
            displayLine2: (content[j + 1] ?? "").trim(),
            charCount: l1.length,
          });
        }
      }
    }

    coupletPool = pool;
    return pool;
  })();

  return coupletLoadPromise;
}

// ─── 主组件 ──────────────────────────────────────────────────────────────

export function XunhuaGame() {
  const [phase, setPhase] = useState<"loading" | "playing" | "won" | "lost">("loading");
  const [couplets, setCouplets] = useState<Couplet[]>([]);
  const [current, setCurrent] = useState<Couplet | null>(null);
  const [guess, setGuess] = useState("");
  const [guesses, setGuesses] = useState<GuessRecord[]>([]);
  const [score, setScore] = useState(0);
  const [remaining, setRemaining] = useState(MAX_GUESSES);
  const [showCard, setShowCard] = useState(false);
  const [cardPoem, setCardPoem] = useState<OnlinePoemResult | null>(null);
  const [resultMsg, setResultMsg] = useState("");
  const [resultClass, setResultClass] = useState("");
  const [showConfirm, setShowConfirm] = useState<{
    guess: string;
    actual: string;
    poem: OnlinePoemResult;
    lineIdx: number;
  } | null>(null);
  const [floatScore, setFloatScore] = useState<number | null>(null);
  const [floatKey, setFloatKey] = useState(0);

  const store = loadStore();

  // 加载 couplet 池
  useEffect(() => {
    loadCoupletPool().then((pool) => {
      setCouplets(pool);
      if (pool.length > 0) startNewRound(pool);
    });
  }, []);

  const startNewRound = useCallback((pool: Couplet[]) => {
    if (pool.length === 0) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    setCurrent(pick);
    setGuess("");
    setGuesses([]);
    setPhase("playing");
    setRemaining(MAX_GUESSES);
    setResultMsg("");
    setResultClass("");
    setShowConfirm(null);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!guess.trim() || phase !== "playing" || !current) return;

    const cleanGuess = stripPunctuation(guess).trim();
    if (!cleanGuess) return;

    if (cleanGuess.length !== current.coupletText.length) {
      setResultMsg(`诗句字数应为 ${current.coupletText.length} 字，请重新输入。`);
      setResultClass("incorrect");
      return;
    }

    const answer = current.coupletText;

    // ── 精确匹配 ──
    if (cleanGuess === answer) {
      const { chars, states } = analyzeGuess(cleanGuess, answer);
      const newRecord: GuessRecord = {
        chars, states,
        display: cleanGuess,
        poem: wrapPoem(current.poem),
        matchedLineIndex: current.lineIndex,
        isCorrect: true,
        hintScore: 0,
      };
      const newGuesses = [...guesses, newRecord];
      setGuesses(newGuesses);

      // 本次 hint score（用户输入框内已有字符）
      const usedChars = new Set<string>();
      for (const g of guesses) for (const c of g.chars) usedChars.add(c);
      const hScore = calcHintScore(cleanGuess, answer, usedChars);
      const gScore = calcGuessScore(guesses.length + 1);
      const totalHint = hScore;
      const totalGame = score + totalHint + gScore;

      setScore(totalGame);
      setPhase("won");
      setResultMsg(`恭喜答对！+${gScore}分（猜测得分），+${totalHint}分（提示得分）`);
      setResultClass("correct");
      markPoemAnswered(store, current.poem.key);
      setGuess("");
      return;
    }

    // ── 一字之差 ──
    let diff = 0;
    if (cleanGuess.length === answer.length) {
      for (let i = 0; i < cleanGuess.length; i++) {
        if (cleanGuess[i] !== answer[i]) diff++;
      }
    }

    if (diff === 1 && current) {
      setShowConfirm({
        guess: cleanGuess,
        actual: answer,
        poem: wrapPoem(current.poem),
        lineIdx: current.lineIndex,
      });
      return;
    }

    // ── 字序不同（同字符）──
    const sameChars =
      cleanGuess.length === answer.length &&
      cleanGuess.split("").sort().join("") === answer.split("").sort().join("");

    if (sameChars) {
      setShowConfirm({
        guess: cleanGuess,
        actual: answer,
        poem: wrapPoem(current.poem),
        lineIdx: current.lineIndex,
      });
      return;
    }

    // ── 都不符合 → 扣次数 ──
    const { chars, states } = analyzeGuess(cleanGuess, answer);
    const usedChars = new Set<string>();
    for (const g of guesses) for (const c of g.chars) usedChars.add(c);
    const hScore = calcHintScore(cleanGuess, answer, usedChars);
    const newScore = score + hScore;

    const newRecord: GuessRecord = {
      chars, states,
      display: cleanGuess,
      poem: null,
      matchedLineIndex: -1,
      isCorrect: false,
      hintScore: hScore,
    };
    const newGuesses = [...guesses, newRecord];
    setGuesses(newGuesses);
    setScore(newScore);
    setGuess("");

    const rem = remaining - 1;
    setRemaining(rem);

    if (hScore > 0) {
      triggerFloat(hScore);
    }

    if (rem <= 0) {
      setPhase("lost");
      setResultMsg(`正确答案是：${current.displayLine1}　${current.displayLine2}`);
      setResultClass("incorrect");
    } else {
      setResultMsg(`答错了，剩余 ${rem} 次机会`);
      setResultClass("incorrect");
    }
  }, [guess, phase, current, guesses, score, remaining, store]);

  function triggerFloat(pts: number) {
    setFloatScore(pts);
    setFloatKey((k) => k + 1);
    setTimeout(() => setFloatScore(null), 1100);
  }

  const handleConfirmOffByOne = useCallback(() => {
    if (!showConfirm || !current) return;
    const cleanActual = showConfirm.actual;
    const { chars, states } = analyzeGuess(cleanActual, cleanActual);

    const usedChars = new Set<string>();
    for (const g of guesses) for (const c of g.chars) usedChars.add(c);

    const newRecord: GuessRecord = {
      chars, states,
      display: cleanActual,
      poem: showConfirm.poem,
      matchedLineIndex: showConfirm.lineIdx,
      isCorrect: true,
      hintScore: 0,
    };
    const newGuesses = [...guesses, newRecord];
    setGuesses(newGuesses);

    const hScore = calcHintScore(cleanActual, cleanActual, usedChars);
    const gScore = calcGuessScore(guesses.length + 1);
    setScore(score + hScore + gScore);
    setPhase("won");
    setResultMsg(`恭喜答对！+${gScore}分（猜测得分），+${hScore}分（提示得分）`);
    setResultClass("correct");
    if (showConfirm.poem) markPoemAnswered(store, showConfirm.poem._id);
    setShowConfirm(null);
    setGuess("");
  }, [showConfirm, current, guesses, score, store]);

  const hintBgClass = (s: CharState) => {
    switch (s) {
      case "correct": return "bg-correct text-white";
      case "present":  return "bg-present text-white";
      case "absent":   return "bg-absent text-white";
      default:         return "bg-[var(--paper)] text-text-muted border border-border";
    }
  };

  const stateBgClass = (s: CharState) => {
    switch (s) {
      case "correct": return "bg-correct";
      case "present":  return "bg-present";
      case "absent":   return "bg-absent";
      default:         return "bg-border";
    }
  };

  const guessCharClass = (s: CharState) => {
    switch (s) {
      case "correct": return "bg-correct text-white";
      case "present":  return "bg-present text-white";
      case "absent":   return "bg-absent text-white";
      default:         return "bg-[var(--paper)] text-text-muted border border-border";
    }
  };

  // 构建提示格：当前诗句字符 + 其他诗句字符
  const hintChars = current
    ? buildHintChars(current, guesses, couplets)
    : Array(100).fill({ char: "", state: "empty" as CharState });

  if (phase === "loading") {
    return (
      <div className="text-center py-10 text-text-muted animate-pulse">
        正在加载诗词库…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ===== 状态栏 ===== */}
      <div className="flex justify-between text-sm text-text-muted px-1">
        <span>剩余 {remaining} 次</span>
        <span className="font-semibold text-ink">得分 {score}</span>
      </div>

      {/* ===== 100字提示格 ===== */}
      <div>
        <div className="grid grid-cols-10 gap-1">
          {hintChars.map((item, i) => (
            <div
              key={i}
              className={`
                flex h-9 w-9 items-center justify-center rounded text-sm font-bold
                transition-all duration-200
                ${hintBgClass(item.state)}
              `}
              title={item.char}
            >
              {item.char}
            </div>
          ))}
        </div>
      </div>

      {/* ===== 猜测历史 ===== */}
      {guesses.length > 0 && (
        <div>
          <div className="mb-1.5 text-xs text-text-muted">猜测历史（点击查看诗词）</div>
          <div className="space-y-1">
            {guesses.map((g, gi) => (
              <div key={gi} className="flex gap-1">
                {g.chars.map((ch, ci) => (
                  <button
                    key={ci}
                    onClick={() => {
                      if (g.poem) {
                        setCardPoem(g.poem);
                        setShowCard(true);
                      }
                    }}
                    className={`
                      flex h-9 w-9 items-center justify-center rounded text-sm font-bold
                      transition-all ${guessCharClass(g.states[ci])}
                      ${g.poem ? "cursor-pointer hover:brightness-110" : ""}
                    `}
                    title={g.poem ? `查看《${g.poem.name}》` : ""}
                  >
                    {ch}
                  </button>
                ))}
                {g.hintScore > 0 && (
                  <span className="flex items-center text-xs text-text-muted ml-1">
                    +{g.hintScore}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== 输入框 ===== */}
      {phase === "playing" && (
        <div className="space-y-2">
          {/* 实时预览 */}
          {guess && current && (
            <GuessPreview guess={guess} targetLength={current.coupletText.length} />
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={guess}
              onChange={(e) => {
                setGuess(e.target.value);
                setResultMsg("");
                setResultClass("");
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder={`输入${current?.coupletText.length ?? "?"}字诗句`}
              className="input-chinese flex-1 text-center"
              autoFocus
            />
            <VoiceInput onResult={(text) => setGuess(text)} />
            <button onClick={handleSubmit} className="btn-primary px-5">
              猜
            </button>
          </div>

          {resultMsg && (
            <p className={`text-center text-sm ${resultClass === "incorrect" ? "text-[var(--accent)]" : "text-correct"}`}>
              {resultMsg}
            </p>
          )}
        </div>
      )}

      {/* ===== 结果信息 ===== */}
      {phase !== "playing" && (
        <div className={`rounded-xl border p-4 text-center ${resultClass === "correct" ? "border-correct bg-green-50" : "border-[var(--accent)] bg-red-50"}`}>
          <p className={`font-bold ${resultClass === "correct" ? "text-correct" : "text-[var(--accent)]"}`}>
            {resultMsg}
          </p>
          {phase === "won" && current && (
            <p className="mt-1 text-sm text-text-muted">
              {current.displayLine1}　{current.displayLine2}
            </p>
          )}
          {phase === "won" && current && (
            <button
              onClick={() => {
                setCardPoem(wrapPoem(current.poem));
                setShowCard(true);
              }}
              className="mt-2 text-sm text-accent hover:underline"
            >
              查看完整诗词
            </button>
          )}
        </div>
      )}

      {/* ===== 操作按钮 ===== */}
      <div className="flex gap-2">
        {phase !== "playing" && (
          <button
            onClick={() => startNewRound(couplets)}
            className="flex-1 rounded-xl bg-accent py-3 font-semibold text-white hover:bg-red-700 transition"
          >
            下一题
          </button>
        )}
        {(phase === "won" || phase === "lost") && (
          <button
            onClick={() => {
              setScore(0);
              startNewRound(couplets);
            }}
            className="flex-1 rounded-xl border border-border py-3 font-semibold text-ink hover:bg-paper transition"
          >
            重新开始
          </button>
        )}
      </div>

      {/* ===== 确认弹窗 ===== */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl border-2 border-accent bg-surface p-6 text-center shadow-xl">
            <p className="mb-1 text-sm text-text-muted">
              {showConfirm.guess.split("").sort().join("") === showConfirm.actual.split("").sort().join("")
                ? "字符相同但顺序不同"
                : "与库内版本仅一字不同"}
            </p>
            <p className="mb-1 text-xl font-bold text-ink">「{showConfirm.guess}」</p>
            <p className="mb-4 text-xs text-text-muted">库内版本：{showConfirm.actual}</p>
            <div className="flex justify-center gap-3">
              <button
                onClick={handleConfirmOffByOne}
                className="rounded-lg bg-accent px-6 py-2.5 font-semibold text-white hover:bg-red-700 transition"
              >
                提交库内版本
              </button>
              <button
                onClick={() => { setGuess(""); setShowConfirm(null); }}
                className="rounded-lg border border-border px-6 py-2.5 text-text-muted hover:bg-paper transition"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 浮动得分 ===== */}
      {floatScore !== null && (
        <div
          key={floatKey}
          className="fixed left-1/2 top-1/2 z-[100] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white/90 px-6 py-4 text-3xl font-bold text-correct shadow-xl animate-float-up pointer-events-none"
        >
          +{floatScore}分
        </div>
      )}

      {/* ===== 诗词卡 ===== */}
      {showCard && cardPoem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <OnlinePoemCard result={cardPoem} onClose={() => setShowCard(false)} />
        </div>
      )}
    </div>
  );
}

// ─── 猜测预览（实时灰色字框） ────────────────────────────────────────────

function GuessPreview({ guess, targetLength }: { guess: string; targetLength: number }) {
  const clean = stripPunctuation(guess).trim();
  const chars = clean.split("").slice(0, targetLength);
  while (chars.length < targetLength) chars.push(" ");

  return (
    <div className="flex justify-center gap-1">
      {chars.map((ch, i) => (
        <div
          key={i}
          className={`
            flex h-9 w-9 items-center justify-center rounded text-sm font-bold
            border transition-all
            ${ch.trim()
              ? "border-[var(--accent)] text-ink bg-white/80"
              : "border-[var(--border)] text-[var(--border)]"
            }
          `}
        >
          {ch}
        </div>
      ))}
    </div>
  );
}

// ─── 提示格构建 ─────────────────────────────────────────────────────────

interface HintChar { char: string; state: CharState }

function buildHintChars(
  current: Couplet,
  guesses: GuessRecord[],
  allCouplets: Couplet[]
): HintChar[] {
  // 目标字集合
  const targetChars = new Set(current.coupletText.split(""));
  // 已用字集合（所有猜测中出现过的字）
  const usedChars = new Set<string>();
  for (const g of guesses) for (const c of g.chars) usedChars.add(c);

  // 先放目标诗句的字
  const result: HintChar[] = [];
  for (const c of current.coupletText) {
    result.push({ char: c, state: usedChars.has(c) ? "correct" : "empty" });
  }

  // 补满到 100 格：从其他诗句中取字
  const seen = new Set(result.map((h) => h.char));
  const otherLines: string[] = [];
  for (const cp of allCouplets) {
    if (cp === current) continue;
    for (const l of cp.poem.content) {
      const clean = stripPunctuation(l);
      if (clean.length >= 4) otherLines.push(clean);
    }
  }
  // 洗牌
  for (let i = otherLines.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [otherLines[i], otherLines[j]] = [otherLines[j], otherLines[i]];
  }

  for (const line of otherLines) {
    if (result.length >= 100) break;
    for (const c of [...new Set(line.split(""))]) {
      if (result.length >= 100) break;
      if (!seen.has(c)) {
        seen.add(c);
        result.push({
          char: c,
          state: usedChars.has(c)
            ? (targetChars.has(c) ? "present" : "absent")
            : "empty",
        });
      }
    }
  }

  // 洗牌（让目标字散布在格中）
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  // 补空
  while (result.length < 100) result.push({ char: "", state: "empty" });
  return result.slice(0, 100);
}

// ─── 工具函数 ───────────────────────────────────────────────────────────

function wrapPoem(p: IndexedPoem): OnlinePoemResult {
  return {
    _id: p.key,
    name: p.t,
    author: p.a,
    dynasty: p.d,
    content: p.content,
    note: p.note,
    matchedLine: p.content[0] || "",
    matchedLineIndex: 0,
  };
}
