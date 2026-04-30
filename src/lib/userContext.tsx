/**
 * UserContext — React context that wraps the localStorage store.
 * All components share the same reactive reference so that updates
 * (setLevel, markPoemAnswered, etc.) trigger re-renders automatically.
 */

"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  UserStore,
  loadStore,
  initializeAllPoems,
  getOverview,
  setLevel as _setLevel,
  markPoemAnswered as _markPoemAnswered,
  upsertPoemProgress as _upsertPoemProgress,
  getPoemProgress as _getPoemProgress,
} from "@/lib/user";
import { PoemProgress } from "@/lib/srs";

interface Overview {
  total: number;
  level3plus: number;
  level5: number;
  dueToday: number;
}

interface UserContextValue {
  store: UserStore;
  overview: Overview;
  setLevel: (poemId: string, level: number) => void;
  markPoemAnswered: (poemId: string) => void;
  upsertPoemProgress: (
    poemId: string,
    updater: (p: PoemProgress) => PoemProgress
  ) => void;
  getPoemProgress: (poemId: string) => PoemProgress;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [store, _setStore] = useState<UserStore>(() => {
    const initial = loadStore();
    if (!initial.initialized) {
      initializeAllPoems(initial);
    }
    return initial;
  });

  // Always hold the latest store in a mutable ref so that callbacks
  // never capture a stale reference — all mutations operate on the
  // current value even if React hasn't re-rendered yet.
  const storeRef = useRef<UserStore>(store);
  storeRef.current = store;

  // Sync storeRef whenever store changes (after React re-render)
  useEffect(() => {
    storeRef.current = store;
  }, [store]);

  // Watch for localStorage changes from other tabs/windows
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === "fengyuqing_v1") {
        const fresh = loadStore();
        _setStore(fresh);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // All mutation helpers read from storeRef (always fresh) and update
  // both the in-memory store AND localStorage.
  const setLevel = useCallback((poemId: string, level: number) => {
    _setLevel(storeRef.current, poemId, level);
    _setStore((prev) => ({ ...prev }));
  }, []);

  const markPoemAnswered = useCallback((poemId: string) => {
    _markPoemAnswered(storeRef.current, poemId);
    _setStore((prev) => ({ ...prev }));
  }, []);

  const upsertPoemProgress = useCallback(
    (poemId: string, updater: (p: PoemProgress) => PoemProgress) => {
      _upsertPoemProgress(storeRef.current, poemId, updater);
      _setStore((prev) => ({ ...prev }));
    },
    []
  );

  const getPoemProgress = useCallback(
    (poemId: string) => _getPoemProgress(storeRef.current, poemId),
    []
  );

  const overview = useMemo(() => getOverview(store), [store]);

  const value = useMemo<UserContextValue>(
    () => ({
      store,
      overview,
      setLevel,
      markPoemAnswered,
      upsertPoemProgress,
      getPoemProgress,
    }),
    [store, overview, setLevel, markPoemAnswered, upsertPoemProgress, getPoemProgress]
  );

  return (
    <UserContext.Provider value={value}>{children}</UserContext.Provider>
  );
}

/** Hook to access the shared user store */
export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within <UserProvider>");
  return ctx;
}
