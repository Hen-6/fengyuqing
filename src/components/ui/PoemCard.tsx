"use client";

import { Poem } from "@/lib/poems";

interface PoemCardProps {
  poem: Poem;
  onClose?: () => void;
  className?: string;
}

export function PoemCard({ poem, onClose, className = "" }: PoemCardProps) {
  const displayLines = poem.lines ?? poem.cleanLines;

  return (
    <div
      className={`relative guofeng-card p-6 ${className}`}
      role="dialog"
      aria-modal="true"
    >
      {onClose && (
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-text-muted hover:text-accent text-xl leading-none transition-colors"
          aria-label="关闭"
        >
          ×
        </button>
      )}

      <header className="mb-4 border-b border-border pb-3">
        <h2 className="text-2xl font-bold text-ink" style={{ fontFamily: "var(--font-serif)" }}>
          《{poem.title}》
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          {poem.author} · {poem.dynasty}
          {poem.type && <span className="ml-2 text-xs text-text-muted">（{poem.type}）</span>}
        </p>
      </header>

      {/* 诗句横排 */}
      <div className="space-y-1 py-2">
        {displayLines.map((line, i) => (
          <p key={i} className="text-ink leading-relaxed text-lg">
            {line}
          </p>
        ))}
      </div>

      {/* 赏析 */}
      {poem.note && (
        <div className="mt-5 rounded-lg bg-paper p-4 text-sm text-text-muted leading-relaxed border border-border">
          <p className="whitespace-pre-wrap">{poem.note}</p>
        </div>
      )}
    </div>
  );
}
