// Olympus Mont Systems LLC - ControlMiles Web
// src/lib/hour-log-pdf.ts
//
// Driving school hour log (2026-10-20, phase 2 "state records"): the
// student's behind-the-wheel record the school keeps for the state, one
// line per finished class with its real GPS numbers, plus totals and a
// signature line for the school official. Office only.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatMinutes } from "@/lib/driving-school";

export type HourLogRow = {
  date: string;
  start: string;
  end: string;
  instructor: string;
  vehicle: string;
  minutes: number;
  night_minutes: number;
  miles: number;
};

export type HourLogData = {
  school: string;
  student: string;
  program: string;
  permit: string | null;
  state_certificate: string | null;
  required_minutes: number;
  required_night_minutes: number;
  rows: HourLogRow[];
  printed_at: string;
};

// Helvetica (WinAnsi) can't draw every character; keep what it can.
const safe = (s: string | null | undefined) =>
  String(s ?? "").replace(/[^\x20-\x7E -ÿ–—‘’“”•]/g, "?");

export async function buildHourLogPdf(d: HourLogData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 612;
  const H = 792;
  const M = 40;
  const ink = rgb(0.07, 0.09, 0.14);
  const muted = rgb(0.4, 0.42, 0.48);

  let page: PDFPage = doc.addPage([W, H]);
  let y = H - M;
  const text = (t: string, x: number, size = 9, f: PDFFont = font, color = ink) =>
    page.drawText(safe(t), { x, y, size, font: f, color });

  text("Behind-the-Wheel Hour Log", M, 18, bold);
  y -= 18;
  text(d.school, M, 11, font, muted);
  y -= 26;
  text(`Student: ${d.student}`, M, 10, bold);
  text(`Program: ${d.program}`, M + 300, 10);
  y -= 14;
  if (d.permit) text(`Permit: ${d.permit}`, M, 10);
  if (d.state_certificate) text(`State certificate: ${d.state_certificate}`, M + 300, 10);
  if (d.permit || d.state_certificate) y -= 14;
  y -= 10;

  const cols = [
    { label: "#", x: M },
    { label: "Date", x: M + 22 },
    { label: "Time", x: M + 84 },
    { label: "Instructor", x: M + 180 },
    { label: "Car", x: M + 300 },
    { label: "Driving", x: M + 420 },
    { label: "Night", x: M + 470 },
    { label: "Miles", x: M + 510 },
  ];
  const header = () => {
    for (const c of cols) text(c.label, c.x, 8, bold, muted);
    y -= 5;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: muted });
    y -= 13;
  };
  header();

  let minutes = 0;
  let night = 0;
  let miles = 0;
  d.rows.forEach((r, i) => {
    if (y < M + 110) {
      page = doc.addPage([W, H]);
      y = H - M;
      header();
    }
    minutes += Number(r.minutes);
    night += Number(r.night_minutes);
    miles += Number(r.miles);
    text(String(i + 1), cols[0].x, 8);
    text(r.date, cols[1].x, 8);
    text(`${r.start}–${r.end}`, cols[2].x, 8);
    text(r.instructor.slice(0, 24), cols[3].x, 8);
    text(r.vehicle.slice(0, 24), cols[4].x, 8);
    text(formatMinutes(r.minutes), cols[5].x, 8);
    text(r.night_minutes > 0 ? formatMinutes(r.night_minutes) : "—", cols[6].x, 8);
    text(Number(r.miles).toFixed(1), cols[7].x, 8);
    y -= 13;
  });
  if (d.rows.length === 0) {
    text("No finished classes yet.", M, 9, font, muted);
    y -= 13;
  }

  page.drawLine({ start: { x: M, y: y + 6 }, end: { x: W - M, y: y + 6 }, thickness: 0.5, color: muted });
  y -= 6;
  text(
    `Total: ${formatMinutes(minutes)} driving` + (night > 0 ? `, ${formatMinutes(night)} at night` : "") +
      `, ${miles.toFixed(1)} miles, ${d.rows.length} classes.`,
    M,
    10,
    bold,
  );
  y -= 14;
  if (d.required_minutes > 0) {
    text(
      `Program requirement: ${formatMinutes(d.required_minutes)}` +
        (d.required_night_minutes > 0 ? `, ${formatMinutes(d.required_night_minutes)} at night.` : "."),
      M,
      9,
      font,
      muted,
    );
    y -= 14;
  }
  text("Times come from each class's GPS trip and can't be typed in or edited.", M, 8, font, muted);

  y -= 40;
  if (y < M + 30) {
    page = doc.addPage([W, H]);
    y = H - M - 40;
  }
  page.drawLine({ start: { x: M, y }, end: { x: M + 230, y }, thickness: 0.5, color: ink });
  page.drawLine({ start: { x: M + 300, y }, end: { x: M + 420, y }, thickness: 0.5, color: ink });
  y -= 12;
  text("School official signature", M, 8, font, muted);
  text("Date", M + 300, 8, font, muted);
  y -= 22;
  text(`Printed ${d.printed_at} · ControlMiles`, M, 7, font, muted);

  return doc.save();
}
