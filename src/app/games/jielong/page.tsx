"use client";

import Link from "next/link";
import { JielongGame } from "@/components/games/JielongGame";

export default function JielongPage() {
  return (
    <div className="min-h-screen bg-bg px-6 py-8">
      <div className="mx-auto max-w-lg space-y-6">
        <header className="flex items-center gap-4">
          <Link href="/" className="text-2xl text-text-muted hover:text-accent transition">←</Link>
          <h1 className="text-xl font-bold text-ink">接龙</h1>
        </header>
        <JielongGame />
      </div>
    </div>
  );
}
