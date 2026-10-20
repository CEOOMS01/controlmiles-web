// Olympus Mont Systems LLC - ControlMiles Web
// src/lib/certificate-pdf.ts
//
// Driving school certificate (2026-10-19): drawn from the sealed snapshot
// stored in ds_certificates (data + its SHA-256), so the PDF always matches
// what was issued. Each class is a real GPS trip: date, instructor, car,
// time, night time and miles.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatMinutes } from "@/lib/driving-school";

type CertClass = {
  date: string;
  start: string;
  instructor: string | null;
  vehicle: string | null;
  vehicle_id: string | null;
  minutes: number;
  night_minutes: number;
  miles: number;
};

export type CertificateData = {
  school: string;
  number: string;
  issued_at: string;
  student: { first_name: string; last_name: string };
  required_minutes: number;
  required_night_minutes: number;
  minutes: number;
  night_minutes: number;
  miles: number;
  classes: CertClass[];
};

// Helvetica (WinAnsi) can't draw every character; keep what it can.
const safe = (s: string | null | undefined) =>
  String(s ?? "").replace(/[^\x20-\x7E -ÿ–—‘’“”•]/g, "?");

export async function buildCertificatePdf(data: CertificateData, sha256: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 612;
  const H = 792;
  const M = 50;
  const ink = rgb(0.07, 0.09, 0.14);
  const muted = rgb(0.4, 0.42, 0.48);
  const accent = rgb(0.12, 0.37, 0.55);

  let page: PDFPage = doc.addPage([W, H]);
  let y = H - M;
  const text = (t: string, x: number, size = 10, f: PDFFont = font, color = ink) =>
    page.drawText(safe(t), { x, y, size, font: f, color });

  text("ControlMiles", M, 11, bold, accent);
  y -= 30;
  text("Certificate of Behind-the-Wheel Training", M, 20, bold);
  y -= 22;
  text(data.school, M, 12, font, muted);
  y -= 34;
  text("This certifies that", M, 11, font, muted);
  y -= 24;
  text(`${data.student.first_name} ${data.student.last_name}`, M, 22, bold);
  y -= 26;
  text(
    `completed ${formatMinutes(data.minutes)} of behind-the-wheel training` +
      (data.night_minutes > 0 ? `, ${formatMinutes(data.night_minutes)} of it at night,` : "") +
      ` over ${data.classes.length} classes and ${Number(data.miles).toFixed(1)} miles.`,
    M,
    11,
  );
  y -= 16;
  text(
    `Required by the school: ${formatMinutes(data.required_minutes)}` +
      (data.required_night_minutes > 0 ? `, ${formatMinutes(data.required_night_minutes)} at night.` : "."),
    M,
    10,
    font,
    muted,
  );
  y -= 30;

  const cols = [
    { label: "Date", x: M },
    { label: "Instructor", x: M + 80 },
    { label: "Car", x: M + 200 },
    { label: "Time", x: M + 340 },
    { label: "Night", x: M + 410 },
    { label: "Miles", x: M + 470 },
  ];
  const header = () => {
    for (const c of cols) text(c.label, c.x, 9, bold, muted);
    y -= 6;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: muted });
    y -= 14;
  };
  header();
  for (const c of data.classes) {
    if (y < M + 90) {
      page = doc.addPage([W, H]);
      y = H - M;
      header();
    }
    text(c.date, cols[0].x, 9);
    text((c.instructor ?? "—").slice(0, 22), cols[1].x, 9);
    text([c.vehicle, c.vehicle_id].filter(Boolean).join(" ").slice(0, 26) || "—", cols[2].x, 9);
    text(formatMinutes(c.minutes), cols[3].x, 9);
    text(formatMinutes(c.night_minutes), cols[4].x, 9);
    text(Number(c.miles).toFixed(1), cols[5].x, 9);
    y -= 15;
  }

  y = Math.max(y - 20, M + 60);
  if (y < M + 60) {
    page = doc.addPage([W, H]);
    y = H - M;
  }
  text(`Certificate ${data.number} · issued ${new Date(data.issued_at).toLocaleDateString("en-US", { dateStyle: "long" })}`, M, 9, bold);
  y -= 13;
  text("Every class is a GPS-recorded trip with odometer photos; hours and miles can't be typed in or edited.", M, 8, font, muted);
  y -= 12;
  text(`Seal (SHA-256): ${sha256}`, M, 7, font, muted);

  return doc.save();
}
