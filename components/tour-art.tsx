import type { ReactNode } from "react";
import { ArrowRight, BookOpen, Check, CreditCard, Database, FileText, Mail, Percent, PieChart, Plus, Search, Undo2, Users } from "lucide-react";
import type { ArtKey } from "@/lib/tour-steps";

const Pill = ({ children, tone = "w" }: { children: ReactNode; tone?: "w" | "ink" | "acc" | "teal" | "mint" | "rose" }) => {
  const c = { w: "bg-white text-ink", ink: "bg-ink text-white", acc: "bg-accent text-white", teal: "bg-teal text-white", mint: "bg-mint-bg text-mint-fg", rose: "bg-rose-bg text-rose-fg" }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${c}`}>{children}</span>;
};
const Box = ({ children, className = "" }: { children: ReactNode; className?: string }) => <div className={`rounded-xl bg-white/80 px-3 py-2 text-[11.5px] ${className}`}>{children}</div>;
const Arrow = () => <ArrowRight size={13} className="flex-none text-black/35" />;
const Row = ({ k, v, b }: { k: string; v: string; b?: boolean }) => (
  <div className={`flex justify-between gap-3 ${b ? "font-semibold" : ""}`}><span>{k}</span><span className="num">{v}</span></div>
);

export function Art({ k }: { k: ArtKey }): ReactNode {
  switch (k) {
    case "flow":
      return (
        <div className="flex items-center justify-between gap-1.5">
          <Box className="text-center"><FileText size={18} className="mx-auto mb-1 text-teal-deep" />Invoice<br />or bill</Box><Arrow />
          <Box className="text-center"><BookOpen size={18} className="mx-auto mb-1 text-accent" />Journal<br />entry</Box><Arrow />
          <Box className="text-center"><PieChart size={18} className="mx-auto mb-1 text-ink" />Reports<br />&amp; tax</Box>
        </div>
      );
    case "balance":
      return (
        <Box>
          <div className="muted text-[10.5px]">Cash &amp; bank balance</div>
          <div className="num text-[19px] font-semibold tracking-tight">₦19,674,119</div>
          <div className="mt-1.5 flex gap-1.5"><Pill tone="ink">New invoice</Pill><Pill>New bill</Pill></div>
        </Box>
      );
    case "kpi":
      return (
        <div className="grid grid-cols-4 gap-1.5 text-center text-[10px]">
          {[["Revenue", "₦4M", "teal"], ["Expenses", "₦2M", "w"], ["Owed to you", "₦8.7M", "w"], ["You owe", "₦0.9M", "w"]].map(([l, v, t]) => (
            <div key={l} className={`rounded-lg px-1 py-2 ${t === "teal" ? "bg-teal text-white" : "bg-white/80"}`}><div className="opacity-70">{l}</div><div className="num text-[13px] font-semibold">{v}</div></div>
          ))}
        </div>
      );
    case "chart":
      return (
        <div className="flex h-16 items-end gap-1.5 rounded-xl bg-white/80 p-2">
          {[40, 62, 50, 74, 58, 80].map((h, i) => (
            <div key={i} className="flex flex-1 flex-col justify-end overflow-hidden rounded-t" style={{ height: `${h}%` }}>
              <div className="hatch-teal" style={{ height: "35%" }} /><div className="bg-ink" style={{ height: "65%" }} />
            </div>
          ))}
        </div>
      );
    case "health":
      return (
        <Box className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-full border-[5px] border-accent text-[11px] font-semibold">100%</div>
          <div><b>Everything is mapped</b><div className="muted">10 posting rules point to valid accounts</div></div>
        </Box>
      );
    case "search":
      return (
        <Box>
          <div className="flex items-center gap-2 rounded-full bg-black/5 px-2.5 py-1.5"><Search size={12} />INV-0000<span className="h-3 w-px animate-pulse bg-ink" /></div>
          <div className="mt-1.5 space-y-1"><div className="flex justify-between rounded-lg bg-white px-2 py-1"><span>INV-000026 · Brightside</span><span className="muted">Invoice</span></div><div className="flex justify-between px-2"><span>INV-000025 · Brightside</span><span className="muted">Invoice</span></div></div>
        </Box>
      );
    case "nav":
      return (
        <div className="flex items-center gap-1 rounded-full p-1" style={{ background: "rgba(150,126,102,.55)" }}>
          {["Overview", "Activity", "Manage", "Journal", "Reports"].map((n, i) => <span key={n} className={`rounded-full px-2.5 py-1.5 text-[10.5px] font-medium ${i === 1 ? "bg-white text-ink" : "text-white/90"}`}>{n}</span>)}
        </div>
      );
    case "quick":
      return (
        <div className="flex items-end gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-white shadow"><Plus size={16} /></span>
          <Box className="space-y-1"><div>New invoice</div><div>New bill</div><div>Journal entry</div></Box>
        </div>
      );
    case "filters":
      return <div className="flex flex-wrap gap-1.5"><Pill tone="ink">All</Pill><Pill>Invoices</Pill><Pill>Bills</Pill><Pill tone="rose">Overdue</Pill><Pill tone="mint">Paid</Pill></div>;
    case "table":
      return (
        <Box className="space-y-1">
          <div className="muted grid grid-cols-4 text-[10px]"><span>Number</span><span className="text-right">Net</span><span className="text-right">Tax</span><span className="text-right">Total</span></div>
          <div className="num grid grid-cols-4"><span>INV-000024</span><span className="text-right">1,068,713</span><span className="text-right">80,153</span><span className="text-right font-semibold">1,148,866</span></div>
        </Box>
      );
    case "contact":
      return <Box className="flex items-center gap-2"><Users size={14} /> Brightside Agency <span className="muted ml-auto">due in 14 days</span></Box>;
    case "lines":
      return (
        <Box className="space-y-1.5">
          <div className="flex items-center gap-1.5"><Pill>Web design</Pill><span className="num">1 × ₦1,000,000</span></div>
          <div className="flex gap-1.5"><Pill tone="acc">Loyalty 10%</Pill><Pill tone="teal">VAT 7.5%</Pill></div>
          <div className="muted flex items-center gap-1"><ArrowRight size={11} /> posts to 4010 Service revenue</div>
        </Box>
      );
    case "order":
    case "discount":
      return (
        <Box className="space-y-1">
          <Row k="Line total" v="1,000,000" />
          <Row k="− Loyalty 10% (line)" v="100,000" />
          <Row k="− Trade 5% (document)" v="45,000" />
          <Row k="= Taxable amount" v="855,000" b />
          <Row k="+ VAT 7.5%" v="64,125" />
          <div className="border-t border-black/10 pt-1"><Row k="Customer pays" v="919,125" b /></div>
        </Box>
      );
    case "summary":
      return <div className="rounded-xl bg-teal px-3 py-2.5 text-[11.5px] text-white"><div className="flex justify-between"><span>Net</span><span className="num">₦855,000</span></div><div className="flex justify-between"><span>VAT 7.5%</span><span className="num">₦64,125</span></div><div className="mt-1 text-[10px] opacity-80">Customer pays</div><div className="num text-lg font-semibold">₦919,125</div></div>;
    case "journal":
      return (
        <Box>
          <div className="muted grid grid-cols-[1fr_62px_62px] text-[10px]"><span>Account</span><span className="text-right">Dr</span><span className="text-right">Cr</span></div>
          {[["1100 Receivable", "919,125", ""], ["4900 Sales discounts", "145,000", ""], ["4010 Service revenue", "", "1,000,000"], ["2100 Output VAT", "", "64,125"]].map(([a, d, c]) => (
            <div key={a} className={`num grid grid-cols-[1fr_62px_62px] border-t border-black/5 py-0.5 ${c ? "pl-3" : ""}`}><span>{a}</span><span className="text-right">{d}</span><span className="text-right">{c}</span></div>
          ))}
          <div className="num mt-0.5 flex items-center gap-1 text-mint-fg"><Check size={12} /> 1,064,125 = 1,064,125</div>
        </Box>
      );
    case "post":
      return <div className="flex gap-2"><Pill>Save draft</Pill><Pill tone="ink">Post invoice</Pill><span className="muted self-center text-[11px]">locks it &amp; writes the journal</span></div>;
    case "accounts":
      return (
        <Box className="space-y-1">
          {[["1010", "GTBank current", "₦12.1M"], ["1100", "Accounts receivable", "₦8.7M"], ["2100", "Output VAT payable", "₦1.2M"]].map(([c, n, v]) => (
            <div key={c} className="flex items-center gap-2"><span className="num font-semibold">{c}</span><span>{n}</span><Pill tone="mint">rule</Pill><span className="num ml-auto">{v}</span></div>
          ))}
        </Box>
      );
    case "tabs":
      return <div className="flex flex-wrap gap-1.5"><Pill>Chart of accounts</Pill><Pill tone="ink">Account mapping</Pill><Pill>Tax</Pill><Pill>Discounts</Pill><Pill>Categories</Pill></div>;
    case "resolve":
      return (
        <div className="space-y-1.5 text-[11px]">
          <div className="flex items-center gap-1.5"><Pill>Line: Web design</Pill><Arrow /><Pill tone="teal">Category rule → 4010</Pill></div>
          <div className="flex items-center gap-1.5"><Pill>No rule?</Pill><Arrow /><Pill tone="acc">Default → 4010</Pill></div>
          <div className="flex items-center gap-1.5"><Pill>Missing / inactive?</Pill><Arrow /><Pill tone="rose">Posting blocked</Pill></div>
        </div>
      );
    case "defaults":
      return (
        <Box className="space-y-1.5">
          <div><div className="muted text-[10px]">Accounts receivable</div><div className="rounded-lg bg-white px-2 py-1">1100 · Accounts receivable</div></div>
          <div><div className="muted text-[10px]">Output tax</div><div className="rounded-lg bg-white px-2 py-1">2100 · Output VAT payable</div></div>
        </Box>
      );
    case "category":
      return (
        <Box className="space-y-1">
          <div className="flex items-center gap-1.5"><Pill>Web design</Pill><Arrow /><span>4010 Service revenue</span></div>
          <div className="flex items-center gap-1.5"><Pill>Hosting</Pill><Arrow /><span>4020 Subscription revenue</span></div>
        </Box>
      );
    case "tax":
      return (
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <Box><b>Exclusive</b><div className="num mt-1">100,000<br />+ 7,500 tax<br /><b>= 107,500</b></div></Box>
          <Box><b>Inclusive</b><div className="num mt-1">107,500 price<br />− 7,500 tax<br /><b>= 100,000 net</b></div></Box>
        </div>
      );
    case "entry":
      return (
        <Box className="space-y-1">
          <div className="num flex justify-between"><span>5200 Salaries</span><span>Dr 1,100,000</span></div>
          <div className="num flex justify-between pl-3"><span>1010 GTBank</span><span>Cr 1,100,000</span></div>
          <Pill tone="mint"><Check size={11} /> Balanced</Pill>
        </Box>
      );
    case "ledger":
      return (
        <Box>
          <div className="muted text-[10px]">1010 GTBank current</div>
          {[["Opening", "11,000,000"], ["Payment INV-24", "12,148,866"], ["Payroll", "11,048,866"]].map(([a, b]) => <div key={a} className="num flex justify-between border-t border-black/5 py-0.5"><span>{a}</span><span>{b}</span></div>)}
        </Box>
      );
    case "people":
      return <div className="grid grid-cols-2 gap-2"><Box><b>Kopa Digital</b><div className="muted flex items-center gap-1"><Mail size={10} />Customer</div><div className="num mt-1">Owes ₦1.04M</div></Box><Box><b>Cloudline</b><div className="muted">Vendor</div><div className="num mt-1">You owe ₦92k</div></Box></div>;
    case "period":
      return <div className="inline-flex rounded-full bg-black/10 p-1 text-[11px]">{["This month", "Last month", "This year", "All time"].map((p, i) => <span key={p} className={`rounded-full px-2.5 py-1 ${i === 0 ? "bg-ink text-white" : ""}`}>{p}</span>)}</div>;
    case "statements":
      return <div className="flex flex-wrap gap-1.5"><Pill tone="ink">Profit &amp; loss</Pill><Pill>Balance sheet</Pill><Pill>Trial balance</Pill><Pill>Tax summary</Pill><Pill>Discounts</Pill><Pill>Ageing</Pill></div>;
    case "payment":
      return (
        <Box className="space-y-1.5">
          <div className="flex justify-between"><span>Total</span><span className="num">₦919,125</span></div>
          <div className="hatch-track h-3 overflow-hidden rounded-full"><div className="h-full w-1/2 rounded-full bg-accent" /></div>
          <div className="muted flex items-center gap-1"><CreditCard size={11} /> Part payment ₦459,562 · balance ₦459,563</div>
        </Box>
      );
    case "void":
      return <Box className="flex items-center gap-2"><Undo2 size={14} className="text-rose-fg" /> Original entry stays; a reversing entry cancels it.</Box>;
    case "backup":
      return <div className="flex items-center gap-2"><Pill><Database size={11} />Browser storage</Pill><Arrow /><Pill tone="ink">backup.json</Pill><Arrow /><Pill>Any device</Pill></div>;
    case "done":
      return <div className="flex items-center justify-center gap-2"><span className="grid h-12 w-12 place-items-center rounded-full bg-teal text-white"><Check size={22} /></span><Percent className="text-accent" size={18} /></div>;
    default:
      return null;
  }
}
