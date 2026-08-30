"use client";

/**
 * components/NavBar.tsx
 * Primary navigation bar. Mobile-responsive with hamburger menu.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { classNames } from "@/lib/utils/format";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/" },
  { label: "Checklists", href: "/checklists" },
  { label: "Audits", href: "/audits" },
  { label: "Suppliers", href: "/suppliers" },
  { label: "Findings", href: "/findings" },
  { label: "CARs", href: "/cars" },
  { label: "Manufacturing", href: "/manufacturing" },
  { label: "Settings", href: "/settings" },
];

export default function NavBar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="no-print bg-slate-800 text-white shadow-md sticky top-0 z-50">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 font-bold text-white text-base tracking-tight"
        >
          <span className="bg-blue-600 text-white rounded px-2 py-0.5 text-xs font-black tracking-wider">
            PQE
          </span>
          <span className="hidden sm:inline">AI Assistant</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={classNames(
                "px-3 py-1.5 rounded text-sm font-medium transition-colors",
                pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-700 hover:text-white"
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* Help icon */}
        <a
          href="/manual.html"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open User Manual"
          className="hidden md:flex items-center justify-center w-8 h-8 rounded text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
          title="User Manual"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </a>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 rounded text-slate-300 hover:text-white hover:bg-slate-700"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
        >
          {menuOpen ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-slate-800 border-t border-slate-700 px-4 py-2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className={classNames(
                "block px-3 py-2 rounded text-sm font-medium mb-1 transition-colors",
                pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-700 hover:text-white"
              )}
            >
              {item.label}
            </Link>
          ))}
          <a
            href="/manual.html"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMenuOpen(false)}
            className="block px-3 py-2 rounded text-sm font-medium mb-1 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          >
            ? Help / Manual
          </a>
        </div>
      )}
    </nav>
  );
}
