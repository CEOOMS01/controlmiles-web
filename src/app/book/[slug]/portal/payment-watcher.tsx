"use client";

// Waits for the school's payment system to tell us the order was paid (2026-11-19) and shows it the moment it is.
// Checks every 4 seconds for up to 20 minutes; the page can be left open while the client pays in another tab.

import { useEffect, useState } from "react";
import { orderStatus } from "./order-action";

export function PaymentWatcher({ orderId, initial = "pending_payment" }: { orderId: string; initial?: string }) {
  const [status, setStatus] = useState(initial);

  useEffect(() => {
    if (status === "paid" || status === "cancelled") return;
    let stopped = false;
    const started = Date.now();
    const tick = async () => {
      if (stopped || document.hidden) return;
      const s = await orderStatus(orderId);
      if (!stopped && s !== "unknown") setStatus(s);
    };
    const t = setInterval(() => {
      if (Date.now() - started > 20 * 60 * 1000) clearInterval(t);
      else void tick();
    }, 4000);
    const onVisible = () => void tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [orderId, status]);

  if (status === "paid") {
    return (
      <p className="mt-3 rounded-lg bg-success/10 px-3 py-2 text-sm font-medium text-success" role="status">
        Payment received. Thank you!
      </p>
    );
  }
  if (status === "cancelled") {
    return <p className="mt-3 text-sm text-muted">This order was cancelled. Contact the school if that is a mistake.</p>;
  }
  return (
    <p className="mt-3 text-sm text-muted" role="status">
      Waiting for your payment. This page updates by itself when it arrives.
    </p>
  );
}
