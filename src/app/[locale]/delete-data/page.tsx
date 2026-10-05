// Olympus Mont Systems LLC - ControlMiles
// src/app/[locale]/delete-data/page.tsx
//
// Google Play Data safety -> "Do you provide a way for users to request that
// some or all of their data is deleted, without requiring them to delete
// their account?" (2026-10-05). Play asks for a web link, so this public page
// (no login) explains what a driver can delete in the app and how to request
// the rest by email (account@controlmiles.com, user decision). Full account
// deletion stays on /delete-account.
import type { Metadata } from "next";
import { Fraunces, Public_Sans, IBM_Plex_Mono } from "next/font/google";
import { LandingNav, LandingFooter } from "@/components/landing-chrome";
import { LegalDocument } from "@/components/legal-document";
import "../landing.css";

const display = Fraunces({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });
const plexSans = Public_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-sans" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono-plex" });

export const metadata: Metadata = {
  title: "Delete Some of Your Data — ControlMiles",
  description: "How to delete some of your ControlMiles data without deleting your account.",
};

const BODY = `
1. KEEP YOUR ACCOUNT, DELETE SOME DATA

You can delete part of your ControlMiles data and keep using your account. Some data you can delete yourself in the app; for anything else, send us a request. To delete your whole account and all of its data instead, see controlmiles.com/delete-account.

2. WHAT YOU CAN DELETE YOURSELF IN THE APP

Trips (gig drivers): open History, find the trip, and tap the trash icon. The trip, its gig-app segments, its route and its GPS points are deleted.

Vehicles: open your vehicles, choose a vehicle, and delete it.

Trips recorded for a fleet belong to that fleet's records: only the fleet's owner or administrator can delete them. Ask them first, or contact us as described below.

3. REQUEST DELETION OF OTHER DATA

Email account@controlmiles.com with the subject line "Delete some of my data". Include the email address of your ControlMiles account and tell us what you want deleted, for example:

- trips in a date range, or specific trips
- odometer or fuel receipt photos
- recorded routes and GPS points of your trips
- notes, incidents or inspection records you created

We will confirm the request came from the account holder before deleting anything.

4. WHAT WE MAY KEEP

We may keep data we are required to keep by law, or that is needed to resolve disputes or enforce our agreements. Data in a fleet's records may also be subject to that fleet's own record-keeping obligations; we will tell you if something you asked for cannot be deleted and why.

5. TIMELINE

Deletions you make in the app take effect immediately. Email requests are completed within 30 days after we verify the request.

6. MORE INFORMATION

See our Privacy Policy for what we collect and how we use it, or contact account@controlmiles.com with any question about this process.
`;

export default function DeleteDataPage() {
  return (
    <main
      className={`landing ${display.variable} ${plexSans.variable} ${plexMono.variable}`}
      style={{ fontFamily: "var(--font-plex-sans), system-ui, sans-serif" }}
    >
      <LandingNav />
      <LegalDocument title="Delete Some of Your Data" lastUpdated="October 5, 2026" body={BODY} />
      <LandingFooter />
    </main>
  );
}
