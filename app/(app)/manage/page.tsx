"use client";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useBooks } from "@/lib/store";
import { useFmt } from "@/lib/hooks";
import { accountBalance, accountUsage, MAPPING_META, mappingIssues, sums } from "@/lib/engine";
import type { Account, AccountType, Category, Discount, TaxRate } from "@/lib/types";
import { Card, Chip, Confirm, Empty, ErrorList, Field, Modal, NumInput, PageHeader, Toggle, toast } from "@/components/ui";

const TABS = [
  { id: "accounts", label: "Chart of accounts" },
  { id: "mapping", label: "Account mapping" },
  { id: "tax", label: "Tax rates" },
  { id: "discounts", label: "Discounts" },
  { id: "categories", label: "Categories" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const TYPE_LABEL: Record<AccountType, string> = { asset: "Assets", liability: "Liabilities", equity: "Equity", revenue: "Revenue", expense: "Expenses" };
const TYPE_ORDER: AccountType[] = ["asset", "liability", "equity", "revenue", "expense"];

function Inner() {
  const sp = useSearchParams();
  const router = useRouter();
  const tab = (TABS.find((t) => t.id === sp.get("tab"))?.id ?? "accounts") as Tab;
  const books = useBooks((s) => s.books);
  const issues = useMemo(() => mappingIssues(books).length, [books]);
  return (
    <>
      <PageHeader title="Manage" sub="The setup behind every posting: accounts, how transactions map to them, tax rates and discounts." />
      <div data-tour="manage-tabs" className="scroll-thin mb-5 flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Setup sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => router.replace(`/manage?tab=${t.id}`)}
            className={`h-10 flex-none rounded-full px-4 text-[13.5px] font-medium transition ${tab === t.id ? "bg-ink text-white" : "bg-white/50 hover:bg-white/80"}`}
          >
            {t.label}
            {t.id === "mapping" && issues > 0 && <span className="ml-2 rounded-full bg-accent px-1.5 py-0.5 text-[10px] text-white">{issues}</span>}
          </button>
        ))}
      </div>
      {tab === "accounts" && <AccountsTab openNew={sp.get("new") === "1"} />}
      {tab === "mapping" && <MappingTab />}
      {tab === "tax" && <TaxTab />}
      {tab === "discounts" && <DiscountTab />}
      {tab === "categories" && <CategoryTab />}
    </>
  );
}

export default function ManagePage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */
function AccountSelect({ value, onChange, types, blankLabel, className = "" }: { value: string; onChange: (v: string) => void; types: AccountType[]; blankLabel?: string; className?: string }) {
  const accounts = useBooks((s) => s.books.accounts);
  const list = accounts.filter((a) => types.includes(a.type) && (a.active || a.id === value));
  return (
    <select className={`field sm ${className}`} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!blankLabel && !value}>
      {blankLabel !== undefined ? <option value="">{blankLabel}</option> : !value && <option value="">Choose account…</option>}
      {list.map((a) => (
        <option key={a.id} value={a.id}>{a.code} · {a.name}{!a.active ? " (inactive)" : ""}</option>
      ))}
    </select>
  );
}

/* ------------------------------------------------------------------ */
/* Chart of accounts                                                   */
/* ------------------------------------------------------------------ */
const blankAccount = (): Omit<Account, "id"> & { id?: string } => ({ code: "", name: "", type: "asset", subtype: "other", active: true, description: "" });

function AccountsTab({ openNew }: { openNew: boolean }) {
  const books = useBooks((s) => s.books);
  const { saveAccount, deleteAccount } = useBooks.getState();
  const { fmt } = useFmt();
  const [edit, setEdit] = useState<(Omit<Account, "id"> & { id?: string }) | null>(null);
  const [del, setDel] = useState<Account | null>(null);
  const [errs, setErrs] = useState<string[]>([]);
  const bal = useMemo(() => sums(books), [books]);
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    if (openNew) setEdit(blankAccount());
  }, [openNew]);

  const save = () => {
    if (!edit) return;
    const e: string[] = [];
    if (!edit.code.trim()) e.push("Enter an account code.");
    if (!edit.name.trim()) e.push("Enter an account name.");
    if (books.accounts.some((a) => a.code === edit.code.trim() && a.id !== edit.id)) e.push(`Code ${edit.code} is already used.`);
    if (e.length) return setErrs(e);
    saveAccount({ ...edit, code: edit.code.trim(), name: edit.name.trim() });
    toast(edit.id ? "Account updated" : "Account added");
    setEdit(null);
  };

  const onDelete = (a: Account) => {
    const u = accountUsage(books, a.id);
    if (u.hasEntries || u.uses.length) {
      toast(u.hasEntries ? "This account has journal entries. Deactivate it instead." : `Used by ${u.uses[0]}. Remap it first, or deactivate.`, "error");
      return;
    }
    setDel(a);
  };

  return (
    <>
      <div data-tour="accounts-toolbar" className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2.5 text-sm"><Toggle checked={showInactive} onChange={setShowInactive} label="Show inactive accounts" /> Show inactive</label>
        <button className="btn btn-dark" onClick={() => { setErrs([]); setEdit(blankAccount()); }}><Plus size={16} /> New account</button>
      </div>
      <div data-tour="accounts-list" className="grid gap-4">
        {TYPE_ORDER.map((t) => {
          const list = books.accounts.filter((a) => a.type === t && (showInactive || a.active)).sort((a, b) => a.code.localeCompare(b.code));
          const total = list.reduce((s, a) => s + accountBalance(a, bal), 0);
          return (
            <Card key={t} title={TYPE_LABEL[t]} action={<span className="num muted text-sm">{fmt(total)}</span>} className="!p-3 md:!p-4">
              {list.length === 0 ? (
                <Empty title={`No ${TYPE_LABEL[t].toLowerCase()} accounts`} />
              ) : (
                <div className="scroll-thin overflow-x-auto">
                  <table className="w-full min-w-[560px]">
                    <tbody>
                      {list.map((a) => {
                        const u = accountUsage(books, a.id);
                        return (
                          <tr key={a.id} className="trow">
                            <td className="num w-20 font-medium">{a.code}</td>
                            <td>
                              <div className={a.active ? "" : "muted"}>{a.name}</div>
                              {a.description && <div className="muted text-xs">{a.description}</div>}
                            </td>
                            <td className="w-48">
                              <div className="flex flex-wrap gap-1.5">
                                {a.subtype && a.subtype !== "other" && <Chip>{a.subtype}</Chip>}
                                {u.uses.length > 0 && <Chip tone="mint">{u.uses.length} rule{u.uses.length > 1 ? "s" : ""}</Chip>}
                                {!a.active && <Chip tone="amber">Inactive</Chip>}
                              </div>
                            </td>
                            <td className="num w-36 text-right font-medium">{fmt(accountBalance(a, bal))}</td>
                            <td className="w-24 text-right">
                              <div className="flex justify-end gap-1">
                                <button aria-label={`Edit ${a.name}`} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white" onClick={() => { setErrs([]); setEdit({ ...a }); }}><Pencil size={14} /></button>
                                <button aria-label={`Delete ${a.name}`} className="grid h-8 w-8 place-items-center rounded-full hover:bg-rose-bg hover:text-rose-fg" onClick={() => onDelete(a)}><Trash2 size={14} /></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Edit account" : "New account"} footer={<><button className="btn btn-light" onClick={() => setEdit(null)}>Cancel</button><button className="btn btn-dark" onClick={save}>Save account</button></>}>
        {edit && (
          <div className="grid gap-4">
            <div className="grid grid-cols-3 gap-4">
              <Field label="Code"><input className="field num" value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value })} placeholder="1250" /></Field>
              <Field label="Name" className="col-span-2"><input className="field" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Staff loans" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Type" hint={edit.id && accountUsage(books, edit.id).hasEntries ? "Has entries — changing type changes your reports." : undefined}>
                <select className="field" value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value as AccountType })}>
                  {TYPE_ORDER.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                </select>
              </Field>
              <Field label="Role" hint="Bank and cash accounts appear on the dashboard and in payments.">
                <select className="field" value={edit.subtype ?? "other"} onChange={(e) => setEdit({ ...edit, subtype: e.target.value as Account["subtype"] })}>
                  <option value="other">None</option>
                  <option value="bank">Bank</option>
                  <option value="cash">Cash</option>
                  <option value="receivable">Receivable</option>
                  <option value="payable">Payable</option>
                  <option value="tax">Tax</option>
                </select>
              </Field>
            </div>
            <Field label="Description"><input className="field" value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
            <label className="flex items-center justify-between gap-3 text-sm"><span>Active<span className="muted block text-xs">Inactive accounts can't be picked for new postings.</span></span><Toggle checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} label="Active" /></label>
            <ErrorList errors={errs} />
          </div>
        )}
      </Modal>
      <Confirm open={!!del} danger title={`Delete ${del?.name}?`} body="This account has no entries and isn't used by any rule." confirmLabel="Delete account" onClose={() => setDel(null)} onConfirm={() => { deleteAccount(del!.id); toast("Account deleted"); }} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Account mapping                                                     */
/* ------------------------------------------------------------------ */
function MappingTab() {
  const books = useBooks((s) => s.books);
  const { setMapping, saveCategory, saveTax, saveDiscount } = useBooks.getState();
  const issues = mappingIssues(books);
  const groups = ["Sales", "Purchases", "Payments & equity"] as const;
  const acc = (id: string) => books.accounts.find((a) => a.id === id);
  const dflt = (key: keyof typeof books.mappings) => acc(books.mappings[key]);

  return (
    <div className="grid gap-4">
      <Card tour="map-how" title="How a posting finds its account">
        <ol className="grid gap-3 text-sm sm:grid-cols-3">
          {[
            ["The line's own rule", "Category, tax rate or discount, if you've set an account on it below."],
            ["Your default", "Otherwise the default for that kind of posting (first card below)."],
            ["A check before posting", "Posting stops if the account is missing, inactive or the wrong type."],
          ].map(([t, d], i) => (
            <li key={t} className="tile-flat flex gap-3 p-3.5">
              <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-ink text-xs font-semibold text-white">{i + 1}</span>
              <span><b className="block font-semibold">{t}</b><span className="muted">{d}</span></span>
            </li>
          ))}
        </ol>
      </Card>

      <div data-tour="map-defaults" className="grid gap-4 lg:grid-cols-3">
        {groups.map((g) => (
          <Card key={g} title={`${g} defaults`}>
            <div className="grid gap-4">
              {MAPPING_META.filter((m) => m.group === g).map((m) => {
                const issue = issues.find((i) => i.key === m.key);
                return (
                  <Field key={m.key} label={m.label} hint={issue ? undefined : m.help} error={issue ? `${issue.reason}. ${m.help}` : undefined}>
                    <AccountSelect value={books.mappings[m.key]} types={m.types} onChange={(v) => { setMapping(m.key, v); toast(`${m.label} mapped`); }} />
                  </Field>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      <Card tour="map-categories" title="Categories" className="!p-3 md:!p-5">
        <p className="muted mb-3 px-1 text-[13px]">Where each category's sales and purchases land. “Use default” falls back to {dflt("sales.revenue")?.name ?? "—"} for revenue and {dflt("purchase.expense")?.name ?? "—"} for expenses.</p>
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="thead"><tr><th>Category</th><th>Revenue account (sales)</th><th>Expense account (purchases)</th></tr></thead>
            <tbody>
              {books.categories.map((c) => (
                <tr key={c.id} className="trow">
                  <td className="font-medium">{c.name}</td>
                  <td><AccountSelect value={c.revenueAccountId} types={["revenue"]} blankLabel="Use default" onChange={(v) => saveCategory({ ...c, revenueAccountId: v })} /></td>
                  <td><AccountSelect value={c.expenseAccountId} types={["expense", "asset"]} blankLabel="Use default" onChange={(v) => saveCategory({ ...c, expenseAccountId: v })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div data-tour="map-items" className="grid gap-4 lg:grid-cols-2">
        <Card title="Tax rates" className="!p-3 md:!p-5">
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[460px]">
              <thead className="thead"><tr><th>Tax</th><th>Output (sales)</th><th>Input (purchases)</th></tr></thead>
              <tbody>
                {books.taxes.map((t) => (
                  <tr key={t.id} className="trow">
                    <td className="font-medium">{t.name}</td>
                    <td><AccountSelect value={t.outputAccountId} types={["liability"]} blankLabel="Use default" onChange={(v) => saveTax({ ...t, outputAccountId: v })} /></td>
                    <td><AccountSelect value={t.inputAccountId} types={["asset"]} blankLabel="Use default" onChange={(v) => saveTax({ ...t, inputAccountId: v })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Discounts" className="!p-3 md:!p-5">
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[460px]">
              <thead className="thead"><tr><th>Discount</th><th>Given (sales)</th><th>Received (purchases)</th></tr></thead>
              <tbody>
                {books.discounts.map((d) => (
                  <tr key={d.id} className="trow">
                    <td className="font-medium">{d.name}</td>
                    <td><AccountSelect value={d.salesAccountId} types={["revenue", "expense"]} blankLabel="Use default" onChange={(v) => saveDiscount({ ...d, salesAccountId: v })} /></td>
                    <td><AccountSelect value={d.purchaseAccountId} types={["expense", "revenue"]} blankLabel="Use default" onChange={(v) => saveDiscount({ ...d, purchaseAccountId: v })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tax rates                                                           */
/* ------------------------------------------------------------------ */
function docsUsing(books: ReturnType<typeof useBooks.getState>["books"], kind: "tax" | "discount" | "category", id: string) {
  return books.docs.filter((d) =>
    kind === "tax" ? d.lines.some((l) => l.taxId === id) : kind === "discount" ? d.documentDiscountId === id || d.lines.some((l) => l.discountId === id) : d.lines.some((l) => l.categoryId === id),
  ).length;
}

type TaxDraft = Omit<TaxRate, "id"> & { id?: string };
function TaxTab() {
  const books = useBooks((s) => s.books);
  const { saveTax, deleteTax } = useBooks.getState();
  const [edit, setEdit] = useState<TaxDraft | null>(null);
  const [del, setDel] = useState<TaxRate | null>(null);
  const [errs, setErrs] = useState<string[]>([]);
  const blank = (): TaxDraft => ({ name: "", rate: 0, inclusive: false, appliesTo: "both", outputAccountId: books.mappings["sales.tax"], inputAccountId: books.mappings["purchase.tax"], active: true });
  const acc = (id: string) => books.accounts.find((a) => a.id === id);

  const save = () => {
    if (!edit) return;
    const e: string[] = [];
    if (!edit.name.trim()) e.push("Enter a name.");
    if (edit.rate < 0 || edit.rate > 100) e.push("Rate must be between 0 and 100.");
    if (e.length) return setErrs(e);
    saveTax({ ...edit, name: edit.name.trim() });
    toast("Tax rate saved");
    setEdit(null);
  };

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="muted max-w-xl text-sm">Rates apply per line. <b className="font-medium text-ink">Exclusive</b> adds tax on top of the price; <b className="font-medium text-ink">inclusive</b> splits it out of the price. Changing a rate never alters posted documents.</p>
        <button data-tour="tax-new" className="btn btn-dark" onClick={() => { setErrs([]); setEdit(blank()); }}><Plus size={16} /> New tax rate</button>
      </div>
      <Card tour="tax-table" className="!p-3 md:!p-4">
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead className="thead"><tr><th>Name</th><th className="text-right">Rate</th><th>Method</th><th>Applies to</th><th>Posts to</th><th /></tr></thead>
            <tbody>
              {books.taxes.map((t) => (
                <tr key={t.id} className="trow">
                  <td><span className={`font-medium ${t.active ? "" : "muted"}`}>{t.name}</span>{!t.active && <span className="ml-2"><Chip tone="amber">Inactive</Chip></span>}</td>
                  <td className="num text-right font-medium">{t.rate}%</td>
                  <td>{t.inclusive ? "Inclusive" : "Exclusive"}</td>
                  <td className="capitalize">{t.appliesTo}</td>
                  <td className="text-[12.5px]"><div>{acc(t.outputAccountId)?.name ?? <span className="muted">Default output</span>}</div><div className="muted">{acc(t.inputAccountId)?.name ?? "Default input"}</div></td>
                  <td className="w-24 text-right">
                    <div className="flex justify-end gap-1">
                      <button aria-label={`Edit ${t.name}`} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white" onClick={() => { setErrs([]); setEdit({ ...t }); }}><Pencil size={14} /></button>
                      <button aria-label={`Delete ${t.name}`} className="grid h-8 w-8 place-items-center rounded-full hover:bg-rose-bg hover:text-rose-fg" onClick={() => { const n = docsUsing(books, "tax", t.id); n ? toast(`Used on ${n} document${n > 1 ? "s" : ""}. Deactivate it instead.`, "error") : setDel(t); }}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Edit tax rate" : "New tax rate"} footer={<><button className="btn btn-light" onClick={() => setEdit(null)}>Cancel</button><button className="btn btn-dark" onClick={save}>Save tax rate</button></>}>
        {edit && (
          <div className="grid gap-4">
            <div className="grid grid-cols-3 gap-4">
              <Field label="Name" className="col-span-2"><input className="field" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="VAT 7.5%" /></Field>
              <Field label="Rate (%)"><NumInput value={edit.rate} onChange={(n) => setEdit({ ...edit, rate: n })} className="text-right" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Applies to">
                <select className="field" value={edit.appliesTo} onChange={(e) => setEdit({ ...edit, appliesTo: e.target.value as TaxRate["appliesTo"] })}>
                  <option value="both">Sales and purchases</option><option value="sales">Sales only</option><option value="purchases">Purchases only</option>
                </select>
              </Field>
              <label className="flex flex-col gap-1.5 text-[13px] font-medium">Price includes tax<div className="flex h-[42px] items-center"><Toggle checked={edit.inclusive} onChange={(v) => setEdit({ ...edit, inclusive: v })} label="Price includes tax" /></div></label>
            </div>
            <Field label="Output account (tax collected on sales)"><AccountSelect value={edit.outputAccountId} types={["liability"]} blankLabel="Use default" onChange={(v) => setEdit({ ...edit, outputAccountId: v })} className="!h-[42px] !rounded-[14px] !text-sm" /></Field>
            <Field label="Input account (tax paid on purchases)"><AccountSelect value={edit.inputAccountId} types={["asset"]} blankLabel="Use default" onChange={(v) => setEdit({ ...edit, inputAccountId: v })} className="!h-[42px] !rounded-[14px] !text-sm" /></Field>
            <label className="flex items-center justify-between text-sm">Active<Toggle checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} label="Active" /></label>
            <ErrorList errors={errs} />
          </div>
        )}
      </Modal>
      <Confirm open={!!del} danger title={`Delete ${del?.name}?`} body="It isn't used on any document." confirmLabel="Delete tax rate" onClose={() => setDel(null)} onConfirm={() => { deleteTax(del!.id); toast("Tax rate deleted"); }} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Discounts                                                           */
/* ------------------------------------------------------------------ */
type DiscDraft = Omit<Discount, "id"> & { id?: string };
function DiscountTab() {
  const books = useBooks((s) => s.books);
  const { saveDiscount, deleteDiscount } = useBooks.getState();
  const { fmt } = useFmt();
  const [edit, setEdit] = useState<DiscDraft | null>(null);
  const [del, setDel] = useState<Discount | null>(null);
  const [errs, setErrs] = useState<string[]>([]);
  const blank = (): DiscDraft => ({ name: "", kind: "percent", value: 0, scope: "line", salesAccountId: books.mappings["sales.discount"], purchaseAccountId: books.mappings["purchase.discount"], active: true });
  const acc = (id: string) => books.accounts.find((a) => a.id === id);

  const save = () => {
    if (!edit) return;
    const e: string[] = [];
    if (!edit.name.trim()) e.push("Enter a name.");
    if (!(edit.value > 0)) e.push("Enter a value above zero.");
    if (edit.kind === "percent" && edit.value > 100) e.push("A percentage can't be above 100.");
    if (e.length) return setErrs(e);
    saveDiscount({ ...edit, name: edit.name.trim() });
    toast("Discount saved");
    setEdit(null);
  };

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="muted max-w-xl text-sm"><b className="font-medium text-ink">Line</b> discounts come off one line. <b className="font-medium text-ink">Document</b> discounts are shared across all lines. Tax is always worked out after discounts.</p>
        <button data-tour="disc-new" className="btn btn-dark" onClick={() => { setErrs([]); setEdit(blank()); }}><Plus size={16} /> New discount</button>
      </div>
      <Card tour="disc-table" className="!p-3 md:!p-4">
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead className="thead"><tr><th>Name</th><th className="text-right">Value</th><th>Scope</th><th>Posts to</th><th /></tr></thead>
            <tbody>
              {books.discounts.map((d) => (
                <tr key={d.id} className="trow">
                  <td><span className={`font-medium ${d.active ? "" : "muted"}`}>{d.name}</span>{!d.active && <span className="ml-2"><Chip tone="amber">Inactive</Chip></span>}</td>
                  <td className="num text-right font-medium">{d.kind === "percent" ? `${d.value}%` : fmt(d.value)}</td>
                  <td className="capitalize">{d.scope}</td>
                  <td className="text-[12.5px]"><div>{acc(d.salesAccountId)?.name ?? <span className="muted">Default sales discount</span>}</div><div className="muted">{acc(d.purchaseAccountId)?.name ?? "Default purchase discount"}</div></td>
                  <td className="w-24 text-right">
                    <div className="flex justify-end gap-1">
                      <button aria-label={`Edit ${d.name}`} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white" onClick={() => { setErrs([]); setEdit({ ...d }); }}><Pencil size={14} /></button>
                      <button aria-label={`Delete ${d.name}`} className="grid h-8 w-8 place-items-center rounded-full hover:bg-rose-bg hover:text-rose-fg" onClick={() => { const n = docsUsing(books, "discount", d.id); n ? toast(`Used on ${n} document${n > 1 ? "s" : ""}. Deactivate it instead.`, "error") : setDel(d); }}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Edit discount" : "New discount"} footer={<><button className="btn btn-light" onClick={() => setEdit(null)}>Cancel</button><button className="btn btn-dark" onClick={save}>Save discount</button></>}>
        {edit && (
          <div className="grid gap-4">
            <Field label="Name"><input className="field" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Early payment 2%" /></Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Type">
                <select className="field" value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value as Discount["kind"] })}><option value="percent">Percent</option><option value="fixed">Fixed amount</option></select>
              </Field>
              <Field label={edit.kind === "percent" ? "Percent" : "Amount"}><NumInput value={edit.value} onChange={(n) => setEdit({ ...edit, value: n })} className="text-right" /></Field>
              <Field label="Scope">
                <select className="field" value={edit.scope} onChange={(e) => setEdit({ ...edit, scope: e.target.value as Discount["scope"] })}><option value="line">Per line</option><option value="document">Whole document</option></select>
              </Field>
            </div>
            <Field label="Account when given to a customer"><AccountSelect value={edit.salesAccountId} types={["revenue", "expense"]} blankLabel="Use default" onChange={(v) => setEdit({ ...edit, salesAccountId: v })} className="!h-[42px] !rounded-[14px] !text-sm" /></Field>
            <Field label="Account when received from a vendor"><AccountSelect value={edit.purchaseAccountId} types={["expense", "revenue"]} blankLabel="Use default" onChange={(v) => setEdit({ ...edit, purchaseAccountId: v })} className="!h-[42px] !rounded-[14px] !text-sm" /></Field>
            <label className="flex items-center justify-between text-sm">Active<Toggle checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} label="Active" /></label>
            <ErrorList errors={errs} />
          </div>
        )}
      </Modal>
      <Confirm open={!!del} danger title={`Delete ${del?.name}?`} body="It isn't used on any document." confirmLabel="Delete discount" onClose={() => setDel(null)} onConfirm={() => { deleteDiscount(del!.id); toast("Discount deleted"); }} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Categories                                                          */
/* ------------------------------------------------------------------ */
type CatDraft = Omit<Category, "id"> & { id?: string };
function CategoryTab() {
  const books = useBooks((s) => s.books);
  const { saveCategory, deleteCategory } = useBooks.getState();
  const [edit, setEdit] = useState<CatDraft | null>(null);
  const [del, setDel] = useState<Category | null>(null);
  const [errs, setErrs] = useState<string[]>([]);
  const blank = (): CatDraft => ({ name: "", kind: "service", revenueAccountId: "", expenseAccountId: "", defaultTaxId: undefined });
  const acc = (id: string) => books.accounts.find((a) => a.id === id);

  const save = () => {
    if (!edit) return;
    if (!edit.name.trim()) return setErrs(["Enter a name."]);
    saveCategory({ ...edit, name: edit.name.trim() });
    toast("Category saved");
    setEdit(null);
  };
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="muted max-w-xl text-sm">Categories decide which revenue or expense account a line posts to and suggest a default tax rate.</p>
        <button className="btn btn-dark" onClick={() => { setErrs([]); setEdit(blank()); }}><Plus size={16} /> New category</button>
      </div>
      <Card tour="cat-table" className="!p-3 md:!p-4">
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="thead"><tr><th>Name</th><th>Type</th><th>Revenue account</th><th>Expense account</th><th>Default tax</th><th /></tr></thead>
            <tbody>
              {books.categories.map((c) => (
                <tr key={c.id} className="trow">
                  <td className="font-medium">{c.name}</td>
                  <td className="capitalize">{c.kind}</td>
                  <td>{acc(c.revenueAccountId)?.name ?? <span className="muted">Default</span>}</td>
                  <td>{acc(c.expenseAccountId)?.name ?? <span className="muted">Default</span>}</td>
                  <td>{books.taxes.find((t) => t.id === c.defaultTaxId)?.name ?? <span className="muted">None</span>}</td>
                  <td className="w-24 text-right">
                    <div className="flex justify-end gap-1">
                      <button aria-label={`Edit ${c.name}`} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white" onClick={() => { setErrs([]); setEdit({ ...c }); }}><Pencil size={14} /></button>
                      <button aria-label={`Delete ${c.name}`} className="grid h-8 w-8 place-items-center rounded-full hover:bg-rose-bg hover:text-rose-fg" onClick={() => { const n = docsUsing(books, "category", c.id); n ? toast(`Used on ${n} document${n > 1 ? "s" : ""}. It can't be deleted.`, "error") : setDel(c); }}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Edit category" : "New category"} footer={<><button className="btn btn-light" onClick={() => setEdit(null)}>Cancel</button><button className="btn btn-dark" onClick={save}>Save category</button></>}>
        {edit && (
          <div className="grid gap-4">
            <div className="grid grid-cols-3 gap-4">
              <Field label="Name" className="col-span-2"><input className="field" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
              <Field label="Type"><select className="field" value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value as Category["kind"] })}><option value="service">Service</option><option value="product">Product</option></select></Field>
            </div>
            <Field label="Revenue account"><AccountSelect value={edit.revenueAccountId} types={["revenue"]} blankLabel="Use default" onChange={(v) => setEdit({ ...edit, revenueAccountId: v })} className="!h-[42px] !rounded-[14px] !text-sm" /></Field>
            <Field label="Expense account"><AccountSelect value={edit.expenseAccountId} types={["expense", "asset"]} blankLabel="Use default" onChange={(v) => setEdit({ ...edit, expenseAccountId: v })} className="!h-[42px] !rounded-[14px] !text-sm" /></Field>
            <Field label="Default tax"><select className="field" value={edit.defaultTaxId ?? ""} onChange={(e) => setEdit({ ...edit, defaultTaxId: e.target.value || undefined })}><option value="">None</option>{books.taxes.filter((t) => t.active).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
            <ErrorList errors={errs} />
          </div>
        )}
      </Modal>
      <Confirm open={!!del} danger title={`Delete ${del?.name}?`} body="It isn't used on any document." confirmLabel="Delete category" onClose={() => setDel(null)} onConfirm={() => { deleteCategory(del!.id); toast("Category deleted"); }} />
    </>
  );
}
