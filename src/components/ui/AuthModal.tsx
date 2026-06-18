"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setMessage("注册成功！请检查您的邮箱以激活账号，或直接尝试登录。");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        onClose();
      }
    } catch (err: any) {
      setMessage(`错误: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-xl animate-fade-in mx-4">
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-text-muted hover:text-ink text-lg transition"
        >
          ✕
        </button>

        <h2 className="text-xl font-bold text-ink text-center mb-6 brush-title">
          {isSignUp ? "创立云阁" : "登临云阁"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1">
              书信 (邮箱地址)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="yourname@domain.com"
              required
              className="w-full rounded-xl border border-border bg-paper px-4 py-2.5 text-sm text-ink placeholder:text-text-muted focus:border-accent focus:outline-none transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1">
              暗号 (密码)
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full rounded-xl border border-border bg-paper px-4 py-2.5 text-sm text-ink placeholder:text-text-muted focus:border-accent focus:outline-none transition"
            />
          </div>

          {message && (
            <p className="text-xs text-center text-accent bg-accent/10 py-2 px-3 rounded-lg border border-accent/20">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-ink text-white font-medium text-sm hover:opacity-90 active:scale-[0.98] transition shadow-md disabled:opacity-50"
          >
            {loading ? "寻章中..." : isSignUp ? "创立账号" : "登录同步"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-xs text-accent hover:underline transition"
          >
            {isSignUp ? "已有云阁？直接登录" : "未立云阁？点击注册"}
          </button>
        </div>
      </div>
    </div>
  );
}
