"use client";
/**
 * components/Card.tsx — reusable surface card
 */

interface Props {
  children: React.ReactNode;
  className?: string;
  title?: string;
  action?: React.ReactNode;
}

export default function Card({ children, className = "", title, action }: Props) {
  return (
    <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm ${className}`}>
      {title && (
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 font-semibold text-slate-700 dark:text-slate-200 text-sm flex items-center justify-between gap-3">
          <span>{title}</span>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
