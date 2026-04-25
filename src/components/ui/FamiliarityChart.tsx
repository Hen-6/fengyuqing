"use client";

import { getOverview } from "@/lib/user";
import { loadStore } from "@/lib/user";
import { LEVEL_LABELS } from "@/lib/srs";

export function FamiliarityChart() {
  const store = loadStore();
  const { total, level3plus, level5, dueToday } = getOverview(store);

  const items = [
    { label: "已识句（Lv.3+）", value: level3plus, color: "bg-correct" },
    { label: "全知（Lv.5）", value: level5, color: "bg-accent" },
    { label: "今日待复习", value: dueToday, color: "bg-present" },
    { label: "总诗数", value: total, color: "bg-border" },
  ];

  const pct = total > 0 ? Math.round((level3plus / total) * 100) : 0;

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-text-muted">
        学习进度
      </h3>

      {/* 环形进度（纯 CSS） */}
      <div className="mb-5 flex justify-center">
        <div className="relative flex h-28 w-28 items-center justify-center">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" fill="none" stroke="var(--border)" strokeWidth="10" />
            <circle
              cx="50" cy="50" r="40" fill="none"
              stroke="var(--correct)" strokeWidth="10"
              strokeDasharray={`${pct * 2.51} 251`}
              strokeLinecap="round"
            />
          </svg>
          <span className="text-2xl font-bold text-ink">{pct}%</span>
        </div>
      </div>

      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.label} className="flex items-center justify-between">
            <span className="text-sm text-text-muted">{item.label}</span>
            <span className="flex items-center gap-2">
              <span
                className={`inline-block h-2 w-2 rounded-full ${item.color}`}
              />
              <span className="font-semibold text-ink">{item.value}</span>
            </span>
          </li>
        ))}
      </ul>

      {/* 等级说明 */}
      <div className="mt-4 grid grid-cols-5 gap-1 text-center text-xs text-text-muted">
        {Object.entries(LEVEL_LABELS).map(([lvl, { name }]) => (
          <div key={lvl} className="rounded bg-paper py-1">
            <div className="font-semibold text-ink">{lvl}</div>
            <div>{name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
