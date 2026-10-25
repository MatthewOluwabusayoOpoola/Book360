"use client";
import { useCallback, useMemo } from "react";
import { money } from "./format";
import { useBooks } from "./store";
import { todayISO } from "./engine";

export function useFmt() {
  const s = useBooks((x) => x.books.settings);
  const fmt = useCallback((n: number) => money(n, s.currency, s.locale), [s.currency, s.locale]);
  const compact = useCallback((n: number) => money(n, s.currency, s.locale, true), [s.currency, s.locale]);
  return useMemo(() => ({ fmt, compact, settings: s }), [fmt, compact, s]);
}

export const useToday = () => useMemo(() => todayISO(), []);
