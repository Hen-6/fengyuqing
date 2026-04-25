"use client";

import { Poem } from "@/lib/poems";

interface PoemCardProps {
  poem: Poem;
  onClose?: () => void;
  className?: string;
}

export function PoemCard({ poem, onClose, className = "" }: PoemCardProps) {
  const isFive = poem.cleanLines[0]?.length === 5;
  const vertClass = isFive ? "vert-5" : "vert-7";

  return (
    <div
      className={`relative rounded-2xl border border-border bg-surface p-6 shadow-md ${className}`}
      role="dialog"
      aria-modal="true"
    >
      {onClose && (
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-text-muted hover:text-text text-xl leading-none"
          aria-label="关闭"
        >
          ×
        </button>
      )}

      <header className="mb-4 border-b border-border pb-3">
        <h2 className="text-xl font-bold text-ink">
          《{poem.title}》
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          {poem.author} · {poem.dynasty}
          {poem.type && <span className="ml-2 text-xs">（{poem.type}）</span>}
        </p>
      </header>

      {/* 诗句竖排 */}
      <div className={`flex gap-3 ${vertClass}`}>
        {poem.cleanLines.map((line, i) => (
          <span key={i} className="text-ink">
            {line}
          </span>
        ))}
      </div>

      {/* 赏析 */}
      {poem.note && (
        <div className="mt-4 rounded-lg bg-paper p-3 text-sm text-text-muted leading-relaxed">
          <p>{poem.note}</p>
        </div>
      )}
    </div>
  );
}
