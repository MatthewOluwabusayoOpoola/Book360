"use client";
import Link from "next/link";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CreditCard, Printer, Trash2, ArrowLeft } from "lucide-react";
import { useBooks } from "@/lib/store";
import { useFmt, useToday } from "@/lib/hooks";
import { balanceDue, entryTotals, paidAmount, todayISO } from "@/lib/engine";
import { isOverdue } from "@/lib/reports";
import { dateLabel } from "@/lib/format";
import { Card, Confirm, Empty, ErrorList, Field, Modal, NumInput, PageHeader, StatusDot, toast } from "@/components/ui";
import { DocEditor } from "@/components/doc-editor";

export default function DocPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const books = useBooks((s) => s.books);
  const { pay, unpay, voidDocument } = useBooks.getState();
  const { fmt } = useFmt();
  const today = useToday();
  const router = useRouter();
  const doc = books.docs.find((d) => d.id === id);
  const [payOpen, setPayOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(todayISO());
  const [bank, setBank] = useState("");
  const [ref, setRef] = useState("");
  const [errs, setErrs] = useState<string[]>([]);
  const [removeId, setRemoveId] = useState<string | null>(null);

  if (!doc)
    return (
      <Empty title="Document not found" hint="It may have been deleted." action={<Link href="/activity" className="btn btn-dark btn-sm">Back to activity</Link>} />
    );
  if (doc.status === "draft") return <DocEditor initial={doc} />;

  const sale = doc.type === "invoice";
  const snap = doc.snapshot!;
  const contact = books.contacts.find((c) => c.id === doc.contactId);
  const due = balanceDue(doc);
  const je = books.journal.find((j) => j.id === doc.journalEntryId);
  const acc = (aid: string) => books.accounts.find((a) => a.id === aid);
  const banks = books.accounts.filter((a) => a.active && (a.subtype === "bank" || a.subtype === "cash"));
  const cat = (cid: string) => books.categories.find((c) => c.id === cid)?.name ?? "";
  const disc = (did?: string) => books.discounts.find((d) => d.id === did)?.name;
  const tax = (tid?: string) => books.taxes.find((t) => t.id === tid)?.name;

  const openPay = () => {
    setAmount(due);
    setDate(todayISO());
    setBank(books.mappings["payment.bank"] || banks[0]?.id || "");
    setRef("");
    setErrs([]);
    setPayOpen(true);
  };

  return (
    <>
      <Link href="/activity" className="muted mb-3 inline-flex items-center gap-1.5 text-sm hover:text-ink no-print"><ArrowLeft size={14} /> Activity</Link>
      <PageHeader title={doc.number} sub={`${sale ? "Invoice to" : "Bill from"} ${contact?.name ?? "—"} · ${dateLabel(doc.date)} · due ${dateLabel(doc.dueDate)}`}>
        <span className="tile-flat flex h-10 items-center px-4"><StatusDot status={doc.status} overdue={isOverdue(doc, today)} /></span>
        <button className="btn btn-light no-print" onClick={() => window.print()}><Printer size={15} /> Print</button>
        {doc.status !== "void" && !doc.payments.length && <button data-tour="void-btn" className="btn btn-danger no-print" onClick={() => setVoidOpen(true)}><Ban size={15} /> Void</button>}
        {doc.status === "posted" && <button data-tour="pay-btn" className="btn btn-dark no-print" onClick={openPay}><CreditCard size={15} /> Record payment</button>}
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="grid gap-4 lg:col-span-7 lg:content-start">
          <Card tour="view-lines" title="Lines">
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full min-w-[620px]">
                <thead className="thead">
                  <tr><th>Item</th><th className="text-right">Qty</th><th className="text-right">Price</th><th>Discount</th><th>Tax</th><th className="text-right">Total</th></tr>
                </thead>
                <tbody>
                  {doc.lines.map((l, i) => {
                    const c = snap.lines[i];
                    const ld = disc(l.discountId);
                    return (
                      <tr key={l.id} className="trow">
                        <td>
                          <div className="font-medium">{l.description || cat(l.categoryId)}</div>
                          <div className="muted text-xs">{cat(l.categoryId)}</div>
                        </td>
                        <td className="num text-right">{l.qty}</td>
                        <td className="num text-right">{fmt(l.unitPrice)}</td>
                        <td className="text-[13px]">{ld ? <>{ld}<div className="muted num text-xs">− {fmt(c.lineDiscount)}</div></> : <span className="muted">—</span>}</td>
                        <td className="text-[13px]">{tax(l.taxId) ?? <span className="muted">—</span>}{c.tax > 0 && <div className="muted num text-xs">{fmt(c.tax)}</div>}</td>
                        <td className="num text-right font-medium">{fmt(c.total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <dl className="num ml-auto mt-4 max-w-xs space-y-2 text-sm">
              <div className="flex justify-between"><dt className="muted">Subtotal</dt><dd>{fmt(snap.gross)}</dd></div>
              {snap.discounts > 0 && <div className="flex justify-between"><dt className="muted">Discounts</dt><dd>− {fmt(snap.discounts)}</dd></div>}
              {snap.taxes.map((t) => (
                <div key={t.taxId} className="flex justify-between"><dt className="muted">{t.name}</dt><dd>{fmt(t.tax)}</dd></div>
              ))}
              <div className="flex justify-between border-t border-black/10 pt-2 text-base font-semibold"><dt>Total</dt><dd>{fmt(snap.total)}</dd></div>
              {doc.payments.length > 0 && <div className="flex justify-between"><dt className="muted">Paid</dt><dd>− {fmt(paidAmount(doc))}</dd></div>}
              {doc.status !== "void" && <div className="flex justify-between font-semibold"><dt>Balance due</dt><dd>{fmt(due)}</dd></div>}
            </dl>
            {doc.notes && <p className="muted mt-4 whitespace-pre-wrap text-sm">{doc.notes}</p>}
          </Card>

          <Card title="Payments">
            {doc.payments.length === 0 ? (
              <p className="muted text-sm">{doc.status === "void" ? "This document is void." : "No payments recorded yet."}</p>
            ) : (
              <ul className="divide-y divide-black/5">
                {doc.payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <div>
                      <div className="num font-medium">{fmt(p.amount)}</div>
                      <div className="muted text-xs">{dateLabel(p.date)} · {acc(p.accountId)?.name}{p.reference ? ` · ${p.reference}` : ""}</div>
                    </div>
                    <button className="btn btn-light btn-sm no-print" onClick={() => setRemoveId(p.id)}><Trash2 size={13} /> Remove</button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card tour="view-journal" className="lg:col-span-5 lg:self-start" title={je ? `Journal ${je.number}` : "Journal"}>
          {je ? (
            <>
              <p className="muted mb-3 text-xs">Posted {dateLabel(je.date)}. Posted documents can't be edited. Void to reverse.</p>
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="muted"><th className="pb-2 text-left font-medium">Account</th><th className="pb-2 text-right font-medium">Dr</th><th className="pb-2 pl-3 text-right font-medium">Cr</th></tr>
                </thead>
                <tbody>
                  {je.lines.map((l, i) => (
                    <tr key={i} className="border-t border-black/5 align-top">
                      <td className="py-2 pr-2">
                        <div className={`font-medium ${l.credit > 0 ? "pl-4" : ""}`}>{acc(l.accountId)?.code} {acc(l.accountId)?.name}</div>
                        <div className={`muted text-[11px] ${l.credit > 0 ? "pl-4" : ""}`}>{l.memo}</div>
                      </td>
                      <td className="num whitespace-nowrap py-2 text-right">{l.debit ? fmt(l.debit) : ""}</td>
                      <td className="num whitespace-nowrap py-2 pl-3 text-right">{l.credit ? fmt(l.credit) : ""}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-black/10 font-semibold"><td className="pt-2">Total</td><td className="num whitespace-nowrap pt-2 text-right">{fmt(entryTotals(je.lines).debit)}</td><td className="num whitespace-nowrap pl-3 pt-2 text-right">{fmt(entryTotals(je.lines).credit)}</td></tr>
                </tbody>
              </table>
              <Link href={`/journal?entry=${je.id}`} className="btn btn-light btn-sm mt-4 no-print">Open in journal</Link>
            </>
          ) : (
            <p className="muted text-sm">No journal entry.</p>
          )}
        </Card>
      </div>

      <Modal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title={sale ? "Record payment received" : "Record payment made"}
        footer={
          <>
            <button className="btn btn-light" onClick={() => setPayOpen(false)}>Cancel</button>
            <button
              className="btn btn-dark"
              onClick={() => {
                const r = pay(doc.id, { date, amount, accountId: bank, reference: ref });
                if (!r.ok) return setErrs(r.errors);
                toast("Payment recorded");
                setPayOpen(false);
              }}
            >
              Record payment
            </button>
          </>
        }
      >
        <div className="grid gap-4">
          <p className="muted text-sm">Balance due {fmt(due)}. Enter less to record a part payment.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount"><NumInput value={amount} onChange={setAmount} className="text-right" /></Field>
            <Field label="Date"><input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          </div>
          <Field label={sale ? "Deposit to" : "Pay from"}>
            <select className="field" value={bank} onChange={(e) => setBank(e.target.value)}>
              {banks.map((b) => <option key={b.id} value={b.id}>{b.code} {b.name}</option>)}
            </select>
          </Field>
          <Field label="Reference"><input className="field" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Transfer ID, cheque no…" /></Field>
          <ErrorList errors={errs} />
        </div>
      </Modal>

      <Confirm open={voidOpen} danger title={`Void ${doc.number}?`} body="This posts a reversing journal entry so the original stays in your audit trail. The document can't be reopened." confirmLabel="Void document" onClose={() => setVoidOpen(false)} onConfirm={() => { const r = voidDocument(doc.id); r.ok ? toast(`${doc.number} voided`) : toast(r.errors[0], "error"); }} />
      <Confirm open={!!removeId} danger title="Remove this payment?" body="A reversing journal entry is posted and the balance due goes back up." confirmLabel="Remove payment" onClose={() => setRemoveId(null)} onConfirm={() => { const r = unpay(doc.id, removeId!); r.ok ? toast("Payment removed") : toast(r.errors[0], "error"); }} />
    </>
  );
}
