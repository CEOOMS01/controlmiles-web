// Driving school public page (2026-10-20, reworked 2026-10-23): send an
// enrollment request.
//
// It runs in the visitor's browser and calls the Edge Function
// ds-public-enroll directly (not a server action): the function limits
// requests per visitor IP and checks the captcha, and it can only see the
// visitor's real IP if the visitor's browser makes the call. Everything is
// checked again in ds_public_enroll (age, guardian, consent, limits); the
// messages below explain its short error codes.

export type EnrollState = { error: string | null; done: boolean };

const MESSAGES: Record<string, string> = {
  NOT_AVAILABLE: "Online enrollment isn't available for this school right now.",
  NAME_REQUIRED: "Enter the student's first and last name.",
  BIRTH_DATE: "Enter a valid date of birth.",
  TOO_YOUNG: "The student is younger than this school's minimum age for enrollment.",
  EMAIL: "Check the email address.",
  GUARDIAN_REQUIRED: "Students under 18 need a parent or guardian with an email or phone number.",
  GUARDIAN_CONSENT: "A parent or guardian has to send the request for a student under 18.",
  CONTACT_REQUIRED: "Enter an email or phone number so the school can reach you.",
  CONSENT: "Check the box and type your full name to agree.",
  SMS_PHONE: "Enter a mobile number for text messages, or leave texts off.",
  BUSY: "The school is getting a lot of requests. Try again in a few minutes.",
  INVALID: "Something in the form isn't valid. Reload the page and try again.",
  CAPTCHA: "We couldn't confirm you are not a robot. Complete the check and send again.",
  RATE_LIMITED: "Too many requests from this connection. Try again in an hour.",
};

const field = (fd: FormData, k: string, max: number) => String(fd.get(k) ?? "").trim().slice(0, max);

export async function sendEnrollment(slug: string, _prev: EnrollState, fd: FormData): Promise<EnrollState> {
  // Honeypot: people never see this field; bots fill it.
  if (field(fd, "company", 100)) return { error: null, done: true };

  let res: Response;
  try {
    res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ds-public-enroll`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
      },
      body: JSON.stringify({
        slug,
        // Cloudflare Turnstile adds this field to the form when it is on.
        captcha: field(fd, "cf-turnstile-response", 4096),
        p: {
          first_name: field(fd, "first_name", 60),
          last_name: field(fd, "last_name", 60),
          birth_date: field(fd, "birth_date", 10),
          email: field(fd, "email", 120),
          phone: field(fd, "phone", 30),
          guardian_name: field(fd, "guardian_name", 120),
          guardian_email: field(fd, "guardian_email", 120),
          guardian_phone: field(fd, "guardian_phone", 30),
          program_id: field(fd, "program_id", 40),
          branch_id: field(fd, "branch_id", 40),
          message: field(fd, "message", 500),
          preferred_language: field(fd, "preferred_language", 2),
          consent: fd.get("consent") === "on",
          consent_by: field(fd, "consent_by", 10),
          consent_name: field(fd, "consent_name", 120),
          sms_opt_in: fd.get("sms_opt_in") === "on",
          sms_phone: field(fd, "sms_phone", 30),
        },
      }),
    });
  } catch {
    return { error: "Couldn't reach the school's page. Check your connection and try again.", done: false };
  }

  let body: { ok?: boolean; error?: string } = {};
  try {
    body = await res.json();
  } catch {
    // Not JSON: treated as a failure below.
  }
  if (res.ok && body.ok) return { error: null, done: true };
  return { error: (body.error && MESSAGES[body.error]) || "Couldn't send the request. Try again.", done: false };
}
