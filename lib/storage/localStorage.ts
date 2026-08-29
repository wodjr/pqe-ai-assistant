/**
 * lib/storage/localStorage.ts — PQE AI Assistant
 *
 * localStorage helpers for small, non-sensitive preferences only.
 *
 * Rules:
 * - Store only: current audit ID, draft navigation state, UI preferences.
 * - NEVER store: blobs, evidence content, supplier documents, drawing data.
 * - All values are serialised as JSON strings.
 */

const KEYS = {
  CURRENT_AUDIT_ID: "pqe:currentAuditId",
  AUDITOR_NAME: "pqe:auditorName",
  LAST_VISITED: "pqe:lastVisited",
  STORAGE_BANNER_DISMISSED: "pqe:storageBannerDismissed",
} as const;

type LSKey = (typeof KEYS)[keyof typeof KEYS];

function lsGet<T>(key: LSKey): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function lsSet<T>(key: LSKey, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded or private browsing — silently ignore
  }
}

function lsRemove(key: LSKey): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getCurrentAuditId(): string | null {
  return lsGet<string>(KEYS.CURRENT_AUDIT_ID);
}

export function setCurrentAuditId(id: string): void {
  lsSet(KEYS.CURRENT_AUDIT_ID, id);
}

export function clearCurrentAuditId(): void {
  lsRemove(KEYS.CURRENT_AUDIT_ID);
}

export function getAuditorName(): string {
  return lsGet<string>(KEYS.AUDITOR_NAME) ?? "";
}

export function setAuditorName(name: string): void {
  lsSet(KEYS.AUDITOR_NAME, name);
}

export function getLastVisited(): string | null {
  return lsGet<string>(KEYS.LAST_VISITED);
}

export function setLastVisited(path: string): void {
  lsSet(KEYS.LAST_VISITED, path);
}

export function isStorageBannerDismissed(): boolean {
  return lsGet<boolean>(KEYS.STORAGE_BANNER_DISMISSED) ?? false;
}

export function dismissStorageBanner(): void {
  lsSet(KEYS.STORAGE_BANNER_DISMISSED, true);
}

export function clearAllPreferences(): void {
  Object.values(KEYS).forEach((k) => lsRemove(k as LSKey));
}
