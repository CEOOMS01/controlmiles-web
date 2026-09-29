"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import { LEGAL_TERMS_VERSION } from "@/lib/legal-version";

export async function acceptLegalTerms(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  if (formData.get("accept_legal") !== "on") {
    return { error: "Please confirm you are 18 or older and accept the Terms to continue." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_legal_terms", { p_version: LEGAL_TERMS_VERSION });
  if (error) return { error: AppError.from(error).display() };
  redirect("/admin");
}
