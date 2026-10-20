"use client";

import { SaveStatus, Segmented, SettingRow } from "@/components/settings-ui";

import { useActionState } from "react";
import { setTimeFormat, type TimeFormatState } from "./actions";

const initialState: TimeFormatState = { error: null, success: false };

export function TimeFormatForm({ currentFormat }: { currentFormat: "12h" | "24h" }) {
  const [state, formAction, pending] = useActionState(setTimeFormat, initialState);

  return (
    <SettingRow title="Clock format" help="How times show across the app, schedules, trip logs and reports.">
      <form action={formAction} className="flex items-center gap-3">
        <SaveStatus pending={pending} success={state.success} error={state.error} />
        <Segmented
          name="time_format"
          value={currentFormat}
          disabled={pending}
          autoSubmit
          options={[
            { value: "12h", label: "2:30 PM" },
            { value: "24h", label: "14:30" },
          ]}
        />
      </form>
    </SettingRow>
  );
}
