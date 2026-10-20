// Certificate PDF from the student/parent portal link (ds_portal_certificate
// checks the token and that the certificate belongs to that student).

import { createClient } from "@/lib/supabase/server";
import { buildCertificatePdf, type CertificateData } from "@/lib/certificate-pdf";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string; number: string }> }) {
  const { token, number } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("ds_portal_certificate", { p_token: token, p_number: decodeURIComponent(number) });
  const cert = data as { data: CertificateData; sha256: string; number: string } | null;
  if (!cert) return new Response("Not found", { status: 404 });
  const pdf = await buildCertificatePdf(cert.data, cert.sha256);
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="certificate-${cert.number}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
