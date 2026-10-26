import { addDays, appendEntry, postDoc, recordPayment, r2, todayISO } from "./engine";
import type { Account, Books, Category, Contact, Discount, Doc, DocLine, TaxRate } from "./types";

const A = (id: string, code: string, name: string, type: Account["type"], subtype?: Account["subtype"], description?: string): Account => ({
  id,
  code,
  name,
  type,
  subtype,
  active: true,
  description,
});

export const SEED_ACCOUNTS: Account[] = [
  A("a1000", "1000", "Petty cash", "asset", "cash"),
  A("a1010", "1010", "GTBank current", "asset", "bank"),
  A("a1020", "1020", "Access Bank operations", "asset", "bank"),
  A("a1100", "1100", "Accounts receivable", "asset", "receivable", "Money customers owe you"),
  A("a1200", "1200", "Input VAT recoverable", "asset", "tax", "VAT you paid on purchases"),
  A("a1300", "1300", "Prepaid expenses", "asset", "other"),
  A("a1500", "1500", "Equipment", "asset", "other"),
  A("a2000", "2000", "Accounts payable", "liability", "payable", "Money you owe vendors"),
  A("a2100", "2100", "Output VAT payable", "liability", "tax", "VAT you collected on sales"),
  A("a2200", "2200", "Accrued expenses", "liability", "other"),
  A("a3000", "3000", "Owner's equity", "equity", "other"),
  A("a3100", "3100", "Retained earnings", "equity", "other"),
  A("a4000", "4000", "Product sales", "revenue"),
  A("a4010", "4010", "Service revenue", "revenue"),
  A("a4020", "4020", "Subscription revenue", "revenue"),
  A("a4900", "4900", "Sales discounts", "revenue", "other", "Contra-revenue: discounts given to customers"),
  A("a5000", "5000", "Cost of goods sold", "expense"),
  A("a5100", "5100", "Hosting & cloud", "expense"),
  A("a5110", "5110", "Software & tools", "expense"),
  A("a5200", "5200", "Salaries & wages", "expense"),
  A("a5300", "5300", "Marketing", "expense"),
  A("a5400", "5400", "Office & rent", "expense"),
  A("a5500", "5500", "Professional fees", "expense"),
  A("a5900", "5900", "Purchase discounts", "expense", "other", "Contra-expense: discounts received from vendors"),
];

const T = (id: string, name: string, rate: number, inclusive: boolean, appliesTo: TaxRate["appliesTo"]): TaxRate => ({
  id,
  name,
  rate,
  inclusive,
  appliesTo,
  outputAccountId: "a2100",
  inputAccountId: "a1200",
  active: true,
});

export const SEED_TAXES: TaxRate[] = [
  T("t_vat", "VAT 7.5%", 7.5, false, "both"),
  T("t_vat_inc", "VAT 7.5% (price includes tax)", 7.5, true, "both"),
  T("t_zero", "Zero-rated", 0, false, "both"),
  T("t_exempt", "Exempt", 0, false, "both"),
];

export const SEED_DISCOUNTS: Discount[] = [
  { id: "d_trade", name: "Trade discount 5%", kind: "percent", value: 5, scope: "document", salesAccountId: "a4900", purchaseAccountId: "a5900", active: true },
  { id: "d_early", name: "Early payment 2%", kind: "percent", value: 2, scope: "document", salesAccountId: "a4900", purchaseAccountId: "a5900", active: true },
  { id: "d_loyal", name: "Loyalty 10%", kind: "percent", value: 10, scope: "line", salesAccountId: "a4900", purchaseAccountId: "a5900", active: true },
  { id: "d_promo", name: "Launch promo ₦25,000", kind: "fixed", value: 25000, scope: "line", salesAccountId: "a4900", purchaseAccountId: "a5900", active: true },
];

export const SEED_CATEGORIES: Category[] = [
  { id: "c_web", name: "Web design & build", kind: "service", revenueAccountId: "a4010", expenseAccountId: "a5500", defaultTaxId: "t_vat" },
  { id: "c_sub", name: "Retainers & subscriptions", kind: "service", revenueAccountId: "a4020", expenseAccountId: "a5110", defaultTaxId: "t_vat" },
  { id: "c_host", name: "Hosting & cloud", kind: "service", revenueAccountId: "a4020", expenseAccountId: "a5100", defaultTaxId: "t_vat" },
  { id: "c_hw", name: "Hardware & devices", kind: "product", revenueAccountId: "a4000", expenseAccountId: "a5000", defaultTaxId: "t_vat" },
  { id: "c_office", name: "Office & rent", kind: "service", revenueAccountId: "a4010", expenseAccountId: "a5400", defaultTaxId: "t_exempt" },
  { id: "c_mkt", name: "Marketing & ads", kind: "service", revenueAccountId: "a4010", expenseAccountId: "a5300", defaultTaxId: "t_vat" },
];

export const SEED_CONTACTS: Contact[] = [
  { id: "p_bright", name: "Brightside Agency", type: "customer", email: "accounts@brightside.example", phone: "+234 801 000 0001", taxId: "TIN 2204118-0001", defaultTaxId: "t_vat" },
  { id: "p_kopa", name: "Kopa Digital", type: "customer", email: "finance@kopa.example", phone: "+234 802 000 0002", defaultTaxId: "t_vat" },
  { id: "p_lagos", name: "Lagos Creative Co.", type: "customer", email: "pay@lagoscreative.example", phone: "+234 803 000 0003", defaultTaxId: "t_vat" },
  { id: "p_north", name: "Northwind Studio", type: "customer", email: "ap@northwind.example", phone: "+44 20 0000 0004", defaultTaxId: "t_zero" },
  { id: "p_cloud", name: "Cloudline Hosting", type: "vendor", email: "billing@cloudline.example", phone: "", defaultTaxId: "t_vat" },
  { id: "p_ikoyi", name: "Ikoyi Workspace", type: "vendor", email: "rent@ikoyiworkspace.example", phone: "+234 804 000 0005", defaultTaxId: "t_exempt" },
  { id: "p_ads", name: "AdReach Media", type: "vendor", email: "invoices@adreach.example", phone: "", defaultTaxId: "t_vat" },
  { id: "p_tech", name: "TechMart Lagos", type: "both", email: "sales@techmart.example", phone: "+234 805 000 0006", defaultTaxId: "t_vat" },
];

export function emptyBooks(): Books {
  return {
    settings: {
      companyName: "My company",
      currency: "NGN",
      locale: "en-NG",
      userName: "",
      invoicePrefix: "INV",
      billPrefix: "BILL",
    },
    accounts: SEED_ACCOUNTS,
    taxes: SEED_TAXES,
    discounts: SEED_DISCOUNTS,
    categories: SEED_CATEGORIES,
    contacts: SEED_CONTACTS,
    mappings: {
      "sales.receivable": "a1100",
      "sales.revenue": "a4010",
      "sales.discount": "a4900",
      "sales.tax": "a2100",
      "purchase.payable": "a2000",
      "purchase.expense": "a5500",
      "purchase.discount": "a5900",
      "purchase.tax": "a1200",
      "payment.bank": "a1010",
      "equity.retained": "a3100",
    },
    docs: [],
    journal: [],
    counters: { invoice: 0, bill: 0, journal: 0 },
  };
}

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Demo books anchored on today's date so every chart has data. */
export function demoBooks(today = todayISO()): Books {
  const rand = rng(360);
  let b = emptyBooks();
  const monthsBack = 7;
  const start = addDays(today, -monthsBack * 30);

  // opening balances
  b = appendEntry(b, {
    date: start,
    memo: "Opening balances",
    source: "manual",
    lines: [
      { accountId: "a1010", debit: 11_000_000, credit: 0, memo: "Opening bank" },
      { accountId: "a1020", debit: 3_200_000, credit: 0 },
      { accountId: "a1000", debit: 150_000, credit: 0 },
      { accountId: "a1500", debit: 2_400_000, credit: 0 },
      { accountId: "a3000", debit: 0, credit: 16_750_000, memo: "Owner's equity" },
    ],
  }).books;

  const customers = ["p_bright", "p_kopa", "p_lagos", "p_north"];
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const line = (i: number, description: string, categoryId: string, qty: number, price: number, extra: Partial<DocLine> = {}): DocLine => ({
    id: `l${i}`,
    description,
    categoryId,
    qty,
    unitPrice: price,
    taxId: "t_vat",
    ...extra,
  });

  const docs: Doc[] = [];
  const mk = (type: Doc["type"], date: string, contactId: string, lines: DocLine[], termsDays: number, docDisc?: string): Doc => ({
    id: `seed_${docs.length}`,
    type,
    number: "",
    contactId,
    date,
    dueDate: addDays(date, termsDays),
    status: "draft",
    lines,
    documentDiscountId: docDisc,
    notes: "",
    payments: [],
  });

  for (let m = monthsBack; m >= 0; m--) {
    const base = addDays(today, -m * 30);
    // invoices
    const n = 3 + Math.floor(rand() * 2);
    for (let i = 0; i < n; i++) {
      const date = addDays(base, -Math.floor(rand() * 24));
      if (date > today) continue;
      const c = pick(customers);
      const lines: DocLine[] = [
        line(1, pick(["Marketing site redesign", "Landing page build", "Brand microsite", "CMS migration"]), "c_web", 1, Math.round((650 + rand() * 900) * 1000), rand() > 0.6 ? { discountId: "d_loyal" } : {}),
        line(2, "Monthly care plan", "c_sub", 1 + Math.floor(rand() * 3), 120_000, c === "p_north" ? { taxId: "t_zero" } : {}),
      ];
      if (rand() > 0.7) lines.push(line(3, "Managed hosting (annual)", "c_host", 1, 180_000, { taxId: "t_vat_inc" }));
      docs.push(mk("invoice", date, c, lines, 14 + Math.floor(rand() * 3) * 7, rand() > 0.8 ? "d_trade" : undefined));
    }
    // bills
    const bills: [string, string, string, number, string?][] = [
      ["p_ikoyi", "Co-working desk rent", "c_office", 450_000, "t_exempt"],
      ["p_cloud", "Cloud servers & CDN", "c_host", 85_000 + Math.round(rand() * 60_000)],
      ["p_ads", "Performance ads", "c_mkt", 150_000 + Math.round(rand() * 200_000)],
    ];
    for (const [v, d, cat, price, tax] of bills) {
      const date = addDays(base, -Math.floor(rand() * 20));
      if (date > today) continue;
      docs.push(mk("bill", date, v, [line(1, d, cat, 1, price, { taxId: tax ?? "t_vat" })], 14));
    }
    if (rand() > 0.55) {
      const date = addDays(base, -Math.floor(rand() * 20));
      if (date <= today) docs.push(mk("bill", date, "p_tech", [line(1, "Laptop for new hire", "c_hw", 1, 1_150_000 + Math.round(rand() * 300_000), { discountId: "d_promo" })], 0));
    }
  }
  docs.sort((a, c) => a.date.localeCompare(c.date));

  // salaries as manual journals each month (Dr salaries, Cr bank)
  for (let m = monthsBack; m >= 0; m--) {
    const date = addDays(today, -m * 30 - 3);
    if (date > today) continue;
    b = appendEntry(b, {
      date,
      memo: "Payroll",
      source: "manual",
      lines: [
        { accountId: "a5200", debit: 1_100_000, credit: 0 },
        { accountId: "a1010", debit: 0, credit: 1_100_000 },
      ],
    }).books;
  }

  let ni = 0;
  let nb = 0;
  docs.forEach((d, idx) => {
    d.number = d.type === "invoice" ? `${b.settings.invoicePrefix}-${String(++ni).padStart(6, "0")}` : `${b.settings.billPrefix}-${String(++nb).padStart(6, "0")}`;
    b = { ...b, docs: [...b.docs, d], counters: { ...b.counters, invoice: ni, bill: nb } };
    const isLast = idx >= docs.length - 2;
    if (isLast && d.type === "invoice") return; // leave the two newest as drafts
    const r = postDoc(b, d.id);
    if (!r.ok) throw new Error("seed post failed: " + r.errors.join("; "));
    b = r.books;
    const posted = b.docs.find((x) => x.id === d.id)!;
    const total = posted.snapshot!.total;
    const age = (new Date(today).getTime() - new Date(d.date).getTime()) / 86400000;
    const roll = rand();
    const shouldPay = d.type === "bill" ? age > 12 : age > 25 && roll > 0.07;
    if (shouldPay) {
      const partial = d.type === "invoice" && roll > 0.85;
      const amt = partial ? r2(total * 0.5) : total;
      const payDate = addDays(d.date, Math.min(Math.floor(age) - 1, 6 + Math.floor(rand() * 20)));
      const p = recordPayment(b, d.id, {
        date: payDate > today ? today : payDate,
        amount: amt,
        accountId: d.type === "invoice" ? (rand() > 0.8 ? "a1020" : "a1010") : "a1010",
        reference: d.type === "invoice" ? "Transfer" : "Card",
      });
      if (p.ok) b = p.books;
    }
  });

  return b;
}
