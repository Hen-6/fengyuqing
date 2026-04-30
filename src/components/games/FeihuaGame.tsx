"use client";

import { useState, useCallback } from "react";
import { OnlinePoemCard } from "@/components/ui/OnlinePoemCard";
import { CharPicker } from "@/components/ui/CharPicker";
import { VoiceInput } from "@/components/ui/VoiceInput";
import { OnlinePoemResult, searchOnline } from "@/lib/onlineSearch";
import { FEIHUA_CHARS } from "@/lib/poems";
import { useUser } from "@/lib/userContext";

interface BotPoem {
  poem: OnlinePoemResult;
  lineIndex: number;
  cleanLine: string; // 原诗句，含标点
}

function cleanHtml(text: string): string {
  return text.replace(/<[^>]+>/g, "").trim();
}

function stripPunct(s: string): string {
  return s.replace(/[，。？！、；：""''【】「」()（）·—–\-…\s.,?!'":;\[\]「」『』【】]/g, "");
}

interface RoundEntry {
  char: string;
  botPoem: BotPoem;
  userPoem: OnlinePoemResult | null;
  userLine: string; // 用户输入的原始文字
  skipped: boolean;
}

export function FeihuaGame() {
  const { markPoemAnswered, setLevel } = useUser();
  const [selectedChar, setSelectedChar] = useState<string>("");
  const [phase, setPhase] = useState<"pick" | "playing">("pick");
  const [botPoem, setBotPoem] = useState<BotPoem | null>(null);
  const [userInput, setUserInput] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [onlineResult, setOnlineResult] = useState<OnlinePoemResult | null>(null);
  const [showCard, setShowCard] = useState(false);
  const [showBotModal, setShowBotModal] = useState(false);
  const [similarPoems, setSimilarPoems] = useState<OnlinePoemResult[]>([]);
  const [searching, setSearching] = useState(false);
  // 回合历史
  const [history, setHistory] = useState<RoundEntry[]>([]);
  // 已出现过的诗（用于去重警告）
  const [seenPoemIds, setSeenPoemIds] = useState<Set<string>>(new Set());
  // 当前轮的"已选诗"用于历史记录
  const [currentEntry, setCurrentEntry] = useState<RoundEntry | null>(null);

  /** 选一个字后，在线搜索含该字的诗，随机选一句 */
  const selectChar = useCallback(async (char: string) => {
    setSelectedChar(char);
    setOnlineResult(null);
    setSimilarPoems([]);
    setFeedback(null);
    setShowCard(false);
    setShowBotModal(false);
    setSearching(true);

    const hits = await searchOnline(char, 20);
    setSearching(false);

    if (hits.length === 0) {
      setFeedback({ ok: false, msg: `没有找到含「${char}」的诗句` });
      setPhase("pick");
      return;
    }

    // 过滤掉已出现过的诗（去重），如果全部重复则允许重复
    const unseen = hits.filter(
      (h) => !seenPoemIds.has(`${h.poem.name.trim()}:${h.poem.author.trim()}`)
    );
    const pool = unseen.length > 0 ? unseen : hits;
    const pick = pool[Math.floor(Math.random() * pool.length)];

    // 优先选包含目标字的诗句，优先五言/七言
    const allLines = pick.poem.content
      .map((l, i) => ({ raw: l, idx: i }))
      .filter(({ raw }) => cleanHtml(raw).trim().length >= 4);

    const charLines = allLines.filter(
      ({ raw }) => stripPunct(raw).includes(char)
    );
    const preferredPool =
      charLines.length > 0 ? charLines : allLines;

    // 从优先池中尽量选五言(5)或七言(7)的句子
    const sizeLines = preferredPool.filter(
      ({ raw }) => [5, 7].includes(stripPunct(raw).length)
    );
    const lineChoices = sizeLines.length > 0 ? sizeLines : preferredPool;

    if (lineChoices.length === 0) {
      setFeedback({ ok: false, msg: "这首诗没有可用的句子" });
      return;
    }
    const chosen = lineChoices[Math.floor(Math.random() * lineChoices.length)];
    const lineIdx = chosen.idx;
    const rawLine = chosen.raw;

    const newBotPoem = { poem: pick.poem, lineIndex: lineIdx, cleanLine: rawLine };
    setBotPoem(newBotPoem);
    setCurrentEntry({ char, botPoem: newBotPoem, userPoem: null, userLine: "", skipped: false });
    setPhase("playing");
  }, [seenPoemIds]);

  const handleRandom = useCallback(() => {
    const char = FEIHUA_CHARS[Math.floor(Math.random() * FEIHUA_CHARS.length)];
    selectChar(char);
  }, [selectChar]);

  const submitText = useCallback(async (text: string) => {
    const input = text.trim();
    if (!input) return;
    if (input.length < 4) {
      setFeedback({ ok: false, msg: "请输入至少4个字" });
      return;
    }

    setSearching(true);
    const hits = await searchOnline(input, 5);
    setSearching(false);

    if (hits.length === 0) {
      setFeedback({ ok: false, msg: "诗句不在库中" });
      return;
    }

    const hit = hits[0];
    setSimilarPoems([]);
    setOnlineResult(hit.poem);
    setFeedback({ ok: true, msg: "✓ 正确！" });
    markPoemAnswered(`${hit.poem.name.trim()}:${hit.poem.author.trim()}`);
    setShowCard(true);

    // 更新历史记录
    const entry: RoundEntry = {
      char: selectedChar,
      botPoem: botPoem!,
      userPoem: hit.poem,
      userLine: input,
      skipped: false,
    };
    setHistory((prev) => [entry, ...prev]);
    setCurrentEntry(entry);
    // 标记该诗为已见
    const pid = `${hit.poem.name.trim()}:${hit.poem.author.trim()}`;
    setSeenPoemIds((prev) => new Set([...prev, pid]));
  }, [selectedChar, botPoem, markPoemAnswered]);

  const handleSubmit = useCallback(() => {
    submitText(userInput);
  }, [userInput, submitText]);

  const handleVoiceResult = useCallback((text: string) => {
    setUserInput(text);
    submitText(text);
  }, [submitText]);

  const handleNextForSameChar = useCallback(async () => {
    if (!selectedChar) return;
    // 重置当前状态但保留历史
    setOnlineResult(null);
    setSimilarPoems([]);
    setFeedback(null);
    setShowCard(false);
    setShowBotModal(false);
    setUserInput("");
    setCurrentEntry(null);
    await selectChar(selectedChar);
  }, [selectedChar, selectChar]);

  const handleSwitchChar = useCallback(() => {
    setSelectedChar("");
    setBotPoem(null);
    setUserInput("");
    setFeedback(null);
    setOnlineResult(null);
    setShowCard(false);
    setShowBotModal(false);
    setPhase("pick");
    // 保留历史
  }, []);

  const selectSimilarPoem = useCallback((poem: OnlinePoemResult) => {
    setSimilarPoems([]);
    setOnlineResult(poem);
    setFeedback({ ok: true, msg: "✓ 已选用该诗句" });
    markPoemAnswered(`${poem.name.trim()}:${poem.author.trim()}`);
    setShowCard(true);

    const entry: RoundEntry = {
      char: selectedChar,
      botPoem: botPoem!,
      userPoem: poem,
      userLine: poem.matchedLine || "",
      skipped: false,
    };
    setHistory((prev) => [entry, ...prev]);
    setCurrentEntry(entry);
    const pid = `${poem.name.trim()}:${poem.author.trim()}`;
    setSeenPoemIds((prev) => new Set([...prev, pid]));
  }, [selectedChar, botPoem, markPoemAnswered]);

  // 标记跳过（放弃本轮）
  const handleSkip = useCallback(() => {
    if (!botPoem) return;
    const entry: RoundEntry = {
      char: selectedChar,
      botPoem,
      userPoem: null,
      userLine: "",
      skipped: true,
    };
    setHistory((prev) => [entry, ...prev]);
    setCurrentEntry(entry);
    // 不记录到seen，直接下一题
    handleNextForSameChar();
  }, [botPoem, selectedChar, handleNextForSameChar]);

  const dupWarning = botPoem
    ? seenPoemIds.has(`${botPoem.poem.name.trim()}:${botPoem.poem.author.trim()}`)
      ? "⚠️ 这首诗本局已出现过"
      : null
    : null;

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

          <button onClick={handleRandom} className="btn-primary w-full">
            随机关键词开始
          </button>

          <div className="text-center text-xs text-text-muted">— 或 自选关键词 —</div>

          <CharPicker selected={selectedChar} onSelect={selectChar} />

          {/* 历史记录（选字阶段也可见） */}
          {history.length > 0 && (
            <details className="rounded-xl border border-border bg-surface p-4">
              <summary className="cursor-pointer text-xs text-text-muted hover:text-accent">
                本局历史（{history.length}轮）▼ 点击展开
              </summary>
              <div className="mt-3 space-y-3">
                {history.map((entry, idx) => (
                  <div key={idx} className="rounded-lg border border-border bg-paper/60 p-3 text-sm">
                    <div className="text-xs text-text-muted mb-1">
                      关键字「{entry.char}」
                      {entry.skipped && <span className="ml-2 text-present">已跳过</span>}
                    </div>
                    <div className="text-text-muted text-xs">系统出：{entry.botPoem.cleanLine}</div>
                    {entry.userLine && (
                      <div className="text-accent text-xs mt-0.5">
                        ← 你接：{entry.userLine}
                      </div>
                    )}
                    <div className="text-xs text-text-muted mt-0.5">
                      《{entry.botPoem.poem.name}》— {entry.botPoem.poem.author}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* 游戏中 */}
      {phase === "playing" && (
        <div className="space-y-5">
          {searching && (
            <p className="text-center text-sm text-text-muted animate-pulse">
              在线搜索中…
            </p>
          )}

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

          {/* 重复警告 */}
          {dupWarning && (
            <p className="text-center text-sm text-present font-medium">{dupWarning}</p>
          )}

          {/* 系统出句 */}
          {botPoem && (
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="text-xs text-text-muted mb-2">
                请接出含「{selectedChar}」的诗句
              </p>
              <div className="text-lg text-ink leading-relaxed">{botPoem.cleanLine}</div>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-text-muted">
                  来自《{botPoem.poem.name}》— {botPoem.poem.author}
                </p>
                <button
                  onClick={() => setShowBotModal(true)}
                  className="text-xs text-accent hover:underline"
                >
                  查看全文
                </button>
              </div>

              {/* 系统诗熟练度自测 */}
              <div className="mt-3 rounded-lg border border-border bg-paper/60 p-3">
                <p className="mb-2 text-center text-xs text-text-muted">
                  你对这首诗的熟悉程度？
                </p>
                <div className="flex justify-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => {
                        setLevel(
                          `${botPoem!.poem.name.trim()}:${botPoem!.poem.author.trim()}`,
                          lvl
                        );
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

          {/* 系统诗词大弹窗 */}
          {showBotModal && botPoem && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowBotModal(false)} />
              <div className="relative z-10 w-full max-w-md">
                <OnlinePoemCard result={botPoem.poem} onClose={() => setShowBotModal(false)} />
              </div>
            </div>
          )}

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

              {feedback && !feedback.ok && (
                <p className="text-center text-sm text-accent">{feedback.msg}</p>
              )}

              {/* 相近诗词列表 */}
              {similarPoems.length > 0 && (
                <div className="rounded-xl border border-border bg-surface p-4">
                  <p className="mb-2 text-xs text-text-muted text-center">最相近的诗句：</p>
                  <div className="space-y-2">
                    {similarPoems.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => selectSimilarPoem(item)}
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

              <div className="flex gap-3">
                <button onClick={handleSubmit} className="btn-primary flex-1">
                  提交
                </button>
                <button onClick={handleSkip} className="btn-secondary">
                  跳过
                </button>
              </div>
            </>
          ) : (
            <>
              {onlineResult && (
                <div className="relative">
                  <button
                    onClick={() => setShowCard(false)}
                    className="absolute -top-1 right-0 text-xs text-text-muted hover:text-accent"
                  >
                    收起
                  </button>
                  <OnlinePoemCard result={onlineResult} />
                  <p className="mt-2 text-center text-xs text-text-muted">
                    ✓ 已记录为 Level 3
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={handleNextForSameChar} className="btn-primary flex-1">
                  继续
                </button>
                <button onClick={handleSwitchChar} className="btn-secondary">
                  换字
                </button>
              </div>
            </>
          )}

          {/* 本局历史 */}
          {history.length > 0 && (
            <details className="rounded-xl border border-border bg-surface p-4">
              <summary className="cursor-pointer text-xs text-text-muted hover:text-accent">
                本局历史（{history.length}轮）▼ 点击展开
              </summary>
              <div className="mt-3 space-y-3">
                {history.map((entry, idx) => (
                  <div key={idx} className="rounded-lg border border-border bg-paper/60 p-3 text-sm">
                    <div className="text-xs text-text-muted mb-1">
                      关键字「{entry.char}」
                      {entry.skipped && <span className="ml-2 text-present">已跳过</span>}
                    </div>
                    <div className="text-text-muted text-xs">系统出：{entry.botPoem.cleanLine}</div>
                    {entry.userLine && (
                      <div className="text-accent text-xs mt-0.5">
                        ← 你接：{entry.userLine}
                      </div>
                    )}
                    <div className="text-xs text-text-muted mt-0.5">
                      《{entry.botPoem.poem.name}》— {entry.botPoem.poem.author}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
