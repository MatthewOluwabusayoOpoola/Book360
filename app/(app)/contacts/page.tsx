"use client";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Mail, Pencil, Phone, Plus, Trash2, UserRound } from "lucide-react";
import { useBooks } from "@/lib/store";
import { useFmt } from "@/lib/hooks";
import { balanceDue } from "@/lib/engine";
import { liveDocs } from "@/lib/reports";
import type { Contact } from "@/lib/types";
import { Chip, Confirm, Empty, ErrorList, Field, Modal, PageHeader, toast } from "@/components/ui";

type Draft = Omit<Contact, "id"> & { id?: string };
const blank = (): Draft => ({ name: "", type: "customer", email: "", phone: "", taxId: "", defaultTaxId: undefined });

function Inner() {
  const books = useBooks((s) => s.books);
  const { saveContact, deleteContact } = useBooks.getState();
  const { fmt } = useFmt();
  const [edit, setEdit] = useState<Draft | null>(null);
  const [originalEdit, setOriginalEdit] = useState<Draft | null>(null);
  const [del, setDel] = useState<Contact | null>(null);
  const [errs, setErrs] = useState<string[]>([]);
  const openNew = useSearchParams().get("new") === "1";
  useEffect(() => {
    if (!openNew) return;
    const initial = blank();
    setOriginalEdit(initial);
    setEdit(initial);
  }, [openNew]);

  const closeEdit = () => {
    if (edit && originalEdit && JSON.stringify(edit) !== JSON.stringify(originalEdit)) {
      const discard = window.confirm("Discard unsaved changes? Your contact details have not been saved. If you close now, the entered information will be lost.");
      if (!discard) return;
    }
    setEdit(null);
    setOriginalEdit(null);
  };

  const stats = useMemo(() => {
    const m = new Map<string, { billed: number; due: number; count: number }>();
    for (const d of liveDocs(books)) {
      const s = m.get(d.contactId) ?? { billed: 0, due: 0, count: 0 };
      s.billed += d.snapshot!.total;
      s.due += Math.max(0, balanceDue(d));
      s.count += 1;
      m.set(d.contactId, s);
    }
    return m;
  }, [books]);

  const save = () => {
    if (!edit) return;
    if (!edit.name.trim()) return setErrs(["Enter a name."]);
    if (edit.email && !/^\S+@\S+\.\S+$/.test(edit.email)) return setErrs(["That email address doesn't look right."]);
    saveContact({ ...edit, name: edit.name.trim() });
    toast("Contact saved");
    setEdit(null);
    setOriginalEdit(null);
  };

  return (
    <>
      <PageHeader title="Contacts" sub="Customers you invoice and vendors you pay. A default tax rate saves a click on every line.">
        <button data-tour="contact-new" className="btn btn-dark" onClick={() => { const initial = blank(); setErrs([]); setOriginalEdit(initial); setEdit(initial); }}><Plus size={16} /> New contact</button>
      </PageHeader>
      {books.contacts.length === 0 ? (
        <Empty title="No contacts yet" hint="Add a customer or vendor to start invoicing." />
      ) : (
        <div data-tour="contact-grid" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {books.contacts.map((c) => {
            const s = stats.get(c.id);
            return (
              <article key={c.id} className="glass card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-11 w-11 flex-none place-items-center rounded-full bg-ink text-sm font-semibold text-white">{c.name.slice(0, 2).toUpperCase()}</span>
                    <div className="min-w-0"><Link href={`/contacts/${c.id}`} className="truncate font-semibold hover:underline">{c.name}</Link><Chip tone={c.type === "customer" ? "mint" : c.type === "vendor" ? "amber" : "neutral"}>{c.type === "both" ? "Customer & vendor" : c.type[0].toUpperCase() + c.type.slice(1)}</Chip></div>
                  </div>
                  <div className="flex gap-1">
                    <button aria-label={`Edit ${c.name}`} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white" onClick={() => { const initial = { ...c }; setErrs([]); setOriginalEdit(initial); setEdit({ ...initial }); }}><Pencil size={14} /></button>
                    <button aria-label={`Delete ${c.name}`} className="grid h-8 w-8 place-items-center rounded-full hover:bg-rose-bg hover:text-rose-fg" onClick={() => (books.docs.some((d) => d.contactId === c.id) ? toast("This contact has documents, so it can't be deleted.", "error") : setDel(c))}><Trash2 size={14} /></button>
                  </div>
                </div>
                <div className="muted mt-4 space-y-1 text-[13px]">
                  {c.email && <p className="flex items-center gap-2"><Mail size={13} /> {c.email}</p>}
                  {c.phone && <p className="flex items-center gap-2"><Phone size={13} /> {c.phone}</p>}
                  {c.taxId && <p>{c.taxId}</p>}
                </div>
                <dl className="num mt-4 grid grid-cols-2 gap-2.5 text-sm">
                  <div className="tile-flat p-3"><dt className="muted text-[11px]">Total {s?.count ?? 0} docs</dt><dd className="font-semibold">{fmt(s?.billed ?? 0)}</dd></div>
                  <div className="tile-flat p-3"><dt className="muted text-[11px]">Outstanding</dt><dd className="font-semibold">{fmt(s?.due ?? 0)}</dd></div>
                </dl>
                <Link href={`/contacts/${c.id}`} className="btn btn-light btn-sm mt-4 w-full"><UserRound size={14} /> View contact</Link>
              </article>
            );
          })}
        </div>
      )}
      <Modal open={!!edit} onClose={closeEdit} title={edit?.id ? "Edit contact" : "New contact"} footer={<><button className="btn btn-light" onClick={closeEdit}>Cancel</button><button className="btn btn-dark" onClick={save}>Save contact</button></>}>
        {edit && (
          <div className="grid gap-4">
            <Field label="Name"><input className="field" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Type"><select className="field" value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value as Contact["type"] })}><option value="customer">Customer</option><option value="vendor">Vendor</option><option value="both">Both</option></select></Field>
              <Field label="Default tax"><select className="field" value={edit.defaultTaxId ?? ""} onChange={(e) => setEdit({ ...edit, defaultTaxId: e.target.value || undefined })}><option value="">None</option>{books.taxes.filter((t) => t.active).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Email"><input type="email" className="field" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
              <Field label="Phone"><input className="field" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></Field>
            </div>
            <Field label="Tax ID"><input className="field" value={edit.taxId ?? ""} onChange={(e) => setEdit({ ...edit, taxId: e.target.value })} /></Field>
            <ErrorList errors={errs} />
          </div>
        )}
      </Modal>
      <Confirm open={!!del} danger title={`Delete ${del?.name}?`} body="They have no documents, so nothing else changes." confirmLabel="Delete contact" onClose={() => setDel(null)} onConfirm={() => { deleteContact(del!.id); toast("Contact deleted"); }} />
    </>
  );
}
export default function ContactsPage() { return <Suspense><Inner /></Suspense>; }
