"use client";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Download, Search } from "lucide-react";
import { useBooks } from "@/lib/store";
import { useFmt, useToday } from "@/lib/hooks";
import { balanceDue } from "@/lib/engine";
import { isOverdue } from "@/lib/reports";
import { csvDownload, dateLabel } from "@/lib/format";
import { Empty, IconBadge, PageHeader, Segmented, StatusDot, Card } from "@/components/ui";

type Kind = "all" | "invoice" | "bill";
const FILTERS = ["all", "draft", "open", "overdue", "paid", "void"] as const;

function Inner() {
  const books = useBooks((s) => s.books);
  const { fmt } = useFmt();
  const today = useToday();
  const sp = useSearchParams();
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("all");
  const [q, setQ] = useState("");
  const filter = (FILTERS as readonly string[]).includes(sp.get("filter") ?? "") ? (sp.get("filter") as (typeof FILTERS)[number]) : "all";

  const rows = useMemo(() => {
    const name = (id: string) => books.contacts.find((c) => c.id === id)?.name ?? "";
    return [...books.docs]
      .filter((d) => kind === "all" || d.type === kind)
      .filter((d) => {
        if (filter === "all") return true;
        if (filter === "open") return d.status === "posted";
        if (filter === "overdue") return isOverdue(d, today);
        return d.status === filter;
      })
      .filter((d) => !q || d.number.toLowerCase().includes(q.toLowerCase()) || name(d.contactId).toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number))
      .map((d) => ({ d, name: name(d.contactId) }));
  }, [books, kind, filter, q, today]);

  const total = rows.reduce((s, r) => s + (r.d.snapshot?.total ?? 0), 0);

  return (
    <>
      <PageHeader title="Activity" sub="Invoices you send and bills you owe. Posting writes the journal using your account mapping.">
        <button
          className="btn btn-light"
          onClick={() =>
            csvDownload("activity.csv", [
              ["Number", "Type", "Contact", "Date", "Due", "Status", "Net", "Tax", "Total", "Balance due"],
              ...rows.map(({ d, name }) => [d.number, d.type, name, d.date, d.dueDate, d.status, d.snapshot?.net ?? "", d.snapshot?.tax ?? "", d.snapshot?.total ?? "", d.snapshot ? balanceDue(d) : ""]),
            ])
          }
        >
          <Download size={15} /> Export CSV
        </button>
        <Link href="/activity/new?type=bill" className="btn btn-light">New bill</Link>
        <Link data-tour="new-invoice" href="/activity/new?type=invoice" className="btn btn-dark">+ New invoice</Link>
      </PageHeader>

      <div data-tour="activity-filters" className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Type"
          value={kind}
          onChange={setKind}
          options={[
            { value: "all", label: "All" },
            { value: "invoice", label: "Invoices" },
            { value: "bill", label: "Bills" },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="muted pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input className="field sm !h-10 !rounded-full !pl-9" style={{ width: 200 }} placeholder="Search" aria-label="Search activity" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="field sm !h-10 !rounded-full" style={{ width: 140 }} aria-label="Status" value={filter} onChange={(e) => router.replace(e.target.value === "all" ? "/activity" : `/activity?filter=${e.target.value}`)}>
            {FILTERS.map((f) => (
              <option key={f} value={f}>{f === "all" ? "All statuses" : f[0].toUpperCase() + f.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      <Card tour="activity-table" className="!p-3 md:!p-4">
        {rows.length === 0 ? (
          <Empty title="Nothing matches" hint="Clear the filters, or create a new invoice or bill." action={<Link href="/activity/new?type=invoice" className="btn btn-dark btn-sm">New invoice</Link>} />
        ) : (
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="thead">
                <tr><th>Number</th><th>Contact</th><th className="text-right">Net</th><th className="text-right">Tax</th><th className="text-right">Total</th><th className="text-right">Balance</th><th>Status</th><th>Date</th></tr>
              </thead>
              <tbody>
                {rows.map(({ d, name }) => (
                  <tr key={d.id} className="trow cursor-pointer" onClick={() => router.push(`/activity/${d.id}`)}>
                    <td className="num">
                      <Link href={`/activity/${d.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>{d.number}</Link>
                    </td>
                    <td>
                      <span className="flex items-center gap-2.5">
                        <IconBadge tone={d.type === "invoice" ? "teal" : "accent"}>{d.type === "invoice" ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}</IconBadge>
                        <span className="truncate">{name || <span className="muted">No contact</span>}</span>
                      </span>
                    </td>
                    <td className="num text-right">{d.snapshot ? fmt(d.snapshot.net) : "—"}</td>
                    <td className="num muted text-right">{d.snapshot ? fmt(d.snapshot.tax) : "—"}</td>
                    <td className="num text-right font-medium">{d.snapshot ? fmt(d.snapshot.total) : <span className="muted">Draft</span>}</td>
                    <td className="num text-right">{d.snapshot && d.status !== "void" ? fmt(balanceDue(d)) : "—"}</td>
                    <td><StatusDot status={d.status} overdue={isOverdue(d, today)} /></td>
                    <td className="num muted">{dateLabel(d.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted px-3.5 pb-1 pt-3 text-xs">{rows.length} document{rows.length === 1 ? "" : "s"} · {fmt(total)} total</p>
      </Card>
    </>
  );
}

export default function ActivityPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
