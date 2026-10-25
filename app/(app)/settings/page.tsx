"use client";
import { useRef, useState } from "react";
import { Download, RotateCcw, Sparkles, Upload } from "lucide-react";
import { useBooks } from "@/lib/store";
import { Card, Confirm, Field, PageHeader, toast } from "@/components/ui";
import type { Books } from "@/lib/types";

export default function SettingsPage() {
  const books = useBooks((s) => s.books);
  const { updateSettings, loadDemo, startBlank, importBooks } = useBooks.getState();
  const s = books.settings;
  const file = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState<"demo" | "blank" | null>(null);

  const backup = () => {
    const blob = new Blob([JSON.stringify(books, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `books360-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const restore = async (f: File) => {
    try {
      const j = JSON.parse(await f.text()) as Books;
      if (!j.accounts || !j.journal || !j.mappings || !j.settings) throw new Error();
      importBooks(j);
      toast("Backup restored");
    } catch {
      toast("That file isn't a Books360 backup.", "error");
    }
  };

  return (
    <>
      <PageHeader title="Settings" sub="Company details, numbering and your data." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card tour="settings-company" title="Company">
          <div className="grid gap-4">
            <Field label="Company name"><input className="field" value={s.companyName} onChange={(e) => updateSettings({ companyName: e.target.value })} /></Field>
            <Field label="Your name"><input className="field" value={s.userName} onChange={(e) => updateSettings({ userName: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Currency">
                <select className="field" value={s.currency} onChange={(e) => updateSettings({ currency: e.target.value })}>
                  {["NGN", "USD", "EUR", "GBP", "GHS", "KES", "ZAR", "TRY"].map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Number format">
                <select className="field" value={s.locale} onChange={(e) => updateSettings({ locale: e.target.value })}>
                  <option value="en-NG">Nigeria (1,234.56)</option><option value="en-US">US (1,234.56)</option><option value="en-GB">UK (1,234.56)</option><option value="de-DE">Germany (1.234,56)</option>
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Invoice prefix" hint="Applies to new documents."><input className="field" value={s.invoicePrefix} onChange={(e) => updateSettings({ invoicePrefix: e.target.value.toUpperCase().slice(0, 6) })} /></Field>
              <Field label="Bill prefix"><input className="field" value={s.billPrefix} onChange={(e) => updateSettings({ billPrefix: e.target.value.toUpperCase().slice(0, 6) })} /></Field>
            </div>
          </div>
        </Card>
        <Card tour="settings-data" title="Your data">
          <p className="muted mb-4 text-sm">Everything is stored in this browser. Download a backup before clearing site data or switching devices.</p>
          <div className="grid gap-3">
            <button className="btn btn-dark justify-start" onClick={backup}><Download size={16} /> Download backup (.json)</button>
            <button className="btn btn-light justify-start" onClick={() => file.current?.click()}><Upload size={16} /> Restore from backup</button>
            <input ref={file} type="file" accept="application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) restore(f); e.target.value = ""; }} />
            <hr className="border-black/10" />
            <button className="btn btn-light justify-start" onClick={() => setConfirm("demo")}><Sparkles size={16} /> Load demo data</button>
            <button className="btn btn-danger justify-start" onClick={() => setConfirm("blank")}><RotateCcw size={16} /> Start with empty books</button>
          </div>
        </Card>
      </div>
      <Confirm open={confirm === "demo"} title="Load demo data?" body="This replaces everything in the books with sample invoices, bills and journals. Download a backup first if you need your current data." confirmLabel="Load demo data" onClose={() => setConfirm(null)} onConfirm={() => { loadDemo(); toast("Demo data loaded"); }} />
      <Confirm open={confirm === "blank"} danger title="Start with empty books?" body="This removes all documents and journal entries. Your chart of accounts, tax rates and discounts are kept." confirmLabel="Clear everything" onClose={() => setConfirm(null)} onConfirm={() => { const keep = books; startBlank(); useBooks.setState((st) => ({ books: { ...st.books, accounts: keep.accounts, taxes: keep.taxes, discounts: keep.discounts, categories: keep.categories, contacts: keep.contacts, mappings: keep.mappings, settings: keep.settings } })); toast("Books cleared"); }} />
    </>
  );
}
