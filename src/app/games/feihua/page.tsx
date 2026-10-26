"use client";

import Link from "next/link";
import { FeihuaGame } from "@/components/games/FeihuaGame";

export default function FeihuaPage() {
  return (
    <div className="min-h-screen paper-texture px-6 pb-8 safe-pt">
      <div className="mx-auto max-w-lg space-y-6">
        <header className="flex items-center gap-4">
          <Link href="/" className="flex items-center justify-center w-10 h-10 -ml-2 rounded-full text-2xl text-text-muted hover:text-accent hover:bg-black/5 active:bg-black/10 transition">←</Link>
          <h1 className="text-xl font-bold text-ink">飞花令</h1>
        </header>
        <FeihuaGame />
      </div>
    </div>
  );
}
