import { test } from "node:test";
import assert from "node:assert/strict";

// minimal browser shims so lib/store.ts can run under node
const mem = new Map<string, string>();
const g = globalThis as unknown as Record<string, unknown>;
g.localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
g.window = { addEventListener() {} };

const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));

test("each user gets separate books that persist", async () => {
  const { useBooks, activateUser, deactivateUser } = await import("../lib/store");
  activateUser("user_a");
  const demoDocs = useBooks.getState().books.docs.length;
  assert.ok(demoDocs > 10, "new user starts with demo data");

  useBooks.getState().updateSettings({ companyName: "A Ltd" });
  await wait();

  activateUser("user_b");
  assert.equal(useBooks.getState().books.settings.companyName, "My company", "user B must not see user A's changes");
  useBooks.getState().updateSettings({ companyName: "B Ltd" });
  await wait();

  activateUser("user_a");
  assert.equal(useBooks.getState().books.settings.companyName, "A Ltd", "A's data restored");
  activateUser("user_b");
  assert.equal(useBooks.getState().books.settings.companyName, "B Ltd", "B's data restored");

  deactivateUser();
  assert.equal(useBooks.getState().books.docs.length, 0, "signed out → nothing left in memory");
  useBooks.getState().updateSettings({ companyName: "leak" });
  await wait();
  const keys = [...mem.keys()];
  assert.ok(keys.every((k) => k.startsWith("books360.v2.")), "only per-user keys are written");
  assert.ok(!mem.get("books360.v2.user_b")!.includes("leak"), "edits while signed out are never saved to a user");
});

test("an explicitly emptied book stays empty (no demo reload)", async () => {
  const { useBooks, activateUser } = await import("../lib/store");
  activateUser("user_c");
  useBooks.getState().startBlank();
  await wait();
  activateUser("user_a");
  activateUser("user_c");
  assert.equal(useBooks.getState().books.docs.length, 0);
});

test("first sign-in adopts pre-auth data once", async () => {
  mem.clear();
  const { useBooks, activateUser } = await import("../lib/store");
  const { emptyBooks } = await import("../lib/seed");
  const legacy = emptyBooks();
  legacy.settings.companyName = "Legacy Co";
  mem.set("books360.v1", JSON.stringify({ state: { books: legacy }, version: 1 }));
  activateUser("first");
  assert.equal(useBooks.getState().books.settings.companyName, "Legacy Co");
  assert.equal(mem.has("books360.v1"), false, "legacy key consumed");
  activateUser("second");
  assert.equal(useBooks.getState().books.settings.companyName, "My company", "second user does not get legacy data");
});
