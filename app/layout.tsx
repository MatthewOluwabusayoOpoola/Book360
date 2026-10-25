import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Books360 · Accounts, tax and discounts in one place",
  description: "Double-entry accounting with account mapping, tax rates and discounts.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#cfc1b0" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="scene" aria-hidden>
          <i /><i /><i /><i /><i />
        </div>
        {children}
      </body>
    </html>
  );
}
