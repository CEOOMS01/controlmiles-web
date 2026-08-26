import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GenerateForm } from "./generate-form";

export default async function GenerateReportCodePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defense in depth: middleware already gates this route, but a
  // server component that renders driver data should never trust a
  // client-side/middleware check alone.
  if (!user) {
    redirect("/login");
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <p className="text-sm font-semibold tracking-wide text-accent uppercase">
            ControlMiles Report Portal
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Generate a report code</h1>
          <p className="mt-2 text-sm text-muted">
            Pick a date range. You&apos;ll get an 8-character code, valid for
            15 minutes and usable up to twice, to share with your tax
            preparer.
          </p>
        </div>
        <GenerateForm />
      </div>
    </main>
  );
}
