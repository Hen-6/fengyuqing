/**
 * voice.ts — 原生 iOS/Capacitor + Web Speech API 统一语音识别封装
 */

import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { SpeechRecognition } from "@capgo/capacitor-speech-recognition";

export type VoiceResultCallback = (transcript: string, isFinal: boolean) => void;

interface VoiceEngine {
  start: (onResult: VoiceResultCallback) => Promise<boolean> | void;
  stop: () => void;
  isSupported: () => boolean;
}

// ─── Native Speech Engine (Capacitor / iOS 原生语音) ─────────────────────────

function createNativeSpeechEngine(): VoiceEngine | null {
  if (typeof window === "undefined" || !Capacitor.isNativePlatform()) return null;

  let partialHandle: PluginListenerHandle | null = null;
  let stateHandle: PluginListenerHandle | null = null;
  let errorHandle: PluginListenerHandle | null = null;
  let isRunning = false;
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;
  let latestTranscript = "";
  let currentCallback: VoiceResultCallback | null = null;

  const clearSilence = () => {
    if (silenceTimer) {
      clearTimeout(silenceTimer);
      silenceTimer = null;
    }
  };

  const removeListeners = async () => {
    clearSilence();
    try {
      if (partialHandle) {
        await partialHandle.remove();
        partialHandle = null;
      }
      if (stateHandle) {
        await stateHandle.remove();
        stateHandle = null;
      }
      if (errorHandle) {
        await errorHandle.remove();
        errorHandle = null;
      }
    } catch (e) {
      console.warn("[voice] Error removing native listeners:", e);
    }
  };

  const startSession = async () => {
    if (!isRunning) return;
    try {
      latestTranscript = "";
      clearSilence();
      await SpeechRecognition.start({
        language: "zh-CN",
        maxResults: 5,
        partialResults: true,
        popup: false,
      });
    } catch (err) {
      console.warn("[voice] Native session start error:", err);
    }
  };

  return {
    isSupported: () => true,
    async start(onResult) {
      currentCallback = onResult;
      isRunning = true;
      latestTranscript = "";

      // 检查并请求麦克风及语音识别权限
      try {
        const status = await SpeechRecognition.checkPermissions();
        if (status.speechRecognition !== "granted") {
          const req = await SpeechRecognition.requestPermissions();
          if (req.speechRecognition !== "granted") {
            console.warn("[voice] Native speech permission denied");
            isRunning = false;
            return false;
          }
        }
      } catch (err) {
        console.error("[voice] Native permission request failed:", err);
        isRunning = false;
        return false;
      }

      await removeListeners();

      try {
        // 1. 实时流式分段结果
        partialHandle = await SpeechRecognition.addListener("partialResults", (event) => {
          if (!isRunning) return;
          const text = (event.accumulatedText || (event.matches && event.matches[0]) || "").replace(/\s/g, "");
          if (text) {
            latestTranscript = text;
            currentCallback?.(text, false);

            // 停顿断句计时器：念完诗句后静音 1.2 秒自动判定为整句结束
            clearSilence();
            silenceTimer = setTimeout(async () => {
              if (isRunning && latestTranscript) {
                const final = latestTranscript;
                latestTranscript = "";
                currentCallback?.(final, true);

                // 若处于持续对答模式，主动重置 session 迎接下一出句
                if (isListening && isRunning) {
                  try {
                    await SpeechRecognition.stop();
                  } catch (e) {}
                }
              }
            }, 1200);
          }
        });

        // 2. 监听原生识别状态流转
        stateHandle = await SpeechRecognition.addListener("listeningState", async (event) => {
          if (!isRunning) return;
          if (event.state === "stopped") {
            clearSilence();
            if (latestTranscript) {
              const final = latestTranscript;
              latestTranscript = "";
              currentCallback?.(final, true);
            }

            // 全自动语音模式下自动循环开启下一轮聆听
            if (isListening && isRunning) {
              setTimeout(() => {
                if (isListening && isRunning) {
                  startSession();
                }
              }, 250);
            }
          }
        });

        // 3. 错误监听
        errorHandle = await SpeechRecognition.addListener("error", (err) => {
          console.warn("[voice] Native recognition error event:", err);
        });

        await startSession();
        return true;
      } catch (err) {
        console.error("[voice] Native recognition start failed:", err);
        isRunning = false;
        return false;
      }
    },
    stop() {
      isRunning = false;
      clearSilence();
      if (latestTranscript) {
        const final = latestTranscript;
        latestTranscript = "";
        currentCallback?.(final, true);
      }
      currentCallback = null;
      removeListeners();
      try {
        SpeechRecognition.stop();
      } catch (e) {}
    },
  };
}

// ─── Web Speech API (桌面 Chrome / Edge 原生) ─────────────────────────────────

function createWebSpeechEngine(): VoiceEngine | null {
  if (typeof window === "undefined") return null;
  const SR = (window as unknown as { webkitSpeechRecognition?: { new (): unknown } }).webkitSpeechRecognition ??
    (window as unknown as { SpeechRecognition?: { new (): unknown } }).SpeechRecognition;
  if (!SR) return null;

  let currentRec: any = null;

  return {
    isSupported: () => true,
    start(onResult) {
      if (currentRec) {
        try { currentRec.abort(); } catch (e) {}
      }
      const recognition = new SR() as any;
      currentRec = recognition;
      recognition.lang = "zh-CN";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const results = event.results;
        for (let i = event.resultIndex; i < results.length; i++) {
          const r = results[i];
          const transcript = r[0].transcript.replace(/\s/g, "");
          if (transcript) {
            onResult(transcript, r.isFinal);
          }
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (event: any) => {
        console.error("[voice] Web Speech error:", event.error);
      };

      recognition.onend = () => {
        if (isListening && currentRec) {
          try {
            currentRec.start();
          } catch (e) {
            console.warn("[voice] Web Speech restart failed:", e);
          }
        }
      };

      recognition.start();
    },
    stop() {
      if (currentRec) {
        try {
          currentRec.abort();
        } catch (e) {}
        currentRec = null;
      }
    },
  };
}

// ─── annyang.js 降级方案 ────────────────────────────────────────────────────

let annyangInstance: unknown = null;

function loadAnnyang(): Promise<unknown> {
  return new Promise((resolve) => {
    if ((window as Window & { annyang?: unknown }).annyang) {
      annyangInstance = (window as unknown as { annyang: unknown }).annyang;
      resolve(annyangInstance);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/annyang@3/dist/annyang.iife.min.js";
    script.onload = () => {
      annyangInstance = (window as unknown as { annyang: unknown }).annyang;
      resolve(annyangInstance);
    };
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
}

function createAnnyangEngine(): VoiceEngine | null {
  return {
    isSupported: () => !!(window as Window & { annyang?: unknown }).annyang,
    start(onResult) {
      const any = annyangInstance as {
        isSpeechRecognitionSupported: () => boolean;
        setLanguage: (lang: string) => void;
        start: (opts?: object) => void;
        addCallback: (event: string, cb: (...args: unknown[]) => void) => void;
        abort: () => void;
      } | null;
      if (!any || !any.isSpeechRecognitionSupported()) return;

      any.setLanguage("zh-CN");
      any.addCallback("result", (...args: unknown[]) => {
        const phrases = args[0] as string[];
        if (phrases && phrases[0]) {
          onResult(phrases[0].replace(/\s/g, ""), true);
        }
      });
      any.start({ continuous: true });
    },
    stop() {
      const any = annyangInstance as { abort: () => void } | null;
      any?.abort();
    },
  };
}

// ─── 导出统一 API ────────────────────────────────────────────────────────────

let activeEngine: VoiceEngine | null = null;
let isListening = false;

export function isVoiceSupported(): boolean {
  if (typeof window === "undefined") return false;
  if (Capacitor.isNativePlatform()) return true;
  const w = window as unknown as { webkitSpeechRecognition?: unknown; SpeechRecognition?: unknown; annyang?: unknown };
  return !!(w.webkitSpeechRecognition ?? w.SpeechRecognition ?? w.annyang);
}

export async function startVoice(
  onResult: VoiceResultCallback
): Promise<{ success: boolean; engine: string }> {
  if (isListening) return { success: false, engine: "" };

  // 1. 原生平台（iOS / Android）使用原生 Speech Framework
  if (typeof window !== "undefined" && Capacitor.isNativePlatform()) {
    const nativeEngine = createNativeSpeechEngine();
    if (nativeEngine) {
      activeEngine = nativeEngine;
      isListening = true;
      const started = await nativeEngine.start(onResult);
      if (!started) {
        activeEngine = null;
        isListening = false;
        return { success: false, engine: "" };
      }
      return { success: true, engine: "native" };
    }
  }

  // 2. 网页端优先 Web Speech API
  const engine = createWebSpeechEngine() ?? createAnnyangEngine();
  if (!engine) {
    // 尝试异步加载 annyang
    await loadAnnyang();
    const fallback = createAnnyangEngine();
    if (!fallback) return { success: false, engine: "" };
    activeEngine = fallback;
    isListening = true;
    fallback.start(onResult);
    return { success: true, engine: "annyang" };
  }

  activeEngine = engine;
  isListening = true;
  engine.start(onResult);
  return { success: true, engine: "webspeech" };
}

export function stopVoice(): void {
  if (!activeEngine || !isListening) return;
  if (activeEngine !== null) {
    activeEngine.stop();
  }
  activeEngine = null;
  isListening = false;
}

export function isVoiceActive(): boolean {
  return isListening;
}
