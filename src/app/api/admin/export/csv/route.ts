import { NextResponse, type NextRequest } from "next/server";
import { loadFleetExportData, toCsv } from "@/lib/fleet-export";
import { AppError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  const startDate = request.nextUrl.searchParams.get("start_date") ?? "";
  const endDate = request.nextUrl.searchParams.get("end_date") ?? "";

  try {
    const result = await loadFleetExportData(startDate, endDate);
    const csv = toCsv(result);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="fleet-mileage-${startDate}-to-${endDate}.csv"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: AppError.from(e).display() }, { status: 400 });
  }
}
