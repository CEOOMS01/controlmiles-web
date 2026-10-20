// Olympus Mont Systems LLC - ControlMiles Web
// src/lib/custom-domain.ts
//
// A driving school's own address for its enrollment page (2026-10-20,
// level 3). Two checks, both server-side:
//   1. DNS ownership: TXT _cmfleet.<host> = cmfleet-verify=<token>, read
//      through Cloudflare's DNS-over-HTTPS. Only then is the name added to
//      the Vercel project, so nobody can claim another school's address.
//   2. Vercel: the name is on the project and its CNAME points to Vercel.
// Vercel needs VERCEL_API_TOKEN and VERCEL_PROJECT_ID (and VERCEL_TEAM_ID for
// a team project). Without them the TXT check still runs and the address
// waits with a message that ControlMiles will finish the connection.
// Imported only from server actions (it reads the Vercel token).

export const CNAME_TARGET = "cname.vercel-dns.com";

export function txtName(host: string): string {
  return `_cmfleet.${host}`;
}
export function txtValue(token: string): string {
  return `cmfleet-verify=${token}`;
}

// Cloudflare first, Google as a fallback (same JSON answer format).
async function dnsTxt(name: string): Promise<string[]> {
  const q = `name=${encodeURIComponent(name)}&type=TXT`;
  let lastError: unknown = null;
  for (const url of [`https://cloudflare-dns.com/dns-query?${q}`, `https://dns.google/resolve?${q}`]) {
    try {
      const res = await fetch(url, {
        headers: { accept: "application/dns-json" },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) continue;
      const body = (await res.json()) as { Answer?: { type: number; data: string }[] };
      return (body.Answer ?? []).filter((a) => a.type === 16).map((a) => a.data.replace(/^"|"$/g, "").replace(/" "/g, ""));
    } catch (e) {
      lastError = e;
    }
  }
  if (lastError) throw lastError;
  return [];
}

const vercel = {
  token: process.env.VERCEL_API_TOKEN ?? "",
  project: process.env.VERCEL_PROJECT_ID ?? "",
  team: process.env.VERCEL_TEAM_ID ?? "",
};
export const vercelConfigured = () => Boolean(vercel.token && vercel.project);

async function vercelApi(path: string, init: RequestInit = {}) {
  const sep = path.includes("?") ? "&" : "?";
  const url = `https://api.vercel.com${path}${vercel.team ? `${sep}teamId=${encodeURIComponent(vercel.team)}` : ""}`;
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${vercel.token}`, "Content-Type": "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

export type DomainCheck = { status: "pending" | "verified" | "error"; message: string };

/** Check ownership, connect the name to Vercel, and report where it stands. */
export async function checkCustomDomain(host: string, token: string): Promise<DomainCheck> {
  let txt: string[] = [];
  try {
    txt = await dnsTxt(txtName(host));
  } catch {
    return { status: "pending", message: "Couldn't read your DNS right now. Try again in a minute." };
  }
  if (!txt.includes(txtValue(token))) {
    return {
      status: "pending",
      message: "The TXT record isn't visible yet. DNS changes can take up to an hour.",
    };
  }
  if (!vercelConfigured()) {
    return {
      status: "pending",
      message: "Ownership confirmed. ControlMiles will finish connecting the address; no action needed from you.",
    };
  }

  const project = encodeURIComponent(vercel.project);
  const add = await vercelApi(`/v10/projects/${project}/domains`, { method: "POST", body: JSON.stringify({ name: host }) });
  const code = (add.body as { error?: { code?: string; message?: string } }).error?.code;
  if (!add.ok && code !== "domain_already_in_use_by_project" && code !== "domain_already_exists") {
    const msg = (add.body as { error?: { message?: string } }).error?.message ?? `Vercel answered ${add.status}`;
    return { status: "error", message: msg.slice(0, 280) };
  }

  const [info, config] = await Promise.all([
    vercelApi(`/v9/projects/${project}/domains/${encodeURIComponent(host)}`),
    vercelApi(`/v6/domains/${encodeURIComponent(host)}/config`),
  ]);
  const verified = (info.body as { verified?: boolean }).verified === true;
  const misconfigured = (config.body as { misconfigured?: boolean }).misconfigured !== false;
  if (!verified) {
    await vercelApi(`/v9/projects/${project}/domains/${encodeURIComponent(host)}/verify`, { method: "POST" });
    return { status: "pending", message: "Connected. Waiting for Vercel to confirm the address." };
  }
  if (misconfigured) {
    return { status: "pending", message: `Point the CNAME record to ${CNAME_TARGET}. It can take up to an hour.` };
  }
  return { status: "verified", message: "Live. Your page opens at this address with a secure https certificate." };
}

/** Remove the name from the Vercel project (ignored when it isn't there). */
export async function removeCustomDomain(host: string): Promise<void> {
  if (!vercelConfigured() || !host) return;
  await vercelApi(`/v9/projects/${encodeURIComponent(vercel.project)}/domains/${encodeURIComponent(host)}`, {
    method: "DELETE",
  }).catch(() => undefined);
}
