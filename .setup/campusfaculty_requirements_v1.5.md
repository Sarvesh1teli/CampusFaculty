# CampusFaculty — Requirements v1.5

Date: 08-Oct-2026; updated 09-Oct-2026 for Manual UPI launch payments  
Status: Approved product baseline for MVP; production infrastructure and legal validation remain launch gates.

This document consolidates v1.4 and the approved v1.5 decisions directly into the relevant sections. It replaces the earlier requirements and correction appendix for implementation. The supplied screenshot is visual inspiration, not an exact layout specification. CampusFaculty is the working name; domain and trademark availability remain unverified.

## 1. Product scope

CampusFaculty connects teachers, lecturers, professors and non-teaching staff with schools, colleges, coaching institutes and other educational institutions.

Two independent recruitment paths are enabled by default:

1. Teachers find published jobs and submit applications.
2. Verified institutions search an anonymous candidate directory and add sourced candidates to their own hiring pipeline.

An application never reveals contact details or consumes unlock credits. The first authorized contact unlock costs one credit per institution/candidate pair. All active recruiters within that institution share the unlock; another institution must unlock independently.

Candidate core features are free at launch. Candidate monetization remains OFF and reserved for a later release. No candidate photos, resumes, certificates, attachments or user file uploads/downloads are supported. Authorized users may download system-generated invoice PDFs as the sole document-download exception.

## 2. Selected architecture and technology

| Component | Selected requirement |
|---|---|
| Frontend | React + TypeScript + Vite |
| UI | Tailwind CSS + shadcn/ui |
| Mobile | Responsive, optionally installable PWA using vite-plugin-pwa |
| Backend | Node.js LTS + NestJS + TypeScript; modular monolith |
| API | REST over HTTPS with OpenAPI documentation |
| Database | PostgreSQL + Prisma migrations and ORM |
| Authentication | Server-managed sessions; Secure, HttpOnly, SameSite cookies; CSRF protection |
| Hosting | Eligible Oracle Cloud Always Free compute |
| Web server | Nginx with HTTPS and automated certificate renewal |
| Payments | Manual UPI with Super Admin approval; INR at launch. Razorpay disabled initially and supported in Phase 2 |
| Notifications | Persisted in-app notifications with polling |
| Verification | Separate external email/SMS services for verification and authentication |
| Background work | PostgreSQL-backed durable tasks and a basic scheduled worker |
| Deployment | Docker Compose with API, worker and private PostgreSQL services |

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

| Role | Scope and permissions |
|---|---|
| Super Admin | Platform settings, workflow flags, policies, privileged audit and emergency controls |
| Platform Admin | Institution verification, candidate moderation, plans, payments and platform reports |
| Tenant Admin | Institution profile, team, subscription, credits, jobs and hiring |
| Recruiter | Authorized institution candidate search, unlocks, jobs and hiring |
| Candidate / Teacher | Own profile, privacy, job search, applications and notifications |

Candidates are shared platform users. Institution memberships, jobs, applications, pipeline records, notes, interviews, subscriptions, invoices and credit activity are tenant-scoped.

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
4. For a first unlock, require enabled unlock feature, verified institution, active eligible subscription, active candidate and valid directory or application-context consent.
5. Within one database transaction, serialize the tenant/candidate unlock operation, recheck consent and eligibility against concurrent changes, and recheck whether another request created the unlock.
6. Lock an eligible credit grant, earliest expiry first with a deterministic tie-breaker; non-expiring grants follow expiring grants. Require at least one available credit.
7. Insert the unique unlock, decrement its grant, write the ledger debit/allocation and update projected balances atomically.
8. Commit and return only currently authorized fields. Retry serialization conflicts safely; a unique conflict rolls back the entire attempted debit and is resolved as an existing unlock.

Concurrency must never double-charge. A unique constraint alone does not replace transaction rollback, locking and retry handling. Repeated first-unlock calls across recruiters, jobs, plans and renewals share the same unlock record.

### Credit policies

Ledger types: PLAN_ALLOCATION, CARRY_FORWARD, CREDIT_PURCHASE, CANDIDATE_UNLOCK, BONUS_CREDIT, REFUND, ADMIN_ADJUSTMENT and EXPIRY. Every adjustment identifies its source and actor/event.

Plan grants use the purchased EXPIRE or CARRY_FORWARD policy and cap. Carry-forward transfers close the old grant and allocate the new grant without counting the same credits twice. Renewal and expiry jobs are idempotent. Unrenewed grants are not spendable outside their validity; carry eligibility is retained separately for renewal according to the snapshotted policy.

Phase 2 add-on grants have independent validity: default 90 days, configurable 30/90/180/365 days or no expiry. An expired underlying subscription blocks first unlocks even if an add-on balance remains. MVP does not include add-on checkout.

## 7. Plans, payments and search quotas

Plans are database-configured. Reference defaults remain configurable:

| Entitlement | Free | Plan 1 | Plan 2 | Premium |
|---|---|---|---|---|
| Unlock credits | 3 | 15 | 50 | 150 |
| Job posts per term | 1 | 5 | 15 | Unlimited |
| Active jobs | 1 | 5 | 15 | Unlimited |
| Candidate searches per term | 5 | Unlimited | Unlimited | Unlimited |
| Term | 30 days | 30 days | 30 days | 30 days |
| Advanced filters | No | Yes | Yes | Yes |

These are reference catalog values, not hard-coded prices or mandatory tier names. Featured promotion, priority ranking and advanced analytics are Phase 2 capabilities, not MVP entitlements that promise unavailable behavior.

Editing a catalog plan affects future purchases/renewals. Existing subscriptions keep their purchased snapshots. Explicit institution-specific overrides require an effective date and audit trail. No silent changes to historical prices, invoices, quotas or credit expiry.

### Manual UPI launch workflow

1. Institution selects a plan. The server creates a tenant-scoped payment request with an immutable price, currency and purchased-terms snapshot.
2. Show the exact amount, payee name, configured UPI ID, QR code and payment-request ID. The institution pays externally using a UPI app; the QR code does not prove receipt or guarantee the entered payment amount.
3. The institution submits its UTR/transaction reference as text. No screenshot, receipt or other file upload is permitted. Submission moves the request to UNDER_REVIEW and grants no subscription or credits.
4. Super Admin verifies the actual recipient bank/payment-account receipt, amount and reference against the request. A payer-entered reference alone is insufficient. An unmatched or wrong-amount transfer remains under review or is rejected with a reason; it must not activate automatically.
5. Approval atomically marks the verified payment approved, activates the snapshotted subscription, allocates its credit grant/ledger entry and creates the authorized invoice record. Repeated or concurrent approval must return the existing outcome without duplicate subscriptions, credits or invoices.
6. Notify the institution in-app of approval or rejection and show the outcome in Account/payment history. Renewal starts from approval/activation if the previous term expired; early renewal is queued after the current term ends, with credits eligible only from the new term's start. Pending requests do not restore expired features.

Use states AWAITING_PAYMENT, UNDER_REVIEW, APPROVED, REJECTED and CANCELLED. Keep refund state/history separate from approval. Capture actor, timestamp and reason for submission changes and every administrative decision. Prevent one verified bank receipt from funding multiple payment requests across tenants using a unique receipt identifier scoped to the recipient account; flag duplicate submitted references for review. Normalize references without assuming one universal UTR length/format. Institutions can access only their own requests; only Super Admin can approve/reject at MVP.

The Super Admin payment settings contain payment_method=MANUAL_UPI, manual_verification_enabled=true, upi_id, payee_name, approved QR system-asset reference and razorpay_enabled=false. QR assets are provisioned during deployment; the settings UI selects an approved asset and does not upload files or accept arbitrary remote images. Payment settings are versioned/audited. Existing requests retain their payee snapshot when settings change. Deploy a matching QR/UPI pair, show the text UPI ID alongside the QR, and verify the destination before enabling collections. No payment credentials or private bank statements are public configuration.

Personal UPI is a proposed temporary collection option, not a verified compliance decision. Confirm that the receiving bank/app permits the intended use and resolve applicable invoicing/tax requirements before live collections. Merchant UPI can replace it through configuration without changing subscription or credit accounting. Refunds are performed externally and recorded with verification and audit; changing a database state alone does not move money.

### Future payment gateway

Razorpay is disabled and not a launch dependency. Preserve a payment-method abstraction so merchant UPI or a gateway can use the same subscription activation and credit allocation service. When enabled in Phase 2, create orders server-side, verify signatures, amount, currency, tenant and purchase reference, and process events idempotently. Client checkout success alone never grants access. Historical Manual UPI receipts remain attributable to their original method.

Invoices are generated server-side and accessible only to authorized institution users; no public invoice URLs. Final tax content requires launch validation.

A counted candidate search is a new submitted query/filter combination within a short-lived search session. Pagination, retry and reopening that result session do not consume another search. Once the session expires, resubmission counts again. Shared tenant quota usage is transactional, concurrent requests are deduplicated and session tokens are tenant-bound. Return SEARCH_QUOTA_EXHAUSTED as a documented domain error; reserve HTTP 429 for rate limiting.

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

| Setting | Default | Behavior |
|---|---|---|
| institution_job_posting_enabled | ON | OFF blocks new/reopened jobs; existing publication follows policy |
| candidate_job_search_enabled | ON | OFF blocks public candidate job browsing |
| candidate_job_applications_enabled | ON | OFF blocks new submissions; retains history |
| institution_candidate_search_enabled | ON | OFF blocks directory access; application review remains available |
| institution_candidate_unlock_enabled | ON | OFF blocks first unlocks; existing access still checks consent |
| candidate_monetization_enabled | OFF | Candidate paywalls and checkout absent at MVP |

Workflow flags live in PlatformFeatureSettings; policy values live in PlatformSettings, with no duplicated source of truth. Both are versioned and audited. Settings changes require Super Admin authorization and backend enforcement without redeployment. Disabled actions return FEATURE_DISABLED consistently.

Policy settings include consent scopes, purchased credit expiry/carry rules, reapplication wait, expired-subscription job behavior, previous-unlock privacy policy and renewal warning defaults. INR is the launch currency. WhatsApp and age/gender search filters are disabled and outside MVP; any future activation requires the relevant provider/legal review.

## 11. Simple responsive UI and PWA

Use a light theme, blue accents, rounded cards, small icons and generous spacing. The reference image guides visual character only. Avoid oversized decorative elements and a dashboard containing every module.

| Role | Primary navigation |
|---|---|
| Teacher | Home, Find Jobs, Applications, Profile |
| Institution | Dashboard, Candidates, Jobs, Hiring, Account |
| Admin / Super Admin | Role-specific sidebar and compact mobile menu |

Desktop uses a sidebar, compact summary cards and readable lists/tables. Mobile uses bottom navigation for teacher/institution views, two-column module cards where space allows, filter drawers and hiring stage lists. Notifications are reached through a header bell. Account contains institution profile, team, subscription and credit history; teacher privacy lives under Profile.

### Teacher screens

Landing/home, registration/login, sectioned profile setup/edit, completeness prompts, privacy/consent, job search/details, application timeline and in-app notification list. Core functions remain free.

### Institution screens

Registration/profile, verification state, dashboard, anonymous candidate search/profile, explicit one-credit unlock confirmation, consent-aware unlocked profile, job posting/management, application review, hiring stages/notes, basic interview scheduling, team permissions, subscription/credit ledger, payment history/invoices and basic reports.

### Administrative screens

Candidate moderation, institution verification/blocking, plan catalog, subscriptions, payment/refund management, unlock/credit audit, basic platform reports and Super Admin workflow/policy settings. Deferred capabilities have no misleading active controls.

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
3. Institution onboarding/verification, team permissions, configurable plans and purchased snapshots.
4. Manual UPI requests, Super Admin receipt verification/approval, protected invoices, grant-based credit ledger and expiry/renewal worker.
5. Jobs, attempt-based applications, anonymous review and application history.
6. Candidate search/quota sessions, atomic shared unlock and separate direct-source hiring pipeline.
7. Basic interviews, notes, in-app notifications, dashboards and basic reports.
8. Responsive PWA, admin controls, deployment, monitoring, backup/restore and security validation.

Basic institution reports cover active jobs, applications/status counts, hiring outcomes and credit usage. Platform reports cover candidate/institution totals, verification state, subscriptions, payments and unlock activity; reports do not expose unauthorized personal data. No report file export is required.

### Phase 2

Razorpay gateway integration, add-on credit purchases, candidate paid plans/checkout, calendar integrations, campaigns, featured promotion, advanced analytics, AI matching/summaries, referrals, additional verification and approved additional notification channels. Merchant UPI can be configured earlier without a gateway integration. Introduce Redis or realtime infrastructure only when measurements or concrete requirements justify it.

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
- [ ] Pagination/retry within a search session does not consume extra quota; tenant quota updates are atomic.
- [ ] Plan edits leave purchased price/quota/expiry snapshots unchanged.
- [ ] Credit expiry/carry-forward jobs are idempotent and balances reconcile to grants and ledger.
- [ ] Expired subscriptions preserve original published jobs and incoming application review while blocking new posting/reopening/date extensions and first unlocks.
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

