# Local implementation status

Implemented: teacher/institution/owner workspaces, structured candidate profiles and consent, anonymous job applications, direct-source hiring, credit unlocks, tenant isolation through API checks and PostgreSQL RLS, Manual UPI request/review/approval, plan snapshots, team management, notes/interviews, in-app notifications, basic reports, protected invoice receipts, static-only PWA and deployment templates.

Checks: policy tests, real PostgreSQL integration tests with non-superuser role, headless Edge flows and desktop/mobile screenshots in .local/screenshots. Integration data stays in random test schemas and is separate from the local application tables. Demo UI accounts are development fixtures, not real institutions.

Local owner credentials are in apps/api/.env. Demo institution credentials are in .local/demo-credentials.env. Do not commit or share these files. Manual UPI starts disabled. Real UPI details, a matching versioned QR asset and verification providers must be configured before live use.

Deployment has not been performed on Oracle Cloud. Docker/ARM64, HTTPS, external alerts and off-VM restoration need environment validation. Production tax invoice content, retention policies and domain/branding clearance remain launch gates. No real payment has been accepted or approved during implementation tests.

OpenAPI route reference: apps/api/openapi.json. Validation is enforced server-side by Zod; detailed schemas and additional accessibility/security review remain follow-up hardening tasks.

Candidate anonymous text is hidden until moderator approval. Profile edits preserve approval after initial approval; admin approval is content review, not a guarantee of education/experience verification. Structured numeric fields and text previews are serialized separately from contact information.

Implemented v1.6 simple pricing: configurable profile activation/application/posting fees, standard quantity-based credit packs, unpaid purchase discounts, protected purchase history, audited Manual UPI approvals and additive credits with independent validity. Existing subscription purchases are preserved. New model has no search/posting subscription quotas.

Validation of simple commerce: build, five policy checks, real PostgreSQL integration tests (pack quantities/discounts/snapshots, role isolation, pending-payment denial, concurrent approval, paid feature use and unused-fee refund), and headless Edge desktop/mobile pricing/buyer checks passed. Real collections remain disabled.
