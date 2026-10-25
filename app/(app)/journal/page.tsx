"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { ChevronDown, Download, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useBooks } from "@/lib/store";
import { useFmt } from "@/lib/hooks";
import { entryTotals, isDebitNormal, r2, todayISO } from "@/lib/engine";
import { csvDownload, dateLabel } from "@/lib/format";
import type { JournalLine } from "@/lib/types";
import { Card, Chip, Empty, ErrorList, Field, Modal, NumInput, PageHeader, Segmented, toast } from "@/components/ui";

const SRC: Record<string, string> = { invoice: "Invoice", bill: "Bill", payment: "Payment", manual: "Manual", reversal: "Reversal" };
const blankLines = (): JournalLine[] => [
  { accountId: "", debit: 0, credit: 0 },
  { accountId: "", debit: 0, credit: 0 },
];

function Inner() {
  const books = useBooks((s) => s.books);
  const { addJournal } = useBooks.getState();
  const { fmt } = useFmt();
  const sp = useSearchParams();
  const router = useRouter();
  const accountParam = sp.get("account") ?? "";
  const [view, setView] = useState<"entries" | "ledger">(accountParam ? "ledger" : "entries");
  const [account, setAccount] = useState(accountParam || books.accounts.find((a) => a.subtype === "bank")?.id || books.accounts[0]?.id || "");
  const [open, setOpen] = useState<string | null>(sp.get("entry"));
  const [creating, setCreating] = useState(sp.get("new") === "1");
  const [date, setDate] = useState(todayISO());
  const [memo, setMemo] = useState("");
  const [lines, setLines] = useState<JournalLine[]>(blankLines());
  const [errs, setErrs] = useState<string[]>([]);
  const [src, setSrc] = useState("all");

  useEffect(() => {
    if (accountParam) {
      setView("ledger");
      setAccount(accountParam);
    }
  }, [accountParam]);

  const acc = (id: string) => books.accounts.find((a) => a.id === id);
  const accountLabel = (id: string) => (acc(id) ? `${acc(id)!.code} ${acc(id)!.name}` : "—");

  const entries = useMemo(
    () => [...books.journal].filter((e) => src === "all" || e.source === src).sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number)),
    [books.journal, src],
  );

  const ledger = useMemo(() => {
    const a = acc(account);
    if (!a) return { rows: [] as { date: string; number: string; memo: string; debit: number; credit: number; bal: number; id: string }[], end: 0 };
    const rows = books.journal
      .filter((e) => e.lines.some((l) => l.accountId === account))
      .sort((x, y) => x.date.localeCompare(y.date) || x.number.localeCompare(y.number))
      .flatMap((e) => e.lines.filter((l) => l.accountId === account).map((l) => ({ date: e.date, number: e.number, memo: l.memo || e.memo, debit: l.debit, credit: l.credit, id: e.id })));
    let run = 0;
    const withBal = rows.map((r) => {
      run = r2(run + (isDebitNormal(a.type) ? r.debit - r.credit : r.credit - r.debit));
      return { ...r, bal: run };
    });
    return { rows: withBal, end: run };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [books, account]);

  const totals = entryTotals(lines.filter((l) => l.accountId || l.debit || l.credit));

  const submit = () => {
    const r = addJournal({ date, memo, lines });
    if (!r.ok) return setErrs(r.errors);
    toast("Journal entry posted");
    setCreating(false);
    setLines(blankLines());
    setMemo("");
    setErrs([]);
    router.replace("/journal");
  };

  const setLine = (i: number, p: Partial<JournalLine>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));

  return (
    <>
      <PageHeader title="Journal" sub="Every posting, in one place. Invoices, bills and payments write here automatically; use manual entries for everything else.">
        <button
          className="btn btn-light"
          onClick={() =>
            csvDownload("journal.csv", [
              ["Entry", "Date", "Source", "Memo", "Account code", "Account", "Debit", "Credit"],
              ...books.journal.flatMap((e) => e.lines.map((l) => [e.number, e.date, e.source, e.memo, acc(l.accountId)?.code ?? "", acc(l.accountId)?.name ?? "", l.debit, l.credit])),
            ])
          }
        >
          <Download size={15} /> Export CSV
        </button>
        <button data-tour="journal-new" className="btn btn-dark" onClick={() => { setErrs([]); setCreating(true); }}><Plus size={16} /> Manual entry</button>
      </PageHeader>

      <div data-tour="journal-views" className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented label="View" value={view} onChange={setView} options={[{ value: "entries", label: "Entries" }, { value: "ledger", label: "Account ledger" }]} />
        {view === "entries" ? (
          <select className="field sm !h-10 !rounded-full" style={{ width: 160 }} aria-label="Source" value={src} onChange={(e) => setSrc(e.target.value)}>
            <option value="all">All sources</option>
            {Object.entries(SRC).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        ) : (
          <select className="field sm !h-10 !rounded-full" style={{ width: 260 }} aria-label="Account" value={account} onChange={(e) => setAccount(e.target.value)}>
            {[...books.accounts].sort((a, b) => a.code.localeCompare(b.code)).map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
          </select>
        )}
      </div>

      {view === "entries" ? (
        <Card tour="journal-list" className="!p-3 md:!p-4">
          {entries.length === 0 ? (
            <Empty title="No entries yet" hint="Post an invoice or add a manual entry." />
          ) : (
            <ul className="divide-y divide-black/5">
              {entries.map((e) => {
                const t = entryTotals(e.lines);
                const isOpen = open === e.id;
                return (
                  <li key={e.id}>
                    <button className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-white/40" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : e.id)}>
                      <ChevronDown size={16} className={`flex-none transition ${isOpen ? "" : "-rotate-90"}`} />
                      <span className="num w-24 flex-none text-[13px] font-medium">{e.number}</span>
                      <span className="muted num w-24 flex-none text-[13px]">{dateLabel(e.date)}</span>
                      <span className="min-w-0 flex-1 truncate text-sm">{e.memo}</span>
                      <Chip tone={e.source === "reversal" ? "rose" : e.source === "manual" ? "amber" : "neutral"}>{SRC[e.source]}</Chip>
                      <span className="num w-32 flex-none text-right text-sm font-medium">{fmt(t.debit)}</span>
                    </button>
                    {isOpen && (
                      <div className="pop-in tile-flat mx-3 mb-3 p-3">
                        <table className="w-full text-[13px]">
                          <thead><tr className="muted"><th className="pb-1.5 text-left font-medium">Account</th><th className="pb-1.5 text-right font-medium">Debit</th><th className="pb-1.5 text-right font-medium">Credit</th></tr></thead>
                          <tbody>
                            {e.lines.map((l, i) => (
                              <tr key={i} className="border-t border-black/5">
                                <td className="py-1.5"><Link className="hover:underline" href={`/journal?account=${l.accountId}`}>{accountLabel(l.accountId)}</Link>{l.memo && <span className="muted ml-2 text-xs">{l.memo}</span>}</td>
                                <td className="num text-right">{l.debit ? fmt(l.debit) : ""}</td>
                                <td className="num text-right">{l.credit ? fmt(l.credit) : ""}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {e.sourceId && (e.source === "invoice" || e.source === "bill" || e.source === "payment") && <Link href={`/activity/${e.sourceId}`} className="btn btn-light btn-sm mt-3">Open document</Link>}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      ) : (
        <Card className="!p-3 md:!p-4" title={accountLabel(account)} action={<span className="num text-sm font-semibold">{fmt(ledger.end)}</span>}>
          {ledger.rows.length === 0 ? (
            <Empty title="No activity on this account" />
          ) : (
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="thead"><tr><th>Date</th><th>Entry</th><th>Description</th><th className="text-right">Debit</th><th className="text-right">Credit</th><th className="text-right">Balance</th></tr></thead>
                <tbody>
                  {ledger.rows.map((r, i) => (
                    <tr key={i} className="trow">
                      <td className="num muted">{dateLabel(r.date)}</td>
                      <td className="num"><Link className="hover:underline" href={`/journal?entry=${r.id}`} onClick={() => setView("entries")}>{r.number}</Link></td>
                      <td className="max-w-[260px] truncate">{r.memo}</td>
                      <td className="num text-right">{r.debit ? fmt(r.debit) : ""}</td>
                      <td className="num text-right">{r.credit ? fmt(r.credit) : ""}</td>
                      <td className="num text-right font-medium">{fmt(r.bal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <Modal
        open={creating}
        wide
        onClose={() => { setCreating(false); router.replace("/journal"); }}
        title="Manual journal entry"
        footer={
          <>
            <button className="btn btn-light" onClick={() => { setCreating(false); router.replace("/journal"); }}>Cancel</button>
            <button className="btn btn-dark" onClick={submit}>Post entry</button>
          </>
        }
      >
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Date"><input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Memo" className="sm:col-span-2"><input className="field" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="What is this for?" /></Field>
          </div>
          <div className="grid gap-2">
            <div className="muted hidden grid-cols-12 gap-2 px-1 text-xs sm:grid"><span className="col-span-6">Account</span><span className="col-span-3 text-right">Debit</span><span className="col-span-3 text-right">Credit</span></div>
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-12 items-center gap-2">
                <select className="field sm col-span-12 sm:col-span-6" aria-label={`Line ${i + 1} account`} value={l.accountId} onChange={(e) => setLine(i, { accountId: e.target.value })}>
                  <option value="">Choose account…</option>
                  {[...books.accounts].filter((a) => a.active).sort((a, b) => a.code.localeCompare(b.code)).map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
                </select>
                <div className="col-span-5 sm:col-span-3"><NumInput ariaLabel={`Line ${i + 1} debit`} placeholder="Debit" className="sm text-right" value={l.debit} onChange={(n) => setLine(i, { debit: n, credit: n ? 0 : l.credit })} /></div>
                <div className="col-span-5 sm:col-span-3"><NumInput ariaLabel={`Line ${i + 1} credit`} placeholder="Credit" className="sm text-right" value={l.credit} onChange={(n) => setLine(i, { credit: n, debit: n ? 0 : l.debit })} /></div>
                <button aria-label={`Remove line ${i + 1}`} className="col-span-2 grid h-9 w-9 place-items-center justify-self-end rounded-full hover:bg-rose-bg sm:hidden" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
              </div>
            ))}
            <div className="flex items-center justify-between pt-1">
              <button className="btn btn-light btn-sm" onClick={() => setLines((ls) => [...ls, { accountId: "", debit: 0, credit: 0 }])}><Plus size={14} /> Add line</button>
              <div className="num flex items-center gap-4 text-sm">
                <span>Dr {fmt(totals.debit)}</span><span>Cr {fmt(totals.credit)}</span>
                <Chip tone={totals.balanced && totals.debit > 0 ? "mint" : "rose"}>{totals.balanced && totals.debit > 0 ? "Balanced" : `Off by ${fmt(Math.abs(totals.diff))}`}</Chip>
              </div>
            </div>
          </div>
          <ErrorList errors={errs} />
        </div>
      </Modal>
    </>
  );
}

export default function JournalPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
