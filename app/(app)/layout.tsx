import { BooksGate } from "@/components/shell";
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <BooksGate>{children}</BooksGate>;
}
