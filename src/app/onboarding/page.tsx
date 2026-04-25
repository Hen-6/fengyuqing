"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { FEIHUA_CHARS } from "@/lib/poems";
import { getRandomLinesWithChar, verifyLineExists } from "@/lib/poems";
import { loadStore, markPoemAnswered, initializeAllPoems } from "@/lib/user";
import { PoemCard } from "@/components/ui/PoemCard";
import { VoiceInput } from "@/components/ui/VoiceInput";
import { Poem } from "@/lib/poems";

const ROUND_CHARS = [5, 10, 10]; // 轮次字符数
const ROUND_LABELS = ["初试", "再测", "确认"];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface RoundState {
  char: string;
  botLine: { poem: Poem; cleanLine: string } | null;
  userInput: string;
  feedback: { ok: boolean; msg: string } | null;
  result: boolean | null; // null=未答, true=正确, false=错误
  poem: Poem | null;
}

export default function OnboardingPage() {
  const [round, setRound] = useState(0); // 0,1,2
  const [charIndex, setCharIndex] = useState(0);
  const [states, setStates] = useState<RoundState[]>([]);
  const [done, setDone] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [cardPoem, setCardPoem] = useState<Poem | null>(null);
  const [chars, setChars] = useState<string[]>([]);

  const startRound = useCallback((r: number) => {
    const count = ROUND_CHARS[r];
    const pool = shuffle(FEIHUA_CHARS).slice(0, count);
    setChars(pool);
    setCharIndex(0);
    const firstChar = pool[0];
    const options = getRandomLinesWithChar(firstChar, 20);
    const botPick = options[Math.floor(Math.random() * options.length)] ?? null;
    setStates([{
      char: firstChar,
      botLine: botPick,
      userInput: "",
      feedback: null,
      result: null,
      poem: null,
    }]);
  }, []);

  const handleStart = () => startRound(0);

  const handleSubmit = useCallback((text: string) => {
    const trimmed = text.trim();
    setStates((prev) => {
      const s = { ...prev[charIndex] };
      s.userInput = trimmed;

      if (trimmed.length < 4) {
        s.feedback = { ok: false, msg: "至少4个字" };
        return prev;
      }

      const { found, poem } = verifyLineExists(trimmed);
      if (!found) {
        s.feedback = { ok: false, msg: "诗句不在库中" };
        s.result = false;
      } else {
        s.feedback = { ok: true, msg: "✓ 正确" };
        s.result = true;
        s.poem = poem ?? null;
        const store = loadStore();
        if (poem) markPoemAnswered(store, poem.id);
      }
      return [...prev];
    });
  }, [charIndex]);

  const handleNext = useCallback(() => {
    const nextIdx = charIndex + 1;
    if (nextIdx >= chars.length) {
      // 本轮结束
      const nextRound = round + 1;
      if (nextRound >= 3) {
        // 全部结束 → 初始化所有诗
        const store = loadStore();
        initializeAllPoems(store);
        setDone(true);
      } else {
        setRound(nextRound);
        setCharIndex(0);
        startRound(nextRound);
      }
    } else {
      setCharIndex(nextIdx);
      const nextChar = chars[nextIdx];
      const options = getRandomLinesWithChar(nextChar, 20);
      const botPick = options[Math.floor(Math.random() * options.length)] ?? null;
      setStates((prev) => [
        ...prev,
        {
          char: nextChar,
          botLine: botPick,
          userInput: "",
          feedback: null,
          result: null,
          poem: null,
        },
      ]);
    }
  }, [charIndex, chars, round, startRound]);

  const currentState = states[charIndex];
  const totalCorrect = states.filter((s) => s.result === true).length;
  const roundCorrect = states.slice(0, charIndex + 1).filter((s) => s.result === true).length;

  if (done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 paper-texture">
        <div className="text-center space-y-6 max-w-md">
          <div className="text-5xl">🎉</div>
          <h1 className="text-3xl font-bold text-ink">测评完成！</h1>
          <p className="text-text-muted">
            你已掌握 <span className="font-bold text-accent">{totalCorrect}</span> 首诗词
          </p>
          <p className="text-sm text-text-muted">
            其余诗词将从「每日推荐」和「飞花令」中逐步学习
          </p>
          <Link
            href="/"
            className="btn-primary inline-block px-8 py-4"
          >
            开始学习
          </Link>
        </div>
      </div>
    );
  }

  if (states.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 paper-texture">
        <div className="text-center space-y-6 max-w-md">
          <div className="text-5xl">🌸</div>
          <h1 className="text-3xl font-bold text-ink">欢迎来到风雨情</h1>
          <p className="text-text-muted">
            先完成3轮测评，了解你的诗词基础
          </p>
          <p className="text-sm text-text-muted">
            每轮选用不同的关键字，测试你能接出多少诗句
          </p>
          <button
            onClick={handleStart}
            className="btn-primary"
          >
            开始测评
          </button>
          <div className="pt-4">
            <Link href="/" className="text-sm text-text-muted underline">
              跳过测评
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen paper-texture px-6 py-8">
      <div className="mx-auto max-w-lg space-y-6">
        {/* 进度条 */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-text-muted">
            <span>第 {round + 1}/3 轮 · {ROUND_LABELS[round]}</span>
            <span>第 {charIndex + 1}/{chars.length} 题</span>
          </div>
          <div className="h-1.5 rounded-full bg-border overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-all duration-300"
              style={{ width: `${((round * chars.length + charIndex + 1) / 30) * 100}%` }}
            />
          </div>
        </div>

        {/* 本轮正确数 */}
        <div className="rounded-xl border border-border bg-surface p-4 text-center">
          <span className="text-2xl font-bold text-correct">{roundCorrect}</span>
          <span className="text-sm text-text-muted"> / {chars.length} 本轮正确</span>
        </div>

        {/* 当前题 */}
        {currentState && (
          <div className="space-y-5">
            <div className="text-center">
              <div className="mb-3 text-5xl font-bold text-accent">{currentState.char}</div>
              <div className="rounded-xl border border-border bg-surface p-4 text-lg text-ink">
                {currentState.botLine?.cleanLine ?? "..."}
              </div>
              <p className="mt-2 text-xs text-text-muted">
                请接出含「{currentState.char}」的诗句（≥4字）
              </p>
            </div>

            {!currentState.result && (
              <>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={currentState.userInput}
                    onChange={(e) => handleSubmit(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && currentState.feedback && currentState.result !== null && handleNext()}
                    placeholder="输入诗句"
                    className="input-chinese flex-1 text-center"
                    autoFocus
                  />
                  <VoiceInput
                    onResult={(text) => handleSubmit(text)}
                  />
                </div>
                {currentState.feedback && (
                  <p className={`text-center text-sm ${currentState.feedback.ok ? "text-correct" : "text-accent"}`}>
                    {currentState.feedback.msg}
                  </p>
                )}
                <button
                  onClick={() => handleSubmit(currentState.userInput)}
                  className="btn-primary w-full"
                >
                  提交
                </button>
              </>
            )}

            {currentState.result !== null && (
              <div className="space-y-4">
                {currentState.feedback?.ok && currentState.poem && (
                  <PoemCard poem={currentState.poem} />
                )}
                <button
                  onClick={handleNext}
                  className="btn-primary w-full"
                >
                  {charIndex + 1 < chars.length ? "下一题" : "进入下一轮"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
