"use client";
import Link from "next/link";
import { useMemo } from "react";
import { ArrowDownLeft, ArrowUpRight, Landmark, Wallet, FileText, Receipt, ShieldCheck, Scale, ChevronRight } from "lucide-react";
import { useBooks } from "@/lib/store";
import { useFmt, useToday } from "@/lib/hooks";
import { accountBalance, addDays, mappingIssues, MAPPING_META, r2, sums } from "@/lib/engine";
import { cashAccounts, isOverdue, liveDocs, monthlySeries, outstanding, profitAndLoss } from "@/lib/reports";
import { monthLabel, dateLabel } from "@/lib/format";
import { Card, Chip, Delta, Empty, IconBadge, StatusDot } from "@/components/ui";
import { ColumnChart, HatchBar, Ring } from "@/components/charts";

const pctChange = (cur: number, prev: number) => (prev === 0 ? null : ((cur - prev) / Math.abs(prev)) * 100);

export default function Overview() {
  const books = useBooks((s) => s.books);
  const { fmt, compact, settings } = useFmt();
  const today = useToday();

  const d = useMemo(() => {
    const ym = today.slice(0, 7);
    const prev = new Date(today + "T12:00:00");
    prev.setDate(1);
    prev.setMonth(prev.getMonth() - 1);
    const pym = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
    const thisM = profitAndLoss(books, { from: `${ym}-01`, to: `${ym}-31` });
    const lastM = profitAndLoss(books, { from: `${pym}-01`, to: `${pym}-31` });
    const cash = cashAccounts(books);
    const total = r2(cash.reduce((s, c) => s + c.balance, 0));
    const lastEnd = sums(books, { to: `${pym}-31` });
    const totalPrev = r2(cash.reduce((s, c) => s + accountBalance(c.account, lastEnd), 0));
    const billed = r2(liveDocs(books).filter((x) => x.type === "invoice" && x.date.startsWith(ym)).reduce((s, x) => s + x.snapshot!.total, 0));
    const collected = r2(
      books.docs
        .filter((x) => x.type === "invoice")
        .flatMap((x) => x.payments)
        .filter((p) => p.date.startsWith(ym))
        .reduce((s, p) => s + p.amount, 0),
    );
    const series = monthlySeries(books, today, 8);
    const recent = [...books.docs].sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number)).slice(0, 6);
    return {
      thisM, lastM, cash, total, totalPrev, billed, collected, series, recent,
      ar: outstanding(books, "invoice"),
      ap: outstanding(books, "bill"),
      overdue: books.docs.filter((x) => x.type === "invoice" && isOverdue(x, today)).length,
      issues: mappingIssues(books),
    };
  }, [books, today]);

  const contact = (id: string) => books.contacts.find((c) => c.id === id)?.name ?? "—";
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const collectPct = d.billed > 0 ? Math.min(100, (d.collected / d.billed) * 100) : 0;
  const mapped = MAPPING_META.length - d.issues.length;

  return (
    <>
      <div className="mb-7">
        <h1 className="text-[34px] font-semibold leading-[1.1] tracking-[-0.03em] md:text-[42px]">
          {greet}, {settings.userName}
        </h1>
        <p className="muted mt-2 text-[15px]">
          {books.docs.length === 0 ? "Your books are empty. Create an invoice to see them come alive." : `${settings.companyName} · ${d.overdue ? `${d.overdue} overdue invoice${d.overdue > 1 ? "s" : ""} to chase` : "nothing overdue"}.`}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* balance */}
        <Card tour="balance" className="lg:col-span-5" title="Cash & bank balance">
          <div className="num text-[38px] font-semibold leading-none tracking-[-0.03em] md:text-[44px]">{fmt(d.total)}</div>
          <div className="mt-3">
            <Delta value={pctChange(d.total, d.totalPrev)} suffix="than last month" />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Link href="/activity/new?type=invoice" className="btn btn-dark"><ArrowDownLeft size={16} /> New invoice</Link>
            <Link href="/activity/new?type=bill" className="btn btn-light"><ArrowUpRight size={16} /> New bill</Link>
          </div>
          <div className="tile mt-5 p-3.5">
            <p className="mb-3 text-[13px] font-medium">
              Accounts <span className="muted">| {d.cash.length} bank &amp; cash</span>
            </p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {d.cash.slice(0, 3).map((c) => (
                <Link key={c.account.id} href={`/journal?account=${c.account.id}`} className="tile-flat p-3 transition hover:bg-white">
                  <div className="flex items-center gap-2 text-[13px] font-semibold">
                    {c.account.subtype === "cash" ? <Wallet size={14} /> : <Landmark size={14} />}
                    <span className="truncate">{c.account.name}</span>
                  </div>
                  <div className="num mt-2 text-[15px] font-semibold">{compact(c.balance)}</div>
                  <div className="mt-1 text-[11px] text-mint-fg">Active</div>
                </Link>
              ))}
              {d.cash.length === 0 && <p className="muted col-span-3 text-sm">Mark an account as bank or cash in the chart of accounts.</p>}
            </div>
          </div>
        </Card>

        {/* tiles */}
        <div data-tour="kpis" className="grid grid-cols-2 gap-4 lg:col-span-4">
          <div className="teal-card card p-4">
            <div className="flex items-center justify-between text-[13px] text-white/90">
              Revenue
              <span className="grid h-7 w-7 place-items-center rounded-full bg-white/25"><ArrowDownLeft size={14} /></span>
            </div>
            <div className="num mt-4 text-[26px] font-semibold tracking-[-0.02em]">{compact(d.thisM.totalRevenue)}</div>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-white/90">
              <span className="chip bg-white/25 text-white">{(() => { const p = pctChange(d.thisM.totalRevenue, d.lastM.totalRevenue); return p === null ? "new" : `${p >= 0 ? "↑" : "↓"} ${Math.abs(p).toFixed(0)}%`; })()}</span> this month
            </div>
          </div>
          <div className="glass card p-4">
            <div className="flex items-center justify-between text-[13px]">
              Expenses
              <span className="grid h-7 w-7 place-items-center rounded-full bg-white"><ArrowUpRight size={14} /></span>
            </div>
            <div className="num mt-4 text-[26px] font-semibold tracking-[-0.02em]">{compact(d.thisM.totalExpenses)}</div>
            <div className="mt-3"><Delta value={pctChange(d.thisM.totalExpenses, d.lastM.totalExpenses)} invert suffix="this month" /></div>
          </div>
          <div className="glass card p-4">
            <div className="flex items-center justify-between text-[13px]">
              Receivables
              <span className="grid h-7 w-7 place-items-center rounded-full bg-white"><FileText size={14} /></span>
            </div>
            <div className="num mt-4 text-[26px] font-semibold tracking-[-0.02em]">{compact(d.ar)}</div>
            <div className="mt-3 text-xs">{d.overdue ? <Chip tone="rose">{d.overdue} overdue</Chip> : <Chip tone="mint">All current</Chip>}</div>
          </div>
          <div className="glass card p-4">
            <div className="flex items-center justify-between text-[13px]">
              Payables
              <span className="grid h-7 w-7 place-items-center rounded-full bg-white"><Receipt size={14} /></span>
            </div>
            <div className="num mt-4 text-[26px] font-semibold tracking-[-0.02em]">{compact(d.ap)}</div>
            <div className="muted mt-3 text-xs">owed to vendors</div>
          </div>
        </div>

        {/* chart */}
        <Card tour="profit-chart" className="lg:col-span-3" title="Profit & expenses">
          <p className="muted -mt-2 mb-3 text-[13px]">Last 8 months</p>
          <div className="tile p-3.5">
            <div className="mb-3 flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-[2px] bg-teal" />Profit</span>
              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-[2px] bg-ink" />Expenses</span>
            </div>
            <ColumnChart
              format={compact}
              data={d.series.map((s) => ({ label: monthLabel(s.month).slice(0, 3), base: s.expenses, top: Math.max(0, s.profit) }))}
            />
          </div>
        </Card>

        {/* left column */}
        <div className="grid gap-4 lg:col-span-4 lg:content-start">
          <Card tour="collected" title="Collected this month">
            <div className="num text-[22px] font-semibold tracking-[-0.02em]">{fmt(d.collected)}</div>
            <div className="mt-3"><HatchBar pct={collectPct} /></div>
            <div className="muted mt-2 flex justify-between text-xs">
              <span>{fmt(d.billed)} billed</span>
              <span>{Math.round(collectPct)}%</span>
            </div>
          </Card>
          <Card tour="mapping-health" title="Account mapping" action={<Link href="/manage?tab=mapping" className="muted flex items-center text-xs hover:text-ink">Review <ChevronRight size={14} /></Link>}>
            <div className="flex items-center gap-4">
              <Ring pct={(mapped / MAPPING_META.length) * 100} size={78} />
              <div className="min-w-0 text-sm">
                <p className="font-semibold">{d.issues.length === 0 ? "Everything is mapped" : `${d.issues.length} need attention`}</p>
                <p className="muted mt-1 text-[13px]">
                  {d.issues.length === 0 ? `${mapped} posting rules point to valid accounts.` : `${MAPPING_META.find((m) => m.key === d.issues[0].key)?.label}: ${d.issues[0].reason.toLowerCase()}.`}
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <Link href="/manage?tab=tax" className="tile-flat py-2.5 hover:bg-white"><b className="block text-base">{books.taxes.filter((t) => t.active).length}</b><span className="muted">tax rates</span></Link>
              <Link href="/manage?tab=discounts" className="tile-flat py-2.5 hover:bg-white"><b className="block text-base">{books.discounts.filter((t) => t.active).length}</b><span className="muted">discounts</span></Link>
              <Link href="/manage?tab=categories" className="tile-flat py-2.5 hover:bg-white"><b className="block text-base">{books.categories.length}</b><span className="muted">categories</span></Link>
            </div>
          </Card>
        </div>

        {/* recent */}
        <Card tour="recent" className="lg:col-span-8" title="Recent activities" action={<Link href="/activity" className="muted flex items-center text-xs hover:text-ink">View all <ChevronRight size={14} /></Link>}>
          {d.recent.length === 0 ? (
            <Empty title="No invoices or bills yet" hint="Create your first invoice and it will appear here, already posted to the right accounts." action={<Link href="/activity/new?type=invoice" className="btn btn-dark btn-sm">New invoice</Link>} />
          ) : (
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead className="thead">
                  <tr><th>Number</th><th>Activity</th><th className="text-right">Amount</th><th>Status</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {d.recent.map((x) => (
                    <tr key={x.id} className="trow">
                      <td className="num"><Link href={`/activity/${x.id}`} className="font-medium hover:underline">{x.number}</Link></td>
                      <td>
                        <span className="flex items-center gap-2.5">
                          <IconBadge tone={x.type === "invoice" ? "teal" : "accent"}>{x.type === "invoice" ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}</IconBadge>
                          <span className="truncate">{contact(x.contactId)}</span>
                        </span>
                      </td>
                      <td className="num text-right font-medium">{x.snapshot ? fmt(x.snapshot.total) : <span className="muted">Draft</span>}</td>
                      <td><StatusDot status={x.status} overdue={isOverdue(x, today)} /></td>
                      <td className="muted num">{dateLabel(x.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
