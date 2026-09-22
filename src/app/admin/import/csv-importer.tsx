"use client";

import { useRef, useState, useTransition } from "react";
import { parseCsvToObjects, toCsv } from "@/lib/csv";
import {
  bulkAddVehicles,
  bulkAddDriverSlots,
  type VehicleImportRow,
  type VehicleImportResult,
  type DriverImportRow,
  type DriverImportResult,
} from "./actions";

type Mode = "vehicles" | "drivers";

const VEHICLE_TEMPLATE = "nickname,make,model,year,plate\nVan 1,Ford,Transit,2022,ABC-1234\nVan 2,Ford,Transit,2022,ABC-1235\n";
const DRIVER_TEMPLATE = "first_name,last_name\nJane,Doe\nJohn,Smith\n";

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function parseVehicleRows(objs: Record<string, string>[]): VehicleImportRow[] {
  return objs
    .map((o) => ({
      nickname: o.nickname?.trim() || null,
      make: o.make?.trim() || null,
      model: o.model?.trim() || null,
      year: o.year?.trim() ? Number(o.year.trim()) : null,
      plate: o.plate?.trim() || null,
    }))
    .filter((r) => r.nickname || r.make || r.model || r.plate);
}

function parseDriverRows(objs: Record<string, string>[]): DriverImportRow[] {
  return objs
    .map((o) => ({
      firstName: (o.first_name ?? o.firstname ?? "").trim(),
      lastName: (o.last_name ?? o.lastname ?? "").trim(),
    }))
    .filter((r) => r.firstName && r.lastName);
}

export function CsvImporter({ orgId }: { orgId: string }) {
  const [mode, setMode] = useState<Mode>("vehicles");
  const [vehicleRows, setVehicleRows] = useState<VehicleImportRow[]>([]);
  const [driverRows, setDriverRows] = useState<DriverImportRow[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [vehicleResults, setVehicleResults] = useState<VehicleImportResult[] | null>(null);
  const [driverResults, setDriverResults] = useState<DriverImportResult[] | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function resetForMode(next: Mode) {
    setMode(next);
    setVehicleRows([]);
    setDriverRows([]);
    setVehicleResults(null);
    setDriverResults(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError(null);
    setVehicleResults(null);
    setDriverResults(null);
    const text = await file.text();
    const objs = parseCsvToObjects(text);
    if (objs.length === 0) {
      setFileError("Couldn't find any rows in that file — check it has a header row plus at least one data row.");
      return;
    }
    if (mode === "vehicles") {
      const rows = parseVehicleRows(objs);
      if (rows.length === 0) {
        setFileError("No usable vehicle rows — each needs at least a nickname, make, model, or plate.");
        return;
      }
      setVehicleRows(rows);
    } else {
      const rows = parseDriverRows(objs);
      if (rows.length === 0) {
        setFileError("No usable driver rows — each needs a first_name and last_name.");
        return;
      }
      setDriverRows(rows);
    }
  }

  function submit() {
    startTransition(async () => {
      if (mode === "vehicles") {
        const { results } = await bulkAddVehicles(orgId, vehicleRows);
        setVehicleResults(results);
      } else {
        const { results } = await bulkAddDriverSlots(orgId, driverRows);
        setDriverResults(results);
      }
    });
  }

  const previewRows = mode === "vehicles" ? vehicleRows : driverRows;
  const hasResults = mode === "vehicles" ? vehicleResults !== null : driverResults !== null;

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => resetForMode("vehicles")}
          className={`rounded-lg px-3.5 py-2 text-sm font-medium transition ${mode === "vehicles" ? "bg-accent text-accent-foreground" : "border border-border text-foreground hover:border-accent"}`}
        >
          Vehicles
        </button>
        <button
          onClick={() => resetForMode("drivers")}
          className={`rounded-lg px-3.5 py-2 text-sm font-medium transition ${mode === "drivers" ? "bg-accent text-accent-foreground" : "border border-border text-foreground hover:border-accent"}`}
        >
          Drivers
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => downloadText(mode === "vehicles" ? "vehicles-template.csv" : "drivers-template.csv", mode === "vehicles" ? VEHICLE_TEMPLATE : DRIVER_TEMPLATE)}
          className="text-sm text-accent hover:underline"
        >
          Download {mode === "vehicles" ? "vehicle" : "driver"} CSV template
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={onFile}
          className="text-sm"
        />
      </div>

      {fileError && <p className="mt-3 text-sm text-danger">{fileError}</p>}

      {previewRows.length > 0 && !hasResults && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium">
            {previewRows.length} row{previewRows.length === 1 ? "" : "s"} ready to import
          </p>
          <div className="max-h-64 overflow-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-border text-left text-muted">
                  {mode === "vehicles" ? (
                    <>
                      <th className="px-3 py-2 font-medium">Nickname</th>
                      <th className="px-3 py-2 font-medium">Make</th>
                      <th className="px-3 py-2 font-medium">Model</th>
                      <th className="px-3 py-2 font-medium">Year</th>
                      <th className="px-3 py-2 font-medium">Plate</th>
                    </>
                  ) : (
                    <>
                      <th className="px-3 py-2 font-medium">First name</th>
                      <th className="px-3 py-2 font-medium">Last name</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {mode === "vehicles"
                  ? vehicleRows.map((r, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="px-3 py-1.5">{r.nickname ?? "—"}</td>
                        <td className="px-3 py-1.5">{r.make ?? "—"}</td>
                        <td className="px-3 py-1.5">{r.model ?? "—"}</td>
                        <td className="px-3 py-1.5">{r.year ?? "—"}</td>
                        <td className="px-3 py-1.5">{r.plate ?? "—"}</td>
                      </tr>
                    ))
                  : driverRows.map((r, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="px-3 py-1.5">{r.firstName}</td>
                        <td className="px-3 py-1.5">{r.lastName}</td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={submit}
            disabled={pending}
            className="mt-4 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Importing…" : `Import ${previewRows.length} ${mode === "vehicles" ? "vehicle" : "driver"}${previewRows.length === 1 ? "" : "s"}`}
          </button>
        </div>
      )}

      {mode === "vehicles" && vehicleResults && (
        <VehicleResultsTable results={vehicleResults} />
      )}
      {mode === "drivers" && driverResults && (
        <DriverResultsTable results={driverResults} />
      )}
    </div>
  );
}

function VehicleResultsTable({ results }: { results: VehicleImportResult[] }) {
  const okCount = results.filter((r) => r.ok).length;
  return (
    <div className="mt-4">
      <p className="mb-2 text-sm font-medium">
        {okCount} of {results.length} vehicle{results.length === 1 ? "" : "s"} added
      </p>
      <div className="max-h-64 overflow-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <tbody>
            {results.map((r, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="px-3 py-1.5">{r.row.nickname || r.row.plate || `Row ${i + 1}`}</td>
                <td className={`px-3 py-1.5 text-right ${r.ok ? "text-success" : "text-danger"}`}>
                  {r.ok ? "Added" : r.error}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DriverResultsTable({ results }: { results: DriverImportResult[] }) {
  const okResults = results.filter((r) => r.ok);
  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium">
          {okResults.length} of {results.length} driver{results.length === 1 ? "" : "s"} added
        </p>
        {okResults.length > 0 && (
          <button
            onClick={() =>
              downloadText(
                "driver-claim-codes.csv",
                toCsv(
                  ["first_name", "last_name", "display_id", "claim_code"],
                  okResults.map((r) => [r.row.firstName, r.row.lastName, r.displayId ?? "", r.claimCode ?? ""]),
                ),
              )
            }
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition hover:border-accent"
          >
            Download claim codes
          </button>
        )}
      </div>
      <p className="mb-2 text-xs text-muted">
        Claim codes are shown only once. Download them now and hand each one to its driver so they can link
        their ControlMiles account.
      </p>
      <div className="max-h-72 overflow-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-surface">
            <tr className="border-b border-border text-left text-muted">
              <th className="px-3 py-2 font-medium">Driver</th>
              <th className="px-3 py-2 font-medium">ID</th>
              <th className="px-3 py-2 font-medium">Claim code</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="px-3 py-1.5">
                  {r.row.firstName} {r.row.lastName}
                </td>
                {r.ok ? (
                  <>
                    <td className="px-3 py-1.5 font-mono text-xs">{r.displayId}</td>
                    <td className="px-3 py-1.5 font-mono text-xs tracking-[0.15em]">{r.claimCode}</td>
                  </>
                ) : (
                  <td className="px-3 py-1.5 text-danger" colSpan={2}>
                    {r.error}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
