# Books360

Double-entry accounting with account mapping, tax rates and discounts. Next.js 16 (App Router), React 19, Tailwind 4, TypeScript. UI follows the frosted-glass finance template.

## Run
```bash
npm install
npm run dev        # http://localhost:3000
npm test           # engine tests (tax, discounts, posting, reports)
npm run build
```
First visit loads demo data (Settings → Start with empty books to clear it).

## Guided tour
A welcome prompt appears on first launch (skippable). The **?** button in the top bar offers *Tour this page*, a *Full walkthrough* (45 steps across every page) and *Show page tips again*. Each page also offers a small dismissible tour the first time you open it. Esc skips; ← → step through.
Steps live in `lib/tour-steps.ts` (add a `data-tour="…"` attribute to an element and reference it as `target`); illustrations are in `components/tour-art.tsx`; the spotlight engine is `components/tour.tsx`.

## How it works
| Area | Where |
|---|---|
| Discount + tax maths (inclusive/exclusive, doc-level discount allocation) | `lib/engine.ts` → `computeDoc` |
| Account mapping resolution + double-entry posting | `lib/engine.ts` → `postingLines` |
| Post / pay / void / reverse (pure reducers) | `lib/engine.ts` |
| P&L, balance sheet, trial balance, tax, ageing | `lib/reports.ts` |
| State (zustand, persisted to localStorage) | `lib/store.ts` |
| Pages | `app/(app)/*` |

**Order of operations:** line discount → document discount (spread across lines) → tax on the discounted amount. Inclusive tax is split out of the discounted price.

**Mapping resolution:** the line's category / tax rate / discount account → default mapping (Manage → Account mapping) → blocked at posting if missing, inactive or the wrong type.

Posted documents are immutable (snapshot stored); voiding or removing a payment posts a reversing entry.

## Next step: a real database
All data access goes through `lib/store.ts`, and the engine is pure, so moving to PostgreSQL means replacing the store actions with server actions / route handlers that call the same engine functions inside a transaction.
