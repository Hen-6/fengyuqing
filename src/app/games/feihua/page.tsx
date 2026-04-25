"use client";

import Link from "next/link";
import { FeihuaGame } from "@/components/games/FeihuaGame";

export default function FeihuaPage() {
  return (
    <div className="min-h-screen bg-bg px-6 py-8">
      <div className="mx-auto max-w-lg space-y-6">
        <header className="flex items-center gap-4">
          <Link href="/" className="text-2xl text-text-muted hover:text-accent transition">←</Link>
          <h1 className="text-xl font-bold text-ink">飞花令</h1>
        </header>
        <FeihuaGame />
      </div>
    </div>
  );
}
