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

Owner mobile home compact menu: three columns, 96px cards, 34px icon containers with 20px icons; smaller labels and no repeated Open-menu subtitle. Scoped to admin home only. Build passed; all nine modules verified without vertical or horizontal scrolling at 390x844, 360x640 and 320x568. Frontend-only release.

Pharmacy Description update: optional 500-character description stored in existing pharmacyDetails JSON, validated by profile PATCH and shared in pharmacySummary. Description beside Skills (stacked on mobile), displayed in employer table replacing Distance and in candidate View. Removed pharmacy Candidates heading; pharmacy preferences wording corrected. Teacher fields/table unchanged. API/frontend builds and mobile Description input check passed. No database migration required.

## Nursing release - 2026-10-11
Nurse enabled in QR profession chooser and standard signup; dedicated nursingDetails JSON and NU profile IDs. Qualifications: ANM, GNM / Diploma Nursing, B.Sc Nursing, Post Basic B.Sc Nursing, M.Sc Nursing and Other. Personal details, years/months experience, declared registration with protected council/number, department/specialty, full-time/part-time/both, night shift Yes/No/Open to discussion, expected pay, current/preferred catalog places, skills/description and availability/consent. Nurses only; no caregiver/aide category added. Registration is self-declared, not independently verified.
Employer preferences support Teachers/Pharmacists/Nurses, any combination. Nursing search and jobs enforce selected profession; candidate jobs/application match their own profession. Table shows Nursing work/registration, description and night-shift column when employer recruits Nurses. Private council/number returned only after authorized unlock. Existing teacher-only screen unchanged.
Migration 20261011130000_nursing adds nursingDetails JSON default {} only, preserving teacher/pharmacy records. Back up dedicated DB/API/frontend, migrate and regenerate Prisma before restarting only CampusFaculty services. Full isolated financial/privacy integration suite passed with Nursing creation, night-shift validation, directory description, protected registration, teacher employer denial and nursing job isolation. Mobile QR Nursing form passed diploma, department, night shift and Description checks.

Nursing deployment successful: migration applied to campusfaculty_db, Prisma regenerated and live health/assets verified. Backup: /tmp/ubuntu/campus-faculty/.deployment/nursing-backup-20261011-093508. Only CampusFaculty services restarted; all five app services active. Teacher and pharmacy browser regressions passed.

Institutions/Find Jobs navigation performance: direct page-data requests bypass unrelated pricing/settings waits. New admin/institutions endpoint batches tenants, institution profiles and owners (three queries) instead of full overview and per-tenant queries. Contact display and admin role checks retained. API/frontend builds, isolated integration suite and delayed-settings browser checks for both pages passed. No schema changes.

## Separate profession credit packs - 2026-10-11
Teacher settings remain simple_pricing and all pre-existing grants/transactions/subscription allocations default TEACHER without changing amounts, remaining balance or expiry. PHARMACIST and NURSE use separate credit_pricing settings with pack price/unlocks/validity/unlock-paid flag, initialized from current Teacher pack terms. Teacher profile/application/job fees and legacy subscriptions remain unchanged; this release separates contact-credit packs only.
Owner Fees & unlock packs: choose Credit profession to configure Pharmacy or Nursing. Employers choose their selected recruitment profession when purchasing. Purchase snapshot permanently records profession/price/credits/validity; approval creates only that profession's grant. Account shows separate balances, profession-specific expiry, labelled purchase/payment/history and Pharmacy/Nursing pack receipts. Nonselected-profession purchases rejected. Candidate unlock consumes only matching profession's unexpired grant. Existing authorized unlocks retained and never charged twice. Replacement credits retain the original debit profession. No cross-profession transfer; old quotes/grants remain Teacher.
Migration 20261011150000_profession_credits adds profession columns default TEACHER to grants/ledger plus tenant/profession/expiry index and independent settings. Deploy only after dedicated DB/API/frontend backups, migration and Prisma regeneration. API/frontend builds and isolated suite passed Teacher legacy checks, separate prices/snapshots/grants/invoices, Pharmacy-credit rejection for nurse unlock, balances after both unlocks, repeated unlock no debit and Nursing-only replacement. Live TEST employers 001 only will receive 5 credits each; one sample unlock leaves 4 each. No real employer credit changes.

Deployment verified: backup /tmp/ubuntu/campus-faculty/.deployment/profession-credit-backup-20261011-101258. Legacy Teacher grants preserved (2 grants, 4 remaining, 6 allocated) before/after migration and live tests. TEST-PHARMACY-EMPLOYER-001 received 5 Pharmacy credits; TEST-NURSING-EMPLOYER-001 received 5 Nursing credits. Actual API unlock charged 1 each; repeat 0; remaining 4 each. Temporary test sessions removed and original disabled-login/unverified-employer status restored. All five app services active. Owner Plans pricing selector/save browser check passed.

## Job seeker account-created popup - 2026-10-15
After successful new candidate signup, Teacher, Pharmacist and Nurse see an account-created dialog with matching profession wording. Complete profile opens the existing profile at Personal details (including mobile, bypassing the menu hub); Later opens Home. Existing logins, session reloads and employer signup do not trigger this popup. Standard signup and QR registration share the accessible two-button dialog, keyboard focus and Escape/Later behavior. QR Later returns to the app home using the already-created account. No account/profile data, fields, credits or approval rules changed.
Frontend build passed. Mobile browser checks passed Complete profile/Later for all three professions plus absence on returning sessions. Pharmacy and Nursing QR/profile regression checks passed. Frontend-only release; no database or API change required.

## Owner employer-type filter - 2026-10-15
Institutions page has Employer type filter and Type column, combined with existing search/status and Reset. Options All, School, College / Institute, Medical shop / Pharmacy, Hospital, Medical college, Clinic, Other, Not specified. Group display only: legacy College/University/Coaching map to College / Institute; Medical shop maps to Medical shop / Pharmacy; blank values show Not specified. Saved employer records are not rewritten. Editing profile supports Medical college and Clinic as new allowed values. Recruiting profession and all credit/access rules unchanged. Pagination resets when type changes. Compact desktop row and responsive mobile filters. No database migration required.

Validation passed: API/frontend builds; browser checks for Hospital, Medical shop, legacy University grouping, Not specified, combined type/status, Reset and mobile width.

## Gmail email-code password recovery - 2026-10-16
Sender selected: telicampuserp@gmail.com. Sign-in Forgot password opens registered email -> six-digit email code + new/confirm password -> sign in. Covers active Teacher, Pharmacist, Nurse job seekers and tenant-admin/recruiter employers; privileged platform/Owner accounts are excluded from this public recovery flow. No username/mobile-only reset. No email provider credentials or passwords in source or logs.
Dedicated PasswordResetChallenge storage: opaque token hash, HMAC code keyed by private PASSWORD_RESET_SECRET, email/IP keys, 10-minute expiry, five attempts, single use, resend invalidates prior code, 60-second cooldown, five requests/email/hour and 30/IP/hour. Asynchronous email avoids exposing account existence through SMTP timing. Unknown/inactive/privileged accounts return the same generic message without sending. Delivery failure invalidates challenge. Reset verifies current account/email/password version, atomically consumes code, hashes new password, removes all existing sessions and writes AUTH_PASSWORD_RESET audit. Worker removes challenges expired more than seven days ago. Local reverse proxy only trusted for client IP, preserving per-client throttling behind nginx.
Gmail transport uses smtp.gmail.com:465 TLS with App Password; both 465/587 connectivity verified from dedicated server. Production requires PASSWORD_RESET_ENABLED=true, GMAIL_USER, GMAIL_APP_PASSWORD and >=32-character random PASSWORD_RESET_SECRET. Deployment keeps disabled until private credentials are configured. Never use a normal Gmail password or paste an App Password into chat.
Activation: run python3 /tmp/ubuntu/campus-faculty/deploy/configure-gmail.py in an interactive SSH terminal. It prompts with hidden input for Gmail's 16-letter App Password, verifies authentication before editing .deployment/runtime.env, preserves/generates the reset secret, writes private mode 0600, and restarts only campusfaculty-api. It does not send mail as part of credential validation. Enable Google 2-Step Verification and generate an App Password first: https://support.google.com/accounts/answer/185833 . After activation, test recovery using an account you own. Current SMTP verification routes remain separate.
Migration 20261015190000_password_recovery adds the dedicated table/indexes; no profile/payment/credit changes. Back up dedicated DB/API/frontend before deployment; install locked Nodemailer dependency, migrate and regenerate Prisma. Isolated local-SMTP recovery test passed all eligible roles, no account disclosure, wrong-code attempt persistence, expiry, five-attempt limit, concurrent single-use reset, resend invalidation, mismatched passwords, delivery failure and session revocation; existing marketplace integration suite also passed. Live Gmail delivery remains pending credentials and inbox verification.

Browser recovery validation passed: code form, password mismatch, resend cooldown, success/back navigation and disabled-email state on mobile. Both API/frontend builds passed.

Deployment verified: Gmail recovery UI/API and migration are deployed. Sending remains disabled until the Gmail App Password is entered using deploy/configure-gmail.py. Backup: /tmp/ubuntu/campus-faculty/.deployment/gmail-recovery-backup-20261015-183546. HTTPS assets/health/recovery config returned 200; enabled=false verified. All five app services active. No real emails sent or existing passwords changed.

## Published job editing, salary range and job-detail contrast - 2026-10-16
Employer Jobs has Edit beside View for published jobs across Teacher/Pharmacy/Nursing. Existing values prefilled; editable title, subject/role, location, minimum/maximum monthly salary, description and closing date. Profession immutable; request rejects extra profession/status fields. Only owning tenant can edit; closed jobs rejected. Future closing date and max>=min validated. Edit and close serialized with tenant lock. Edit does not consume posting fees or quota and preserves job ID/applications; JOB_UPDATED audited.
Migration 20261016100000_job_edit_salary_range adds nullable salaryMax with DB range constraint. Existing salary retained as minimum/fixed amount; null maximum displays fixed salary. New/edit form uses explicit min/max, equal amounts mean fixed. Employer list, candidate Find Jobs and job detail summary render ranges. Description and summary text in job View/application dialogs use darker readable colors; forms otherwise unchanged.
API/frontend builds and isolated marketplace integration passed: all three professions edited, same profession, preserved application count/no posting orders, cross-tenant/candidate denial, invalid range/past date/profession mutation rejected, closed-job rejected. Chrome checked prefilled legacy salary, PATCH range payload, save success and dark description computed color. Dedicated DB/API/frontend backup required before migration/deployment; regenerate Prisma and restart only CampusFaculty services.

Salary display correction: saved min/max values were correct, but legacy rendering still used minimum only. Replaced all five job salary displays with shared range formatter. Browser assertions passed employer list/View and candidate Find Jobs/View. Frontend-only correction; no salary data changed.

## Candidate current and preferred work places - 2026-10-16
Employer candidate tables for Teacher, Pharmacy and Nursing show Current place plus Preferred work places. Reviewed anonymous summaries include saved preferredLocations (no contact fields). UI trims/deduplicates, shows first two names and +N more button opening keyboard-accessible full-list popup; missing preferences show Not specified without inferring Any location/current place. Candidate View also shows preferred work places. Existing place search/filter semantics unchanged. No schema/data changes. API/frontend builds and browser columns/popup/mobile-width checks passed.

Insufficient unlock credit UI: clicking Unlock contact checks current candidate access, profession pricing and available profession balance. Zero matching credits shows Not enough credits with 1 Teacher/Pharmacy/Nursing credit requirement, balance, Buy credits and Cancel. Buy credits opens Account Overview with that profession selected. Existing authorized/free unlocks bypass credit warning. Actual unlock remains enforced by API; depletion between check and confirmation switches to the no-credit message. No schema, balance, fee or permission changes.

Validation: frontend build passed; Chrome verified zero-credit message/profession wording and Buy credits preselection for Teacher, Pharmacy and Nursing, plus positive-balance normal confirmation.

Credit popup text encoding fix: malformed apostrophe replaced with ASCII wording (contact details for this candidate), component saved UTF-8. Frontend build and all-profession popup/navigation browser checks passed with no replacement characters.

## Candidates profession filtering and navigation - 2026-10-16
Owner Candidates adds profession filter/column (Teacher, Pharmacist, Nurse), combined with name/place/status; Reset clears profession and pagination resets on change. Employer multi-profession candidate search refreshes immediately on profession selection and clears incompatible degree. Single-profession employers default to their selected profession; teacher-only UI unchanged. Removed Nearby results explanatory paragraph as requested; attribution and location filters retained.
Candidates reuses institution profile already loaded by parent instead of fetching it twice, and guards against stale search responses. Owner Candidates and employer Jobs request page data directly without serial pricing/settings requests. No API/schema/credit/profile data changes.

Validation passed: frontend build; Chrome immediate employer profession filtering, one profile request, removed Nearby paragraph, Jobs unaffected by delayed settings; Owner profession filter and Reset across all three professions.


## General Jobs recruitment track - 2026-10-19
New signup and campaign tiles offer General Jobs, Pharmacy and Nursing. Teacher signup tile is hidden; existing Teacher backend, UI, jobs, profiles, applications, fees and credits remain available to existing accounts. No Teacher records are converted. General accounts cannot apply to legacy Teacher vacancies.
General candidates select multiple work interests: Teaching/Education, Banking, Accounts/Finance, Sales/Marketing, Retail/Showroom, Office/Back Office, Customer Support, IT/Computer Support, Technician/Maintenance, Electrical, Logistics/Delivery, Hospitality and Other. Category-specific optional fields appear as selected; teaching interests expose teaching fields. Candidates keep one profile with multiple education entries and current/preferred work locations.
Employers choose General at registration and their hiring categories, then choose a work category per vacancy. General posting supports accepted qualifications (OR), additional mandatory qualifications (AND), Any graduate and minimum experience. Completed education entries determine eligibility; a degree is self-declared, not document verification. Server checks eligibility before application or purchasing an application fee. B.Com with B.Ed can apply to a teaching vacancy requiring both; B.Com alone cannot. Degree and Subject/specialization filters combine with work category, location and existing filters. Candidate job discovery offers work-interest matches or all General jobs; interests do not replace eligibility.
Owner: General Jobs Settings independently controls registration/posting availability, profile review, profile/application/posting fees, unlock charging, pack price, pack credits, validity, qualifications, categories and extra posting/profile field labels. Category IDs are stable; deactivate instead of deleting. Default General profile/application/posting fees are zero; contact pack is Rs.200 for 5 credits valid 365 days. General credits and fee orders are isolated from Teacher/Pharmacy/Nursing. The legacy subscription switch does not require a subscription for General-only posting/search/applications. Global feature flags still apply.
Additive migration 20261019110000_general_jobs adds General categories, interests/details, job category/requirements and search indexes. Seeder deploy/seed-test-general.cjs idempotently adds six TEST General candidates, three TEST employers and three TEST vacancies (teaching, banking/accounts and showroom). Fictional example.invalid accounts have disabled login, no real phone and no real notifications; employer verification remains pending. Does not change existing records or grant live credits.
Validation: API/web builds, isolated marketplace integration including existing three professions, General eligibility unit tests, Chrome QR signup/profile/mobile/preferences/qualification checks, employer posting payload and Owner settings save. Back up the database, API and frontend before deployment, run migration and regenerate Prisma; restart CampusFaculty API/worker only.

Deployment verified 2026-10-19: backup /tmp/ubuntu/campus-faculty/.deployment/general-backup-20261019-080533. Migration applied and Prisma regenerated; TEST seeder created exactly 6 candidates / 3 employers / 3 vacancies. Legacy Tenant/Candidate/Job/Application/CreditGrant/CreditTransaction snapshots matched before/after (new General records excluded). Only CampusFaculty API/worker restarted. All four remaining application services active; garment and jobs endpoints returned 200. Final HTTPS assets index-DLworDse.js / index-DAYW6XLx.css, health and 13-category General config verified; Owner authentication and General candidate filter verified. Gmail password recovery remained enabled. BuildSphere remains retired.

## Compact degree and subject filters - 2026-10-19
Degree is first in employer candidate and General job filters. Subject uses a common-subject dropdown augmented with returned record subjects. General job filters use a compact four-column desktop/two-column mobile grid with small Reset. Employer mobile candidate filters wrap into two columns. D.El.Ed and B.El.Ed removed from available General choices and legacy candidate filter choices, without changing stored education/job requirements. Existing saved values remain available when editing.

## Neutral registration URL - 2026-10-20
/registration is the canonical job seeker registration route. The legacy /teacher-registration (including trailing slash) replaces the browser URL with /registration, preserving the full query string and hash without an extra page load. Existing printed campaign QR codes remain valid. Owner campaign links and generated/downloadable QR images now use /registration?campaign=CODE. Registration profession, campaign attribution and account/profile behavior remain unchanged. Frontend-only change.

Registration header alignment - 2026-10-20: navigation row max-width matches the 650px account form, bringing Back to professions to the form's right edge. CampusFaculty registration brand uses explicit blue, bold type. Mobile sizes stay compact. No brand rename, registration logic or data change.

## TeliCareers branding - 2026-10-20
Visible CampusFaculty brand changed to TeliCareers in signup/registration/workspace/navigation/footer, browser title, PWA manifest/offline page, recovery email sender/subject/body, invoice PDF header and health display name. Existing domain, QR routes, API identifiers, cookies, service/database names and stored accounts remain unchanged. No database migration. New installations seed a TeliCareers Owner name; existing stored user names remain unchanged.

Profile guidance - 2026-10-20: role guidance help popup with fresher/experienced examples; validation errors also open feedback popup and switch to affected tab. General role label clarified. Selecting Fresher resets years/months to zero and disables counters; empty work history needs no entries, existing history is preserved. SSLC/10th/SSC education labels School/board and Medium of instruction; other qualifications use Stream/specialization. Existing stream values retained; no schema or data migration.

Registration profile header refinement - 2026-10-20: account signup retains 650px header alignment; once a profile is loaded, header expands to the profile panel width so Back to professions sits at its right edge. Mobile remains within viewport. CSS/class-only frontend change.

Stable registration heading - 2026-10-20: public registration always shows Professional registration; asynchronous campaign loading no longer replaces it with internal campaign names. Campaign validity checks and signup attribution remain unchanged. Delayed-load/mobile refresh check added.

Application consent reminder - 2026-10-20: unchecked application consent opens explicit Allow & apply / Apply without contact access / Cancel dialog. No application is posted until a choice is made. Checked consent submits as before. Profile consent remains separate; reminder does not bypass employer verification, authorized unlock or API contact checks.

Profile save clarity / salary - 2026-10-20: Teacher employer directory now includes expected monthly salary from saved candidate.salary. Profile editor explicitly explains Continue is navigation only; Privacy Save profile and consent confirmation persist all sections. General category extra details marked optional with examples. Investigated screenshot legacy row TCC846A79E78: revision 1, no saved education, Not specified place/degree, salary 0. No candidate records altered or inferred from screenshots.

## Owner cash / complimentary credits - 2026-10-20
Owner Payments -> Record cash payment / add credits. Choose active employer, its recruiting profession, pack count, cash receipt/adjustment reference, date and optional note (required for complimentary). Review shows employer, profession, exact current pack price, credit count and validity; confirm is the only write. Price changes require a refreshed quote. Cash amount equals selected pack total; negotiated discounts are not silently inferred.
SUPER_ADMIN-only POST admin/cash-credits atomically records approved pack order, profession-specific grant/ledger transaction, audit and employer notification. Cash also creates downloadable invoice/receipt with Cash method, payment date and reference. Employer Purchases and Credit History expose records; complimentary records show zero payment and create no invoice. Validity starts when allocated; payment date is historical. Unverified employers may receive credits but still must pass existing verification/consent checks to unlock contacts. Blocked employers and professions not recruited are rejected. Cash/adjustment reference is unique case-insensitively across employers and allocation modes. Retry/concurrent duplicate cannot allocate twice.
Migration 20261020090000_complimentary_credit_orders preserves positive-payment constraint, adding only an explicit approved UNLOCK_PACK + COMPLIMENTARY zero-amount exception. Database/API/frontend backup required before migration; no existing balances or payment records altered. Test only in isolated database; do not create real cash payments or grants for verification.

Cash-credit deployment verified 2026-10-20. Backup: /tmp/ubuntu/campus-faculty/.deployment/cash-credits-backup-20261020-092131. Migration applied; API/frontend builds, isolated integration (all professions, race/duplicate, stale quote, role checks, cash PDF access, zero ordinary order rejection) and Chrome Owner cash/complimentary review flows passed. Existing financial/credit and profile records matched before/after snapshots. Live Owner institutions/config/history and anonymous denial verified; no real payments or grants created. CampusFaculty API/worker restarted only; other applications remain healthy.

Current-role / pending-review / compact employer categories - 2026-10-20: employment Currently working exposes optional Current job role (e.g. Accountant), separate from desired role/subject. Saved via existing personalDetails JSON and public-text validation. Reviewed General summaries expose current role without contact info; employer role search matches it case-insensitively. General highest education result now included in anonymous summary. Profile pending-review banner explains employer search availability. Existing GN50B2409F72 was saved as M.Com, salary 15000, active/visible/consented, review pending; no live moderation or profile changes performed. Employer categories become an expandable full-width selector with bounded scroll, preserving checkbox selections/hidden form payload. No schema migration.

General settings section menu - 2026-10-20: desktop General / Fees & Credits / Qualifications / Work Categories navigation; mobile section dropdown. One draft spans sections and one sticky Save persists the complete configuration. Fee fields compact; category editors collapsed in bounded list. No API, settings values, credits or schema changed by deployment.

## Profession auto approval / sidebar scroll - 2026-10-20
Owner Settings -> Profile Approval has independent Teacher, General Jobs, Pharmacy and Nursing switches. General switch is a virtual view of general_jobs.approvalRequired (inverse); both settings pages share one source. Enabling approves only saved/activated active profiles of that profession, including pending ones. Disabling preserves approved profiles and requires manual approval for future saves. Auto approval is after fee checks; it never changes directory consent, employer verification or unlock requirements. Unsaved accounts remain pending. Teacher flag no longer controls Pharmacy/Nursing or bulk-approves other professions. Changes audited with profession and count. Desktop sidebar navigation scrolls within viewport with accessible logout. Deployment changes no flag values or profile approval statuses by itself.

Approval card layout / active navigation - 2026-10-20: remove duplicate Profile Approval content heading while retaining section tab; override legacy first-card two-row span for an even 2x2 desktop approval grid and one-column mobile layout. Active sidebar/settings/profile tabs use solid blue with white text. No approval settings or behavior changed.

Owner UI / tab request optimization - 2026-10-20: global action success uses feedback popup instead of a layout-shifting top banner. Owner candidate/institution/payment filters align with small Reset on desktop; responsive 2-column mobile layout. Institution name/ID search capped 280px. Cash allocation form uses compact 3-column desktop/2-column mobile layout and short note area.
Measured before optimization from cloud HTTPS median of 3: features 16.6ms, commerce/config 19.7ms, admin/overview 28.8ms, admin/institutions 18.9ms, admin/candidates 18.5ms, orders 20.7ms, audit 22.8ms. These are server-side network timings, not end-user latency. Required query indexes already present (primary/tenant-role/status/date/search indexes). Avoid extra indexes without evidence: no schema migration. Bottleneck found in frontend serial features+pricing followed by full overview on unrelated tabs, plus per-tenant owner/profile queries in overview. Owner Settings/Payments now request small dedicated views; self-loading tabs mount without parent overview request. Overview batches institution data and runs independent reads concurrently. Auth/roles/RLS retained; no business data changes.

Clean-reset employer signup fix: missing simple_pricing now resolves to default credit-pack configuration, consistent with commerce/config. Explicit enabled=false still selects legacy subscription mode. A clean database no longer needs Starter plan for employer registration; zero grants/subscriptions created in credit-pack mode. No stored settings or deleted records restored.
