"use server";

// Driving school public page (2026-10-20): send an enrollment request.
// Everything is checked again in ds_public_enroll (age, guardian, consent,
// limits); the messages below explain its short error codes.

import { createClient } from "@/lib/supabase/server";

export type EnrollState = { error: string | null; done: boolean };

const MESSAGES: Record<string, string> = {
  NOT_AVAILABLE: "Online enrollment isn't available for this school right now.",
  NAME_REQUIRED: "Enter the student's first and last name.",
  BIRTH_DATE: "Enter a valid date of birth.",
  TOO_YOUNG: "The student is younger than this school's minimum age for enrollment.",
  EMAIL: "Check the email address.",
  GUARDIAN_REQUIRED: "Minor students need a parent or guardian with an email or phone number.",
  GUARDIAN_CONSENT: "A parent or guardian has to send the request for a minor student.",
  CONTACT_REQUIRED: "Enter an email or phone number so the school can reach you.",
  CONSENT: "Check the box and type your full name to agree.",
  SMS_PHONE: "Enter a mobile number for text messages, or leave texts off.",
  BUSY: "The school is getting a lot of requests. Try again in a few minutes.",
  INVALID: "Something in the form isn't valid. Reload the page and try again.",
};

const field = (fd: FormData, k: string, max: number) => String(fd.get(k) ?? "").trim().slice(0, max);

export async function sendEnrollment(slug: string, _prev: EnrollState, fd: FormData): Promise<EnrollState> {
  // Honeypot: people never see this field; bots fill it.
  if (field(fd, "company", 100)) return { error: null, done: true };

  const supabase = await createClient();
  const { error } = await supabase.rpc("ds_public_enroll", {
    p_slug: slug,
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
  });
  if (error) {
    const code = Object.keys(MESSAGES).find((k) => error.message.includes(k));
    return { error: code ? MESSAGES[code] : "Couldn't send the request. Try again.", done: false };
  }
  return { error: null, done: true };
}
