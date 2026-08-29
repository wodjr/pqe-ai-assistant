"use client";
/**
 * components/EmptyState.tsx
 */
interface Props {
  title: string;
  description?: string;
  action?: React.ReactNode;
}
export default function EmptyState({ title, description, action }: Props) {
  return (
    <div className="text-center py-16 px-4">
      <div className="text-4xl mb-3">📋</div>
      <h3 className="text-lg font-semibold text-slate-700">{title}</h3>
      {description && <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
