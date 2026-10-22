// Certificate PDF for a signed-in parent or adult (2026-10-22).
// ds_client_certificate checks the session, that the student is on the
// profile and that the certificate belongs to that student.

import { createClient } from "@/lib/supabase/server";
import { lessonsSession } from "@/lib/lessons-session";
import { buildCertificatePdf, type CertificateData } from "@/lib/certificate-pdf";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; number: string }> }) {
  const { id, number } = await params;
  const session = await lessonsSession();
  if (!session) return new Response("Not found", { status: 404 });
  const supabase = await createClient();
  const { data } = await supabase.rpc("ds_client_certificate", {
    p_session: session,
    p_student: id,
    p_number: decodeURIComponent(number),
  });
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
