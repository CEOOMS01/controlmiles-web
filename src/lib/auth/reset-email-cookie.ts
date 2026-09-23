// Shared between forgot-password/actions.ts (sets it) and
// reset-password/actions.ts (reads it) -- one constant instead of the
// same string literal duplicated in two files, so a typo in either place
// can't silently break the handoff between them.
export const PENDING_RESET_EMAIL_COOKIE = "cm_pending_reset_email";
