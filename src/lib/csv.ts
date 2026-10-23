// Olympus Mont Systems LLC - ControlMiles
// src/lib/csv.ts
//
// Minimal RFC 4180 CSV parser/serializer for the bulk vehicle/driver
// import (src/app/admin/import/) -- no new dependency for something this
// small. Handles quoted fields (with embedded commas, newlines, and
// escaped "" quotes), which a naive line.split(",") silently corrupts.

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  // Normalize CRLF/CR up front so the state machine only ever sees \n.
  const input = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (inQuotes) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  // Trailing field/row with no final newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

/** First row is the header; returns each remaining row as a header→value object. */
export function parseCsvToObjects(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((key, i) => {
      obj[key] = (r[i] ?? "").trim();
    });
    return obj;
  });
}

// CSV formula injection: a text cell that starts with = + - @ (or a tab or
// carriage return) is run as a formula when the file is opened in Excel or
// Sheets. Names reach our exports from public forms (driving school
// enrollment, parents), so every text cell is neutralized with a leading
// apostrophe. A plain number ("-12.5", "3") is left alone so negative
// figures stay numbers. Every CSV the app writes goes through csvCell.
const FORMULA_START = /^[=+\-@\t\r]/;
const PLAIN_NUMBER = /^[+-]?\d+(\.\d+)?$/;

export function neutralizeFormula(text: string): string {
  return FORMULA_START.test(text) && !PLAIN_NUMBER.test(text) ? `'${text}` : text;
}

/** One CSV cell: formula-safe, quoted when it needs it (or always, with `alwaysQuote`). */
export function csvCell(value: string | number | null | undefined, alwaysQuote = false): string {
  const text = typeof value === "number" ? String(value) : neutralizeFormula(String(value ?? ""));
  if (alwaysQuote || /[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(header: string[], rows: (string | number)[][]): string {
  const lines = [header.map((h) => csvCell(h)).join(",")];
  for (const row of rows) {
    lines.push(row.map((v) => csvCell(v)).join(","));
  }
  return lines.join("\n");
}
