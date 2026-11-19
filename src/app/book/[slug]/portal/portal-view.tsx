"use client";

// The portal's body: pick a location, see that location's services and prices, and how to pay the school.

import { useActionState, useEffect, useRef, useState } from "react";
import { money } from "@/lib/driving-school";
import { sendOrder, type OrderState } from "./order-action";
import { PaymentWatcher } from "./payment-watcher";

export type PortalData = {
  school: string;
  intro: string | null;
  branches: { id: string; name: string }[];
  services: {
    id: string;
    name: string;
    description: string | null;
    kind: "lesson" | "group_class" | "product";
    price_cents: number;
    minutes: number | null;
    branch_id: string | null;
  }[];
  payment: { mode: "at_school" | "link" | "banquest"; link: string | null; instructions: string | null } | null;
};

const KIND: Record<string, string> = { lesson: "Driving lesson", group_class: "Group class", product: "" };

function duration(minutes: number | null) {
  if (!minutes) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h ? `${h} h` : "", m ? `${m} min` : ""].filter(Boolean).join(" ");
}

function PayBlock({ page }: { page: PortalData }) {
  const pay = page.payment;
  if (pay?.mode === "banquest") {
    return (
      <p className="mt-1 text-sm text-muted">
        {pay.instructions || `Choose a service and you go to ${page.school}'s secure payment page. Your order is confirmed as soon as you pay.`}
      </p>
    );
  }
  return pay?.mode === "link" && pay.link ? (
    <>
      <p className="mt-1 text-sm text-muted">You pay {page.school} directly, on the school&apos;s own payment page.</p>
      {pay.instructions && <p className="mt-2 text-sm">{pay.instructions}</p>}
      <a
        href={pay.link}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90"
      >
        Pay {page.school}
      </a>
    </>
  ) : (
    <p className="mt-1 text-sm text-muted">{pay?.instructions || `You pay at ${page.school}, in person.`}</p>
  );
}

// Choose a service: contact details, then the "pending payment" summary with the way to pay the school.
function OrderBox({
  slug,
  page,
  service,
  onClose,
}: {
  slug: string;
  page: PortalData;
  service: PortalData["services"][number];
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState<OrderState, FormData>(sendOrder.bind(null, slug), {
    error: null,
    done: null,
  });
  const input = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

  if (state.done) {
    const d = state.done;
    return (
      <section className="mt-6 rounded-xl border border-border bg-surface p-5">
        <p className="text-xs font-semibold tracking-wide text-accent uppercase">Pending payment</p>
        <h2 className="mt-1 text-lg font-semibold">
          {service.name} · {money(service.price_cents)}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {page.school} has your order. It is confirmed when the school receives your payment.
        </p>
        <div className="mt-4 border-t border-border pt-4">
          <h3 className="font-semibold">How to pay</h3>
          {d.automatic && d.pay_link && d.order_id ? (
            <>
              <p className="mt-1 text-sm text-muted">You pay {page.school} on its secure payment page. It opens in a new tab.</p>
              <a
                href={d.pay_link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90"
              >
                Pay {money(service.price_cents)}
              </a>
              <PaymentWatcher orderId={d.order_id} />
            </>
          ) : d.automatic ? (
            <p className="mt-1 text-sm text-muted">
              We couldn&apos;t open the payment page right now. {page.school} has your order and will contact you to arrange the payment.
            </p>
          ) : (
            <PayBlock page={page} />
          )}
        </div>
        <button type="button" onClick={onClose} className="mt-4 text-sm font-medium text-accent hover:underline">
          Back to services
        </button>
      </section>
    );
  }

  return (
    <form action={action} className="mt-6 rounded-xl border border-border bg-surface p-5">
      <h2 className="text-lg font-semibold">
        {service.name} · {money(service.price_cents)}
      </h2>
      <p className="mt-1 text-sm text-muted">Tell the school who you are. You pay the school after this step.</p>
      <input type="hidden" name="service_id" value={service.id} />
      <div aria-hidden className="hidden">
        <input name="company" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="o-name" className="mb-1 block text-sm font-medium">Full name</label>
          <input id="o-name" name="client_name" required maxLength={120} defaultValue={state.values?.client_name} className={input} />
        </div>
        <div>
          <label htmlFor="o-email" className="mb-1 block text-sm font-medium">Email</label>
          <input id="o-email" name="client_email" type="email" maxLength={120} defaultValue={state.values?.client_email} className={input} />
        </div>
        <div>
          <label htmlFor="o-phone" className="mb-1 block text-sm font-medium">Phone</label>
          <input id="o-phone" name="client_phone" type="tel" maxLength={30} defaultValue={state.values?.client_phone} className={input} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="o-note" className="mb-1 block text-sm font-medium">Note (optional)</label>
          <textarea id="o-note" name="note" rows={2} maxLength={500} defaultValue={state.values?.note} className={input} />
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">Email or phone is required. If the student is under 18, use a parent&apos;s contact.</p>
      {state.error && <p className="mt-3 text-sm text-danger" role="alert">{state.error}</p>}
      <div className="mt-4 flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Sending…" : "Continue to payment"}
        </button>
        <button type="button" onClick={onClose} className="text-sm text-muted hover:text-foreground">
          Cancel
        </button>
      </div>
    </form>
  );
}

export function PortalView({ slug, page, embed }: { slug: string; page: PortalData; embed: boolean }) {
  const root = useRef<HTMLElement>(null);
  const [choice, setChoice] = useState<string | null>(null);
  const chosen = page.services.find((s) => s.id === choice) ?? null;
  const [branch, setBranch] = useState<string>(page.branches.length === 1 ? page.branches[0].id : "");
  const shown = page.services.filter((s) => !branch || !s.branch_id || s.branch_id === branch);

  // Embedded: report the height so the school's page can size the frame (same message as the enrollment form).
  useEffect(() => {
    if (!embed || window.parent === window || !root.current) return;
    const send = () =>
      window.parent.postMessage({ type: "cm-book-height", height: document.documentElement.scrollHeight }, "*");
    const ro = new ResizeObserver(send);
    ro.observe(root.current);
    send();
    return () => ro.disconnect();
  }, [embed]);

  const enrollHref = `/book/${slug}${embed ? "?embed=1" : ""}`;

  return (
    <main ref={root} className={embed ? "px-4 py-6" : "mx-auto max-w-2xl px-5 py-10"}>
      <p className="text-sm font-semibold tracking-wide text-accent uppercase">{page.school}</p>
      <h1 className="mt-1 text-2xl font-semibold">Services and prices</h1>
      {page.intro && <p className="mt-2 text-sm text-muted">{page.intro}</p>}

      {page.branches.length > 1 && (
        <div className="mt-5">
          <label htmlFor="branch" className="mb-1.5 block text-sm font-medium">
            Location
          </label>
          <select
            id="branch"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm sm:w-72"
          >
            <option value="">All locations</option>
            {page.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {shown.length === 0 ? (
        <p className="mt-6 text-sm text-muted">The school hasn&apos;t listed its services yet. Contact the school directly.</p>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-xl border border-border bg-surface">
          {shown.map((s) => {
            const sub = [KIND[s.kind], duration(s.minutes), s.branch_id ? page.branches.find((b) => b.id === s.branch_id)?.name : ""]
              .filter(Boolean)
              .join(" · ");
            return (
              <li key={s.id} className="flex items-start justify-between gap-4 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="font-medium">{s.name}</p>
                  {sub && <p className="text-xs text-muted">{sub}</p>}
                  {s.description && <p className="mt-1 text-sm text-muted">{s.description}</p>}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-base font-semibold">{money(s.price_cents)}</p>
                  <button
                    type="button"
                    onClick={() => setChoice(s.id)}
                    className="mt-1 text-sm font-medium text-accent hover:underline"
                  >
                    Choose
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {chosen && <OrderBox key={chosen.id} slug={slug} page={page} service={chosen} onClose={() => setChoice(null)} />}

      {!chosen && (
        <section className="mt-8 rounded-xl border border-border bg-surface p-5">
          <h2 className="text-lg font-semibold">How to pay</h2>
          <PayBlock page={page} />
        </section>
      )}

      <p className="mt-6 text-sm">
        <a href={enrollHref} className="font-medium text-accent hover:underline">
          Ready? Send your enrollment request →
        </a>
      </p>

      <p className="mt-8 text-xs text-muted">
        {/* Embedded in the school's own site it must look like the school's page: no ControlMiles wording. */}
        {!embed && `Payments go to ${page.school}. `}
        {!embed && (
          <a href="https://controlmiles.com/fleet" className="hover:text-foreground" target="_blank" rel="noopener">
            Powered by CMFleet
          </a>
        )}
      </p>
    </main>
  );
}
