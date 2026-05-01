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
    // 如果已经加载过（模块缓存），直接获取
    if (isLoaded()) {
      const data = getAllPoems();
      setPoems(data);
      setLoaded(true);
      return;
    }
    // 否则加载
    ensureLoaded()
      .then(() => {
        const data = getAllPoems();
        setPoems(data);
        setLoaded(true);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoaded(true);
      });
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
