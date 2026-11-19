"use client";

// Orders from the school's portal (2026-11-18): the client chose a service and pays the school itself.
// The school marks each one paid when the money arrives.

import { useState, useTransition } from "react";
import { money } from "@/lib/driving-school";
import { setOrderStatus } from "./actions";

export type ServiceOrder = {
  id: string;
  service_name: string;
  price_cents: number;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  note: string | null;
  status: "pending_payment" | "paid" | "cancelled";
  created_at: string;
  branch: string | null;
  paid_via: "manual" | "banquest" | null;
  review_note: string | null;
};

export function ServiceOrders({ orders }: { orders: ServiceOrder[] }) {
  const [showAll, setShowAll] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const open = orders.filter((o) => o.status === "pending_payment");
  const shown = showAll ? orders : open;
  if (orders.length === 0) return null;

  const set = (id: string, status: "paid" | "cancelled" | "pending_payment") =>
    start(async () => {
      const r = await setOrderStatus(id, status);
      setError(r.error);
    });

  return (
    <section className="mb-6 rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="font-semibold">
          Service orders <span className="text-sm font-normal text-muted">· {open.length} waiting for payment</span>
        </h2>
        <button type="button" onClick={() => setShowAll((v) => !v)} className="text-sm text-accent hover:underline">
          {showAll ? "Only waiting" : "Show all"}
        </button>
      </div>
      {error && <p className="px-4 pt-3 text-sm text-danger">{error}</p>}
      {shown.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted">Nothing waiting for payment.</p>
      ) : (
        <ul className="divide-y divide-border">
          {shown.map((o) => (
            <li key={o.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium">
                  {o.client_name} · {o.service_name} · {money(o.price_cents)}
                </p>
                <p className="text-xs text-muted">
                  {[o.client_email, o.client_phone, o.branch, new Date(o.created_at).toLocaleDateString("en-US", { dateStyle: "medium" })]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {o.note && <p className="mt-1 text-sm text-muted">{o.note}</p>}
                {o.review_note && <p className="mt-1 text-sm text-danger">Check this order: {o.review_note}</p>}
              </div>
              <div className="flex items-center gap-2">
                {o.status === "pending_payment" ? (
                  <>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => set(o.id, "paid")}
                      className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground disabled:opacity-60"
                    >
                      Mark paid
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => set(o.id, "cancelled")}
                      className="rounded-lg border border-border px-3 py-1.5 text-sm hover:border-border-strong disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span className="rounded-full bg-border px-2 py-0.5 text-xs">{o.status === "paid" ? (o.paid_via === "banquest" ? "Paid online" : "Paid") : "Cancelled"}</span>
                    <button type="button" disabled={pending} onClick={() => set(o.id, "pending_payment")} className="text-xs text-muted hover:text-foreground">
                      Undo
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
