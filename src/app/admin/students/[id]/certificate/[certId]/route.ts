// Driving school certificate PDF for the office (RLS: operator or above,
// with the certificates feature).

import { createClient } from "@/lib/supabase/server";
import { buildCertificatePdf, type CertificateData } from "@/lib/certificate-pdf";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; certId: string }> }) {
  const { id, certId } = await params;
  const supabase = await createClient();
  const { data: cert } = await supabase
    .from("ds_certificates")
    .select("number, data, sha256")
    .eq("id", certId)
    .eq("student_id", id)
    .maybeSingle();
  if (!cert) return new Response("Not found", { status: 404 });
  const pdf = await buildCertificatePdf(cert.data as CertificateData, cert.sha256);
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="certificate-${cert.number}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
