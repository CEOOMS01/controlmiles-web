import type { Metadata } from "next";

// Invitation pages are for people joining a fleet or school: the tab says CM Fleet
// (the site-wide title names the gig app, and is not what they signed up for).
export const metadata: Metadata = {
  title: "CM Fleet",
  description: "Accept your invitation to CM Fleet.",
};

export default function InviteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
