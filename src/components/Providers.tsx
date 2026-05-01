"use client";

import { UserProvider } from "@/lib/userContext";
import { PoemsProvider } from "@/components/PoemsContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <PoemsProvider>{children}</PoemsProvider>
    </UserProvider>
  );
}
