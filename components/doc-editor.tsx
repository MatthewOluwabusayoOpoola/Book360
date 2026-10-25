"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { useBooks } from "@/lib/store";
import { useFmt } from "@/lib/hooks";
import { computeDoc, postingLines, entryTotals, uid, validateDoc } from "@/lib/engine";
import type { Doc, DocLine } from "@/lib/types";
import { Card, ErrorList, Field, NumInput, PageHeader, toast, Confirm } from "./ui";

export function DocEditor({ initial }: { initial: Doc }) {
  const router = useRouter();
  const books = useBooks((s) => s.books);
  const { saveDraft, post, deleteDraft } = useBooks.getState();
  const { fmt } = useFmt();
  const [doc, setDoc] = useState<Doc>(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const sale = doc.type === "invoice";

  const contacts = books.contacts.filter((c) => (sale ? c.type !== "vendor" : c.type !== "customer"));
  const taxes = books.taxes.filter((t) => t.active && (t.appliesTo === "both" || t.appliesTo === (sale ? "sales" : "purchases")));
  const lineDiscounts = books.discounts.filter((d) => d.active && d.scope === "line");
  const docDiscounts = books.discounts.filter((d) => d.active && d.scope === "document");

  const c = useMemo(() => computeDoc(doc.lines, doc.documentDiscountId, books), [doc.lines, doc.documentDiscountId, books]);
  const journal = useMemo(() => (doc.lines.length ? postingLines(books, doc, c) : []), [books, doc, c]);
  const jt = entryTotals(journal);
  const acc = (id: string) => books.accounts.find((a) => a.id === id);

  const set = (patch: Partial<Doc>) => setDoc((d) => ({ ...d, ...patch }));
  const setLine = (id: string, patch: Partial<DocLine>) => setDoc((d) => ({ ...d, lines: d.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  const addLine = () => {
    const contact = books.contacts.find((x) => x.id === doc.contactId);
    const cat = books.categories[0];
    const defTax = cat?.defaultTaxId ?? contact?.defaultTaxId;
    setDoc((d) => ({
      ...d,
      lines: [...d.lines, { id: uid("l"), description: "", categoryId: cat?.id ?? "", qty: 1, unitPrice: 0, taxId: taxes.some((t) => t.id === defTax) ? defTax : undefined }],
    }));
  };

  const onCategory = (lineId: string, categoryId: string) => {
    const cat = books.categories.find((x) => x.id === categoryId);
    const patch: Partial<DocLine> = { categoryId };
    if (cat?.defaultTaxId && taxes.some((t) => t.id === cat.defaultTaxId)) patch.taxId = cat.defaultTaxId;
    setLine(lineId, patch);
  };

  const saveOnly = () => {
    saveDraft(doc);
    toast("Draft saved");
    router.push("/activity");
  };
  const submit = () => {
    const errs = validateDoc(books, doc);
    if (errs.length) return setErrors(errs);
    saveDraft(doc);
    const r = post(doc.id);
    if (!r.ok) return setErrors(r.errors);
    toast(`${doc.number} posted`);
    router.push(`/activity/${doc.id}`);
  };

  const exists = books.docs.some((d) => d.id === doc.id);

  return (
    <>
      <PageHeader title={`${exists ? "Edit" : "New"} ${sale ? "invoice" : "bill"}`} sub={`${doc.number} · Totals and journal update as you type.`}>
        {exists && (
          <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={15} /> Delete draft
          </button>
        )}
        <button className="btn btn-light" onClick={saveOnly}>Save draft</button>
        <button data-tour="doc-post" className="btn btn-dark" onClick={submit}>Post {sale ? "invoice" : "bill"}</button>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="grid gap-4 lg:col-span-8 lg:content-start">
          <Card tour="doc-header">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={sale ? "Customer" : "Vendor"} className="sm:col-span-1">
                <select className="field" value={doc.contactId} onChange={(e) => set({ contactId: e.target.value })} aria-invalid={errors.some((x) => x.includes("Choose a"))}>
                  <option value="">Select…</option>
                  {contacts.map((x) => (
                    <option key={x.id} value={x.id}>{x.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Date">
                <input type="date" className="field" value={doc.date} onChange={(e) => set({ date: e.target.value })} />
              </Field>
              <Field label="Due date">
                <input type="date" className="field" value={doc.dueDate} min={doc.date} onChange={(e) => set({ dueDate: e.target.value })} />
              </Field>
            </div>
          </Card>

          <Card tour="doc-lines" title="Lines" action={<button className="btn btn-dark btn-sm" onClick={addLine}><Plus size={14} /> Add line</button>}>
            {doc.lines.length === 0 ? (
              <div className="tile-flat px-6 py-8 text-center text-sm">
                <p className="muted">No lines yet.</p>
                <button className="btn btn-light btn-sm mt-3" onClick={addLine}><Plus size={14} /> Add the first line</button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {doc.lines.map((l, i) => {
                  const cl = c.lines[i];
                  return (
                    <div key={l.id} className="tile p-3.5">
                      <div className="grid gap-3 md:grid-cols-12">
                        <Field label="Description" className="md:col-span-5">
                          <input className="field sm" value={l.description} placeholder="What was it for?" onChange={(e) => setLine(l.id, { description: e.target.value })} />
                        </Field>
                        <Field label="Category" className="md:col-span-4" hint={`Posts to ${acc((sale ? books.categories.find((x) => x.id === l.categoryId)?.revenueAccountId : books.categories.find((x) => x.id === l.categoryId)?.expenseAccountId) || (sale ? books.mappings["sales.revenue"] : books.mappings["purchase.expense"]))?.name ?? "—"}`}>
                          <select className="field sm" value={l.categoryId} onChange={(e) => onCategory(l.id, e.target.value)}>
                            {books.categories.map((x) => (
                              <option key={x.id} value={x.id}>{x.name}</option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Qty" className="md:col-span-1">
                          <NumInput className="sm" value={l.qty} onChange={(n) => setLine(l.id, { qty: n })} />
                        </Field>
                        <Field label={`Price`} className="md:col-span-2">
                          <NumInput className="sm text-right" value={l.unitPrice} onChange={(n) => setLine(l.id, { unitPrice: n })} />
                        </Field>
                        <Field label="Discount" className="md:col-span-5">
                          <select className="field sm" value={l.discountId ?? ""} onChange={(e) => setLine(l.id, { discountId: e.target.value || undefined })}>
                            <option value="">No discount</option>
                            {lineDiscounts.map((x) => (
                              <option key={x.id} value={x.id}>{x.name}</option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Tax" className="md:col-span-4">
                          <select className="field sm" value={l.taxId ?? ""} onChange={(e) => setLine(l.id, { taxId: e.target.value || undefined })}>
                            <option value="">No tax</option>
                            {taxes.map((x) => (
                              <option key={x.id} value={x.id}>{x.name}</option>
                            ))}
                          </select>
                        </Field>
                        <div className="flex items-end justify-between gap-2 md:col-span-3">
                          <div className="min-w-0">
                            <div className="muted text-[11px]">Line total</div>
                            <div className="num truncate text-[15px] font-semibold">{fmt(cl?.total ?? 0)}</div>
                          </div>
                          <button className="grid h-9 w-9 flex-none place-items-center rounded-full bg-black/5 hover:bg-rose-bg hover:text-rose-fg" aria-label={`Remove line ${i + 1}`} onClick={() => setDoc((d) => ({ ...d, lines: d.lines.filter((x) => x.id !== l.id) }))}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card tour="doc-discount">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Document discount" hint="Spread across all lines before tax is calculated.">
                <select className="field" value={doc.documentDiscountId ?? ""} onChange={(e) => set({ documentDiscountId: e.target.value || undefined })}>
                  <option value="">No discount</option>
                  {docDiscounts.map((x) => (
                    <option key={x.id} value={x.id}>{x.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Notes">
                <textarea className="field" value={doc.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Payment terms, bank details…" />
              </Field>
            </div>
          </Card>
        </div>

        <div className="grid gap-4 lg:col-span-4 lg:content-start">
          <section data-tour="doc-summary" className="teal-card card p-5">
            <h2 className="text-[15px] font-semibold">Summary</h2>
            <dl className="num mt-4 space-y-2.5 text-sm">
              <Row k="Subtotal" v={fmt(c.gross)} />
              {c.discounts > 0 && <Row k="Discounts" v={`− ${fmt(c.discounts)}`} />}
              <Row k="Net" v={fmt(c.net)} />
              {c.taxes.map((t) => (
                <Row key={t.taxId} k={`${t.name}`} v={fmt(t.tax)} sub={`on ${fmt(t.base)}`} />
              ))}
            </dl>
            <div className="mt-4 border-t border-white/30 pt-4">
              <div className="text-xs text-white/80">{sale ? "Customer pays" : "You pay"}</div>
              <div className="num text-[30px] font-semibold tracking-[-0.02em]">{fmt(c.total)}</div>
            </div>
          </section>

          <Card tour="doc-journal" title="Journal preview">
            {journal.length === 0 ? (
              <p className="muted text-sm">Add a line to see which accounts it will hit.</p>
            ) : (
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="muted"><th className="pb-2 text-left font-medium">Account</th><th className="pb-2 text-right font-medium">Dr</th><th className="pb-2 text-right font-medium">Cr</th></tr>
                </thead>
                <tbody>
                  {journal.map((j, i) => (
                    <tr key={i} className="border-t border-black/5 align-top">
                      <td className="py-2 pr-2">
                        <div className={`font-medium ${j.credit > 0 ? "pl-4" : ""}`}>{acc(j.accountId)?.code} {acc(j.accountId)?.name ?? "Missing account"}</div>
                        <div className={`muted text-[11px] ${j.credit > 0 ? "pl-4" : ""}`}>{j.memo}</div>
                      </td>
                      <td className="num py-2 text-right">{j.debit ? fmt(j.debit) : ""}</td>
                      <td className="num py-2 text-right">{j.credit ? fmt(j.credit) : ""}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-black/10 font-semibold">
                    <td className="pt-2">{jt.balanced ? "Balanced" : "Out of balance"}</td>
                    <td className="num pt-2 text-right">{fmt(jt.debit)}</td>
                    <td className="num pt-2 text-right">{fmt(jt.credit)}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </Card>
          <ErrorList errors={errors} />
        </div>
      </div>

      <Confirm
        open={confirmDelete}
        danger
        title="Delete this draft?"
        body="The draft is removed. Nothing has been posted, so your accounts are unaffected."
        confirmLabel="Delete draft"
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          deleteDraft(doc.id);
          toast("Draft deleted");
          router.push("/activity");
        }}
      />
    </>
  );
}

function Row({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-white/85">
        {k}
        {sub && <span className="ml-1.5 text-[11px] text-white/60">{sub}</span>}
      </dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}
