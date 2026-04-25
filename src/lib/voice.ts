/**
 * voice.ts — Web Speech API + annyang.js 语音识别封装
 */

export type VoiceResultCallback = (transcript: string, isFinal: boolean) => void;

interface VoiceEngine {
  start: (onResult: VoiceResultCallback) => void;
  stop: () => void;
  isSupported: () => boolean;
}

// ─── Web Speech API (Chrome 原生) ───────────────────────────────────────────

// Constructor typed without referencing typeof SpeechRecognition (not in
// TypeScript DOM libs at all TS versions).
function createWebSpeechEngine(): VoiceEngine | null {
  if (typeof window === "undefined") return null;
  const SR = (window as unknown as { webkitSpeechRecognition?: { new (): unknown } }).webkitSpeechRecognition ??
    (window as unknown as { SpeechRecognition?: { new (): unknown } }).SpeechRecognition;
  if (!SR) return null;

  return {
    isSupported: () => true,
    start(onResult) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const recognition = new SR() as any;
      recognition.lang = "zh-CN";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const results = event.results;
        for (let i = 0; i < results.length; i++) {
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
        // 允许重新启动
      };

      recognition.start();
    },
    stop() {
      // access via closure variable
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
  const w = window as unknown as { webkitSpeechRecognition?: unknown; SpeechRecognition?: unknown; annyang?: unknown };
  return !!(w.webkitSpeechRecognition ?? w.SpeechRecognition ?? w.annyang);
}

export async function startVoice(
  onResult: VoiceResultCallback
): Promise<{ success: boolean; engine: string }> {
  if (isListening) return { success: false, engine: "" };

  // 优先 Web Speech API
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
    (activeEngine as { stop?: () => void }).stop?.();
  }
  activeEngine = null;
  isListening = false;
}

export function isVoiceActive(): boolean {
  return isListening;
}
