"use client";

import { useState } from "react";
import { saveReportBranding } from "./branding-actions";
import { ActionForm, inputClass } from "./form-kit";

export function BrandingForm({
  defaultName,
  customName,
  hasLogo,
}: {
  defaultName: string;
  customName: string | null;
  hasLogo: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-border px-3 py-2 text-sm font-medium transition hover:border-accent print:hidden"
      >
        Edit report name &amp; logo
      </button>
    );
  }
  return (
    <div className="print:hidden">
      <ActionForm action={saveReportBranding} submitLabel="Save branding">
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium">Company name on reports</label>
          <input
            name="display_name"
            defaultValue={customName ?? ""}
            placeholder={defaultName}
            maxLength={120}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-muted">Leave empty to use the fleet name ({defaultName}).</p>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Logo (PNG, JPG or WebP, under 1 MB)</label>
          <input name="logo" type="file" accept="image/png,image/jpeg,image/webp" className="text-sm" />
          {hasLogo && (
            <label className="mt-2 flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" name="remove_logo" /> Remove current logo
            </label>
          )}
        </div>
      </ActionForm>
      <button type="button" onClick={() => setOpen(false)} className="mt-2 text-sm text-muted hover:text-foreground">
        Close
      </button>
    </div>
  );
}
