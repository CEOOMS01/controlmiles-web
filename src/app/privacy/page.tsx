// Olympus Mont Systems LLC - ControlMiles
// src/app/privacy/page.tsx
//
// Ported verbatim from lib/legal/legal_documents.dart's privacyPolicyEn
// (the individual/Gig-account version) -- same draft/pending-legal-review
// status. The general audience of this public site (drivers signing up
// AND fleet admins) makes this the right default for the public footer
// link; the Fleet-specific variant (organization data-sharing framed
// first) lives at /admin/legal for signed-in fleet admins specifically.

import type { Metadata } from "next";
import { Big_Shoulders, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { LandingNav, LandingFooter } from "@/components/landing-chrome";
import { LegalDocument } from "@/components/legal-document";
import "../landing.css";

const display = Big_Shoulders({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-display" });
const plexSans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-sans" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono-plex" });

export const metadata: Metadata = {
  title: "Privacy Policy — ControlMiles",
};

const BODY = `
1. WHO WE ARE

ControlMiles is developed by Olympus Mont Systems LLC ("we", "us", "our"). This Privacy Policy explains what information ControlMiles collects, how we use it, and the choices you have.

2. INFORMATION WE COLLECT

Account information: email address and, if you provide them, your first and last name.

Location data: with your permission, ControlMiles records GPS location while you are actively tracking a trip (and briefly in the background to detect trip start/stop). Location is used to calculate mileage and is not collected when no trip is active.

Odometer photos: when you start or end a trip, ControlMiles asks you to photograph your vehicle's odometer. These photos are processed on your device (to read the number automatically) and uploaded to our cloud storage as evidence supporting your mileage records.

Vehicle and trip information: the vehicles you add, trip start/end times, mileage, the gig platform or purpose you associate with a trip, and any notes you choose to add.

Gig-app detection (optional, premium feature): if you enable Automatic Detection, ControlMiles uses Android's Usage Access permission to identify which app is in the foreground on your device, so it can suggest starting a trip. This only reads the name of the app currently on screen -- ControlMiles never accesses the contents, account, trip data, or earnings of any third-party app. This feature can be turned off at any time in Settings.

Device and diagnostic information: basic technical information (device type, OS version, app version) used for troubleshooting.

3. HOW WE USE YOUR INFORMATION

To provide the core service: recording, calculating, and reporting your mileage; generating PDF reports; storing your evidence photos.
To operate premium features you enable, such as automatic trip detection.
To maintain your account, respond to support requests, and secure the app against fraud or abuse.
We do not sell your personal information, and we do not currently use third-party advertising networks.

4. HOW WE SHARE INFORMATION

Fleet/organization accounts: if you join or create an organization (Fleet mode), your assigned vehicle, trip mileage, and vehicle inspection records are visible to that organization's admin(s), consistent with the role you or they set up. Personal Gig-mode accounts are not shared with any organization.

Service providers: we use Supabase (database, authentication, and file storage) to operate ControlMiles. We do not share your data with other third parties except as required by law or to protect the rights, property, or safety of ControlMiles, our users, or others.

5. THIRD-PARTY GIG PLATFORMS -- NO AFFILIATION

ControlMiles lets you label trips with the name of the gig platform you were working for (for example: Uber, Lyft, DoorDash, Instacart, Amazon Flex, Roadie, Shipt, Veho, Jitsu, Spark Driver, and others), and, if you enable Automatic Detection, can recognize when one of those apps is open on your device.

ControlMiles is an independent, third-party tool. It is not affiliated with, endorsed by, sponsored by, or officially connected to Uber, Lyft, DoorDash, Instacart, Amazon, Walmart, Shipt, Roadie, or any other platform referenced in the app. All product names, logos, and brand names are trademarks of their respective owners, used here only to describe compatibility. ControlMiles does not access, read, or store any data from those platforms' own apps, accounts, or servers -- it only knows the name of whichever app is currently on your screen.

6. DATA RETENTION

We retain your trip, vehicle, and account data for as long as your account is active, or until you delete individual trips or your entire account. Deleting your account permanently removes your data, including uploaded evidence photos, from our systems.

7. YOUR CHOICES

You can delete individual trips at any time from the History screen.
You can delete your account at any time from Settings -- this is permanent and cannot be undone.
You can revoke location, camera, or Usage Access permissions at any time from your device's system settings; doing so will limit or disable the corresponding features.
You can turn Automatic Detection off at any time.

8. CHILDREN'S PRIVACY

ControlMiles is not directed at children and is not intended for use by anyone under the age of 18.

9. SECURITY

We use industry-standard measures to protect your information, including encrypted network connections and access controls. No method of storage or transmission is 100% secure, and we cannot guarantee absolute security.

10. CHANGES TO THIS POLICY

We may update this Privacy Policy from time to time. Material changes will be reflected by updating the "Last updated" date above.

11. CONTACT US

Questions about this policy: privacy@controlmiles.com. General inquiries: info@controlmiles.com. Support: support@controlmiles.com.
`;

export default function PrivacyPage() {
  return (
    <main
      className={`landing ${display.variable} ${plexSans.variable} ${plexMono.variable}`}
      style={{ fontFamily: "var(--font-plex-sans), system-ui, sans-serif" }}
    >
      <LandingNav />
      <LegalDocument
        title="Privacy Policy"
        lastUpdated="August 27, 2026"
        intro="This is a draft Privacy Policy, published for transparency while it undergoes legal review. If you have questions, contact privacy@controlmiles.com."
        body={BODY}
      />
      <LandingFooter />
    </main>
  );
}
