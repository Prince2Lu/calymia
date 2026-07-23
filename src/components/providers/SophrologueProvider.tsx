"use client";

import { createContext, useContext } from "react";
import type { SophrologueSessionInfo } from "@/lib/auth/sophrologue-session";

const SophrologueContext = createContext<SophrologueSessionInfo | null>(null);

export function SophrologueProvider({
  sophrologue,
  children,
}: {
  sophrologue: SophrologueSessionInfo;
  children: React.ReactNode;
}) {
  return (
    <SophrologueContext.Provider value={sophrologue}>
      {children}
    </SophrologueContext.Provider>
  );
}

export function useSophrologue(): SophrologueSessionInfo {
  const value = useContext(SophrologueContext);
  if (!value) {
    throw new Error("useSophrologue must be used within SophrologueProvider");
  }
  return value;
}

export function useSophrologueOptional(): SophrologueSessionInfo | null {
  return useContext(SophrologueContext);
}
