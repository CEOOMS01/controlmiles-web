# Changelog — controlmiles.com

Changes to the ControlMiles website and fleet dashboard, newest first.
The site deploys to production on every push to `main` (Vercel), so entries
are grouped by deploy date instead of version numbers.

Fleet is web-only: fleet features and fleet billing (Stripe) are recorded
here. The Supabase changes they depend on live in the app repo
(`controlmiles/supabase/`) and are listed under **Backend** below. Mobile app
releases have their own changelog in the app repo.

## 2026-10-04

### Changed
- Settings → Feedback now points to **suggestions@controlmiles.com**
  (was support@).

### Added
- **Trip route images.** `GET /api/trip-map/<session>/<map_token>` draws a
  static SVG of the trip: streets, water and parks from our own basemap
  (the self-hosted `.pmtiles` on Cloudflare R2, no third-party map service)
  with the route on top, one color per gig app, start/end markers and a
  legend. Closed trips are cached forever (`immutable`); the route handler is
  excluded from the session proxy so the CDN can cache it. A 33-mile trip is
  ~200 KB raw / ~75 KB gzipped, rendered in < 1 s.
  Legend and map credit sit on white pills (no `paint-order` halo), so they
  read correctly in the app's SVG renderer (`flutter_svg`) too.

- **One map per gig app.** A trip (session) can hold several gig-app
  segments (sections). `/api/trip-map/...?section=<id>` frames one segment
  in its color and shows the rest of the trip in gray; the whole-trip image
  marks each gig-app switch with a dot. Segments with no miles (legacy
  data) get no map, matching the no-miles-no-segment rule.
- Maps carry only each gig app's **name and color** (legend); miles and
  time stay in the report itself (user rule). Each gig app keeps one color
  across the whole trip.

### Changed
- **Report Portal:** under each trip's map, one map per tracked gig app
  when the trip had more than one (`route_points[].section_ids`).
- **Report Portal:** each trip shows its route image in a 2-column grid
  (lazy-loaded, prints in the PDF) instead of one interactive map per trip.
  Reports generated before this keep their interactive maps.

### Backend (Supabase, live)
- `session_sections.route_polyline` (encoded polyline, write-once, sent by
  the app when a segment closes), `sessions.map_token` (random capability for
  the image URL), `get_trip_map(session, token)` (anon, token-checked; falls
  back to breadcrumbs for trips without a polyline).
- `generate_report_access_code`: `route_points` lists trips with their
  `map_token` instead of copying every breadcrumb into each report
  (a 3-trip report went from tens of KB of points to 1.8 KB of metadata).

## 2026-10-03

### Added
- **Fleet type onboarding with confirmation.** `/onboarding/fleet-type` has
  no preselected type, shows what the chosen type turns on (modules, classes,
  pre-trip default) and requires the owner to confirm. Only the owner is
  sent there. (`dd51411`)
- **Billing return notices** in Settings → Billing: checkout success,
  checkout canceled, failed payment (`past_due`), and billed vs on-file
  vehicle count. (`ec33666`)

### Changed
- **Fleet type is locked after onboarding.** Settings shows it read-only with
  a "Request a change" email to support; *Show all modules*, *Require a
  pre-trip inspection* and *Use shift schedules* stay editable. (`dd51411`)
- **Fleet free trial: 15 days** (was 5). Pricing copy updated. (`dd51411`)
- **Fleet checkout no longer sends the vehicle count from the browser**; the
  server computes it. An org with a live plan gets "Use Manage billing"
  instead of a second subscription. (`ec33666`)
- **Pricing:** Basic shows *PDF export (2 per month)* and *1 vehicle*,
  Premium *Unlimited PDF exports & report history* and *Up to 5 vehicles*;
  disclaimer updated now that checkout is live. (`ec33666`, `dd51411`)

### Fixed
- Driver "free trial over" message said 30 days; the trial is 15. (`dd51411`)

### Backend (Supabase, live)
- Clients can no longer write an org's billing columns,
  `tier_enforcement_exempt`, `industry_template` or `fleet_type_confirmed_at`
  (an org admin could give the fleet free Growth). `set_fleet_type` is
  owner-only and one-time (`FLEET_TYPE_LOCKED`); support uses
  `support_change_fleet_type(org, type, reason)`; history in
  `fleet_type_changes`.
- Report Portal reports can only be created by `generate_report_access_code`
  (users could insert a forged "verified" report).
- Fleet-wide export is gated to Growth in the database, not only in the page.
- `past_due` keeps the paid plan while Stripe retries the card.
- Stripe functions: `stripe-webhook` re-reads each subscription from Stripe,
  retries on failure instead of dropping the event, takes the tier from the
  price (portal Starter → Growth), and sets seats to the vehicle count before
  each renewal (`invoice.upcoming`). `create-checkout-session` is fleet-only,
  computes seats server-side and blocks double subscriptions; checkout and
  portal return to `/admin/settings` (the old return URLs were 404s).
- Anonymous write grants removed from all public tables.

### Pending (not code)
- Stripe is not configured yet: create the Starter/Growth per-vehicle prices,
  the webhook (events `customer.subscription.*`, `invoice.upcoming`) and the
  secrets `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID_FLEET_STARTER`,
  `STRIPE_PRICE_ID_FLEET_GROWTH`, `STRIPE_WEBHOOK_SECRET`.
