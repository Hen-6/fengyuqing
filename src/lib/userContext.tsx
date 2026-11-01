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
import { PoemProgress, createInitialProgress, upgradeToLevel } from "@/lib/srs";
import { supabase } from "@/lib/supabaseClient";

interface Overview {
  total: number;
  level3plus: number;
  level5: number;
  dueToday: number;
  favorites: number;
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
  toggleFavorite: (poemId: string) => void;
  upsertPoemProgress: (
    poemId: string,
    updater: (p: PoemProgress) => PoemProgress
  ) => void;
  getPoemProgress: (poemId: string) => PoemProgress;
  deletePoemProgress: (poemId: string) => void;
  logout: () => Promise<void>;
  saveCustomPoem: (poem: any) => void;
  hardNuke: () => Promise<void>;
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
      let dbRecords: any[] | null = null;
      let hasCloudFavCol = true;
      const res = await supabase
        .from("user_progress")
        .select("poem_id, level, next_review, is_favorite, updated_at");
      
      if (res.error) {
        hasCloudFavCol = false;
        const fallbackRes = await supabase
          .from("user_progress")
          .select("poem_id, level, next_review, updated_at");
        if (fallbackRes.error) throw fallbackRes.error;
        dbRecords = fallbackRes.data;
      } else {
        dbRecords = res.data;
      }

      const dbMap = new Map<string, any>();
      dbRecords?.forEach((r) => dbMap.set(r.poem_id, r));

      const localPoems = { ...currentStore.poems };
      const toUpload: any[] = [];
      let modified = false;

      // 1. Merge local changes with DB records
      for (const [poemId, localProg] of Object.entries(localPoems)) {
        const dbRecord = dbMap.get(poemId);
        if (!dbRecord) {
          const rec: any = {
            user_id: userId,
            poem_id: poemId,
            level: localProg.level,
            next_review: localProg.nextReview,
            updated_at: localProg.updatedAt || new Date().toISOString(),
          };
          if (hasCloudFavCol) rec.is_favorite = !!localProg.isFavorite;
          toUpload.push(rec);
        } else {
          const dbTime = new Date(dbRecord.updated_at).getTime() || 0;
          const localTime = new Date(localProg.updatedAt || localProg.lastReviewed || 0).getTime() || 0;

          if (dbTime > localTime) {
            // Cloud is newer -> Local adopts Cloud state
            localPoems[poemId] = {
              ...localProg,
              level: dbRecord.level,
              nextReview: dbRecord.next_review,
              isFavorite: hasCloudFavCol && dbRecord.is_favorite !== undefined ? !!dbRecord.is_favorite : localProg.isFavorite,
              updatedAt: dbRecord.updated_at,
            };
            modified = true;
          } else if (localTime > dbTime) {
            // Local is newer -> Push local state to Cloud
            const rec: any = {
              user_id: userId,
              poem_id: poemId,
              level: localProg.level,
              next_review: localProg.nextReview,
              updated_at: localProg.updatedAt || new Date().toISOString(),
            };
            if (hasCloudFavCol) rec.is_favorite = !!localProg.isFavorite;
            toUpload.push(rec);
          } else {
            // Timestamps equal or neither has explicit updatedAt: resolve field-by-field safely
            let itemChanged = false;
            const merged = { ...localProg };
            if (dbRecord.level > localProg.level) {
              merged.level = dbRecord.level;
              merged.nextReview = dbRecord.next_review;
              itemChanged = true;
            }
            if (hasCloudFavCol && dbRecord.is_favorite !== undefined && dbRecord.is_favorite !== !!localProg.isFavorite) {
              if (dbRecord.is_favorite) {
                merged.isFavorite = true;
                itemChanged = true;
              } else if (localProg.isFavorite) {
                toUpload.push({
                  user_id: userId,
                  poem_id: poemId,
                  level: localProg.level,
                  next_review: localProg.nextReview,
                  is_favorite: true,
                  updated_at: new Date().toISOString(),
                });
              }
            }
            if (itemChanged) {
              localPoems[poemId] = merged;
              modified = true;
            }
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
            isFavorite: hasCloudFavCol && r.is_favorite !== undefined ? !!r.is_favorite : false,
            updatedAt: r.updated_at,
          };
          modified = true;
        }
      });

      // Upload chunks
      if (toUpload.length > 0) {
        const CHUNK_SIZE = 100;
        for (let i = 0; i < toUpload.length; i += CHUNK_SIZE) {
          const chunk = toUpload.slice(i, i + CHUNK_SIZE);
          const { error: uploadErr } = await supabase
            .from("user_progress")
            .upsert(chunk, { onConflict: "user_id,poem_id" });
          if (uploadErr && hasCloudFavCol) {
            // Retry without is_favorite
            const cleaned = chunk.map((c) => {
              const { is_favorite, ...rest } = c;
              return rest;
            });
            await supabase
              .from("user_progress")
              .upsert(cleaned, { onConflict: "user_id,poem_id" });
          }
        }
      }

      if (modified) {
        currentStore.poems = localPoems;
        saveStore(currentStore);
        _setStore({ ...currentStore });
      }

      // 3. Two-way sync for custom poems (user_custom_poems)
      try {
        const { data: cloudCustoms, error: customErr } = await supabase
          .from("user_custom_poems")
          .select("poem_id, title, author, dynasty, content, note, trans, shangxi, tags, updated_at");

        if (!customErr) {
          const localCustomStr = typeof window !== "undefined" ? localStorage.getItem("fengyuqing_custom_poems_v1") : null;
          let localCustoms: any[] = [];
          if (localCustomStr) {
            try { localCustoms = JSON.parse(localCustomStr); } catch (e) {}
          }
          if (!Array.isArray(localCustoms)) localCustoms = [];

          const localMap = new Map<string, any>();
          localCustoms.forEach(p => localMap.set(`${p.t}:${p.a}`, p));

          const cloudMap = new Map<string, any>();
          cloudCustoms?.forEach(p => cloudMap.set(p.poem_id, p));

          let customModified = false;
          const toUploadCustoms: any[] = [];

          // Upload local customs not in cloud
          for (const [key, p] of localMap.entries()) {
            if (!cloudMap.has(key)) {
              toUploadCustoms.push({
                user_id: userId,
                poem_id: key,
                title: p.t,
                author: p.a,
                dynasty: p.d || "",
                content: p.content || [],
                note: p.note || "",
                trans: p.trans || "",
                shangxi: p.shangxi || "",
                tags: p.tags || [],
                updated_at: new Date().toISOString(),
              });
            }
          }

          // Merge cloud customs not in local
          const newInjectedToWorker: any[] = [];
          cloudCustoms?.forEach(cp => {
            if (!localMap.has(cp.poem_id)) {
              const formatted = {
                t: cp.title,
                a: cp.author,
                d: cp.dynasty || "",
                content: cp.content || [],
                note: cp.note || "",
                trans: cp.trans || "",
                shangxi: cp.shangxi || "",
                tags: cp.tags || []
              };
              localCustoms.push(formatted);
              newInjectedToWorker.push(formatted);
              customModified = true;
            }
          });

          if (customModified && typeof window !== "undefined") {
            localStorage.setItem("fengyuqing_custom_poems_v1", JSON.stringify(localCustoms));
            if (newInjectedToWorker.length > 0) {
              import("./dbSearch").then(db => {
                db.addCustomPoemsToWorker(newInjectedToWorker).then(() => {
                  db.getWorkerPoemCount().then(cnt => {
                    if (cnt > 0) setWorkerTotalCount(cnt);
                  });
                });
              });
            }
          }

          if (toUploadCustoms.length > 0) {
            for (let i = 0; i < toUploadCustoms.length; i += 50) {
              const chunk = toUploadCustoms.slice(i, i + 50);
              await supabase
                .from("user_custom_poems")
                .upsert(chunk, { onConflict: "user_id,poem_id" });
            }
          }
        }
      } catch (e) {
        console.warn("Custom poems sync skipped or table not initialized yet:", e);
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
    
    // Inject custom poems into worker on boot
    const customPoemsStr = localStorage.getItem("fengyuqing_custom_poems_v1");
    if (customPoemsStr) {
      try {
        const customPoems = JSON.parse(customPoemsStr);
        if (Array.isArray(customPoems) && customPoems.length > 0) {
          import("./dbSearch").then(db => db.addCustomPoemsToWorker(customPoems));
        }
      } catch (e) {
        console.error("Failed to inject custom poems", e);
      }
    }
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
  const saveCloud = useCallback(async (
    poemId: string,
    level: number,
    nextReview: string,
    isFavorite?: boolean,
    updatedAt?: string
  ) => {
    if (!userRef.current) return;
    try {
      const payload: any = {
        user_id: userRef.current.id,
        poem_id: poemId,
        level,
        next_review: nextReview,
        updated_at: updatedAt || new Date().toISOString(),
      };
      if (typeof isFavorite === "boolean") {
        payload.is_favorite = isFavorite;
      }
      const { error } = await supabase.from("user_progress").upsert(payload, { onConflict: "user_id,poem_id" });
      if (error && (error.message.includes("is_favorite") || error.code === "42703")) {
        delete payload.is_favorite;
        await supabase.from("user_progress").upsert(payload, { onConflict: "user_id,poem_id" });
      }
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
    const { key, progress: updated } = _upsertPoemProgress(storeRef.current, poemId, (p) => ({
      ...p,
      level: Math.max(1, Math.min(5, level)),
      consecutiveCorrect: 0,
      consecutiveWrong: 0,
      updatedAt: new Date().toISOString(),
    }));
    _setStore((prev) => ({ ...prev }));
    
    // Persist to cloud
    if (updated) {
      saveCloud(key, updated.level, updated.nextReview, updated.isFavorite, updated.updatedAt);
    }
  }, [saveCloud]);

  const markPoemAnswered = useCallback((poemId: string) => {
    const { key, progress: updated } = _upsertPoemProgress(storeRef.current, poemId, (p) => upgradeToLevel(p, 3));
    _setStore((prev) => ({ ...prev }));
    
    if (updated) {
      saveCloud(key, updated.level, updated.nextReview, updated.isFavorite, updated.updatedAt);
    }
  }, [saveCloud]);

  const upsertPoemProgress = useCallback(
    (poemId: string, updater: (p: PoemProgress) => PoemProgress) => {
      const { key, progress: updated } = _upsertPoemProgress(storeRef.current, poemId, updater);
      _setStore((prev) => ({ ...prev }));
      
      if (updated) {
        saveCloud(key, updated.level, updated.nextReview, updated.isFavorite, updated.updatedAt);
      }
    },
    [saveCloud]
  );

  const toggleFavorite = useCallback((poemId: string) => {
    const key = poemId.trim();
    upsertPoemProgress(key, (p) => ({
      ...p,
      isFavorite: !p.isFavorite,
      updatedAt: new Date().toISOString(),
    }));
  }, [upsertPoemProgress]);

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

  
  const hardNuke = useCallback(async () => {
    if (!userRef.current) return;
    const confirm1 = window.confirm("⚠️ 警告：你确定要彻底清空所有的学习进度吗？此操作不可逆！");
    if (!confirm1) return;
    
    try {
      await supabase
        .from("user_progress")
        .delete()
        .eq("user_id", userRef.current.id);
      
      localStorage.removeItem("fengyuqing_v1");
      const fresh = defaultStore();
      _setStore(fresh);
      saveStore(fresh);
      alert("已成功清空所有学习记录。");
    } catch (e) {
      console.error(e);
      alert("清空失败");
    }
  }, []);

  
  const saveCustomPoem = useCallback((poem: any) => {
    if (typeof window === "undefined") return;
    try {
      const customPoemsStr = localStorage.getItem("fengyuqing_custom_poems_v1");
      let customPoems = [];
      if (customPoemsStr) {
        customPoems = JSON.parse(customPoemsStr);
      }
      const existingIdx = customPoems.findIndex((p: any) => p.t === poem.t && p.a === poem.a);
      if (existingIdx !== -1) {
        customPoems[existingIdx] = poem;
      } else {
        customPoems.push(poem);
      }
      localStorage.setItem("fengyuqing_custom_poems_v1", JSON.stringify(customPoems));
      import("./dbSearch").then(db => {
        db.addCustomPoemsToWorker([poem]).then(() => {
          db.getWorkerPoemCount().then(cnt => {
            if (cnt > 0) setWorkerTotalCount(cnt);
          });
        });
      });

      if (userRef.current) {
        supabase.from("user_custom_poems").upsert({
          user_id: userRef.current.id,
          poem_id: `${poem.t}:${poem.a}`,
          title: poem.t,
          author: poem.a,
          dynasty: poem.d || "",
          content: poem.content || [],
          note: poem.note || "",
          trans: poem.trans || "",
          shangxi: poem.shangxi || "",
          tags: poem.tags || [],
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,poem_id" }).then(({ error }) => {
          if (error) console.warn("Failed to upload custom poem to cloud:", error);
        });
      }
    } catch (e) {
      console.error("Error saving custom poem", e);
    }
  }, []);

  const [workerTotalCount, setWorkerTotalCount] = useState<number | undefined>(undefined);
  const [overview, setOverview] = useState({ total: 0, level3plus: 0, level5: 0, dueToday: 0, favorites: 0, loaded: false });

  // Sync worker exact poem count once loaded
  useEffect(() => {
    if (typeof window !== "undefined") return;
    import("./dbSearch").then(db => {
      db.getWorkerPoemCount().then(cnt => {
        if (cnt > 0) setWorkerTotalCount(cnt);
      });
    });
  }, []);

  // Re-compute overview whenever store or worker count changes (after hydration)
  useEffect(() => {
    if (!hydrated) return;
    const ov = getOverview(store, workerTotalCount);
    setOverview({ ...ov, loaded: true });
  }, [store, hydrated, workerTotalCount]);

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
      toggleFavorite,
      upsertPoemProgress,
      getPoemProgress,
      deletePoemProgress,
      logout,
      saveCustomPoem,
      hardNuke,
    }),
    [store, loaded, overview, user, syncing, setLevel, markPoemAnswered, toggleFavorite, upsertPoemProgress, getPoemProgress, deletePoemProgress, logout, saveCustomPoem, hardNuke]
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
