"use client";

import Link from "next/link";
import { XunhuaGame } from "@/components/games/XunhuaGame";

export default function XunhuaPage() {
  return (
    <div style={{ background: "#fff", minHeight: "100vh" }}>
      <div style={{ maxWidth: "480px", margin: "0 auto" }}>
        <header className="flex items-center gap-4 mb-4">
          <Link href="/" className="text-2xl text-gray-400 hover:text-gray-700 transition">←</Link>
          <h1 className="text-xl font-bold text-gray-800">寻花令</h1>
        </header>
        <p className="text-xs text-gray-500 mb-4">
          绿色=位置正确，黄色=存在但位置错误，灰色=不存在
        </p>
        <XunhuaGame />
      </div>
    </div>
  );
}
