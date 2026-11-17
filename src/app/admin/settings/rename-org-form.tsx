"use client";

import { SaveStatus, SettingRow, settingsField } from "@/components/settings-ui";

import { useActionState } from "react";
import { renameOrganization, type RenameOrgState } from "./actions";

const initialState: RenameOrgState = { error: null, success: false };

export function RenameOrgForm({ orgId, currentName, noun = "fleet" }: { orgId: string; currentName: string; noun?: string }) {
  const [state, formAction, pending] = useActionState(renameOrganization, initialState);
  const title = `${noun.charAt(0).toUpperCase()}${noun.slice(1)} name`;

  return (
    <SettingRow title={title} help="Shown across the app and on your reports.">
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="org_id" value={orgId} />
        <input name="name" type="text" required aria-label={title} defaultValue={currentName} className={`${settingsField} sm:w-64`} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-border px-3 py-2 text-sm font-medium transition hover:border-accent disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <SaveStatus pending={false} success={state.success} error={state.error} />
      </form>
    </SettingRow>
  );
}
