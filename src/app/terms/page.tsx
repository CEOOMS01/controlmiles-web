// Olympus Mont Systems LLC - ControlMiles
// src/app/terms/page.tsx
//
// Ported verbatim from lib/legal/legal_documents.dart's termsOfServiceEn.
// Deliberately ONE document for both "Terms of Service" and "Terms of
// Use" -- those are the same governing document under two common names,
// not two different agreements; publishing separate pages with separately
// drafted text under each label would risk them silently diverging and
// contradicting each other. /terms is the single source; nothing else
// links a distinct "Terms of Use" page.

import type { Metadata } from "next";
import { Fraunces, Public_Sans, IBM_Plex_Mono } from "next/font/google";
import { LandingNav, LandingFooter } from "@/components/landing-chrome";
import { LegalDocument } from "@/components/legal-document";
import "../landing.css";

const display = Fraunces({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });
const plexSans = Public_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-sans" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono-plex" });

export const metadata: Metadata = {
  title: "Terms of Service — ControlMiles",
};

const BODY = `
1. ACCEPTANCE OF TERMS

By creating an account or using ControlMiles, you agree to these Terms of Service. If you do not agree, do not use the app.

2. DESCRIPTION OF SERVICE

ControlMiles is a mileage-tracking tool for gig, rideshare, delivery, and fleet drivers. It records GPS-based trip mileage, captures odometer photos as supporting evidence, and generates reports intended to help you document business mileage, including for tax purposes.

3. NOT TAX OR LEGAL ADVICE

ControlMiles is not affiliated with or endorsed by the IRS or any tax authority. Mileage deduction estimates shown in the app or in generated reports (including any figure based on the IRS standard mileage rate) are informational only, not a guarantee of any deduction amount, and not a substitute for advice from a qualified tax professional. You are solely responsible for the accuracy of your tax filings.

4. ELIGIBILITY AND YOUR ACCOUNT

You must be at least 18 years old to use ControlMiles. You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account. Notify us promptly of any unauthorized use.

5. THIRD-PARTY GIG PLATFORMS -- NO AFFILIATION

ControlMiles is an independent tool that lets you label your own trips with the name of a gig platform (Uber, Lyft, DoorDash, Instacart, Amazon Flex, Roadie, Shipt, Veho, Jitsu, Spark Driver, and others) and, optionally, detect when one of those apps is open on your device. ControlMiles is not affiliated with, endorsed by, or sponsored by any of these companies, and does not access their apps' data, accounts, or servers. You are responsible for complying with the terms of service of any gig, delivery, or rideshare platform you work with; nothing in ControlMiles is intended to help you violate those terms.

6. PREMIUM FEATURES AND SUBSCRIPTIONS

Some features (such as Automatic Detection) may require a paid subscription or entitlement. Pricing, billing terms, and cancellation policy will be presented at the time of purchase. We reserve the right to change premium feature availability or pricing with reasonable notice.

7. FLEET / ORGANIZATION ACCOUNTS

If you join or create an organization (Fleet mode), you acknowledge that certain data -- assigned vehicle, trip mileage, and vehicle inspection records -- becomes visible to that organization's administrator(s). Organization administrators are responsible for how they use driver data within their organization and for complying with applicable employment and privacy laws.

8. ACCEPTABLE USE

You agree not to: use ControlMiles for any unlawful purpose; attempt to reverse-engineer, decompile, or interfere with the app or its backend; submit fraudulent mileage, odometer, or trip data; or use the app in a way that infringes the rights of any third party, including the trademark rights discussed in Section 5.

9. INTELLECTUAL PROPERTY

ControlMiles, its logo, and its original content are the property of Olympus Mont Systems LLC. Third-party names and logos referenced in the app remain the property of their respective owners.

10. DISCLAIMER OF WARRANTIES

ControlMiles is provided "as is" and "as available," without warranties of any kind, express or implied. We do not guarantee that GPS tracking, mileage calculations, or OCR odometer readings will be error-free or uninterrupted. You are responsible for reviewing your trip data for accuracy before relying on it.

11. LIMITATION OF LIABILITY

To the maximum extent permitted by law, Olympus Mont Systems LLC will not be liable for any indirect, incidental, special, or consequential damages, including lost income or lost tax deductions, arising from your use of ControlMiles.

12. TERMINATION

You may stop using ControlMiles and delete your account at any time. We may suspend or terminate accounts that violate these Terms.

13. GOVERNING LAW

[Placeholder -- to be finalized with counsel: state/jurisdiction whose law governs these Terms.]

14. CHANGES TO THESE TERMS

We may update these Terms from time to time. Continued use of ControlMiles after a change constitutes acceptance of the updated Terms.

15. CONTACT US

Questions about these Terms: legal@controlmiles.com. General inquiries: info@controlmiles.com. Support: support@controlmiles.com.
`;

export default function TermsPage() {
  return (
    <main
      className={`landing ${display.variable} ${plexSans.variable} ${plexMono.variable}`}
      style={{ fontFamily: "var(--font-plex-sans), system-ui, sans-serif" }}
    >
      <LandingNav />
      <LegalDocument
        title="Terms of Service"
        lastUpdated="August 27, 2026"
        intro="This is a draft Terms of Service, published for transparency while it undergoes legal review. If you have questions, contact legal@controlmiles.com."
        body={BODY}
      />
      <LandingFooter />
    </main>
  );
}
