"use client";

import { useState, useCallback } from "react";
import { Poem, getCoupletsByCount } from "@/lib/poems";
import { verifyLineExists } from "@/lib/poems";
import { loadStore, markPoemAnswered } from "@/lib/user";
import { PoemCard } from "@/components/ui/PoemCard";
import { CharPicker } from "@/components/ui/CharPicker";
import { VoiceInput } from "@/components/ui/VoiceInput";

export function FeihuaGame() {
  const [selectedChar, setSelectedChar] = useState<string>("");
  // "pick" | "playing"
  const [phase, setPhase] = useState<"pick" | "playing">("pick");

  // 随机关键词模式
  const [randomMode, setRandomMode] = useState(false);

  // playing state
  const [botCouplet, setBotCouplet] = useState<{ poem: Poem; lineIndex: number; cleanPair: string } | null>(null);
  const [usedIds, setUsedIds] = useState<Set<string>>(new Set());
  const [userInput, setUserInput] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [verifiedPoem, setVerifiedPoem] = useState<Poem | null>(null);
  const [showCard, setShowCard] = useState(false);
  const [showBotCard, setShowBotCard] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState(3);

  const store = loadStore();

  // 随机选一个关键词
  const FEIHUA_CHARS = [
    "月", "花", "春", "秋", "风", "雨", "山", "水", "云",
    "雪", "夜", "星", "江", "河", "人", "思", "乡", "酒",
    "剑", "马", "鸟", "帆", "柳", "桃", "雁", "笛", "灯",
  ];

  // 选一句对句（五言/七言偶数句起始）
  const pickNewCouplet = useCallback((char: string, excludeIds: Set<string>): typeof botCouplet => {
    const pool5 = getCoupletsByCount(5);
    const pool7 = getCoupletsByCount(7);
    const all = [...pool5, ...pool7];
    const withChar = all.filter(c => c.cleanPair.includes(char) && !excludeIds.has(c.poem.id));
    if (withChar.length === 0) {
      // 用过的太多了，随机挑一个
      const any = all.filter(c => c.cleanPair.includes(char));
      return any.length > 0 ? any[Math.floor(Math.random() * any.length)] : null;
    }
    return withChar[Math.floor(Math.random() * withChar.length)];
  }, []);

  const selectChar = useCallback((char: string) => {
    setSelectedChar(char);
    setUsedIds(new Set());
    const pick = pickNewCouplet(char, new Set());
    setBotCouplet(pick);
    setUserInput("");
    setFeedback(null);
    setVerifiedPoem(null);
    setShowCard(false);
    setShowBotCard(false);
    setPhase("playing");
  }, [pickNewCouplet]);

  const handleRandom = useCallback(() => {
    setRandomMode(true);
    const available = FEIHUA_CHARS;
    const char = available[Math.floor(Math.random() * available.length)];
    selectChar(char);
  }, [selectChar]);

  const submitText = useCallback((text: string) => {
    const input = text.trim();
    if (!input) return;

    if (input.length < 4) {
      setFeedback({ ok: false, msg: "请输入至少4个字" });
      return;
    }

    // 用户输入 → 验证 → 自动默认 Level 3
    const { found, poem } = verifyLineExists(input);
    if (!found) {
      setFeedback({ ok: false, msg: "诗句不在库中，请检查是否有错别字" });
      return;
    }

    setVerifiedPoem(poem);
    setFeedback({ ok: true, msg: "✓ 正确！" });
    if (poem) {
      // 用户接的诗 → 自动 Level 3
      markPoemAnswered(store, poem.id);
    }
    setShowCard(true);
  }, [store]);

  const handleSubmit = useCallback(() => {
    submitText(userInput);
  }, [userInput, submitText]);

  const handleVoiceResult = useCallback((text: string) => {
    setUserInput(text);
    submitText(text);
  }, [submitText]);

  const handleNextForSameChar = useCallback(() => {
    if (!selectedChar || !botCouplet) return;
    const newUsed = new Set(usedIds);
    newUsed.add(botCouplet.poem.id);
    setUsedIds(newUsed);

    const pick = pickNewCouplet(selectedChar, newUsed);
    setBotCouplet(pick);
    setUserInput("");
    setFeedback(null);
    setVerifiedPoem(null);
    setShowCard(false);
    setShowBotCard(false);
    setSelectedLevel(3);
  }, [selectedChar, botCouplet, usedIds, pickNewCouplet]);

  const handleConfirmLevel = useCallback(() => {
    if (verifiedPoem) {
      const { setLevel } = require("@/lib/user");
      setLevel(store, verifiedPoem.id, selectedLevel);
    }
    handleNextForSameChar();
  }, [verifiedPoem, selectedLevel, store, handleNextForSameChar]);

  const handleSwitchChar = useCallback(() => {
    setSelectedChar("");
    setBotCouplet(null);
    setUserInput("");
    setFeedback(null);
    setVerifiedPoem(null);
    setShowCard(false);
    setShowBotCard(false);
    setPhase("pick");
    setRandomMode(false);
  }, []);

  return (
    <div className="mx-auto max-w-lg">
      {/* 选字阶段 */}
      {phase === "pick" && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-ink">飞花令</h2>
            <p className="mt-1 text-sm text-text-muted">
              选择一个字，任意接出含该字的诗句
            </p>
            <p className="mt-1 text-xs text-text-muted">
              无次数限制，考验诗词积累
            </p>
          </div>

          {/* 随机开始 */}
          <button
            onClick={handleRandom}
            className="btn-primary w-full"
          >
            随机关键词开始
          </button>

          <div className="text-center text-xs text-text-muted">— 或 自选关键词 —</div>

          <CharPicker selected={selectedChar} onSelect={selectChar} />
        </div>
      )}

      {/* 游戏中 */}
      {phase === "playing" && botCouplet && (
        <div className="space-y-5">
          {/* 当前关键字 */}
          <div className="text-center">
            <div className="text-xs text-text-muted mb-1">当前关键字</div>
            <div className="text-5xl font-bold text-accent">{selectedChar}</div>
            <div className="mt-1 flex justify-center gap-3 text-xs text-text-muted">
              <button onClick={handleRandom} className="underline hover:text-accent">随机换字</button>
              <span>·</span>
              <button onClick={handleSwitchChar} className="underline hover:text-accent">自选关键词</button>
            </div>
          </div>

          {/* 系统出句（整联对句） */}
          <div
            className="group relative rounded-xl border border-border bg-surface p-4 cursor-pointer hover:border-accent transition-colors"
            onClick={() => setShowBotCard(true)}
            title="点击查看完整诗词"
          >
            <p className="text-xs text-text-muted mb-2">请接出含「{selectedChar}」的诗句</p>
            {/* 竖排对句 */}
            <div className="space-y-1">
              {(() => {
                const l1 = botCouplet.cleanPair.slice(0, botCouplet.cleanPair.length / 2);
                const l2 = botCouplet.cleanPair.slice(botCouplet.cleanPair.length / 2);
                return (
                  <>
                    <div className="text-lg text-ink leading-relaxed">{l1}</div>
                    <div className="text-lg text-ink leading-relaxed">{l2}</div>
                  </>
                );
              })()}
            </div>
            {/* Hover hint */}
            <div className="absolute bottom-2 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-accent">
              点击查看全文 →
            </div>
            <p className="mt-2 text-xs text-text-muted">
              来自《{botCouplet.poem.title}》— {botCouplet.poem.author}
            </p>
          </div>

          {/* 输入区 */}
          {!showCard ? (
            <>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  placeholder={`输入含「${selectedChar}」的诗句`}
                  className="input-chinese flex-1 text-center"
                  autoFocus
                />
                <VoiceInput onResult={handleVoiceResult} />
              </div>

              {feedback && (
                <p className={`text-center text-sm ${feedback.ok ? "text-[var(--correct)]" : "text-[var(--accent)]"}`}>
                  {feedback.msg}
                </p>
              )}

              <button
                onClick={handleSubmit}
                className="btn-primary w-full"
              >
                提交
              </button>
            </>
          ) : (
            <>
              {/* 系统出句的诗词卡（用户可以自评熟练度） */}
              {showBotCard && (
                <div className="relative">
                  <button
                    onClick={() => setShowBotCard(false)}
                    className="absolute -top-1 right-0 text-xs text-text-muted hover:text-accent"
                  >
                    收起
                  </button>
                  <PoemCard poem={botCouplet.poem} />

                  {/* 熟练度自测（系统给出的诗） */}
                  <div className="mt-3 rounded-xl border border-border bg-surface p-4">
                    <p className="mb-3 text-center text-sm text-text-muted">
                      你对这首诗的熟悉程度？
                    </p>
                    <div className="flex justify-center gap-1.5">
                      {[1, 2, 3, 4, 5].map((lvl) => (
                        <button
                          key={lvl}
                          onClick={() => {
                            const { setLevel } = require("@/lib/user");
                            setLevel(store, botCouplet!.poem.id, lvl);
                            setShowBotCard(false);
                          }}
                          className="level-btn"
                        >
                          <span className="level-num">{lvl}</span>
                          <span className="level-name">{["陌生", "认字", "识句", "成篇", "全知"][lvl - 1]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 用户接的诗 */}
              {verifiedPoem && (
                <div className="relative">
                  <button
                    onClick={() => setShowCard(false)}
                    className="absolute -top-1 right-0 text-xs text-text-muted hover:text-accent"
                  >
                    收起
                  </button>
                  <PoemCard poem={verifiedPoem} />
                  {/* 用户接的诗 → 自动 Level 3，不再提供自测 */}
                  <p className="mt-2 text-center text-xs text-text-muted">
                    ✓ 已记录为 Level 3
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleNextForSameChar}
                  className="btn-primary flex-1"
                >
                  继续
                </button>
                <button
                  onClick={handleSwitchChar}
                  className="btn-secondary"
                >
                  换字
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
