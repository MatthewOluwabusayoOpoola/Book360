import { test } from "node:test";
import assert from "node:assert/strict";
import { searchBooks } from "../lib/search";
import { demoBooks } from "../lib/seed";

const pages = [
  { href: "/", label: "Overview" },
  { href: "/reports", label: "Reports" },
];

test("exact contact match ranks ahead of all matching documents", () => {
  const results = searchBooks("Brightside Agency", demoBooks("2026-10-25"), pages);

  assert.equal(results[0].sub, "Contact");
  assert.equal(results[0].label, "Brightside Agency");
  assert.equal(results[0].href, "/contacts/p_bright");
  assert.ok(results.filter((result) => result.sub === "Invoice").length > 1);
});

test("search returns every matching result instead of limiting the list", () => {
  const results = searchBooks("a", demoBooks("2026-10-25"), pages);

  assert.ok(results.length > 7);
});

test("exact document number ranks ahead of name and partial matches", () => {
  const results = searchBooks("INV-000024", demoBooks("2026-10-25"), pages);

  assert.equal(results[0].label, "INV-000024 · Kopa Digital");
  assert.equal(results[0].sub, "Invoice");
});

test("matches page labels and account codes case-insensitively", () => {
  const books = demoBooks("2026-10-25");

  assert.equal(searchBooks("reports", books, pages)[0].sub, "Page");
  assert.equal(searchBooks("4010", books, pages)[0].label, "4010 Service revenue");
});
