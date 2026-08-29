"use client";
/**
 * components/StatusBadge.tsx
 * Renders colour-coded status / classification badges.
 */

import type { FindingClass, CARStatus, ResponseStatus, VerificationVerdict } from "@/types/project";

type BadgeVariant =
  | FindingClass
  | CARStatus
  | ResponseStatus
  | VerificationVerdict
  | "APPROVED"
  | "DRAFT"
  | "AI_SUGGESTION";

const VARIANT_MAP: Record<string, { bg: string; text: string; label: string }> = {
  // Finding classifications
  MAJOR:     { bg: "bg-red-100",    text: "text-red-700",    label: "Major" },
  MINOR:     { bg: "bg-amber-100",  text: "text-amber-700",  label: "Minor" },
  OBSERVATION:{ bg:"bg-blue-100",   text: "text-blue-700",   label: "Observation" },
  OFI:       { bg: "bg-blue-50",    text: "text-blue-600",   label: "OFI" },

  // Supplier response
  CONFORMING:    { bg: "bg-green-100",  text: "text-green-700",  label: "Conforming" },
  MINOR_NC:      { bg: "bg-amber-100",  text: "text-amber-700",  label: "Minor NC" },
  MAJOR_NC:      { bg: "bg-red-100",    text: "text-red-700",    label: "Major NC" },
  NOT_APPLICABLE:{ bg: "bg-slate-100",  text: "text-slate-500",  label: "N/A" },
  NOT_ASSESSED:  { bg: "bg-slate-100",  text: "text-slate-400",  label: "Not Assessed" },

  // Verification verdict
  CONFORMS:        { bg: "bg-green-100",  text: "text-green-700",  label: "Conforms" },
  NOT_VERIFIABLE:  { bg: "bg-slate-100",  text: "text-slate-500",  label: "Not Verifiable" },

  // CAR status
  OPEN:              { bg: "bg-red-100",    text: "text-red-700",    label: "Open" },
  CONTAINMENT:       { bg: "bg-orange-100", text: "text-orange-700", label: "Containment" },
  ROOT_CAUSE:        { bg: "bg-yellow-100", text: "text-yellow-700", label: "Root Cause" },
  CORRECTIVE_ACTION: { bg: "bg-blue-100",   text: "text-blue-700",   label: "Corrective Action" },
  EFFECTIVENESS:     { bg: "bg-indigo-100", text: "text-indigo-700", label: "Effectiveness" },
  CLOSED:            { bg: "bg-green-100",  text: "text-green-700",  label: "Closed" },
  OVERDUE:           { bg: "bg-red-200",    text: "text-red-800",    label: "⚠ Overdue" },

  // Generic
  APPROVED:      { bg: "bg-green-100",  text: "text-green-700",  label: "Approved" },
  DRAFT:         { bg: "bg-slate-100",  text: "text-slate-500",  label: "Draft" },
  AI_SUGGESTION: { bg: "bg-amber-50",   text: "text-amber-700",  label: "AI Suggestion" },
};

interface Props {
  variant: BadgeVariant | string;
  label?: string;
  className?: string;
}

export default function StatusBadge({ variant, label, className = "" }: Props) {
  const def = VARIANT_MAP[variant] ?? { bg: "bg-slate-100", text: "text-slate-600", label: variant };
  return (
    <span
      className={`badge ${def.bg} ${def.text} ${className}`}
      role="status"
    >
      {label ?? def.label}
    </span>
  );
}
