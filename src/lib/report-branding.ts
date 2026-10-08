// Report branding (2026-10-09): the name and logo a fleet prints on its
// reports. The logo is private; a short-lived signed URL is enough to render
// and print the page.

import type { SupabaseClient } from "@supabase/supabase-js";

export type ReportBranding = { name: string; customName: string | null; logoUrl: string | null };

export async function loadReportBranding(supabase: SupabaseClient, orgId: string): Promise<ReportBranding> {
  const { data: org } = await supabase
    .from("organizations")
    .select("name, report_display_name, report_logo_path")
    .eq("id", orgId)
    .maybeSingle();
  let logoUrl: string | null = null;
  if (org?.report_logo_path) {
    const { data } = await supabase.storage.from("org_branding").createSignedUrl(org.report_logo_path, 60 * 60);
    logoUrl = data?.signedUrl ?? null;
  }
  return {
    name: org?.report_display_name || org?.name || "",
    customName: org?.report_display_name ?? null,
    logoUrl,
  };
}
