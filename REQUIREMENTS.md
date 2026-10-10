# CampusFaculty — Requirements v1.6

Date: 08-Oct-2026; updated 09-Oct-2026 for configurable fees and standard unlock packs  
Status: Approved product baseline for MVP; production infrastructure and legal validation remain launch gates.

This document consolidates v1.4 and the approved v1.6 decisions directly into the relevant sections. It replaces the earlier requirements and correction appendix for implementation. The supplied screenshot is visual inspiration, not an exact layout specification. CampusFaculty is the working name; domain and trademark availability remain unverified.

## 1. Product scope

CampusFaculty connects teachers, lecturers, professors and non-teaching staff with schools, colleges, coaching institutes and other educational institutions.

Two independent recruitment paths are enabled by default:

1. Teachers find published jobs and submit applications.
2. Verified institutions search an anonymous candidate directory and add sourced candidates to their own hiring pipeline.

An application never reveals contact details or consumes unlock credits. The first authorized contact unlock costs one credit per institution/candidate pair. All active recruiters within that institution share the unlock; another institution must unlock independently.

Teacher profile activation and job applications default to free. Super Admin can set each fee to a configurable INR amount. No candidate photos, resumes, certificates, attachments or user file uploads/downloads are supported. Authorized users may download system-generated invoice PDFs as the sole document-download exception.

## 2. Selected architecture and technology

| Component       | Selected requirement                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| Frontend        | React + TypeScript + Vite                                                                                 |
| UI              | Tailwind CSS + shadcn/ui                                                                                  |
| Mobile          | Responsive, optionally installable PWA using vite-plugin-pwa                                              |
| Backend         | Node.js LTS + NestJS + TypeScript; modular monolith                                                       |
| API             | REST over HTTPS with OpenAPI documentation                                                                |
| Database        | PostgreSQL + Prisma migrations and ORM                                                                    |
| Authentication  | Server-managed sessions; Secure, HttpOnly, SameSite cookies; CSRF protection                              |
| Hosting         | Eligible Oracle Cloud Always Free compute                                                                 |
| Web server      | Nginx with HTTPS and automated certificate renewal                                                        |
| Payments        | Manual UPI with Super Admin approval; INR at launch. Razorpay disabled initially and supported in Phase 2 |
| Notifications   | Persisted in-app notifications with polling                                                               |
| Verification    | Separate external email/SMS services for verification and authentication                                  |
| Background work | PostgreSQL-backed durable tasks and a basic scheduled worker                                              |
| Deployment      | Docker Compose with API, worker and private PostgreSQL services                                           |

Redis, advanced queue infrastructure, dedicated API gateways, microservices and WebSockets are not initial release requirements. Operational email/SMS for verification does not enable recruitment or renewal messaging through those channels.

```text
Browser / PWA → HTTPS / Nginx → NestJS API
                                  │
                         PostgreSQL + worker
                                  │
                         Encrypted off-VM backup

External services at launch: verification email/SMS. UPI transfers occur in the payer's payment app; CampusFaculty does not automatically verify receipt.
```

## 3. Roles and tenant isolation

| Role                | Scope and permissions                                                                |
| ------------------- | ------------------------------------------------------------------------------------ |
| Super Admin         | Platform settings, workflow flags, policies, privileged audit and emergency controls |
| Platform Admin      | Institution verification, candidate moderation, plans, payments and platform reports |
| Tenant Admin        | Institution profile, team, subscription, credits, jobs and hiring                    |
| Recruiter           | Authorized institution candidate search, unlocks, jobs and hiring                    |
| Candidate / Teacher | Own profile, privacy, job search, applications and notifications                     |

Candidates are shared platform users. Institution memberships, jobs, applications, pipeline records, notes, interviews, legacy subscriptions, invoices and credit activity are tenant-scoped; new purchases are scoped to the institution or acting candidate.

Every protected request checks authentication, role, active membership where applicable, resource ownership, tenant scope and relevant feature flags. Candidate requests scope personal records to the acting candidate. PostgreSQL row-level security supplements API authorization; transaction-local tenant context and non-bypass database roles must be tested with connection pooling. Platform administrative access is explicit and audited.

## 4. Data model

### Platform records

- User, server Session and verification challenge records.
- CandidateProfile with display ID, structured qualifications, education, experience, skills, subjects/classes, locations, availability, salary/notice preferences, verification and profile status.
- CandidatePrivacyPreference separating directory visibility, directory contact consent and job-application contact consent. Record consent version, scope, timestamp and withdrawal.
- SubscriptionPlan and versioned plan configuration.
- PlatformFeatureSettings, PlatformSettings and AuditLog.
- Notifications addressed to users, with tenant scope where relevant.

### Institution records

- Institution/Tenant and TenantMembership with active status and institution roles.
- TenantSubscription with dates, status and an immutable purchased-terms snapshot: price, currency, duration, quotas, feature entitlements, expiry/carry-forward policy, cap and renewal warnings.
- CreditGrant with tenant, source, granted/remaining amount, valid-from, expiry, subscription/purchase reference and policy snapshot.
- TenantCreditTransaction and CreditAllocation linking each debit to its grant. Subscription balance counters are transactional projections of the ledger, not an independent source of truth.
- TenantCandidateUnlock with UNIQUE(tenant_id, candidate_id), actor, timestamp and ledger reference.
- Job with tenant, qualifications, subject, salary, location, employment type, vacancies, original closing date and publication status.
- JobApplication with tenant, job, candidate, attempt number, status and submission/closure timestamps; UNIQUE(job_id, candidate_id, attempt_number).
- ApplicationStatusHistory preserving each transition and actor.
- HiringPipelineEntry with tenant, candidate, optional job, source JOB_APPLICATION or DIRECT_SEARCH, stage and optional application reference.
- CandidateShortlist, FavouriteCandidate, RecruitmentNote and Interview, all tenant-scoped.
- PaymentRequest, PaymentApproval and Invoice; purchased line items and amounts remain immutable. Requests record tenant, plan/version snapshot, expected amount/currency, payment method, payee configuration snapshot, payer-entered UTR/reference, status and submission time. Approval records verified receipt reference, amount, recipient account identifier, verifier, verification time and decision reason. Future gateway event records are separate from manual approvals.
- SearchSession with tenant/subscription, query fingerprint, expiry and quota event reference.

The database must enforce that tenant-owned child records reference parents from the same tenant. Direct sourcing creates a pipeline entry, never a teacher-submitted JobApplication. Candidate billing entities may be added in Phase 2; the OFF flag must not expose checkout or paywalls at MVP.

## 5. Candidate privacy and consent

### Anonymous profile fields

Recruiters may view candidate display ID, qualifications, specialization, experience duration/type, subjects/classes, board experience, skills, broad location, salary expectations and availability, subject to visibility and consent rules.

Full name, mobile number and email are excluded from anonymous API payloads, search indexes, pagination, analytics and application responses. Unauthorized users must never receive these fields and rely on frontend masking.

Free text is also a potential identity disclosure. Anonymous previews use approved structured fields and sanitized/moderated summaries; unreviewed free text and identifying employer/organization details are excluded. Validate phone numbers, email addresses, URLs and obvious contact identifiers at submission, but do not treat automated detection as a guarantee. Tenant notes are private to that tenant and never enter shared candidate search results. Audit changes without copying unnecessary contact data or secrets into logs.

### Separate consent scopes

- Directory visibility controls whether a candidate appears in general institution searches.
- Directory contact consent controls eligibility for a first unlock through that path.
- Applying records consent to anonymous review by the receiving institution and a separate, explicit application-context contact permission. It never automatically unlocks contact details.
- A directory-hidden teacher can still apply. The receiving institution may review that application and unlock through its valid application consent, without requiring directory visibility.
- An institution must be verified and eligible for any first unlock.
- Each contact read reevaluates current relevant consent and profile status, even after an earlier unlock.

### Deactivation and withdrawal

Deactivation immediately removes search visibility, blocks new unlocks and suppresses contact fields in subsequent responses, including previously unlocked views. Application and hiring history remain available with an inactive indicator, subject to retention policy. Withdrawal invalidates the affected consent scope and triggers in-app notices to affected institutions. Where another valid scope exists, authorization must explicitly evaluate that scope; a global withdrawal denies all contact disclosure.

The default previously-unlocked policy is REVOKE_NEW_CONTACT_INITIATION, implemented by suppressing protected contact fields and blocking platform-facilitated new contact. Copies previously disclosed outside the platform cannot be remotely erased. Any alternative policy requires privacy review before activation. Reactivation does not recreate withdrawn consent; the teacher must reconfirm the appropriate permissions.

Retention periods, erasure requests, institution obligations and restricted access to retained application, payment and audit records require legal review before launch.

## 6. Contact unlock and credit accounting

### Authorization and transaction order

1. Authenticate and authorize an active institution member; verify tenant/resource scope and current consent/deactivation policy.
2. Look up the institution/candidate unlock before checking subscription validity or credit availability.
3. If already unlocked, return permitted fields at zero additional cost. An expired subscription, zero balance or disabled new-unlock flag does not itself revoke an existing unlock; current consent still governs disclosure.
4. For a first unlock, require enabled unlock feature, verified institution, eligible unexpired credit balance in paid mode (no subscription required in the simple model), active candidate and valid directory or application-context consent.
5. Within one database transaction, serialize the tenant/candidate unlock operation, recheck consent and eligibility against concurrent changes, and recheck whether another request created the unlock.
6. Lock an eligible credit grant, earliest expiry first with a deterministic tie-breaker; non-expiring grants follow expiring grants. Require at least one available credit.
7. Insert the unique unlock, decrement its grant, write the ledger debit/allocation and update projected balances atomically.
8. Commit and return only currently authorized fields. Retry serialization conflicts safely; a unique conflict rolls back the entire attempted debit and is resolved as an existing unlock.

Concurrency must never double-charge. A unique constraint alone does not replace transaction rollback, locking and retry handling. Repeated first-unlock calls across recruiters, jobs, plans and renewals share the same unlock record.

### Credit policies

Ledger types: PLAN_ALLOCATION, CARRY_FORWARD, CREDIT_PURCHASE, CANDIDATE_UNLOCK, BONUS_CREDIT, REFUND, ADMIN_ADJUSTMENT and EXPIRY. Every adjustment identifies its source and actor/event.

Legacy plan grants use their purchased EXPIRE or CARRY_FORWARD policy and cap. Carry-forward transfers close the old grant and allocate the new grant without counting the same credits twice. Renewal and expiry jobs are idempotent. Unrenewed grants are not spendable outside their validity; carry eligibility is retained separately for renewal according to the snapshotted policy.

MVP credit packs have independent purchased validity (default 365 days), configurable by Super Admin. Simple-model pack unlocks do not depend on subscription expiry.

## 7. Simple fees, unlock packs and Manual UPI

### Default launch pricing

| Feature | Launch default | Super Admin configuration |
| --- | --- | --- |
| Teacher account | Free | Account registration remains free; profile activation below can be paid |
| Teacher profile activation | Free | ₹0 for free, or any supported positive INR amount; paid activation covers subsequent profile edits |
| Teacher job application | Free | ₹0 for free, or configurable fee per job/application attempt |
| Institution job posting | Free | ₹0 for free, or configurable fee per published job |
| Candidate search | Free | Existing enable/disable switch; no paid search or search quota in the simple model |
| Contact unlock | Paid | Free/paid switch; paid mode uses a standard pack shared by all institutions |
| Standard unlock pack | ₹200 for 5 credits | Configurable price, credit count and validity; initial validity 365 days |

All monetary amounts are stored as integer paise. Administrative forms display rupees. Purchases use standard prices for every institution. Select pack quantity: one pack gives 5 credits for ₹200, two give 10 for ₹400, and so on. Super Admin may adjust a specific unpaid purchase with a fixed INR discount and recorded reason: e.g. ₹400 standard price minus ₹50 discount = ₹350 for 10 credits. This is a purchase adjustment, not a permanent institution price override. Discount must leave a positive payable amount and cannot change a submitted/approved purchase.

Pricing edits apply to newly created purchase requests. Save the quoted unit price, quantity, subtotal, discount, final payable amount, credit count, validity and payee details. Catalog changes do not alter existing quotes, approved fees or credit grants. Newly registered institutions receive no subscription-based free credits in this model.

### Feature fee workflow

Free features do not need payment. For paid features, use Teacher Payments or Institution Account to create the required fee request, pay and submit UTR, then await Super Admin verification. Profile activation is purchased once. Posting fees are single-use posting authorizations: after approval, return to the job form to publish; payment approval alone does not publish a vacancy. Application fees are tied to a specific job and next permitted application attempt; after approval, return to the job and submit. Jobs must still be open and the reapplication waiting period must have elapsed. Consent remains separately required.

If a paid application cannot be submitted because a job closes, do not consume the fee or silently create an application. Retain the unused approved request and resolve reimbursement manually with the payer. Automatic refunds/wallet transfers are not implemented at launch. Super Admin can record an external refund with reimbursement reference and reason only for an unused approved feature fee; consumed fees and credit packs cannot be refunded by this action. Avoid enabling per-application fees until this support process is in place.

### Contact credit workflow

Credit packs add to the institution's unexpired balance after approval. Each first authorized contact unlock consumes one credit. The same institution/candidate pair costs zero on repeat access, always subject to live candidate consent and active status. Credits are shared among that institution's recruiters, not between institutions. Each pack expires independently according to its purchased validity. Simple-model packs do not require an active subscription. Free unlock mode requires no credits, but still requires institution verification, relevant feature switch and valid consent.

Legacy purchased subscription grants remain available only during their purchased active term; queued renewal credits cannot be spent early. Old plan records and their historical receipts are retained for compatibility. They are not the default customer checkout or new customer enrollment model. Super Admin's Plans screen now configures fees and packs.

### Manual UPI verification

1. Create a protected purchase request and display its current amount, order ID, UPI ID, payee name and provisioned QR asset.
2. If requesting a discount, obtain the adjusted quote before paying. A stale amount must be rejected when submitting UTR so the payer can contact support for reconciliation.
3. Payer transfers externally and submits a text UTR. No upload routes or private receipt images. Pending/submitted requests grant no credits or paid-feature authorization.
4. Only Super Admin verifies the actual receipt, recipient and exact amount. Wrong or duplicate receipts cannot activate purchases.
5. Atomically record approval and either allocate a pack grant/ledger entry or authorize the purchased fee. Concurrent/repeated approval must grant once. One bank receipt cannot fund multiple orders or legacy plan requests.
6. Send an in-app result and show protected purchase history with subtotal, discount, amount and status. Rejected payments require support resolution; do not encourage another transfer before reconciliation.

Use AWAITING_PAYMENT, UNDER_REVIEW, APPROVED and REJECTED purchase states; consumption is recorded separately. Discounts and administrative decisions require an audit reason. UPI settings remain Super Admin controlled, with system QR assets provisioned at deployment. No real payments are enabled until the receiving account and matching QR are configured and verified. New purchase history is not a finalized statutory tax invoice; tax-compliant receipt/PDF generation is a launch follow-up.


## 8. Subscription expiry and renewal

Default policy, configurable through Super Admin and enforced server-side:

- Existing published jobs remain visible until their original closing date, unless independently closed, moderated or blocked by platform policy.
- Teachers may continue applying to those jobs while the application workflow is enabled.
- Recruiters may review existing and incoming applications and maintain their hiring records.
- New posting, reopening jobs, extending closing dates and first contact unlocks are blocked after subscription expiry.
- Anonymous candidate-directory access remains subject to active subscription search entitlements; prior application review is not a directory search.
- Previously unlocked contact details are governed by current consent/deactivation rules and cost zero credits to revisit.
- Renewal restores purchased subscription features, subject to verification, feature flags and valid candidate consent.

Institution blocking or a job reaching its closing date overrides continued publication/application eligibility. Expiry does not hide application history. Admin policy changes are audited and effective-dated.

Renewal warnings default to 30, 15, 7, 3 and 1 days before expiry, plus an expiry event. Deduplicate by subscription, recipient and trigger; skip past triggers for short terms. Show an unobtrusive dashboard/account banner with expiry date and credits. Use in-app notifications only. Expiry restricts affected actions rather than preventing review of existing work.

## 9. Job applications and hiring

Applications use attempt history rather than lifetime job/candidate uniqueness. Serialize submissions per job/candidate; enforce only one active attempt and idempotency for request retries.

Default active statuses: APPLIED, SHORTLISTED, INTERVIEW, SELECTED. Default terminal statuses: REJECTED, WITHDRAWN, NOT_SELECTED, JOINED. A new attempt is allowed only if the job is still open, the previous attempt is terminal and 30 days have elapsed since its closed_at timestamp. Super Admin may configure the waiting period. Reapplication cannot bypass expiry/closure or create simultaneous active attempts.

Recruiters can shortlist, reject, add notes and manage hiring stages without unlocking. In-app interview notices allow basic scheduling without revealing contact details. Interviews store timezone-aware times, mode, location/meeting text and status; calendar-provider integration is Phase 2.

Direct-search entries show source DIRECT_SEARCH and begin at SOURCED, then may move to SHORTLISTED, INTERVIEW, SELECTED and JOINED or a terminal outcome. They never appear as an application submitted by the teacher. Job-application entries retain their application reference and status history. Candidate application timelines display actual submissions and their outcomes only.

## 10. Feature flags and configurable policies

| Setting                              | Default | Behavior                                                          |
| ------------------------------------ | ------- | ----------------------------------------------------------------- |
| institution_job_posting_enabled      | ON      | OFF blocks new/reopened jobs; existing publication follows policy |
| candidate_job_search_enabled         | ON      | OFF blocks public candidate job browsing                          |
| candidate_job_applications_enabled   | ON      | OFF blocks new submissions; retains history                       |
| institution_candidate_search_enabled | ON      | OFF blocks directory access; application review remains available |
| institution_candidate_unlock_enabled | ON      | OFF blocks first unlocks; existing access still checks consent    |
| simple_pricing | ON | Profile/application/posting fees default ₹0; contact packs default ₹200/5 |

Workflow flags live in PlatformFeatureSettings; policy values live in PlatformSettings, with no duplicated source of truth. Both are versioned and audited. Settings changes require Super Admin authorization and backend enforcement without redeployment. Disabled actions return FEATURE_DISABLED consistently.

Policy settings include consent scopes, purchased credit expiry/carry rules, reapplication wait, expired-subscription job behavior, previous-unlock privacy policy and renewal warning defaults. INR is the launch currency. WhatsApp and age/gender search filters are disabled and outside MVP; any future activation requires the relevant provider/legal review.

## 11. Simple responsive UI and PWA

Use a light theme, blue accents, rounded cards, small icons and generous spacing. The reference image guides visual character only. Avoid oversized decorative elements and a dashboard containing every module.

| Role                | Primary navigation                            |
| ------------------- | --------------------------------------------- |
| Teacher             | Home, Find Jobs, Applications, Profile        |
| Institution         | Dashboard, Candidates, Jobs, Hiring, Account  |
| Admin / Super Admin | Role-specific sidebar and compact mobile menu |

Desktop uses a sidebar, compact summary cards and readable lists/tables. Mobile uses bottom navigation for teacher/institution views, two-column module cards where space allows, filter drawers and hiring stage lists. Notifications are reached through a header bell. Account contains institution profile, team, unlock packs and credit history; teacher privacy lives under Profile.

### Teacher screens

Landing/home, registration/login, sectioned profile setup/edit, completeness prompts, privacy/consent, job search/details, application timeline and in-app notification list. Profile and application fees default to ₹0 and may be configured.

### Institution screens

Registration/profile, verification state, dashboard, anonymous candidate search/profile, explicit one-credit unlock confirmation, consent-aware unlocked profile, job posting/management, application review, hiring stages/notes, basic interview scheduling, team permissions, subscription/credit ledger, payment history/invoices and basic reports.

### Administrative screens

Candidate moderation, institution verification/blocking, fee and pack configuration, purchase discounts, payment decisions and manual refund support, unlock/credit audit, basic platform reports and Super Admin workflow/policy settings. Deferred capabilities have no misleading active controls.

Accessibility includes labeled forms, keyboard navigation, visible focus, readable contrast, non-color status labels, touch-friendly controls, clear empty/error/loading states and confirmation before paid unlocks.

### PWA behavior

The normal HTTPS website works without installation. Installability depends on the device/browser. Cache static application assets only. No private API responses, profiles, contact fields, invoices, payments or authenticated HTML are cached by the service worker. Apply appropriate no-store headers to sensitive responses; exclude them from persistent client stores.

Applying, unlocking, payment, profile changes and all authorized transactions require connectivity. Offline shows a simple reconnect screen; do not enqueue financial or recruitment mutations. Logout revokes the session and clears user state, private storage and any obsolete private caches. Provide a safe update prompt so a service-worker update does not interrupt an unfinished form.

## 12. In-app notifications

Persist notifications for application submission/status, shortlist, interview creation/rescheduling, new applications, contact consent withdrawal, payment outcome, renewal warnings, expiry and low/exhausted credits. Deduplicate retries and scope each recipient to authorized tenant/user access. Matching suggestions may be deferred until matching rules exist.

Polling is sufficient for MVP. No recruitment, renewal or marketing email/SMS, push or WhatsApp delivery is required. Verification email/SMS has separate templates, secrets, retry limits, expiry and abuse controls and is not part of the notification delivery matrix.

## 13. Delivery scope

### MVP

1. Foundation: selected project stack, migrations, secure sessions, verification, role/tenant guards, audit and feature settings.
2. Candidate profiles, structured privacy-safe previews, separate consent scopes and deactivation.
3. Institution onboarding/verification, team permissions, configurable feature fees and unlock packs with purchased snapshots.
4. Manual UPI requests, Super Admin receipt verification/approval, protected invoices, grant-based credit ledger and expiry/renewal worker.
5. Jobs, attempt-based applications, anonymous review and application history.
6. Free candidate search, atomic shared unlock and separate direct-source hiring pipeline.
7. Basic interviews, notes, in-app notifications, dashboards and basic reports.
8. Responsive PWA, admin controls, deployment, monitoring, backup/restore and security validation.

Basic institution reports cover active jobs, applications/status counts, hiring outcomes and credit usage. Platform reports cover candidate/institution totals, verification state, subscriptions, payments and unlock activity; reports do not expose unauthorized personal data. No report file export is required.

### Phase 2

Razorpay gateway integration, additional paid services, calendar integrations, campaigns, featured promotion, advanced analytics, AI matching/summaries, referrals, additional verification and approved additional notification channels. Merchant UPI can be configured earlier without a gateway integration. Introduce Redis or realtime infrastructure only when measurements or concrete requirements justify it.

## 14. Deployment and operations

Target eligible Oracle Cloud Always Free compute with Nginx, API, worker and private PostgreSQL. Verify current tenancy quotas, regional capacity and architecture compatibility before provisioning. Prefer a compatible ARM64 shape where available; do not promise free capacity or hard-code infrastructure quotas.

Expose HTTPS and only necessary tightly restricted administration. PostgreSQL must not be public. Configure TLS renewal, firewall/security groups, patched OS/runtime, least-privilege service users and secrets outside source control.

Separate local, staging and production settings. Pin dependencies, build for the target architecture, run migrations as a controlled release step, use health checks/restarts and document rollback. Encrypt scheduled off-VM backups with access controls and retention. Define RPO/RTO and demonstrate restoration before launch.

Monitor disk, CPU, memory, database connections, HTTP errors, verification failures, worker failures and payment reconciliation. Maintain incident and recovery runbooks and a migration path to paid compute/managed database. Always Free is the initial target; domains, verification providers, processing fees and external backups may cost money.

## 15. Acceptance criteria

- [ ] All four role views work on desktop/mobile; eligible devices can install the PWA.
- [ ] UI follows the approved simple light/blue design and primary navigation.
- [ ] Service worker caches only static assets; private data is absent from browser caches/persistent stores and cleared on logout.
- [ ] Application and directory workflows operate independently and respect server-side flags.
- [ ] Anonymous payloads omit structured identity and unreviewed identifying free text.
- [ ] Directory-hidden teachers can apply and grant application-context consent independently.
- [ ] Previously unlocked access costs zero with an expired subscription or zero credits when current consent permits.
- [ ] Concurrent first unlocks charge exactly once; different tenants never share unlock access.
- [ ] Concurrent deactivation/withdrawal prevents unauthorized contact disclosure or charging.
- [ ] Direct sourcing creates pipeline records without fabricated teacher applications.
- [ ] Application retries are idempotent; only one active attempt exists and reapplication respects terminal status/wait.
- [ ] Simple-model candidate search is free and not subscription/quota dependent; pagination retains tenant isolation.
- [ ] Plan edits leave purchased price/quota/expiry snapshots unchanged.
- [ ] Credit expiry/carry-forward jobs are idempotent and balances reconcile to grants and ledger.
- [ ] Simple-model posting/search do not depend on subscriptions; pack credits have independent expiry. Legacy purchased terms are preserved.
- [ ] Manual UPI displays the configured matching QR/UPI ID, payee and snapshotted plan amount without introducing file uploads.
- [ ] Submitting a UTR does not activate subscriptions or allocate credits; only Super Admin approval after verified receipt does so.
- [ ] Duplicate receipts and repeated/concurrent approvals never duplicate subscriptions, credits or invoices, including across tenants.
- [ ] Wrong-amount, rejected and pending payments grant no new entitlements; early renewal and expired renewal follow their activation dates.
- [ ] Payment-setting changes preserve pending request snapshots; institution access and approval permissions are enforced.
- [ ] Razorpay remains disabled with no required launch credentials, webhook endpoint or gateway checkout.
- [ ] In-app notifications work; verification messages remain separate; no recruitment email/SMS dependency exists.
- [ ] Basic interviews and reports work without calendar integration or advanced analytics.
- [ ] Cross-tenant API/database access tests cover jobs, applications, memberships, pipeline, credits, payments and invoices.
- [ ] Session/CSRF, input validation, rate limits, accessible UI and protected logging are verified.
- [ ] HTTPS deployment, private database, health checks, alerts and off-VM restore drill pass.
- [ ] Domain/branding, privacy/retention and invoice/tax requirements receive launch validation.

### Account password length

Teacher and institution self-registration and recruiter account creation require passwords of 8–128 characters. Existing passwords remain valid.
`nTeacher profile: compact Personal, Qualifications, Experience, Preferences and Privacy tabs. Personal first/middle/last names and mobile are protected identity fields. Qualification options include PUC/12th, undergraduate, postgraduate and teaching degrees, with Other/manual entry. Education stores institution, year and percentage/grade/CGPA; experience stores role, subject and years. Anonymous previews exclude personal details and institution names.

Profile field grouping: Personal contains names, mobile and current location; Qualifications contains highest qualification and education; Experience contains primary subject, total years and roles; Preferences contains salary, availability, notice period and preferred locations.

On teacher Save profile, request explicit directory consent: Allow all verified institutions and save, Keep directory private and save, or Cancel. Allow enables directory visibility/contact consent; private disables both. This does not bypass profile approval, active status, verified institution requirements or contact unlock rules. Application consent remains separate.


## Teacher profile additions and QR registration

Teacher profile Personal details includes date of birth and gender (Male, Female, Other, Prefer not to say). Experience includes employment status (Fresher, Previously worked, Currently working) and teaching medium, with Other/manual entry. Existing profiles can retain empty values and complete them later. Date of birth must be valid and cannot be in the future. Date of birth, Aadhaar and personal contact information are private; institutions receive only permitted recruitment data. Employment status and teaching medium appear in candidate summary. Aadhaar remains optional and is masked in admin View.

### Public QR registration and campaigns

- After cloud deployment, a permanent HTTPS URL such as https://your-domain/teacher-registration opens from a registration QR code. localhost is not the public QR destination.
- Super Admin can preview/download/print a QR for this permanent link. This QR is separate from the Manual UPI payment QR.
- Registration steps: Personal & contact; Qualifications; Experience & subjects; Location & preferences; Review & consent/account creation.
- Collect name, date of birth, gender, mobile/email, optional Aadhaar; highest qualification and SSLC/PUC/degree institution, stream, year and percentage/grade; employment status, teaching medium, subjects and experience; location, optional address and preferences.
- Submission creates one account/profile in the existing CampusFaculty database. Account password uses the existing minimum of 8 characters. Existing email/mobile directs the teacher to sign-in/account recovery rather than creating a duplicate.
- Separate directory visibility/contact consent and job-application consent. Apply configured manual/automatic profile approval and existing configurable activation fees. Scanning alone does not bypass approval, fees, consent or verification.
- Teachers subsequently log in to edit their profile and apply to jobs. Schools access permitted candidate details through the existing search/unlock rules. No public contact disclosure or Aadhaar exposure.

Campaigns and public registration are now implemented: Super Admin creates unique campaign codes, downloads QR PNGs, changes active status, and views account/submitted-profile/shortlisted/selected counts. QR links use VITE_PUBLIC_URL or the current origin; configure the HTTPS cloud URL before printing. /teacher-registration supports account creation followed by the existing profile sections and consent confirmation. It preserves profile activation fees and moderation. Campaign registration is source attribution, not a job application. Existing campaigns/registrations are retained when deactivated.

Selected production URLs: https://faculty.telicampus.in/ is the one shared role-based login. /teacher-registration is the public teacher signup page within that same application; campaign QR links use /teacher-registration?campaign=CODE. No separate teacher, institution or admin login domains.

## QR profession selection — 2026-10-10
All public teacher-registration and campaign QR links first display Choose your profession. Teacher (Register now) opens the existing account/profile form. Pharmacist, Technician, Marketing / Sales and Electrician display Coming soon with Back to professions. Other professions do not create accounts or submit profiles. Existing campaign codes stay in the URL and apply to teacher registration. No employer or database changes in this release.


## Viewed by employer — 2026-10-10
Record application firstViewedAt only when employer opens the full candidate profile from its application after contact unlock. Basic Hiring View and unlock alone do not count. Server enforces application tenant, verified/unblocked employer, actual unlock, reviewed/active profile and contact consent. Candidate Applications list/detail shows viewed date separate from hiring status. First timestamp is immutable on repeated views; existing applications are not backfilled.


## Audit log — 2026-10-10
Admin-only read-only audit page with user/activity search, action filter, India-time date range, server pagination, blue-header table and View details. Columns: date/time, user, action, institution, record, details. Added login success/failure, logout, application submission/view, note and interview events alongside existing moderation/payment/unlock/settings events. No historical backfill. Password/OTP/Aadhaar/token/contact field keys filtered from display and new top-level audit details. No IP collection added.


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

## Multi-profession expansion plan � 2026-10-11
See [MULTI_PROFESSION_PLAN.md](MULTI_PROFESSION_PLAN.md) for the agreed pharmacy flow and proposed Electrician/Nursing forms, multi-select employer preferences, private registration verification and shared nearby-place search. Planning only; no new profession is enabled by this documentation update.

### Nursing plan expanded - 2026-10-11
[MULTI_PROFESSION_PLAN.md](MULTI_PROFESSION_PLAN.md) now includes GNM diploma naming, post-basic diplomas, multiple/pursuing education entries, separate nursing/caregiver roles, registration declaration versus verification, experience/skills, shifts, locations, employer filters, private View details, job posting and acceptance checks. Documentation only.

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
