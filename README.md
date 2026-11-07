# CFABS frontend

React 19, TypeScript, Vite 8, and Tailwind CSS 4. LavaLust remains the backend.
React Router provides routes; TanStack Query manages server data and refreshes.

## Run locally

The workspace has two sibling projects: `Booking-System/Lavalust/` for the
backend and `Booking-System/frontend/` for this application. They can be built
and deployed independently. The frontend is outside the backend Git repository.

Use Node.js 22.22+ (Node 25.4 was used for verification) and npm. Start
`php lava serve --port=3000` from `Booking-System/Lavalust/`. In another terminal,
run these commands from `Booking-System/`:

```powershell
cd frontend
npm ci
npm run dev
```

Open http://127.0.0.1:5173. Vite proxies `/api` to `http://127.0.0.1:3000`;
change `vite.config.ts` if your backend uses another port. The existing backend
`.env` and migrations must already be configured. Sign in with a real campus
account provisioned through the existing backend; no demo accounts are shipped.

- `npm run build`: TypeScript checks and production output in `dist/`.
- `npm test`: Node's built-in runner; API refresh, expiry, concurrency, logout,
  error handling, and campus-time conversion checks. No database required.
- `npm run lint`: Oxlint with React and TypeScript rules.
- `npm run preview`: static production preview; does not proxy the API.

Deploy this project's `dist/` independently of the LavaLust backend. Frontend
hosting must rewrite frontend routes to `index.html`. The API client currently
uses relative `/api` URLs: hosting can proxy that path to the separately deployed
backend. If distinct browser-facing API origins are chosen, API base-URL
configuration and a trusted-origin backend CORS policy must be configured before
deployment. Use HTTPS and keep frontend fallback rules away from API paths.
Deployment is not configured yet.

## Current screens

- `/login`: email/password login, visibility toggle, validation and server errors.
- `/`: own booking counts for the API's preceding-30-day interval, overdue loans,
  and confirmed booking guidance. Counts describe overlapping bookings.
- `/notifications`: private paginated notices, including approval/rejection reasons,
  and mark-as-read feedback.
- `/account`: read-only profile; administrators manage account changes separately.
- `/reports`: paginated resource activity for explicitly granted report permissions.
- `/facilities` and `/assets`: active resource catalogs, with paginated results.
- `/facilities/:id`: selected-period availability and a seven-day view of open
  facility times excluding approved bookings and maintenance.
- `/assets/:id`: minimum available quantity for the full selected period and
  available asset tags for individually tracked items.
- Resource details also include request forms for users with the corresponding
  booking-create permission and an assigned department. Facilities collect activity,
  participant count, and purpose; assets collect quantity or exact item selection.
- `/requests`: paginated own-only tracking for facilities and assets, including staff
  accounts that otherwise have campus-wide review permissions.
- `/requests/facility/:id`, `/requests/asset/:id`, `/requests/series/:id`: dates,
  statuses, decision reasons, selected asset tags, and individual series occurrences.

Reports navigation and its route use current `/auth/me` permissions, never a
role-name shortcut or JWT scopes. Backend permission checks remain authoritative.
Full report filters/exports and administration UI are still pending.

## Design and organization

The first workflow is account access followed by personal booking/notification
review. Reports are a secondary staff task. Tokens in `src/index.css` define
teal semantic colors, neutral surfaces, typography, spacing, radii, and control
sizes. Shared feedback/buttons/headings live in `src/components/`; page content
in `src/pages/`; API, types, dates, and session access in `src/lib/`.

Desktop uses a persistent sidebar. At 760px and below, navigation becomes a
collapsible menu and content stacks; metrics use two columns on narrow screens.
Forms have explicit labels, keyboard focus, disabled/submitting states, and
announced errors. Reduced-motion preferences disable animation. Tables scroll
within their container. Follow the full UI rules in this project's `AGENTS.md`.

## Session and updates

Tokens stay in memory, never local/session storage or cookies. Reloading or
opening another tab requires signing in again. The API client shares one refresh
rotation across concurrent 401s and clears revoked/expired sessions. Sign-out
revokes the current refresh token; failures remain visible for retry. Cached data
is cleared on sign-out and account changes. Password whitespace is preserved.

Active screen queries refresh every 30 seconds while visible and on window focus;
notification writes invalidate the list immediately. Profile permissions refresh
on focus and every 60 seconds while visible. Polling is not push delivery, and
availability results and facility schedules refresh with the same polling policy.
Timestamps from the database are UTC and display in Asia/Manila.

Availability controls interpret entered times explicitly in Asia/Manila, including
when a device uses another timezone. Facility periods must stay within one day,
8 AM–5 PM. Start dates are limited to 30 campus calendar days ahead; asset return
dates can extend beyond that window. Selecting an open facility interval fills
the period controls. Availability remains advisory until backend approval.
Catalog records and availability are refreshed separately; unavailable or failed
checks must not be treated as permission to reserve a resource. No request is
created by browsing or checking dates. The request form submits only when its
explicit submit button is used.

## Submitting and tracking requests

Requests can be single or finite daily/weekly series, every 1–4 days/weeks with
2–30 occurrences. The preview lists dates before submission. Every occurrence
must begin within the campus advance window; asset return dates may extend past
it. Availability shown above the form is for the first occurrence. The backend
checks every date and selected item transactionally; one invalid/unavailable date
rolls back the whole series. All new requests await approval and do not reserve
resources. Each occurrence has its own subsequent decision.

Submission disables controls and guards duplicate clicks. Series submissions keep
the original payload/key for retry after a connection failure, server failure,
or a processing-lock response. Inputs stay locked for this exact retry. Single
requests have no server idempotency contract, so an uncertain response disables
resubmission and directs users to check My requests first. A reload loses the
memory-only retry key; check existing requests before starting another submission.
Successful writes refresh request lists, dashboard, notifications, and availability.

The tracking list calls the booking API with `mine=1`; staff review lists can
continue using the existing default API behavior. Tracking and decision reasons
refresh while the screen is visible. Backend ownership checks remain authoritative.

## Staff decisions and cancellation

Staff with the matching `*_booking.view_all` permission can open `/review`
and review paginated bookings, newest first, across all statuses. Each occurrence
is decided separately. The detail page exposes approve, reject, and cancel only
when permitted; a system administrator has no implied approval permission.
Requesters can cancel their own eligible requests from My requests. Approved
bookings must be cancelled before their start; any asset release prevents cancellation.
Pending requests can still be cancelled after their proposed start, matching the API.

Native modal dialogs confirm decisions and require rejection/cancellation reasons.
Approval reports the number of automatically rejected conflicts. The backend
rechecks availability, permissions, timing, and custody under its existing locks.
Decision buttons stay disabled while saving and refreshing. An uncertain network
or server response requires a successful status refresh before another decision.
No decision mutation is automatically retried. No dependencies, database schema,
or deployment settings were changed for this increment.

## Asset handovers

Asset booking details now include custody totals and paginated, chronological
handover history. Owners can read their own ledger; staff need
`asset_booking.view_all` to read another requester’s booking. Release/return and
condition actions follow their separate live permissions.

Custodians record partial pooled quantities or exact individually tracked tags.
Release is available only during the approved period for an active asset.
Returns remain possible when overdue. Damage/loss require condition-management
permission and explanatory remarks. Inspection returns stay unavailable until
inspection batches resolve them. Loss is shown separately from physical returns.
A settled, underfilled booking can be explicitly completed with a reason to
release its unused approved balance.

Each batch has a review dialog and one in-memory retry key. Unknown outcomes
retain the exact payload and key for a safe retry; inputs cannot change during
that recovery. Reloading loses that key: check the handover history before
starting another batch. Completion uses the backend’s existing repeat-safe
completion behavior. No write is automatically retried. Custody totals and item
choices come from a locked server snapshot of the full ledger, independently of
history pagination. Mismatched legacy totals disable handovers for reconciliation.

## Catalog management

`/manage` provides permission-filtered departments, facility/asset categories,
facilities, assets, and nested tagged-item management. Records are paginated;
users with update permission can also see inactive/retired records. Separate
create, update, and deactivate grants control actions. There is no hard delete.

Forms use active category/department selectors, load every lookup page, validate
UTF-8 byte limits and stock bounds, and submit only changed fields on edit.
Tracking mode is permanent; individual inventory comes from tagged items.
Status changes require a confirmation dialog. The backend checks dependencies,
outstanding bookings, capacity, and inventory before saving. Unknown write
outcomes are not retried: close and refresh the list before trying again.
Existing custodian assignments and facility image paths are preserved; editing
those fields and account/role administration remain separate follow-up work.
No dependencies, backend source, migrations, or deployment settings changed.

## Account and role administration

`/administration/accounts` requires `user.manage`. It supports account creation,
name edits, active-department reassignment, and account activation/deactivation.
Role assignment also requires `role.manage`; otherwise new accounts receive the
backend's faculty employee default. Self-status changes are hidden. Username and
email remain immutable because no existing update endpoint supports them.
Initial passwords stay in component memory, preserve spaces, and are never shown
in review summaries or persisted to browser storage. No reset-password UI exists.

`/administration/roles` supports role details with `role.manage` and permission
inspection with `permission.manage`. Replacing grants requires both. Permission
editing loads a fresh snapshot each time, preserves selections while filtering,
and reviews additions/removals before replacing the full set. A fresh read before
submission detects intervening changes; the existing API has no versioned update,
so this check does not provide atomic optimistic concurrency protection.

All writes have an explicit review, no automatic retry, and unknown-outcome
feedback. Successful/attempted writes refresh affected lists and request the
existing session profile refresh. Live server permissions, system-role name
protection, and the last complete administrator guard remain authoritative.
No dependencies, backend source/schema, or deployment settings changed.

## Maintenance management

`/maintenance/facility` and `/maintenance/asset` list maintenance newest first,
with pagination and a resource filter. Each section requires its matching
`*.maintenance.manage` permission. Scheduling through this UI additionally needs
resource browsing (`*.view`); staff without it may inspect and close existing
records and filter by resource ID. Update permission includes inactive resources
and tags in the selectors. Otherwise selectors use visible active records.

Forms support explicit Asia/Manila dates, a reason, pool quantities, and one exact
tag for individually tracked assets. Already-started work is allowed. Facilities
require a future end after the start; assets may omit expected completion for
open-ended work. Maintenance does not inherit booking operating hours or the
30-day advance limit. Aggregate stock and committed-booking conflicts remain
server checks; pending requests remain pending and receive maintenance notices.

Timing labels distinguish scheduled, active, and overdue work. An expected end
does not close maintenance automatically. Future records offer cancellation;
started open records offer completion or cancellation, each with a review dialog.
Completion removes only the maintenance hold; damaged/inactive inventory still
uses its separate condition/status workflow. Rescheduling is not exposed because
no existing endpoint implements it. Unknown write outcomes are not retried.
The existing LavaLust maintenance history query adds a read-only asset_tag label for exact-item identification; scheduling and closure behavior are unchanged. No schema, dependencies, or deployment configuration changed.

## Reports and CSV downloads

The Reports page exposes facility bookings, asset bookings, and asset inventory
according to the existing report grants. Booking reports support paired campus
start/end timestamps, resource/category/requester-department/requester IDs, and
status. Inventory supports resource/category/owning-department/status/tracking
filters. Apply or reset filters explicitly; named catalog suggestions supplement
ID entry, including historical IDs. Suggestions respect separate catalog grants.

Status summaries cover all matching bookings. Resource tables remain paginated.
Scheduled hours measure approved-or-later booking duration clipped to the report
period; they are not occupancy percentages or quantity-weighted asset hours.
Asset overdue rows are a separate current snapshot (earliest 100), independent of
the period but subject to other filters. Inventory shows baseline stock; use the
availability screens for reservation/maintenance-adjusted quantities.

Download CSV requests all filtered resource rows through the existing server
export, with a 10,000-row limit and spreadsheet formula escaping. Operational
exports pin the displayed UTC reporting period, including the rolling default.
The shared API client handles CSV as a Blob using bearer headers and its existing
refresh rotation; tokens never enter download URLs. Errors and non-CSV responses
are rejected, session changes reject late downloads, and leaving aborts a download.
CSV exports contain the resource activity/inventory tables, not the separate
booking-status summary or current-overdue section. Excel/PDF and the other newly
supplied integrations remain follow-on work documented in Lavalust/specs.md.

## Facility completion and audit history

Eligible ended facility bookings expose Complete facility booking in request/review
details. The existing backend requires APPROVED status, an elapsed scheduled end,
and explicit facility_booking.approve; asset completion retains its custody workflow.
Completion uses a review dialog, existing idempotent endpoint and notification/audit
behavior, and shows the recorded completion timestamp. Unknown outcomes require a
status refresh. Action eligibility refreshes every 30 seconds and is rechecked on
submit. Booking changes invalidate reports and audit history as well as availability.

`/audit` requires audit.view and provides read-only history with paired campus date
boundaries, actor account ID, exact entity type/action filters, total-aware pagination,
and expandable before/after values. Default period is the server's preceding 30 days;
records load fresh on entry and poll every 30 seconds while visible. Values reflect
what the backend actually recorded, including missing or legacy plain-text entries.
No audit edit/delete/export action is exposed. Core backend APIs/schema and existing
permissions are unchanged. The other external integrations remain follow-on scope.

## Google Sign-In

The login page uses Google's official Identity Services button without an extra
React dependency. Sign in with the campus password first, then use My account to
link a school Google account or personal Gmail after confirming the current
campus password. Unlinking also requires password confirmation and shows a review
dialog. Existing campus sessions remain active after unlinking.

The frontend reads the public client ID from `/api/auth/google/config`; no Google
secret or frontend environment variable is needed. Google credentials and campus
tokens stay in memory. An absent backend client ID disables Google while password
login remains available. Register the exact development origins in Google Cloud;
see [backend setup](../Lavalust/docs/google-sign-in.md). Live linking and Google
Sign-In were confirmed on 2026-11-07. Production configuration remains deferred.

## Booking calendar

`/calendar` uses `@fullcalendar/react` 7 and its required `temporal-polyfill` peer
for month/week/day/agenda views in Asia/Manila. Views and CSS are loaded only when
the calendar route is opened; small screens initially show the agenda. Resource,
category, booking status, authorized requester department and date-range filters
use the read-only LavaLust event feed. Events open accessible detail dialogs;
selecting a date or time range prefills the existing resource availability page.
Calendar selections never submit or approve a booking automatically.

The feed refreshes every 30 seconds while visible and clears events on errors.
Other requesters' private details remain hidden. Empty cells do not guarantee
availability, especially for pooled stock, overdue custody or inspection holds.
See [calendar contract and checks](../Lavalust/docs/calendar.md).

## Password recovery and email

The login page links to `/forgot-password`; `/reset-password` consumes a single-use
credential from the email URL fragment, keeps it in memory and clears the URL.
Forms share account-creation password policy and support loading, disabled service,
missing-link, validation and success states. Password reset invalidates prior
campus sessions and requires a fresh sign-in. No provider key enters this project.

The request form stays disabled until the backend reports valid mail configuration.
Resend sending is not enabled yet; a private replacement key and verified sender
are needed before live verification. Setup and safe CLI preview/queue commands are
in [backend email documentation](../Lavalust/docs/email-notifications.md).
# Asset QR codes

Use **Scan an asset** to identify a pooled asset group or individual tagged item.
Catalog management provides **QR label** links for SVG download and printing.
Managers with `asset.update` may revoke or regenerate labels after confirmation.
Facility QR codes are excluded by the approved scope.

Release and return forms support optional scanning, then the existing review and
confirmation step. The backend checks every scanned label against the booking;
scanning never records a handover automatically. Manual batches remain available.
Camera scanning needs HTTPS or localhost and permission. Image decoding is local;
PNG/JPEG/WebP files up to 10 MB are supported, alongside pasted label identifiers.
See `../Lavalust/docs/asset-qr.md` for migration, permissions and API details.
# Administrator Excel and PDF exports

On **Reports & exports**, system administrators can choose **File format →
Excel (.xlsx)** or **PDF**, then download using the applied filters. Other roles
retain their existing CSV/report access. The backend independently enforces the
current system administrator role and report-view grant for Excel/PDF.

Excel supports up to 10,000 resource rows; PDF up to 500. Narrow filters for larger
reports. No frontend export dependency is required; the backend generates both
formats. See `../Lavalust/docs/report-exports.md` for setup and verification.
# Asset problem reporting

Use **Asset problems → Report an asset problem**, or scan an asset and choose
**Report a problem**. Reporters can track their own reports and attach one private
JPEG/PNG up to 2 MB. Only system administrators with asset maintenance permission
can review and assign custodians. Assigned custodians use **Assigned to me** to
start work, record progress and resolve problems.

Submission does not block inventory. Starting work creates linked maintenance
through the existing booking/stock checks. Closing linked work updates the
report; cancellation leaves it assigned for follow-up. See
`../Lavalust/docs/asset-problems.md` for permissions, photos and endpoints.
# Render / Vercel deployment

Production frontend: `https://cfabs-frontend.vercel.app`.
Backend: `https://cfabs-1.onrender.com`. Public `.env.production` sets this API origin;
local Vite development keeps its port-3000 proxy. Use `npm run build:vercel` and
the included `vercel.json` for production builds and SPA deep links. All `VITE_`
variables are public; backend credentials belong only in Render Environment.

See `../Lavalust/docs/deployment.md` for exact Render/Vercel settings, required
environment variables, separate repository setup and the post-deploy smoke script.
