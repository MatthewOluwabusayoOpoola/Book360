import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDoc, postingLines, entryTotals, postDoc, recordPayment, voidDoc, removePayment, addManualEntry, mappingIssues, nextNumber } from "../lib/engine";
import { emptyBooks, demoBooks, SEED_TAXES, SEED_DISCOUNTS } from "../lib/seed";
import { balanceSheet, profitAndLoss, trialBalance, taxSummary } from "../lib/reports";
import type { Books, Doc, DocLine } from "../lib/types";

const ctx = { taxes: SEED_TAXES, discounts: SEED_DISCOUNTS };
const L = (o: Partial<DocLine>): DocLine => ({ id: "x" + Math.random(), description: "t", categoryId: "c_web", qty: 1, unitPrice: 100000, ...o });

test("exclusive tax adds on top", () => {
  const c = computeDoc([L({ taxId: "t_vat" })], undefined, ctx);
  assert.equal(c.net, 100000);
  assert.equal(c.tax, 7500);
  assert.equal(c.total, 107500);
});

test("inclusive tax splits out of the price", () => {
  const c = computeDoc([L({ taxId: "t_vat_inc", unitPrice: 107500 })], undefined, ctx);
  assert.equal(c.net, 100000);
  assert.equal(c.tax, 7500);
  assert.equal(c.total, 107500);
  assert.equal(c.gross, 100000);
});

test("line discount % then tax on the discounted amount", () => {
  const c = computeDoc([L({ taxId: "t_vat", discountId: "d_loyal" })], undefined, ctx);
  assert.equal(c.discounts, 10000);
  assert.equal(c.net, 90000);
  assert.equal(c.tax, 6750);
});

test("fixed discount never exceeds the line", () => {
  const c = computeDoc([L({ unitPrice: 10000, discountId: "d_promo" })], undefined, ctx);
  assert.equal(c.net, 0);
});

test("document discount is allocated across lines and sums exactly", () => {
  const lines = [L({ taxId: "t_vat", unitPrice: 33333.33 }), L({ taxId: "t_zero", unitPrice: 66666.67 }), L({ taxId: "t_vat", unitPrice: 1 })];
  const c = computeDoc(lines, "d_trade", ctx);
  const alloc = c.lines.reduce((s, l) => s + l.docDiscount, 0);
  assert.ok(Math.abs(alloc - 5000.05) < 0.005, String(alloc));
  assert.ok(Math.abs(c.net - (100001 - 5000.05)) < 0.005);
});

test("every posting balances, sales and purchases, inclusive and exclusive", () => {
  const b = emptyBooks();
  const lines = [L({ taxId: "t_vat", discountId: "d_loyal" }), L({ taxId: "t_vat_inc", unitPrice: 54321.11, qty: 3 }), L({ taxId: "t_zero", unitPrice: 777.77 })];
  for (const type of ["invoice", "bill"] as const) {
    const c = computeDoc(lines, "d_early", b);
    const j = postingLines(b, { type, lines, documentDiscountId: "d_early" }, c);
    assert.ok(entryTotals(j).balanced, JSON.stringify(entryTotals(j)));
  }
});

test("invoice posts to mapped accounts; sales tax uses the tax rate's output account", () => {
  let b = emptyBooks();
  const doc: Doc = { id: "d1", type: "invoice", number: "INV-1", contactId: "p_bright", date: "2026-01-10", dueDate: "2026-01-24", status: "draft", lines: [L({ taxId: "t_vat", discountId: "d_loyal" })], notes: "", payments: [] };
  b = { ...b, docs: [doc] };
  const r = postDoc(b, "d1");
  assert.ok(r.ok);
  if (!r.ok) return;
  const je = r.books.journal[0];
  const by = (id: string) => je.lines.find((l) => l.accountId === id);
  assert.equal(by("a1100")?.debit, 96750);
  assert.equal(by("a4010")?.credit, 100000);
  assert.equal(by("a4900")?.debit, 10000);
  assert.equal(by("a2100")?.credit, 6750);
});

test("re-mapping a category changes where revenue lands", () => {
  let b = emptyBooks();
  b = { ...b, categories: b.categories.map((c) => (c.id === "c_web" ? { ...c, revenueAccountId: "a4020" } : c)) };
  const c = computeDoc([L({})], undefined, b);
  const j = postingLines(b, { type: "invoice", lines: [L({})], documentDiscountId: undefined }, c);
  assert.ok(j.some((l) => l.accountId === "a4020" && l.credit === 100000));
});

test("fallback to default mapping when category account is blank", () => {
  let b = emptyBooks();
  b = { ...b, categories: b.categories.map((c) => (c.id === "c_web" ? { ...c, revenueAccountId: "" } : c)) };
  const l = [L({})];
  const j = postingLines(b, { type: "invoice", lines: l, documentDiscountId: undefined }, computeDoc(l, undefined, b));
  assert.ok(j.some((x) => x.accountId === b.mappings["sales.revenue"] && x.credit === 100000));
});

test("payments, partial payments, reversal and void", () => {
  let b = emptyBooks();
  b = { ...b, docs: [{ id: "d1", type: "invoice", number: "INV-1", contactId: "p_bright", date: "2026-01-10", dueDate: "2026-01-24", status: "draft", lines: [L({ taxId: "t_vat" })], notes: "", payments: [] }] };
  let r = postDoc(b, "d1");
  assert.ok(r.ok); if (!r.ok) return; b = r.books;
  let p = recordPayment(b, "d1", { date: "2026-01-12", amount: 50000, accountId: "a1010", reference: "" });
  assert.ok(p.ok); if (!p.ok) return; b = p.books;
  assert.equal(b.docs[0].status, "posted");
  assert.equal(recordPayment(b, "d1", { date: "2026-01-12", amount: 999999, accountId: "a1010", reference: "" }).ok, false);
  assert.equal(voidDoc(b, "d1").ok, false, "cannot void with payments");
  p = recordPayment(b, "d1", { date: "2026-01-13", amount: 57500, accountId: "a1010", reference: "" });
  assert.ok(p.ok); if (!p.ok) return; b = p.books;
  assert.equal(b.docs[0].status, "paid");
  const rm = removePayment(b, "d1", b.docs[0].payments[1].id);
  assert.ok(rm.ok); if (!rm.ok) return; b = rm.books;
  assert.equal(b.docs[0].status, "posted");
  const rm2 = removePayment(b, "d1", b.docs[0].payments[0].id);
  assert.ok(rm2.ok); if (!rm2.ok) return; b = rm2.books;
  const v = voidDoc(b, "d1");
  assert.ok(v.ok); if (!v.ok) return;
  const tb = trialBalance(v.books, "2099-01-01");
  assert.equal(tb.rows.length, 0, "everything nets to zero after reversals");
});

test("manual journals must balance", () => {
  const b = emptyBooks();
  assert.equal(addManualEntry(b, { date: "2026-01-01", memo: "", lines: [{ accountId: "a1010", debit: 10, credit: 0 }, { accountId: "a3000", debit: 0, credit: 9 }] }).ok, false);
  assert.equal(addManualEntry(b, { date: "2026-01-01", memo: "", lines: [{ accountId: "a1010", debit: 10, credit: 0 }, { accountId: "a3000", debit: 0, credit: 10 }] }).ok, true);
});

test("mapping validation flags inactive / wrong-type accounts", () => {
  const b = emptyBooks();
  assert.equal(mappingIssues(b).length, 0);
  const bad: Books = { ...b, mappings: { ...b.mappings, "sales.receivable": "a4000" } };
  assert.equal(mappingIssues(bad).length, 1);
});

test("demo books reconcile: trial balance, balance sheet, tax summary vs ledger", () => {
  const b = demoBooks("2026-10-25");
  assert.ok(b.docs.length > 30);
  const tb = trialBalance(b, "2099-01-01");
  assert.ok(tb.balanced, `${tb.debit} vs ${tb.credit}`);
  const bs = balanceSheet(b, "2099-01-01");
  assert.ok(bs.balanced);
  // VAT: output account balance - input account balance == summary payable (posted docs only)
  const ts = taxSummary(b, {});
  const out = b.journal.flatMap((e) => e.lines).filter((l) => l.accountId === "a2100").reduce((s, l) => s + l.credit - l.debit, 0);
  const inp = b.journal.flatMap((e) => e.lines).filter((l) => l.accountId === "a1200").reduce((s, l) => s + l.debit - l.credit, 0);
  assert.ok(Math.abs(ts.payable - (out - inp)) < 0.01, `${ts.payable} vs ${out - inp}`);
  const pl = profitAndLoss(b, {});
  assert.ok(pl.totalRevenue > 0 && pl.totalExpenses > 0);
});

test("document numbering increments", () => {
  const b = emptyBooks();
  assert.equal(nextNumber(b, "invoice").label, "INV-000001");
});
