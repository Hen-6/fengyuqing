"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const router = useRouter();

  // Supabase automatically sets the session when the user lands on this page from the email link.
  
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;
      
      setIsSuccess(true);
      setMessage("密码重置成功！");
      
      // Redirect back to home after 2 seconds
      setTimeout(() => {
        router.push("/");
      }, 2000);
    } catch (err: any) {
      setMessage(`错误: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-xl animate-fade-in mx-4">
        <h2 className="text-xl font-bold text-ink text-center mb-6 brush-title">
          重置暗号 (Update Password)
        </h2>

        {isSuccess ? (
          <div className="text-center">
            <p className="text-sm text-green-600 font-medium mb-4">{message}</p>
            <p className="text-xs text-text-muted">正在返回云阁...</p>
          </div>
        ) : (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">
                新暗号 (New Password)
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
              {loading ? "更新中..." : "保存新密码"}
            </button>
            
            <button
              type="button"
              onClick={() => router.push("/")}
              className="w-full py-2.5 text-xs text-text-muted hover:text-accent transition mt-2"
            >
              返回首页
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
