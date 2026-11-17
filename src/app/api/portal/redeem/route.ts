import { createHmac } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { AppError } from "@/lib/errors";
import { anonClient, publicProjects } from "@/lib/supabase/projects";

// Uses the plain supabase-js client (no cookies) with the publishable
// key -- this endpoint is anonymous by design, and `anon` is the only
// role granted EXECUTE on redeem_report_access_code (verified live
// after the migration, see project memory). No service-role key
// anywhere in this file.
//
// Two databases (2026-11-16): a report code was issued by the gig app (gig project) or by a fleet admin
// (Fleet project). The code does not say which, so each project is asked in turn; the first that
// recognises it answers. Each project keeps its own attempt counter (report_access_attempts).
const GENERIC = "Invalid or expired code.";

function hashIp(ip: string): string {
  const pepper = process.env.IP_HASH_PEPPER;
  if (!pepper) {
    throw new Error("IP_HASH_PEPPER is not configured");
  }
  // HMAC, not a bare hash -- the pepper means a leaked DB dump of
  // report_access_attempts can't be dictionary-attacked back to real
  // IPs even though the IP space itself is small.
  return createHmac("sha256", pepper).update(ip).digest("hex");
}

function requesterIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid request." }, { status: 400 });
  }

  const { code, website } = (body ?? {}) as { code?: unknown; website?: unknown };

  // Honeypot: a real user never fills this hidden field. A bot filling
  // every input on the form does. Reject silently with the same generic
  // message a wrong code gets, so a bot can't distinguish the two.
  if (typeof website === "string" && website.length > 0) {
    return NextResponse.json({ success: false, message: "Invalid or expired code." });
  }

  if (typeof code !== "string" || code.length < 4 || code.length > 32) {
    return NextResponse.json({ success: false, message: "Invalid or expired code." });
  }

  // BUG FIX (real, found live 2026-09-09 -- reported as "verification
  // fails both typing and submitting the code"): hashIp() throws when
  // IP_HASH_PEPPER isn't configured, and that throw was outside any
  // try/catch -- it crashed the whole route handler with an unhandled
  // exception, which Next.js turns into a bare 500 with an EMPTY body
  // (confirmed live: curl against the production endpoint returned
  // `Content-Length: 0`). The frontend's `await res.json()` on that
  // empty body throws too, so every single code entered -- valid or
  // not -- surfaced as a generic "Network error" with zero indication
  // this was a server misconfiguration, not a real network problem.
  // Wrapping this in try/catch at minimum means a future
  // misconfiguration returns a real, coded JSON error instead of an
  // opaque crash -- but IP_HASH_PEPPER must actually be set in Vercel
  // for this endpoint to work at all; this catch doesn't paper over
  // that, it just stops it from crashing silently.
  try {
    const ipHash = hashIp(requesterIp(request));
    const normalized = code.trim().toUpperCase();

    let failure: string = GENERIC;
    let lastError: unknown = null;
    let answered = false;
    for (const project of publicProjects()) {
      const { data, error } = await anonClient(project).rpc("redeem_report_access_code", {
        p_code: normalized,
        p_ip_hash: ipHash,
      });
      if (error) {
        lastError = error;
        continue; // the other project may still know this code
      }
      answered = true;
      const row = data?.[0];
      if (row?.success) {
        return NextResponse.json({ success: true, message: "ok", report: row.report });
      }
      // Keep the most specific reason (expired, locked out...) over the generic one.
      if (row?.message && (failure === GENERIC || row.message !== GENERIC)) failure = row.message;
    }

    if (!answered && lastError) {
      return NextResponse.json(
        { success: false, message: AppError.from(lastError, { critical: true }).display() },
        { status: 500 },
      );
    }
    return NextResponse.json({ success: false, message: failure, report: null });
  } catch (e) {
    return NextResponse.json(
      { success: false, message: AppError.from(e, { critical: true }).display() },
      { status: 500 },
    );
  }
}
