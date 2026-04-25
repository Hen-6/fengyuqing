"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Poem } from "@/lib/poems";
import { getCoupletsByCount, verifyLineExists } from "@/lib/poems";
import { loadStore, markPoemAnswered, initializeAllPoems } from "@/lib/user";
import { PoemCard } from "@/components/ui/PoemCard";
import { VoiceInput } from "@/components/ui/VoiceInput";

const ROUND_CHARS = [5, 10, 10];
const ROUND_LABELS = ["初试", "再测", "确认"];

const FEIHUA_POOL_CHARS = [
  "月", "花", "春", "秋", "风", "雨", "山", "水", "云",
  "雪", "夜", "星", "江", "河", "人", "思", "乡", "酒",
  "剑", "马", "鸟", "帆", "柳", "桃", "雁", "笛", "灯",
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface Question {
  char: string;
  botCouplet: { poem: Poem; cleanPair: string } | null;
  userInput: string;
  feedback: { ok: boolean; msg: string } | null;
  result: boolean | null;
  userPoem: Poem | null;
}

export default function OnboardingPage() {
  const [round, setRound] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [done, setDone] = useState(false);
  const [showBotModal, setShowBotModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [chars, setChars] = useState<string[]>([]);

  const store = loadStore();

  function pickCouplet(char: string, usedIds: Set<string>) {
    const pool5 = getCoupletsByCount(5);
    const pool7 = getCoupletsByCount(7);
    const all = [...pool5, ...pool7];
    const withChar = all.filter(
      (c) => c.cleanPair.includes(char) && !usedIds.has(c.poem.id)
    );
    if (withChar.length > 0) {
      return withChar[Math.floor(Math.random() * withChar.length)];
    }
    const any = all.filter((c) => c.cleanPair.includes(char));
    return any.length > 0 ? any[Math.floor(Math.random() * any.length)] : null;
  }

  const startRound = useCallback((r: number) => {
    const count = ROUND_CHARS[r];
    const pool = shuffle(FEIHUA_POOL_CHARS).slice(0, count);
    setChars(pool);
    setCharIndex(0);

    const firstChar = pool[0];
    const couplet = pickCouplet(firstChar, new Set());
    setQuestions([{
      char: firstChar,
      botCouplet: couplet,
      userInput: "",
      feedback: null,
      result: null,
      userPoem: null,
    }]);
  }, []);

  const handleStart = () => startRound(0);

  const handleSubmit = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setQuestions((prev) => {
      const q = { ...prev[charIndex] };
      q.userInput = trimmed;

      if (trimmed.length < 4) {
        q.feedback = { ok: false, msg: "至少4个字" };
        return prev;
      }

      const { found, poem } = verifyLineExists(trimmed);
      if (!found) {
        q.feedback = { ok: false, msg: "诗句不在库中" };
        q.result = false;
      } else {
        q.feedback = { ok: true, msg: "✓ 正确" };
        q.result = true;
        q.userPoem = poem ?? null;
        if (poem) markPoemAnswered(store, poem.id);
      }
      return [...prev];
    });
  }, [charIndex, store]);

  const handleVoiceResult = useCallback((text: string) => {
    handleSubmit(text);
  }, [handleSubmit]);

  const handleNext = useCallback(() => {
    const nextIdx = charIndex + 1;
    if (nextIdx >= chars.length) {
      const nextRound = round + 1;
      if (nextRound >= 3) {
        const s = loadStore();
        initializeAllPoems(s);
        setDone(true);
      } else {
        setRound(nextRound);
        setCharIndex(0);
        startRound(nextRound);
      }
    } else {
      setCharIndex(nextIdx);
      const nextChar = chars[nextIdx];
      const usedIds = new Set(
        questions.filter((q) => q.botCouplet).map((q) => q.botCouplet!.poem.id)
      );
      const couplet = pickCouplet(nextChar, usedIds);
      setQuestions((prev) => [
        ...prev,
        {
          char: nextChar,
          botCouplet: couplet,
          userInput: "",
          feedback: null,
          result: null,
          userPoem: null,
        },
      ]);
    }
  }, [charIndex, chars, round, questions, startRound]);

  const currentQ = questions[charIndex];
  const totalCorrect = questions.filter((q) => q.result === true).length;
  const roundCorrect = questions
    .slice(0, charIndex + 1)
    .filter((q) => q.result === true).length;

  if (done) {
    return (
      <div className="min-h-screen paper-texture flex flex-col items-center justify-center px-6">
        <div className="text-center space-y-6 max-w-md">
          <div className="text-5xl">🎉</div>
          <h1 className="text-3xl font-bold text-ink">测评完成！</h1>
          <p className="text-text-muted">
            你已掌握 <span className="font-bold text-accent">{totalCorrect}</span> 首诗词
          </p>
          <p className="text-sm text-text-muted">
            其余诗词将从「飞花令」中逐步学习
          </p>
          <Link
            href="/games/feihua/"
            className="btn-primary inline-block px-8 py-4"
          >
            开始飞花令
          </Link>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen paper-texture flex flex-col items-center justify-center px-6">
        <div className="text-center space-y-6 max-w-md">
          <div className="text-5xl">🌸</div>
          <h1 className="text-3xl font-bold text-ink">欢迎来到风雨情</h1>
          <p className="text-text-muted">
            先完成3轮测评，了解你的诗词基础
          </p>
          <p className="text-sm text-text-muted">
            每轮选用不同的关键字，测试你能接出多少诗句
          </p>
          <button onClick={handleStart} className="btn-primary">
            开始测评
          </button>
          <div className="pt-4">
            <Link href="/games/feihua/" className="text-sm text-text-muted underline">
              跳过，直接进入飞花令
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
              style={{ width: `${((round * 30 + charIndex * 3 + 1) / 90) * 100}%` }}
            />
          </div>
        </div>

        {/* 本轮正确数 */}
        <div className="rounded-xl border border-border bg-surface p-4 text-center">
          <span className="text-2xl font-bold text-correct">{roundCorrect}</span>
          <span className="text-sm text-text-muted"> / {chars.length} 本轮正确</span>
        </div>

        {/* 当前题 */}
        {currentQ && (
          <div className="space-y-5">
            {/* 关键字 */}
            <div className="text-center">
              <div className="text-xs text-text-muted mb-1">关键字</div>
              <div className="text-5xl font-bold text-accent">{currentQ.char}</div>
            </div>

            {/* 系统出句（可点击查看全诗） */}
            {currentQ.botCouplet && (
              <div
                className="group relative rounded-xl border border-border bg-surface p-4 cursor-pointer hover:border-accent transition-colors"
                onClick={() => setShowBotModal(true)}
              >
                <p className="text-xs text-text-muted mb-2">请接出含「{currentQ.char}」的诗句</p>
                <div className="space-y-1">
                  <div className="text-lg text-ink leading-relaxed">
                    {currentQ.botCouplet.cleanPair.slice(
                      0,
                      currentQ.botCouplet.cleanPair.length / 2
                    )}
                  </div>
                  <div className="text-lg text-ink leading-relaxed">
                    {currentQ.botCouplet.cleanPair.slice(
                      currentQ.botCouplet.cleanPair.length / 2
                    )}
                  </div>
                </div>
                <div className="absolute bottom-2 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-accent">
                  点击查看全文 →
                </div>
                <p className="mt-2 text-xs text-text-muted">
                  来自《{currentQ.botCouplet.poem.title}》— {currentQ.botCouplet.poem.author}
                </p>
              </div>
            )}

            {/* 答题区 */}
            {!currentQ.result && (
              <>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={currentQ.userInput}
                    onChange={(e) =>
                      setQuestions((prev) => {
                        const q = [...prev];
                        q[charIndex] = { ...q[charIndex], userInput: e.target.value };
                        return q;
                      })
                    }
                    onKeyDown={(e) =>
                      e.key === "Enter" && currentQ.userInput.trim() && handleSubmit(currentQ.userInput)
                    }
                    placeholder={`输入含「${currentQ.char}」的诗句`}
                    className="input-chinese flex-1 text-center"
                    autoFocus
                  />
                  <VoiceInput onResult={handleVoiceResult} />
                </div>
                {currentQ.feedback && (
                  <p
                    className={`text-center text-sm ${
                      currentQ.feedback.ok ? "text-correct" : "text-accent"
                    }`}
                  >
                    {currentQ.feedback.msg}
                  </p>
                )}
                <button
                  onClick={() => handleSubmit(currentQ.userInput)}
                  className="btn-primary w-full"
                >
                  提交
                </button>
              </>
            )}

            {/* 答题后 */}
            {currentQ.result !== null && (
              <div className="space-y-4">
                {/* 系统诗词卡 + 熟练度自测 */}
                {currentQ.botCouplet && (
                  <div className="relative">
                    <button
                      onClick={() => setShowBotModal(true)}
                      className="text-xs text-accent hover:underline"
                    >
                      查看《{currentQ.botCouplet.poem.title}》全文
                    </button>
                    <div className="mt-2 rounded-xl border border-border bg-surface p-4">
                      <p className="mb-2 text-sm text-text-muted">你对这首诗的熟悉程度？</p>
                      <div className="flex justify-center gap-1.5">
                        {[1, 2, 3, 4, 5].map((lvl) => (
                          <button
                            key={lvl}
                            onClick={() => {
                              const { setLevel } = require("@/lib/user");
                              setLevel(store, currentQ.botCouplet!.poem.id, lvl);
                              setShowBotModal(false);
                            }}
                            className="level-btn"
                          >
                            <span className="level-num">{lvl}</span>
                            <span className="level-name">
                              {["陌生", "认字", "识句", "成篇", "全知"][lvl - 1]}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 用户答对的诗 */}
                {currentQ.feedback?.ok && currentQ.userPoem && (
                  <div>
                    <button
                      onClick={() => setShowUserModal(true)}
                      className="text-xs text-accent hover:underline"
                    >
                      查看《{currentQ.userPoem.title}》全文
                    </button>
                    <p className="mt-1 text-xs text-text-muted">✓ 已记录为 Level 3</p>
                  </div>
                )}

                <button onClick={handleNext} className="btn-primary w-full">
                  {charIndex + 1 < chars.length ? "下一题" : "进入下一轮"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 系统诗词弹窗 */}
      {showBotModal && currentQ?.botCouplet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <PoemCard
            poem={currentQ.botCouplet.poem}
            onClose={() => setShowBotModal(false)}
          />
        </div>
      )}

      {/* 用户诗词弹窗 */}
      {showUserModal && currentQ?.userPoem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <PoemCard
            poem={currentQ.userPoem}
            onClose={() => setShowUserModal(false)}
          />
        </div>
      )}
    </div>
  );
}
