"use client";
import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Download, Percent, TrendingUp } from "lucide-react";
import { useBooks } from "@/lib/store";
import { useFmt, useToday } from "@/lib/hooks";
import { addDays, r2 } from "@/lib/engine";
import { aging, balanceSheet, dailySeries, discountSummary, expenseByAccount, lastMonths, profitAndLoss, taxSummary, trialBalance } from "@/lib/reports";
import { csvDownload, monthLabel } from "@/lib/format";
import { Card, Chip, Delta, Empty, IconBadge, PageHeader, Segmented } from "@/components/ui";
import { DONUT_COLORS, Donut, HatchBar, LineChart } from "@/components/charts";

type Period = "month" | "last" | "year" | "all";
type Stmt = "pl" | "bs" | "tb" | "tax" | "disc" | "age";

function range(p: Period, today: string) {
  const y = today.slice(0, 4);
  const m = today.slice(5, 7);
  if (p === "month") return { from: `${y}-${m}-01`, to: today };
  if (p === "year") return { from: `${y}-01-01`, to: today };
  if (p === "all") return { from: "0000-01-01", to: today };
  const d = new Date(today + "T12:00:00");
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return { from: `${k}-01`, to: `${k}-31` };
}
function prior(p: Period, r: { from: string; to: string }, today: string) {
  if (p === "all") return null;
  if (p === "month") {
    const d = new Date(today + "T12:00:00");
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { from: `${k}-01`, to: `${k}-31` };
  }
  if (p === "last") {
    const d = new Date(r.from + "T12:00:00");
    d.setMonth(d.getMonth() - 1);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { from: `${k}-01`, to: `${k}-31` };
  }
  const y = Number(today.slice(0, 4)) - 1;
  return { from: `${y}-01-01`, to: `${y}${today.slice(4)}` };
}
const pct = (cur: number, prev: number) => (prev === 0 ? null : ((cur - prev) / Math.abs(prev)) * 100);

export default function Reports() {
  const books = useBooks((s) => s.books);
  const { fmt, compact } = useFmt();
  const today = useToday();
  const [period, setPeriod] = useState<Period>("month");
  const [stmt, setStmt] = useState<Stmt>("pl");

  const r = useMemo(() => range(period, today), [period, today]);
  const pl = useMemo(() => profitAndLoss(books, r), [books, r]);
  const prev = useMemo(() => {
    const pr = prior(period, r, today);
    return pr ? profitAndLoss(books, pr) : null;
  }, [books, period, r, today]);

  const trend = useMemo(() => {
    const first = books.journal.reduce((m, e) => (e.date < m ? e.date : m), today);
    const from = r.from < first ? first : r.from;
    const to = r.to > today ? today : r.to;
    const days = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000);
    if (days <= 45) {
      const d = dailySeries(books, from, to);
      let ra = 0;
      let rb = 0;
      return { labels: d.map((x) => String(Number(x.date.slice(8)))), a: d.map((x) => (ra = r2(ra + x.revenue))), b: d.map((x) => (rb = r2(rb + x.expenses))), cumulative: true };
    }
    const n = Math.min(12, Math.max(2, Math.round(days / 30) + 1));
    const ms = lastMonths(to, n);
    const rows = ms.map((m) => profitAndLoss(books, { from: `${m}-01`, to: `${m}-31` }));
    return { labels: ms.map((m) => monthLabel(m).slice(0, 3)), a: rows.map((x) => x.totalRevenue), b: rows.map((x) => x.totalExpenses), cumulative: false };
  }, [books, r, today]);

  const spend = useMemo(() => {
    const all = expenseByAccount(books, r);
    const top = all.slice(0, 5);
    const rest = r2(all.slice(5).reduce((s, x) => s + x.value, 0));
    return rest > 0 ? [...top, { label: "Other", value: rest }] : top;
  }, [books, r]);
  const spendTotal = spend.reduce((s, x) => s + x.value, 0);

  const bs = useMemo(() => balanceSheet(books, r.to), [books, r.to]);
  const tb = useMemo(() => trialBalance(books, r.to), [books, r.to]);
  const tax = useMemo(() => taxSummary(books, r), [books, r]);
  const disc = useMemo(() => discountSummary(books, r), [books, r]);
  const ar = useMemo(() => aging(books, "invoice", today), [books, today]);
  const ap = useMemo(() => aging(books, "bill", today), [books, today]);
  const margin = pl.totalRevenue > 0 ? (pl.net / pl.totalRevenue) * 100 : 0;

  const exportCsv = () => {
    const rows: (string | number)[][] = [];
    if (stmt === "pl") {
      rows.push(["Section", "Code", "Account", "Amount"]);
      pl.revenue.forEach((x) => rows.push(["Revenue", x.account.code, x.account.name, x.amount]));
      rows.push(["", "", "Total revenue", pl.totalRevenue]);
      pl.expenses.forEach((x) => rows.push(["Expenses", x.account.code, x.account.name, x.amount]));
      rows.push(["", "", "Total expenses", pl.totalExpenses], ["", "", "Net profit", pl.net]);
    } else if (stmt === "bs") {
      rows.push(["Section", "Code", "Account", "Amount"]);
      bs.assets.forEach((x) => rows.push(["Assets", x.account.code, x.account.name, x.amount]));
      bs.liabilities.forEach((x) => rows.push(["Liabilities", x.account.code, x.account.name, x.amount]));
      bs.equity.forEach((x) => rows.push(["Equity", x.account.code, x.account.name, x.amount]));
      rows.push(["Equity", "", "Current earnings", bs.earnings]);
    } else if (stmt === "tb") {
      rows.push(["Code", "Account", "Debit", "Credit"]);
      tb.rows.forEach((x) => rows.push([x.account.code, x.account.name, x.debit, x.credit]));
      rows.push(["", "Total", tb.debit, tb.credit]);
    } else if (stmt === "tax") {
      rows.push(["Tax", "Rate", "Sales base", "Output tax", "Purchase base", "Input tax"]);
      tax.rows.forEach((x) => rows.push([x.name, x.rate, x.salesBase, x.outputTax, x.purchaseBase, x.inputTax]));
      rows.push(["Net payable", "", "", tax.output, "", tax.input], ["", "", "", "", "Payable", tax.payable]);
    } else if (stmt === "disc") {
      rows.push(["Discount", "Uses", "Given", "Received"]);
      disc.forEach((x) => rows.push([x.name, x.uses, x.given, x.received]));
    } else {
      rows.push(["Type", "Bucket", "Documents", "Amount"]);
      ar.forEach((x) => rows.push(["Receivable", x.label, x.count, x.amount]));
      ap.forEach((x) => rows.push(["Payable", x.label, x.count, x.amount]));
    }
    csvDownload(`${stmt}-${r.to}.csv`, rows);
  };

  const Line = ({ k, v, bold, indent }: { k: string; v: number; bold?: boolean; indent?: boolean }) => (
    <div className={`flex items-center justify-between border-b border-black/5 py-2.5 text-sm last:border-0 ${bold ? "font-semibold" : ""} ${indent ? "pl-4" : ""}`}>
      <span>{k}</span>
      <span className="num">{fmt(v)}</span>
    </div>
  );

  return (
    <>
      <PageHeader title="Reports" sub="See where your money comes from, and where it goes.">
        <Segmented
          tour="report-period"
          label="Period"
          value={period}
          onChange={setPeriod}
          options={[
            { value: "month", label: "This month" },
            { value: "last", label: "Last month" },
            { value: "year", label: "This year" },
            { value: "all", label: "All time" },
          ]}
        />
        <button className="btn btn-dark" onClick={exportCsv}><Download size={15} /> Export CSV</button>
      </PageHeader>

      <div data-tour="report-kpis" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Revenue", value: pl.totalRevenue, d: prev ? pct(pl.totalRevenue, prev.totalRevenue) : null, icon: <ArrowDownLeft size={16} />, tone: "teal" as const },
          { label: "Expenses", value: pl.totalExpenses, d: prev ? pct(pl.totalExpenses, prev.totalExpenses) : null, icon: <ArrowUpRight size={16} />, tone: "accent" as const, invert: true },
          { label: "Net profit", value: pl.net, d: prev ? pct(pl.net, prev.net) : null, icon: <TrendingUp size={16} />, tone: "ink" as const },
          { label: "Profit margin", value: null, d: null, icon: <Percent size={16} />, tone: "violet" as const },
        ].map((t) => (
          <div key={t.label} className="glass card p-4">
            <div className="flex items-center gap-2.5 text-[13px]"><IconBadge tone={t.tone}>{t.icon}</IconBadge>{t.label}</div>
            <div className="num mt-4 text-[28px] font-semibold tracking-[-0.03em]">{t.value === null ? `${margin.toFixed(1)}%` : compact(t.value)}</div>
            <div className="mt-2.5">{t.value === null ? <span className="muted text-xs">of revenue kept</span> : <Delta value={t.d} invert={t.invert} suffix="vs last period" />}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <Card tour="report-chart" className="lg:col-span-7" title="Income vs expenses">
          <p className="muted -mt-2 mb-3 text-[13px]">{trend.cumulative ? "Running total for the month. " : "Month by month. "}Hover the chart to compare any point.</p>
          {trend.labels.length < 2 ? <Empty title="Not enough data for a trend" /> : <LineChart labels={trend.labels} a={trend.a} b={trend.b} aName="Income" bName="Expenses" format={fmt} />}
        </Card>
        <Card className="lg:col-span-5" title="Spending by account">
          {spend.length === 0 ? (
            <Empty title="No spending in this period" />
          ) : (
            <>
              <Donut slices={spend} center={compact(spendTotal)} sub="Total spent" />
              <ul className="mt-4 space-y-2.5">
                {spend.map((s, i) => (
                  <li key={s.label} className="grid grid-cols-[130px_1fr_40px] items-center gap-3 text-[13px]">
                    <span className="flex items-center gap-2 truncate"><i className="h-2 w-2 flex-none rounded-[2px]" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />{s.label}</span>
                    <HatchBar pct={(s.value / spendTotal) * 100} />
                    <span className="num text-right">{Math.round((s.value / spendTotal) * 100)}%</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      <div data-tour="report-tabs" className="mb-4 mt-6 scroll-thin flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Statements">
        {([["pl", "Profit & loss"], ["bs", "Balance sheet"], ["tb", "Trial balance"], ["tax", "Tax summary"], ["disc", "Discounts"], ["age", "Ageing"]] as [Stmt, string][]).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={stmt === id} onClick={() => setStmt(id)} className={`h-10 flex-none rounded-full px-4 text-[13.5px] font-medium ${stmt === id ? "bg-ink text-white" : "bg-white/50 hover:bg-white/80"}`}>{label}</button>
        ))}
      </div>

      <Card tour="report-body">
        {stmt === "pl" && (
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <h3 className="mb-1 text-sm font-semibold">Revenue</h3>
              {pl.revenue.length === 0 && <p className="muted py-3 text-sm">No revenue in this period.</p>}
              {pl.revenue.map((x) => <Line key={x.account.id} k={`${x.account.code} ${x.account.name}`} v={x.amount} indent />)}
              <Line k="Total revenue" v={pl.totalRevenue} bold />
            </div>
            <div>
              <h3 className="mb-1 text-sm font-semibold">Expenses</h3>
              {pl.expenses.length === 0 && <p className="muted py-3 text-sm">No expenses in this period.</p>}
              {pl.expenses.map((x) => <Line key={x.account.id} k={`${x.account.code} ${x.account.name}`} v={x.amount} indent />)}
              <Line k="Total expenses" v={pl.totalExpenses} bold />
              <div className="tile mt-4 flex items-center justify-between px-4 py-3.5 text-[15px] font-semibold"><span>Net profit</span><span className={`num ${pl.net < 0 ? "text-rose-fg" : ""}`}>{fmt(pl.net)}</span></div>
            </div>
          </div>
        )}
        {stmt === "bs" && (
          <>
            <p className="muted mb-4 text-[13px]">As at {r.to}</p>
            <div className="grid gap-8 md:grid-cols-2">
              <div>
                <h3 className="mb-1 text-sm font-semibold">Assets</h3>
                {bs.assets.map((x) => <Line key={x.account.id} k={`${x.account.code} ${x.account.name}`} v={x.amount} indent />)}
                <Line k="Total assets" v={bs.totalAssets} bold />
              </div>
              <div>
                <h3 className="mb-1 text-sm font-semibold">Liabilities</h3>
                {bs.liabilities.map((x) => <Line key={x.account.id} k={`${x.account.code} ${x.account.name}`} v={x.amount} indent />)}
                <Line k="Total liabilities" v={bs.totalLiabilities} bold />
                <h3 className="mb-1 mt-5 text-sm font-semibold">Equity</h3>
                {bs.equity.map((x) => <Line key={x.account.id} k={`${x.account.code} ${x.account.name}`} v={x.amount} indent />)}
                <Line k="Current earnings" v={bs.earnings} indent />
                <Line k="Total equity" v={bs.totalEquity} bold />
                <div className="mt-3"><Chip tone={bs.balanced ? "mint" : "rose"}>{bs.balanced ? "Assets = liabilities + equity" : "Out of balance"}</Chip></div>
              </div>
            </div>
          </>
        )}
        {stmt === "tb" && (
          <div className="scroll-thin overflow-x-auto">
            <p className="muted mb-3 text-[13px]">As at {r.to}</p>
            <table className="w-full min-w-[480px]">
              <thead className="thead"><tr><th>Account</th><th className="text-right">Debit</th><th className="text-right">Credit</th></tr></thead>
              <tbody>
                {tb.rows.map((x) => <tr key={x.account.id} className="trow"><td>{x.account.code} {x.account.name}</td><td className="num text-right">{x.debit ? fmt(x.debit) : ""}</td><td className="num text-right">{x.credit ? fmt(x.credit) : ""}</td></tr>)}
                <tr className="trow font-semibold"><td>Total {tb.balanced ? <Chip tone="mint">Balanced</Chip> : <Chip tone="rose">Out of balance</Chip>}</td><td className="num text-right">{fmt(tb.debit)}</td><td className="num text-right">{fmt(tb.credit)}</td></tr>
              </tbody>
            </table>
          </div>
        )}
        {stmt === "tax" && (
          <>
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <div className="tile p-4"><div className="muted text-xs">Output tax collected</div><div className="num text-xl font-semibold">{fmt(tax.output)}</div></div>
              <div className="tile p-4"><div className="muted text-xs">Input tax paid</div><div className="num text-xl font-semibold">{fmt(tax.input)}</div></div>
              <div className="teal-card card p-4"><div className="text-xs text-white/85">{tax.payable >= 0 ? "Payable to the tax authority" : "Refundable"}</div><div className="num text-xl font-semibold">{fmt(Math.abs(tax.payable))}</div></div>
            </div>
            {tax.rows.length === 0 ? <Empty title="No taxed documents in this period" /> : (
              <div className="scroll-thin overflow-x-auto">
                <table className="w-full min-w-[620px]">
                  <thead className="thead"><tr><th>Tax rate</th><th className="text-right">Sales</th><th className="text-right">Output tax</th><th className="text-right">Purchases</th><th className="text-right">Input tax</th></tr></thead>
                  <tbody>{tax.rows.map((x) => <tr key={x.taxId} className="trow"><td className="font-medium">{x.name}</td><td className="num text-right">{fmt(x.salesBase)}</td><td className="num text-right">{fmt(x.outputTax)}</td><td className="num text-right">{fmt(x.purchaseBase)}</td><td className="num text-right">{fmt(x.inputTax)}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </>
        )}
        {stmt === "disc" && (disc.length === 0 ? <Empty title="No discounts used in this period" /> : (
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[480px]">
              <thead className="thead"><tr><th>Discount</th><th className="text-right">Times used</th><th className="text-right">Given to customers</th><th className="text-right">Received from vendors</th></tr></thead>
              <tbody>{disc.map((x) => <tr key={x.name} className="trow"><td className="font-medium">{x.name}</td><td className="num text-right">{x.uses}</td><td className="num text-right">{fmt(x.given)}</td><td className="num text-right">{fmt(x.received)}</td></tr>)}</tbody>
            </table>
          </div>
        ))}
        {stmt === "age" && (
          <div className="grid gap-8 md:grid-cols-2">
            {([["Receivables (owed to you)", ar], ["Payables (you owe)", ap]] as const).map(([title, rows]) => {
              const tot = rows.reduce((s, x) => s + x.amount, 0);
              return (
                <div key={title}>
                  <h3 className="mb-3 text-sm font-semibold">{title}</h3>
                  <div className="space-y-3">
                    {rows.map((x) => (
                      <div key={x.label}>
                        <div className="flex justify-between text-[13px]"><span>{x.label} <span className="muted">· {x.count}</span></span><span className="num font-medium">{fmt(x.amount)}</span></div>
                        <div className="mt-1.5"><HatchBar pct={tot ? (x.amount / tot) * 100 : 0} /></div>
                      </div>
                    ))}
                  </div>
                  <div className="num mt-4 flex justify-between border-t border-black/10 pt-3 text-sm font-semibold"><span>Total outstanding</span><span>{fmt(tot)}</span></div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}
