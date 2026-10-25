"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
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
  hydrated: boolean;
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

export const useBooks = create<State>()(
  persist(
    (set, get) => {
      const apply = (r: Result) => {
        if (r.ok) set({ books: r.books });
        return r;
      };
      const patch = (f: (b: Books) => Partial<Books>) => set((s) => ({ books: { ...s.books, ...f(s.books) } }));
      return {
        books: emptyBooks(),
        hydrated: false,
        loadDemo: () => {
          try { localStorage.removeItem("books360.blank"); } catch {}
          set({ books: demoBooks() });
        },
        startBlank: () => {
          try { localStorage.setItem("books360.blank", "1"); } catch {}
          set({ books: emptyBooks() });
        },
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
    },
    {
      name: "books360.v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ books: s.books }),
      skipHydration: true,
      onRehydrateStorage: () => (state, err) => {
        // first visit: nothing stored yet → start with demo data so every screen has something to show
        if (!err && state && state.books.journal.length === 0 && state.books.docs.length === 0 && !localStorage.getItem("books360.blank")) {
          state.loadDemo();
        }
      },
    },
  ),
);
