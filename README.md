# ControlMiles Report Portal

Next.js (App Router) web app for `controlmiles.com`. First piece built:
the **Report Portal** — a driver signs in and generates a short-lived
access code; a tax preparer redeems it, with no account of their own,
for a read-only mileage report.

Shares the same Supabase backend as the ControlMiles mobile app
(`../controlmiles`) — no second database, no service-role key anywhere
in this app. Authorization is entirely RLS + two `SECURITY DEFINER`
RPCs (`generate_report_access_code`, `redeem_report_access_code`).

## Security posture

Built against the user's standing 20-point checklist
(`feedback_security_baseline_checklist` in project memory). Notably:

- Access codes are **hashed (SHA-256) at rest** — the plaintext is
  returned once, at generation time, and never stored.
- Redemption is **rate-limited per IP** (`report_access_attempts`,
  5 failed attempts / 15 min), independent of the code's own 2-use
  limit and 15-minute expiry.
- Requester IPs are **HMAC-hashed with a server-only pepper**
  (`IP_HASH_PEPPER`) before ever reaching Postgres — even a DB dump of
  the attempts log can't be reversed to real IPs.
- Only the **publishable/anon Supabase key** ships to the client —
  verify with `git check-ignore -v .env.local` that it stays untracked
  regardless.
- **Nonce-based CSP**, not `unsafe-inline` — generated per-request in
  `src/lib/supabase/middleware.ts` (`proxy.ts` is the Next.js 16 entry
  point). `'unsafe-eval'` is added only in development (React's
  debugging tools need it; production never does).
- The redemption RPC's blast radius is deliberately narrow: it only
  ever reads one column (`reports.metadata`) off one table — no path
  to `sessions`/`session_sections`/`profiles` from the anon-facing side
  at all.

Run `supabase-migrations/` against the ControlMiles Supabase project
(`zuujwmcftycmdaxesdya`) before this app can do anything useful — they
are already applied live as of 2026-08-26; the files here are the
version-controlled mirror, matching the pattern the mobile app repo
already uses.

## Local development

```bash
cp .env.local.example .env.local   # fill in real values, see comments
npm install
npm run dev
```

## Deployment

Target: Vercel, DNS for `controlmiles.com` pointed from GoDaddy (not
done yet — confirm with the user before touching production DNS).
