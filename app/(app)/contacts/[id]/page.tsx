"use client";
import Link from "next/link";
import { use } from "react";
import { ArrowLeft, FileText, Mail, Phone } from "lucide-react";
import { useBooks } from "@/lib/store";
import { useFmt } from "@/lib/hooks";
import { balanceDue, computeDoc, paidAmount } from "@/lib/engine";
import { liveDocs } from "@/lib/reports";
import { dateLabel } from "@/lib/format";
import { Card, Chip, Empty, PageHeader, StatusDot } from "@/components/ui";

export default function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const books = useBooks((s) => s.books);
  const { fmt } = useFmt();
  const contact = books.contacts.find((item) => item.id === id);

  if (!contact) {
    return (
      <Empty
        title="Contact not found"
        hint="It may have been deleted."
        action={<Link href="/contacts" className="btn btn-dark btn-sm">Back to contacts</Link>}
      />
    );
  }

  const docs = books.docs
    .filter((doc) => doc.contactId === contact.id)
    .sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number));
  const issued = liveDocs(books).filter((doc) => doc.contactId === contact.id);
  const total = issued.reduce((sum, doc) => sum + (doc.snapshot?.total ?? 0), 0);
  const outstanding = issued.reduce((sum, doc) => sum + Math.max(0, balanceDue(doc)), 0);
  const defaultTax = books.taxes.find((tax) => tax.id === contact.defaultTaxId);
  const typeLabel = contact.type === "both" ? "Customer & vendor" : contact.type[0].toUpperCase() + contact.type.slice(1);

  return (
    <>
      <Link href="/contacts" className="muted mb-3 inline-flex items-center gap-1.5 text-sm hover:text-ink no-print">
        <ArrowLeft size={14} /> Contacts
      </Link>
      <PageHeader title={contact.name} sub="Contact details and related activity." />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Contact information" className="lg:col-span-1">
          <div className="mb-4">
            <Chip tone={contact.type === "customer" ? "mint" : contact.type === "vendor" ? "amber" : "neutral"}>{typeLabel}</Chip>
          </div>
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="muted mb-1 text-xs">Email</dt>
              <dd>{contact.email ? <a className="inline-flex items-center gap-2 hover:underline" href={`mailto:${contact.email}`}><Mail size={14} />{contact.email}</a> : "—"}</dd>
            </div>
            <div>
              <dt className="muted mb-1 text-xs">Phone</dt>
              <dd>{contact.phone ? <a className="inline-flex items-center gap-2 hover:underline" href={`tel:${contact.phone}`}><Phone size={14} />{contact.phone}</a> : "—"}</dd>
            </div>
            <div>
              <dt className="muted mb-1 text-xs">Tax ID</dt>
              <dd>{contact.taxId || "—"}</dd>
            </div>
            <div>
              <dt className="muted mb-1 text-xs">Default tax rate</dt>
              <dd>{defaultTax ? `${defaultTax.name} (${defaultTax.rate}%)` : "None"}</dd>
            </div>
          </dl>
        </Card>

        <div className="grid content-start gap-4 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card title="Documents">
              <p className="num text-2xl font-semibold">{docs.length}</p>
              <p className="muted mt-1 text-xs">Invoices and bills</p>
            </Card>
            <Card title="Total issued">
              <p className="num text-2xl font-semibold">{fmt(total)}</p>
              <p className="muted mt-1 text-xs">Posted and paid documents; drafts and voids excluded</p>
            </Card>
            <Card title="Outstanding">
              <p className="num text-2xl font-semibold">{fmt(outstanding)}</p>
              <p className="muted mt-1 text-xs">Open balances</p>
            </Card>
          </div>
          <Card title="Activity">
            {docs.length === 0 ? (
              <Empty title="No activity yet" hint="Invoices and bills for this contact will appear here." />
            ) : (
              <div className="scroll-thin overflow-x-auto">
                <table className="w-full min-w-[680px]">
                  <thead className="thead">
                    <tr>
                      <th>Document</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th className="text-right">Total</th>
                      <th className="text-right">Paid</th>
                      <th className="text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docs.map((doc) => {
                      const amount = doc.snapshot?.total ?? computeDoc(doc.lines, doc.documentDiscountId, books).total;
                      return (
                        <tr key={doc.id} className="trow">
                          <td>
                            <Link href={`/activity/${doc.id}`} className="inline-flex items-center gap-2 font-medium hover:underline">
                              <FileText size={14} />
                              {doc.number}
                            </Link>
                            <span className="muted ml-2 text-xs">{doc.type === "invoice" ? "Invoice" : "Bill"}</span>
                          </td>
                          <td className="num muted">{dateLabel(doc.date)}</td>
                          <td><StatusDot status={doc.status} /></td>
                          <td className="num text-right">{fmt(amount)}</td>
                          <td className="num text-right">{fmt(paidAmount(doc))}</td>
                          <td className="num text-right">{doc.status === "void" || doc.status === "draft" ? "—" : fmt(Math.max(0, balanceDue(doc)))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
