"use client";

import { useState, useCallback } from "react";
import { OnlinePoemCard } from "@/components/ui/OnlinePoemCard";
import { VoiceInput } from "@/components/ui/VoiceInput";
import { OnlinePoemResult, searchOnline } from "@/lib/onlineSearch";
import { stripPunctuation } from "@/lib/poems";
import { loadStore, markPoemAnswered } from "@/lib/user";

const MAX_SCORE = 200;
type CharState = "empty" | "correct" | "present" | "absent";

interface Guess {
  chars: string[];
  states: CharState[];
  display: string;
  poem: OnlinePoemResult | null;
  matchedLineIndex: number;
}

function buildHintPool(): string[] {
  // 从预设高频字构建 100 字提示池
  const pool: string[] = [];
  const common =
    "的一是了我不在人有他这中大来上个国们" +
    "月花春秋风雨水云雪夜星河思乡酒剑马日天鸟草草木叶声光心" +
    "山河天地风月雨雪花春秋云夜星江海湖日阳光烟波声人心思情";
  for (const c of common) pool.push(c);
  while (pool.length < 100) pool.push("　");
  // 洗牌
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 100);
}

function computeStates(guess: string, answer: string): CharState[] {
  const states: CharState[] = Array(guess.length).fill("absent");
  const answerArr = answer.split("");
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === answer[i]) {
      states[i] = "correct";
      answerArr[i] = "";
    }
  }
  for (let i = 0; i < guess.length; i++) {
    if (states[i] === "correct") continue;
    const idx = answerArr.indexOf(guess[i]);
    if (idx !== -1) {
      states[i] = "present";
      answerArr[idx] = "";
    }
  }
  return states;
}

function calcScore(guessCount: number): number {
  if (guessCount <= 5) return MAX_SCORE;
  return Math.max(0, MAX_SCORE - (guessCount - 5) * 10);
}

export function XunhuaGame() {
  const [phase, setPhase] = useState<"loading" | "playing" | "won">("loading");
  const [target, setTarget] = useState<OnlinePoemResult | null>(null);
  const [answer, setAnswer] = useState<string>("");
  const [hintPool, setHintPool] = useState<string[]>([]);
  const [hintStates, setHintStates] = useState<CharState[]>([]);
  const [guess, setGuess] = useState<string>("");
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [score, setScore] = useState(MAX_SCORE);
  const [showCard, setShowCard] = useState(false);
  const [cardPoem, setCardPoem] = useState<OnlinePoemResult | null>(null);
  const [showConfirm, setShowConfirm] = useState<{
    type: "oneOff" | "reorder";
    guess: string;
    actual: string;
    poem: OnlinePoemResult;
    matchedLineIndex: number;
  } | null>(null);
  const [similarPoems, setSimilarPoems] = useState<OnlinePoemResult[]>([]);
  const [guessError, setGuessError] = useState<string | null>(null);
  const [loadingHint, setLoadingHint] = useState<string | null>(null);

  const store = loadStore();

  /** 加载一道新题 */
  const loadNewPuzzle = useCallback(async () => {
    setPhase("loading");
    setGuess("");
    setGuesses([]);
    setScore(MAX_SCORE);
    setPhase("playing");
    setShowCard(false);
    setCardPoem(null);
    setSimilarPoems([]);
    setGuessError(null);
    setShowConfirm(null);

    // 在线搜索，随机找一首五言或七言诗
    const chars = ["花", "月", "春", "风", "雨", "山", "水", "云", "夜", "江"];
    const startChar = chars[Math.floor(Math.random() * chars.length)];
    const hits = await searchOnline(startChar, 30);

    if (hits.length === 0) {
      setGuessError("无法加载题目，请检查网络");
      return;
    }

    // 随机挑一首
    const pick = hits[Math.floor(Math.random() * hits.length)];
    const poem = pick.poem;
    const lines = poem.content
      .map((l) => stripPunctuation(l).trim())
      .filter((l) => l.length >= 4);

    // 随机选一句（仅5言或7言）
    const validLines = lines.filter((l) => l.length === 5 || l.length === 7);
    const pool = validLines.length > 0 ? validLines : lines;
    if (pool.length === 0) {
      loadNewPuzzle(); // 递归重试
      return;
    }

    const answerLine = pool[Math.floor(Math.random() * pool.length)];
    setTarget(poem);
    setAnswer(answerLine);
    setHintPool(buildHintPool());
    setHintStates(Array(100).fill("empty"));
  }, []);

  // 初始加载
  useState(() => {
    loadNewPuzzle();
  });
  // 每次 phase === "loading" 触发加载
  if (phase === "loading") {
    loadNewPuzzle();
  }

  const handleGuessSubmit = useCallback(async () => {
    if (!guess.trim() || phase !== "playing") return;
    setGuessError(null);

    const trimmed = stripPunctuation(guess).trim();
    if (trimmed.length === 0) {
      setGuessError("请输入诗句");
      return;
    }

    // 精确匹配
    if (trimmed === answer) {
      const states = computeStates(trimmed, answer);
      const matchedIdx = target ? target.content.findIndex(
        (l) => stripPunctuation(l).trim() === trimmed
      ) : 0;
      const newGuess: Guess = {
        chars: trimmed.split(""),
        states,
        display: trimmed,
        poem: target,
        matchedLineIndex: matchedIdx >= 0 ? matchedIdx : 0,
      };
      setGuesses((g) => [...g, newGuess]);
      revealHintChars(trimmed);
      const finalScore = calcScore(guesses.length + 1);
      setScore(finalScore);
      setPhase("won");
      if (target) {
        markPoemAnswered(store, `${target.name.trim()}:${target.author.trim()}`);
      }
      setGuess("");
      return;
    }

    // 一字之差检测
    let diff = 0;
    for (let i = 0; i < trimmed.length && i < answer.length; i++) {
      if (trimmed[i] !== answer[i]) diff++;
    }

    if (diff === 1 && trimmed.length === answer.length && target) {
      // 验证用户输入是否在库中
      setLoadingHint("验证中…");
      const hits = await searchOnline(trimmed, 1);
      setLoadingHint(null);
      if (hits.length > 0) {
        const hit = hits[0];
        const matchedIdx = hit.poem.content.findIndex(
          (l) => stripPunctuation(l).trim() === trimmed
        );
        setShowConfirm({
          type: "oneOff",
          guess: trimmed,
          actual: answer,
          poem: hit.poem,
          matchedLineIndex: matchedIdx >= 0 ? matchedIdx : 0,
        });
        return;
      }
    }

    // 都不符合 → 显示猜测 + 相近诗词
    const states = computeStates(trimmed, answer);
    const newGuess: Guess = {
      chars: trimmed.split(""),
      states,
      display: trimmed,
      poem: null,
      matchedLineIndex: -1,
    };
    setGuesses((g) => [...g, newGuess]);
    revealHintChars(trimmed);

    // 在线搜索相近诗句
    setLoadingHint("搜索中…");
    const hits = await searchOnline(trimmed, 5);
    setLoadingHint(null);
    setSimilarPoems(hits.map((h) => h.poem));
    setGuessError("诗句不在答案中");
    setGuess("");
  }, [guess, answer, phase, target, store, guesses]);

  function revealHintChars(input: string) {
    const newStates = [...hintStates];
    for (let i = 0; i < input.length; i++) {
      for (let j = 0; j < hintPool.length; j++) {
        if (hintPool[j] === input[i] && newStates[j] === "empty") {
          newStates[j] = input[i] === answer[i] ? "correct" : "absent";
          break;
        }
      }
    }
    setHintStates(newStates);
  }

  const confirmOffByOne = useCallback(() => {
    if (!showConfirm) return;
    const { actual, poem, matchedLineIndex } = showConfirm;
    const states = computeStates(actual, actual);
    const newGuess: Guess = {
      chars: actual.split(""),
      states,
      display: actual,
      poem,
      matchedLineIndex,
    };
    setGuesses((g) => [...g, newGuess]);
    revealHintChars(actual);
    const finalScore = calcScore(guesses.length + 1);
    setScore(finalScore);
    setPhase("won");
    if (poem) markPoemAnswered(store, `${poem.name.trim()}:${poem.author.trim()}`);
    setGuess("");
    setShowConfirm(null);
  }, [showConfirm, guesses, store]);

  const hintBgClass = (state: CharState) => {
    switch (state) {
      case "correct": return "bg-correct text-white";
      case "present": return "bg-present text-white";
      case "absent": return "bg-absent text-white";
      default: return "bg-[var(--paper)] text-text-muted";
    }
  };

  const stateBgClass = (state: CharState) => {
    switch (state) {
      case "correct": return "bg-correct";
      case "present": return "bg-present";
      case "absent": return "bg-absent";
      default: return "bg-border";
    }
  };

  return (
    <div className="space-y-5">
      {phase === "loading" && (
        <div className="text-center py-8 text-text-muted animate-pulse">
          在线加载题目中…
        </div>
      )}

      {phase !== "loading" && (
        <>
          {/* ===== 100字提示格 ===== */}
          <div>
            <div className="mb-2 text-xs text-text-muted text-center">
              提示：点击提示字可查看包含该字的诗句
            </div>
            <div className="grid grid-cols-10 gap-1">
              {hintPool.map((char, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (char.trim() && char !== "　" && hintStates[i] === "empty") {
                      revealHintChars(char);
                    }
                  }}
                  disabled={!char.trim() || char === "　" || hintStates[i] !== "empty"}
                  className={`
                    flex h-8 w-8 items-center justify-center rounded text-sm font-bold
                    transition-all duration-200
                    ${hintBgClass(hintStates[i])}
                    ${hintStates[i] === "empty" && char.trim() && char !== "　"
                      ? "cursor-pointer hover:brightness-90"
                      : "cursor-default"
                    }
                  `}
                >
                  {hintStates[i] !== "empty" ? char : ""}
                </button>
              ))}
            </div>
          </div>

          {/* ===== 猜测历史 ===== */}
          {guesses.length > 0 && (
            <div>
              <div className="mb-2 text-xs text-text-muted">猜测历史</div>
              <div className="space-y-1">
                {guesses.map((g, gi) => (
                  <div key={gi} className="flex gap-1">
                    {g.chars.map((ch, ci) => (
                      <button
                        key={ci}
                        onClick={() => g.poem && (setCardPoem(g.poem), setShowCard(true))}
                        className={`
                          flex h-9 w-9 items-center justify-center rounded text-sm font-bold
                          transition-all ${stateBgClass(g.states[ci])}
                          ${g.poem ? "cursor-pointer hover:brightness-110" : ""}
                        `}
                        title={g.poem ? `查看《${g.poem.name}》` : ""}
                      >
                        {ch}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== 相近诗词列表 ===== */}
          {similarPoems.length > 0 && (
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="mb-2 text-xs text-text-muted text-center">最相近的诗句：</p>
              <div className="space-y-2">
                {similarPoems.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      const clean = stripPunctuation(item.content[item.matchedLineIndex] || "").trim();
                      setGuess(clean);
                      setSimilarPoems([]);
                      setGuessError(null);
                    }}
                    className="w-full text-left rounded-lg border border-border px-3 py-2 hover:border-accent hover:bg-accent-light transition-colors"
                  >
                    <div className="text-sm text-ink">
                      {item.content[item.matchedLineIndex] || item.matchedLine}
                    </div>
                    <div className="text-xs text-text-muted">
                      《{item.name}》— {item.author}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ===== 得分 + 输入框 ===== */}
          <div>
            <div className="mb-3 flex justify-between text-sm text-text-muted">
              <span>无次数限制</span>
              <span>得分 {score}</span>
            </div>

            {phase === "playing" && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={guess}
                  onChange={(e) => { setGuess(e.target.value); setGuessError(null); }}
                  onKeyDown={(e) => e.key === "Enter" && handleGuessSubmit()}
                  placeholder="输入诗句"
                  className="input-chinese flex-1 text-center"
                />
                <VoiceInput onResult={(text) => setGuess(text)} />
                <button onClick={handleGuessSubmit} className="btn-primary whitespace-nowrap px-4">
                  猜
                </button>
              </div>
            )}

            {guessError && (
              <p className="mt-2 text-center text-sm text-[var(--accent)]">{guessError}</p>
            )}

            {loadingHint && (
              <p className="mt-2 text-center text-sm text-text-muted animate-pulse">
                {loadingHint}
              </p>
            )}
          </div>

          {/* ===== 确认弹窗 ===== */}
          {showConfirm && (
            <div className="rounded-xl border-2 border-accent bg-surface p-4 text-center">
              <p className="mb-2 text-sm text-text-muted">
                {showConfirm.type === "oneOff" ? "与库内版本仅一字不同" : "字符相同但顺序不同"}
              </p>
              <p className="mb-1 text-lg font-bold text-ink">「{showConfirm.guess}」</p>
              <p className="mb-3 text-xs text-text-muted">库内版本：{showConfirm.actual}</p>
              <div className="flex justify-center gap-3">
                <button onClick={confirmOffByOne} className="rounded-lg bg-accent px-4 py-2 text-white font-semibold">
                  提交库内版本
                </button>
                <button onClick={() => { setGuess(""); setShowConfirm(null); }} className="rounded-lg border border-border px-4 py-2 text-text-muted">
                  取消
                </button>
              </div>
            </div>
          )}

          {/* ===== 结束状态 ===== */}
          {phase === "won" && (
            <div className="space-y-4">
              <div className="rounded-2xl border-2 border-accent bg-surface p-6 text-center">
                <p className="text-2xl font-bold text-ink">正确！得分 {score}</p>
                <p className="mt-2 text-lg text-text-muted">答案：{answer}</p>
                {target && (
                  <button
                    onClick={() => { setCardPoem(target); setShowCard(true); }}
                    className="mt-3 text-sm text-accent hover:underline"
                  >
                    查看完整诗词
                  </button>
                )}
              </div>
              <button
                onClick={loadNewPuzzle}
                className="w-full rounded-xl bg-accent py-3 font-semibold text-white hover:bg-red-700 transition"
              >
                再来一局
              </button>
            </div>
          )}

          {/* ===== 诗词卡弹窗 ===== */}
          {showCard && cardPoem && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <OnlinePoemCard result={cardPoem} onClose={() => setShowCard(false)} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
