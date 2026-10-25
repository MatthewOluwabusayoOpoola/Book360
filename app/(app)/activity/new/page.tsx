"use client";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { useBooks } from "@/lib/store";
import { DocEditor } from "@/components/doc-editor";

function Inner() {
  const type = useSearchParams().get("type") === "bill" ? "bill" : "invoice";
  const draft = useMemo(() => useBooks.getState().newDraft(type), [type]);
  return <DocEditor key={draft.id} initial={draft} />;
}
export default function NewDoc() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
