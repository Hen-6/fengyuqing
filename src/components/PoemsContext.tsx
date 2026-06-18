"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { IndexedPoem, ensureLoaded, getAllPoems, isLoaded } from "@/lib/localSearch";

interface PoemsContextValue {
  poems: IndexedPoem[];
  loaded: boolean;
  error: string | null;
}

const PoemsContext = createContext<PoemsContextValue>({
  poems: [],
  loaded: false,
  error: null,
});

export function PoemsProvider({ children }: { children: ReactNode }) {
  const [poems, setPoems] = useState<IndexedPoem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      // 如果 Meilisearch 已连接，直接获取缓存的 poems
      if (isLoaded()) {
        try {
          const data = await getAllPoems();
          setPoems(data);
          setLoaded(true);
          return;
        } catch {
          // fall through to ensureLoaded
        }
      }
      // 连接 Meilisearch 并加载全量诗词
      try {
        await ensureLoaded();
        const data = await getAllPoems();
        setPoems(data);
        setLoaded(true);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg);
        setLoaded(true);
      }
    };
    load();
  }, []);

  return (
    <PoemsContext.Provider value={{ poems, loaded, error }}>
      {children}
    </PoemsContext.Provider>
  );
}

export function usePoems() {
  return useContext(PoemsContext);
}
