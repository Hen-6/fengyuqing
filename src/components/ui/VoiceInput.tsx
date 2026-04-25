"use client";

import { useState, useCallback } from "react";
import { isVoiceSupported, startVoice, stopVoice, isVoiceActive } from "@/lib/voice";

interface VoiceInputProps {
  onResult: (text: string) => void;
  disabled?: boolean;
}

export function VoiceInput({ onResult, disabled }: VoiceInputProps) {
  const [active, setActive] = useState(false);
  const [supported] = useState(isVoiceSupported);

  const toggle = useCallback(async () => {
    if (active) {
      stopVoice();
      setActive(false);
      return;
    }
    const { success } = await startVoice((transcript, isFinal) => {
      if (isFinal) {
        onResult(transcript);
        stopVoice();
        setActive(false);
      }
    });
    if (success) setActive(true);
  }, [active, onResult]);

  if (!supported) return null;

  return (
    <button
      onClick={toggle}
      disabled={disabled}
      className={`
        flex h-10 w-10 items-center justify-center rounded-full border-2
        transition-all duration-200
        ${active
          ? "border-accent bg-accent text-white animate-pulse"
          : "border-border bg-surface text-text-muted hover:border-accent hover:text-accent"
        }
        ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
      `}
      aria-label={active ? "停止录音" : "开始语音输入"}
      title="语音输入"
    >
      {active ? (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
      )}
    </button>
  );
}
