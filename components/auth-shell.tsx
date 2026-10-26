import type { ReactNode } from "react";
import { BookOpen, Percent, ShieldCheck } from "lucide-react";

/** Frosted two-panel frame shared by the sign-in and sign-up pages. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="glass sheet sheet-in grid w-full max-w-[980px] overflow-hidden md:grid-cols-[1.05fr_1fr]">
        <section className="relative hidden flex-col justify-between gap-10 p-10 md:flex">
          <div>
            <span className="inline-flex items-center gap-2.5 text-[15px] font-semibold">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-ink text-white">B</span>
              Books360
            </span>
            <h1 className="mt-10 text-[38px] font-semibold leading-[1.08] tracking-[-0.03em]">Every invoice, tax and discount, traced to the ledger.</h1>
            <p className="muted mt-4 max-w-sm text-[15px]">Double-entry accounting where each posting follows your account mapping, so reports always add up.</p>
          </div>
          <ul className="space-y-3 text-sm">
            {[
              [BookOpen, "Balanced journal entries on every post"],
              [Percent, "Inclusive and exclusive tax, line and document discounts"],
              [ShieldCheck, "Your books are kept separate from other users"],
            ].map(([Icon, t]) => {
              const I = Icon as typeof BookOpen;
              return (
                <li key={t as string} className="flex items-center gap-3">
                  <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-white/70"><I size={15} /></span>
                  {t as string}
                </li>
              );
            })}
          </ul>
        </section>
        <section className="grid place-items-center bg-white/45 p-6 sm:p-10">{children}</section>
      </div>
    </main>
  );
}

export const clerkLook = {
  variables: {
    colorPrimary: "#151515",
    colorText: "#151515",
    colorBackground: "transparent",
    colorInputBackground: "rgba(255,255,255,.8)",
    colorDanger: "#c9402f",
    borderRadius: "0.9rem",
    fontFamily: '"Inter Variable", ui-sans-serif, system-ui, sans-serif',
  },
  elements: {
    rootBox: "w-full",
    cardBox: "shadow-none w-full",
    card: "shadow-none bg-transparent p-0 w-full",
    footer: "bg-transparent",
    formButtonPrimary: "rounded-full h-11 text-sm font-semibold normal-case shadow-none",
    socialButtonsBlockButton: "rounded-full h-11",
  },
} as const;
