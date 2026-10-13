"use client";

import { useEffect, useRef, useState } from "react";
import { ExamClock } from "./clock";

/** Creates one ExamClock per mount and keeps it in sync with page visibility. */
export function useExamClock(): ExamClock {
  const [clock] = useState(() => new ExamClock());
  useEffect(() => {
    const onVis = () => (document.visibilityState === "hidden" ? clock.onHidden() : clock.onVisible());
    const onHide = () => clock.onHidden();
    const onShow = () => clock.onVisible();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onHide);
    window.addEventListener("pageshow", onShow);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("pageshow", onShow);
    };
  }, [clock]);
  return clock;
}

/** Desktop keyboard shortcuts. Ignores keys typed into inputs unless allowInInputs. */
export function useHotkeys(handler: (e: KeyboardEvent) => void, deps: unknown[], allowInInputs: string[] = ["Enter"]) {
  const h = useRef(handler);
  useEffect(() => {
    h.current = handler;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (typing && !allowInInputs.includes(e.key)) return;
      h.current(e);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}


/**
 * Calls `fn` roughly every `everyMs` (rAF-driven, plus a 1 s interval and visibility events so
 * backgrounded tabs catch up immediately). `fn` reads time from an ExamClock, never from tick counts.
 */
export function useTick(fn: () => void, everyMs = 200, active = true) {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = -Infinity;
    const loop = () => {
      const t = performance.now();
      if (t - last >= everyMs) {
        last = t;
        ref.current();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const iv = window.setInterval(() => ref.current(), 1000);
    const onVis = () => ref.current();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pageshow", onVis);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pageshow", onVis);
    };
  }, [everyMs, active]);
}
