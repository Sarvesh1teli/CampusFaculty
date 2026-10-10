# CampusFaculty

Standalone React/TypeScript/Vite PWA and NestJS/Prisma/PostgreSQL application. Requirements are in REQUIREMENTS.md. Manual UPI is the default; no Razorpay credentials are required.

## Local development

Node 22.17+ and PostgreSQL 16+. Run npm install. Configure apps/api/.env with DATABASE_URL (restricted runtime), MIGRATION_DATABASE_URL (migration owner) and a strong SEED_ADMIN_PASSWORD. Run npm run db:generate from the root. From apps/api run node ../../node_modules/prisma/build/index.js migrate deploy, then from the root run npm run db:seed. Run npm run dev:api and npm run dev:web in separate terminals. Run npm run worker -w apps/api for expiry and renewal notifications. Open http://localhost:5182.

An isolated local PostgreSQL instance may be available in .local/postgres on port 55432. This is separate from any existing school ERP database. Local owner credentials are in apps/api/.env and must not be committed.

Register teachers and institutions through the UI. Sign in as the seeded owner to verify institutions. Collections are disabled until a real UPI ID, payee and matching deployment QR are configured. Put the QR in apps/web/public/assets/upi-qr.png, then configure /assets/upi-qr.png under Super Admin Settings. Do not enable collections without verifying the destination and bank/app suitability. No candidate file upload routes exist.

Schools select a plan under Account, pay externally, submit the reference, and await receipt verification. Approvals allocate credits atomically. Pending UTRs do not grant entitlements. Never use unverified references to approve payments.

## Verification providers

Set EMAIL_VERIFICATION_URL/KEY and SMS_VERIFICATION_URL/KEY to your own HTTPS provider adapter. The adapter receives POST JSON {destination,code,template} with Bearer authentication. Codes expire in 10 minutes with five attempts. No codes or secrets are returned to clients. Provider setup and real delivery verification remain required before public launch.

## Tests

npm test runs policy checks; npm run build compiles both apps. Integration tests create a dedicated random schema inside the isolated local database and use the non-superuser runtime role; run npm run db:runtime -w apps/api first. They require local migration credentials and exercise payment idempotency, consent and tenant isolation. Do not run destructive test setup against production.

## Deployment

Compose runs a private PostgreSQL service, API, worker and Nginx frontend on localhost:8080. Set POSTGRES_PASSWORD, WEB_ORIGIN, DATABASE_URL and MIGRATION_DATABASE_URL in an untracked root .env. Create a separate non-superuser runtime role and grant access after migration; do not use the owner URL for the running API. Run migrations and seed deliberately before traffic. Terminate HTTPS with host Nginx and automated certificate renewal; do not expose the internal API or PostgreSQL publicly. Container images target standard Linux and must be validated on the selected OCI ARM64 shape.

Production launch requires off-VM encrypted backups/restore testing, legal retention/invoice configuration, verification providers, TLS, monitoring and tenant-isolation review. The generated invoice is currently a payment receipt with an explicit tax-configuration notice, not a finalized statutory tax invoice.

Run production migrations with docker compose --profile tools run --rm migrate. Owner database credentials belong only to that one-off service, not the running API/worker. Paid upgrades from a lower-priced active plan start at approval; same-plan renewals queue after the current term. Expired-job and reapplication policies can be configured in Super Admin Settings.

## Simple pricing (v1.6)

Super Admin → Plans configures profile activation, application and job posting fees (₹0 = free), paid/free contact unlocks, pack price/count and validity. Defaults: free features, free search, ₹200 for 5 unlock credits valid 365 days. Institution Account buys packs by quantity. Teacher Payments buys applicable fees. Super Admin → Payments reviews purchases and can discount an unpaid quote before UTR submission. Legacy plans/purchases are retained; new enrollments use the simple model. Unused application fees for closed jobs require actual external reimbursement; Super Admin can record the completed refund with its reference and reason. Tax-compliant PDF receipts for new purchase types remain a launch follow-up.


### Campaign QR registration

Super Admin → Campaigns → New campaign: enter a name and unique code, then use QR / View to download the PNG and copy the registration link. Statistics distinguish created accounts from submitted/activated profiles. Deactivation prevents new signups while retaining prior profiles and source history. Campaign signup does not create a job application.

Public route: /teacher-registration?campaign=YOUR-CODE. It creates a teacher account, then reuses the existing profile sections and explicit directory consent. Existing account email/mobile must sign in instead. Approval, activation fees and contact privacy continue to apply.

For cloud builds, set VITE_PUBLIC_URL to the permanent HTTPS frontend domain (for example https://campusfaculty.example). The campaign QR defaults to the current browser origin for local preview; localhost QR codes are not suitable for printed public campaigns. Set WEB_ORIGIN consistently on the backend. No private data is encoded in the QR.

### Selected CampusFaculty domain

The shared teacher/institution/admin login is https://faculty.telicampus.in/. Public teacher signup is https://faculty.telicampus.in/teacher-registration; campaign links append ?campaign=CODE. Both routes use the same application and database. Cloud frontend builds and Compose default to this domain; local development remains http://localhost:5182. Nginx SPA fallback serves the public registration route. Use deploy/cloud.env.example for deployment settings and provision TLS for faculty.telicampus.in before enabling the host Nginx configuration. These repository settings do not deploy or configure DNS.

## Live cloud deployment

Deployed on 2026-10-09 at https://faculty.telicampus.in/ with dedicated PostgreSQL database, API/worker services and HTTPS Nginx site. See deploy/RUNBOOK.md for verified results, private credentials location, maintenance steps and pending backup/login verification.

