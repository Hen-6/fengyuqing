"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { OnlinePoemCard } from "@/components/ui/OnlinePoemCard";
import { CharPicker } from "@/components/ui/CharPicker";
import { VoiceInput } from "@/components/ui/VoiceInput";
import { OnlinePoemResult, searchOnline, searchByChar, getPoemByKeyExport } from "@/lib/localSearch";
import { useUser } from "@/lib/userContext";
import { usePoems } from "@/components/PoemsContext";
import { SenseVoiceRecorder } from "@/lib/senseVoiceRecorder";

interface BotPoem {
  poem: OnlinePoemResult;
  lineIndex: number;
  cleanLine: string;
}

interface SelectionItem {
  poem: OnlinePoemResult;
  reason: "exact" | "similar";
}

function cleanHtml(text: string): string {
  return text.replace(/<[^>]+>/g, "").trim();
}

// 严格白名单过滤，只保留汉字
function stripPunct(s: string): string {
  return s.replace(/[^\u4e00-\u9fa5]/g, "");
}

interface RoundEntry {
  char: string;
  botPoem: BotPoem;
  userPoem: OnlinePoemResult | null;
  userLine: string;
  skipped: boolean;
}

export function FeihuaGame() {
  const { store, markPoemAnswered, setLevel } = useUser();
  const { loaded } = usePoems();
  const [selectedChar, setSelectedChar] = useState<string>("");
  const [customChar, setCustomChar] = useState("");
  const [phase, setPhase] = useState<"pick" | "playing" | "summary">("pick");
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceSupported] = useState(
    typeof window !== "undefined" &&
    !!navigator.mediaDevices &&
    !!window.MediaRecorder &&
    !!(window.AudioContext || (window as any).webkitAudioContext)
  );
  const [botPoem, setBotPoem] = useState<BotPoem | null>(null);
  const [userInput, setUserInput] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [onlineResult, setOnlineResult] = useState<OnlinePoemResult | null>(null);
  const [showCard, setShowCard] = useState(false);
  const [showBotModal, setShowBotModal] = useState(false);
  const [similarPoems, setSimilarPoems] = useState<OnlinePoemResult[]>([]);
  const [history, setHistory] = useState<RoundEntry[]>([]);
  const [seenPoemIds, setSeenPoemIds] = useState<Set<string>>(new Set());
  const [currentEntry, setCurrentEntry] = useState<RoundEntry | null>(null);
  /** 用户本轮已说过的诗词（按 fullId 去重） */
  const [localSeenPoems, setLocalSeenPoems] = useState<Set<string>>(new Set());
  /** 多结果弹窗选项 */
  const [selectModal, setSelectModal] = useState<SelectionItem[]>([]);
  /** 本局可用行池（选字时构建） */
  const [linePool, setLinePool] = useState<{ line: string; poem: OnlinePoemResult }[]>([]);
  /** 多行输入拆分后等待用户选择哪一行 */
  const [multiLineInput, setMultiLineInput] = useState<{
    lines: string[];       // 用户输入的各行（去标点后）
    options: {            // 每行的匹配结果
      line: string;
      matches: { line: string; poem: OnlinePoemResult }[];
    }[];
  } | null>(null);

  /** Summary View Data */
  const [unusedMastered, setUnusedMastered] = useState<{ poem: OnlinePoemResult; level: number }[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(false);

  /** 选字后立即搜索 */
  const selectChar = useCallback(async (char: string) => {
    setSelectedChar(char);
    setCustomChar("");
    setOnlineResult(null);
    setSimilarPoems([]);
    setFeedback(null);
    setShowCard(false);
    setShowBotModal(false);
    setSelectModal([]);
    setLocalSeenPoems(new Set());
    setHistory([]);
    setSeenPoemIds(new Set());
    setMultiLineInput(null);
    setUnusedMastered([]);

    // 扩大搜索范围到200首，增加电脑词汇量
    const hits = await searchByChar(char, 200);
    if (hits.length === 0) {
      setFeedback({ ok: false, msg: `没有找到含「${char}」的诗句` });
      setPhase("pick");
      return;
    }

    // 构建本局行池：所有含该字的行（≥4字，去掉标点后）
    const poolItems: { line: string; poem: OnlinePoemResult }[] = [];
    for (const hit of hits) {
      const pid = `${hit.poem.name.trim()}:${hit.poem.author.trim()}`;
      // 避免电脑在一开始就选到已经被用过的诗（虽然在selectChar时localSeenPoems是空的，但这里是防御性编程）
      if (localSeenPoems.has(pid)) continue;

      for (let i = 0; i < hit.poem.content.length; i++) {
        const raw = hit.poem.content[i];
        if (stripPunct(raw).length >= 4 && stripPunct(raw).includes(char)) {
          poolItems.push({ line: raw, poem: hit.poem });
        }
      }
    }

    if (poolItems.length === 0) {
      setFeedback({ ok: false, msg: `没有找到含「${char}」的有效诗句` });
      setPhase("pick");
      return;
    }

    setLinePool(poolItems);

    // 随机选一句
    const chosen = poolItems[Math.floor(Math.random() * poolItems.length)];
    const lineIdx = chosen.poem.content.indexOf(chosen.line);
    const newBotPoem = { poem: chosen.poem, lineIndex: lineIdx, cleanLine: chosen.line };
    setBotPoem(newBotPoem);
    
    // 记录系统出句到已使用池
    const chosenPid = `${chosen.poem.name.trim()}:${chosen.poem.author.trim()}`;
    const initialSeen = new Set<string>([chosenPid]);
    setLocalSeenPoems(initialSeen);
    setSeenPoemIds(initialSeen);

    setCurrentEntry({ char, botPoem: newBotPoem, userPoem: null, userLine: "", skipped: false });
    setPhase("playing");
  }, [localSeenPoems]);

  /** 电脑回合：从已有行池中选出一句（避开已使用的诗） */
  const botTurn = useCallback((currentSeen: Set<string>) => {
    const availablePool = linePool.filter((item) => {
      const pid = `${item.poem.name.trim()}:${item.poem.author.trim()}`;
      return !currentSeen.has(pid);
    });

    if (availablePool.length === 0) {
      setFeedback({ ok: false, msg: "电脑词穷了！没有更多未使用的诗句了。" });
      return false;
    }

    const chosen = availablePool[Math.floor(Math.random() * availablePool.length)];
    const lineIdx = chosen.poem.content.indexOf(chosen.line);
    const newBotPoem = { poem: chosen.poem, lineIndex: lineIdx, cleanLine: chosen.line };
    
    setBotPoem(newBotPoem);
    
    const chosenPid = `${chosen.poem.name.trim()}:${chosen.poem.author.trim()}`;
    setLocalSeenPoems((prev) => new Set([...prev, chosenPid]));
    setSeenPoemIds((prev) => new Set([...prev, chosenPid]));

    setCurrentEntry({ char: selectedChar, botPoem: newBotPoem, userPoem: null, userLine: "", skipped: false });
    return true;
  }, [linePool, selectedChar]);

  const handleRandom = useCallback(() => {
    const FEIHUA_CHARS = [
      "月", "花", "春", "秋", "风", "雨", "山", "水", "云", "雪",
      "夜", "星", "江", "河", "人", "思", "乡", "酒", "剑", "马",
      "日", "天", "鸟", "草", "木", "叶", "声", "光", "心", "情",
    ];
    const char = FEIHUA_CHARS[Math.floor(Math.random() * FEIHUA_CHARS.length)];
    setLocalSeenPoems(new Set());
    setLinePool([]);
    setMultiLineInput(null);
    selectChar(char);
  }, [selectChar]);

  /** 提交用户输入 */
  const submitText = useCallback(async (text: string) => {
    const input = text.trim();
    if (!input) return;
    if (stripPunct(input).length < 4) {
      setFeedback({ ok: false, msg: "请输入至少4个字" });
      return;
    }

    // 1. 检测是否含关键字
    if (!stripPunct(input).includes(selectedChar)) {
      setFeedback({ ok: false, msg: `诗句中必须包含关键字「${selectedChar}」` });
      return;
    }

    // 3. 将多行输入拆分成独立行
    const rawLines = input.split(/[\n\r]+|([。！？\.]+)/).filter(Boolean);
    const userLines = rawLines
      .map((l) => l.trim())
      .filter((l) => stripPunct(l).length >= 4);

    // 4. 逐行在行池中精确匹配
    const poolToSearch = linePool.filter(
      (item) => !(item.poem.name.trim() === botPoem!.poem.name.trim()
        && item.poem.author.trim() === botPoem!.poem.author.trim()
        && item.line === botPoem!.cleanLine)
    );

    const results = userLines.map((ul) => ({
      line: ul,
      matches: poolToSearch.filter((item) => stripPunct(item.line) === stripPunct(ul)),
    }));

    // 统计：有匹配的行
    let matchedLines = results.filter((r) => r.matches.length > 0);

    if (matchedLines.length === 0) {
      // 无行池精确匹配 → 直接在数据库中精确搜索用户输入（去掉标点符号）
      const exactHits = await searchOnline(stripPunct(input), 15);
      
      // 过滤掉当前局已经用过的诗
      const filteredHits = exactHits.filter(h => {
        const pid = `${h.poem.name.trim()}:${h.poem.author.trim()}`;
        return !localSeenPoems.has(pid);
      });

      if (filteredHits.length === 1) {
        // 唯一精确匹配 → 直接成功
        await handleAcceptHit(filteredHits[0].poem, filteredHits[0].poem.matchedLine || filteredHits[0].poem.content[0]);
        return;
      }
      // 多结果 → 用选择弹窗（同 selectModal 流程）
      if (filteredHits.length > 1) {
        const items: SelectionItem[] = filteredHits.map((h) => ({
          poem: h.poem,
          reason: "exact" as const,
        }));
        setSelectModal(items);
        setFeedback(null);
        return;
      }
      
      // 无结果，检查是否是因为已经被用过了
      const duplicateHits = exactHits.filter(h => {
        const pid = `${h.poem.name.trim()}:${h.poem.author.trim()}`;
        return localSeenPoems.has(pid);
      });
      if (duplicateHits.length > 0) {
        setFeedback({ ok: false, msg: "本局已说过这首诗，换一首吧" });
        return;
      }

      // 真正无结果 → 显示模糊搜索建议
      const suggestions = exactHits.slice(0, 3).map((h) => h.poem);
      setSimilarPoems(suggestions);
      setFeedback({ ok: false, msg: "没有找到匹配的诗句，请检查是否输入错误" });
      return;
    }

    // 对于从 linePool 匹配到的，剔除掉那些在本局已经使用过的诗
    matchedLines = matchedLines.map(ml => ({
      ...ml,
      matches: ml.matches.filter(m => {
        const pid = `${m.poem.name.trim()}:${m.poem.author.trim()}`;
        return !localSeenPoems.has(pid);
      })
    })).filter((r) => r.matches.length > 0);

    if (matchedLines.length === 0) {
       setFeedback({ ok: false, msg: "本局已说过这首诗，换一首吧" });
       return;
    }

    if (matchedLines.length === 1 && matchedLines[0].matches.length === 1) {
      // 有且仅有单行、单结果 → 直接成功
      await handleAcceptHit(matchedLines[0].matches[0].poem, matchedLines[0].matches[0].line);
      return;
    }

    if (matchedLines.length === 1 && matchedLines[0].matches.length > 1) {
      // 单行但多结果（同文不同诗）→ 弹窗选择
      const items: SelectionItem[] = matchedLines[0].matches.map((item) => ({
        poem: item.poem,
        reason: "exact",
      }));
      setSelectModal(items);
      setFeedback(null);
      return;
    }

    // 多行 → 让用户选哪一行，以及该行对应哪首诗
    setMultiLineInput({ lines: userLines, options: matchedLines });
  }, [selectedChar, botPoem, localSeenPoems, linePool]);

  /** 用户在弹窗中选中一首诗 */
  const handleAcceptHit = useCallback(async (poem: OnlinePoemResult, userLine: string) => {
    const pid = `${poem.name.trim()}:${poem.author.trim()}`;
    
    // 最终防御性检查
    if (localSeenPoems.has(pid)) {
      setFeedback({ ok: false, msg: "本局已说过这首诗，换一首吧" });
      return;
    }

    setSelectModal([]);
    setMultiLineInput(null);
    setSimilarPoems([]);
    setOnlineResult(poem);
    setFeedback({ ok: true, msg: "✓ 正确！" });
    markPoemAnswered(pid);
    setShowCard(true);

    const entry: RoundEntry = {
      char: selectedChar,
      botPoem: botPoem!,
      userPoem: poem,
      userLine,
      skipped: false,
    };
    
    setHistory((prev) => [entry, ...prev]);
    setCurrentEntry(entry);
    
    const newSeen = new Set([...localSeenPoems, pid]);
    setSeenPoemIds(newSeen);
    setLocalSeenPoems(newSeen);
  }, [selectedChar, botPoem, markPoemAnswered, localSeenPoems]);

  const handleSubmit = useCallback(() => submitText(userInput), [userInput, submitText]);

  const handleVoiceResult = useCallback((text: string) => {
    setUserInput(text);
    submitText(text);
  }, [submitText]);

  const handleNextForSameChar = useCallback(() => {
    if (!selectedChar) return;
    setOnlineResult(null);
    setSimilarPoems([]);
    setFeedback(null);
    setShowCard(false);
    setShowBotModal(false);
    setUserInput("");
    setCurrentEntry(null);
    setMultiLineInput(null);
    
    // 电脑进行下一回合出题
    botTurn(localSeenPoems);
  }, [selectedChar, localSeenPoems, botTurn]);

  // Listen to Enter key when showing correct poem card to proceed automatically
  useEffect(() => {
    if (!showCard) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleNextForSameChar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showCard, handleNextForSameChar]);

  const toggleVoiceMode = useCallback(() => {
    setVoiceMode(prev => !prev);
  }, []);

  const handleAcceptHitVoiceMode = useCallback(async (poem: OnlinePoemResult, userLine: string) => {
    const pid = `${poem.name.trim()}:${poem.author.trim()}`;
    if (localSeenPoems.has(pid)) return;

    markPoemAnswered(pid);
    setFeedback({ ok: true, msg: `✓ 成功匹配：《${poem.name}》— ${poem.author}` });
    setTimeout(() => setFeedback(prev => prev?.ok ? null : prev), 3000);

    const entry: RoundEntry = {
      char: selectedChar,
      botPoem: botPoem!,
      userPoem: poem,
      userLine,
      skipped: false,
    };

    setHistory((prev) => [entry, ...prev]);
    setCurrentEntry(entry);

    const newSeen = new Set([...localSeenPoems, pid]);
    setSeenPoemIds(newSeen);
    setLocalSeenPoems(newSeen);

    // Trigger computer's turn after a brief delay
    setTimeout(() => {
      botTurn(newSeen);
    }, 1500);
  }, [selectedChar, botPoem, markPoemAnswered, localSeenPoems, botTurn]);

  const submitTextVoiceMode = useCallback(async (text: string) => {
    const input = text.trim();
    if (!input) return;
    const cleanInput = stripPunct(input);
    if (cleanInput.length < 4) {
      setFeedback({ ok: false, msg: `“${input}”字数太少` });
      setTimeout(() => setFeedback(prev => prev?.msg.includes("字数太少") ? null : prev), 3000);
      return;
    }

    if (!cleanInput.includes(selectedChar)) {
      setFeedback({ ok: false, msg: `“${input}”未包含关键字「${selectedChar}」` });
      setTimeout(() => setFeedback(prev => prev?.msg.includes("未包含关键字") ? null : prev), 3000);
      return;
    }

    const rawLines = input.split(/[\n\r]+|([。！？\.]+)/).filter(Boolean);
    const userLines = rawLines
      .map((l) => l.trim())
      .filter((l) => stripPunct(l).length >= 4);

    const poolToSearch = linePool.filter(
      (item) => !(item.poem.name.trim() === botPoem!.poem.name.trim()
        && item.poem.author.trim() === botPoem!.poem.author.trim()
        && item.line === botPoem!.cleanLine)
    );

    let matchedLines = userLines.map((ul) => ({
      line: ul,
      matches: poolToSearch.filter((item) => stripPunct(item.line) === stripPunct(ul)),
    })).filter((r) => r.matches.length > 0);

    matchedLines = matchedLines.map(ml => ({
      ...ml,
      matches: ml.matches.filter(m => {
        const pid = `${m.poem.name.trim()}:${m.poem.author.trim()}`;
        return !localSeenPoems.has(pid);
      })
    })).filter((r) => r.matches.length > 0);

    if (matchedLines.length > 0) {
      const match = matchedLines[0].matches[0];
      await handleAcceptHitVoiceMode(match.poem, match.line);
      return;
    }

    const exactHits = await searchOnline(cleanInput, 15);
    const filteredHits = exactHits.filter(h => {
      const pid = `${h.poem.name.trim()}:${h.poem.author.trim()}`;
      return !localSeenPoems.has(pid);
    });

    if (filteredHits.length > 0) {
      const match = filteredHits[0].poem;
      await handleAcceptHitVoiceMode(match, match.matchedLine || match.content[0]);
      return;
    }

    const duplicateHits = exactHits.filter(h => {
      const pid = `${h.poem.name.trim()}:${h.poem.author.trim()}`;
      return localSeenPoems.has(pid);
    });

    if (duplicateHits.length > 0) {
      setFeedback({ ok: false, msg: `“${input}”已在本局说过` });
      setTimeout(() => setFeedback(prev => prev?.msg.includes("已在本局说过") ? null : prev), 3000);
      return;
    }

    setFeedback({ ok: false, msg: `未找到诗句“${input}”` });
    setTimeout(() => setFeedback(prev => prev?.msg.includes("未找到诗句") ? null : prev), 3000);
  }, [selectedChar, botPoem, localSeenPoems, linePool, handleAcceptHitVoiceMode]);

  const submitTextVoiceModeRef = useRef(submitTextVoiceMode);
  useEffect(() => {
    submitTextVoiceModeRef.current = submitTextVoiceMode;
  }, [submitTextVoiceMode]);

  // Keep SenseVoice continuous recording running while in Voice Mode
  useEffect(() => {
    if (!voiceMode || phase !== "playing") {
      return;
    }

    const recorder = new SenseVoiceRecorder((text) => {
      submitTextVoiceModeRef.current(text);
    });

    recorder.start();

    return () => {
      recorder.stop();
    };
  }, [voiceMode, phase]);

  const handleSwitchChar = useCallback(() => {
    setSelectedChar("");
    setCustomChar("");
    setBotPoem(null);
    setUserInput("");
    setFeedback(null);
    setOnlineResult(null);
    setShowCard(false);
    setShowBotModal(false);
    setSelectModal([]);
    setLocalSeenPoems(new Set());
    setMultiLineInput(null);
    setVoiceMode(false);
    setPhase("pick");
  }, []);

  const selectSimilarPoem = useCallback((poem: OnlinePoemResult) => {
    const pid = `${poem.name.trim()}:${poem.author.trim()}`;
    if (localSeenPoems.has(pid)) {
      setFeedback({ ok: false, msg: "本局已说过这首诗，换一首吧" });
      return;
    }
    
    setSimilarPoems([]);
    setOnlineResult(poem);
    setFeedback({ ok: true, msg: "✓ 已选用该诗句" });
    markPoemAnswered(pid);
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
    
    const newSeen = new Set([...localSeenPoems, pid]);
    setSeenPoemIds(newSeen);
    setLocalSeenPoems(newSeen);
  }, [selectedChar, botPoem, markPoemAnswered, localSeenPoems]);

  const handleSkip = useCallback(() => {
    if (!botPoem) return;
    const entry: RoundEntry = {
      char: selectedChar, botPoem, userPoem: null, userLine: "", skipped: true,
    };
    setHistory((prev) => [entry, ...prev]);
    setCurrentEntry(entry);
    handleNextForSameChar();
  }, [botPoem, selectedChar, handleNextForSameChar]);

  const handleEndGame = useCallback(async () => {
    setVoiceMode(false);
    setPhase("summary");
    setLoadingSummary(true);

    try {
      // 找出用户熟练度在 3 级以上的所有诗
      const masteredKeys = Object.entries(store.poems)
        .filter(([key, prog]) => prog.level >= 3 && !localSeenPoems.has(key))
        .map(([key]) => key);

      const unused: { poem: OnlinePoemResult; level: number }[] = [];
      const chunkSize = 20;

      for (let i = 0; i < masteredKeys.length; i += chunkSize) {
        const chunk = masteredKeys.slice(i, i + chunkSize);
        const results = await Promise.all(chunk.map((k) => getPoemByKeyExport(k)));

        for (let j = 0; j < results.length; j++) {
          const res = results[j];
          if (!res || !res.poem) continue;
          
          const fullContent = stripPunct(res.poem.content.join(""));
          if (fullContent.includes(selectedChar)) {
            // Find which line has the character
            const matchedLineIdx = res.poem.content.findIndex(line => stripPunct(line).includes(selectedChar));
            const matchedLine = matchedLineIdx !== -1 ? res.poem.content[matchedLineIdx] : res.poem.content[0];
            
            unused.push({
              poem: { ...res.poem, matchedLine, matchedLineIndex: matchedLineIdx !== -1 ? matchedLineIdx : 0 },
              level: store.poems[chunk[j]].level
            });
          }
        }
      }

      setUnusedMastered(unused);
    } catch (err) {
      console.error("Failed to load unused mastered poems", err);
    } finally {
      setLoadingSummary(false);
    }
  }, [localSeenPoems, store.poems, selectedChar]);



  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-20 text-text-muted">
        <div className="text-center">
          <div className="text-3xl mb-2">📜</div>
          <p>加载诗词库...</p>
        </div>
      </div>
    );
  }

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

          <div className="text-center text-xs text-text-muted">— 或 手动输入单字 —</div>

          <div className="flex gap-2">
            <input
              type="text"
              value={customChar}
              onChange={(e) => setCustomChar(e.target.value)}
              placeholder="请输入单个关键字（如：酒）"
              className="input-chinese flex-[3] text-left px-4"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const cleaned = customChar.trim().replace(/[^\u4e00-\u9fa5]/g, "");
                  if (cleaned.length === 1) {
                    selectChar(cleaned);
                  } else {
                    setFeedback({ ok: false, msg: "请输入单个汉字作为关键字" });
                  }
                }
              }}
            />
            <button
              onClick={() => {
                const cleaned = customChar.trim().replace(/[^\u4e00-\u9fa5]/g, "");
                if (cleaned.length === 1) {
                  selectChar(cleaned);
                } else {
                  setFeedback({ ok: false, msg: "请输入单个汉字作为关键字" });
                }
              }}
              className="btn-primary flex-1 px-4 text-center whitespace-nowrap"
            >
              开始
            </button>
          </div>

          {feedback && !feedback.ok && (
            <p className="text-center text-sm text-accent">{feedback.msg}</p>
          )}

          <div className="text-center text-xs text-text-muted">— 或 常用快捷选字 —</div>

          <CharPicker selected={selectedChar} onSelect={selectChar} />
        </div>
      )}

      {/* 游戏中 */}
      {phase === "playing" && (
        <div className="space-y-5">
          {/* 当前关键字 */}
          <div className="text-center">
            <div className="text-xs text-text-muted mb-1">当前关键字</div>
            <div className="text-5xl font-bold text-accent">{selectedChar}</div>
            {voiceSupported && (
              <div className="mt-3 flex items-center justify-center gap-2">
                <button
                  onClick={toggleVoiceMode}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all duration-200
                    ${voiceMode
                      ? "border-accent bg-accent/10 text-accent animate-pulse"
                      : "border-border bg-surface text-text-muted hover:border-accent hover:text-accent"
                    }
                  `}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                  </svg>
                  {voiceMode ? "自动语音模式：开启" : "自动语音模式：关闭"}
                </button>
              </div>
            )}
          </div>



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
            </div>
          )}

          {/* 多行输入选择弹窗 */}
          {multiLineInput && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMultiLineInput(null)} />
              <div className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-xl">
                <h3 className="mb-1 text-center text-base font-bold text-ink">
                  多行输入 — 请选一行
                </h3>
                <p className="mb-3 text-center text-xs text-text-muted">
                  检测到 {multiLineInput.lines.length} 行，请选择你要接的那一行
                </p>
                <div className="space-y-3">
                  {multiLineInput.options.map((opt, lineIdx) => (
                    <div key={lineIdx}>
                      {/* 用户输入的该行 */}
                      <div className="mb-1 text-sm font-semibold text-ink">
                        「{opt.line}」
                      </div>
                      {opt.matches.length === 1 ? (
                        /* 唯一匹配 → 直接接受 */
                        <button
                          onClick={() => handleAcceptHit(opt.matches[0].poem, opt.matches[0].line)}
                          className="w-full text-left rounded-lg border border-correct/40 bg-green-50 px-3 py-2 hover:border-correct hover:bg-green-100 transition-all"
                        >
                          <div className="text-sm text-ink">
                            {opt.matches[0].line}
                          </div>
                          <div className="mt-0.5 text-xs text-text-muted">
                            ✓《{opt.matches[0].poem.name}》— {opt.matches[0].poem.author}
                          </div>
                        </button>
                      ) : opt.matches.length > 1 ? (
                        /* 多诗匹配 → 显示子选项 */
                        <div className="space-y-1 pl-2">
                          {opt.matches.map((m, mi) => (
                            <button
                              key={mi}
                              onClick={() => handleAcceptHit(m.poem, m.line)}
                              className="w-full text-left rounded-lg border border-border bg-paper px-3 py-1.5 hover:border-accent hover:bg-accent-light/20 transition-all"
                            >
                              <div className="text-xs text-ink">{m.line}</div>
                              <div className="text-xs text-text-muted">
                                《{m.poem.name}》— {m.poem.author}
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-accent pl-2">无匹配</div>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setMultiLineInput(null)}
                  className="mt-4 w-full rounded-lg border border-border bg-surface py-2 text-sm text-text-muted hover:bg-paper transition-colors"
                >
                  取消
                </button>
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

          {/* 多结果弹窗 */}
          {selectModal.length > 0 && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectModal([])} />
              <div className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-xl">
                <h3 className="mb-1 text-center text-base font-bold text-ink">
                  有多句匹配的诗句
                </h3>
                <p className="mb-4 text-center text-xs text-text-muted">
                  请选择你想接的诗句
                </p>
                <div className="space-y-2">
                  {selectModal.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        const rawLines = userInput.split(/[\n\r]+|([。！？\.]+)/).filter(Boolean);
                        const userLines = rawLines.map((l) => l.trim()).filter((l) => stripPunct(l).length >= 4);
                        const matchedLine =
                          userLines.find((ul) =>
                            item.poem.content.some((l) => stripPunct(l) === stripPunct(ul))
                          ) ??
                          item.poem.content.find((l) => stripPunct(l).includes(stripPunct(userInput))) ??
                          item.poem.matchedLine;
                        handleAcceptHit(item.poem, matchedLine);
                      }}
                      className="w-full text-left rounded-xl border border-border bg-paper p-3 hover:border-accent hover:bg-accent-light/20 transition-all"
                    >
                      <div className="text-sm text-ink leading-relaxed">
                        {(() => {
                          const rawLines = userInput.split(/[\n\r]+|([。！？\.]+)/).filter(Boolean);
                          const userLines = rawLines.map((l) => l.trim()).filter((l) => stripPunct(l).length >= 4);
                          return userLines[0] ?? item.poem.matchedLine;
                        })()}
                      </div>
                      <div className="mt-1 text-xs text-text-muted">
                        《{item.poem.name}》— {item.poem.author}
                      </div>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setSelectModal([])}
                  className="mt-4 w-full rounded-lg border border-border bg-surface py-2 text-sm text-text-muted hover:bg-paper transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          )}

          {/* 输入区 */}
          {!showCard ? (
            <>
              {voiceMode ? (
                <div className="space-y-4">
                  <div className="flex flex-col items-center justify-center p-6 border border-dashed border-accent/40 bg-accent/5 rounded-2xl">
                    <div className="h-12 w-12 flex items-center justify-center rounded-full bg-accent text-white mb-2 animate-bounce">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                        <line x1="12" y1="19" x2="12" y2="23"/>
                        <line x1="8" y1="23" x2="16" y2="23"/>
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-accent mb-1">自动语音对答模式开启中</p>
                    <p className="text-xs text-text-muted text-center max-w-xs">
                      请直接念出含「{selectedChar}」的诗句，系统将自动识别并开启下一轮
                    </p>
                  </div>

                  {feedback && (
                    <p className={`text-center text-sm font-medium ${feedback.ok ? "text-correct" : "text-accent animate-pulse"}`}>
                      {feedback.msg}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={toggleVoiceMode} className="btn-secondary">切换回键盘输入</button>
                    <button onClick={handleEndGame} className="btn-secondary" style={{ backgroundColor: 'rgba(192,57,43,0.06)', color: 'var(--accent)', borderColor: 'rgba(192,57,43,0.2)' }}>结束游戏</button>
                  </div>
                </div>
              ) : (
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

                  <div className="grid grid-cols-3 gap-3">
                    <button onClick={handleSubmit} className="btn-primary">提交</button>
                    <button onClick={handleSkip} className="btn-secondary" style={{ backgroundColor: 'rgba(0,0,0,0.04)', color: 'var(--text-muted)' }}>跳过</button>
                    <button onClick={handleEndGame} className="btn-secondary" style={{ backgroundColor: 'rgba(192,57,43,0.06)', color: 'var(--accent)', borderColor: 'rgba(192,57,43,0.2)' }}>结束游戏</button>
                  </div>
                </>
              )}
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

              <div className="grid grid-cols-2 gap-3 mt-4">
                <button onClick={handleNextForSameChar} className="btn-primary">继续</button>
                <button onClick={handleEndGame} className="btn-secondary" style={{ backgroundColor: 'rgba(192,57,43,0.06)', color: 'var(--accent)', borderColor: 'rgba(192,57,43,0.2)' }}>结束游戏</button>
              </div>
            </>
          )}

          {/* 本局历史 */}
          {history.length > 0 && (
            <details className="rounded-xl border border-border bg-surface p-4">
              <summary className="cursor-pointer text-xs text-text-muted hover:text-accent flex justify-between">
                <span>本局已对 {history.length} 轮 ▼</span>
              </summary>
              <div className="mt-3 space-y-3">
                {history.map((entry, idx) => (
                  <div key={idx} className="rounded-lg border border-border bg-paper/60 p-3 text-sm">
                    <div className="text-xs text-text-muted mb-1">
                      第 {history.length - idx} 轮
                      {entry.skipped && <span className="ml-2 text-present">已跳过</span>}
                    </div>
                    <div className="text-text-muted text-xs">系统出：{entry.botPoem.cleanLine}</div>
                    {entry.userLine && (
                      <div className="text-accent text-xs mt-0.5">← 你接：{entry.userLine}</div>
                    )}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* 结束结算阶段 */}
      {phase === "summary" && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-ink">游戏结束</h2>
            <p className="mt-2 text-sm text-text-muted">
              本次关键字：「<span className="text-accent font-bold text-base">{selectedChar}</span>」
            </p>
            <p className="mt-1 text-sm text-text-muted">
              共对答了 <span className="text-accent font-bold text-base">{history.length}</span> 轮
            </p>
          </div>

          <button onClick={handleSwitchChar} className="btn-primary w-full">
            再来一局
          </button>

          <div className="rounded-xl border border-border bg-surface p-4">
            <h3 className="text-lg font-bold text-ink mb-2">漏网之鱼</h3>
            <p className="text-xs text-text-muted mb-4">
              以下是您在已熟练(Lv3+)列表中，包含「{selectedChar}」但本次游戏中未被使用的诗词。
            </p>

            {loadingSummary ? (
              <p className="text-center text-sm text-text-muted py-4">正在从记忆中检索...</p>
            ) : unusedMastered.length === 0 ? (
              <div className="text-center text-sm text-text-muted py-4">
                <span className="text-2xl block mb-2">🎉</span>
                太棒了！您掌握的带有该字的诗词已经全部用光了！
              </div>
            ) : (
              <div className="space-y-4">
                {unusedMastered.map((item, idx) => (
                  <div key={idx} className="rounded-lg border border-border bg-paper p-3">
                    <div className="text-sm font-medium text-ink">
                      {item.poem.matchedLine}
                    </div>
                    <div className="mt-1 text-xs text-text-muted flex justify-between items-center">
                      <span>《{item.poem.name}》— {item.poem.author}</span>
                      <span className="bg-surface border border-border px-2 py-0.5 rounded-full">
                        当前: Lv{store.poems[`${item.poem.name.trim()}:${item.poem.author.trim()}`]?.level ?? item.level}
                      </span>
                    </div>

                    {/* 熟练度自测按钮 */}
                    <div className="mt-3 border-t border-border/50 pt-3">
                      <p className="mb-2 text-center text-xs text-text-muted">忘了这首诗？调整一下熟练度吧</p>
                      <div className="flex justify-center gap-1.5">
                        {[1, 2, 3, 4, 5].map((lvl) => (
                          <button
                            key={lvl}
                            onClick={() => {
                              setLevel(
                                `${item.poem.name.trim()}:${item.poem.author.trim()}`,
                                lvl
                              );
                            }}
                            className={`level-btn ${
                              store.poems[`${item.poem.name.trim()}:${item.poem.author.trim()}`]?.level === lvl
                                ? 'ring-2 ring-accent bg-accent/10'
                                : ''
                            }`}
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
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
