export type ArtKey =
  | "flow" | "balance" | "kpi" | "chart" | "health" | "search" | "nav" | "quick" | "filters" | "table"
  | "contact" | "lines" | "order" | "summary" | "journal" | "post" | "accounts" | "tabs" | "resolve"
  | "defaults" | "tax" | "discount" | "category" | "entry" | "ledger" | "people" | "period" | "statements"
  | "payment" | "void" | "backup" | "done";

export interface Step {
  id: string;
  /** which page's tour this step belongs to */
  page: string;
  /** where the step lives (used by the full walkthrough to navigate) */
  path?: string;
  /** CSS selector of the element to spotlight; centred card if omitted or not found */
  target?: string;
  title: string;
  body: string;
  art?: ArtKey;
  /** excluded from the full walkthrough (needs data that may not exist) */
  pageOnly?: boolean;
}

export const PAGE_NAMES: Record<string, string> = {
  overview: "Overview",
  activity: "Activity",
  editor: "New invoice",
  doc: "Invoice",
  "manage-accounts": "Chart of accounts",
  "manage-mapping": "Account mapping",
  "manage-tax": "Tax rates",
  "manage-discounts": "Discounts",
  "manage-categories": "Categories",
  journal: "Journal",
  contacts: "Contacts",
  reports: "Reports",
  settings: "Settings",
  start: "Welcome",
};

const T = (s: string) => `[data-tour="${s}"]`;

export const STEPS: Step[] = [
  /* ---------------- start ---------------- */
  { id: "welcome", page: "start", path: "/", title: "How Books360 works", art: "flow", body: "You record an invoice or bill. Books360 turns it into a balanced journal entry using your account mapping, tax rates and discounts. Reports read straight from that journal, so every number can be traced." },

  /* ---------------- overview ---------------- */
  { id: "ov-balance", page: "overview", path: "/", target: T("balance"), title: "Your cash position", art: "balance", body: "Total of your bank and cash accounts, compared with last month. Click any account below it to open its ledger. Use New invoice or New bill to start work." },
  { id: "ov-kpis", page: "overview", path: "/", target: T("kpis"), title: "This month at a glance", art: "kpi", body: "Revenue and expenses for the month, plus what customers still owe you (receivables) and what you owe vendors (payables)." },
  { id: "ov-chart", page: "overview", path: "/", target: T("profit-chart"), title: "Profit and expenses", art: "chart", body: "Each column is one month. Black is what you spent; the hatched green on top is what you kept as profit. Hover a column for the exact figures." },
  { id: "ov-collected", page: "overview", path: "/", target: T("collected"), title: "Collections", body: "How much of this month's invoices has been paid so far. The orange bar fills as payments are recorded." },
  { id: "ov-health", page: "overview", path: "/", target: T("mapping-health"), title: "Account mapping health", art: "health", body: "Shows whether every posting rule points to a valid account. If something breaks, it's flagged here before it can block an invoice." },
  { id: "ov-recent", page: "overview", path: "/", target: T("recent"), title: "Recent activity", art: "table", body: "Your latest invoices and bills with their status. Click a row to open it, see its journal entry or record a payment." },
  { id: "ov-search", page: "overview", path: "/", target: T("search"), title: "Find anything", art: "search", body: "Type an invoice number, customer, account code or page name. Use the arrow keys and Enter to jump straight there." },
  { id: "ov-bell", page: "overview", path: "/", target: T("bell"), title: "Needs attention", body: "Overdue invoices, drafts waiting to be posted and mapping problems collect here." },
  { id: "ov-nav", page: "overview", path: "/", target: T("nav"), title: "Move around", art: "nav", body: "Overview, Activity, Manage (setup), Journal, Contacts and Reports. This bar stays with you on every page." },
  { id: "ov-quick", page: "overview", path: "/", target: T("quick"), title: "Create from anywhere", art: "quick", body: "The + button opens shortcuts for a new invoice, bill, journal entry, account or contact." },

  /* ---------------- activity ---------------- */
  { id: "ac-filters", page: "activity", path: "/activity", target: T("activity-filters"), title: "Filter your documents", art: "filters", body: "Switch between invoices and bills, search by number or contact, and filter by status: draft, open, overdue, paid or void." },
  { id: "ac-table", page: "activity", path: "/activity", target: T("activity-table"), title: "Net, tax, total and balance", art: "table", body: "Each row shows the amount before tax, the tax, the total and what is still unpaid. Click a row to open it." },
  { id: "ac-new", page: "activity", path: "/activity", target: T("new-invoice"), title: "Create an invoice", body: "Next we'll look at the editor where discounts and tax are applied." },

  /* ---------------- editor ---------------- */
  { id: "ed-header", page: "editor", path: "/activity/new?type=invoice", target: T("doc-header"), title: "Who and when", art: "contact", body: "Pick the customer (or vendor on a bill) and set the date and due date. Overdue status is calculated from the due date." },
  { id: "ed-lines", page: "editor", path: "/activity/new?type=invoice", target: T("doc-lines"), title: "Add lines", art: "lines", body: "Each line has a category, quantity, price, an optional discount and a tax rate. The category decides which revenue account the line posts to, and suggests a tax rate." },
  { id: "ed-order", page: "editor", path: "/activity/new?type=invoice", target: T("doc-discount"), title: "Document discount", art: "order", body: "A document discount is shared across all lines. Order of calculation: line discount, then document discount, then tax on what's left." },
  { id: "ed-summary", page: "editor", path: "/activity/new?type=invoice", target: T("doc-summary"), title: "Live totals", art: "summary", body: "Subtotal, discounts, tax by rate and the final amount update as you type. Inclusive tax is split out of the price; exclusive tax is added on top." },
  { id: "ed-journal", page: "editor", path: "/activity/new?type=invoice", target: T("doc-journal"), title: "Journal preview", art: "journal", body: "Before you post, see exactly which accounts will be debited and credited. This is your account mapping at work. Debits always equal credits." },
  { id: "ed-post", page: "editor", path: "/activity/new?type=invoice", target: T("doc-post"), title: "Save or post", art: "post", body: "Save draft keeps it editable. Post writes the journal entry and locks the document. Mistakes are fixed with a void, which posts a reversal." },

  /* ---------------- posted document ---------------- */
  { id: "dv-lines", page: "doc", target: T("view-lines"), title: "The posted document", body: "Amounts are frozen at the moment of posting, so changing a tax rate later never alters past documents.", pageOnly: true },
  { id: "dv-journal", page: "doc", target: T("view-journal"), title: "Its journal entry", art: "journal", body: "The exact debits and credits that were recorded. Open it in the journal to trace it further.", pageOnly: true },
  { id: "dv-pay", page: "doc", target: T("pay-btn"), title: "Record a payment", art: "payment", body: "Enter the full or a part payment and choose the bank account. The invoice becomes Paid when the balance reaches zero.", pageOnly: true },
  { id: "dv-void", page: "doc", target: T("void-btn"), title: "Void instead of delete", art: "void", body: "Voiding posts a reversing entry and keeps the original in your audit trail. Remove payments first if there are any.", pageOnly: true },

  /* ---------------- manage: accounts ---------------- */
  { id: "ma-tabs", page: "manage-accounts", path: "/manage?tab=accounts", target: T("manage-tabs"), title: "Setup lives here", art: "tabs", body: "Chart of accounts, account mapping, tax rates, discounts and categories. A number on Account mapping means something needs fixing." },
  { id: "ma-list", page: "manage-accounts", path: "/manage?tab=accounts", target: T("accounts-list"), title: "Chart of accounts", art: "accounts", body: "Every account grouped by type with its live balance. The “rules” badge shows how many mapping rules use it. Accounts with entries can be deactivated but not deleted." },
  { id: "ma-new", page: "manage-accounts", path: "/manage?tab=accounts", target: T("accounts-toolbar"), title: "Add or hide accounts", body: "Create accounts with a code and type. Mark one as Bank or Cash and it appears on the dashboard and in payments." },

  /* ---------------- manage: mapping ---------------- */
  { id: "mm-how", page: "manage-mapping", path: "/manage?tab=mapping", target: T("map-how"), title: "How a posting finds its account", art: "resolve", body: "First the line's own rule (category, tax or discount), then your default. Posting stops if the account is missing, inactive or the wrong type." },
  { id: "mm-defaults", page: "manage-mapping", path: "/manage?tab=mapping", target: T("map-defaults"), title: "Defaults", art: "defaults", body: "Choose the fallback accounts for receivables, payables, revenue, expenses, discounts, tax and bank. Each dropdown only offers accounts of a valid type." },
  { id: "mm-cat", page: "manage-mapping", path: "/manage?tab=mapping", target: T("map-categories"), title: "Per-category mapping", art: "category", body: "Send web design to Service revenue and hosting to Subscription revenue. Leave “Use default” to fall back." },
  { id: "mm-items", page: "manage-mapping", path: "/manage?tab=mapping", target: T("map-items"), title: "Tax and discount accounts", body: "Each tax rate has an output account (collected on sales) and an input account (paid on purchases). Each discount has its own account, so discounts show up separately in reports." },

  /* ---------------- manage: tax ---------------- */
  { id: "mt-table", page: "manage-tax", path: "/manage?tab=tax", target: T("tax-table"), title: "Tax rates", art: "tax", body: "Exclusive adds tax on top: ₦100,000 becomes ₦107,500. Inclusive splits it out of the price: ₦107,500 contains ₦7,500 of tax. Zero-rated and exempt rates are tracked too." },
  { id: "mt-new", page: "manage-tax", path: "/manage?tab=tax", target: T("tax-new"), title: "Add a rate", body: "Name it, set the percentage, choose inclusive or exclusive, and say whether it applies to sales, purchases or both." },

  /* ---------------- manage: discounts ---------------- */
  { id: "md-table", page: "manage-discounts", path: "/manage?tab=discounts", target: T("disc-table"), title: "Discounts", art: "discount", body: "Percent or fixed. Line discounts reduce one line; document discounts are shared across the whole invoice. Tax is always calculated after discounts." },
  { id: "md-new", page: "manage-discounts", path: "/manage?tab=discounts", target: T("disc-new"), title: "Add a discount", body: "Pick the account it posts to when you give it to a customer and when you receive it from a vendor." },

  /* ---------------- manage: categories ---------------- */
  { id: "mc-table", page: "manage-categories", path: "/manage?tab=categories", target: T("cat-table"), title: "Categories", art: "category", body: "A category links a kind of work to its revenue account, expense account and default tax. Picking it on a line fills in the right tax automatically." },

  /* ---------------- journal ---------------- */
  { id: "jr-views", page: "journal", path: "/journal", target: T("journal-views"), title: "Entries and ledger", art: "ledger", body: "Entries lists every posting. Account ledger shows one account's movements with a running balance. Filter by source: invoice, bill, payment, manual or reversal." },
  { id: "jr-list", page: "journal", path: "/journal", target: T("journal-list"), title: "Every posting, in one place", art: "journal", body: "Click an entry to expand its debits and credits, or jump to the document that created it. Reversal entries show how voids are handled." },
  { id: "jr-new", page: "journal", path: "/journal", target: T("journal-new"), title: "Manual entries", art: "entry", body: "For payroll, depreciation or opening balances. The entry only posts when debits equal credits." },

  /* ---------------- contacts ---------------- */
  { id: "ct-grid", page: "contacts", path: "/contacts", target: T("contact-grid"), title: "Customers and vendors", art: "people", body: "Each card shows total billed and what's outstanding. Set a default tax rate per contact to save clicks on every line." },
  { id: "ct-new", page: "contacts", path: "/contacts", target: T("contact-new"), title: "Add a contact", body: "A contact can be a customer, a vendor, or both." },

  /* ---------------- reports ---------------- */
  { id: "rp-period", page: "reports", path: "/reports", target: T("report-period"), title: "Choose a period", art: "period", body: "This month, last month, this year or all time. Everything on the page, including comparisons with the previous period, follows it." },
  { id: "rp-kpis", page: "reports", path: "/reports", target: T("report-kpis"), title: "Key figures", body: "Revenue, expenses, net profit and margin, each compared with the previous period." },
  { id: "rp-chart", page: "reports", path: "/reports", target: T("report-chart"), title: "Income vs expenses", art: "chart", body: "Hover to compare any point. Short periods show a running total; longer ones show month by month." },
  { id: "rp-tabs", page: "reports", path: "/reports", target: T("report-tabs"), title: "Statements", art: "statements", body: "Profit and loss, balance sheet, trial balance, tax summary (what you owe the tax authority), discounts used, and receivables and payables ageing." },
  { id: "rp-body", page: "reports", path: "/reports", target: T("report-body"), title: "Export it", body: "Every statement can be downloaded as CSV with the Export button at the top." },

  /* ---------------- settings ---------------- */
  { id: "st-company", page: "settings", path: "/settings", target: T("settings-company"), title: "Company details", body: "Name, currency, number format and the prefixes used for new invoice and bill numbers." },
  { id: "st-data", page: "settings", path: "/settings", target: T("settings-data"), title: "Your data", art: "backup", body: "Data is stored in this browser. Download a backup regularly, restore it on another device, or reload the demo data." },

  /* ---------------- finish ---------------- */
  { id: "done", page: "overview", path: "/", title: "You're ready", art: "done", body: "Replay any tour from the help button in the top bar. Start with Manage → Account mapping to set up your own accounts, then create your first invoice." },
];

export function pageKey(path: string, tab: string | null): string {
  if (path === "/") return "overview";
  if (path === "/activity") return "activity";
  if (path === "/activity/new") return "editor";
  if (path.startsWith("/activity/")) return "doc";
  if (path === "/manage") return `manage-${["accounts", "mapping", "tax", "discounts", "categories"].includes(tab ?? "") ? tab : "accounts"}`;
  if (path === "/journal") return "journal";
  if (path === "/contacts") return "contacts";
  if (path === "/reports") return "reports";
  if (path === "/settings") return "settings";
  return "overview";
}

export const FULL_TOUR = STEPS.filter((s) => !s.pageOnly);
export const pageSteps = (key: string) => STEPS.filter((s) => s.page === key && s.id !== "done");
