import type {
  Account,
  Books,
  ComputedDoc,
  ComputedLine,
  Discount,
  Doc,
  DocLine,
  JournalEntry,
  JournalLine,
  MappingKey,
  Payment,
  TaxBreakdown,
  TaxRate,
} from "./types";

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

let uidCounter = 0;
export const uid = (prefix = "id") =>
  `${prefix}_${Date.now().toString(36)}${(uidCounter++).toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;

export const pad = (n: number, width = 6) => String(n).padStart(width, "0");

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const addDays = (iso: string, days: number) => {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/* ------------------------------------------------------------------ */
/* totals: discounts + tax                                             */
/* ------------------------------------------------------------------ */

interface Ctx {
  taxes: TaxRate[];
  discounts: Discount[];
}

function discountAmount(d: Discount | undefined, base: number) {
  if (!d || base <= 0) return 0;
  const raw = d.kind === "percent" ? r2((base * d.value) / 100) : d.value;
  return r2(Math.min(Math.max(raw, 0), base));
}

/**
 * Order of operations (documented so the numbers are reproducible):
 *  1. line gross = qty × price
 *  2. line discount comes off the line
 *  3. document discount is spread across lines in proportion to what is left
 *  4. tax is calculated on the discounted amount
 *     - exclusive: tax is added on top
 *     - inclusive: the discounted amount already contains tax, so it is split out
 */
export function computeDoc(lines: DocLine[], documentDiscountId: string | undefined, ctx: Ctx): ComputedDoc {
  const taxById = new Map(ctx.taxes.map((t) => [t.id, t]));
  const discById = new Map(ctx.discounts.map((d) => [d.id, d]));

  const stage = lines.map((l) => {
    const gross = r2(Math.max(l.qty, 0) * Math.max(l.unitPrice, 0));
    const lineDiscount = discountAmount(l.discountId ? discById.get(l.discountId) : undefined, gross);
    return { l, gross, lineDiscount, afterLine: r2(gross - lineDiscount) };
  });

  const subtotal = r2(stage.reduce((s, x) => s + x.afterLine, 0));
  const docDiscTotal = discountAmount(documentDiscountId ? discById.get(documentDiscountId) : undefined, subtotal);

  // allocate the document discount, last non-zero line absorbs rounding
  const alloc: number[] = stage.map(() => 0);
  if (docDiscTotal > 0 && subtotal > 0) {
    let lastIdx = -1;
    stage.forEach((x, i) => {
      if (x.afterLine > 0) lastIdx = i;
    });
    let used = 0;
    stage.forEach((x, i) => {
      if (x.afterLine <= 0) return;
      if (i === lastIdx) alloc[i] = r2(docDiscTotal - used);
      else {
        alloc[i] = r2((docDiscTotal * x.afterLine) / subtotal);
        used = r2(used + alloc[i]);
      }
    });
  }

  const out: ComputedLine[] = stage.map((x, i) => {
    const tax = x.l.taxId ? taxById.get(x.l.taxId) : undefined;
    const amount = r2(x.afterLine - alloc[i]);
    let net = amount;
    let taxAmt = 0;
    let grossNet = x.gross;
    let lineDiscountNet = x.lineDiscount;
    if (tax && tax.rate > 0) {
      const f = 1 + tax.rate / 100;
      if (tax.inclusive) {
        net = r2(amount / f);
        taxAmt = r2(amount - net);
        grossNet = r2(x.gross / f);
        lineDiscountNet = r2(x.lineDiscount / f);
      } else {
        taxAmt = r2((net * tax.rate) / 100);
      }
    }
    const docDiscountNet = r2(grossNet - lineDiscountNet - net);
    return {
      lineId: x.l.id,
      gross: x.gross,
      lineDiscount: x.lineDiscount,
      docDiscount: alloc[i],
      net,
      tax: taxAmt,
      total: r2(net + taxAmt),
      grossNet,
      lineDiscountNet,
      docDiscountNet,
    };
  });

  const byTax = new Map<string, TaxBreakdown>();
  out.forEach((c, i) => {
    const t = lines[i].taxId ? taxById.get(lines[i].taxId!) : undefined;
    if (!t) return;
    const cur = byTax.get(t.id) ?? { taxId: t.id, name: t.name, rate: t.rate, base: 0, tax: 0 };
    cur.base = r2(cur.base + c.net);
    cur.tax = r2(cur.tax + c.tax);
    byTax.set(t.id, cur);
  });

  const sum = (f: (c: ComputedLine) => number) => r2(out.reduce((s, c) => s + f(c), 0));
  return {
    lines: out,
    gross: sum((c) => c.grossNet),
    discounts: sum((c) => c.lineDiscountNet + c.docDiscountNet),
    net: sum((c) => c.net),
    tax: sum((c) => c.tax),
    total: sum((c) => c.total),
    taxes: [...byTax.values()],
  };
}

/* ------------------------------------------------------------------ */
/* account mapping resolution                                          */
/* ------------------------------------------------------------------ */

export interface MappingMeta {
  key: MappingKey;
  group: "Sales" | "Purchases" | "Payments & equity";
  label: string;
  help: string;
  types: Account["type"][];
}

export const MAPPING_META: MappingMeta[] = [
  { key: "sales.receivable", group: "Sales", label: "Accounts receivable", help: "Debited when an invoice is posted.", types: ["asset"] },
  { key: "sales.revenue", group: "Sales", label: "Default revenue", help: "Used when a category has no revenue account.", types: ["revenue"] },
  { key: "sales.discount", group: "Sales", label: "Sales discounts", help: "Used when a discount has no sales account.", types: ["revenue", "expense"] },
  { key: "sales.tax", group: "Sales", label: "Output tax", help: "Used when a tax rate has no output account.", types: ["liability"] },
  { key: "purchase.payable", group: "Purchases", label: "Accounts payable", help: "Credited when a bill is posted.", types: ["liability"] },
  { key: "purchase.expense", group: "Purchases", label: "Default expense", help: "Used when a category has no expense account.", types: ["expense", "asset"] },
  { key: "purchase.discount", group: "Purchases", label: "Purchase discounts", help: "Used when a discount has no purchase account.", types: ["expense", "revenue"] },
  { key: "purchase.tax", group: "Purchases", label: "Input tax", help: "Used when a tax rate has no input account.", types: ["asset"] },
  { key: "payment.bank", group: "Payments & equity", label: "Default bank", help: "Pre-selected when recording a payment.", types: ["asset"] },
  { key: "equity.retained", group: "Payments & equity", label: "Retained earnings", help: "Where closed profit is carried.", types: ["equity"] },
];

export function mappingIssues(b: Books) {
  const acc = new Map(b.accounts.map((a) => [a.id, a]));
  const issues: { key: MappingKey; reason: string }[] = [];
  for (const m of MAPPING_META) {
    const a = acc.get(b.mappings[m.key]);
    if (!a) issues.push({ key: m.key, reason: "Not mapped" });
    else if (!a.active) issues.push({ key: m.key, reason: "Mapped account is inactive" });
    else if (!m.types.includes(a.type)) issues.push({ key: m.key, reason: `Should be ${m.types.join(" or ")}` });
  }
  return issues;
}

/* ------------------------------------------------------------------ */
/* posting                                                             */
/* ------------------------------------------------------------------ */

export function postingLines(b: Books, doc: Pick<Doc, "type" | "lines" | "documentDiscountId">, c: ComputedDoc): JournalLine[] {
  const sale = doc.type === "invoice";
  const cat = new Map(b.categories.map((x) => [x.id, x]));
  const tax = new Map(b.taxes.map((x) => [x.id, x]));
  const disc = new Map(b.discounts.map((x) => [x.id, x]));
  const m = b.mappings;
  const raw: JournalLine[] = [];

  const push = (accountId: string, amount: number, side: "debit" | "credit", memo: string) => {
    if (!amount) return;
    // a negative amount flips sides so rounding never produces a negative posting
    const s = amount < 0 ? (side === "debit" ? "credit" : "debit") : side;
    const v = Math.abs(amount);
    raw.push({ accountId, debit: s === "debit" ? v : 0, credit: s === "credit" ? v : 0, memo });
  };

  const docDisc = doc.documentDiscountId ? disc.get(doc.documentDiscountId) : undefined;

  doc.lines.forEach((l, i) => {
    const cl = c.lines[i];
    const ct = cat.get(l.categoryId);
    if (sale) {
      push(ct?.revenueAccountId || m["sales.revenue"], cl.grossNet, "credit", ct ? `Revenue · ${ct.name}` : "Revenue");
      const ld = l.discountId ? disc.get(l.discountId) : undefined;
      push(ld?.salesAccountId || m["sales.discount"], cl.lineDiscountNet, "debit", `Discount · ${ld?.name ?? "line"}`);
      push(docDisc?.salesAccountId || m["sales.discount"], cl.docDiscountNet, "debit", `Discount · ${docDisc?.name ?? "document"}`);
      const t = l.taxId ? tax.get(l.taxId) : undefined;
      push(t?.outputAccountId || m["sales.tax"], cl.tax, "credit", `Output tax · ${t?.name ?? ""}`);
    } else {
      push(ct?.expenseAccountId || m["purchase.expense"], cl.grossNet, "debit", ct ? `Expense · ${ct.name}` : "Expense");
      const ld = l.discountId ? disc.get(l.discountId) : undefined;
      push(ld?.purchaseAccountId || m["purchase.discount"], cl.lineDiscountNet, "credit", `Discount · ${ld?.name ?? "line"}`);
      push(docDisc?.purchaseAccountId || m["purchase.discount"], cl.docDiscountNet, "credit", `Discount · ${docDisc?.name ?? "document"}`);
      const t = l.taxId ? tax.get(l.taxId) : undefined;
      push(t?.inputAccountId || m["purchase.tax"], cl.tax, "debit", `Input tax · ${t?.name ?? ""}`);
    }
  });

  if (sale) push(m["sales.receivable"], c.total, "debit", "Accounts receivable");
  else push(m["purchase.payable"], c.total, "credit", "Accounts payable");

  // merge by account + side + memo group (memo of first kept)
  const merged = new Map<string, JournalLine>();
  for (const r of raw) {
    const k = `${r.accountId}|${r.debit > 0 ? "d" : "c"}`;
    const cur = merged.get(k);
    if (cur) {
      cur.debit = r2(cur.debit + r.debit);
      cur.credit = r2(cur.credit + r.credit);
    } else merged.set(k, { ...r });
  }
  return [...merged.values()].sort((a, b) => (b.debit > 0 ? 1 : 0) - (a.debit > 0 ? 1 : 0) || 0);
}

export function entryTotals(lines: JournalLine[]) {
  const debit = r2(lines.reduce((s, l) => s + l.debit, 0));
  const credit = r2(lines.reduce((s, l) => s + l.credit, 0));
  return { debit, credit, diff: r2(debit - credit), balanced: Math.abs(debit - credit) < 0.005 };
}

export function validateDoc(b: Books, doc: Doc): string[] {
  const errs: string[] = [];
  if (!doc.contactId) errs.push(doc.type === "invoice" ? "Choose a customer." : "Choose a vendor.");
  if (!doc.lines.length) errs.push("Add at least one line.");
  doc.lines.forEach((l, i) => {
    if (!(l.qty > 0)) errs.push(`Line ${i + 1}: quantity must be above zero.`);
    if (!(l.unitPrice >= 0)) errs.push(`Line ${i + 1}: price can't be negative.`);
  });
  if (doc.dueDate < doc.date) errs.push("Due date is before the document date.");
  const acc = new Map(b.accounts.map((a) => [a.id, a]));
  const c = computeDoc(doc.lines, doc.documentDiscountId, b);
  const lines = postingLines(b, doc, c);
  for (const l of lines) {
    const a = acc.get(l.accountId);
    if (!a) errs.push("A line points to an account that doesn't exist. Check Account mapping.");
    else if (!a.active) errs.push(`Account ${a.code} ${a.name} is inactive. Check Account mapping.`);
  }
  if (!entryTotals(lines).balanced) errs.push("The journal doesn't balance.");
  return [...new Set(errs)];
}

export function validateEntry(b: Books, lines: JournalLine[]): string[] {
  const errs: string[] = [];
  const used = lines.filter((l) => l.accountId || l.debit || l.credit);
  if (used.length < 2) errs.push("Use at least two lines.");
  used.forEach((l, i) => {
    if (!l.accountId) errs.push(`Line ${i + 1}: choose an account.`);
    if (l.debit > 0 && l.credit > 0) errs.push(`Line ${i + 1}: use debit or credit, not both.`);
    if (!(l.debit > 0 || l.credit > 0)) errs.push(`Line ${i + 1}: enter an amount.`);
  });
  const t = entryTotals(used);
  if (!t.balanced) errs.push(`Out of balance by ${Math.abs(t.diff).toFixed(2)}.`);
  return errs;
}

/* ------------------------------------------------------------------ */
/* reducers (pure: Books in → Books out)                               */
/* ------------------------------------------------------------------ */

export type Result = { ok: true; books: Books; id?: string } | { ok: false; errors: string[] };

export function nextNumber(b: Books, kind: "invoice" | "bill" | "journal") {
  const n = b.counters[kind] + 1;
  const prefix = kind === "invoice" ? b.settings.invoicePrefix : kind === "bill" ? b.settings.billPrefix : "JE";
  return { n, label: `${prefix}-${pad(n)}` };
}

export function appendEntry(b: Books, e: Omit<JournalEntry, "id" | "number">): { books: Books; entry: JournalEntry } {
  const { n, label } = nextNumber(b, "journal");
  const entry: JournalEntry = { ...e, id: uid("je"), number: label };
  return { books: { ...b, journal: [...b.journal, entry], counters: { ...b.counters, journal: n } }, entry };
}

export function postDoc(b: Books, docId: string): Result {
  const doc = b.docs.find((d) => d.id === docId);
  if (!doc) return { ok: false, errors: ["Document not found."] };
  if (doc.status !== "draft") return { ok: false, errors: ["Only drafts can be posted."] };
  const errors = validateDoc(b, doc);
  if (errors.length) return { ok: false, errors };
  const snapshot = computeDoc(doc.lines, doc.documentDiscountId, b);
  const lines = postingLines(b, doc, snapshot);
  const contact = b.contacts.find((c) => c.id === doc.contactId);
  const { books, entry } = appendEntry(b, {
    date: doc.date,
    memo: `${doc.type === "invoice" ? "Invoice" : "Bill"} ${doc.number} · ${contact?.name ?? ""}`,
    source: doc.type,
    sourceId: doc.id,
    lines,
  });
  return {
    ok: true,
    id: doc.id,
    books: {
      ...books,
      docs: books.docs.map((d) => (d.id === doc.id ? { ...d, status: "posted", snapshot, journalEntryId: entry.id } : d)),
    },
  };
}

export function paidAmount(d: Doc) {
  return r2(d.payments.reduce((s, p) => s + p.amount, 0));
}
export function balanceDue(d: Doc) {
  return r2((d.snapshot?.total ?? 0) - paidAmount(d));
}

export function recordPayment(
  b: Books,
  docId: string,
  p: { date: string; amount: number; accountId: string; reference: string },
): Result {
  const doc = b.docs.find((d) => d.id === docId);
  if (!doc || !doc.snapshot) return { ok: false, errors: ["Post the document before recording a payment."] };
  if (doc.status === "void") return { ok: false, errors: ["This document is void."] };
  const due = balanceDue(doc);
  if (!(p.amount > 0)) return { ok: false, errors: ["Enter an amount above zero."] };
  if (p.amount > due + 0.005) return { ok: false, errors: [`Amount is more than the balance due.`] };
  const acc = b.accounts.find((a) => a.id === p.accountId);
  if (!acc || !acc.active) return { ok: false, errors: ["Choose a bank or cash account."] };
  const sale = doc.type === "invoice";
  const control = sale ? b.mappings["sales.receivable"] : b.mappings["purchase.payable"];
  const amt = r2(p.amount);
  const lines: JournalLine[] = sale
    ? [
        { accountId: p.accountId, debit: amt, credit: 0, memo: `Payment ${doc.number}` },
        { accountId: control, debit: 0, credit: amt, memo: `Settles ${doc.number}` },
      ]
    : [
        { accountId: control, debit: amt, credit: 0, memo: `Settles ${doc.number}` },
        { accountId: p.accountId, debit: 0, credit: amt, memo: `Payment ${doc.number}` },
      ];
  const { books, entry } = appendEntry(b, {
    date: p.date,
    memo: `Payment · ${doc.number}${p.reference ? ` · ${p.reference}` : ""}`,
    source: "payment",
    sourceId: doc.id,
    lines,
  });
  const payment: Payment = { id: uid("pay"), ...p, amount: amt, journalEntryId: entry.id };
  return {
    ok: true,
    id: payment.id,
    books: {
      ...books,
      docs: books.docs.map((d) => {
        if (d.id !== doc.id) return d;
        const next = { ...d, payments: [...d.payments, payment] };
        next.status = balanceDue(next) <= 0.005 ? "paid" : "posted";
        return next;
      }),
    },
  };
}

function reverse(b: Books, entryId: string, date: string, memo: string): { books: Books } | null {
  const e = b.journal.find((x) => x.id === entryId);
  if (!e) return null;
  const { books } = appendEntry(b, {
    date,
    memo,
    source: "reversal",
    sourceId: e.sourceId,
    reversalOf: e.id,
    lines: e.lines.map((l) => ({ ...l, debit: l.credit, credit: l.debit })),
  });
  return { books };
}

export function removePayment(b: Books, docId: string, paymentId: string, date = todayISO()): Result {
  const doc = b.docs.find((d) => d.id === docId);
  const pay = doc?.payments.find((p) => p.id === paymentId);
  if (!doc || !pay) return { ok: false, errors: ["Payment not found."] };
  const r = reverse(b, pay.journalEntryId, date, `Reversal · payment on ${doc.number}`);
  if (!r) return { ok: false, errors: ["Journal entry not found."] };
  return {
    ok: true,
    books: {
      ...r.books,
      docs: r.books.docs.map((d) => {
        if (d.id !== doc.id) return d;
        const next = { ...d, payments: d.payments.filter((p) => p.id !== paymentId) };
        next.status = next.payments.length && balanceDue(next) <= 0.005 ? "paid" : "posted";
        return next;
      }),
    },
  };
}

export function voidDoc(b: Books, docId: string, date = todayISO()): Result {
  const doc = b.docs.find((d) => d.id === docId);
  if (!doc) return { ok: false, errors: ["Document not found."] };
  if (doc.status === "draft") return { ok: false, errors: ["Delete drafts instead of voiding them."] };
  if (doc.status === "void") return { ok: false, errors: ["Already void."] };
  if (doc.payments.length) return { ok: false, errors: ["Remove the payments first, then void."] };
  const r = reverse(b, doc.journalEntryId!, date, `Void · ${doc.number}`);
  if (!r) return { ok: false, errors: ["Journal entry not found."] };
  return { ok: true, books: { ...r.books, docs: r.books.docs.map((d) => (d.id === docId ? { ...d, status: "void" } : d)) } };
}

export function addManualEntry(
  b: Books,
  e: { date: string; memo: string; lines: JournalLine[] },
): Result {
  const lines = e.lines
    .filter((l) => l.accountId || l.debit || l.credit)
    .map((l) => ({ ...l, debit: r2(l.debit || 0), credit: r2(l.credit || 0) }));
  const errors = validateEntry(b, lines);
  if (errors.length) return { ok: false, errors };
  const { books, entry } = appendEntry(b, { date: e.date, memo: e.memo || "Manual journal", source: "manual", lines });
  return { ok: true, books, id: entry.id };
}

/* ------------------------------------------------------------------ */
/* balances                                                            */
/* ------------------------------------------------------------------ */

export const isDebitNormal = (t: Account["type"]) => t === "asset" || t === "expense";

export interface Range {
  from?: string;
  to?: string;
}

export function sums(b: Books, range: Range = {}) {
  const m = new Map<string, { debit: number; credit: number }>();
  for (const e of b.journal) {
    if (range.from && e.date < range.from) continue;
    if (range.to && e.date > range.to) continue;
    for (const l of e.lines) {
      const cur = m.get(l.accountId) ?? { debit: 0, credit: 0 };
      cur.debit = r2(cur.debit + l.debit);
      cur.credit = r2(cur.credit + l.credit);
      m.set(l.accountId, cur);
    }
  }
  return m;
}

/** signed in the account's natural direction */
export function accountBalance(a: Account, s: Map<string, { debit: number; credit: number }>) {
  const x = s.get(a.id);
  if (!x) return 0;
  return r2(isDebitNormal(a.type) ? x.debit - x.credit : x.credit - x.debit);
}

/** which accounts are referenced by mappings / categories / taxes / discounts */
export function accountUsage(b: Books, accountId: string) {
  const uses: string[] = [];
  for (const [k, v] of Object.entries(b.mappings)) if (v === accountId) uses.push(MAPPING_META.find((m) => m.key === k)?.label ?? k);
  b.categories.forEach((c) => {
    if (c.revenueAccountId === accountId || c.expenseAccountId === accountId) uses.push(`Category · ${c.name}`);
  });
  b.taxes.forEach((t) => {
    if (t.outputAccountId === accountId || t.inputAccountId === accountId) uses.push(`Tax · ${t.name}`);
  });
  b.discounts.forEach((d) => {
    if (d.salesAccountId === accountId || d.purchaseAccountId === accountId) uses.push(`Discount · ${d.name}`);
  });
  const hasEntries = b.journal.some((e) => e.lines.some((l) => l.accountId === accountId));
  return { uses, hasEntries };
}
