"use client";
/**
 * components/LoadingSpinner.tsx
 */
interface LoadingSpinnerProps {
  message?: string;
  text?: string;
  inline?: boolean;
}

export default function LoadingSpinner({ message, text, inline = false }: LoadingSpinnerProps) {
  const label = text || message || "Loading…";

  if (inline) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
        {label && <span>{label}</span>}
      </span>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}
