import type { Books } from "./types";

export interface SearchResult {
  label: string;
  sub: string;
  href: string;
}

interface SearchCandidate extends SearchResult {
  score: number;
  order: number;
}

function matchScore(value: string, query: string, priority: number): number | null {
  const text = value.toLowerCase();
  if (text === query) return priority;
  if (text.startsWith(query)) return 10 + priority;
  if (text.includes(query)) return 20 + priority;
  return null;
}

export function searchBooks(
  query: string,
  books: Books,
  pages: { href: string; label: string }[],
): SearchResult[] {
  const term = query.trim().toLowerCase();
  if (!term) return [];

  const candidates: SearchCandidate[] = [];
  let order = 0;
  const add = (result: SearchResult, score: number | null) => {
    if (score !== null) candidates.push({ ...result, score, order });
    order += 1;
  };
  const contacts = new Map(books.contacts.map((contact) => [contact.id, contact.name]));

  pages.forEach((page) => add({ label: page.label, sub: "Page", href: page.href }, matchScore(page.label, term, 0)));
  books.docs.forEach((doc) => {
    const name = contacts.get(doc.contactId) ?? "";
    const numberScore = matchScore(doc.number, term, 0);
    const contactScore = name ? matchScore(name, term, 1) : null;
    const score = numberScore === null
      ? contactScore
      : contactScore === null
        ? numberScore
        : Math.min(numberScore, contactScore);
    add(
      { label: `${doc.number} · ${name || "No contact"}`, sub: doc.type === "invoice" ? "Invoice" : "Bill", href: `/activity/${doc.id}` },
      score,
    );
  });
  books.accounts.forEach((account) => {
    const codeScore = matchScore(account.code, term, 0);
    const nameScore = matchScore(account.name, term, 1);
    const score = codeScore === null
      ? nameScore
      : nameScore === null
        ? codeScore
        : Math.min(codeScore, nameScore);
    add({ label: `${account.code} ${account.name}`, sub: "Account", href: `/journal?account=${account.id}` }, score);
  });
  books.contacts.forEach((contact) => {
    add({ label: contact.name, sub: "Contact", href: `/contacts/${contact.id}` }, matchScore(contact.name, term, 0));
  });

  return candidates
    .sort((a, b) => a.score - b.score || a.order - b.order)
    .map(({ label, sub, href }) => ({ label, sub, href }));
}
