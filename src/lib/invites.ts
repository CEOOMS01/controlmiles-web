// Olympus Mont Systems LLC - ControlMiles
// src/lib/invites.ts
//
// How the roster describes a driver who was invited by email but has not
// joined yet. Pure functions, no I/O, so the rules are easy to check.
//
// The database only ever stores 'pending' | 'accepted' | 'expired'; a
// 'pending' invite whose expires_at has passed is really expired even though
// nothing has flipped the column yet (expiry is evaluated when the link is
// used), and cancelling or replacing an invite also stores 'expired'. So the
// roster derives what to show from the status AND the clock.

export type InviteRow = {
  id: string;
  email: string;
  status: string;
  expires_at: string;
  created_at: string;
  slot_id: string | null;
  intended_role: string | null;
};

export type InviteView = {
  kind: "invited" | "expired";
  inviteId: string;
  email: string;
  role: string;
  /** Whole days until the link stops working (invited only), at least 1. */
  daysLeft: number | null;
};

const DAY_MS = 86_400_000;

/** The most recent invite for each driver row (slot), by creation time. */
export function latestInviteBySlot(invites: InviteRow[]): Map<string, InviteRow> {
  const bySlot = new Map<string, InviteRow>();
  for (const inv of invites) {
    if (!inv.slot_id) continue;
    const current = bySlot.get(inv.slot_id);
    if (!current || Date.parse(inv.created_at) > Date.parse(current.created_at)) {
      bySlot.set(inv.slot_id, inv);
    }
  }
  return bySlot;
}

/**
 * What to show for a driver row given its latest invite.
 * null = no email invitation (a code-only driver), or one already accepted.
 */
export function describeInvite(invite: InviteRow | undefined, nowMs: number): InviteView | null {
  if (!invite || invite.status === "accepted") return null;

  const expiresAt = Date.parse(invite.expires_at);
  const base = {
    inviteId: invite.id,
    email: invite.email,
    role: invite.intended_role ?? "driver",
  };

  const live = invite.status === "pending" && Number.isFinite(expiresAt) && expiresAt > nowMs;
  if (!live) return { kind: "expired", ...base, daysLeft: null };

  return {
    kind: "invited",
    ...base,
    daysLeft: Math.max(1, Math.ceil((expiresAt - nowMs) / DAY_MS)),
  };
}
