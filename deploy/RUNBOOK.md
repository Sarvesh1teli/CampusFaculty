# Operations

Validate OCI capacity and ARM64 builds before deploying. Configure host Nginx HTTPS using nginx-https.example.conf; replace the example domain and use automated certificate renewal. Permit only 80/443 and tightly restricted SSH. Keep PostgreSQL and API private.

Use separate migration and non-superuser runtime database credentials. Apply Prisma migrations with the migration role. Grant the runtime role schema usage, table CRUD and sequence usage; it must not have SUPERUSER or BYPASSRLS. The API applies transaction-local authorization context through Prisma extensions. Do not grant direct database access to tenants.

Run npm run db:seed with strong owner credentials. Configure actual verification adapters and matching UPI/QR assets before enabling them. Give deployed QR files versioned names and never overwrite an asset referenced by pending payment requests.

Backup target: RPO 24 hours; initial RTO target 4 hours, subject to measured restore drills. Install age and configure deploy/backup.sh with a public recipient key and a separate host destination. Schedule daily, retain 7 daily/4 weekly/3 monthly backups on that destination, alert on failures, and test restores monthly in a separate database. Keep decryption keys outside the VM. Restore with age decryption piped into psql against an isolated target; verify counts, ledger reconciliation and health before directing traffic.

Monitor /api/health and database connectivity, host disk/CPU/memory, worker failures, verification failures and overdue Manual UPI requests. Keep logs free of passwords, OTPs, contact data and raw provider responses. Alert on failed backups, disk >80%, persistent HTTP 5xx and missed worker cycles. External alert provider configuration remains an operations task.

Before release back up the database, apply migrations with the owner role, build both apps and deploy immutable images. Roll back the application image if checks fail; schema rollback requires a reviewed forward fix or validated restore and must not silently delete financial records.

Invoice tax particulars, retention/erasure policies, provider delivery and production security review are launch gates. Never enable Manual UPI merely because a QR file exists. Verify the recipient, terms and actual receipt for each approval.

## Cloud deployment completed — 2026-10-09

- App: https://faculty.telicampus.in/ (shared teacher, institution and Super Admin login).
- Teacher registration: https://faculty.telicampus.in/teacher-registration; campaign QR links use this domain.
- Host: ubuntu@150.136.166.77, ARM64. Source: /tmp/ubuntu/campus-faculty. Frontend: /var/www/campusfaculty.
- PostgreSQL: campusfaculty_db, public and app_private schemas; all 7 Prisma migrations applied. Separate campusfaculty_owner migration role and campusfaculty_runtime application role; neither is superuser nor bypasses RLS. Database and API remain on localhost.
- Systemd: campusfaculty-api and campusfaculty-worker, both active. API: 127.0.0.1:3005. Service files: /etc/systemd/system/campusfaculty-{api,worker}.service. Because the requested source is under /tmp, PrivateTmp is not enabled. Preserve this folder across host cleanup/reboots; /tmp is not a durable deployment location.
- Nginx: /etc/nginx/sites-available/faculty.telicampus.in.conf, linked into sites-enabled. HTTPS enabled with HTTP redirect, API proxy and SPA route fallback. nginx -t passed.
- Let's Encrypt certificate expires 2027-01-07; Certbot renewal scheduling exists. Reload hook: /etc/letsencrypt/renewal-hooks/deploy/campusfaculty-renew.
- Production build passed. HTTPS /api/health returned status ok; /teacher-registration returned 200.
- Existing apps stayed active. jobs.telicampus.in=200, garment.telicampus.in=302, buildsphere.telicampus.in=200. Their three Nginx files have identical before/after SHA256 hashes. No existing app databases or app services were changed.
- Initial admin email: owner@faculty.telicampus.in. Generated password is stored privately on the server in /tmp/ubuntu/campus-faculty/.deployment/admin-credentials.txt (mode 600). Do not commit or publish it. Runtime/migration credentials are separate private .deployment/*.env files.
- Authenticated login and campaigns verification, and proposed daily backup setup, remain pending: execution of deploy/cloud-verify.sh was rejected at the permission prompt. No scheduled CampusFaculty backup was installed. The uploaded script is available for review; encrypted off-host backup and a restore drill still require configuration.
- Manual UPI remains disabled; configure payment and verification providers before enabling those features. No local/demo teacher data was imported.

### Maintenance

Inspect: systemctl status campusfaculty-api campusfaculty-worker; journalctl -u campusfaculty-api -u campusfaculty-worker; nginx -t.
Update only this app: back up campusfaculty_db first; upload source into its dedicated folder; npm ci; npm run db:generate; load private migration credentials and run Prisma migrate deploy; npm run build; copy apps/web/dist into /var/www/campusfaculty; restart only campusfaculty-api and campusfaculty-worker. Test HTTPS health, login and registration. Retain prior frontend/build artifacts for rollback. Do not rerun cloud-database.sh against the existing deployment: it is a one-time provisioning script.

### Mobile payment layout update — 2026-10-09
Constrained commerce grid sizing to prevent viewport expansion. Mobile payment records use labeled cards; filters stack and controls remain readable. Local browser checks passed at 360, 390, 720 and 1440 pixels; bottom navigation remains visible at mobile widths. Frontend TypeScript and production build passed.


### Mobile menu home — 2026-10-09
Replaced mobile bottom menus with a two-column card home for each account role. Cards open their pages; All menus returns home. Desktop sidebar is retained. Browser navigation, return and overflow checks passed, as did the production build.


### Institution contacts and teacher profile alignment — 2026-10-10
Admin institution list includes contact person and mobile. View includes person, mobile, email, address and readable account/verification status. API reads saved institution profile with registered admin name/email fallback; missing mobile/address display Not added. Teacher profile header text shortened and mobile fields aligned in a single column. API/frontend compilation passed. Local browser check was unavailable because preview was stopped and starting it was declined.


### Teacher personal field pairs — 2026-10-10
Corrected requested order: first/middle name; last name/gender; date of birth/optional Aadhaar; mobile/current location; full-width address. Two columns on mobile and desktop. CSS layout checks passed at 360, 390, 720 and 1440 pixels without a local server. Production build passed.


### Teacher listing and checkbox alignment — 2026-10-10
Removed qualification helper sentence and Privacy & availability heading. Checkbox retains 18px size beside wrapping label. Applications/Find Jobs use headed panels, stacked full-width mobile filters, readable table cells with scrolling confined to table, and centered mobile pagination. CSS browser checks passed at 360,390,720px; frontend type-check and build passed.


### Compact teacher filters — 2026-10-10
Applications filters restored to one row; Find Jobs compacted to one row. Light blue table headers added. Filter alignment checks passed at 360,390,720,1440px; frontend build passed.


### Consistent blue directory headers — 2026-10-10
Light blue column headers applied to institution candidate search and Owner Institutions, Campaigns and Candidates via shared candidate/admin-directory table styles. Frontend build passed.


### QR registration login guidance — 2026-10-10
Profile submission confirmation now explains that registration already created the teacher account, links to https://faculty.telicampus.in/, and instructs login with the same registration email/password. Includes Continue to your teacher account. Frontend build passed.


### Profile Continue buttons — 2026-10-10
Personal, Qualifications, Experience and Preferences show Continue to advance sections without persisting; final Privacy section shows Save profile and retains consent confirmation. Frontend type-check and build passed.


### Profile missing-field validation and academic details — 2026-10-10
Profile submission lists missing location, primary subject, education qualification/institution/year and experience entry fields, opens first invalid section, and avoids anonymous browser required-field errors. API validation errors include field paths and entry numbers. Degree entries trigger optional Add PUC/12th and Add SSLC/10th actions, avoiding duplicates. Validation check and API/frontend build passed.


### Experience months and credit expiry — 2026-10-10
Added 0–11 experience months within personalDetails JSON (no database migration), exposed in reviewed candidate detail. Years can be cleared and normalize to zero on save. Commerce config returns only signed-in tenant's unexpired remaining grants; Account displays latest validity and next expiry for multiple packs, or no-active-credit explanation. API/frontend build passed.


### QR profession chooser — 2026-10-10
Public registration starts with Teacher (Register now), Pharmacist, Technician, Marketing / Sales and Electrician (Coming soon). Only Teacher opens the existing registration form; other options show Coming soon with Back to professions and create no account. Campaign code remains in URL. Updated REQUIREMENTS.md. Component browser checks passed for all options/back navigation; frontend build passed. No database or employer-flow change.


### Teacher registration back navigation — 2026-10-10
Back to professions added to teacher account form and profile steps. Account and profile drafts retained in memory while switching professions (not persisted across reload). Browser check verified back navigation and account draft retention; frontend build passed.


### Registration back-button position — 2026-10-10
Moved Back to professions into top header row, right-aligned opposite CampusFaculty. Frontend build passed.


### Mobile payment rows and pay-first guidance — 2026-10-10
Replaced mobile payment cards with standard rows, light blue visible column headers and View action. Horizontal scrolling confined to table; mobile filters compacted to two-column grid. Institution payment instructions explicitly require paying quoted amount before submitting UTR; approval still required. Layout checks passed at 360,390,720,1440px; frontend build passed.


### Feedback dialogs, signup and job requirements — 2026-10-10
Added dismissible error dialogs and Profile saved successfully confirmation. Receipt reference validation explains at least six characters and actual bank/UPI reference. Teacher signup hides institution field; institution signup requires it. Job title and View open Description & requirements. Frontend build and payment error dialog browser check passed.


### Hiring rows, contact popup and compact account — 2026-10-10
Hiring uses blue-header table rows; View opens hiring stage, actions, notes and interviews, plus candidate profile link. Contact access checked uses popup; fixed race by opening returned contact data after workspace reload. Account summary aligns institution name and credit/validity details on left. Frontend build passed.


### Application first-view tracking — 2026-10-10
Added nullable Application.firstViewedAt through migration 20261010120000_application_viewed. Employer full-profile view records only its specific application after unlock and authorization checks. Candidate list/details expose first view date. Build passed; component check covers locked versus unlocked view recording.


### Short application consent text — 2026-10-10
Removed long anonymous-qualification explanation. Checkbox reads Allow this employer to unlock my contact details, unchecked by default; helper says contact details stay hidden until authorized unlock. Existing consent rules unchanged. Frontend build passed.


### Audit page upgrade — 2026-10-10
New admin/audit endpoint with filters/count/server pagination and actor/institution labels; AuditLog frontend and details dialog. Additional key action logging; sensitive fields filtered. API/frontend builds passed. No schema migration required.


Audit follow-up: action filter includes failed authentication before its first occurrence. Unlock View shows institution and anonymous candidate reference, with credit usage on new events. Historical events without metadata are clearly labelled. Account creation and failed-login reason are recorded without credentials.

### Query indexes deployed � 2026-10-10
Added migration `20261010183000_query_indexes` with 44 targeted indexes: 35 B-tree indexes (including partial discoverability and setting-key prefix indexes) and 9 pg_trgm GIN indexes. Covers audit time/action/actor/reference, user institution/role, session expiry, verification throttling, candidate mobile/search, subscriptions and credit expiry/history, institution jobs, candidate applications/consent, hiring candidate lookups, notes/interviews/history, payment and purchase listings/fee checks, invoices and notifications. Existing primary/unique indexes retained. Ordinary indexes declared in Prisma schema; partial/operator-class indexes maintained in migration SQL.

Deployment scope: campusfaculty_db only. A private custom-format database backup was saved at `/tmp/ubuntu/campus-faculty/.deployment/db-before-query-indexes.dump`. Prisma initially rejected concurrent statements in its migration execution; no data changed. Corrected migration supports standard fresh/offline deployment. On this live deployment, SQL was executed through psql with each CREATE INDEX changed to CREATE INDEX CONCURRENTLY, as campusfaculty_owner, then migration was marked applied with Prisma migrate resolve. Migration status is up to date. For future live databases, use this individual concurrent-statement workflow, rather than feeding multiple concurrent statements to Prisma migrate deploy. Do not wrap concurrent builds in BEGIN/COMMIT. Failed builds must be inspected for invalid indexes before retrying.

Validation: Prisma schema validation passed; all 44 expected indexes exist and no public indexes are invalid/not ready. ANALYZE refreshed representative table statistics. Normal EXPLAIN prefers sequential scans on the current tiny audit table (20 rows); transaction-local enable_seqscan=off confirmed audit action/date, application candidate/date, candidate location trigram and notification user/date indexes are eligible. This is an index-coverage check, not a production-load benchmark; planner settings were rolled back. Audit indexes currently total 112 kB. API HTTPS health and all five app services passed; no service restarts or other app/database/config changes were required. Short/empty text searches and unrestricted counts can still scan rows; indexes do not eliminate every scan or application-level N+1 queries.

### Compact experience months field � 2026-10-10
Moved months into the Teaching summary grid beside years on desktop; capped its width at 220px for narrow layouts. Values and 0�11 validation are unchanged. Frontend build verified; frontend-only deployment.

### Account tab appearance � 2026-10-10
Account top navigation uses 14px semibold labels, light-blue rounded navigation background and a solid-blue active tab with white bold text. Mobile labels use 13px with horizontal overflow confined to navigation. Keyboard focus remains visible. Frontend-only update.

### Purchase history table � 2026-10-10
Replaced purchase cards with paginated rows: Date, Purchase, Amount, Credits, Status, Action. Shared light-blue payment header and contained horizontal scrolling on mobile. View opens individual order details, retaining payment instructions/UTR submission and role-restricted admin actions. Frontend-only change.

### Unavailable candidate reports and replacement credits � 2026-10-10
Institution: open an unlocked candidate profile and use Report unavailable. A reason of 10�500 characters is required; a report can only be made for that institution's existing unlock, once per unlock. Profile details show report status and review outcome.
Admin: Unavailable reports menu provides light-blue table headers, status filter, pagination and View. Review separately chooses Return 1 credit and Mark candidate not currently looking; leave both unchecked to reject. Review reason required. Replacement expiry is selectable 1�365 days, default 30. Paid debit is verified against original unlock, tenant and credit transaction; free unlocks cannot receive replacement credits. Candidate/tenant/report locks, pending-state recheck and unique ledger reference prevent simultaneous/duplicate awards. Exactly one credit goes to the reporting tenant; grant and credit history preserve original unlock linkage. Existing unlock stays recorded.
Teacher: Profile > Privacy > Job availability toggles Looking for a job / Not currently looking for a job. Not-looking candidates disappear from new search results and cannot be newly unlocked. Existing applications, hiring history and already-authorized contacts remain available. Teachers can resume searching without changing profile activation or employment status. Notifications and audit events cover review, credit replacement and availability updates.
Database migration 20261010200000_unavailable_reports adds Candidate.jobSeeking (defaults true), UnavailableReport with unique unlock, tenant/candidate foreign keys, status/date and tenant/date indexes, forced RLS. Runtime database wrapper includes this model. Back up campusfaculty_db before migrating; regenerate Prisma client before restarting this app only.
Validation: API/frontend builds and isolated marketplace integration suite passed, including cross-tenant report rejection, role checks, duplicate report prevention, free-unlock credit rejection, concurrent review (one success/one rejection), exactly one returned credit in the correct institution, search exclusion/new-unlock rejection, rejection without credit, teacher reactivation and audit entry.

Deployment successful: migration applied on campusfaculty_db, Prisma regenerated, frontend copied, only campusfaculty-api/campusfaculty-worker restarted. HTTPS health and authenticated admin report listing verified; other three app services active. Private rollback database backup: .deployment/db-before-unavailable-reports.dump; API/frontend rollback archives retained.

## Pharmacy release - 2026-10-11
Pharmacist enabled in campaign/QR profession selector and standard account signup. Existing Teacher flow remains; Nursing/Electrician/other professions remain Coming soon. One professional profile per candidate account in this release; an existing signed-in teacher choosing pharmacy is directed back to their saved profession without overwriting it. Multi-profile candidate accounts remain future work.
Pharmacy profile includes D.Pharm/B.Pharm/M.Pharm/Pharm.D/Other, multiple education entries and highest qualification, college/year/result, personal details, experience years/months, declared registration Yes/No/Pending with private council/number, full-time/part-time/both, optional monthly expected pay, current place, multiple preferred places, availability and consent. Percentage validation 0-100. Registration is self-declared, never labelled independently Verified; no document upload/verification or certificate-rental feature in this release.
Employer preferences Teachers/Pharmacists/both set at signup or Account > Edit institution. Medical shop/Hospital organization types added. Backend enforces profession scope for new search, details without existing authorized history, sourcing, contact unlock and job posting/applications. Existing applications/unlocks/hiring records remain available after preference changes. Job posting profession choices follow employer preferences; candidate job search/application matches their profession. Credits/unavailable reports/audit continue to work across professions without pricing changes.
Candidate results use standard light-blue table header, View details, degree/result/place, work/declared registration, optional pay and distance. Contact and registration number/council are protected until existing authorization and unlock checks pass. Pharmacy registration declarations are visible separately from professional qualification.
Location catalog: 31,397 Karnataka populated places from GeoNames plus two verified OpenStreetMap village points (Zalki/Jhalaki and Ballolli). GeoNames source https://download.geonames.org/export/dump/IN.zip and admin1/admin2 code files; attribution https://www.geonames.org/about.html (CC BY). OSM attribution https://www.openstreetmap.org/copyright (ODbL). Chadchan/Chadachan and Bijapur/Vijayapura aliases supported. Catalog is stored locally in GeoPlace; user searches are not sent to third-party geocoders. Town-level coordinates only; no exact home addresses in proximity calculations. Current-place and preferred-place matching are distinct. 25/50/100 km radius, nearest-first Haversine straight-line distances, stable ID tie-break, unknown coordinates excluded from proximity but text-place search retained. No road-distance claim; Karnataka coverage is stated in UI. Places outside catalog can be entered as text without fabricated coordinates. Do not hard-code example village order.
Migration 20261011090000_pharmacy adds profession defaults preserving all existing teachers/jobs, employer recruitment preferences defaulting to Teacher, pharmacy metadata/location IDs, GeoPlace catalog and targeted indexes. Import with deploy/import-places.cjs under private migration credentials after Prisma regeneration; createMany skipDuplicates makes repeat imports safe. Preserve runtime isolation and database backup before deployment.
Validation: full isolated integration suite passed, including existing financial/privacy tests, pharmacy creation/marks validation, teacher-only/pharma-only/both preferences, private registration visibility, selected-profession authorization, deterministic nearby/preferred-location matches and job profession isolation. Test-only migration copies qualify the installed pg_trgm operator-class namespace without changing applied production migrations. Mocked Chrome mobile check passed QR pharmacist selection/account payload, profile rendering, registration/work fields and D.Pharm qualification choice; screenshot .local/pharmacy-mobile.png inspected.

Deployment successful: Pharmacy released at https://faculty.telicampus.in/. Migration 20261011090000_pharmacy applied to campusfaculty_db, Prisma regenerated and 31,399 place records imported. API/frontend backups and private PostgreSQL dump retained at /tmp/ubuntu/campus-faculty/.deployment/pharmacy-backup-20261010-191115 (server timestamp). Only campusfaculty-api and campusfaculty-worker restarted; all five application services confirmed active. Live HTTPS root, API health, Zalki and Ballolli place searches returned 200. No other application, database or nginx configuration was changed. Employers enable Pharmacists in Account > Edit institution; candidates choose Pharmacist in registration or the campaign QR profession chooser. Nursing remains Coming soon.

## Teacher UI restoration - 2026-10-11
Teacher-only institutions retain the pre-Pharmacy candidate screen: Subject, Degree and Place filters; Candidate ID, Subject, Degree, Place, Experience, Mobile and Action columns; original degree options, locked contact display, View and pagination. Pharmacy proximity/registration/pay controls are not shown in this screen. Teacher profile retains the plain current-location field, school consent wording and teacher workspace headings; profession metadata is hidden for teacher details. Pharmacy and multi-profession employers retain their separate extended search UI. Browser regression verified all seven original columns and no pharmacy controls; pharmacist QR/mobile form regression also passed. Frontend build passed. This correction changes no database schema, API, teacher data, payments or authorization rules.

Candidates navigation optimization: removed serial feature/pricing requests from candidate loading and reused the institution profile fetched at login. Mutation clears the profile cache. Teacher layout unchanged. Build and browser regression passed with unrelated settings deliberately delayed 2.5 seconds; candidate results appeared before that delay. Frontend-only release.

Public entry layout refreshed: brand grouped with introduction, compact two-column signup fields, blue headline accent and softer gradient/card. Both candidate and employer signup verified at 1360x600 without vertical scrolling; 390px mobile verified without horizontal overflow. Auth controls and authorization unchanged. Frontend-only update.
