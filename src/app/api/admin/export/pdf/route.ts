import { NextResponse, type NextRequest } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { loadFleetExportData, vehiclesLabel, type FleetExportResult } from "@/lib/fleet-export";
import { AppError } from "@/lib/errors";

export const runtime = "nodejs";

const PAGE_WIDTH = 792; // US Letter, landscape
const PAGE_HEIGHT = 612;
const MARGIN = 40;
const ROW_HEIGHT = 22;
const COLS = [
  { label: "Driver", width: 170 },
  { label: "Driver ID", width: 100 },
  { label: "Total Miles", width: 90 },
  { label: "Sessions", width: 80 },
  { label: "Vehicles", width: 272 },
];

async function buildPdf(result: FleetExportResult): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const drawHeader = () => {
    page.drawText("ControlMiles — Fleet Mileage Export", {
      x: MARGIN,
      y,
      size: 16,
      font: boldFont,
      color: rgb(0.06, 0.09, 0.16),
    });
    y -= 20;
    page.drawText(`${result.orgName} · ${result.startDate} to ${result.endDate}`, {
      x: MARGIN,
      y,
      size: 10,
      font,
      color: rgb(0.35, 0.38, 0.45),
    });
    y -= 12;
    page.drawText("For deduction purposes — not guaranteed by this app.", {
      x: MARGIN,
      y,
      size: 8,
      font,
      color: rgb(0.55, 0.58, 0.65),
    });
    y -= 24;
  };

  const drawTableHeader = () => {
    let x = MARGIN;
    for (const col of COLS) {
      page.drawText(col.label, { x, y, size: 9, font: boldFont, color: rgb(0.35, 0.38, 0.45) });
      x += col.width;
    }
    y -= 6;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.82),
    });
    y -= ROW_HEIGHT - 6;
  };

  const newPage = () => {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
    drawTableHeader();
  };

  drawHeader();
  drawTableHeader();

  for (const row of result.rows) {
    if (y < MARGIN + ROW_HEIGHT) {
      newPage();
    }

    const values = [
      row.driver_name ?? "—",
      row.driver_display_id ?? "—",
      row.total_miles.toFixed(1),
      String(row.total_sessions),
      vehiclesLabel(row.vehicles) || "—",
    ];

    let x = MARGIN;
    values.forEach((value, i) => {
      const maxChars = Math.floor(COLS[i].width / 5.2);
      const truncated = value.length > maxChars ? `${value.slice(0, maxChars - 1)}…` : value;
      page.drawText(truncated, { x, y, size: 9, font, color: rgb(0.1, 0.12, 0.18) });
      x += COLS[i].width;
    });
    y -= ROW_HEIGHT;
  }

  if (result.rows.length === 0) {
    page.drawText("No driver activity in this date range.", {
      x: MARGIN,
      y,
      size: 10,
      font,
      color: rgb(0.5, 0.53, 0.6),
    });
    y -= ROW_HEIGHT;
  }

  // Totals
  if (y < MARGIN + ROW_HEIGHT) newPage();
  y -= 4;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.82),
  });
  y -= ROW_HEIGHT - 4;

  const totalMiles = result.rows.reduce((sum, r) => sum + r.total_miles, 0);
  const totalSessions = result.rows.reduce((sum, r) => sum + r.total_sessions, 0);
  const totalsValues = ["TOTAL", "", totalMiles.toFixed(1), String(totalSessions), ""];
  let tx = MARGIN;
  totalsValues.forEach((value, i) => {
    page.drawText(value, { x: tx, y, size: 9, font: boldFont, color: rgb(0.06, 0.09, 0.16) });
    tx += COLS[i].width;
  });

  return doc.save();
}

export async function GET(request: NextRequest) {
  const startDate = request.nextUrl.searchParams.get("start_date") ?? "";
  const endDate = request.nextUrl.searchParams.get("end_date") ?? "";

  try {
    const result = await loadFleetExportData(startDate, endDate);
    const pdfBytes = await buildPdf(result);

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="fleet-mileage-${startDate}-to-${endDate}.pdf"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: AppError.from(e).display() }, { status: 400 });
  }
}
