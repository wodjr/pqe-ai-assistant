import type { Metadata, Viewport } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";
import PrototypeBanner from "@/components/PrototypeBanner";

export const metadata: Metadata = {
  title: "PQE AI Assistant",
  description:
    "Procurement Quality Engineering — AI-assisted supplier audit and qualification platform",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-slate-50">
        <PrototypeBanner />
        <NavBar />
        <main className="flex-1 w-full max-w-screen-xl mx-auto px-4 sm:px-6 py-6">
          {children}
        </main>
        <footer className="text-center text-xs text-slate-400 py-4 border-t border-slate-200">
          PQE AI Assistant — Prototype v0.2.0 — Browser storage only — Not a production quality record
        </footer>
        {/* Service Worker registration — enables offline app shell caching */}
        <script
          dangerouslySetInnerHTML={{
            __html: `if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/sw.js').catch(function(){}); }`,
          }}
        />
      </body>
    </html>
  );
}
