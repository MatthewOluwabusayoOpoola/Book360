"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Bell, Database, FileText, Home, PieChart, Plus, Receipt, Search, Settings, Sparkles, Users, Zap, Percent, BookOpen, AlertTriangle } from "lucide-react";
import { useBooks } from "@/lib/store";
import { mappingIssues, balanceDue, todayISO, MAPPING_META } from "@/lib/engine";
import { Toaster } from "./ui";
import { HelpMenu, TourLayer } from "./tour";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/activity", label: "Activity" },
  { href: "/manage", label: "Manage" },
  { href: "/journal", label: "Journal" },
  { href: "/contacts", label: "Contacts" },
  { href: "/reports", label: "Reports" },
];

const RAIL = [
  { href: "/", label: "Overview", icon: Home },
  { href: "/activity", label: "Activity", icon: Zap },
  { href: "/manage?tab=accounts", label: "Chart of accounts", icon: Database, match: "/manage" },
  { href: "/manage?tab=tax", label: "Tax & discounts", icon: Percent, match: "/manage-tax" },
  { href: "/reports", label: "Reports", icon: PieChart },
  { href: "/settings", label: "Settings", icon: Settings },
];

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return { open, setOpen, ref };
}

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const books = useBooks((s) => s.books);
  const router = useRouter();
  const quick = usePopover();
  const bell = usePopover();
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  const [hi, setHi] = useState(0);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    const out: { label: string; sub: string; href: string }[] = [];
    const contact = new Map(books.contacts.map((c) => [c.id, c.name]));
    NAV.forEach((n) => n.label.toLowerCase().includes(t) && out.push({ label: n.label, sub: "Page", href: n.href }));
    books.docs.forEach((d) => {
      const name = contact.get(d.contactId) ?? "";
      if (d.number.toLowerCase().includes(t) || name.toLowerCase().includes(t))
        out.push({ label: `${d.number} · ${name || "No contact"}`, sub: d.type === "invoice" ? "Invoice" : "Bill", href: `/activity/${d.id}` });
    });
    books.accounts.forEach((a) => (a.name.toLowerCase().includes(t) || a.code.includes(t)) && out.push({ label: `${a.code} ${a.name}`, sub: "Account", href: `/journal?account=${a.id}` }));
    books.contacts.forEach((c) => c.name.toLowerCase().includes(t) && out.push({ label: c.name, sub: "Contact", href: "/contacts" }));
    return out.slice(0, 7);
  }, [q, books]);

  const alerts = useMemo(() => {
    const today = todayISO();
    const list: { text: string; href: string; tone: "rose" | "amber" }[] = [];
    const issues = mappingIssues(books);
    issues.forEach((i) => list.push({ text: `${MAPPING_META.find((m) => m.key === i.key)?.label}: ${i.reason.toLowerCase()}`, href: "/manage?tab=mapping", tone: "rose" }));
    const overdue = books.docs.filter((d) => d.type === "invoice" && (d.status === "posted") && d.dueDate < today && balanceDue(d) > 0.005);
    if (overdue.length) list.push({ text: `${overdue.length} invoice${overdue.length > 1 ? "s are" : " is"} overdue`, href: "/activity?filter=overdue", tone: "amber" });
    const drafts = books.docs.filter((d) => d.status === "draft");
    if (drafts.length) list.push({ text: `${drafts.length} draft${drafts.length > 1 ? "s" : ""} waiting to be posted`, href: "/activity?filter=draft", tone: "amber" });
    return list;
  }, [books]);

  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <div className="min-h-dvh px-3 pb-28 pt-3 sm:px-5 sm:pt-4">
      {/* top bar */}
      <header className="glass no-print relative z-40 mx-auto flex h-14 max-w-[1280px] items-center gap-3 rounded-full px-2.5 sm:h-[58px]">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-ink text-[15px] font-semibold text-white">{books.settings.userName.slice(0, 1).toUpperCase()}</span>
          <span className="hidden truncate text-[15px] font-semibold sm:block">Welcome, {books.settings.userName}</span>
        </div>

        <div data-tour="search" className="relative mx-auto min-w-0 max-w-[460px] flex-1">
          <div className="flex h-10 items-center gap-2.5 rounded-full bg-white/45 px-2 pr-4">
            <span className="h-6 w-6 flex-none rounded-full" style={{ background: "radial-gradient(circle at 35% 30%, #fff, #b9a3ff 45%, #6a4de0)" }} aria-hidden />
            <Search size={14} className="muted flex-none" aria-hidden />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setHi(0);
              }}
              onFocus={() => setFocus(true)}
              onBlur={() => setTimeout(() => setFocus(false), 120)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") (e.preventDefault(), setHi((h) => Math.min(h + 1, results.length - 1)));
                if (e.key === "ArrowUp") (e.preventDefault(), setHi((h) => Math.max(h - 1, 0)));
                if (e.key === "Enter" && results[hi]) {
                  router.push(results[hi].href);
                  setQ("");
                  (e.target as HTMLInputElement).blur();
                }
                if (e.key === "Escape") (e.target as HTMLInputElement).blur();
              }}
              placeholder="Find an invoice, account or contact…"
              aria-label="Search"
              className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-black/45"
            />
          </div>
          {focus && q.trim() && (
            <div className="glass pop-in absolute left-0 right-0 top-12 overflow-hidden rounded-3xl p-1.5" style={{ background: "rgba(250,246,241,.92)" }} role="listbox">
              {results.length === 0 && <p className="muted px-3 py-3 text-sm">No match for “{q}”.</p>}
              {results.map((r, i) => (
                <Link key={r.href + r.label} href={r.href} onClick={() => setQ("")} role="option" aria-selected={i === hi} className={`flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-sm ${i === hi ? "bg-white" : "hover:bg-white/60"}`}>
                  <span className="truncate">{r.label}</span>
                  <span className="muted flex-none text-xs">{r.sub}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <HelpMenu />

        <div className="relative" ref={bell.ref} data-tour="bell">
          <button onClick={() => bell.setOpen(!bell.open)} aria-label={`Notifications${alerts.length ? `, ${alerts.length} new` : ""}`} aria-expanded={bell.open} className="relative grid h-10 w-10 place-items-center rounded-full bg-white">
            <Bell size={17} />
            {alerts.length > 0 && <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-accent ring-2 ring-white" />}
          </button>
          {bell.open && (
            <div className="glass pop-in absolute right-0 top-12 w-[320px] rounded-3xl p-2" style={{ background: "rgba(250,246,241,.94)" }}>
              <p className="px-3 pb-1 pt-2 text-[13px] font-semibold">Needs attention</p>
              {alerts.length === 0 && <p className="muted px-3 py-3 text-sm">You're all caught up.</p>}
              {alerts.map((a) => (
                <Link key={a.text} href={a.href} onClick={() => bell.setOpen(false)} className="flex items-start gap-2.5 rounded-2xl px-3 py-2.5 text-sm hover:bg-white/70">
                  <AlertTriangle size={15} className={`mt-0.5 flex-none ${a.tone === "rose" ? "text-rose-fg" : "text-amber-fg"}`} />
                  {a.text}
                </Link>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* rail */}
      <nav aria-label="Shortcuts" className="glass no-print fixed left-5 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-1 rounded-full p-2 lg:flex">
        {RAIL.map((r) => {
          const Icon = r.icon;
          const active = r.href === "/" ? path === "/" : r.href.startsWith("/manage") ? false : path.startsWith(r.href);
          return (
            <Link key={r.label} href={r.href} aria-label={r.label} className={`group relative grid h-11 w-11 place-items-center rounded-full transition ${active ? "bg-white shadow" : "hover:bg-white/50"}`}>
              <Icon size={18} strokeWidth={active ? 2.4 : 1.9} />
              <span className="pointer-events-none absolute left-14 z-50 hidden whitespace-nowrap rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-white group-hover:block group-focus-visible:block">{r.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* sheet */}
      <main className="glass sheet sheet-in relative z-10 mx-auto w-full mt-4 max-w-[1280px] px-4 pb-24 pt-8 sm:px-8 sm:pt-9 lg:pl-20">{children}</main>

      {/* bottom nav */}
      <nav aria-label="Main" className="no-print fixed inset-x-0 bottom-4 z-40 flex justify-center px-3">
        <div className="flex max-w-full items-center gap-2">
          <div data-tour="nav" className="scroll-thin flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full p-1.5" style={{ background: "rgba(150,126,102,.5)", backdropFilter: "blur(22px) saturate(1.2)", WebkitBackdropFilter: "blur(22px) saturate(1.2)", border: "1px solid rgba(255,255,255,.35)" }}>
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} aria-current={isActive(n.href) ? "page" : undefined} className={`h-10 flex-none rounded-full px-4 text-[13.5px] font-medium leading-10 transition sm:px-[22px] ${isActive(n.href) ? "bg-white text-ink shadow" : "text-white/90 hover:text-white"}`}>
                {n.label}
              </Link>
            ))}
          </div>
          <div className="relative" ref={quick.ref} data-tour="quick">
            <button onClick={() => quick.setOpen(!quick.open)} aria-label="Create new" aria-expanded={quick.open} className="grid h-[52px] w-[52px] place-items-center rounded-full bg-white shadow-lg transition hover:scale-105">
              <Plus size={20} className={`transition ${quick.open ? "rotate-45" : ""}`} />
            </button>
            {quick.open && (
              <div className="glass pop-in absolute bottom-16 right-0 w-56 rounded-3xl p-1.5" style={{ background: "rgba(250,246,241,.95)", transformOrigin: "bottom right" }}>
                {[
                  { href: "/activity/new?type=invoice", label: "New invoice", icon: FileText },
                  { href: "/activity/new?type=bill", label: "New bill", icon: Receipt },
                  { href: "/journal?new=1", label: "Journal entry", icon: BookOpen },
                  { href: "/manage?tab=accounts&new=1", label: "New account", icon: Database },
                  { href: "/contacts?new=1", label: "New contact", icon: Users },
                ].map((i) => (
                  <Link key={i.label} href={i.href} onClick={() => quick.setOpen(false)} className="flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium hover:bg-white">
                    <i.icon size={16} /> {i.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </nav>
      <Toaster />
      <TourLayer />
    </div>
  );
}

export function BooksGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    Promise.resolve(useBooks.persist.rehydrate()).finally(() => setReady(true));
  }, []);
  if (!ready)
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="glass flex items-center gap-3 rounded-full px-5 py-3 text-sm font-medium">
          <Sparkles size={16} className="text-accent" /> Opening your books…
        </div>
      </div>
    );
  return <Shell>{children}</Shell>;
}
