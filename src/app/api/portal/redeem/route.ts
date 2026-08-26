import { createHmac } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Uses the plain supabase-js client (no cookies) with the publishable
// key -- this endpoint is anonymous by design, and `anon` is the only
// role granted EXECUTE on redeem_report_access_code (verified live
// after the migration, see project memory). No service-role key
// anywhere in this file.
function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}

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

  const ipHash = hashIp(requesterIp(request));
  const supabase = anonClient();

  const { data, error } = await supabase.rpc("redeem_report_access_code", {
    p_code: code.trim().toUpperCase(),
    p_ip_hash: ipHash,
  });

  if (error) {
    return NextResponse.json({ success: false, message: "Something went wrong. Try again." }, { status: 500 });
  }

  const row = data?.[0];
  if (!row) {
    return NextResponse.json({ success: false, message: "Invalid or expired code." });
  }

  return NextResponse.json({
    success: row.success,
    message: row.success ? "ok" : row.message,
    report: row.success ? row.report : null,
  });
}
