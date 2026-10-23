// Olympus Mont Systems LLC - ControlMiles
// src/components/plan-card.tsx
//
// A plan card in the landing look (landing.css), shared by /pricing and
// /fleet (CMFleet) so both pages show plans the same way (2026-10-20).

import { Link } from "@/i18n/routing";
import { Reveal } from "@/components/reveal";
import type { Plan } from "@/lib/fleet-plans";

export function PlanCard({ plan, index = 0, mostPopular }: { plan: Plan; index?: number; mostPopular: string }) {
  return (
    // El plan destacado se distingue por su POSICIÓN EN REPOSO (elevado,
    // .plan-featured) además del borde y la sombra que ya tenía. La
    // jerarquía se lee de un vistazo, sin que la tarjeta tenga que estar
    // latiendo: el único movimiento continuo de la página es el destello
    // ocasional de la insignia.
    <Reveal
      index={index}
      className={`lift flex flex-col rounded-2xl border p-7${plan.highlight ? " plan-featured" : ""}`}
      style={{
        borderColor: plan.highlight ? "var(--lg-blue)" : "var(--lg-line)",
        background: "var(--lg-bg-raised)",
        boxShadow: plan.highlight
          ? "0 20px 50px -24px rgba(44,108,153,0.35)"
          : "0 10px 30px -20px rgba(33,28,20,0.3)",
      }}
    >
      {plan.highlight && (
        <p
          className="mono plan-badge mb-3 w-fit rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-[0.15em]"
          style={{ background: "rgba(62,147,202,0.12)", color: "var(--lg-blue-deep)" }}
        >
          {mostPopular}
        </p>
      )}
      <h3 className="display text-2xl font-semibold">{plan.name}</h3>
      <p className="mt-1 text-sm text-[var(--lg-ink-dim)]">{plan.tagline}</p>
      <div className="mt-5 flex items-baseline gap-1.5">
        <span className="display text-4xl font-semibold">{plan.price}</span>
        {plan.unit && <span className="text-sm text-[var(--lg-ink-dim)]">{plan.unit}</span>}
      </div>
      {plan.acquisition && <p className="mt-1 text-sm font-medium text-[var(--lg-ink)]">{plan.acquisition}</p>}
      <ul className="mt-6 flex-1 space-y-2.5 text-sm text-[var(--lg-ink-dim)]">
        {plan.features.map((f) => (
          <li key={f} className="flex gap-2.5">
            <span className="mt-0.5" style={{ color: "var(--lg-blue-deep)" }}>
              ✓
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      {(() => {
        const cls = "mt-7 rounded-full px-5 py-2.5 text-center text-sm font-semibold transition";
        const style = plan.highlight
          ? { background: "var(--lg-blue-deep)", color: "white" }
          : { border: "1px solid var(--lg-line)", color: "var(--lg-ink)" };
        // mailto: links are plain anchors; the locale-aware Link is for pages.
        return plan.cta.href.startsWith("mailto:") ? (
          <a href={plan.cta.href} className={cls} style={style}>
            {plan.cta.label}
          </a>
        ) : (
          <Link href={plan.cta.href} className={cls} style={style}>
            {plan.cta.label}
          </Link>
        );
      })()}
    </Reveal>
  );
}
