// Olympus Mont Systems LLC - ControlMiles Web
// src/lib/errors.ts
//
// Explicit user requirement (2026-09-09): no raw database/exception text
// ever reaches the UI. Every error the user can see carries a stable
// numeric code from the shared registry (see ERROR_CODES.md at the repo
// root -- kept in sync by hand with the mobile app's copy, since the two
// are separate repos/languages and can't literally share one source
// file). Three ranges, matching where the error actually originates:
//
//   1xx-3xx  LOCAL       client-side only -- form validation,
//                        connectivity, browser storage.
//   4xx-6xx  BACKEND     a real, named business-rule rejection from
//                        Supabase (a Postgres RAISE EXCEPTION with a
//                        recognizable message, a known Auth/Postgrest
//                        error).
//   7xx-9xx  PRODUCTION  anything else -- caught, but not one of the
//                        known cases above. Still a safe generic message
//                        + the code, never the raw exception.
//
// AppError.from(...) is the ONLY sanctioned way to turn a caught error
// into UI-facing text.

export class AppError {
  constructor(
    public readonly code: number,
    public readonly message: string,
  ) {}

  /** "Something went wrong (720)" -- what's actually safe to render. */
  display(): string {
    return `${this.message} (${this.code})`;
  }

  // ── LOCAL (1xx-3xx) ─────────────────────────────────────────
  static readonly noInternetConnection = new AppError(110, "No internet connection.");
  static readonly invalidFormInput = new AppError(120, "Please check what you entered.");
  static readonly localStorageFailure = new AppError(150, "Could not save locally in this browser.");

  // ── BACKEND (4xx-6xx) -- real, named rejections we already raise ──
  static readonly invalidCredentials = new AppError(400, "Invalid email or password.");
  static readonly emailAlreadyExists = new AppError(401, "This email is already registered.");
  static readonly sessionExpired = new AppError(402, "Your session expired. Please sign in again.");
  static readonly vehicleLimitReached = new AppError(410, "You've reached your plan's vehicle limit.");
  static readonly freeTrialExpired = new AppError(411, "Your 30-day free trial is over.");
  static readonly orgMembershipRevoked = new AppError(412, "Your fleet admin has removed your access.");
  static readonly rateLimited = new AppError(420, "Too many attempts. Try again in a few minutes.");
  static readonly duplicateEntry = new AppError(430, "This already exists.");
  static readonly subscriptionsNotConfigured = new AppError(440, "Subscriptions are not available yet.");
  static readonly alreadyOwnFleet = new AppError(
    441,
    "You already own a fleet organization. Creating more than one requires the multi-fleet add-on.",
  );

  /** A hand-written RAISE EXCEPTION sentence from one of our own
   * SECURITY DEFINER RPCs (e.g. "Only an org admin or owner can invite
   * members") -- not raw Postgres/system internals, safe to show
   * verbatim, but still routed through the registry so it carries a
   * code. One shared code rather than one entry per RPC message -- the
   * message text itself is already specific and safe (see
   * isLikelyRawDbError's own doc comment for what disqualifies a
   * message from landing here instead of the generic fallback). */
  static readonly businessRuleRejection = (message: string) => new AppError(450, message);

  // ── PRODUCTION (7xx-9xx) -- catch-all, unclassified ──────────
  static readonly unexpectedClient = new AppError(700, "Something went wrong.");
  static readonly unexpectedServer = new AppError(701, "Something went wrong.");
  /** Reserved for critical flows (payments, org deletion) -- same
   * generic message as unexpectedServer, but its own code so these are
   * easy to find in logs/support tickets separately from routine 701s. */
  static readonly unexpectedCritical = new AppError(720, "Something went wrong.");

  /**
   * True when `text` looks like a raw Postgres/system error rather than
   * one of our own hand-written RAISE EXCEPTION sentences -- schema
   * internals (column/relation/constraint names), SQL syntax errors,
   * or anything long enough to plausibly be a stack trace. This is what
   * keeps AppError.from's fallback from accidentally showing real
   * database internals to a user just because it didn't match one of
   * the specifically-named codes above.
   */
  private static looksLikeRawDbError(text: string): boolean {
    if (text.length > 160) return true;
    const rawPatterns = [
      /column "/i,
      /relation "/i,
      /constraint "/i,
      /duplicate key value/i,
      /violates/i,
      /syntax error/i,
      /permission denied for/i,
      /null value in column/i,
      /invalid input syntax/i,
      /PGRST\d/,
      /^\d{5}:/, // bare Postgres SQLSTATE prefix
    ];
    return rawPatterns.some((p) => p.test(text));
  }

  /**
   * Maps a caught error to the best-matching known AppError. Recognizes
   * this project's own real exception shapes (Postgres RAISE EXCEPTION
   * messages from the triggers/RPCs already in this codebase, and
   * common Supabase Auth error text) rather than guessing. A message
   * that isn't one of the specifically-named codes but also doesn't
   * look like raw Postgres/system internals is treated as one of our
   * own safe hand-written RPC exceptions (code 450) rather than
   * downgraded to the fully generic fallback -- that's what keeps
   * "Only an org admin or owner can invite members"-style messages
   * informative instead of flattening every RPC rejection to
   * "Something went wrong". Only text that actually looks like a raw
   * database/system error falls through to 701/720.
   */
  static from(error: unknown, opts: { critical?: boolean } = {}): AppError {
    const text = error instanceof Error ? error.message : String(error);

    if (text.includes("VEHICLE_LIMIT_REACHED")) return AppError.vehicleLimitReached;
    if (text.includes("FREE_TRIAL_EXPIRED")) return AppError.freeTrialExpired;
    if (text.includes("ORG_MEMBERSHIP_REVOKED")) return AppError.orgMembershipRevoked;
    if (text.includes("already own a fleet organization")) return AppError.alreadyOwnFleet;
    if (text.includes("Invalid login credentials") || text.includes("Invalid credentials")) {
      return AppError.invalidCredentials;
    }
    if (text.includes("already registered") || text.includes("already exists")) {
      return AppError.emailAlreadyExists;
    }
    if (text.includes("JWT") || text.includes("session") || text.includes("not authenticated")) {
      return AppError.sessionExpired;
    }
    if (text.includes("rate limit") || text.includes("Too many attempts")) {
      return AppError.rateLimited;
    }
    if (text.includes("duplicate key value")) return AppError.duplicateEntry;

    if (text && !AppError.looksLikeRawDbError(text)) {
      return AppError.businessRuleRejection(text);
    }

    return opts.critical ? AppError.unexpectedCritical : AppError.unexpectedServer;
  }
}
