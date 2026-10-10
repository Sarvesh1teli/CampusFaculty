-- CampusFaculty-only query indexes. No table/data changes.
-- For a live database, run each CREATE INDEX with CONCURRENTLY via psql,
-- then prisma migrate resolve --applied 20261010183000_query_indexes.
-- Standard migrate deploy supports fresh/offline databases.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "User_tenantId_role_idx" ON "User" ("tenantId", "role");
CREATE INDEX "User_tenantId_active_idx" ON "User" ("tenantId", "active");
CREATE INDEX "VerificationChallenge_userId_channel_expiresAt_idx" ON "VerificationChallenge" ("userId", "channel", "expiresAt");
CREATE INDEX "Session_expiresAt_idx" ON "Session" ("expiresAt");
CREATE INDEX "Candidate_mobile_idx" ON "Candidate" ("mobile");
CREATE INDEX "Subscription_tenantId_endsAt_idx" ON "Subscription" ("tenantId", "endsAt");
CREATE INDEX "Subscription_endsAt_idx" ON "Subscription" ("endsAt");
CREATE INDEX "CreditGrant_expiresAt_idx" ON "CreditGrant" ("expiresAt");
CREATE INDEX "CreditTransaction_tenantId_createdAt_idx" ON "CreditTransaction" ("tenantId", "createdAt");
CREATE INDEX "CreditTransaction_tenantId_type_idx" ON "CreditTransaction" ("tenantId", "type");
CREATE INDEX "Job_tenantId_createdAt_idx" ON "Job" ("tenantId", "createdAt");
CREATE INDEX "Job_status_closesAt_idx" ON "Job" ("status", "closesAt");
CREATE INDEX "Application_candidateId_createdAt_idx" ON "Application" ("candidateId", "createdAt");
CREATE INDEX "Application_tenantId_candidateId_contactConsent_idx" ON "Application" ("tenantId", "candidateId", "contactConsent");
CREATE INDEX "Pipeline_tenantId_candidateId_idx" ON "Pipeline" ("tenantId", "candidateId");
CREATE INDEX "Pipeline_candidateId_idx" ON "Pipeline" ("candidateId");
CREATE INDEX "StatusHistory_applicationId_createdAt_idx" ON "StatusHistory" ("applicationId", "createdAt");
CREATE INDEX "Note_tenantId_pipelineId_idx" ON "Note" ("tenantId", "pipelineId");
CREATE INDEX "Interview_tenantId_pipelineId_idx" ON "Interview" ("tenantId", "pipelineId");
CREATE INDEX "PaymentRequest_tenantId_createdAt_idx" ON "PaymentRequest" ("tenantId", "createdAt");
CREATE INDEX "PaymentRequest_createdAt_idx" ON "PaymentRequest" ("createdAt");
CREATE INDEX "Invoice_tenantId_idx" ON "Invoice" ("tenantId");
CREATE INDEX "Audit_createdAt_idx" ON "Audit" ("createdAt");
CREATE INDEX "Audit_action_createdAt_idx" ON "Audit" ("action", "createdAt");
CREATE INDEX "Audit_actorId_createdAt_idx" ON "Audit" ("actorId", "createdAt");
CREATE INDEX "Audit_entityId_action_idx" ON "Audit" ("entityId", "action");
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification" ("userId", "createdAt");
CREATE INDEX "CommerceOrder_tenantId_createdAt_idx" ON "CommerceOrder" ("tenantId", "createdAt");
CREATE INDEX "CommerceOrder_userId_createdAt_idx" ON "CommerceOrder" ("userId", "createdAt");
CREATE INDEX "CommerceOrder_createdAt_idx" ON "CommerceOrder" ("createdAt");
CREATE INDEX "CommerceOrder_userId_kind_target_status_idx" ON "CommerceOrder" ("userId", "kind", "target", "status");
CREATE INDEX "CommerceOrder_tenantId_kind_target_status_idx" ON "CommerceOrder" ("tenantId", "kind", "target", "status");
CREATE INDEX "CommerceOrder_status_idx" ON "CommerceOrder" ("status");
CREATE INDEX "User_name_trgm_idx" ON "User" USING gin ("name" gin_trgm_ops);
CREATE INDEX "User_email_trgm_idx" ON "User" USING gin ("email" gin_trgm_ops);
CREATE INDEX "Audit_action_trgm_idx" ON "Audit" USING gin ("action" gin_trgm_ops);
CREATE INDEX "Audit_entityId_trgm_idx" ON "Audit" USING gin ("entityId" gin_trgm_ops);
CREATE INDEX "Candidate_subject_trgm_idx" ON "Candidate" USING gin ("subject" gin_trgm_ops);
CREATE INDEX "Candidate_location_trgm_idx" ON "Candidate" USING gin ("location" gin_trgm_ops);
CREATE INDEX "Candidate_qualification_trgm_idx" ON "Candidate" USING gin ("qualification" gin_trgm_ops);
CREATE INDEX "Job_title_trgm_idx" ON "Job" USING gin ("title" gin_trgm_ops);
CREATE INDEX "Job_location_trgm_idx" ON "Job" USING gin ("location" gin_trgm_ops);
CREATE INDEX "Candidate_discoverable_idx" ON "Candidate" (id) WHERE active AND "directoryVisible" AND "profileReviewed";
CREATE INDEX "Setting_key_prefix_idx" ON "Setting" (key text_pattern_ops);
