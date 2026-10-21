"use client";

import { useState, useTransition } from "react";
import { switchOrganization } from "./actions";

type OrgOption = { id: string; name: string };

export function OrgSwitcher({
  currentOrgId,
  orgs,
}: {
  currentOrgId: string;
  orgs: OrgOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Nothing to switch between -- render the plain name instead (matches
  // what every single-org account already saw before this existed).
  if (orgs.length < 2) {
    const name = orgs.find((o) => o.id === currentOrgId)?.name ?? "";
    return <p className="truncate px-1.5 text-xs text-sidebar-muted">{name}</p>;
  }

  return (
    <div>
      <select
        value={currentOrgId}
        disabled={pending}
        onChange={(e) => {
          const orgId = e.target.value;
          if (orgId === currentOrgId) return;
          startTransition(async () => {
            // BUG FIX (pedido explícito, 2026-09-09): el resultado de
            // switchOrganization se descartaba por completo -- en éxito
            // redirect() ya corta el flujo, pero en falla no pasaba
            // absolutamente nada visible.
            const result = await switchOrganization(orgId);
            setError(result?.error ?? null);
          });
        }}
        className="w-full truncate rounded-lg border border-sidebar-border bg-surface px-2.5 py-1.5 text-sm text-foreground outline-none transition hover:border-border-strong focus:border-accent disabled:opacity-60"
      >
        {orgs.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
