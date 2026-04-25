"use client";

import Link from "next/link";
import { XunhuaGame } from "@/components/games/XunhuaGame";

export default function XunhuaPage() {
  return (
    <div className="min-h-screen paper-texture px-6 py-8">
      <div className="mx-auto max-w-xl space-y-6">
        <header className="flex items-center gap-4">
          <Link href="/" className="text-2xl text-text-muted hover:text-accent transition">←</Link>
          <h1 className="text-xl font-bold text-ink">寻花令</h1>
        </header>
        <p className="text-sm text-text-muted">
          从100字提示格中猜出对句。相同颜色表示：<span className="font-bold text-correct">绿色=位置正确</span>，<span className="font-bold text-present">黄色=存在但位置错误</span>，<span className="font-bold text-absent">灰色=不存在</span>。
        </p>
        <XunhuaGame />
      </div>
    </div>
  );
}
