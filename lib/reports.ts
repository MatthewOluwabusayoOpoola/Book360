import { accountBalance, addDays, balanceDue, isDebitNormal, r2, sums, type Range } from "./engine";
import type { Account, Books, Doc } from "./types";

export const liveDocs = (b: Books) => b.docs.filter((d) => d.snapshot && d.status !== "void" && d.status !== "draft");

export function profitAndLoss(b: Books, range: Range) {
  const s = sums(b, range);
  const rows = (type: Account["type"]) =>
    b.accounts
      .filter((a) => a.type === type)
      .map((a) => ({ account: a, amount: accountBalance(a, s) }))
      .filter((r) => r.amount !== 0);
  const revenue = rows("revenue");
  const expenses = rows("expense");
  const totalRevenue = r2(revenue.reduce((t, r) => t + r.amount, 0));
  const totalExpenses = r2(expenses.reduce((t, r) => t + r.amount, 0));
  return { revenue, expenses, totalRevenue, totalExpenses, net: r2(totalRevenue - totalExpenses) };
}

export function trialBalance(b: Books, asAt: string) {
  const s = sums(b, { to: asAt });
  const rows = b.accounts
    .map((a) => {
      const x = s.get(a.id) ?? { debit: 0, credit: 0 };
      const net = r2(x.debit - x.credit);
      return { account: a, debit: net > 0 ? net : 0, credit: net < 0 ? -net : 0 };
    })
    .filter((r) => r.debit || r.credit);
  const debit = r2(rows.reduce((t, r) => t + r.debit, 0));
  const credit = r2(rows.reduce((t, r) => t + r.credit, 0));
  return { rows, debit, credit, balanced: Math.abs(debit - credit) < 0.005 };
}

export function balanceSheet(b: Books, asAt: string) {
  const s = sums(b, { to: asAt });
  const rows = (type: Account["type"]) =>
    b.accounts
      .filter((a) => a.type === type)
      .map((a) => ({ account: a, amount: accountBalance(a, s) }))
      .filter((r) => r.amount !== 0);
  const assets = rows("asset");
  const liabilities = rows("liability");
  const equity = rows("equity");
  const pl = profitAndLoss(b, { to: asAt });
  const totalAssets = r2(assets.reduce((t, r) => t + r.amount, 0));
  const totalLiabilities = r2(liabilities.reduce((t, r) => t + r.amount, 0));
  const totalEquity = r2(equity.reduce((t, r) => t + r.amount, 0) + pl.net);
  return {
    assets,
    liabilities,
    equity,
    earnings: pl.net,
    totalAssets,
    totalLiabilities,
    totalEquity,
    balanced: Math.abs(totalAssets - totalLiabilities - totalEquity) < 0.005,
  };
}

export function taxSummary(b: Books, range: Range) {
  const inRange = (d: Doc) => (!range.from || d.date >= range.from) && (!range.to || d.date <= range.to);
  const map = new Map<string, { taxId: string; name: string; rate: number; salesBase: number; outputTax: number; purchaseBase: number; inputTax: number }>();
  for (const d of liveDocs(b).filter(inRange)) {
    for (const t of d.snapshot!.taxes) {
      const cur = map.get(t.taxId) ?? { taxId: t.taxId, name: t.name, rate: t.rate, salesBase: 0, outputTax: 0, purchaseBase: 0, inputTax: 0 };
      if (d.type === "invoice") {
        cur.salesBase = r2(cur.salesBase + t.base);
        cur.outputTax = r2(cur.outputTax + t.tax);
      } else {
        cur.purchaseBase = r2(cur.purchaseBase + t.base);
        cur.inputTax = r2(cur.inputTax + t.tax);
      }
      map.set(t.taxId, cur);
    }
  }
  const rows = [...map.values()];
  const output = r2(rows.reduce((t, r) => t + r.outputTax, 0));
  const input = r2(rows.reduce((t, r) => t + r.inputTax, 0));
  return { rows, output, input, payable: r2(output - input) };
}

export function discountSummary(b: Books, range: Range) {
  const inRange = (d: Doc) => (!range.from || d.date >= range.from) && (!range.to || d.date <= range.to);
  const names = new Map(b.discounts.map((d) => [d.id, d.name]));
  const map = new Map<string, { name: string; given: number; received: number; uses: number }>();
  for (const d of liveDocs(b).filter(inRange)) {
    d.lines.forEach((l, i) => {
      const c = d.snapshot!.lines[i];
      const parts: [string | undefined, number][] = [
        [l.discountId, c.lineDiscountNet],
        [d.documentDiscountId, c.docDiscountNet],
      ];
      for (const [id, amt] of parts) {
        if (!id || !amt) continue;
        const cur = map.get(id) ?? { name: names.get(id) ?? "Removed discount", given: 0, received: 0, uses: 0 };
        if (d.type === "invoice") cur.given = r2(cur.given + amt);
        else cur.received = r2(cur.received + amt);
        cur.uses += 1;
        map.set(id, cur);
      }
    });
  }
  return [...map.values()].sort((a, c) => c.given + c.received - (a.given + a.received));
}

export function aging(b: Books, type: "invoice" | "bill", today: string) {
  const buckets = [
    { label: "Not due", min: -Infinity, max: 0, amount: 0, count: 0 },
    { label: "1–30 days", min: 1, max: 30, amount: 0, count: 0 },
    { label: "31–60 days", min: 31, max: 60, amount: 0, count: 0 },
    { label: "61–90 days", min: 61, max: 90, amount: 0, count: 0 },
    { label: "Over 90", min: 91, max: Infinity, amount: 0, count: 0 },
  ];
  for (const d of liveDocs(b).filter((x) => x.type === type)) {
    const due = balanceDue(d);
    if (due <= 0.005) continue;
    const late = Math.floor((new Date(today).getTime() - new Date(d.dueDate).getTime()) / 86400000);
    const bk = buckets.find((x) => late >= x.min && late <= x.max)!;
    bk.amount = r2(bk.amount + due);
    bk.count += 1;
  }
  return buckets;
}

export function monthKey(iso: string) {
  return iso.slice(0, 7);
}

export function lastMonths(today: string, n: number) {
  const out: string[] = [];
  const d = new Date(today + "T12:00:00");
  d.setDate(1);
  d.setMonth(d.getMonth() - (n - 1));
  for (let i = 0; i < n; i++) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

export function monthlySeries(b: Books, today: string, n = 8) {
  return lastMonths(today, n).map((m) => {
    const p = profitAndLoss(b, { from: `${m}-01`, to: `${m}-31` });
    return { month: m, revenue: p.totalRevenue, expenses: p.totalExpenses, profit: p.net };
  });
}

export function dailySeries(b: Books, from: string, to: string) {
  // cumulative-free daily revenue and expenses between from..to
  const days: { date: string; revenue: number; expenses: number }[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push({ date: d, revenue: 0, expenses: 0 });
  const idx = new Map(days.map((x, i) => [x.date, i]));
  const type = new Map(b.accounts.map((a) => [a.id, a]));
  for (const e of b.journal) {
    const i = idx.get(e.date);
    if (i === undefined) continue;
    for (const l of e.lines) {
      const a = type.get(l.accountId);
      if (!a) continue;
      if (a.type === "revenue") days[i].revenue = r2(days[i].revenue + l.credit - l.debit);
      if (a.type === "expense") days[i].expenses = r2(days[i].expenses + l.debit - l.credit);
    }
  }
  return days;
}

export function expenseByAccount(b: Books, range: Range) {
  return profitAndLoss(b, range)
    .expenses.map((r) => ({ label: r.account.name, value: r.amount }))
    .sort((a, c) => c.value - a.value);
}

export function cashAccounts(b: Books) {
  const s = sums(b);
  return b.accounts
    .filter((a) => a.active && (a.subtype === "bank" || a.subtype === "cash"))
    .map((a) => ({ account: a, balance: accountBalance(a, s) }));
}

export { isDebitNormal };

export const isOverdue = (d: Doc, today: string) => d.status === "posted" && !!d.snapshot && d.dueDate < today && balanceDue(d) > 0.005;

export function outstanding(b: Books, type: "invoice" | "bill") {
  return r2(liveDocs(b).filter((d) => d.type === type).reduce((s, d) => s + Math.max(0, balanceDue(d)), 0));
}
