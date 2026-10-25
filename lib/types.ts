export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  subtype?: "bank" | "cash" | "receivable" | "payable" | "tax" | "other";
  active: boolean;
  description?: string;
}

export interface TaxRate {
  id: string;
  name: string;
  /** percent, e.g. 7.5 */
  rate: number;
  /** true when entered prices already include this tax */
  inclusive: boolean;
  appliesTo: "sales" | "purchases" | "both";
  /** liability account credited when tax is charged on sales */
  outputAccountId: string;
  /** asset account debited when tax is paid on purchases */
  inputAccountId: string;
  active: boolean;
}

export interface Discount {
  id: string;
  name: string;
  kind: "percent" | "fixed";
  value: number;
  scope: "line" | "document";
  /** contra-revenue account used on sales */
  salesAccountId: string;
  /** contra-expense account used on purchases */
  purchaseAccountId: string;
  active: boolean;
}

export interface Category {
  id: string;
  name: string;
  kind: "product" | "service";
  revenueAccountId: string;
  expenseAccountId: string;
  defaultTaxId?: string;
}

export interface Contact {
  id: string;
  name: string;
  type: "customer" | "vendor" | "both";
  email: string;
  phone: string;
  taxId?: string;
  defaultTaxId?: string;
}

export type MappingKey =
  | "sales.receivable"
  | "sales.revenue"
  | "sales.discount"
  | "sales.tax"
  | "purchase.payable"
  | "purchase.expense"
  | "purchase.discount"
  | "purchase.tax"
  | "payment.bank"
  | "equity.retained";

export type Mappings = Record<MappingKey, string>;

export interface DocLine {
  id: string;
  description: string;
  categoryId: string;
  qty: number;
  unitPrice: number;
  discountId?: string;
  taxId?: string;
}

export interface ComputedLine {
  lineId: string;
  gross: number; // as entered (qty * price), tax-inclusive when tax is inclusive
  lineDiscount: number; // in entered terms
  docDiscount: number; // in entered terms
  net: number; // ex-tax, after all discounts
  tax: number;
  total: number;
  /** ex-tax figures used for posting */
  grossNet: number;
  lineDiscountNet: number;
  docDiscountNet: number;
}

export interface TaxBreakdown {
  taxId: string;
  name: string;
  rate: number;
  base: number;
  tax: number;
}

export interface ComputedDoc {
  lines: ComputedLine[];
  gross: number; // ex-tax gross
  discounts: number; // ex-tax discounts
  net: number;
  tax: number;
  total: number;
  taxes: TaxBreakdown[];
}

export interface Payment {
  id: string;
  date: string;
  amount: number;
  accountId: string;
  reference: string;
  journalEntryId: string;
}

export type DocStatus = "draft" | "posted" | "paid" | "void";

export interface Doc {
  id: string;
  type: "invoice" | "bill";
  number: string;
  contactId: string;
  date: string;
  dueDate: string;
  status: DocStatus;
  lines: DocLine[];
  documentDiscountId?: string;
  notes: string;
  journalEntryId?: string;
  snapshot?: ComputedDoc;
  payments: Payment[];
}

export interface JournalLine {
  accountId: string;
  debit: number;
  credit: number;
  memo?: string;
}

export interface JournalEntry {
  id: string;
  number: string;
  date: string;
  memo: string;
  source: "invoice" | "bill" | "payment" | "manual" | "reversal";
  sourceId?: string;
  reversalOf?: string;
  lines: JournalLine[];
}

export interface Settings {
  companyName: string;
  currency: string;
  locale: string;
  userName: string;
  invoicePrefix: string;
  billPrefix: string;
}

export interface Books {
  settings: Settings;
  accounts: Account[];
  taxes: TaxRate[];
  discounts: Discount[];
  categories: Category[];
  contacts: Contact[];
  mappings: Mappings;
  docs: Doc[];
  journal: JournalEntry[];
  counters: { invoice: number; bill: number; journal: number };
}
