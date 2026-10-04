"use client";

import { useState } from "react";
import { OnlinePoemResult } from "@/lib/localSearch";
import { stripPunctuation } from "@/lib/poems";

interface Props {
  result: OnlinePoemResult;
  onClose?: () => void;
  /** 在学习详情等不需要高亮匹配行的场景传 false */
  highlightMatch?: boolean;
}

const COLLAPSED_LINE_COUNT = 6;

export function OnlinePoemCard({ result, onClose, highlightMatch = true }: Props) {
  const { name, author, dynasty, content, note, trans, shangxi, tags, matchedLineIndex } = result;

  const lines = content.filter((l) => l.trim());
  const [expanded, setExpanded] = useState(false);
  const tooLong = lines.length > COLLAPSED_LINE_COUNT;
  const visibleLines = expanded || !tooLong ? lines : lines.slice(0, COLLAPSED_LINE_COUNT);

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      {/* 标题 + 关闭按钮（始终可见） */}
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="text-center flex-1">
          <h3 className="text-xl font-bold text-ink">《{name}》</h3>
          <p className="text-sm text-text-muted">
            {author}
            {dynasty ? `·${dynasty}` : ""}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-sm text-text-muted hover:border-accent hover:text-accent transition-colors"
            aria-label="关闭"
          >
            ✕
          </button>
        )}
      </div>

      {/* 诗句 */}
      <div className="mt-4 space-y-2 text-center">
        {visibleLines.map((line, i) => {
          const shouldHighlight = highlightMatch && i === matchedLineIndex;
          return (
            <div
              key={i}
              className={`text-lg leading-loose transition-all ${
                shouldHighlight ? "font-bold text-accent" : "text-ink"
              }`}
            >
              {line}
            </div>
          );
        })}
      </div>

      {/* 展开/收起按钮 */}
      {tooLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 w-full text-center text-xs text-accent hover:underline"
        >
          {expanded ? "收起 ↑" : `展开全部 ${lines.length} 句 ↓`}
        </button>
      )}

      {/* 标签 */}
      {tags && tags.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {tags.map((tag, idx) => (
            <span key={idx} className="px-2 py-0.5 rounded bg-accent/10 text-accent text-xs border border-accent/20">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* 注释/翻译/赏析 (可展开) */}
      {(note || trans || shangxi) && (
        <div className="mt-4 space-y-2 text-left">
          {trans && (
            <details className="group rounded-lg bg-paper/60 p-3 open:bg-paper/80 border border-transparent open:border-border transition-colors">
              <summary className="text-sm font-semibold text-ink cursor-pointer flex items-center justify-between outline-none">
                译文
                <span className="text-text-muted group-open:rotate-180 transition-transform">↓</span>
              </summary>
              <div className="mt-2 text-sm text-text-muted leading-relaxed whitespace-pre-wrap">{trans}</div>
            </details>
          )}
          {note && (
            <details className="group rounded-lg bg-paper/60 p-3 open:bg-paper/80 border border-transparent open:border-border transition-colors">
              <summary className="text-sm font-semibold text-ink cursor-pointer flex items-center justify-between outline-none">
                注释
                <span className="text-text-muted group-open:rotate-180 transition-transform">↓</span>
              </summary>
              <div className="mt-2 text-sm text-text-muted leading-relaxed whitespace-pre-wrap">{note}</div>
            </details>
          )}
          {shangxi && (
            <details className="group rounded-lg bg-paper/60 p-3 open:bg-paper/80 border border-transparent open:border-border transition-colors">
              <summary className="text-sm font-semibold text-ink cursor-pointer flex items-center justify-between outline-none">
                赏析
                <span className="text-text-muted group-open:rotate-180 transition-transform">↓</span>
              </summary>
              <div className="mt-2 text-sm text-text-muted leading-relaxed whitespace-pre-wrap">{shangxi}</div>
            </details>
          )}
        </div>
      )}

      <p className="mt-2 text-center text-xs text-text-muted">
        精选题库来源：aopao/chinese-gushiwen
      </p>

      {onClose && (
        <button
          onClick={onClose}
          className="btn-secondary mt-3 w-full"
        >
          关闭
        </button>
      )}
    </div>
  );
}
