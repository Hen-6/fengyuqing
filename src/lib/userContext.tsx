/**
 * UserContext — React context that wraps the localStorage store and synchronizes with Supabase.
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
  saveStore,
  getOverview,
  defaultStore,
  setLevel as _setLevel,
  markPoemAnswered as _markPoemAnswered,
  upsertPoemProgress as _upsertPoemProgress,
  getPoemProgress as _getPoemProgress,
  deletePoemProgress as _deletePoemProgress,
} from "@/lib/user";
import { PoemProgress, createInitialProgress } from "@/lib/srs";
import { supabase } from "@/lib/supabaseClient";

interface Overview {
  total: number;
  level3plus: number;
  level5: number;
  dueToday: number;
  loaded: boolean;
}

interface UserContextValue {
  loaded: boolean;
  store: UserStore;
  overview: Overview;
  user: any;
  syncing: boolean;
  setLevel: (poemId: string, level: number) => void;
  markPoemAnswered: (poemId: string) => void;
  upsertPoemProgress: (
    poemId: string,
    updater: (p: PoemProgress) => PoemProgress
  ) => void;
  getPoemProgress: (poemId: string) => PoemProgress;
  deletePoemProgress: (poemId: string) => void;
  logout: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [store, _setStore] = useState<UserStore>(defaultStore);
  const [hydrated, setHydrated] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);

  // storeRef ensures all callbacks always have the latest store value
  const storeRef = useRef<UserStore>(store);
  storeRef.current = store;

  const userRef = useRef<any>(null);
  userRef.current = user;

  useEffect(() => {
    storeRef.current = store;
  }, [store]);

  // Sync function to merge local and cloud progress
  const syncProgress = useCallback(async (userId: string, currentStore: UserStore) => {
    setSyncing(true);
    try {
      const { data: dbRecords, error } = await supabase
        .from("user_progress")
        .select("poem_id, level, next_review, updated_at");
      
      if (error) throw error;

      const dbMap = new Map<string, any>();
      dbRecords?.forEach((r) => dbMap.set(r.poem_id, r));

      const localPoems = { ...currentStore.poems };
      const toUpload: any[] = [];
      let modified = false;

      // 1. Merge local changes to DB
      for (const [poemId, localProg] of Object.entries(localPoems)) {
        const dbRecord = dbMap.get(poemId);
        if (!dbRecord) {
          toUpload.push({
            user_id: userId,
            poem_id: poemId,
            level: localProg.level,
            next_review: localProg.nextReview,
            updated_at: new Date().toISOString(),
          });
        } else {
          // Conflict resolution: Higher level wins, or if levels are different, upload higher
          if (dbRecord.level > localProg.level) {
            localPoems[poemId] = {
              ...localProg,
              level: dbRecord.level,
              nextReview: dbRecord.next_review,
            };
            modified = true;
          } else if (localProg.level > dbRecord.level) {
            toUpload.push({
              user_id: userId,
              poem_id: poemId,
              level: localProg.level,
              next_review: localProg.nextReview,
              updated_at: new Date().toISOString(),
            });
          }
        }
      }

      // 2. Fetch DB changes that aren't local
      dbRecords?.forEach((r) => {
        if (!localPoems[r.poem_id]) {
          const base = createInitialProgress(r.poem_id);
          localPoems[r.poem_id] = {
            ...base,
            level: r.level,
            nextReview: r.next_review,
          };
          modified = true;
        }
      });

      // Upload chunks
      if (toUpload.length > 0) {
        const CHUNK_SIZE = 100;
        for (let i = 0; i < toUpload.length; i += CHUNK_SIZE) {
          const chunk = toUpload.slice(i, i + CHUNK_SIZE);
          await supabase
            .from("user_progress")
            .upsert(chunk, { onConflict: "user_id,poem_id" });
        }
      }

      if (modified) {
        currentStore.poems = localPoems;
        saveStore(currentStore);
        _setStore({ ...currentStore });
      }
    } catch (err) {
      console.error("Failed to sync progress with cloud:", err);
    } finally {
      setSyncing(false);
    }
  }, []);

  // Listen to Auth State
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u && hydrated) {
        syncProgress(u.id, storeRef.current);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u && hydrated) {
        syncProgress(u.id, storeRef.current);
      }
    });

    return () => subscription.unsubscribe();
  }, [hydrated, syncProgress]);

  // Read localStorage after mount (client only)
  useEffect(() => {
    const initial = loadStore();
    const fresh = { ...initial, initialized: true };
    _setStore(fresh);
    setHydrated(true);
  }, []);

  // Watch for localStorage changes from other tabs/windows
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === "fengyuqing_v1") {
        const fresh = loadStore();
        _setStore(fresh);
        if (userRef.current) {
          syncProgress(userRef.current.id, fresh);
        }
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [syncProgress]);

  // Cloud persistence helpers
  const saveCloud = useCallback(async (poemId: string, level: number, nextReview: string) => {
    if (!userRef.current) return;
    try {
      await supabase.from("user_progress").upsert({
        user_id: userRef.current.id,
        poem_id: poemId,
        level,
        next_review: nextReview,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,poem_id" });
    } catch (err) {
      console.error("Cloud save failed:", err);
    }
  }, []);

  const deleteCloud = useCallback(async (poemId: string) => {
    if (!userRef.current) return;
    try {
      await supabase
        .from("user_progress")
        .delete()
        .eq("user_id", userRef.current.id)
        .eq("poem_id", poemId);
    } catch (err) {
      console.error("Cloud delete failed:", err);
    }
  }, []);

  const setLevel = useCallback((poemId: string, level: number) => {
    _setLevel(storeRef.current, poemId, level);
    _setStore((prev) => ({ ...prev }));
    
    // Persist to cloud
    const updated = storeRef.current.poems[poemId];
    if (updated) {
      saveCloud(poemId, updated.level, updated.nextReview);
    }
  }, [saveCloud]);

  const markPoemAnswered = useCallback((poemId: string) => {
    _markPoemAnswered(storeRef.current, poemId);
    _setStore((prev) => ({ ...prev }));
    
    const updated = storeRef.current.poems[poemId];
    if (updated) {
      saveCloud(poemId, updated.level, updated.nextReview);
    }
  }, [saveCloud]);

  const upsertPoemProgress = useCallback(
    (poemId: string, updater: (p: PoemProgress) => PoemProgress) => {
      _upsertPoemProgress(storeRef.current, poemId, updater);
      _setStore((prev) => ({ ...prev }));
      
      const updated = storeRef.current.poems[poemId];
      if (updated) {
        saveCloud(poemId, updated.level, updated.nextReview);
      }
    },
    [saveCloud]
  );

  const getPoemProgress = useCallback(
    (poemId: string) => _getPoemProgress(storeRef.current, poemId),
    []
  );

  const deletePoemProgress = useCallback((poemId: string) => {
    _deletePoemProgress(storeRef.current, poemId);
    _setStore((prev) => ({ ...prev }));
    
    deleteCloud(poemId);
  }, [deleteCloud]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    // Clear in-memory progress and local storage if logging out to ensure isolation
    const fresh = defaultStore();
    _setStore(fresh);
    saveStore(fresh);
  }, []);

  const [overview, setOverview] = useState({ total: 0, level3plus: 0, level5: 0, dueToday: 0, loaded: false });

  // Re-compute overview whenever store changes (after hydration)
  useEffect(() => {
    if (!hydrated) return;
    const ov = getOverview(store);
    setOverview({ ...ov, loaded: true });
  }, [store, hydrated]);

  const loaded = hydrated;

  const value = useMemo<UserContextValue>(
    () => ({
      loaded,
      store,
      overview,
      user,
      syncing,
      setLevel,
      markPoemAnswered,
      upsertPoemProgress,
      getPoemProgress,
      deletePoemProgress,
      logout,
    }),
    [store, loaded, overview, user, syncing, setLevel, markPoemAnswered, upsertPoemProgress, getPoemProgress, deletePoemProgress, logout]
  );

  return (
    <UserContext.Provider value={value}>{children}</UserContext.Provider>
  );
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within <UserProvider>");
  return ctx;
}
