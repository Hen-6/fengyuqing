/**
 * UserContext — React context that wraps the localStorage store.
 * All components share the same reactive reference so that updates
 * (setLevel, markPoemAnswered, etc.) trigger re-renders automatically.
 */

"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
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
  upsertPoemProgress: (poemId: string, updater: (p: PoemProgress) => PoemProgress) => void;
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

  // Watch for localStorage changes from other tabs/windows
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === "fengyuqing_v1") {
        _setStore(() => loadStore());
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // Functional setStore — derives new reference from prev state + localStorage
  const setStore = useCallback((updater: (prev: UserStore) => UserStore) => {
    _setStore((prev) => {
      const next = updater(prev);
      // Sync to localStorage (lib functions write in-place, ensure save)
      return { ...next };
    });
  }, []);

  const setLevel = useCallback((poemId: string, level: number) => {
    _setLevel(store, poemId, level);
    // Force React to see a new reference
    setStore((prev) => ({ ...prev }));
  }, [store, setStore]);

  const markPoemAnswered = useCallback((poemId: string) => {
    _markPoemAnswered(store, poemId);
    setStore((prev) => ({ ...prev }));
  }, [store, setStore]);

  const upsertPoemProgress = useCallback(
    (poemId: string, updater: (p: PoemProgress) => PoemProgress) => {
      _upsertPoemProgress(store, poemId, updater);
      setStore((prev) => ({ ...prev }));
    },
    [store, setStore]
  );

  const getPoemProgress = useCallback(
    (poemId: string) => _getPoemProgress(store, poemId),
    [store]
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

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

/** Hook to access the shared user store */
export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within <UserProvider>");
  return ctx;
}
