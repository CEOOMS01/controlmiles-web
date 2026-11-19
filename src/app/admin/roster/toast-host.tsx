"use client";

// A floating notice that outlives the row-actions menu (the menu unmounts its
// children when it closes, so a notice kept inside them would vanish with it).
// Anything on the roster can call showToast(); one <ToastHost /> shows it.

import { useEffect, useState } from "react";

type Toast = { text: string; ok: boolean };
const EVENT = "cm-roster-toast";

export function showToast(toast: Toast) {
  window.dispatchEvent(new CustomEvent<Toast>(EVENT, { detail: toast }));
}

export function ToastHost() {
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    function onToast(e: Event) {
      setToast((e as CustomEvent<Toast>).detail);
      clearTimeout(timer);
      timer = setTimeout(() => setToast(null), 6000);
    }
    window.addEventListener(EVENT, onToast);
    return () => {
      window.removeEventListener(EVENT, onToast);
      clearTimeout(timer);
    };
  }, []);

  if (!toast) return null;
  return (
    <div
      role={toast.ok ? "status" : "alert"}
      className={`fixed bottom-6 left-1/2 z-[60] max-w-[90vw] -translate-x-1/2 rounded-xl border bg-surface px-4 py-3 text-sm font-medium shadow-lg ${
        toast.ok ? "border-success/30 text-success" : "border-danger/30 text-danger"
      }`}
    >
      {toast.text}
    </div>
  );
}
