"use client";

/**
 * components/PrototypeBanner.tsx
 * Persistent top banner warning that all data is prototype/browser storage only.
 * Dismissible per session (stored in localStorage).
 */

import { useEffect, useState } from "react";
import {
  isStorageBannerDismissed,
  dismissStorageBanner,
} from "@/lib/storage/localStorage";

export default function PrototypeBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isStorageBannerDismissed()) {
      setVisible(true);
    }
  }, []);

  function handleDismiss() {
    dismissStorageBanner();
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="alert"
      className="prototype-banner flex items-center justify-between gap-4 px-4 py-2"
    >
      <span>
        ⚠ PROTOTYPE STORAGE — Data is stored in your browser only (IndexedDB). Not encrypted.
        Not a production quality record. Export backups regularly.
      </span>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss banner"
        className="text-amber-800 hover:text-amber-900 font-bold text-lg leading-none shrink-0"
      >
        ✕
      </button>
    </div>
  );
}
