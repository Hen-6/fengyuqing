"use client";

import { OnlinePoemResult } from "@/lib/onlineSearch";
import { stripPunctuation } from "@/lib/poems";

interface Props {
  result: OnlinePoemResult;
  onClose?: () => void;
}

/** 展示从在线数据库查到的诗词（来自 yxcs 原始格式） */
export function OnlinePoemCard({ result, onClose }: Props) {
  const { name, author, dynasty, content, note, matchedLineIndex } = result;

  const lines = content.filter((l) => l.trim());

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-1 text-center">
        <h3 className="text-xl font-bold text-ink">《{name}》</h3>
        <p className="text-sm text-text-muted">
          {author}
          {dynasty ? `·${dynasty}` : ""}
        </p>
      </div>

      {/* 诗句 */}
      <div className="mt-4 space-y-2 text-center">
        {lines.map((line, i) => {
          const clean = stripPunctuation(line);
          const highlighted = clean; // 无需高亮，已找到
          return (
            <div
              key={i}
              className={`text-lg leading-loose ${
                i === matchedLineIndex
                  ? "font-bold text-accent"
                  : "text-ink"
              }`}
            >
              {line}
            </div>
          );
        })}
      </div>

      {/* 赏析 */}
      {note && (
        <div className="mt-4 rounded-lg bg-paper/60 p-3">
          <p className="text-xs text-text-muted leading-relaxed">{note}</p>
        </div>
      )}

      <p className="mt-2 text-center text-xs text-text-muted">
        数据来源：yxcs/poems-db
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
