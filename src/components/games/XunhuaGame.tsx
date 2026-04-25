"use client";

import { useState, useCallback, useEffect } from "react";
import {
  getAllCouplets,
  getCoupletsByCount,
  getPoemById,
  stripPunctuation,
  findSimilarLines,
  Poem,
  CoupletEntry,
} from "@/lib/poems";
import { loadStore, recordResult } from "@/lib/user";
import { PoemCard } from "@/components/ui/PoemCard";
import { VoiceInput } from "@/components/ui/VoiceInput";

const MAX_SCORE = 200;
type CharState = "empty" | "correct" | "present" | "absent";

interface Guess {
  chars: string[];
  states: CharState[];
  display: string;
  poem: Poem | null;
  lineIndex: number;
}

function buildHintPool(answer: string): string[] {
  const couplets = getAllCouplets();
  const charSet = new Set<string>();
  for (const c of couplets) {
    for (const ch of c.cleanPair) {
      if (ch.trim()) charSet.add(ch);
    }
  }
  const pool: string[] = Array.from(charSet);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const answerChars = answer.split("");
  const extra = answerChars.filter((c) => !pool.includes(c));
  const full = [...pool.slice(0, 90), ...extra, ...pool.slice(90)];
  while (full.length < 100) full.push("　");
  return full.slice(0, 100);
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
  const [phase, setPhase] = useState<"playing" | "won">("playing");
  const [target, setTarget] = useState<CoupletEntry | null>(null);
  const [answer, setAnswer] = useState<string>("");
  const [hintPool, setHintPool] = useState<string[]>([]);
  const [hintStates, setHintStates] = useState<CharState[]>([]);
  const [guess, setGuess] = useState<string>("");
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [guessesLeft] = useState(Infinity);
  const [score, setScore] = useState(MAX_SCORE);
  const [showCard, setShowCard] = useState(false);
  const [cardPoem, setCardPoem] = useState<Poem | null>(null);
  const [showConfirm, setShowConfirm] = useState<{
    type: "oneOff" | "reorder";
    guess: string;
    actual: string;
    poem: Poem;
    lineIndex: number;
  } | null>(null);
  const [similarPoems, setSimilarPoems] = useState<
    { poem: Poem; lineIndex: number; cleanLine: string; distance: number }[]
  >([]);
  const [guessError, setGuessError] = useState<string | null>(null);

  const store = loadStore();

  const pickNewPuzzle = useCallback(() => {
    const pool5 = getCoupletsByCount(5);
    const pool7 = getCoupletsByCount(7);
    const pool = pool5.length > 0 ? pool5 : pool7;
    if (pool.length === 0) return;
    const couplet = pool[Math.floor(Math.random() * pool.length)];
    const answerStr = couplet.cleanPair;
    setTarget(couplet);
    setAnswer(answerStr);
    setHintPool(buildHintPool(answerStr));
    setHintStates(Array(100).fill("empty"));
    setGuess("");
    setGuesses([]);
    setScore(MAX_SCORE);
    setPhase("playing");
    setShowCard(false);
    setCardPoem(null);
    setSimilarPoems([]);
    setGuessError(null);
  }, []);

  useEffect(() => {
    pickNewPuzzle();
  }, [pickNewPuzzle]);

  function doRevealChars(input: string, currentHintStates: CharState[], currentHintPool: string[], currentAnswer: string) {
    const newHintStates = [...currentHintStates];
    for (let i = 0; i < input.length; i++) {
      for (let j = 0; j < currentHintPool.length; j++) {
        if (currentHintPool[j] === input[i] && newHintStates[j] === "empty") {
          newHintStates[j] = input[i] === currentAnswer[i] ? "correct" : "absent";
          break;
        }
      }
    }
    setHintStates(newHintStates);
  }

  const handleGuessSubmit = useCallback(() => {
    if (!guess.trim() || phase !== "playing") return;
    setGuessError(null);
    setSimilarPoems([]);

    const trimmed = stripPunctuation(guess);
    if (trimmed.length === 0) {
      setGuessError("请输入诗句");
      return;
    }

    // 精确匹配
    if (trimmed === answer) {
      const states = computeStates(trimmed, answer);
      const poem = target ? getPoemById(target.poemId) ?? null : null;
      const newGuess: Guess = {
        chars: trimmed.split(""),
        states,
        display: trimmed,
        poem,
        lineIndex: target?.lineIndex ?? 0,
      };
      setGuesses((g) => [...g, newGuess]);
      doRevealChars(trimmed, hintStates, hintPool, answer);
      const finalScore = calcScore(guesses.length + 1);
      setScore(finalScore);
      setPhase("won");
      if (poem) recordResult(store, poem.id, "correct");
      setGuess("");
      return;
    }

    // 一字之差检测
    let diff = 0, diffIdx = -1;
    for (let i = 0; i < trimmed.length && i < answer.length; i++) {
      if (trimmed[i] !== answer[i]) { diff++; diffIdx = i; }
    }
    if (diff === 1 && trimmed.length === answer.length) {
      const { found, poem } = verifyGuessInDb(trimmed);
      if (found && poem) {
        setShowConfirm({ type: "oneOff", guess: trimmed, actual: answer, poem, lineIndex: target?.lineIndex ?? 0 });
        return;
      }
    }

    // 字符相同但顺序不同
    if (trimmed.length === answer.length) {
      const sortedGuess = [...trimmed].sort().join("");
      const sortedAnswer = [...answer].sort().join("");
      if (sortedGuess === sortedAnswer) {
        const { found, poem } = verifyGuessInDb(trimmed);
        if (found && poem) {
          setShowConfirm({ type: "reorder", guess: trimmed, actual: answer, poem, lineIndex: target?.lineIndex ?? 0 });
          return;
        }
      }
    }

    // 都不符合 → 记录错误 + 显示相近诗词
    const states = computeStates(trimmed, answer);
    const poem = target ? getPoemById(target.poemId) ?? null : null;
    const newGuess: Guess = { chars: trimmed.split(""), states, display: trimmed, poem, lineIndex: target?.lineIndex ?? 0 };
    setGuesses((g) => [...g, newGuess]);
    doRevealChars(trimmed, hintStates, hintPool, answer);
    const similar = findSimilarLines(guess);
    setSimilarPoems(similar);
    setGuessError("诗句不在库中");
    setGuess("");
  }, [guess, answer, phase, target, store, guesses, hintStates, hintPool]);

  function verifyGuessInDb(line: string): { found: boolean; poem: Poem | null; lineIndex: number } {
    const couplets = getAllCouplets();
    const clean = stripPunctuation(line);
    for (const c of couplets) {
      if (c.cleanPair === clean) {
        const poem = getPoemById(c.poemId);
        return { found: true, poem: poem ?? null, lineIndex: c.lineIndex };
      }
    }
    return { found: false, poem: null, lineIndex: -1 };
  }

  const confirmOffByOne = useCallback(() => {
    if (!showConfirm) return;
    const { actual, poem, lineIndex } = showConfirm;
    const states = computeStates(actual, actual);
    const newGuess: Guess = { chars: actual.split(""), states, display: actual, poem, lineIndex };
    setGuesses((g) => [...g, newGuess]);
    doRevealChars(actual, hintStates, hintPool, answer);
    const finalScore = calcScore(guesses.length + 1);
    setScore(finalScore);
    setPhase("won");
    if (poem) recordResult(store, poem.id, "correct");
    setGuess("");
    setShowConfirm(null);
  }, [showConfirm, hintStates, hintPool, guesses, store, answer]);

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
      {/* ===== 100字提示格 ===== */}
      <div>
        <div className="mb-2 text-xs text-text-muted text-center">
          提示：点击提示字可查看包含该字的诗句
        </div>
        <div className="grid grid-cols-10 gap-1">
          {hintPool.map((char, i) => (
            <button
              key={i}
              onClick={() => char.trim() && char !== "　" && revealHintChar(char)}
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
              title={char.trim() && char !== "　" ? `含「${char}」的诗句` : ""}
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
                    title={g.poem ? `查看《${g.poem.title}》` : ""}
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
                  setGuess(item.cleanLine);
                  setSimilarPoems([]);
                  setGuessError(null);
                }}
                className="w-full text-left rounded-lg border border-border px-3 py-2 hover:border-accent hover:bg-accent-light transition-colors"
              >
                <div className="text-sm text-ink">{item.cleanLine}</div>
                <div className="text-xs text-text-muted">
                  《{item.poem.title}》— {item.poem.author}（差异 {item.distance} 字）
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
          </div>
          <button onClick={pickNewPuzzle} className="w-full rounded-xl bg-accent py-3 font-semibold text-white hover:bg-red-700 transition">
            再来一局
          </button>
        </div>
      )}

      {/* ===== 诗词卡弹窗 ===== */}
      {showCard && cardPoem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <PoemCard poem={cardPoem} onClose={() => setShowCard(false)} />
        </div>
      )}
    </div>
  );

  function revealHintChar(char: string) {
    const newStates = [...hintStates];
    let changed = false;
    for (let i = 0; i < hintPool.length; i++) {
      if (hintPool[i] === char && newStates[i] === "empty") {
        newStates[i] = char === answer[i] ? "correct" : "absent";
        changed = true;
      }
    }
    if (changed) setHintStates(newStates);
  }
}
