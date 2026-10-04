import { createClient } from "@supabase/supabase-js";
import { decodePolyline, type LatLng } from "@/lib/trip-map/polyline";
import { renderTripMapSvg, type RouteSegment } from "@/lib/trip-map/render";
import { gigAppLabel } from "@/lib/catalog";

// GET /api/trip-map/<session id>/<map token> -> the trip's route "photo"
// (SVG: our own basemap streets + the route, one color per gig app).
//
// The token is sessions.map_token, a random capability: drivers and fleet
// admins read it with the session, Report Portal reports carry it. The
// data comes from get_trip_map (anon, token-checked), so this handler needs
// no service-role key. A closed trip never changes (its sections are frozen
// and route_polyline is write-once), so its image is cached forever.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type MapSection = {
  gig_app: string;
  polyline: string | null;
  points: LatLng[] | null;
  start: LatLng | null;
  end: LatLng | null;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string; token: string }> },
) {
  const { sessionId, token } = await params;
  const cleanToken = token.replace(/\.svg$/i, "");
  if (!UUID.test(sessionId) || !UUID.test(cleanToken)) {
    return new Response("Not found", { status: 404 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
  const { data, error } = await supabase.rpc("get_trip_map", {
    p_session_id: sessionId,
    p_token: cleanToken,
  });
  if (error || !data) return new Response("Not found", { status: 404 });

  const trip = data as { closed: boolean; sections: MapSection[] };
  const segments: RouteSegment[] = trip.sections.map((s) => {
    let points: LatLng[] = s.polyline ? decodePolyline(s.polyline) : (s.points ?? []);
    // Trips recorded before routes were drawn: at least a start -> end line.
    if (points.length < 2 && s.start && s.end) points = [s.start, s.end];
    return { gigApp: s.gig_app, label: gigAppLabel(s.gig_app), points };
  });

  if (!segments.some((s) => s.points.length >= 2)) {
    return new Response("No route recorded for this trip", { status: 404 });
  }

  let svg: string;
  try {
    svg = await renderTripMapSvg(segments);
  } catch (e) {
    console.error("[trip-map] render failed", e);
    return new Response("Could not draw this route", { status: 500 });
  }

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // Scripts can never run in this image, even if opened directly.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
      "X-Content-Type-Options": "nosniff",
      // `closed` from get_trip_map = final (closed, and every segment's route
      // arrived or had an hour to). Until then, a short cache only.
      "Cache-Control": trip.closed
        ? "public, max-age=31536000, s-maxage=31536000, immutable"
        : "public, max-age=60, s-maxage=60",
    },
  });
}
