"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { create } from "zustand";
import { X, Check, AlertCircle } from "lucide-react";
import type { DocStatus } from "@/lib/types";

/* ---------- toast ---------- */
interface ToastState {
  items: { id: number; text: string; tone: "ok" | "error" }[];
  push: (text: string, tone?: "ok" | "error") => void;
}
let tid = 0;
export const useToast = create<ToastState>((set) => ({
  items: [],
  push: (text, tone = "ok") => {
    const id = ++tid;
    set((s) => ({ items: [...s.items, { id, text, tone }] }));
    setTimeout(() => set((s) => ({ items: s.items.filter((i) => i.id !== id) })), 3200);
  },
}));
export const toast = (t: string, tone: "ok" | "error" = "ok") => useToast.getState().push(t, tone);

export function Toaster() {
  const items = useToast((s) => s.items);
  return (
    <div className="fixed bottom-24 left-1/2 z-[80] flex -translate-x-1/2 flex-col items-center gap-2" role="status" aria-live="polite">
      {items.map((i) => (
        <div key={i.id} className="pop-in flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-white shadow-xl">
          {i.tone === "ok" ? <Check size={15} className="text-[#7fe0b8]" /> : <AlertCircle size={15} className="text-[#ff9a86]" />}
          {i.text}
        </div>
      ))}
    </div>
  );
}

/* ---------- layout bits ---------- */
export function PageHeader({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[34px] font-semibold leading-[1.1] tracking-[-0.03em] md:text-[40px]">{title}</h1>
        {sub && <p className="muted mt-2 max-w-xl text-[15px]">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2.5">{children}</div>}
    </div>
  );
}

export function Card({ className = "", children, title, action, id, tour }: { className?: string; children: ReactNode; title?: ReactNode; action?: ReactNode; id?: string; tour?: string }) {
  return (
    <section id={id} data-tour={tour} className={`glass card p-5 md:p-6 ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function IconBadge({ children, tone = "accent" }: { children: ReactNode; tone?: "accent" | "teal" | "ink" | "violet" | "white" }) {
  const t = {
    accent: "bg-[#fbe3da] text-accent",
    teal: "bg-[#d9f0e8] text-teal-deep",
    ink: "bg-[#e6e3df] text-ink",
    violet: "bg-[#e6e2fb] text-[#5a47d6]",
    white: "bg-white/25 text-white",
  }[tone];
  return <span className={`grid h-9 w-9 flex-none place-items-center rounded-full ${t}`}>{children}</span>;
}

export function Chip({ tone = "neutral", children }: { tone?: "mint" | "rose" | "amber" | "neutral"; children: ReactNode }) {
  return <span className={`chip chip-${tone}`}>{children}</span>;
}

const STATUS: Record<DocStatus, { label: string; dot: string }> = {
  draft: { label: "Draft", dot: "bg-black/30" },
  posted: { label: "Posted", dot: "bg-[#e4a11b]" },
  paid: { label: "Paid", dot: "bg-[#2fa36f]" },
  void: { label: "Void", dot: "bg-[#d0493a]" },
};
export function StatusDot({ status, overdue }: { status: DocStatus; overdue?: boolean }) {
  const s = overdue ? { label: "Overdue", dot: "bg-[#d0493a]" } : STATUS[status];
  return (
    <span className="inline-flex items-center gap-2 text-[13px]">
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

export function Delta({ value, invert = false, suffix = "vs last month" }: { value: number | null; invert?: boolean; suffix?: string }) {
  if (value === null || !isFinite(value)) return <span className="muted text-xs">{suffix}</span>;
  const up = value >= 0;
  const good = invert ? !up : up;
  return (
    <span className="flex items-center gap-1.5 text-xs">
      <span className={`chip ${good ? "chip-mint" : "chip-rose"}`}>
        {up ? "↑" : "↓"} {Math.abs(value).toFixed(0)}%
      </span>
      <span className="muted">{suffix}</span>
    </span>
  );
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="tile-flat flex flex-col items-center gap-2 px-6 py-10 text-center">
      <p className="text-[15px] font-semibold">{title}</p>
      {hint && <p className="muted max-w-sm text-sm">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* ---------- form bits ---------- */
export function Field({ label, hint, error, children, className = "" }: { label: string; hint?: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[13px] font-medium">{label}</span>
      {children}
      {error ? <span className="text-xs text-rose-fg">{error}</span> : hint ? <span className="muted text-xs">{hint}</span> : null}
    </label>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className="toggle" onClick={() => onChange(!checked)} />;
}

export function Segmented<T extends string>({ value, onChange, options, label, tour }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string; tour?: string }) {
  return (
    <div data-tour={tour} role="tablist" aria-label={label} className="inline-flex rounded-full bg-black/10 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`h-8 rounded-full px-4 text-[13px] font-medium transition ${value === o.value ? "bg-ink text-white" : "text-black/55 hover:text-black"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ErrorList({ errors }: { errors: string[] }) {
  if (!errors.length) return null;
  return (
    <ul className="rounded-2xl bg-rose-bg px-4 py-3 text-[13px] text-rose-fg" role="alert">
      {errors.map((e) => (
        <li key={e} className="flex gap-2">
          <AlertCircle size={15} className="mt-0.5 flex-none" />
          {e}
        </li>
      ))}
    </ul>
  );
}

/* ---------- modal ---------- */
export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    setTimeout(() => ref.current?.querySelector<HTMLElement>("input, select, textarea")?.focus(), 30);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-[#2a1d12]/35 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={`glass pop-in flex max-h-[90dvh] w-full flex-col rounded-[30px] bg-white/70 ${wide ? "max-w-3xl" : "max-w-lg"}`} style={{ background: "rgba(250,246,241,.86)" }}>
        <header className="flex items-center justify-between px-6 pb-2 pt-5">
          <h2 className="text-lg font-semibold tracking-[-0.02em]">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-black/5 hover:bg-black/10">
            <X size={16} />
          </button>
        </header>
        <div className="scroll-thin flex-1 overflow-y-auto px-6 py-3">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2.5 px-6 pb-5 pt-3">{footer}</footer>}
      </div>
    </div>
  );
}

export function Confirm({ open, title, body, confirmLabel, onConfirm, onClose, danger }: { open: boolean; title: string; body: string; confirmLabel: string; onConfirm: () => void; onClose: () => void; danger?: boolean }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button className="btn btn-light" onClick={onClose}>
            Cancel
          </button>
          <button
            className={`btn ${danger ? "btn-danger" : "btn-dark"}`}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="muted text-[15px]">{body}</p>
    </Modal>
  );
}

/* number input that keeps what you type ("12." stays "12.") and commits numbers */
import { useState } from "react";
export function NumInput({ value, onChange, className = "", min, step = "any", ariaLabel, placeholder }: { value: number; onChange: (n: number) => void; className?: string; min?: number; step?: string; ariaLabel?: string; placeholder?: string }) {
  const [text, setText] = useState<string | null>(null);
  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={ariaLabel}
      placeholder={placeholder}
      className={`field num ${className}`}
      value={text ?? (value === 0 ? "" : String(value))}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const t = e.target.value.replace(/,/g, "");
        if (!/^\d*\.?\d{0,4}$/.test(t)) return;
        setText(t);
        const n = parseFloat(t);
        onChange(Number.isFinite(n) ? (min !== undefined ? Math.max(min, n) : n) : 0);
      }}
      onBlur={() => setText(null)}
      data-step={step}
    />
  );
}
