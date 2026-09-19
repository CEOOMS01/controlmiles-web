// Olympus Mont Systems LLC - ControlMiles
// src/app/[locale]/delete-account/page.tsx
//
// Google Play's Account Deletion requirement (Data Safety -> Data
// deletion): an app that allows account creation must publish a
// dedicated, publicly-reachable web page describing how to request
// account/data deletion -- a mention inside the Privacy Policy alone
// does not satisfy the reviewer-facing "web resource" field in Play
// Console. This page is that dedicated resource, registered at
// Play Console -> Policy / App content -> Data safety -> Data deletion.
//
// No login required to view this page (Google's own requirement), and
// the deletion process itself can be manual (routed to support) --
// it does not have to be a self-service form. ControlMiles already has
// a real self-service path in-app (Settings -> Danger Zone -> Delete
// Account, see settings_screen.dart's _showDeleteAccountDialog /
// supabase/functions/delete-account), which this page documents
// alongside the email fallback for someone who no longer has the app
// installed.
import type { Metadata } from "next";
import { Fraunces, Public_Sans, IBM_Plex_Mono } from "next/font/google";
import { LandingNav, LandingFooter } from "@/components/landing-chrome";
import { LegalDocument } from "@/components/legal-document";
import "../landing.css";

const display = Fraunces({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });
const plexSans = Public_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-sans" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono-plex" });

export const metadata: Metadata = {
  title: "Delete Your Account — ControlMiles",
};

const BODY = `
1. WHO CAN REQUEST DELETION

Anyone with a ControlMiles account (Gig driver or Fleet admin/driver) can request deletion of their account and associated personal data, whether or not they still have the app installed.

2. DELETE FROM INSIDE THE APP (FASTEST)

If you still have ControlMiles installed: open the app, go to Settings, scroll to the "Danger Zone" section, and tap "Delete Account." You will be asked to type a confirmation word before the deletion is submitted. This is immediate and cannot be undone.

3. REQUEST DELETION WITHOUT THE APP

If you no longer have ControlMiles installed, or prefer not to use the in-app flow, email privacy@controlmiles.com with the subject line "Delete my account" and include the email address associated with your ControlMiles account. We process manual requests within 30 days of verifying the request came from the account holder.

4. WHAT GETS DELETED

Your profile (name, email, account settings), your trip and mileage records, uploaded odometer and receipt photos, vehicle records you own, and your authentication credentials.

If your account is the owner of a Fleet organization with other active members, automatic deletion may be blocked to avoid orphaning that organization's shared records -- in that case we will contact you to resolve it (for example, transferring ownership or removing members first) before completing the deletion.

5. WHAT WE MAY RETAIN, AND WHY

We do not currently retain any personal data after an account is deleted beyond what is required to comply with law, resolve disputes, or enforce our agreements -- see our Privacy Policy's Data Retention section for the general policy that also governs deletion requests handled outside the app.

6. TIMELINE

In-app deletion is immediate. Email requests are processed within 30 days after we reasonably verify the request came from the account holder.

7. MORE INFORMATION

See our Privacy Policy for full detail on what we collect and how we use it, or contact privacy@controlmiles.com with any questions about this process.
`;

export default function DeleteAccountPage() {
  return (
    <main
      className={`landing ${display.variable} ${plexSans.variable} ${plexMono.variable}`}
      style={{ fontFamily: "var(--font-plex-sans), system-ui, sans-serif" }}
    >
      <LandingNav />
      <LegalDocument title="Delete Your Account" lastUpdated="September 19, 2026" body={BODY} />
      <LandingFooter />
    </main>
  );
}
