"use client";
import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, HelpCircle, Map, RotateCcw, Sparkles, X } from "lucide-react";
import { create } from "zustand";
import { FULL_TOUR, PAGE_NAMES, pageKey, pageSteps, type Step } from "@/lib/tour-steps";
import { Art } from "./tour-art";

/* ------------------------------------------------------------------ */
/* state                                                               */
/* ------------------------------------------------------------------ */
interface Seen { welcomed: boolean; pages: Record<string, true>; mute: boolean }
import { currentUserId } from "@/lib/store";
const keyFor = () => `books360.tour.v2.${currentUserId()}`;
const readSeen = (): Seen => {
  try {
    return { welcomed: false, pages: {}, mute: false, ...(JSON.parse(localStorage.getItem(keyFor()) || "{}") as Partial<Seen>) };
  } catch {
    return { welcomed: false, pages: {}, mute: false };
  }
};
const writeSeen = (s: Seen) => {
  try {
    localStorage.setItem(keyFor(), JSON.stringify(s));
  } catch {
    /* storage unavailable: tour simply shows again next time */
  }
};

interface TourState {
  active: boolean;
  mode: "full" | "page";
  steps: Step[];
  i: number;
  start: (mode: "full" | "page", steps: Step[]) => void;
  go: (i: number) => void;
  stop: () => void;
}
export const useTour = create<TourState>((set, get) => ({
  active: false,
  mode: "page",
  steps: [],
  i: 0,
  start: (mode, steps) => set({ active: true, mode, steps, i: 0 }),
  go: (i) => set({ i: Math.max(0, Math.min(get().steps.length - 1, i)) }),
  stop: () => set({ active: false }),
}));

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */
interface Rect { x: number; y: number; w: number; h: number }
const PAD = 8;

function useTargetRect(selector: string | undefined, active: boolean, stepKey: string) {
  const [rect, setRect] = useState<Rect | null>(null);
  const el = useRef<Element | null>(null);

  useEffect(() => {
    setRect(null);
    el.current = null;
    if (!active || !selector) return;
    let cancelled = false;
    let tries = 0;
    const find = () => {
      if (cancelled) return;
      const found = document.querySelector(selector);
      const visible = found && (found as HTMLElement).getBoundingClientRect().width > 0;
      if (visible) {
        el.current = found;
        const r = (found as HTMLElement).getBoundingClientRect();
        const vh = window.innerHeight;
        const mobile = window.innerWidth < 640;
        const fixed = getComputedStyle(found as HTMLElement).position === "fixed" || !!(found as HTMLElement).closest("nav[aria-label='Main'], header");
        if (!fixed) {
          const top = r.height > vh * 0.45 ? 90 : mobile ? 70 : (vh - r.height) / 2 - 20;
          window.scrollTo({ top: Math.max(0, window.scrollY + r.top - top), behavior: "smooth" });
        }
      } else if (tries++ < 25) {
        setTimeout(find, 100);
      }
    };
    find();
    return () => {
      cancelled = true;
    };
  }, [selector, active, stepKey]);

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const tick = () => {
      const n = el.current as HTMLElement | null;
      if (n && n.isConnected) {
        const r = n.getBoundingClientRect();
        setRect((p) => (p && Math.abs(p.x - r.left) < 0.5 && Math.abs(p.y - r.top) < 0.5 && Math.abs(p.w - r.width) < 0.5 && Math.abs(p.h - r.height) < 0.5 ? p : { x: r.left, y: r.top, w: r.width, h: r.height }));
      } else {
        setRect((p) => (p ? null : p));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, stepKey]);

  return rect;
}

/* ------------------------------------------------------------------ */
/* overlay                                                             */
/* ------------------------------------------------------------------ */
function Overlay() {
  const { active, steps, i, mode, go, stop } = useTour();
  const router = useRouter();
  const pathname = usePathname();
  const step = steps[i];
  const rect = useTargetRect(step?.target, active, step?.id ?? "");
  const card = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(260);
  const [vw, setVw] = useState(1200);
  const [vh, setVh] = useState(800);

  // navigate (full tour only) when the step lives on another page
  useEffect(() => {
    if (!active || mode !== "full" || !step?.path) return;
    const cur = window.location.pathname + window.location.search;
    const want = step.path;
    const same = want.includes("?") ? cur === want : window.location.pathname === want;
    if (!same) router.push(want);
  }, [active, mode, step?.id, step?.path, router, pathname]);

  useLayoutEffect(() => {
    if (!active) return;
    const m = () => {
      setVw(window.innerWidth);
      setVh(window.innerHeight);
      if (card.current) setH(card.current.offsetHeight);
    };
    m();
    window.addEventListener("resize", m);
    return () => window.removeEventListener("resize", m);
  }, [active, i, rect === null]);

  const finish = useCallback(() => {
    stop();
    if (mode === "full") router.push("/");
  }, [stop, mode, router]);

  useEffect(() => {
    if (!active) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") stop();
      else if (e.key === "ArrowRight" || e.key === "Enter") (i === steps.length - 1 ? finish() : go(i + 1));
      else if (e.key === "ArrowLeft") go(i - 1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [active, i, steps.length, go, stop, finish]);

  useEffect(() => {
    if (active) card.current?.focus({ preventScroll: true });
  }, [active, i]);

  if (!active || !step) return null;

  const mobile = vw < 640;
  const W = Math.min(380, vw - 24);
  let left = (vw - W) / 2;
  let top = (vh - h) / 2;
  let hole: Rect | null = null;
  if (rect) {
    hole = { x: rect.x - PAD, y: rect.y - PAD, w: rect.w + PAD * 2, h: rect.h + PAD * 2 };
    // work from the part of the target that is actually on screen
    const visTop = Math.max(hole.y, 0);
    const visBottom = Math.min(hole.y + hole.h, vh);
    if (mobile) {
      top = (visTop + visBottom) / 2 > vh / 2 ? 76 : vh - h - 16;
    } else {
      const below = vh - visBottom;
      const above = visTop;
      left = Math.min(Math.max(12, hole.x + hole.w / 2 - W / 2), vw - W - 12);
      if (below >= h + 20) top = visBottom + 14;
      else if (above >= h + 20) top = visTop - h - 14;
      else {
        // no room above or below: sit beside the target if possible, else dock above the nav bar
        const right = vw - (hole.x + hole.w);
        if (right >= W + 24) { left = hole.x + hole.w + 14; top = visTop; }
        else if (hole.x >= W + 24) { left = hole.x - W - 14; top = visTop; }
        else top = vh - h - 96;
      }
    }
  } else if (mobile) top = vh - h - 16;

  top = Math.min(Math.max(12, top), Math.max(12, vh - h - 12));

  const last = i === steps.length - 1;
  const first = i === 0;
  const hl = hole && { left: hole.x, top: hole.y, width: hole.w, height: hole.h };

  return (
    <div className="fixed inset-0 z-[95]" role="presentation">
      {/* dim + spotlight */}
      {hl ? (
        <div className="pointer-events-none fixed rounded-[26px] transition-all duration-300 ease-out" style={{ ...hl, boxShadow: "0 0 0 9999px rgba(36,24,14,.58), 0 0 0 2px rgba(255,255,255,.9), 0 0 32px 6px rgba(226,102,63,.35)" }} />
      ) : (
        <div className="fixed inset-0 bg-[#24180e]/60 backdrop-blur-[2px]" />
      )}
      {/* click-catcher so the page underneath stays still */}
      <div className="fixed inset-0" onClick={(e) => e.stopPropagation()} />

      <div
        ref={card}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Tour: ${step.title}`}
        aria-live="polite"
        className="glass pop-in fixed overflow-hidden rounded-[26px] outline-none transition-[top,left] duration-300"
        style={{ width: W, left, top, background: "rgba(251,247,242,.96)", transformOrigin: "center" }}
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-4">
          <span className="chip chip-neutral">{PAGE_NAMES[step.page] ?? "Tour"}</span>
          <button onClick={stop} aria-label="Skip tour" className="grid h-8 w-8 place-items-center rounded-full bg-black/5 hover:bg-black/10"><X size={15} /></button>
        </div>
        <div className="px-5 pb-1 pt-3">
          {step.art && <div className="mb-3.5 rounded-2xl bg-gradient-to-br from-[#efe4d8] to-[#e6d6c6] p-3.5"><Art k={step.art} /></div>}
          <h2 className="text-[17px] font-semibold leading-snug tracking-[-0.02em]">{step.title}</h2>
          <p className="muted mt-1.5 text-[13.5px] leading-relaxed" style={{ color: "rgba(21,21,21,.68)" }}>{step.body}</p>
        </div>
        <div className="flex items-center justify-between gap-2 px-5 pb-4 pt-3">
          <div className="flex items-center gap-1" aria-label={`Step ${i + 1} of ${steps.length}`}>
            {steps.length <= 14 ? steps.map((s, n) => <span key={s.id} className={`h-1.5 rounded-full transition-all ${n === i ? "w-4 bg-accent" : "w-1.5 bg-black/15"}`} />) : <span className="num muted text-xs">{i + 1} / {steps.length}</span>}
          </div>
          <div className="flex items-center gap-1.5">
            {!last && <button onClick={stop} className="h-9 rounded-full px-3 text-[13px] font-medium text-black/55 hover:text-ink">Skip</button>}
            {!first && <button onClick={() => go(i - 1)} aria-label="Previous step" className="grid h-9 w-9 place-items-center rounded-full bg-white hover:bg-white/70"><ChevronLeft size={16} /></button>}
            <button onClick={() => (last ? finish() : go(i + 1))} className="btn btn-dark btn-sm">{last ? "Done" : "Next"}{!last && <ChevronRight size={14} />}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* welcome + page offer                                                */
/* ------------------------------------------------------------------ */
function Prompts() {
  const path = usePathname();
  const tab = useSearchParams().get("tab");
  const key = pageKey(path, tab);
  const { active, start } = useTour();
  const [welcome, setWelcome] = useState(false);
  const [offer, setOffer] = useState<string | null>(null);

  useEffect(() => {
    const s = readSeen();
    if (!s.welcomed && !s.mute) {
      const t = setTimeout(() => setWelcome(true), 700);
      return () => clearTimeout(t);
    }
  }, []);

  // small, dismissible offer the first time each page is visited
  useEffect(() => {
    setOffer(null);
    if (active || welcome) return;
    const s = readSeen();
    if (!s.welcomed || s.mute || s.pages[key] || !pageSteps(key).length) return;
    const t = setTimeout(() => setOffer(key), 1200);
    return () => clearTimeout(t);
  }, [key, active, welcome]);

  const markPage = (k: string) => {
    const s = readSeen();
    s.pages[k] = true;
    writeSeen(s);
  };
  const closeWelcome = (mute = false) => {
    const s = readSeen();
    s.welcomed = true;
    s.mute = mute;
    s.pages[key] = true;
    writeSeen(s);
    setWelcome(false);
  };

  return (
    <>
      {welcome && !active && (
        <div className="fixed inset-0 z-[94] grid place-items-center bg-[#24180e]/55 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-label="Welcome" className="glass pop-in w-full max-w-md rounded-[30px] p-6" style={{ background: "rgba(251,247,242,.97)" }}>
            <div className="mb-4 flex items-center gap-2 text-accent"><Sparkles size={18} /><span className="text-sm font-semibold">Welcome to Books360</span></div>
            <div className="mb-4 rounded-2xl bg-gradient-to-br from-[#efe4d8] to-[#e6d6c6] p-4"><Art k="flow" /></div>
            <h2 className="text-[22px] font-semibold leading-tight tracking-[-0.025em]">Take a two-minute tour?</h2>
            <p className="mt-2 text-[14px]" style={{ color: "rgba(21,21,21,.66)" }}>We'll walk through each page with a real example: a ₦1,000,000 invoice with a discount and VAT, posted to the right accounts. You can skip any time.</p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <button className="btn btn-dark" onClick={() => { closeWelcome(); start("full", FULL_TOUR); }}><Map size={15} /> Start the tour</button>
              <button className="btn btn-light" onClick={() => closeWelcome()}>Skip for now</button>
            </div>
            <button className="muted mt-3 text-xs underline-offset-2 hover:underline" onClick={() => closeWelcome(true)}>Don't show tips again</button>
          </div>
        </div>
      )}

      {offer && !active && (
        <div className="glass pop-in no-print fixed bottom-24 left-3 z-[60] w-[min(320px,calc(100vw-24px))] rounded-3xl p-4 sm:left-5" style={{ background: "rgba(251,247,242,.95)", transformOrigin: "bottom left" }} role="complementary" aria-label="Page tour">
          <p className="text-sm font-semibold">New to {PAGE_NAMES[offer]}?</p>
          <p className="muted mt-0.5 text-[13px]">A quick look at what everything does.</p>
          <div className="mt-3 flex gap-2">
            <button className="btn btn-dark btn-sm" onClick={() => { markPage(offer); setOffer(null); start("page", pageSteps(offer)); }}>Show me</button>
            <button className="btn btn-light btn-sm" onClick={() => { markPage(offer); setOffer(null); }}>No thanks</button>
          </div>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* public pieces                                                       */
/* ------------------------------------------------------------------ */
export function TourLayer() {
  return (
    <Suspense>
      <Prompts />
      <Overlay />
    </Suspense>
  );
}

function HelpInner() {
  const path = usePathname();
  const tab = useSearchParams().get("tab");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { start } = useTour();
  const key = pageKey(path, tab);
  const steps = pageSteps(key);

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref} data-tour="help">
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Help and tours" className="grid h-10 w-10 place-items-center rounded-full bg-white/60 hover:bg-white">
        <HelpCircle size={17} />
      </button>
      {open && (
        <div className="glass pop-in absolute right-0 top-12 z-50 w-[270px] rounded-3xl p-1.5" style={{ background: "rgba(250,246,241,.96)" }}>
          <button disabled={!steps.length} onClick={() => { setOpen(false); start("page", steps); }} className="flex w-full items-start gap-3 rounded-2xl px-3.5 py-2.5 text-left text-sm hover:bg-white disabled:opacity-40">
            <Sparkles size={16} className="mt-0.5 flex-none text-accent" />
            <span><b className="block font-semibold">Tour this page</b><span className="muted text-xs">{PAGE_NAMES[key]} · {steps.length} steps</span></span>
          </button>
          <button onClick={() => { setOpen(false); start("full", FULL_TOUR); }} className="flex w-full items-start gap-3 rounded-2xl px-3.5 py-2.5 text-left text-sm hover:bg-white">
            <Map size={16} className="mt-0.5 flex-none text-teal-deep" />
            <span><b className="block font-semibold">Full walkthrough</b><span className="muted text-xs">Every page, about 3 minutes</span></span>
          </button>
          <button onClick={() => { writeSeen({ welcomed: true, pages: {}, mute: false }); setOpen(false); }} className="flex w-full items-start gap-3 rounded-2xl px-3.5 py-2.5 text-left text-sm hover:bg-white">
            <RotateCcw size={16} className="mt-0.5 flex-none" />
            <span><b className="block font-semibold">Show page tips again</b><span className="muted text-xs">Offers a tour on each page you open</span></span>
          </button>
        </div>
      )}
    </div>
  );
}
export function HelpMenu() {
  return (
    <Suspense>
      <HelpInner />
    </Suspense>
  );
}
