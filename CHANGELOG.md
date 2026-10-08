# Changelog — controlmiles.com

Changes to the ControlMiles website and fleet dashboard, newest first.
The site deploys to production on every push to `main` (Vercel), so entries
are grouped by deploy date instead of version numbers.

Fleet is web-only: fleet features and fleet billing (Stripe) are recorded
here. The Supabase changes they depend on live in the app repo
(`controlmiles/supabase/`) and are listed under **Backend** below. Mobile app
releases have their own changelog in the app repo.

## 2026-10-09

### Added
- **School transportation** (fleet type "School transportation", plan in
  `docs/plan-fleet-school-transportation.md`). New menu section (shown for
  that type and for Mixed / other):
  - **School: live** -- today's school routes next to the live bus map:
    not started / late start / on time / behind / completed, next stop and
    minutes behind, stops done, students on board. Refreshes every 15 s.
  - **School routes** -- AM/PM routes with school, driver, bus, start time
    and service days; each route's page orders its stops (address search
    with map location, arrival radius, time, pick-up/school/drop-off),
    assigns who gets on/off at each stop, and shows the last runs.
  - **Pick-up viewer** on each route (any day, live while it runs): every
    student in **blue** (picked up / dropped off, with time) or **red**
    (absent / not dropped off), per stop.
  - **Schools & students** -- schools and a minimal roster (first name, last
    initial, grade, school, optional district ID).
  - **Attendance** -- a pick-up is the day's attendance: Present/Absent per
    student, route and day, totals and rate; **Download CSV** and **Print /
    save as PDF** for the county school district.
  - **Report branding** -- each fleet uploads its logo (PNG/JPG/WebP, < 1 MB,
    private storage) and sets the company name printed on top of the report.
- Address autocomplete can submit the picked place's coordinates.

### Changed
- **School day colors** everywhere (same rule as the driver app, in
  `src/lib/school-status.ts`): blue on track, red alert (rode this morning
  but hasn't come out / not dropped off), yellow absent (didn't ride this
  morning), gray released with a reason.
  - **Pick-up viewer** shows each student in those colors, the release
    reason and note, and "skip · no one here today" on stops with only
    absent/released riders.
  - **School: live** flags routes with red students.
  - **Attendance report**: Present / Released (with reason, counts as
    attendance) / Absent / Unresolved, a new Note column, and an **"Alerts
    and how they were resolved"** section; the CSV adds Time and Note.
- **School: live -> route students.** Tapping a route card opens a new page
  (`/admin/school/live/[id]`) with every student of the route and ONE color
  for their situation right now (alerts first): on the bus / dropped off,
  rode this morning but hasn't come out, not dropped off, released with the
  reason, absent. Shows the bus (name, fleet ID, plate), the driver and the
  bus monitor, counts per color, and refreshes every 15 s while running.
  "Route setup" still opens the planning page.
- **Bus monitor** per school route (by name; monitors usually don't use the
  app): set when creating the route or in the new **Crew** section of the
  route page (driver, bus and monitor, editable after creation). Shown on
  the live cards, the route list and the route's student page. Web only.
- **5-minute grace period** before a student turns red or absent: when the
  bus reaches a stop they have 5 minutes to come out (or until the bus
  leaves); boarding in that time just turns them blue.

### Backend (Supabase, live)
- Migration `20261009100000_school_transportation`: `school_sites`,
  `route_stops`, `students`, `student_stop_assignments`, `route_runs`,
  `route_stop_events`, `ridership_events` (RLS: operator or above reads/plans;
  drivers only through RPCs); `routes.route_type/school_site_id/service_days`;
  driver RPCs `my_school_routes_today`, `start_route_run`,
  `mark_stop_arrived`, `record_ridership`, `complete_route_run` (requires the
  child check); trigger on `vehicles` live location marks stop
  arrival/departure. Tested end to end with a simulated morning run (4/4
  stops auto-arrived, 8 on / 8 off, child check) and the blocked cases
  (finish twice, start without a trip, another driver).
- Migration `20261009110000_org_report_branding`:
  `organizations.report_display_name/report_logo_path`,
  `set_report_branding` (owner/admin), private bucket `org_branding`.
- Demo fleet **Demo School Bus Co** (owner alsoler26, invented students) via
  `controlmiles/supabase/seed_demo_school.sql`.
- Migration `20261009130000_school_day_status`: `ridership_events` gains
  the `released` action with `reason`/`note`; `fn_rider_status` (internal)
  computes each student's color; `my_school_routes_today` returns
  `status`/`release_reason`/`release_note`; `record_ridership` takes a
  reason (required for a release); `complete_route_run` refuses
  `STUDENTS_STILL_ON_BOARD` and `UNRESOLVED_STUDENTS`. Tested on the demo
  fleet's PM run: Ethan (no AM ride) yellow, Ava released to a parent
  (gray), Noah red until boarded, finish blocked twice then completed.
- Migration `20261009140000_school_run_start_at_stop`, found by a 5-stop
  test route: a PM run started with the bus already parked at the school
  never marked the school stop (arrival only fired when the location
  changed), so students who didn't come out stayed "expected" and the route
  could be finished. `start_route_run` now marks arrival at any stop the
  bus is already at (location < 10 min old), and `complete_route_run` also
  refuses PM riders still "expected".
- Demo **Route 7 — Lincoln AM/PM** (Bus 7, 5 different stops, 10 invented
  students) via `controlmiles/supabase/seed_demo_school_5stops.sql`.
  Simulated a full day by moving the bus over GPS: AM 6 picked up, 4 absent
  (one stop with nobody), finish blocked until everyone got off at school;
  PM: absent stop shown as skip, a yellow student boarded anyway (parent
  brought him), one released for early dismissal, one forgotten on the bus
  (red at their stop, finish blocked), one never came out (finish blocked
  until resolved with a reason), then completed.
- Migration `20261009150000_school_grace_and_monitor`: `routes.monitor_name`;
  `fn_stop_due` (internal) -- a stop's decisions are due once the bus left
  it, 5 minutes after it arrived, or the run is completed; `fn_rider_status`
  uses it (tested: 0 and 4 min undecided, 6 min or bus left -> decided).
  The driver app gets the margin from the server without an update.

## 2026-10-08

### Billing setup (Stripe, not code) -- reverted the same day
- Fleet Starter/Growth products, a `stripe-webhook` destination and the
  customer portal were set up in the Olympus Mont Systems LLC Stripe
  sandbox, then undone (user decision: Stripe will move to the company's
  definitive account): webhook deleted, both products archived (Stripe
  doesn't allow deleting products already used in a portal config). No
  Stripe secrets were saved in Supabase, so fleet checkout stays "not
  configured". To redo on the new account: 2 per-unit monthly prices
  ($12.99 / $19.99), webhook with `customer.subscription.*` +
  `invoice.upcoming`, portal plan switching on / quantity off, then the 4
  secrets.

### Backend (Supabase, live)
- **Account deletion failed for anyone who touched fleet data** (found
  deleting a test fleet driver: 23503 on
  `vehicle_odometer_checkpoints_start_captured_by_fkey`). 16 foreign keys to
  `auth.users`/`profiles` were `ON DELETE NO ACTION`, so the in-app "Delete
  account" (a Google Play requirement) failed for fleet drivers and admins.
  Migration `20261008100000_account_deletion_unblock`:
  - "Who did it" columns (`*_captured_by`, `created_by`, `accepted_by`,
    `reviewed_by`, `generated_by`, `routes.assigned_driver_id`) are now
    `ON DELETE SET NULL`: the record stays with the vehicle/fleet.
  - `vehicle_inspections`, `trip_incidents`, `fuel_purchases`,
    `session_gps_breadcrumbs`: personal rows (`organization_id IS NULL`)
    are deleted with the account (`trg_delete_personal_rows_on_profile_delete`);
    fleet rows stay with the fleet with `user_id` NULL.
  - 0 blocking foreign keys left.
- Closed routes and started shift blocks rejected that `SET NULL` (their
  freeze triggers block every update). Migration
  `20261008110000_account_deletion_frozen_rows`: the profile-delete trigger
  sets a transaction-local flag (`cm.account_deletion`) and both freeze
  triggers let the update through only while it is on; any other edit of a
  closed route / started block is still rejected (verified).
- Test fleet driver al.soler02@gmail.com deleted (user, profile, trips,
  membership, onboarding gone; its closed route kept for the fleet with no
  driver).

## 2026-10-07

### Changed
- **Gig plans are sold only in the app** (Basic $5.99 / Premium $9.99, Google
  Play subscriptions with a 15-day free trial); the web sells fleet plans
  only (Stripe). Same model as Gridwise Plus: price on the site, button to
  the app, trial and billing in the store.
  - `/pricing`: the Basic/Premium buttons say **Start 15-day free trial**
    and the note explains the trial, Google Play billing and in-app plan
    choice. The fleet section has an anchor (`/pricing#fleets`).
  - `/app-required` is now a localized (en/es) download page: 3 steps
    (download, pick a plan in the app, Google Play bills after the trial),
    Google Play / App Store buttons and a link to fleet pricing. It used to
    tell people who had just picked a plan that "the app is coming soon"
    and "this website is for fleet admins". The Google Play button shows
    "Coming soon" until `PLAY_STORE_PUBLIC` is set to `true` (the app is in
    closed testing, so its store listing is not public yet).

## 2026-10-05

### Fixed
- `/.well-known/assetlinks.json` now includes the **Google Play app signing**
  certificate (SHA-256 `04:4B:F7:...:0C:33`). Apps installed from Play are
  re-signed with that key, so without it the fleet invite links
  (`/invite/<token>`) would not open the app.

### Added
- **`/delete-data`** (public, no login): how to delete some data without
  deleting the account -- trips and vehicles in the app, anything else by
  email to account@controlmiles.com. Linked from Google Play's Data safety
  "delete some or all data without deleting the account" question; added to
  the sitemap.

### Backend (Supabase, live)
- `user_onboarding`: users can insert their own row
  (`onboarding_insert_own`, replaces the `with check (false)` policy). The
  app saves its onboarding flags with an upsert, which Postgres checks
  against the INSERT policy even when the row exists, so every save failed
  (42501) and the app kept showing the account-type chooser. Fixes every
  installed app version; no app release needed.

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
- A trip's miles = the sum of its gig-app segments, set by the database when
  the trip closes (`trg_session_miles_from_sections`); 6 legacy trips that
  disagreed were repaired. Fixes reports whose business-use summary didn't
  match their total (e.g. 102.8%) -- the Report Portal totals use the same
  stored trip miles.
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
