"use client";

import { useTransition } from "react";
import { setRouteStatus, deleteDraftRoute } from "./actions";

export function RouteRowActions({ routeId, status }: { routeId: string; status: string }) {
  const [pending, startTransition] = useTransition();

  if (status === "closed") {
    return <span className="text-xs text-muted">Locked</span>;
  }

  return (
    <div className="flex justify-end gap-3">
      {status === "draft" && (
        <button
          onClick={() => startTransition(() => setRouteStatus(routeId, "active"))}
          disabled={pending}
          className="text-xs font-medium text-accent transition hover:underline disabled:opacity-60"
        >
          Activate
        </button>
      )}
      <button
        onClick={() => startTransition(() => setRouteStatus(routeId, "closed"))}
        disabled={pending}
        className="text-xs font-medium text-muted transition hover:text-foreground disabled:opacity-60"
      >
        Close
      </button>
      {status === "draft" && (
        <button
          onClick={() => startTransition(() => deleteDraftRoute(routeId))}
          disabled={pending}
          className="text-xs font-medium text-danger transition hover:underline disabled:opacity-60"
        >
          Delete
        </button>
      )}
    </div>
  );
}
