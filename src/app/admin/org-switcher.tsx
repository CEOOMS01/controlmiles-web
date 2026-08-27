"use client";

import { useTransition } from "react";
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

  // Nothing to switch between -- render the plain name instead (matches
  // what every single-org account already saw before this existed).
  if (orgs.length < 2) {
    const name = orgs.find((o) => o.id === currentOrgId)?.name ?? "";
    return <p className="mt-1 truncate px-2 text-xs text-muted">{name}</p>;
  }

  return (
    <div className="mt-1 px-2">
      <select
        value={currentOrgId}
        disabled={pending}
        onChange={(e) => {
          const orgId = e.target.value;
          if (orgId === currentOrgId) return;
          startTransition(async () => {
            await switchOrganization(orgId);
          });
        }}
        className="w-full truncate rounded-md border border-border bg-background px-1.5 py-1 text-xs text-muted outline-none transition hover:text-foreground focus:border-accent disabled:opacity-60"
      >
        {orgs.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
      </select>
    </div>
  );
}
