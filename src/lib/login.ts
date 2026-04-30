/**
 * Discord login: UUID-based user identity
 *
 * Flow:
 *  1. Frontend generates a UUID on first visit → stored in localStorage
 *  2. User sends /绑定 <uuid> in Discord bot DM
 *  3. Bot records the mapping uuid → discord_id in SQLite
 *  4. Cross-device: export JSON (contains uuid), import on new device,
 *     then re-bind via Discord.
 */

"use client";

import { useState, useEffect, useCallback } from "react";

const UUID_KEY = "fengyuqing_uuid";
const DISCORD_ID_KEY = "fengyuqing_discord_id";

function getOrCreateUUID(): string {
  if (typeof window === "undefined") return "";
  let uuid = localStorage.getItem(UUID_KEY);
  if (!uuid) {
    uuid =
      (typeof crypto !== "undefined" && crypto.randomUUID?.())
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) +
          Date.now().toString(36) +
          Math.random().toString(36).slice(2);
    localStorage.setItem(UUID_KEY, uuid);
  }
  return uuid;
}

export function useLogin() {
  const [uuid, setUuid] = useState<string>("");
  const [discordId, setDiscordId] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUuid(getOrCreateUUID());
    setDiscordId(localStorage.getItem(DISCORD_ID_KEY) ?? "");
  }, []);

  // Re-check localStorage when the tab becomes visible again (handles Discord
  // binding that happened in a separate browser context / manual copy-paste)
  useEffect(() => {
    const onVisible = () => {
      setDiscordId(localStorage.getItem(DISCORD_ID_KEY) ?? "");
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const copyUUID = useCallback(() => {
    if (!uuid) return;
    navigator.clipboard.writeText(uuid).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [uuid]);

  const bindDiscord = useCallback((id: string) => {
    localStorage.setItem(DISCORD_ID_KEY, id);
    setDiscordId(id);
  }, []);

  return { uuid, discordId, copyUUID, copied, bindDiscord };
}
