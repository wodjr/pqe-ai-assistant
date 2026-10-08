"use client";
/**
 * components/Card.tsx — reusable surface card
 */

interface Props {
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export default function Card({ children, className = "", title }: Props) {
  return (
    <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm ${className}`}>
      {title && (
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 font-semibold text-slate-700 dark:text-slate-200 text-sm">
          {title}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
