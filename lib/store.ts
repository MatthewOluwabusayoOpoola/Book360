"use client";
import { create } from "zustand";
import {
  addManualEntry,
  postDoc,
  recordPayment,
  removePayment,
  uid,
  voidDoc,
  nextNumber,
  addDays,
  todayISO,
  type Result,
} from "./engine";
import { demoBooks, emptyBooks } from "./seed";
import type { Account, Books, Category, Contact, Discount, Doc, JournalLine, Mappings, Settings, TaxRate } from "./types";

interface State {
  books: Books;
  /* generic */
  loadDemo: () => void;
  startBlank: () => void;
  importBooks: (b: Books) => void;
  updateSettings: (s: Partial<Settings>) => void;
  /* setup */
  saveAccount: (a: Omit<Account, "id"> & { id?: string }) => void;
  deleteAccount: (id: string) => void;
  saveTax: (t: Omit<TaxRate, "id"> & { id?: string }) => void;
  deleteTax: (id: string) => void;
  saveDiscount: (d: Omit<Discount, "id"> & { id?: string }) => void;
  deleteDiscount: (id: string) => void;
  saveCategory: (c: Omit<Category, "id"> & { id?: string }) => void;
  deleteCategory: (id: string) => void;
  saveContact: (c: Omit<Contact, "id"> & { id?: string }) => void;
  deleteContact: (id: string) => void;
  setMapping: (k: keyof Mappings, accountId: string) => void;
  /* documents */
  newDraft: (type: Doc["type"]) => Doc;
  saveDraft: (d: Doc) => string;
  deleteDraft: (id: string) => void;
  post: (id: string) => Result;
  pay: (id: string, p: { date: string; amount: number; accountId: string; reference: string }) => Result;
  unpay: (id: string, paymentId: string) => Result;
  voidDocument: (id: string) => Result;
  addJournal: (e: { date: string; memo: string; lines: JournalLine[] }) => Result;
}

const upsert = <T extends { id: string }>(list: T[], item: Omit<T, "id"> & { id?: string }, prefix: string): T[] => {
  if (item.id && list.some((x) => x.id === item.id)) return list.map((x) => (x.id === item.id ? ({ ...x, ...item } as T) : x));
  return [...list, { ...item, id: item.id ?? uid(prefix) } as T];
};

export const useBooks = create<State>()((set, get) => {
      const apply = (r: Result) => {
        if (r.ok) set({ books: r.books });
        return r;
      };
      const patch = (f: (b: Books) => Partial<Books>) => set((s) => ({ books: { ...s.books, ...f(s.books) } }));
      return {
        books: emptyBooks(),
        loadDemo: () => set({ books: demoBooks() }),
        startBlank: () => set({ books: emptyBooks() }),
        importBooks: (b) => set({ books: b }),
        updateSettings: (s) => patch((b) => ({ settings: { ...b.settings, ...s } })),

        saveAccount: (a) => patch((b) => ({ accounts: upsert(b.accounts, a, "acc") })),
        deleteAccount: (id) => patch((b) => ({ accounts: b.accounts.filter((x) => x.id !== id) })),
        saveTax: (t) => patch((b) => ({ taxes: upsert(b.taxes, t, "tax") })),
        deleteTax: (id) => patch((b) => ({ taxes: b.taxes.filter((x) => x.id !== id) })),
        saveDiscount: (d) => patch((b) => ({ discounts: upsert(b.discounts, d, "disc") })),
        deleteDiscount: (id) => patch((b) => ({ discounts: b.discounts.filter((x) => x.id !== id) })),
        saveCategory: (c) => patch((b) => ({ categories: upsert(b.categories, c, "cat") })),
        deleteCategory: (id) => patch((b) => ({ categories: b.categories.filter((x) => x.id !== id) })),
        saveContact: (c) => patch((b) => ({ contacts: upsert(b.contacts, c, "con") })),
        deleteContact: (id) => patch((b) => ({ contacts: b.contacts.filter((x) => x.id !== id) })),
        setMapping: (k, accountId) => patch((b) => ({ mappings: { ...b.mappings, [k]: accountId } })),

        newDraft: (type) => {
          const b = get().books;
          const today = todayISO();
          return {
            id: uid("doc"),
            type,
            number: nextNumber(b, type).label,
            contactId: "",
            date: today,
            dueDate: addDays(today, 14),
            status: "draft",
            lines: [],
            notes: "",
            payments: [],
          };
        },
        saveDraft: (d) => {
          const b = get().books;
          const exists = b.docs.some((x) => x.id === d.id);
          if (exists) {
            patch((bk) => ({ docs: bk.docs.map((x) => (x.id === d.id ? d : x)) }));
          } else {
            const { n, label } = nextNumber(b, d.type);
            patch((bk) => ({
              docs: [...bk.docs, { ...d, number: label }],
              counters: { ...bk.counters, [d.type]: n },
            }));
          }
          return d.id;
        },
        deleteDraft: (id) => patch((b) => ({ docs: b.docs.filter((d) => !(d.id === id && d.status === "draft")) })),
        post: (id) => apply(postDoc(get().books, id)),
        pay: (id, p) => apply(recordPayment(get().books, id, p)),
        unpay: (id, pid) => apply(removePayment(get().books, id, pid)),
        voidDocument: (id) => apply(voidDoc(get().books, id)),
        addJournal: (e) => apply(addManualEntry(get().books, e)),
      };
});

/* ------------------------------------------------------------------ */
/* per-user persistence                                                */
/* ------------------------------------------------------------------ */
const keyFor = (uid: string) => `books360.v2.${uid}`;
const LEGACY_KEY = "books360.v1"; // single-user data saved before sign-in existed
let activeUid: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

export const currentUserId = () => activeUid ?? "anon";

function save() {
  if (!activeUid) return;
  try {
    localStorage.setItem(keyFor(activeUid), JSON.stringify({ books: useBooks.getState().books }));
  } catch {
    /* storage full or unavailable: the books stay in memory for this session */
  }
}

/** Load (or create) the books that belong to this signed-in user, then start saving them. */
export function activateUser(uid: string): void {
  if (timer) clearTimeout(timer);
  save(); // flush the previous user's pending changes first
  activeUid = null; // pause saving while we swap data
  let books: Books | null = null;
  try {
    const raw = localStorage.getItem(keyFor(uid));
    if (raw) books = (JSON.parse(raw) as { books?: Books }).books ?? null;
    if (!books) {
      // first sign-in on this browser: adopt data from before accounts existed
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        books = (JSON.parse(legacy) as { state?: { books?: Books } }).state?.books ?? null;
        if (books) localStorage.removeItem(LEGACY_KEY);
      }
    }
  } catch {
    books = null;
  }
  useBooks.setState({ books: books ?? demoBooks() });
  activeUid = uid;
  save();
}

export function deactivateUser(): void {
  save();
  activeUid = null;
  useBooks.setState({ books: emptyBooks() });
}

if (typeof window !== "undefined") {
  useBooks.subscribe((s, prev) => {
    if (!activeUid || s.books === prev.books) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(save, 150);
  });
  window.addEventListener("pagehide", () => save());
}
