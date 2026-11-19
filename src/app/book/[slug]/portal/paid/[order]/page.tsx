// Olympus Mont Systems LLC - ControlMiles Web
// src/app/book/[slug]/portal/paid/[order]/page.tsx
//
// Where the school's payment page sends the client after paying (2026-11-19). It shows the order and waits for the
// school's payment system to confirm it; the confirmation comes from the school's processor, not from this page, so
// opening this address proves nothing. No analytics: the visitors are often minors.

import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/driving-school";
import { PaymentWatcher } from "../../payment-watcher";

export const metadata: Metadata = { title: "Payment", robots: { index: false, follow: false } };

type OrderInfo = { status: string; service: string; price_cents: number; school: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaidPage({ params }: { params: Promise<{ slug: string; order: string }> }) {
  const { slug, order } = await params;
  let info: OrderInfo | null = null;
  if (UUID.test(order)) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("ds_public_order_status", { p_order: order });
    info = (data as OrderInfo | null) ?? null;
  }

  if (!info) {
    return (
      <main className="mx-auto max-w-lg px-6 py-20 text-center">
        <h1 className="text-xl font-semibold">We can&apos;t find this order</h1>
        <p className="mt-2 text-sm text-muted">Contact the driving school directly.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <p className="text-sm font-semibold tracking-wide text-accent uppercase">{info.school}</p>
      <h1 className="mt-1 text-2xl font-semibold">Your payment</h1>
      <p className="mt-3 text-base">
        {info.service} · {money(info.price_cents)}
      </p>
      <PaymentWatcher orderId={order} initial={info.status} />
      <p className="mt-8 text-sm">
        <a href={`/book/${slug}/portal`} className="font-medium text-accent hover:underline">
          Back to services
        </a>
      </p>
    </main>
  );
}
