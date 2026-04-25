"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  getAllCouplets,
  getCoupletsByCount,
  getPoemById,
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
  display: string; // 合并后的答案字符串
  poem: Poem | null;
  lineIndex: number;
}

function buildHintPool(answer: string): string[] {
  // 从所有诗句中提取汉字，随机排列，填满提示格
  const couplets = getAllCouplets();
  const charSet = new Set<string>();
  for (const c of couplets) {
    for (const ch of c.cleanPair) {
      if (ch.trim()) charSet.add(ch);
    }
  }
  const pool: string[] = Array.from(charSet);
  // 打乱
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  // 用答案中的字补充，确保答案字符都在格中
  const answerChars = answer.split("");
  const extra = answerChars.filter((c) => !pool.includes(c));
  const full = [...pool.slice(0, 90), ...extra, ...pool.slice(90)];
  // 填满 100 格
  while (full.length < 100) {
    full.push("　"); // 全角空格
  }
  return full.slice(0, 100);
}

function computeStates(guess: string, answer: string): CharState[] {
  const states: CharState[] = Array(guess.length).fill("absent");
  const answerArr = answer.split("");

  // 第一遍：精确匹配（绿）
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === answer[i]) {
      states[i] = "correct";
      answerArr[i] = "";
    }
  }
  // 第二遍：存在但位置错误（黄）
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
  const [guessesLeft, setGuessesLeft] = useState(Infinity);
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

  const store = loadStore();

  const pickNewPuzzle = useCallback(() => {
    // 优先选 5 言（10字）
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
    setGuessesLeft(Infinity);
    setScore(MAX_SCORE);
    setPhase("playing");
    setShowCard(false);
    setCardPoem(null);
  }, []);

  useEffect(() => {
    pickNewPuzzle();
  }, [pickNewPuzzle]);

  const revealChar = useCallback(
    (char: string) => {
      const newStates = [...hintStates];
      let changed = false;
      for (let i = 0; i < hintPool.length; i++) {
        if (hintPool[i] === char && newStates[i] === "empty") {
          newStates[i] = char === answer[i] ? "correct" : "absent";
          changed = true;
        }
      }
      if (changed) {
        setHintStates(newStates);
      }
    },
    [hintPool, hintStates, answer]
  );

  const handleGuessSubmit = useCallback(() => {
    if (!guess.trim() || phase !== "playing") return;
    const trimmed = guess.replace(/[，。？！、；：""''【】『』「」()（）.?!,\s]/g, "");

    if (trimmed.length === 0) {
      alert("请输入诗句");
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
      // 揭示对应提示格
      const newHintStates = [...hintStates];
      for (let i = 0; i < answer.length; i++) {
        for (let j = 0; j < hintPool.length; j++) {
          if (hintPool[j] === trimmed[i] && newHintStates[j] === "empty") {
            newHintStates[j] = states[i];
            break;
          }
        }
      }
      setHintStates(newHintStates);
      const finalScore = calcScore(guesses.length + 1);
      setScore(finalScore);
      setPhase("won");
      if (poem) recordResult(store, poem.id, "correct");
      setGuess("");
      return;
    }

    // 一字之差检测
    let diff = 0;
    let diffIdx = -1;
    for (let i = 0; i < trimmed.length; i++) {
      if (trimmed[i] !== answer[i]) {
        diff++;
        diffIdx = i;
      }
    }

    if (diff === 1) {
      // 找库中是否有这个一字之差的版本
      const { found, poem } = verifyGuess(trimmed);
      if (found && poem) {
        const guessChars = trimmed.split("");
        const states = computeStates(trimmed, answer);
        setShowConfirm({
          type: "oneOff",
          guess: trimmed,
          actual: answer,
          poem,
          lineIndex: target?.lineIndex ?? 0,
        });
        return;
      }
    }

    // 字符相同但顺序不同
    const sortedGuess = [...trimmed].sort().join("");
    const sortedAnswer = [...answer].sort().join("");
    if (sortedGuess === sortedAnswer && diff > 1) {
      const { found, poem } = verifyGuess(trimmed);
      if (found && poem) {
        setShowConfirm({
          type: "reorder",
          guess: trimmed,
          actual: answer,
          poem,
          lineIndex: target?.lineIndex ?? 0,
        });
        return;
      }
    }

    // 都不符合 → 正常记录
    recordWrongGuess(trimmed);
  }, [guess, answer, phase, target, store, guesses, hintStates, hintPool]);

  function verifyGuess(line: string): { found: boolean; poem: Poem | null; lineIndex: number } {
    // 在库中查找精确匹配
    const couplets = getAllCouplets();
    for (const c of couplets) {
      if (c.cleanPair === line) {
        const poem = getPoemById(c.poemId);
        return { found: true, poem: poem ?? null, lineIndex: c.lineIndex };
      }
    }
    return { found: false, poem: null, lineIndex: -1 };
  }

  function recordWrongGuess(trimmed: string) {
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

    // 揭示对应提示格
    const newHintStates = [...hintStates];
    for (let i = 0; i < trimmed.length; i++) {
      for (let j = 0; j < hintPool.length; j++) {
        if (hintPool[j] === trimmed[i] && newHintStates[j] === "empty") {
          newHintStates[j] = states[i];
          break;
        }
      }
    }
    setHintStates(newHintStates);
    setGuess("");
  }

  const handleVoiceResult = useCallback((text: string) => {
    setGuess(text);
  }, []);

  const confirmOffByOne = useCallback(() => {
    if (!showConfirm) return;
    const { actual, poem, lineIndex } = showConfirm;
    const states = computeStates(actual, actual);
    const newGuess: Guess = {
      chars: actual.split(""),
      states,
      display: actual,
      poem,
      lineIndex,
    };
    setGuesses((g) => [...g, newGuess]);
    const newHintStates = [...hintStates];
    for (let i = 0; i < actual.length; i++) {
      for (let j = 0; j < hintPool.length; j++) {
        if (hintPool[j] === actual[i] && newHintStates[j] === "empty") {
          newHintStates[j] = states[i];
          break;
        }
      }
    }
    setHintStates(newHintStates);
    const finalScore = calcScore(guesses.length + 1);
    setScore(finalScore);
    setPhase("won");
    if (poem) recordResult(store, poem.id, "correct");
    setGuess("");
    setShowConfirm(null);
  }, [showConfirm, hintStates, hintPool, guesses, store]);

  const hintBgClass = (state: CharState) => {
    switch (state) {
      case "correct": return "bg-correct text-white";
      case "present": return "bg-present text-white";
      case "absent": return "bg-absent text-white";
      default: return "bg-paper text-text-muted";
    }
  };

  const stateLabel = (state: CharState) => {
    switch (state) {
      case "correct": return "bg-correct";
      case "present": return "bg-present";
      case "absent": return "bg-absent";
      default: return "bg-border";
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      {/* 提示格 */}
      <div className="mb-6 grid grid-cols-10 gap-1">
        {hintPool.map((char, i) => (
          <button
            key={i}
            onClick={() => char.trim() && char !== "　" && revealChar(char)}
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

      {/* 猜测历史 */}
      <div className="mb-5 space-y-1">
        {guesses.map((g, gi) => (
          <div key={gi} className="flex gap-1">
            {g.chars.map((ch, ci) => (
              <button
                key={ci}
                onClick={() => g.poem && (setCardPoem(g.poem), setShowCard(true))}
                className={`
                  flex h-9 w-9 items-center justify-center rounded text-sm font-bold
                  transition-all ${stateLabel(g.states[ci])}
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

      {/* 输入框 */}
      {phase === "playing" && (
        <div className="mb-4 flex gap-2">
          <input
            type="text"
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGuessSubmit()}
            placeholder="输入诗句"
            className="input-chinese flex-1 text-center"
          />
          <VoiceInput onResult={handleVoiceResult} />
          <button
            onClick={handleGuessSubmit}
            className="btn-primary"
          >
            猜
          </button>
        </div>
      )}

      {/* 得分 */}
      <div className="mb-4 flex justify-end text-sm text-text-muted">
        <span>得分 {score}</span>
      </div>

      {/* 确认弹窗（一字之差/字序不同） */}
      {showConfirm && (
        <div className="mb-4 rounded-xl border-2 border-accent bg-surface p-4 text-center">
          <p className="mb-2 text-sm text-text-muted">
            {showConfirm.type === "oneOff"
              ? "与库内版本仅一字不同"
              : "字符相同但顺序不同"}
          </p>
          <p className="mb-1 text-lg font-bold text-ink">
            「{showConfirm.guess}」
          </p>
          <p className="mb-3 text-xs text-text-muted">库内版本：{showConfirm.actual}</p>
          <div className="flex justify-center gap-3">
            <button
              onClick={confirmOffByOne}
              className="rounded-lg bg-accent px-4 py-2 text-white font-semibold"
            >
              提交库内版本
            </button>
            <button
              onClick={() => recordWrongGuess(showConfirm.guess)}
              className="rounded-lg border border-border px-4 py-2 text-text-muted"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 结束状态 */}
      {phase !== "playing" && (
        <div className="mb-4 space-y-4">
          <div className="rounded-2xl border-2 border-accent bg-surface p-6 text-center">
            <p className="text-2xl font-bold text-ink">
              🎉 正确！得分 {score}
            </p>
            <p className="mt-2 text-lg text-text-muted">答案：{answer}</p>
          </div>
          <button
            onClick={pickNewPuzzle}
            className="w-full rounded-xl bg-accent py-3 font-semibold text-white hover:bg-red-700 transition"
          >
            再来一局
          </button>
        </div>
      )}

      {/* 诗词卡弹窗 */}
      {showCard && cardPoem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <PoemCard poem={cardPoem} onClose={() => setShowCard(false)} />
        </div>
      )}
    </div>
  );
}
